/** Nền tảng được hỗ trợ. v1 chỉ TikTok; thêm nền tảng = thêm giá trị ở đây. */
export type PlatformId = "tiktok";

/** Các loại job một nền tảng có thể chạy. */
export type JobKind = "comment" | "scroll" | "follow";

/** Ngôn ngữ comment của 1 kênh. */
export type CommentLanguage = "vi" | "en";

export const COMMENT_LANGUAGE_LABELS: Record<CommentLanguage, string> = {
  vi: "Tiếng Việt",
  en: "English",
};

/** Cấu hình lịch chạy cho 1 job (giãn cách ngẫu nhiên + chu kỳ làm/nghỉ). */
export interface ScheduleConfig {
  /** Giãn cách tối thiểu giữa 2 lần chạy (phút). */
  minMinutes: number;
  /** Giãn cách tối đa (phút). */
  maxMinutes: number;
  /** Số giờ làm liên tục trước khi nghỉ. 0 = không nghỉ. */
  workHours: number;
  /** Số giờ nghỉ sau mỗi chu kỳ làm. */
  restHours: number;
}

export const DEFAULT_SCHEDULE: ScheduleConfig = {
  minMinutes: 15,
  maxMinutes: 45,
  workHours: 0,
  restHours: 0,
};

/**
 * Một "kênh" của người dùng: mỗi kênh một chủ đề, có bộ từ khoá lọc và
 * system prompt riêng. Giải bài toán nhiều kênh nhiều topic.
 */
export interface ChannelProfile {
  id: string;
  name: string;
  platform: PlatformId;
  /** Ngôn ngữ viết comment. */
  commentLanguage: CommentLanguage;
  /** Mô tả chủ đề kênh cho Haiku xét liên quan (rộng, tự nhiên). */
  topic: string;
  /** Từ khoá — dùng cho lọc thô job follow (comment để Haiku xét). */
  keywords: string[];
  /** v1 chỉ hỗ trợ "soft". */
  relevanceMode: "soft";
  /** Điểm liên quan tối thiểu để nhận video (số keyword khớp). */
  minRelevanceScore: number;
  /** System prompt sinh comment cho kênh này. */
  systemPrompt: string;
  /** Nguồn video để bình luận. [] = For You. Hoặc @user / #hashtag / URL. */
  sources: string[];
  schedule: ScheduleConfig;
  /** Khoá các video đã bình luận (dedupe), mới nhất đứng đầu. */
  commentedKeys: string[];
  /** Handle các tài khoản đã follow (dedupe job follow). */
  followedKeys: string[];
}

/** Cấu hình AI (Anthropic). */
export interface AiSettings {
  apiKey: string;
  model: string;
  maxChars: number;
}

export const DEFAULT_AI_SETTINGS: AiSettings = {
  apiKey: "",
  model: "claude-haiku-5-5",
  maxChars: 150,
};

/** Trạng thái bật/tắt + lần chạy kế tiếp của từng job trên từng nền tảng. */
export interface JobRuntime {
  enabled: boolean;
  nextAt: number | null;
}

export type PlatformRuntime = Record<JobKind, JobRuntime>;

export interface LogEntry {
  at: number;
  level: "info" | "success" | "warn" | "error";
  message: string;
}

/** Toàn bộ state được lưu trong chrome.storage.local. */
export interface AppState {
  profiles: ChannelProfile[];
  activeProfileId: string | null;
  ai: AiSettings;
  runtime: Record<PlatformId, PlatformRuntime>;
  workTabId: Record<PlatformId, number | null>;
  logs: LogEntry[];
}
