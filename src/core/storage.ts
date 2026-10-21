import {
  DEFAULT_AI_SETTINGS,
  JOB_KINDS,
  PLATFORMS,
  type AppState,
  type ChannelProfile,
  type PlatformId,
  type PlatformRuntime,
} from "./types";
import { createIeltsProfile } from "./profiles";

const STORAGE_KEY = "social-assistant:state";
const MAX_LOGS = 300;
const MAX_HISTORY = 400;

function emptyPlatformRuntime(): PlatformRuntime {
  return JOB_KINDS.reduce((acc, kind) => {
    acc[kind] = { enabled: false, nextAt: null };
    return acc;
  }, {} as PlatformRuntime);
}

function perPlatform<T>(make: () => T): Record<PlatformId, T> {
  return PLATFORMS.reduce((acc, p) => {
    acc[p] = make();
    return acc;
  }, {} as Record<PlatformId, T>);
}

export function defaultState(): AppState {
  const ielts = createIeltsProfile();
  return {
    profiles: [ielts],
    activeProfileId: { ...perPlatform<string | null>(() => null), tiktok: ielts.id },
    ai: { ...DEFAULT_AI_SETTINGS },
    runtime: perPlatform(emptyPlatformRuntime),
    workTabId: perPlatform<number | null>(() => null),
    logs: [],
  };
}

/** Đảm bảo profile cũ đọc từ storage không thiếu mảng mới thêm. */
function normalizeProfile(p: ChannelProfile): ChannelProfile {
  return {
    ...p,
    commentLanguage: p.commentLanguage ?? "vi",
    topic: p.topic ?? "",
    keywords: p.keywords ?? [],
    sources: p.sources ?? [],
    commentedKeys: p.commentedKeys ?? [],
    followedKeys: p.followedKeys ?? [],
  };
}

/** Đảm bảo đủ platform + job kind (state cũ có thể thiếu). */
function normalizeRuntime(
  raw: Partial<Record<PlatformId, Partial<PlatformRuntime>>> | undefined,
): Record<PlatformId, PlatformRuntime> {
  return PLATFORMS.reduce((acc, p) => {
    const rt = raw?.[p] ?? {};
    acc[p] = JOB_KINDS.reduce((r, k) => {
      r[k] = rt[k] ?? { enabled: false, nextAt: null };
      return r;
    }, {} as PlatformRuntime);
    return acc;
  }, {} as Record<PlatformId, PlatformRuntime>);
}

/** Di chuyển activeProfileId cũ (string) sang dạng theo platform. */
function normalizeActive(raw: unknown): Record<PlatformId, string | null> {
  const base = perPlatform<string | null>(() => null);
  if (typeof raw === "string") return { ...base, tiktok: raw };
  if (raw && typeof raw === "object") {
    for (const p of PLATFORMS) {
      const v = (raw as Record<string, unknown>)[p];
      base[p] = typeof v === "string" ? v : null;
    }
  }
  return base;
}

/** Trộn state đọc từ storage với default để không vỡ khi nâng cấp schema. */
function hydrate(raw: Partial<AppState> | undefined): AppState {
  const base = defaultState();
  if (!raw) return base;
  return {
    ...base,
    ...raw,
    activeProfileId: normalizeActive(raw.activeProfileId),
    ai: { ...base.ai, ...raw.ai },
    profiles: (raw.profiles?.length ? raw.profiles : base.profiles).map(normalizeProfile),
    runtime: normalizeRuntime(raw.runtime),
    workTabId: { ...base.workTabId, ...raw.workTabId },
    logs: (raw.logs ?? []).slice(0, MAX_LOGS),
  };
}

export async function getState(): Promise<AppState> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return hydrate(stored[STORAGE_KEY] as Partial<AppState> | undefined);
}

export async function setState(state: AppState): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}

/** Cập nhật state theo kiểu đọc-sửa-ghi, trả về state mới. */
export async function updateState(
  mutate: (draft: AppState) => void,
): Promise<AppState> {
  const state = await getState();
  mutate(state);
  state.logs = state.logs.slice(0, MAX_LOGS);
  for (const profile of state.profiles) {
    profile.commentedKeys = profile.commentedKeys.slice(0, MAX_HISTORY);
    profile.followedKeys = (profile.followedKeys ?? []).slice(0, MAX_HISTORY);
  }
  await setState(state);
  return state;
}

/** Lắng nghe thay đổi state (cho UI cập nhật realtime). */
export function onStateChange(cb: (state: AppState) => void): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ) => {
    if (area !== "local" || !changes[STORAGE_KEY]) return;
    cb(hydrate(changes[STORAGE_KEY].newValue as Partial<AppState> | undefined));
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
