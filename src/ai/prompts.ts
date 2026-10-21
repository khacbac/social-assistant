import type { CommentLanguage } from "@/core/types";

/** Dữ liệu ngữ cảnh 1 video để dựng user message cho AI. */
export interface VideoContext {
  author?: string;
  caption?: string;
}

/**
 * Gắn chỉ thị ngôn ngữ vào CUỐI system prompt để đè lên persona người dùng gõ
 * (vd persona tiếng Việt nhưng kênh đặt English). Chỉ thị cuối thường thắng.
 */
export function withLanguageDirective(systemPrompt: string, language: CommentLanguage): string {
  const directive =
    language === "en"
      ? "\n\nIMPORTANT: Write the comment in ENGLISH only, even if the video, caption, or anything above is in another language."
      : "\n\nQUAN TRỌNG: Luôn viết bình luận bằng TIẾNG VIỆT, kể cả khi video hay caption bằng ngôn ngữ khác.";
  return systemPrompt.trim() + directive;
}

/** Dựng user message cho job bình luận TikTok. */
export function buildTiktokCommentMessage(
  ctx: VideoContext,
  maxChars: number,
  language: CommentLanguage,
): string {
  const postText = [
    ctx.author ? `@${ctx.author}` : "TikTok video",
    ctx.caption?.trim(),
  ]
    .filter(Boolean)
    .join(": ");

  if (language === "en") {
    return [
      "TikTok video:",
      postText,
      "",
      "Write one short, natural comment as if you were casually scrolling. React to a specific detail.",
      `Write the comment in ENGLISH. Return only the comment — no explanation, no markdown, no quotes. Max ${maxChars} characters.`,
    ].join("\n");
  }

  return [
    "Video TikTok:",
    postText,
    "",
    "Hãy viết một bình luận ngắn, tự nhiên như đang lướt điện thoại. Nhắc 1 chi tiết cụ thể.",
    `Viết bình luận bằng TIẾNG VIỆT. Chỉ trả về đúng 1 bình luận. Không giải thích, không markdown, không bọc ngoặc kép. Tối đa ${maxChars} ký tự.`,
  ].join("\n");
}
