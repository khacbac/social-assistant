/**
 * Gõ bình luận TikTok theo đường "trusted" bằng chrome.debugger (CDP): phát sự
 * kiện phím/chuột hệ thống thật nên Lexical editor luôn nhận. Yêu cầu tab TikTok
 * hiển thị và KHÔNG mở DevTools. Dùng làm đường chính; nếu lỗi, adapter lùi về
 * đường "mềm" (content script).
 */
import { sleep, randInt } from "@/core/humanize";
import { focusTab } from "@/background/messaging";

type Debuggee = chrome.debugger.Debuggee;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface TiktokSnapshot {
  hasEditor: boolean;
  focused: boolean;
  editorText: string;
  activeTag: string;
  editorBox: Box | null;
  postBox: Box | null;
  postDisabled: boolean;
}

async function attach(tabId: number): Promise<Debuggee> {
  const target: Debuggee = { tabId };
  try {
    await chrome.debugger.attach(target, "1.3");
  } catch (error) {
    const msg = String((error as Error)?.message || error);
    if (!/already attached/i.test(msg)) {
      throw new Error(
        "Không gắn được bộ gõ thật vào tab TikTok. Reload extension, chấp nhận quyền debugger, đóng DevTools trên tab đó rồi thử lại.",
      );
    }
  }
  return target;
}

async function withTabDebugger<T>(tabId: number, fn: (target: Debuggee) => Promise<T>): Promise<T> {
  const target = await attach(tabId);
  try {
    await send(target, "Page.bringToFront").catch(() => {});
    await send(target, "Emulation.setFocusEmulationEnabled", { enabled: true }).catch(() => {});
    return await fn(target);
  } finally {
    await send(target, "Emulation.setFocusEmulationEnabled", { enabled: false }).catch(() => {});
    await chrome.debugger.detach(target).catch(() => {});
  }
}

function send(target: Debuggee, method: string, params?: Record<string, unknown>): Promise<unknown> {
  return chrome.debugger.sendCommand(target, method, params);
}

async function cdpEvaluate<T>(target: Debuggee, expression: string): Promise<T> {
  const res = (await send(target, "Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
    userGesture: true,
  })) as { result?: { value?: T }; exceptionDetails?: { exception?: { description?: string }; text?: string } };
  if (res?.exceptionDetails) {
    const d = res.exceptionDetails;
    throw new Error(d.exception?.description || d.text || "TikTok page eval lỗi.");
  }
  return res?.result?.value as T;
}

async function trustedClick(target: Debuggee, x: number, y: number): Promise<void> {
  const cx = Math.round(x || 0);
  const cy = Math.round(y || 0);
  await send(target, "Input.dispatchMouseEvent", { type: "mouseMoved", x: cx, y: cy, button: "none", pointerType: "mouse" });
  await sleep(40 + randInt(0, 70));
  await send(target, "Input.dispatchMouseEvent", {
    type: "mousePressed", x: cx, y: cy, button: "left", buttons: 1, clickCount: 1, pointerType: "mouse",
  });
  await sleep(35 + randInt(0, 55));
  await send(target, "Input.dispatchMouseEvent", {
    type: "mouseReleased", x: cx, y: cy, button: "left", buttons: 0, clickCount: 1, pointerType: "mouse",
  });
}

function keyDesc(char: string): { key: string; code: string; keyCode: number } {
  if (char === "\n") return { key: "Enter", code: "Enter", keyCode: 13 };
  if (char === " ") return { key: " ", code: "Space", keyCode: 32 };
  const upper = char.toUpperCase();
  if (/^[a-zA-Z]$/.test(char)) return { key: char, code: `Key${upper}`, keyCode: upper.charCodeAt(0) };
  if (/^[0-9]$/.test(char)) return { key: char, code: `Digit${char}`, keyCode: char.charCodeAt(0) };
  return { key: char, code: "Unidentified", keyCode: char.codePointAt(0) || 0 };
}

async function trustedTypeText(target: Debuggee, text: string): Promise<void> {
  const chars = [...String(text || "")];
  for (const [i, char] of chars.entries()) {
    const desc = keyDesc(char);
    await send(target, "Input.dispatchKeyEvent", {
      type: "rawKeyDown", key: desc.key, code: desc.code, windowsVirtualKeyCode: desc.keyCode, nativeVirtualKeyCode: desc.keyCode,
    });
    await send(target, "Input.insertText", { text: char });
    await send(target, "Input.dispatchKeyEvent", {
      type: "keyUp", key: desc.key, code: desc.code, windowsVirtualKeyCode: desc.keyCode, nativeVirtualKeyCode: desc.keyCode,
    });
    let delay = 70 + randInt(0, 120);
    if (char === " ") delay += 40 + randInt(0, 70);
    if (/[.,!?;:]/.test(char)) delay += 120 + randInt(0, 180);
    if (i > 6 && Math.random() < 0.07) delay += 240 + randInt(0, 360);
    await sleep(delay);
  }
}

/** Script tự chứa, inject vào trang để tìm/mở/focus ô bình luận và chụp trạng thái. */
const EDITOR_SCRIPT = `(() => {
  function vis(el) {
    if (!(el instanceof Element)) return false;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 2 && r.height > 2 && s.visibility !== "hidden" && s.display !== "none";
  }
  function search(root) {
    const sels = [
      '[data-e2e="comment-input"] [contenteditable="plaintext-only"]',
      '[data-e2e="comment-input"] [contenteditable="true"]',
      '[data-e2e="comment-input"] [contenteditable]',
      '[class*="DivInputEditorContainer"] [contenteditable]',
      '[class*="DraftEditor-root"] [contenteditable]',
      '.public-DraftEditor-content[contenteditable]',
      '[data-e2e="comment-input"] textarea',
      '[contenteditable="plaintext-only"]',
    ];
    for (const sel of sels) {
      const el = root.querySelector(sel);
      if (vis(el)) return el;
    }
    for (const node of root.querySelectorAll("*")) {
      if (node.shadowRoot) {
        const found = search(node.shadowRoot);
        if (found) return found;
      }
    }
    return null;
  }
  function findPost() {
    const direct = document.querySelector('[data-e2e="comment-post"], [data-e2e="comment-publish"], [class*="DivPostButton"]');
    if (vis(direct)) return direct;
    return Array.from(document.querySelectorAll("button, [role='button']")).find((el) => {
      if (!vis(el)) return false;
      return /^(đăng|post|send)$/i.test((el.innerText || "").trim());
    }) || null;
  }
  function boxOf(el, xr, yr) {
    const r = el.getBoundingClientRect();
    return { x: r.left + Math.max(6, Math.min(r.width - 6, r.width * xr)), y: r.top + Math.max(6, Math.min(r.height - 6, r.height * yr)), w: r.width, h: r.height };
  }
  function textOf(el) {
    if (!el) return "";
    const raw = (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) ? el.value : (el.innerText || el.textContent || "");
    return String(raw).replace(/[\\u200b\\u200c\\u200d\\ufeff]/g, " ").replace(/\\s+/g, " ").trim();
  }
  function currentCard() {
    const items = Array.from(document.querySelectorAll('[data-e2e="recommend-list-item-container"], [data-e2e="feed-item"], [data-e2e="user-post-item"]')).filter(vis);
    if (items.length <= 1) return items[0] || null;
    const mid = window.innerHeight / 2;
    return items.find((el) => { const r = el.getBoundingClientRect(); return r.top < mid && r.bottom > mid; }) || null;
  }
  function openPanel() {
    const card = currentCard();
    const btn = (card && card.querySelector('[data-e2e="comment-icon"], [data-e2e="browse-comment-icon"]')) || document.querySelector('[data-e2e="comment-icon"], [data-e2e="browse-comment-icon"]');
    if (vis(btn)) btn.click();
    const box = document.querySelector('[data-e2e="comment-input"]');
    if (vis(box)) box.click();
  }
  function focusEditor(el) {
    el.scrollIntoView({ block: "center", inline: "nearest" });
    el.click();
    el.focus();
    try {
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (e) {}
  }
  function snapshot() {
    const editor = search(document);
    const post = findPost();
    const active = document.activeElement;
    return {
      hasEditor: Boolean(editor),
      focused: Boolean(editor && (active === editor || editor.contains(active))),
      editorText: textOf(editor),
      activeTag: active ? (active.getAttribute("contenteditable") || active.tagName) : "",
      editorBox: editor ? boxOf(editor, 0.28, 0.5) : null,
      postBox: post ? boxOf(post, 0.5, 0.5) : null,
      postDisabled: post ? (post.getAttribute("aria-disabled") === "true" || Boolean(post.disabled) || /disable|inactive|not-allow/i.test(String(post.className || ""))) : true,
    };
  }
  window.__saTtEditor = { search, findPost, boxOf, textOf, openPanel, focusEditor, snapshot };
  return snapshot();
})()`;

function cdpSnapshot(target: Debuggee): Promise<TiktokSnapshot> {
  return cdpEvaluate<TiktokSnapshot>(target, EDITOR_SCRIPT);
}

function cdpFocusEditor(target: Debuggee): Promise<TiktokSnapshot> {
  return cdpEvaluate<TiktokSnapshot>(
    target,
    `${EDITOR_SCRIPT};
    (() => {
      const api = window.__saTtEditor;
      const el = api.search(document);
      if (!el) { api.openPanel(); return { hasEditor: false, focused: false, editorText: "", activeTag: "", editorBox: null, postBox: null, postDisabled: true }; }
      api.focusEditor(el);
      return api.snapshot();
    })()`,
  );
}

/** Mở ô bình luận, gõ trusted, bấm Đăng. Ném lỗi nếu không nhận chữ. */
export async function postCommentTrusted(tabId: number, text: string): Promise<void> {
  await focusTab(tabId);
  await sleep(250);

  await withTabDebugger(tabId, async (target) => {
    let snap = await cdpFocusEditor(target);
    if (!snap.hasEditor) {
      await sleep(900);
      snap = await cdpFocusEditor(target);
    }
    if (!snap.hasEditor || !snap.editorBox) {
      throw new Error("Không tìm thấy ô bình luận TikTok (contenteditable).");
    }

    await trustedClick(target, snap.editorBox.x, snap.editorBox.y);
    await sleep(180);
    snap = await cdpFocusEditor(target);
    if (!snap.focused && snap.editorBox) {
      await trustedClick(target, snap.editorBox.x, snap.editorBox.y);
      await sleep(160);
      snap = await cdpSnapshot(target);
    }

    await trustedTypeText(target, text);

    snap = await cdpSnapshot(target);
    if (!snap.editorText.trim()) {
      await cdpFocusEditor(target);
      await send(target, "Input.insertText", { text });
      await sleep(400);
      snap = await cdpSnapshot(target);
    }
    if (!snap.editorText.trim()) {
      throw new Error("TikTok không nhận chữ. Đóng DevTools, để tab TikTok hiển thị rồi thử lại.");
    }

    const started = Date.now();
    while (Date.now() - started < 7000) {
      snap = await cdpSnapshot(target);
      if (snap.postBox && snap.postDisabled === false) break;
      await sleep(220);
    }
    if (!snap.postBox) throw new Error("Không tìm thấy nút Đăng bình luận TikTok.");
    if (snap.postDisabled !== false && !snap.editorText.trim()) {
      throw new Error("Đã gõ nhưng nút Đăng vẫn tắt.");
    }

    await sleep(180 + randInt(0, 220));
    await trustedClick(target, snap.postBox.x, snap.postBox.y);
  });

  await sleep(1700);
}
