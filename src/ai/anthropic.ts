import type { AiSettings } from "@/core/types";

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

interface AnthropicTextBlock {
  type: string;
  text?: string;
}

interface AnthropicResponse {
  content?: AnthropicTextBlock[];
  error?: { type: string; message: string };
}

export class AiError extends Error {}

/**
 * Gọi Claude (Haiku) sinh 1 đoạn text ngắn.
 * Gọi trực tiếp từ service worker: cần header browser-access.
 * API key nằm trong chrome.storage.local (tool cá nhân).
 */
export async function generate(
  ai: AiSettings,
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  const apiKey = ai.apiKey.trim();
  if (!apiKey) throw new AiError("Chưa cấu hình Anthropic API key (tab Cài đặt).");

  const body = {
    model: ai.model,
    max_tokens: 256,
    output_config: { effort: "low" as const },
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  };

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": API_VERSION,
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const data = (await res.json()) as AnthropicResponse;
      if (!res.ok) {
        const msg = data.error?.message || `HTTP ${res.status}`;
        // 429 / 5xx => thử lại 1 lần
        if ((res.status === 429 || res.status >= 500) && attempt === 0) {
          lastError = new AiError(msg);
          await new Promise((r) => setTimeout(r, 1200));
          continue;
        }
        throw new AiError(`Anthropic lỗi: ${msg}`);
      }
      const text = extractText(data);
      if (!text) throw new AiError("Anthropic trả về rỗng.");
      return cleanComment(text, ai.maxChars);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new AiError("Anthropic hết thời gian chờ.");
      }
      lastError = err as Error;
      if (attempt === 1) throw err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError ?? new AiError("Anthropic lỗi không xác định.");
}

function extractText(data: AnthropicResponse): string {
  return (data.content ?? [])
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text as string)
    .join(" ")
    .trim();
}

/** Dọn output: bỏ ngoặc kép bọc ngoài, markdown, cắt theo giới hạn ký tự. */
export function cleanComment(raw: string, maxChars: number): string {
  let text = raw
    .trim()
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/^#+\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  if (maxChars > 0 && text.length > maxChars) {
    text = text.slice(0, maxChars).replace(/\s+\S*$/, "").trim();
  }
  return text;
}
