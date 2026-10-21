import { updateState } from "./storage";
import type { LogEntry } from "./types";

/** Ghi 1 dòng log vào state (hiển thị realtime ở tab Nhật ký) + console. */
export async function log(
  level: LogEntry["level"],
  message: string,
): Promise<void> {
  const entry: LogEntry = { at: Date.now(), level, message };
  // eslint-disable-next-line no-console
  console[level === "error" ? "error" : "log"](`[SA:${level}] ${message}`);
  await updateState((draft) => {
    draft.logs.unshift(entry);
  });
}
