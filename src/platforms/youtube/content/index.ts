/**
 * Content script YouTube (isolated world). Nhận lệnh từ background để:
 * đọc kết quả tìm kiếm, đọc metadata trang watch, bình luận, like, subscribe.
 */
import { sleep } from "@/core/humanize";
import { YT, sel } from "../selectors";
import type { YtRequest, YtVideo, YtPageState } from "../messages";

declare global {
  interface Window {
    __SA_YT_CONTENT__?: boolean;
  }
}

if (!window.__SA_YT_CONTENT__) {
  window.__SA_YT_CONTENT__ = true;

  let actionLock = false;

  chrome.runtime.onMessage.addListener((message: YtRequest, _sender, sendResponse) => {
    handle(message)
      .then(sendResponse)
      .catch((err: Error) => sendResponse({ ok: false, error: err.message || String(err) }));
    return true;
  });

  async function handle(message: YtRequest): Promise<unknown> {
    const state = pageState();
    if (message.type === "PING") {
      return { ok: true, platform: "youtube", href: location.href, state };
    }
    if (state !== "ok") throw new Error(stateError(state));

    switch (message.type) {
      case "YT_FIND_VIDEOS":
        return { ok: true, videos: findVideos(message.skipKeys, message.max) };
      case "YT_WATCH_CONTEXT":
        return watchContext();
      default:
        return runLocked(message);
    }
  }

  async function runLocked(message: YtRequest): Promise<unknown> {
    if (actionLock) return { ok: false, error: "Đang có thao tác YouTube khác." };
    actionLock = true;
    try {
      switch (message.type) {
        case "YT_CREATE_COMMENT":
          return await createComment(message.text);
        case "YT_LIKE":
          return await likeVideo();
        case "YT_SUBSCRIBE":
          return await subscribeChannel();
        default:
          return { ok: false, error: `YouTube không xử lý lệnh ${(message as { type: string }).type}.` };
      }
    } finally {
      actionLock = false;
    }
  }

  // ---- helpers ----
  function q(list: readonly string[], root: ParentNode = document): Element | null {
    return root.querySelector(sel(list));
  }
  function qa(list: readonly string[], root: ParentNode = document): Element[] {
    return [...root.querySelectorAll(sel(list))];
  }
  function textOf(el: Element | null): string {
    if (!el) return "";
    return String((el as HTMLElement).innerText || el.textContent || "").replace(/\s+/g, " ").trim();
  }
  function clickEl(el: Element | null): boolean {
    if (!(el instanceof HTMLElement)) return false;
    el.scrollIntoView({ block: "center" });
    el.click();
    return true;
  }
  async function waitFor<T>(fn: () => T, timeout = 6000): Promise<T> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const v = fn();
      if (v) return v;
      await sleep(200);
    }
    return fn();
  }
  function videoIdFrom(url: string): string {
    const m = String(url).match(/[?&]v=([\w-]{6,})/);
    return m && m[1] ? m[1] : "";
  }

  function pageState(): YtPageState {
    if (/accounts\.google\.com|\/signin/i.test(location.href)) return "login_required";
    // Chưa đăng nhập: không có avatar, có nút "Sign in".
    const signedIn = q(YT.avatar);
    const signInBtn = [...document.querySelectorAll("a, button")].find((el) =>
      /^sign in$|đăng nhập/i.test(textOf(el)),
    );
    if (!signedIn && signInBtn) return "login_required";
    return "ok";
  }

  function stateError(state: YtPageState): string {
    if (state === "login_required") return "Tài khoản YouTube chưa đăng nhập trên trình duyệt.";
    return "Trang YouTube đang không khả dụng.";
  }

  function findVideos(skipKeys: string[], max: number): YtVideo[] {
    const skip = new Set(skipKeys.map((k) => k.toLowerCase()));
    const out: YtVideo[] = [];
    const seen = new Set<string>();
    for (const a of qa(YT.searchResult)) {
      const href = (a as HTMLAnchorElement).href || "";
      const id = videoIdFrom(href);
      if (!id || seen.has(id) || skip.has(id.toLowerCase())) continue;
      seen.add(id);
      const title = textOf(a) || (a as HTMLElement).getAttribute("title") || "";
      out.push({ videoId: id, title, url: `https://www.youtube.com/watch?v=${id}` });
      if (out.length >= max) break;
    }
    return out;
  }

  async function watchContext(): Promise<unknown> {
    const title = await waitFor(() => {
      const t = textOf(q(YT.watchTitle));
      return t || (document.title.replace(/ - YouTube$/, "").trim() || "");
    }, 8000);
    const channel = textOf(q(YT.channelName));
    const metaDesc =
      document.querySelector('meta[name="description"]')?.getAttribute("content") || "";
    const inlineDesc = textOf(q(["#description-inline-expander", "#description"]));
    const description = (inlineDesc || metaDesc).slice(0, 600);
    const videoId = videoIdFrom(location.href);
    if (!title) throw new Error("Không đọc được tiêu đề video YouTube.");
    return { ok: true, videoId, title, description, channel };
  }

  async function openCommentEditor(): Promise<HTMLElement | null> {
    // Cuộn xuống để YouTube tải khối bình luận (lazy-load).
    window.scrollTo({ top: Math.round(document.documentElement.scrollHeight * 0.35) });
    await waitFor(() => q(YT.commentsSection), 8000);
    await sleep(1200);

    let editor = q(YT.commentEditor);
    if (!editor) {
      const placeholder = q(YT.commentPlaceholder);
      if (placeholder) {
        clickEl(placeholder);
        await sleep(600);
      }
      editor = await waitFor(() => q(YT.commentEditor), 5000);
    }
    return (editor as HTMLElement | null) ?? null;
  }

  async function createComment(text: string): Promise<unknown> {
    if (!text) throw new Error("Nội dung bình luận rỗng.");
    const editor = await openCommentEditor();
    if (!editor) throw new Error("Không mở được ô bình luận YouTube.");

    editor.focus();
    await sleep(150);
    // YouTube dùng contenteditable thường — insertText hoạt động.
    const ok = document.execCommand("insertText", false, text);
    if (!ok || !textOf(editor)) {
      editor.textContent = text;
    }
    editor.dispatchEvent(new InputEvent("input", { bubbles: true, data: text, inputType: "insertText" }));
    await sleep(600);

    const submit = await waitFor(() => {
      const btn = q(YT.commentSubmit);
      if (!(btn instanceof HTMLElement)) return null;
      if (btn.hasAttribute("disabled") || btn.getAttribute("aria-disabled") === "true") return null;
      return btn;
    }, 4000);
    if (!submit) throw new Error("Nút gửi bình luận YouTube chưa bật.");
    clickEl(submit);
    await sleep(1500);
    return { ok: true };
  }

  async function likeVideo(): Promise<unknown> {
    const btn = q(YT.likeButton);
    if (!(btn instanceof HTMLElement)) throw new Error("Không tìm thấy nút like YouTube.");
    if (btn.getAttribute("aria-pressed") === "true") return { ok: true, skipped: true };
    clickEl(btn);
    await sleep(800);
    return { ok: true };
  }

  async function subscribeChannel(): Promise<unknown> {
    const btn = q(YT.subscribeButton);
    if (!(btn instanceof HTMLElement)) throw new Error("Không tìm thấy nút subscribe YouTube.");
    const label = `${textOf(btn)} ${btn.getAttribute("aria-label") || ""}`.toLowerCase();
    if (/subscribed|đã đăng ký/.test(label)) {
      return { ok: true, skipped: true, channel: textOf(q(YT.channelName)) };
    }
    clickEl(btn);
    await sleep(1000);
    return { ok: true, channel: textOf(q(YT.channelName)) };
  }
}

export {};
