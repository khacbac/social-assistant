import type { AiSettings, ChannelProfile, JobKind, PlatformId } from "@/core/types";

/** Ngữ cảnh truyền vào mỗi lần chạy job. */
export interface JobContext {
  profile: ChannelProfile;
  ai: AiSettings;
}

/** Một job trả về mô tả ngắn kết quả để ghi log. */
export type JobRunner = (ctx: JobContext) => Promise<string>;

/** Adapter cho 1 nền tảng: khai báo trang chủ + các job runner (chỉ phần của mình). */
export interface PlatformAdapter {
  id: PlatformId;
  /** URL mở tab làm việc mặc định. */
  homeUrl: string;
  jobs: Partial<Record<JobKind, JobRunner>>;
}
