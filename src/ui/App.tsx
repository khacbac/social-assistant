import { useState } from "react";
import { useAppState } from "./useAppState";
import { ChannelsPage } from "./pages/ChannelsPage";
import { TikTokPage } from "./pages/TikTokPage";
import { LogsPage } from "./pages/LogsPage";
import { SettingsPage } from "./pages/SettingsPage";

type Tab = "channels" | "tiktok" | "logs" | "settings";

const TABS: { id: Tab; label: string }[] = [
  { id: "channels", label: "Kênh" },
  { id: "tiktok", label: "TikTok" },
  { id: "logs", label: "Nhật ký" },
  { id: "settings", label: "Cài đặt" },
];

export function App() {
  const [tab, setTab] = useState<Tab>("channels");
  const state = useAppState();

  return (
    <div className="app">
      <header className="app__header">
        <h1>Social Assistant</h1>
        <span className="app__sub">Trợ lý tương tác bằng nick của bạn · v1 TikTok</span>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tabs__btn ${tab === t.id ? "is-active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="page">
        {!state ? (
          <p className="muted">Đang tải…</p>
        ) : tab === "channels" ? (
          <ChannelsPage state={state} />
        ) : tab === "tiktok" ? (
          <TikTokPage state={state} />
        ) : tab === "logs" ? (
          <LogsPage state={state} />
        ) : (
          <SettingsPage state={state} />
        )}
      </main>
    </div>
  );
}
