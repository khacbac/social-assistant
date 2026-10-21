import { sleep } from "@/core/humanize";
import { log } from "@/core/log";
import { updateState } from "@/core/storage";
import { generate } from "@/ai/anthropic";
import { buildTiktokCommentMessage, withLanguageDirective } from "@/ai/prompts";
import { openWorkTab, sendToTab } from "@/background/messaging";
import type { PlatformAdapter, JobContext } from "@/platforms/types";
import type { FindTargetResult, PingResponse } from "./messages";
import { postCommentTrusted } from "./cdp";
import { sourceUrl, userUrl, handleOf } from "./sources";

const HOME = "https://www.tiktok.com/foryou";
const MIN_COMMENTS = 6;
const MAX_SCROLLS = 20;
const SCROLL_ROUNDS = 8;
const LIKE_DELAY_SEC = 4;

interface SimpleResult {
  ok: boolean;
  error?: string;
  skipped?: boolean;
  scrolled?: number;
  likedCount?: number;
}

function requireTabId(tab: chrome.tabs.Tab): number {
  if (tab.id == null) throw new Error("Không mở được tab TikTok.");
  return tab.id;
}

/** Gõ bình luận: ưu tiên CDP "trusted", lỗi thì lùi về đường mềm (content). */
async function typeComment(tabId: number, text: string, postKey: string): Promise<void> {
  // Mở sẵn panel bình luận trước (bỏ qua nếu lỗi — CDP cũng tự mở).
  await sendToTab(tabId, { type: "TT_PREPARE_COMMENT" }).catch(() => {});
  try {
    await postCommentTrusted(tabId, text);
  } catch (err) {
    await log("warn", `Đường CDP lỗi (${(err as Error).message}). Thử đường mềm…`);
    const res = await sendToTab<SimpleResult>(tabId, { type: "TT_CREATE_COMMENT", text, postKey });
    if (!res.ok) throw new Error(res.error || "Gõ bình luận thất bại cả hai đường.");
  }
}

async function runComment({ profile, ai }: JobContext): Promise<string> {
  const pick =
    profile.sources.length > 0
      ? profile.sources[Math.floor(Math.random() * profile.sources.length)]
      : undefined;
  const startUrl = pick ? sourceUrl(pick) : HOME;

  const tab = await openWorkTab("tiktok", startUrl, true);
  const tabId = requireTabId(tab);
  await sleep(2500);

  const ping = await sendToTab<PingResponse>(tabId, { type: "PING" });
  if (ping.state !== "ok") throw new Error("TikTok chưa sẵn sàng (đã đăng nhập chưa?).");

  await log("info", "Đang lướt TikTok tìm video đủ bình luận và hợp chủ đề…");
  const find = await sendToTab<FindTargetResult>(tabId, {
    type: "TT_FIND_COMMENT_TARGET",
    skipKeys: profile.commentedKeys,
    minComments: MIN_COMMENTS,
    maxScrolls: MAX_SCROLLS,
    keywords: profile.keywords,
    minRelevanceScore: profile.minRelevanceScore,
  });

  if (!find.ok) throw new Error(find.error);
  if ("skipped" in find) return `Bỏ qua: ${find.reason}`;

  const t = find.target;
  await log("info", `Video @${t.author || "?"} (${t.commentCount} bình luận). Gọi Haiku…`);

  const comment = await generate(
    ai,
    withLanguageDirective(profile.systemPrompt, profile.commentLanguage),
    buildTiktokCommentMessage({ author: t.author, caption: t.caption }, ai.maxChars, profile.commentLanguage),
  );
  await log("info", `AI: "${comment}". Đang gõ như người thật…`);

  await typeComment(tabId, comment, t.postKey);

  await updateState((draft) => {
    const p = draft.profiles.find((x) => x.id === profile.id);
    if (p) p.commentedKeys = [t.postKey, ...p.commentedKeys.filter((k) => k !== t.postKey)];
  });

  return `Đã bình luận (${t.commentCount} cmt): ${comment}`;
}

async function runScroll(_ctx: JobContext): Promise<string> {
  const tab = await openWorkTab("tiktok", HOME, true);
  const tabId = requireTabId(tab);
  await sleep(2500);

  const res = await sendToTab<SimpleResult>(tabId, {
    type: "TT_SCROLL_FEED",
    rounds: SCROLL_ROUNDS,
    autoLike: true,
    likeDelay: LIKE_DELAY_SEC,
  });
  if (!res.ok) throw new Error(res.error || "Không lướt được TikTok.");
  return `Đã lướt ${res.scrolled ?? 0} video, thả tim ${res.likedCount ?? 0}.`;
}

async function runFollow({ profile }: JobContext): Promise<string> {
  const targets = profile.followTargets.filter((t) => t.trim().length > 0);
  if (targets.length === 0) {
    throw new Error('Kênh chưa có tài khoản nào trong ô "Tài khoản để follow".');
  }
  const done = new Set(profile.followedKeys.map((h) => h.toLowerCase()));
  const next = targets.find((t) => !done.has(handleOf(t)));
  if (!next) return "Đã follow hết các tài khoản trong danh sách.";

  const tab = await openWorkTab("tiktok", userUrl(next), true);
  const tabId = requireTabId(tab);
  await sleep(2500);

  const res = await sendToTab<SimpleResult>(tabId, { type: "TT_FOLLOW_USER" });
  if (!res.ok) throw new Error(res.error || "Follow thất bại.");

  const handle = handleOf(next);
  await updateState((draft) => {
    const p = draft.profiles.find((x) => x.id === profile.id);
    if (p) p.followedKeys = [handle, ...p.followedKeys.filter((k) => k !== handle)];
  });

  return res.skipped ? `@${handle} đã theo dõi từ trước.` : `Đã follow @${handle}.`;
}

export const tiktokAdapter: PlatformAdapter = {
  id: "tiktok",
  homeUrl: HOME,
  jobs: {
    comment: runComment,
    scroll: runScroll,
    follow: runFollow,
  },
};
