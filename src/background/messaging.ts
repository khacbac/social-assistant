import { updateState, getState } from "@/core/storage";
import { sleep } from "@/core/humanize";
import type { PlatformId } from "@/core/types";

/** Mở (hoặc tái sử dụng) tab làm việc cho 1 nền tảng. */
export async function openWorkTab(
  platform: PlatformId,
  url: string,
  active = true,
): Promise<chrome.tabs.Tab> {
  const state = await getState();
  const existingId = state.workTabId[platform];
  if (existingId != null) {
    try {
      const tab = await chrome.tabs.get(existingId);
      if (tab?.id) {
        await chrome.tabs.update(tab.id, { url, active });
        await waitTabComplete(tab.id);
        return await chrome.tabs.get(tab.id);
      }
    } catch {
      // tab đã bị đóng -> mở mới
    }
  }
  const tab = await chrome.tabs.create({ url, active });
  await updateState((draft) => {
    draft.workTabId[platform] = tab.id ?? null;
  });
  if (tab.id) await waitTabComplete(tab.id);
  return tab;
}

/** Đưa tab lên trước (cần cho đường gõ CDP yêu cầu tab hiển thị). */
export async function focusTab(tabId: number): Promise<void> {
  const tab = await chrome.tabs.get(tabId);
  await chrome.tabs.update(tabId, { active: true });
  if (tab.windowId != null) {
    await chrome.windows.update(tab.windowId, { focused: true });
  }
}

/** Gửi message tới content script của 1 tab. */
export function sendToTab<T = unknown>(tabId: number, message: unknown): Promise<T> {
  return chrome.tabs.sendMessage(tabId, message) as Promise<T>;
}

/** Chờ tab load xong (status complete) hoặc hết thời gian. */
async function waitTabComplete(tabId: number, timeoutMs = 15_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab.status === "complete") {
        await sleep(400);
        return;
      }
    } catch {
      return;
    }
    await sleep(250);
  }
}
