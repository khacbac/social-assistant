import { randInt } from "@/core/humanize";
import { isRelevant } from "@/ai/relevance";
import { TT } from "../selectors";
import type { AutoFollowResult } from "../messages";
import {
  q,
  qa,
  textOf,
  visible,
  clickEl,
  clickAt,
  waitFor,
  sleep,
  videoIdFrom,
  currentVideoCard,
} from "./dom";

export function closeCommentPanel(): void {
  const close = document.querySelector(
    '[data-e2e="comment-close"], [data-e2e="browse-close"], [aria-label*="Close" i], [aria-label*="Đóng" i]',
  );
  if (visible(close)) clickEl(close);
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, bubbles: true }),
  );
}

/** Chuyển sang video kế tiếp trên feed. Trả về true nếu video đã đổi. */
export async function goToNextVideo(): Promise<boolean> {
  const before = videoIdFrom() || location.href;
  closeCommentPanel();
  await sleep(250);

  const nextBtn = document.querySelector(
    '[data-e2e="arrow-right"], [data-e2e="feed-arrow-down"], button[aria-label*="next" i], button[aria-label*="xuống" i]',
  );
  const video = document.querySelector("video");
  if (video) {
    clickAt(video);
    await sleep(120);
  }
  if (visible(nextBtn)) clickAt(nextBtn);

  const down = { key: "ArrowDown", code: "ArrowDown", keyCode: 40, which: 40, bubbles: true, cancelable: true };
  (video || document.activeElement || document.body).dispatchEvent(new KeyboardEvent("keydown", down));
  window.dispatchEvent(new KeyboardEvent("keydown", down));
  document.dispatchEvent(new KeyboardEvent("keydown", down));
  window.scrollBy({ top: Math.round(window.innerHeight * 0.96), behavior: "smooth" });

  const changed = await waitFor(() => {
    const now = videoIdFrom() || location.href;
    return now && now !== before ? now : "";
  }, 3800);
  await sleep(900 + randInt(0, 500));
  return Boolean(changed);
}

export async function likeCurrentVideo(): Promise<boolean> {
  const likeBtn = q(TT.likeIcon);
  if (!(likeBtn instanceof HTMLElement)) return false;
  const pressed =
    likeBtn.getAttribute("aria-pressed") === "true" || likeBtn.className.includes("liked");
  if (pressed) return false;
  clickEl(likeBtn);
  return true;
}

export async function scrollFeed(opts: {
  rounds: number;
  autoLike: boolean;
  likeDelay: number;
}): Promise<{ scrolled: number; likedCount: number }> {
  let scrolled = 0;
  let likedCount = 0;
  for (let i = 0; i < opts.rounds; i += 1) {
    if (opts.autoLike) {
      await sleep(Math.max(2, opts.likeDelay) * 1000);
      if (await likeCurrentVideo()) likedCount += 1;
    } else {
      await sleep(1200);
    }
    await goToNextVideo();
    scrolled += 1;
  }
  return { scrolled, likedCount };
}

/** Nút follow "+" của riêng 1 thẻ video, chỉ trả về khi CHƯA follow. */
function cardFollowButton(card: Element | null): HTMLElement | null {
  const root = card ?? document;
  const cands = [...qa(TT.feedFollow, root), ...qa(TT.followButton, root)];
  const btn = cands.find((el) => {
    if (!visible(el)) return false;
    const label = `${textOf(el)} ${el.getAttribute("aria-label") || ""}`.toLowerCase();
    if (/following|đang follow|bạn bè|friends/.test(label)) return false;
    return true;
  });
  return (btn as HTMLElement | undefined) ?? null;
}

/**
 * Tự lướt For You, gặp creator đăng video HỢP CHỦ ĐỀ và CHƯA follow thì follow.
 * Mỗi lần gọi follow tối đa 1 người (giữ giãn cách tự nhiên).
 */
export async function autoFollow(opts: {
  skipKeys: string[];
  keywords: string[];
  minRelevanceScore: number;
  maxScrolls: number;
}): Promise<AutoFollowResult> {
  const skip = new Set(opts.skipKeys.map((k) => k.toLowerCase()));
  await sleep(600);

  for (let i = 0; i < opts.maxScrolls; i += 1) {
    const card = currentVideoCard();
    const author = textOf(q(TT.author, card ?? document)).replace(/^@/, "");
    const caption = textOf(q(TT.caption, card ?? document));
    const handle = author.toLowerCase();

    if (!handle || skip.has(handle)) {
      await goToNextVideo();
      continue;
    }
    if (!isRelevant(`${author} ${caption}`, opts.keywords, opts.minRelevanceScore)) {
      await goToNextVideo();
      continue;
    }

    const btn = cardFollowButton(card);
    if (!btn) {
      // Không có nút "+" khả dụng → có thể đã follow rồi → bỏ qua.
      skip.add(handle);
      await goToNextVideo();
      continue;
    }

    clickEl(btn);
    await sleep(1200);
    return { ok: true, handle };
  }

  return {
    ok: false,
    error: `Đã lướt ${opts.maxScrolls} video nhưng không gặp creator hợp chủ đề chưa follow.`,
  };
}
