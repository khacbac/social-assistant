import { useState } from "react";
import type { AppState } from "@/core/types";
import { sendCommand } from "@/core/rpc";

export function SettingsPage({ state }: { state: AppState }) {
  const [apiKey, setApiKey] = useState(state.ai.apiKey);
  const [model, setModel] = useState(state.ai.model);
  const [maxChars, setMaxChars] = useState(state.ai.maxChars);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    await sendCommand({ type: "SAVE_AI", ai: { apiKey: apiKey.trim(), model, maxChars } });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <section className="stack">
      <label className="field">
        <span>Anthropic API key</span>
        <input
          type="password"
          placeholder="sk-ant-..."
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
        <small className="muted">
          Lưu cục bộ trong trình duyệt (chrome.storage.local), chỉ dùng để gọi Claude Haiku.
        </small>
      </label>

      <label className="field">
        <span>Model</span>
        <input value={model} onChange={(e) => setModel(e.target.value)} />
      </label>

      <label className="field">
        <span>Độ dài tối đa comment (ký tự)</span>
        <input
          type="number"
          min={20}
          value={maxChars}
          onChange={(e) => setMaxChars(Number(e.target.value) || 150)}
        />
      </label>

      <div className="row">
        <button className="primary" onClick={() => void save()}>
          Lưu cài đặt
        </button>
        {saved && <span className="muted">Đã lưu ✓</span>}
      </div>
    </section>
  );
}
