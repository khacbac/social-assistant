import { sleep } from "@/core/humanize";
import { log } from "@/core/log";
import { updateState } from "@/core/storage";
import { generate } from "@/ai/anthropic";
import { buildYoutubeJudgeMessage, isSkip, withLanguageDirective } from "@/ai/prompts";
import { openWorkTab, sendToTab } from "@/background/messaging";
import type { PlatformAdapter, JobContext } from "@/platforms/types";
import type { ChannelProfile } from "@/core/types";
import type {
  YtFindResponse,
  YtPingResponse,
  YtSimpleResponse,
  YtVideo,
  YtWatchContext,
} from "./messages";

const HOME = "https://www.youtube.com/";
const MAX_CANDIDATES = 8;
const MAX_AI_JUDGE = 4;

function channelTopic(name: string, keywords: string[]): string {
  const kw = keywords.slice(0, 10).join(", ");
  return kw ? `${name} (keywords: ${kw})` : name;
}

/** Câu tìm kiếm: ưu tiên ô Nguồn (mỗi dòng 1 query), fallback từ khoá. */
function pickQuery(profile: ChannelProfile): string {
  const pool = profile.sources.length > 0 ? profile.sources : profile.keywords;
  if (pool.length === 0) throw new Error('Kênh YouTube chưa có từ khoá/câu tìm kiếm (ô "Nguồn").');
  return pool[Math.floor(Math.random() * pool.length)]!;
}

function searchUrl(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

function requireTabId(tab: chrome.tabs.Tab): number {
  if (tab.id == null) throw new Error("Không mở được tab YouTube.");
  return tab.id;
}

/** Mở tab search, trả về danh sách video ứng viên (chưa xử lý). */
async function searchVideos(profile: ChannelProfile, skipKeys: string[]): Promise<YtVideo[]> {
  const query = pickQuery(profile);
  await log("info", `Tìm YouTube: "${query}"…`);
  const tab = await openWorkTab("youtube", searchUrl(query), true);
  const tabId = requireTabId(tab);
  await sleep(2500);

  const ping = await sendToTab<YtPingResponse>(tabId, { type: "PING" });
  if (ping.state !== "ok") throw new Error("YouTube chưa sẵn sàng (đã đăng nhập chưa?).");

  const res = await sendToTab<YtFindResponse>(tabId, {
    type: "YT_FIND_VIDEOS",
    skipKeys,
    max: MAX_CANDIDATES,
  });
  return res.videos;
}

async function runComment({ profile, ai }: JobContext): Promise<string> {
  const topic = profile.topic.trim() || channelTopic(profile.name, profile.keywords);
  const sys = withLanguageDirective(profile.systemPrompt, profile.commentLanguage);

  const candidates = await searchVideos(profile, profile.commentedKeys);
  if (candidates.length === 0) return "Không tìm thấy video mới trong kết quả tìm kiếm.";

  let judged = 0;
  for (const video of candidates) {
    if (judged >= MAX_AI_JUDGE) break;
    judged += 1;

    const tab = await openWorkTab("youtube", video.url, true);
    const tabId = requireTabId(tab);
    await sleep(2500);

    const ctx = await sendToTab<YtWatchContext | { ok: false; error?: string }>(tabId, {
      type: "YT_WATCH_CONTEXT",
    });
    if (!ctx.ok) continue;

    await log("info", `Haiku đang xét: "${ctx.title.slice(0, 60)}"…`);
    const out = await generate(
      ai,
      sys,
      buildYoutubeJudgeMessage(
        { title: ctx.title, description: ctx.description, channel: ctx.channel },
        ai.maxChars,
        profile.commentLanguage,
        topic,
      ),
    );
    if (isSkip(out)) {
      await log("info", `Haiku thấy video lệch chủ đề → bỏ qua.`);
      continue;
    }

    await log("info", `AI: "${out}". Đang bình luận…`);
    const posted = await sendToTab<YtSimpleResponse>(tabId, { type: "YT_CREATE_COMMENT", text: out });
    if (!posted.ok) throw new Error(posted.error || "Không gửi được bình luận YouTube.");

    await updateState((draft) => {
      const p = draft.profiles.find((x) => x.id === profile.id);
      if (p) p.commentedKeys = [video.videoId, ...p.commentedKeys.filter((k) => k !== video.videoId)];
    });
    return `Đã bình luận video "${ctx.title.slice(0, 60)}": ${out}`;
  }

  return `Đã xét ${judged} video nhưng đều lệch chủ đề. Thử lại lượt sau.`;
}

async function runLike({ profile }: JobContext): Promise<string> {
  const candidates = await searchVideos(profile, []);
  const video = candidates[0];
  if (!video) return "Không tìm thấy video để like.";

  const tab = await openWorkTab("youtube", video.url, true);
  const tabId = requireTabId(tab);
  await sleep(2500);

  const res = await sendToTab<YtSimpleResponse>(tabId, { type: "YT_LIKE" });
  if (!res.ok) throw new Error(res.error || "Like thất bại.");
  return res.skipped ? "Video đã like từ trước." : `Đã like: "${video.title.slice(0, 60)}".`;
}

async function runSubscribe({ profile }: JobContext): Promise<string> {
  const candidates = await searchVideos(profile, []);
  const done = new Set(profile.followedKeys.map((k) => k.toLowerCase()));

  for (const video of candidates) {
    const tab = await openWorkTab("youtube", video.url, true);
    const tabId = requireTabId(tab);
    await sleep(2500);

    const res = await sendToTab<YtSimpleResponse>(tabId, { type: "YT_SUBSCRIBE" });
    if (!res.ok) throw new Error(res.error || "Subscribe thất bại.");

    const channel = (res.channel || video.title).trim();
    if (res.skipped && done.has(channel.toLowerCase())) continue; // đã sub rồi, thử kênh khác

    await updateState((draft) => {
      const p = draft.profiles.find((x) => x.id === profile.id);
      if (p && !p.followedKeys.includes(channel)) p.followedKeys = [channel, ...p.followedKeys];
    });
    return res.skipped ? `Kênh "${channel}" đã đăng ký trước đó.` : `Đã subscribe "${channel}".`;
  }
  return "Không tìm thấy kênh mới để subscribe.";
}

export const youtubeAdapter: PlatformAdapter = {
  id: "youtube",
  homeUrl: HOME,
  jobs: {
    comment: runComment,
    like: runLike,
    subscribe: runSubscribe,
  },
};
