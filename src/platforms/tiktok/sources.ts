/** Chuyển 1 mục nguồn (URL / @user / #hashtag / từ khoá) thành URL TikTok. */
export function sourceUrl(raw: string): string {
  const s = raw.trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("@")) return `https://www.tiktok.com/${s}`;
  if (s.startsWith("#")) return `https://www.tiktok.com/tag/${encodeURIComponent(s.slice(1))}`;
  return `https://www.tiktok.com/search?q=${encodeURIComponent(s)}`;
}

/** URL trang tài khoản (dùng cho job follow). */
export function userUrl(raw: string): string {
  const s = raw.trim();
  if (/^https?:\/\//i.test(s)) return s;
  const handle = s.replace(/^@/, "");
  return `https://www.tiktok.com/@${handle}`;
}

/** Trích handle để dedupe follow. */
export function handleOf(raw: string): string {
  const s = raw.trim();
  const m = s.match(/@([a-z0-9._]+)/i);
  if (m && m[1]) return m[1].toLowerCase();
  return s.replace(/^@/, "").toLowerCase();
}

/** Mục này có vẻ là tài khoản (để làm mục tiêu follow) không. */
export function looksLikeUser(raw: string): boolean {
  const s = raw.trim();
  return s.startsWith("@") || /tiktok\.com\/@/i.test(s);
}
