import type { CommentLanguage } from "@/core/types";

/** Dữ liệu ngữ cảnh 1 video để dựng user message cho AI. */
export interface VideoContext {
  author?: string;
  caption?: string;
  hashtags?: string[];
}

/** Từ khoá AI trả về khi thấy video lệch chủ đề. */
export const SKIP_SENTINEL = "SKIP";

/** Câu trả lời của AI có phải "bỏ qua" không. */
export function isSkip(text: string): boolean {
  return /^skip\b/i.test(text.trim());
}

/**
 * Dựng user message vừa XÉT liên quan vừa sinh comment trong 1 call:
 * AI tự quyết video có hợp chủ đề kênh không; lệch thì trả về SKIP.
 */
export function buildTiktokJudgeMessage(
  ctx: VideoContext,
  maxChars: number,
  language: CommentLanguage,
  topic: string,
): string {
  const lines = [
    "TikTok video:",
    ctx.author ? `Author: @${ctx.author}` : "",
    ctx.caption?.trim() ? `Caption: ${ctx.caption.trim()}` : "",
    ctx.hashtags?.length ? `Hashtags: ${ctx.hashtags.map((h) => `#${h}`).join(" ")}` : "",
    "",
    `Channel topic: ${topic}`,
    "",
    "Decide if this video relates to the channel topic above.",
    "Be generous: if it touches the topic in any way, treat it as related. Only skip clearly unrelated videos.",
    `- If it is NOT related at all, reply with exactly: ${SKIP_SENTINEL}`,
    language === "en"
      ? `- If it IS related, write ONE short, natural comment in ENGLISH (max ${maxChars} chars). Return only the comment.`
      : `- If it IS related, write ONE short, natural comment in VIETNAMESE (max ${maxChars} chars). Return only the comment.`,
    "No markdown, no quotes, no explanation.",
  ];
  return lines.filter((l) => l !== "").join("\n");
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

/** Judge + comment cho YouTube (metadata giàu hơn: title + mô tả + kênh). */
export function buildYoutubeJudgeMessage(
  ctx: { title: string; description?: string; channel?: string },
  maxChars: number,
  language: CommentLanguage,
  topic: string,
): string {
  const lines = [
    "YouTube video:",
    `Title: ${ctx.title}`,
    ctx.channel ? `Channel: ${ctx.channel}` : "",
    ctx.description?.trim() ? `Description: ${ctx.description.trim()}` : "",
    "",
    `Channel topic: ${topic}`,
    "",
    "Decide if this video relates to the channel topic above.",
    "Be generous: if it touches the topic in any way, treat it as related. Only skip clearly unrelated videos.",
    `- If it is NOT related at all, reply with exactly: ${SKIP_SENTINEL}`,
    language === "en"
      ? `- If it IS related, write ONE short, natural comment in ENGLISH (max ${maxChars} chars). Return only the comment.`
      : `- If it IS related, write ONE short, natural comment in VIETNAMESE (max ${maxChars} chars). Return only the comment.`,
    "No markdown, no quotes, no explanation.",
  ];
  return lines.filter((l) => l !== "").join("\n");
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
