import { randInt } from "@/core/humanize";
import { TT } from "../selectors";
import { q, qa, textOf, visible, clickEl, clickAt, waitFor, sleep, videoIdFrom } from "./dom";

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

export async function followUser(): Promise<{ ok: true; skipped?: boolean }> {
  await sleep(1000);
  const btns = qa(TT.followButton).concat([...document.querySelectorAll("button")]);
  const followBtn = btns.find(
    (el) =>
      visible(el) &&
      /follow|theo dõi/i.test(textOf(el)) &&
      !/following|đang follow|bạn bè/i.test(textOf(el)),
  );
  if (!followBtn) {
    const already = [...document.querySelectorAll("button")].find((el) =>
      /following|đang follow/i.test(textOf(el)),
    );
    if (already) return { ok: true, skipped: true };
    throw new Error("Không tìm thấy nút Follow trên trang TikTok này.");
  }
  clickEl(followBtn);
  await sleep(1200);
  return { ok: true };
}
