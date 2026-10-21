/**
 * Mọi selector phụ thuộc UI TikTok gom về đây. Khi TikTok đổi giao diện
 * chỉ cần sửa file này.
 */
export const TT = {
  videoItem: [
    '[data-e2e="recommend-list-item-container"]',
    '[data-e2e="feed-item"]',
    '[data-e2e="user-post-item"]',
  ],
  author: [
    '[data-e2e="video-author-uniqueid"]',
    '[data-e2e="browse-username"]',
    '[data-e2e="user-title"]',
  ],
  caption: [
    '[data-e2e="video-desc"]',
    '[data-e2e="browse-video-desc"]',
    '[data-e2e="new-desc-span"]',
  ],
  commentCount: ['[data-e2e="comment-count"]', '[data-e2e="browse-comment-count"]'],
  commentIcon: ['[data-e2e="comment-icon"]', '[data-e2e="browse-comment-icon"]'],
  commentInput: ['[data-e2e="comment-input"]'],
  commentPost: ['[data-e2e="comment-post"]', '[data-e2e="comment-publish"]'],
  likeIcon: [
    '[data-e2e="like-icon"]',
    '[data-e2e="browse-like-icon"]',
    '[data-e2e="video-like"]',
  ],
  followButton: ['[data-e2e="follow-button"]', '[data-e2e="browse-follow"]'],
  /** Nút follow "+" ngay trên thẻ video For You. */
  feedFollow: [
    '[data-e2e="feed-follow"]',
    '[data-e2e="follow-icon"]',
    'button[aria-label*="Follow" i]',
    'button[aria-label*="Theo dõi" i]',
  ],
} as const;

/** Nối nhiều selector thành 1 chuỗi querySelector. */
export function sel(list: readonly string[]): string {
  return list.join(", ");
}
