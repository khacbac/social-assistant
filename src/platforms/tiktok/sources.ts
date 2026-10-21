/** Chuyển 1 mục nguồn bình luận (URL / @user / #hashtag / từ khoá) thành URL TikTok. */
export function sourceUrl(raw: string): string {
  const s = raw.trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("@")) return `https://www.tiktok.com/${s}`;
  if (s.startsWith("#")) return `https://www.tiktok.com/tag/${encodeURIComponent(s.slice(1))}`;
  return `https://www.tiktok.com/search?q=${encodeURIComponent(s)}`;
}
