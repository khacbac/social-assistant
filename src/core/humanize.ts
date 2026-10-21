/** Chờ ms mili-giây. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Số nguyên ngẫu nhiên trong [min, max]. */
export function randInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

/** Giãn cách ngẫu nhiên (ms) cho lần chạy job kế tiếp, theo cấu hình phút. */
export function nextDelayMs(minMinutes: number, maxMinutes: number): number {
  const lo = Math.max(1, Math.min(minMinutes, maxMinutes));
  const hi = Math.max(minMinutes, maxMinutes);
  return randInt(lo, hi) * 60_000;
}

/** Độ trễ gõ phím mô phỏng người thật, tuỳ ký tự và vị trí. */
export function keystrokeDelay(char: string, index: number): number {
  let ms = randInt(55, 165);
  if (char === " ") ms += randInt(25, 80);
  if (/[.,!?;:]/.test(char)) ms += randInt(90, 250);
  if (index > 8 && Math.random() < 0.06) ms += randInt(220, 600);
  return ms;
}
