/**
 * Bộ gõ TikTok chạy ở MAIN world (cùng ngữ cảnh JS trang) để điều khiển Lexical
 * editor — nơi các event tổng hợp từ isolated world thường bị bỏ qua.
 * Giao tiếp với content script qua window.postMessage.
 */
import { sleep, keystrokeDelay, randInt } from "@/core/humanize";
import { TT, sel } from "../selectors";
import {
  BRIDGE_ISO,
  BRIDGE_PAGE,
  type PageRequest,
  type PageTypeResponse,
} from "../messages";

declare global {
  interface Window {
    __SA_TT_PAGE__?: boolean;
  }
}

if (!window.__SA_TT_PAGE__) {
  window.__SA_TT_PAGE__ = true;

  window.addEventListener("message", (event: MessageEvent) => {
    if (event.source !== window) return;
    const msg = event.data as (PageRequest & { source?: string; requestId?: string }) | undefined;
    if (!msg || msg.source !== BRIDGE_ISO) return;
    handle(msg)
      .then((result) => reply(msg.requestId, result))
      .catch((error: Error) => reply(msg.requestId, { ok: false, error: error.message || String(error) }));
  });

  function reply(requestId: string | undefined, result: PageTypeResponse): void {
    window.postMessage({ source: BRIDGE_PAGE, requestId, ...result }, "*");
  }

  async function handle(msg: PageRequest): Promise<PageTypeResponse> {
    if (msg.type === "PING") return { ok: true };
    if (msg.type === "TYPE_COMMENT") return typeComment(msg.text);
    return { ok: false, error: "unknown" };
  }

  function visible(el: Element | null): el is HTMLElement {
    if (!(el instanceof Element)) return false;
    const st = getComputedStyle(el);
    if (st.display === "none" || st.visibility === "hidden") return false;
    const r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2;
  }

  function isEditor(el: Element | null): el is HTMLElement {
    if (!visible(el)) return false;
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) return true;
    const ce = String(el.getAttribute("contenteditable") || "").toLowerCase();
    return ce === "true" || ce === "plaintext-only" || el.getAttribute("role") === "textbox";
  }

  function findEditor(): HTMLElement | null {
    const root = document.querySelector(sel(TT.commentInput));
    const pool = [
      ...(root
        ? root.querySelectorAll(
            '[contenteditable="plaintext-only"], [contenteditable="true"], [contenteditable], textarea, [role="textbox"]',
          )
        : []),
      ...document.querySelectorAll(
        '[data-e2e="comment-input"] [contenteditable], .public-DraftEditor-content[contenteditable], [data-lexical-editor="true"], [contenteditable="plaintext-only"]',
      ),
    ];
    return (pool.find(isEditor) as HTMLElement | undefined) ?? null;
  }

  function editorText(el: Element | null): string {
    if (!el) return "";
    const raw =
      el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
        ? el.value
        : (el as HTMLElement).innerText || el.textContent || "";
    return String(raw).replace(/[​‌‍﻿]/g, "").replace(/\s+/g, " ").trim();
  }

  function findPostButton(): HTMLElement | null {
    const direct = document.querySelector(sel(TT.commentPost));
    if (visible(direct)) return direct;
    const root = document.querySelector(sel(TT.commentInput))?.closest("form, div") ?? document;
    return (
      ([...root.querySelectorAll("button, [role='button'], [data-e2e*='comment']")].find((el) => {
        if (!visible(el)) return false;
        const label = `${(el as HTMLElement).innerText || ""} ${el.getAttribute("aria-label") || ""}`.trim();
        return /^(đăng|post|send)$/i.test(label);
      }) as HTMLElement | undefined) ?? null
    );
  }

  function buttonFingerprint(el: Element | null): string {
    if (!el) return "";
    const s = getComputedStyle(el);
    return [el.getAttribute("aria-disabled"), s.color, s.backgroundColor, s.opacity, String(el.className || "")].join(
      "|",
    );
  }

  function looksEnabled(el: Element | null, beforeFp: string): boolean {
    if (!visible(el)) return false;
    if ((el as HTMLButtonElement).disabled || el.hasAttribute("disabled")) return false;
    if (el.getAttribute("aria-disabled") === "true") return false;
    if (el.getAttribute("aria-disabled") === "false") return true;
    const cls = `${el.className || ""} ${el.parentElement?.className || ""}`;
    if (/\b(disabled|disable|is-disable|inactive|not-allow)\b/i.test(cls)) return false;
    const s = getComputedStyle(el);
    if (s.pointerEvents === "none") return false;
    const rgb = (c: string) => {
      const m = String(c).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
    };
    const redish = (c: string) => {
      const p = rgb(c);
      return !!p && p[0]! > 180 && p[1]! < 90 && p[2]! < 130;
    };
    if (redish(s.color) || redish(s.backgroundColor)) return true;
    if (beforeFp && buttonFingerprint(el) !== beforeFp) return true;
    return false;
  }

  function placeCaret(el: HTMLElement): void {
    el.focus({ preventScroll: true });
    try {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
    } catch {
      /* ignore */
    }
  }

  function clickAt(el: HTMLElement): void {
    const rect = el.getBoundingClientRect();
    const x = rect.left + Math.min(18, Math.max(6, rect.width * 0.2));
    const y = rect.top + rect.height / 2;
    const base = { bubbles: true, cancelable: true, composed: true, view: window, clientX: x, clientY: y, button: 0 };
    el.dispatchEvent(new MouseEvent("mousedown", { ...base, buttons: 1 }));
    el.dispatchEvent(new MouseEvent("mouseup", { ...base, buttons: 0 }));
    el.dispatchEvent(new MouseEvent("click", base));
    el.focus({ preventScroll: true });
  }

  function fireKey(el: HTMLElement, type: string, char: string): void {
    const isEnter = char === "\n";
    const key = isEnter ? "Enter" : char;
    const keyCode = isEnter ? 13 : char.charCodeAt(0);
    el.dispatchEvent(
      new KeyboardEvent(type, {
        key,
        code: isEnter ? "Enter" : /[a-zA-Z]/.test(char) ? `Key${char.toUpperCase()}` : "Unidentified",
        keyCode,
        which: keyCode,
        bubbles: true,
        cancelable: true,
        composed: true,
      }),
    );
  }

  function dispatchPaste(el: HTMLElement, text: string): void {
    const dt = new DataTransfer();
    dt.setData("text/plain", text);
    let paste: ClipboardEvent;
    try {
      paste = new ClipboardEvent("paste", { bubbles: true, cancelable: true, composed: true, clipboardData: dt });
    } catch {
      paste = new ClipboardEvent("paste", { bubbles: true, cancelable: true, composed: true });
    }
    try {
      Object.defineProperty(paste, "clipboardData", { value: dt });
    } catch {
      /* already set */
    }
    el.dispatchEvent(paste);
  }

  function triggerReact(el: HTMLElement, text: string): boolean {
    let node: HTMLElement | null = el;
    for (let i = 0; i < 10 && node; i += 1) {
      const key = Object.keys(node).find(
        (k) => k.startsWith("__reactProps$") || k.startsWith("__reactEventHandlers$"),
      );
      const props = key ? (node as unknown as Record<string, unknown>)[key] : null;
      const handlers = props as
        | { onInput?: (e: unknown) => void; onChange?: (e: unknown) => void; onKeyDown?: (e: unknown) => void }
        | null;
      if (handlers && (handlers.onInput || handlers.onChange || handlers.onKeyDown)) {
        const fake = {
          bubbles: true,
          cancelable: true,
          target: node,
          currentTarget: node,
          nativeEvent: { inputType: "insertText", data: text },
        };
        try {
          handlers.onKeyDown?.({ ...fake, key: text.slice(-1) || "a" });
          handlers.onInput?.(fake);
          handlers.onChange?.(fake);
        } catch {
          /* Draft.js EditorState shape khác */
        }
        return true;
      }
      node = node.parentElement;
    }
    return false;
  }

  async function clearEditor(el: HTMLElement): Promise<void> {
    placeCaret(el);
    await sleep(40);
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, "");
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    document.execCommand("selectAll", false);
    document.execCommand("delete", false);
    await sleep(30);
    placeCaret(el);
  }

  async function typeChar(el: HTMLElement, char: string): Promise<void> {
    fireKey(el, "keydown", char);
    const inserted =
      char === "\n" ? document.execCommand("insertLineBreak", false) : document.execCommand("insertText", false, char);
    if (!inserted) {
      try {
        const ev = new InputEvent("beforeinput", {
          bubbles: true,
          cancelable: true,
          composed: true,
          inputType: char === "\n" ? "insertLineBreak" : "insertText",
          data: char,
        });
        el.dispatchEvent(ev);
        if (!ev.defaultPrevented) document.execCommand("insertText", false, char);
      } catch {
        document.execCommand("insertText", false, char);
      }
    }
    fireKey(el, "keypress", char);
    fireKey(el, "keyup", char);
  }

  async function typeComment(text: string): Promise<PageTypeResponse> {
    const want = String(text || "");
    if (!want) return { ok: false, error: "empty" };
    const el = findEditor();
    if (!el) return { ok: false, error: "no-editor" };

    const beforeFp = buttonFingerprint(findPostButton());

    clickAt(el);
    await sleep(160 + randInt(0, 120));
    placeCaret(el);
    await sleep(80);
    await clearEditor(el);

    for (const [i, char] of [...want].entries()) {
      if (document.activeElement !== el && !el.contains(document.activeElement)) placeCaret(el);
      await typeChar(el, char);
      await sleep(keystrokeDelay(char, i));
    }

    await sleep(280);
    let typed = editorText(el);
    if (!typed) {
      placeCaret(el);
      dispatchPaste(el, want);
      await sleep(250);
      typed = editorText(el);
    }
    if (!typed) {
      triggerReact(el, want);
      await sleep(120);
      typed = editorText(el);
    }

    const enabled = looksEnabled(findPostButton(), beforeFp);
    if (!enabled && typed) {
      await clearEditor(el);
      dispatchPaste(el, want);
      await sleep(300);
    }

    return {
      ok: Boolean(editorText(el)),
      typed: editorText(el),
      postEnabled: looksEnabled(findPostButton(), beforeFp),
    };
  }
}

export {};
