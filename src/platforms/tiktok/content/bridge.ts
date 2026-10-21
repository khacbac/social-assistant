import { BRIDGE_ISO, BRIDGE_PAGE, type PageRequest, type PageTypeResponse } from "../messages";

/** Gửi yêu cầu tới page typer (MAIN world) và chờ phản hồi. */
export function askPage(payload: PageRequest, timeout = 30_000): Promise<PageTypeResponse> {
  return new Promise((resolve, reject) => {
    const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const timer = setTimeout(() => {
      window.removeEventListener("message", onMsg);
      reject(new Error("Page typer không phản hồi (hết thời gian)."));
    }, timeout);

    function onMsg(event: MessageEvent) {
      if (event.source !== window) return;
      const data = event.data;
      if (!data || data.source !== BRIDGE_PAGE || data.requestId !== requestId) return;
      clearTimeout(timer);
      window.removeEventListener("message", onMsg);
      resolve(data as PageTypeResponse);
    }

    window.addEventListener("message", onMsg);
    window.postMessage({ source: BRIDGE_ISO, requestId, ...payload }, "*");
  });
}

/** Kiểm tra page typer đã sẵn sàng chưa. */
export async function pingPageTyper(): Promise<boolean> {
  try {
    const res = await askPage({ type: "PING" }, 1500);
    return Boolean(res?.ok);
  } catch {
    return false;
  }
}
