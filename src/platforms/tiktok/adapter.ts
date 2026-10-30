import { sleep } from "@/core/humanize";
import { log } from "@/core/log";
import { updateState } from "@/core/storage";
import { generate } from "@/ai/anthropic";
import { buildTiktokFollowJudgeMessage, buildTiktokJudgeMessage, isSkip, withLanguageDirective } from "@/ai/prompts";
import { openWorkTab, sendToTab } from "@/background/messaging";
import type { PlatformAdapter, JobContext } from "@/platforms/types";
import type { AutoFollowResult, FindTargetResult, PingResponse } from "./messages";
import { postCommentTrusted } from "./cdp";
import { sourceUrl } from "./sources";

const HOME = "https://www.tiktok.com/foryou";
const MIN_COMMENTS = 6;
const MAX_SCROLLS = 20;
const SCROLL_ROUNDS = 8;
const LIKE_DELAY_SEC = 4;
/** Số video tối đa đưa Haiku xét liên quan trong 1 lượt comment. */
const MAX_AI_JUDGE = 4;
/** Số lần lướt mỗi lần đi tìm candidate (nhỏ hơn để vòng judge không lướt quá xa). */
const FIND_SCROLLS = 12;

/** Mô tả chủ đề kênh cho Haiku xét liên quan. */
function channelTopic(name: string, keywords: string[]): string {
  const kw = keywords.slice(0, 10).join(", ");
  return kw ? `${name} (keywords: ${kw})` : name;
}

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

  const topic = profile.topic.trim() || channelTopic(profile.name, profile.keywords);
  const sys = withLanguageDirective(profile.systemPrompt, profile.commentLanguage);
  // Bộ lọc thô (từ khoá) bắt rộng ở content; Haiku xét ngữ nghĩa cuối cùng.
  // Video Haiku thấy lệch chủ đề thì thêm vào skip và tìm video kế.
  const sessionSkip = [...profile.commentedKeys];
  let judged = 0;

  while (judged < MAX_AI_JUDGE) {
    await log("info", "Đang lướt tìm video hợp chủ đề…");
    const find = await sendToTab<FindTargetResult>(tabId, {
      type: "TT_FIND_COMMENT_TARGET",
      skipKeys: sessionSkip,
      minComments: MIN_COMMENTS,
      maxScrolls: FIND_SCROLLS,
    });

    if (!find.ok) {
      if (judged === 0) throw new Error(find.error);
      return "Hết video phù hợp trong lượt này.";
    }
    if ("skipped" in find) return `Bỏ qua: ${find.reason}`;

    const t = find.target;
    judged += 1;
    await log("info", `Haiku đang xét video @${t.author || "?"} (${t.commentCount} cmt)…`);

    const out = await generate(
      ai,
      sys,
      buildTiktokJudgeMessage(
        { author: t.author, caption: t.caption, hashtags: t.hashtags },
        ai.maxChars,
        profile.commentLanguage,
        topic,
      ),
    );

    if (isSkip(out)) {
      await log("info", `Haiku thấy @${t.author || "?"} lệch chủ đề → bỏ qua.`);
      sessionSkip.push(t.postKey);
      continue;
    }

    await log("info", `AI: "${out}". Đang gõ như người thật…`);
    await typeComment(tabId, out, t.postKey);

    await updateState((draft) => {
      const p = draft.profiles.find((x) => x.id === profile.id);
      if (p) p.commentedKeys = [t.postKey, ...p.commentedKeys.filter((k) => k !== t.postKey)];
    });

    return `Đã bình luận (${t.commentCount} cmt): ${out}`;
  }

  return `Đã xét ${judged} video nhưng Haiku đều thấy lệch chủ đề. Thử lại lượt sau.`;
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

async function runFollow({ profile, ai }: JobContext): Promise<string> {
  const tab = await openWorkTab("tiktok", HOME, true);
  const tabId = requireTabId(tab);
  await sleep(2500);

  const ping = await sendToTab<PingResponse>(tabId, { type: "PING" });
  if (ping.state !== "ok") throw new Error("TikTok chưa sẵn sàng (đã đăng nhập chưa?).");

  await log("info", "Đang lướt For You tìm creator hợp chủ đề chưa follow…");
  const skipKeys = [...profile.followedKeys];
  const topic = profile.topic.trim() || channelTopic(profile.name, profile.keywords);
  let scanned = 0;
  let judged = 0;
  while (scanned < MAX_SCROLLS && judged < MAX_AI_JUDGE) {
    const res = await sendToTab<AutoFollowResult>(tabId, {
      type: "TT_FIND_FOLLOW_TARGET",
      skipKeys,
      maxScrolls: MAX_SCROLLS - scanned,
    });
    if (!res.ok) return res.error;
    scanned += res.scanned;
    judged += 1;
    skipKeys.push(res.handle);
    await log("info", `AI đang xét follow @${res.handle} theo ngữ nghĩa…`);
    const decision = await generate(
      { ...ai, maxChars: 16 },
      "Evaluate creator relevance generously. Return only ALLOW or SKIP, following the decision policy provided.",
      buildTiktokFollowJudgeMessage({ author: res.handle, caption: res.caption }, topic),
    );
    if (decision.trim().toUpperCase() !== "ALLOW") {
      await log("info", `AI bỏ qua @${res.handle}: ${decision}`);
      continue;
    }
    const followed = await sendToTab<SimpleResult>(tabId, { type: "TT_FOLLOW_CURRENT", handle: res.handle });
    if (!followed.ok) throw new Error(followed.error || "Follow thất bại.");
    await updateState((draft) => {
      const p = draft.profiles.find((x) => x.id === profile.id);
      if (p) p.followedKeys = [res.handle, ...p.followedKeys.filter((k) => k !== res.handle)];
    });
    return `Đã follow @${res.handle}.`;
  }
  return `Đã xem ${scanned} video, AI xét ${judged} creator nhưng chưa chọn được người để follow. Thử lại lượt sau.`;
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
