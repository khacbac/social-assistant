import type { AiSettings, ChannelProfile, JobKind, PlatformId } from "./types";

/** Lệnh UI gửi xuống service worker. UI đọc state trực tiếp từ storage. */
export type Command =
  | { type: "RUN_ONCE"; platform: PlatformId; kind: JobKind }
  | { type: "START_JOB"; platform: PlatformId; kind: JobKind }
  | { type: "STOP_JOB"; platform: PlatformId; kind: JobKind }
  | { type: "SAVE_PROFILE"; profile: ChannelProfile }
  | { type: "DELETE_PROFILE"; id: string }
  | { type: "SET_ACTIVE_PROFILE"; id: string }
  | { type: "SAVE_AI"; ai: AiSettings }
  | { type: "CLEAR_LOGS" };

export interface CommandResult {
  ok: boolean;
  error?: string;
}

/** Gửi lệnh từ UI và chờ kết quả. */
export function sendCommand(cmd: Command): Promise<CommandResult> {
  return chrome.runtime.sendMessage(cmd);
}
