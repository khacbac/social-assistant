import { getState } from "@/core/storage";
import { log } from "@/core/log";
import { getAdapter } from "@/platforms/registry";
import type { JobKind, PlatformId } from "@/core/types";

const JOB_LABELS: Record<JobKind, string> = {
  comment: "bình luận",
  scroll: "lướt video",
  follow: "follow",
  like: "like",
  subscribe: "subscribe",
};

/** Khoá chống chạy chồng nhiều job cùng lúc (1 tab làm việc). */
let running = false;

export async function runJob(platform: PlatformId, kind: JobKind): Promise<void> {
  if (running) {
    await log("warn", "Đang có job khác chạy, bỏ qua lượt này.");
    return;
  }
  running = true;
  try {
    const state = await getState();
    const profile = state.profiles.find(
      (p) => p.id === state.activeProfileId[platform] && p.platform === platform,
    );
    if (!profile) {
      await log("error", `Chưa chọn kênh đang hoạt động cho ${platform}.`);
      return;
    }
    const runner = getAdapter(platform).jobs[kind];
    if (!runner) {
      await log("error", `${platform} không hỗ trợ job ${kind}.`);
      return;
    }
    await log(
      "info",
      `Bắt đầu ${JOB_LABELS[kind]} ${platform} (kênh "${profile.name}")...`,
    );
    const result = await runner({ profile, ai: state.ai });
    await log("success", result || `${JOB_LABELS[kind]} xong.`);
  } catch (err) {
    await log(
      "error",
      `${JOB_LABELS[kind]} ${platform} lỗi: ${(err as Error).message}`,
    );
  } finally {
    running = false;
  }
}
