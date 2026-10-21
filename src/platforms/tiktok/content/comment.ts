import { randInt } from "@/core/humanize";
import { TT } from "../selectors";
import type { CommentStatusResponse, PrepareResponse } from "../messages";
import { q, visible, clickAt, waitFor, sleep, editorText, elementBox, currentVideoCard } from "./dom";
import { askPage, pingPageTyper } from "./bridge";

function isRealEditor(el: Element | null): el is HTMLElement {
  if (!visible(el)) return false;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) return true;
  const ce = String(el.getAttribute("contenteditable") || "").toLowerCase();
  return ce === "true" || ce === "plaintext-only" || el.getAttribute("role") === "textbox";
}

export function findCommentEditor(): HTMLElement | null {
  const root = q(TT.commentInput);
  const scoped = root
    ? [
        ...root.querySelectorAll(
          '[contenteditable="plaintext-only"], [contenteditable="true"], [contenteditable], textarea, [role="textbox"]',
        ),
      ]
    : [];
  const extras = [
    ...document.querySelectorAll(
      '[data-e2e="comment-input"] [contenteditable], [class*="DivInputEditorContainer"] [contenteditable], .public-DraftEditor-content[contenteditable], [data-lexical-editor="true"], [contenteditable="plaintext-only"]',
    ),
  ];
  return ([...scoped, ...extras].find(isRealEditor) as HTMLElement | undefined) ?? null;
}

export function findCommentPostButton(): HTMLElement | null {
  const direct = q(TT.commentPost);
  if (visible(direct)) return direct as HTMLElement;
  const root = q(TT.commentInput)?.parentElement ?? document;
  return (
    ([...root.querySelectorAll("button, [role='button'], [data-e2e*='comment']")].find((el) => {
      if (!visible(el)) return false;
      const label = `${(el as HTMLElement).innerText || ""} ${el.getAttribute("aria-label") || ""}`.trim();
      return /^(đăng|post|send|đăng lên)$/i.test(label);
    }) as HTMLElement | undefined) ?? null
  );
}

export function buttonFingerprint(el: Element | null): string {
  if (!el) return "";
  const s = getComputedStyle(el);
  return [el.getAttribute("aria-disabled"), s.color, s.backgroundColor, s.opacity, String(el.className || "")].join(
    "|",
  );
}

/** Nút Đăng đã bật chưa — TikTok không có disabled chuẩn, phải đoán. */
export function isPostEnabled(el: Element | null, beforeFp: string): boolean {
  if (!visible(el)) return false;
  const btn = el as HTMLElement;
  if ((btn as HTMLButtonElement).disabled || btn.hasAttribute("disabled")) return false;
  if (btn.getAttribute("aria-disabled") === "true") return false;
  if (btn.getAttribute("aria-disabled") === "false") return true;
  const cls = `${btn.className || ""} ${btn.parentElement?.className || ""}`;
  if (/\b(disabled|disable|is-disable|inactive|not-allow)\b/i.test(cls)) return false;
  const s = getComputedStyle(btn);
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
  if (beforeFp && buttonFingerprint(btn) !== beforeFp) return true;
  return false;
}

/**
 * Mở/ focus ô bình luận của ĐÚNG video đang xem.
 * For You render nhiều video → phải bấm icon comment nằm TRONG thẻ video giữa
 * màn hình, không dùng icon toàn trang (hay trúng video phía trên).
 */
export async function activateCommentEditor(focus = true): Promise<HTMLElement | null> {
  const card = currentVideoCard();
  // Icon comment của chính video đang xem.
  const commentBtn = (card ? q(TT.commentIcon, card) : null) ?? q(TT.commentIcon);

  // Nếu đã có ô nhập mở sẵn nhưng là của video trước (ta chưa bấm icon video này),
  // vẫn bấm icon video hiện tại để chuyển panel sang đúng video.
  let editor = findCommentEditor();
  if (!editor && commentBtn) {
    clickAt(commentBtn);
    await sleep(1100);
  } else if (editor) {
    if (focus) clickAt(editor);
    await sleep(220);
    return editor;
  }

  const box = q(TT.commentInput);
  if (box) {
    clickAt(box);
    await sleep(350);
  }
  editor = await waitFor(() => findCommentEditor(), 5000);
  if (editor && focus) {
    clickAt(editor);
    await sleep(180);
  }
  return editor;
}

export async function prepareComment(): Promise<PrepareResponse> {
  await sleep(400 + randInt(0, 280));
  const editor = await activateCommentEditor(false);
  if (!editor) throw new Error("Không tìm thấy ô bình luận TikTok.");
  const post = findCommentPostButton();
  return {
    ok: true,
    editor: elementBox(editor),
    post: elementBox(post, 0.5, 0.5),
    postFingerprint: buttonFingerprint(post),
  };
}

export function commentStatus(beforeFp: string): CommentStatusResponse {
  const editor = findCommentEditor();
  const post = findCommentPostButton();
  return {
    ok: true,
    editorText: editorText(editor),
    postEnabled: isPostEnabled(post, beforeFp),
    editor: elementBox(editor),
    post: elementBox(post, 0.5, 0.5),
  };
}

/**
 * Đường gõ "mềm": nhờ page typer gõ vào Lexical rồi bấm Đăng.
 * Background sẽ ưu tiên đường CDP "trusted" (Milestone 4) và dùng hàm này làm
 * phương án đầu / dự phòng.
 */
export async function createCommentSoft(text: string, postKey: string): Promise<{ ok: true; postKey: string; text: string }> {
  if (!text) throw new Error("Nội dung bình luận rỗng.");
  await sleep(700 + randInt(0, 400));

  const editor = await activateCommentEditor();
  if (!editor) throw new Error("Không tìm thấy ô bình luận TikTok.");

  const beforeFp = buttonFingerprint(findCommentPostButton());

  if (!(await pingPageTyper())) {
    throw new Error("Chưa gắn được page typer TikTok. Reload extension rồi mở lại tab TikTok.");
  }
  const typedRes = await askPage({ type: "TYPE_COMMENT", text });
  if (!typedRes.ok) throw new Error(typedRes.error || "Không gõ được bình luận.");
  const typed = String(typedRes.typed || editorText(findCommentEditor()));
  if (!typed) throw new Error("Không gõ được nội dung vào ô bình luận.");

  const postBtn = await waitFor(() => {
    const btn = findCommentPostButton();
    return isPostEnabled(btn, beforeFp) ? btn : null;
  }, 4000);
  if (!postBtn) throw new Error("Nút Đăng không bật sau khi nhập nội dung.");

  await sleep(180 + randInt(0, 220));
  clickAt(postBtn);
  await sleep(1600);

  const leftover = editorText(findCommentEditor());
  if (leftover && leftover.slice(0, 24) === typed.slice(0, 24)) {
    throw new Error("TikTok chưa nhận bình luận (ô nhập vẫn còn nội dung).");
  }
  return { ok: true, postKey: postKey || typed.slice(0, 20), text };
}
