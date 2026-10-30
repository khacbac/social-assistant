import type { CommentLanguage } from "@/core/types";

/** Dữ liệu ngữ cảnh 1 video để dựng user message cho AI. */
export interface VideoContext {
  author?: string;
  caption?: string;
  hashtags?: string[];
}

/** Từ khoá AI trả về khi thấy video lệch chủ đề. */
export const SKIP_SENTINEL = "SKIP";

/** Shared, permissive relevance policy for both platforms. */
const RELEVANCE_DIRECTIVE = [
  "Decide whether this video is suitable for engaging from a channel with the topic above. Use broad, practical judgment rather than strict keyword matching.",
  "Treat the topic and any keywords as guidance, not an exhaustive checklist. Accept direct or indirect connections, adjacent subjects, shared audiences, everyday applications, entertainment, and personal experiences that plausibly interest that audience.",
  "Consider all available context together, including the creator/channel, title, caption, description, and hashtags. One reasonable connection is enough; the video does not need to focus entirely on the topic, and the creator does not need to specialize in it.",
  "Do not reject solely because metadata is brief or missing, keywords are absent, the language differs, or the connection is uncertain. When in doubt, prefer engaging. If the topic is empty or too vague to apply, allow the video.",
  "Skip only when the available context clearly shows that the video is unrelated and offers no reasonable connection to the intended audience.",
  "For accepted videos, write a natural comment grounded in the available context. Do not invent unseen details or force a mention of the channel topic.",
].join("\n");

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
    RELEVANCE_DIRECTIVE,
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
    RELEVANCE_DIRECTIVE,
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
