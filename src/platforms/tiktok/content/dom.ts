import { sleep } from "@/core/humanize";
import type { ElementBox } from "../messages";
import { TT, sel } from "../selectors";

export { sleep };

export function q(selectors: readonly string[], root: ParentNode = document): Element | null {
  return root.querySelector(sel(selectors));
}

export function qa(selectors: readonly string[], root: ParentNode = document): Element[] {
  return [...root.querySelectorAll(sel(selectors))];
}

export function visible(el: Element | null): el is Element {
  if (!(el instanceof Element)) return false;
  const st = getComputedStyle(el);
  if (st.display === "none" || st.visibility === "hidden") return false;
  const r = el.getBoundingClientRect();
  return r.width > 2 && r.height > 2;
}

export function textOf(el: Element | null | undefined): string {
  if (!el) return "";
  const raw = (el as HTMLElement).innerText ?? el.textContent ?? "";
  return String(raw).replace(/\s+/g, " ").trim();
}

/** Giá trị text của editor (input/textarea/contenteditable), bỏ ký tự zero-width. */
export function editorText(el: Element | null): string {
  if (!el) return "";
  const raw =
    el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
      ? el.value
      : (el as HTMLElement).innerText || el.textContent || "";
  return String(raw)
    .replace(/[​‌‍﻿]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function clickEl(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  el.scrollIntoView({ block: "center" });
  el.click();
  return true;
}

/** Click bằng chuỗi sự kiện pointer/mouse (gần với thao tác người dùng). */
export function clickAt(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  el.scrollIntoView({ block: "center", inline: "nearest" });
  const rect = el.getBoundingClientRect();
  const x = rect.left + Math.min(Math.max(8, rect.width * 0.25), Math.max(rect.width - 4, 8));
  const y = rect.top + Math.min(Math.max(6, rect.height / 2), Math.max(rect.height - 2, 6));
  const base = {
    bubbles: true,
    cancelable: true,
    composed: true,
    view: window,
    clientX: x,
    clientY: y,
    button: 0,
  };
  try {
    el.dispatchEvent(new PointerEvent("pointerdown", { ...base, pointerId: 1, pointerType: "mouse", buttons: 1 }));
  } catch {
    /* older engines */
  }
  el.dispatchEvent(new MouseEvent("mousedown", { ...base, buttons: 1 }));
  try {
    el.dispatchEvent(new PointerEvent("pointerup", { ...base, pointerId: 1, pointerType: "mouse", buttons: 0 }));
  } catch {
    /* older engines */
  }
  el.dispatchEvent(new MouseEvent("mouseup", { ...base, buttons: 0 }));
  el.dispatchEvent(new MouseEvent("click", base));
  return true;
}

/** Lặp gọi fn tới khi trả về giá trị truthy hoặc hết thời gian. */
export async function waitFor<T>(fn: () => T, timeout = 3000): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const value = fn();
    if (value) return value;
    await sleep(120);
  }
  return fn();
}

/** Toạ độ 1 điểm bên trong element (dùng cho CDP click ở Milestone 4). */
export function elementBox(el: Element | null, xRatio = 0.28, yRatio = 0.5): ElementBox | null {
  if (!(el instanceof Element)) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return null;
  return {
    x: r.left + Math.max(6, Math.min(r.width - 6, r.width * xRatio)),
    y: r.top + Math.max(6, Math.min(r.height - 6, r.height * yRatio)),
    left: r.left,
    top: r.top,
    width: r.width,
    height: r.height,
  };
}

/** Đổi "1,2K" / "3.4tr" → số. */
export function parseCount(raw: string): number {
  const t = String(raw || "").trim().replace(/\s+/g, "").replace(",", ".");
  if (!t || t === "-") return 0;
  const m = t.match(/^([\d.]+)\s*(k|m|b|n|tr)?/i);
  if (!m || !m[1]) return 0;
  const n = Number.parseFloat(m[1]);
  if (!Number.isFinite(n)) return 0;
  const suf = (m[2] || "").toLowerCase();
  if (suf === "k" || suf === "n") return Math.round(n * 1e3);
  if (suf === "m" || suf === "tr") return Math.round(n * 1e6);
  if (suf === "b") return Math.round(n * 1e9);
  return Math.round(n);
}

export function videoIdFrom(urlStr: string = location.href): string {
  const match = String(urlStr).match(/\/video\/(\d+)/i);
  return match && match[1] ? match[1] : "";
}

/** Thẻ video đang nằm giữa màn hình (video đang xem trên For You). */
export function currentVideoCard(): Element | null {
  const items = qa(TT.videoItem).filter(visible);
  if (items.length <= 1) return items[0] ?? null;
  const mid = window.innerHeight / 2;
  return (
    items.find((el) => {
      const r = el.getBoundingClientRect();
      return r.top < mid && r.bottom > mid;
    }) ?? null
  );
}
