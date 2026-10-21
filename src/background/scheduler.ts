import { getState, updateState } from "@/core/storage";
import { nextDelayMs } from "@/core/humanize";
import { DEFAULT_SCHEDULE, type JobKind, type PlatformId, type ScheduleConfig } from "@/core/types";
import { runJob } from "./job-runner";

const SEP = "::";

export function alarmName(platform: PlatformId, kind: JobKind): string {
  return `${platform}${SEP}${kind}`;
}

function parseAlarm(name: string): { platform: PlatformId; kind: JobKind } | null {
  const [platform, kind] = name.split(SEP);
  if (!platform || !kind) return null;
  return { platform: platform as PlatformId, kind: kind as JobKind };
}

/** Hẹn lần chạy kế tiếp với giãn cách ngẫu nhiên. */
async function scheduleNext(
  platform: PlatformId,
  kind: JobKind,
  schedule: ScheduleConfig,
): Promise<void> {
  const when = Date.now() + nextDelayMs(schedule.minMinutes, schedule.maxMinutes);
  await chrome.alarms.create(alarmName(platform, kind), { when });
  await updateState((draft) => {
    draft.runtime[platform][kind] = { enabled: true, nextAt: when };
  });
}

/** Bật lịch cho 1 job. */
export async function startJob(
  platform: PlatformId,
  kind: JobKind,
  schedule: ScheduleConfig,
): Promise<void> {
  await scheduleNext(platform, kind, schedule);
}

/** Tắt lịch cho 1 job. */
export async function stopJob(platform: PlatformId, kind: JobKind): Promise<void> {
  await chrome.alarms.clear(alarmName(platform, kind));
  await updateState((draft) => {
    draft.runtime[platform][kind] = { enabled: false, nextAt: null };
  });
}

/** Xử lý khi alarm nổ: chạy job rồi hẹn lượt tiếp theo nếu còn bật. */
export async function handleAlarm(name: string): Promise<void> {
  const parsed = parseAlarm(name);
  if (!parsed) return;
  const { platform, kind } = parsed;

  // TODO (Milestone 4+): tôn trọng chu kỳ làm/nghỉ (workHours/restHours).
  await runJob(platform, kind);

  const state = await getState();
  if (!state.runtime[platform][kind].enabled) return;
  const profile = state.profiles.find(
    (p) => p.id === state.activeProfileId && p.platform === platform,
  );
  await scheduleNext(platform, kind, profile?.schedule ?? DEFAULT_SCHEDULE);
}
