/**
 * Lọc liên quan "mềm": chấm điểm 1 đoạn text (caption + hashtag + author)
 * theo bộ từ khoá của kênh. Không dùng AI, chạy local, rẻ.
 */

/** Bỏ dấu tiếng Việt + hạ chữ thường để so khớp không phân biệt dấu. */
export function normalize(text: string): string {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

export interface RelevanceResult {
  score: number;
  matched: string[];
}

/**
 * Đếm số từ khoá xuất hiện trong text. Mỗi keyword tính tối đa 1 điểm.
 * Keyword nhiều từ (vd "task 2") so khớp dạng chuỗi con; keyword 1 từ so
 * theo ranh giới từ để tránh khớp nhầm (vd "band" trong "abandon").
 */
export function scoreRelevance(
  text: string,
  keywords: string[],
): RelevanceResult {
  const hay = normalize(text);
  if (!hay) return { score: 0, matched: [] };
  const matched: string[] = [];
  for (const kw of keywords) {
    const needle = normalize(kw);
    if (!needle) continue;
    const isPhrase = needle.includes(" ");
    const hit = isPhrase
      ? hay.includes(needle)
      : new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(needle)}([^\\p{L}\\p{N}]|$)`, "u").test(hay);
    if (hit) matched.push(kw);
  }
  return { score: matched.length, matched };
}

/** Video có liên quan đủ để bình luận không. */
export function isRelevant(
  text: string,
  keywords: string[],
  minScore: number,
): boolean {
  // Không có keyword nào => không lọc (nhận mọi video).
  if (!keywords.length) return true;
  return scoreRelevance(text, keywords).score >= Math.max(1, minScore);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
