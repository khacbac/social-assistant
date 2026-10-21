/** Giao thức message background ↔ content script YouTube. */

export type YtPageState = "ok" | "login_required" | "unavailable";

export interface YtVideo {
  videoId: string;
  title: string;
  url: string;
}

export interface YtWatchContext {
  ok: true;
  videoId: string;
  title: string;
  description: string;
  channel: string;
}

export type YtRequest =
  | { type: "PING" }
  | { type: "YT_FIND_VIDEOS"; skipKeys: string[]; max: number }
  | { type: "YT_WATCH_CONTEXT" }
  | { type: "YT_CREATE_COMMENT"; text: string }
  | { type: "YT_LIKE" }
  | { type: "YT_SUBSCRIBE" };

export interface YtPingResponse {
  ok: true;
  platform: "youtube";
  href: string;
  state: YtPageState;
}

export interface YtFindResponse {
  ok: true;
  videos: YtVideo[];
}

export interface YtSimpleResponse {
  ok: boolean;
  error?: string;
  skipped?: boolean;
  channel?: string;
}
