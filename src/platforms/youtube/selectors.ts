/** Selector phụ thuộc UI YouTube — gom 1 chỗ để dễ sửa khi YouTube đổi giao diện. */
export const YT = {
  /** Link video trong trang kết quả tìm kiếm. */
  searchResult: [
    "ytd-video-renderer a#video-title",
    "ytd-video-renderer a#thumbnail[href*='/watch']",
  ],
  watchTitle: [
    "ytd-watch-metadata h1 yt-formatted-string",
    "h1.ytd-watch-metadata",
    "h1.title yt-formatted-string",
  ],
  channelName: [
    "ytd-watch-metadata #channel-name #text a",
    "#owner #channel-name a",
    "ytd-channel-name a",
  ],
  commentsSection: ["ytd-comments#comments", "#comments"],
  commentPlaceholder: ["#simplebox-placeholder", "ytd-comment-simplebox-renderer #placeholder-area"],
  commentEditor: [
    "ytd-commentbox #contenteditable-root[contenteditable]",
    "#contenteditable-root[contenteditable]",
  ],
  commentSubmit: ["ytd-commentbox #submit-button button", "#submit-button button"],
  likeButton: [
    "ytd-watch-metadata like-button-view-model button",
    "#top-level-buttons-computed button[aria-label*='like' i]",
    "#segmented-like-button button",
  ],
  subscribeButton: [
    "#subscribe-button ytd-subscribe-button-renderer button",
    "ytd-watch-metadata #subscribe-button button",
    "#subscribe-button tp-yt-paper-button",
  ],
  avatar: ["#avatar-btn", "ytd-topbar-menu-button-renderer #avatar-btn"],
} as const;

export function sel(list: readonly string[]): string {
  return list.join(", ");
}
