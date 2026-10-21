/** Giao thức message giữa background (isolated) ↔ content script TikTok. */

export interface ElementBox {
  x: number;
  y: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Trạng thái trang TikTok. */
export type TiktokPageState = "ok" | "login_required" | "unavailable";

/** Thông tin 1 video đủ điều kiện để bình luận. */
export interface VideoTarget {
  postKey: string;
  author: string;
  caption: string;
  hashtags: string[];
  commentCount: number;
}

/** Kết quả tìm video mục tiêu. */
export type FindTargetResult =
  | { ok: true; target: VideoTarget }
  | { ok: true; skipped: true; reason: string }
  | { ok: false; error: string; scanned: number; lowComment: number; offTopic: number };

/** Kết quả auto-follow từ For You. */
export type AutoFollowResult =
  | { ok: true; handle: string }
  | { ok: false; error: string };

/** Yêu cầu bg → content. */
export type TiktokRequest =
  | { type: "PING" }
  | {
      type: "TT_FIND_COMMENT_TARGET";
      skipKeys: string[];
      minComments: number;
      maxScrolls: number;
      keywords: string[];
      minRelevanceScore: number;
    }
  | { type: "TT_PREPARE_COMMENT" }
  | { type: "TT_COMMENT_STATUS"; beforeFp: string }
  | { type: "TT_CREATE_COMMENT"; text: string; postKey: string }
  | { type: "TT_SCROLL_FEED"; rounds: number; autoLike: boolean; likeDelay: number }
  | {
      type: "TT_AUTO_FOLLOW";
      skipKeys: string[];
      keywords: string[];
      minRelevanceScore: number;
      maxScrolls: number;
    };

export interface PingResponse {
  ok: true;
  platform: "tiktok";
  href: string;
  state: TiktokPageState;
}

export interface PrepareResponse {
  ok: true;
  editor: ElementBox | null;
  post: ElementBox | null;
  postFingerprint: string;
}

export interface CommentStatusResponse {
  ok: true;
  editorText: string;
  postEnabled: boolean;
  editor: ElementBox | null;
  post: ElementBox | null;
}

/** Message nội bộ content (isolated) ↔ page typer (MAIN world). */
export const BRIDGE_ISO = "sa-tt-iso";
export const BRIDGE_PAGE = "sa-tt-page";

export type PageRequest =
  | { type: "PING" }
  | { type: "TYPE_COMMENT"; text: string };

export interface PageTypeResponse {
  ok: boolean;
  typed?: string;
  postEnabled?: boolean;
  error?: string;
}
