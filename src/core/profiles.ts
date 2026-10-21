import { DEFAULT_SCHEDULE, type ChannelProfile } from "./types";

/** Prompt mặc định cho kênh TikTok tiếng Việt. */
export const DEFAULT_TIKTOK_PROMPT = `Bạn là người Việt đang lướt TikTok trên điện thoại. Bạn KHÔNG phải AI, KHÔNG phải bot.

## Nguyên tắc bình luận
- Ngắn, tự nhiên: 1 câu, tối đa 2 câu
- Bám 1 chi tiết cụ thể trong video/caption, đừng khen chung chung
- Viết tắt nhẹ được: ko, đc, xịn, đỉnh
- Emoji 0–1 cái, không đặt đầu câu
- KHÔNG mở đầu bằng "Video hay quá", "Chào bạn"
- KHÔNG markdown, KHÔNG hashtag, KHÔNG bọc ngoặc kép
- Chỉ trả về đúng 1 bình luận.`;

/** Prompt mặc định cho kênh TikTok tiếng Anh. */
export const DEFAULT_TIKTOK_PROMPT_EN = `You are a real person scrolling TikTok on your phone. You are NOT an AI or a bot.

## Commenting rules
- Short and natural: 1 sentence, 2 at most
- React to ONE specific detail in the video/caption, no generic praise
- Casual, native-sounding English; light contractions are fine (gonna, tbh, ngl)
- 0–1 emoji, never at the start
- Do NOT open with "Great video", "Hi there", or similar
- No markdown, no hashtags, no surrounding quotes
- Return exactly one comment.`;

/** Kênh mẫu: IELTS. Seed khi cài lần đầu. */
export function createIeltsProfile(): ChannelProfile {
  return {
    id: "ielts",
    name: "IELTS",
    platform: "tiktok",
    commentLanguage: "en",
    topic:
      "Anything related to the English language or learning English — IELTS, " +
      "vocabulary, grammar, pronunciation, speaking, listening, reading, writing, " +
      "study tips, or English used in any context. Be generous: if it touches " +
      "English or learning English in any way, it is relevant.",
    keywords: [
      "ielts",
      "english",
      "tiếng anh",
      "speaking",
      "writing",
      "listening",
      "reading",
      "band",
      "vocabulary",
      "từ vựng",
      "ngữ pháp",
      "grammar",
      "phát âm",
      "pronunciation",
      "task 1",
      "task 2",
      "academic",
    ],
    relevanceMode: "soft",
    minRelevanceScore: 1,
    systemPrompt:
      DEFAULT_TIKTOK_PROMPT_EN +
      "\n\nContext: your channel is about IELTS / learning English. " +
      "Comment as an encouraging English learner or teacher; keep it supportive and specific.",
    sources: [],
    schedule: { ...DEFAULT_SCHEDULE },
    commentedKeys: [],
    followedKeys: [],
  };
}

export function createBlankProfile(id: string, name: string): ChannelProfile {
  return {
    id,
    name,
    platform: "tiktok",
    commentLanguage: "vi",
    topic: "",
    keywords: [],
    relevanceMode: "soft",
    minRelevanceScore: 1,
    systemPrompt: DEFAULT_TIKTOK_PROMPT,
    sources: [],
    schedule: { ...DEFAULT_SCHEDULE },
    commentedKeys: [],
    followedKeys: [],
  };
}
