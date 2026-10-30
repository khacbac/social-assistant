/**
 * Content script TikTok (isolated world). Nhận lệnh từ background, điều khiển DOM:
 * tìm video đúng chủ đề, mở ô bình luận, gõ (đường mềm), lướt + tim, follow.
 * Đường gõ "trusted" bằng CDP nằm ở background (Milestone 4).
 */
import type { TiktokRequest } from "../messages";
import { pageState, stateError, findCommentTarget } from "./context";
import { prepareComment, commentStatus, createCommentSoft } from "./comment";
import { scrollFeed, findFollowTarget, followCurrentCreator } from "./feed";

declare global {
  interface Window {
    __SA_TT_CONTENT__?: boolean;
  }
}

if (!window.__SA_TT_CONTENT__) {
  window.__SA_TT_CONTENT__ = true;

  // Khoá chống chạy chồng các thao tác thay đổi trạng thái.
  let actionLock = false;

  chrome.runtime.onMessage.addListener((message: TiktokRequest, _sender, sendResponse) => {
    handle(message)
      .then(sendResponse)
      .catch((err: Error) => sendResponse({ ok: false, error: err.message || String(err) }));
    return true;
  });

  async function handle(message: TiktokRequest): Promise<unknown> {
    const state = pageState();
    if (message.type === "PING") {
      return { ok: true, platform: "tiktok", href: location.href, state };
    }
    if (state !== "ok") throw new Error(stateError(state));

    switch (message.type) {
      case "TT_FIND_COMMENT_TARGET":
        return findCommentTarget({
          skipKeys: message.skipKeys,
          minComments: message.minComments,
          maxScrolls: message.maxScrolls,
        });
      case "TT_COMMENT_STATUS":
        return commentStatus(message.beforeFp);
      default:
        return runLocked(message);
    }
  }

  async function runLocked(message: TiktokRequest): Promise<unknown> {
    if (actionLock) return { ok: false, error: "Đang có thao tác TikTok khác." };
    actionLock = true;
    try {
      switch (message.type) {
        case "TT_PREPARE_COMMENT":
          return await prepareComment();
        case "TT_CREATE_COMMENT":
          return await createCommentSoft(message.text, message.postKey);
        case "TT_SCROLL_FEED":
          return {
            ok: true,
            ...(await scrollFeed({
              rounds: message.rounds,
              autoLike: message.autoLike,
              likeDelay: message.likeDelay,
            })),
          };
        case "TT_FOLLOW_CURRENT":
          return await followCurrentCreator(message.handle);
        case "TT_FIND_FOLLOW_TARGET":
          return await findFollowTarget({
            skipKeys: message.skipKeys,
            maxScrolls: message.maxScrolls,
          });
        default:
          return { ok: false, error: `TikTok không xử lý lệnh ${(message as { type: string }).type}.` };
      }
    } finally {
      actionLock = false;
    }
  }
}

export {};
