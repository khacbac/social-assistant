import { TT } from "../selectors";
import type { FindTargetResult, TiktokPageState } from "../messages";
import {
  q,
  qa,
  textOf,
  visible,
  parseCount,
  videoIdFrom,
  currentVideoCard,
  sleep,
} from "./dom";
import { goToNextVideo } from "./feed";

interface Candidate {
  postKey: string;
  author: string;
  caption: string;
  hashtags: string[];
  commentCount: number;
}

/** Trích hashtag từ thẻ video (link /tag/) + từ caption (#...). */
function extractHashtags(card: Element | null, caption: string): string[] {
  const set = new Set<string>();
  const root = card ?? document;
  for (const a of qa(['a[href*="/tag/"]'], root)) {
    const t = textOf(a).replace(/^#/, "").trim();
    if (t) set.add(t.toLowerCase());
  }
  for (const m of caption.matchAll(/#([\p{L}\p{N}_]+)/gu)) {
    if (m[1]) set.add(m[1].toLowerCase());
  }
  return [...set];
}

export function pageState(): TiktokPageState {
  const href = location.href.toLowerCase();
  if (href.includes("/login") || href.includes("/signup")) return "login_required";
  const login = document.querySelector('form input[type="password"], a[href*="/login"]');
  const content = q(TT.videoItem) || document.querySelector('[data-e2e="user-page"], video');
  if (login && !content) return "login_required";
  return "ok";
}

export function stateError(state: TiktokPageState): string {
  if (state === "login_required") return "Tài khoản TikTok chưa đăng nhập trên trình duyệt.";
  return "Trang TikTok đang không khả dụng.";
}

export function currentCommentCount(): number {
  const card = currentVideoCard();
  const scoped = card ? q(TT.commentCount, card) : null;
  if (scoped && visible(scoped)) return parseCount(textOf(scoped));
  const global = q(TT.commentCount);
  if (global && visible(global)) return parseCount(textOf(global));
  const icon = q(TT.commentIcon, card ?? document);
  const labeled = icon?.closest("button, [role='button'], a") ?? icon?.parentElement ?? null;
  if (labeled) {
    const m = textOf(labeled).match(/[\d.,]+\s*(k|m|b|n|tr)?/i);
    if (m) return parseCount(m[0]);
  }
  return 0;
}

/** Thông tin video đang xem. */
export function extractCurrent(): Candidate | null {
  const card = currentVideoCard();
  const link = card ? (q(['a[href*="/video/"]'], card) as HTMLAnchorElement | null) : null;
  const videoId = videoIdFrom(link?.href || location.href) || videoIdFrom();
  const author = textOf(q(TT.author, card ?? document)).replace(/^@/, "");
  const caption = textOf(q(TT.caption, card ?? document));
  const postKey =
    videoId || `${location.pathname}-${(caption || document.title).slice(0, 40)}`.toLowerCase();
  if (!author && !caption) return null;
  const hashtags = extractHashtags(card, caption);
  return { postKey, author, caption, hashtags, commentCount: currentCommentCount() };
}

/**
 * Lướt feed tìm video đủ số bình luận và có nội dung để Haiku xét.
 * KHÔNG lọc từ khoá ở đây nữa — việc xét liên quan do Haiku làm ở background,
 * để không bỏ sót video chỉ vì caption thiếu đúng từ khoá.
 */
export async function findCommentTarget(opts: {
  skipKeys: string[];
  minComments: number;
  maxScrolls: number;
}): Promise<FindTargetResult> {
  const skip = new Set(opts.skipKeys.map((k) => k.toLowerCase()));
  let lowComment = 0;

  await sleep(600);

  for (let i = 0; i < opts.maxScrolls; i += 1) {
    const cand = extractCurrent();
    if (!cand) {
      await goToNextVideo();
      continue;
    }
    const key = cand.postKey.toLowerCase();

    if (skip.has(key)) {
      await goToNextVideo();
      continue;
    }

    let count = cand.commentCount;
    if (count === 0) {
      await sleep(600);
      count = currentCommentCount();
    }

    if (count < opts.minComments) {
      lowComment += 1;
      await goToNextVideo();
      continue;
    }

    // Cần có chút nội dung (caption/hashtag) để Haiku xét được.
    if (!cand.caption && cand.hashtags.length === 0) {
      await goToNextVideo();
      continue;
    }

    return { ok: true, target: { ...cand, commentCount: count } };
  }

  return {
    ok: false,
    error: `Đã lướt ${opts.maxScrolls} video nhưng không có video nào đủ ${opts.minComments} bình luận.`,
    scanned: opts.maxScrolls,
    lowComment,
  };
}
