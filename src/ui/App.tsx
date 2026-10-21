import { useState } from "react";
import { useAppState } from "./useAppState";
import { ChannelsPage } from "./pages/ChannelsPage";
import { PlatformJobsPage, type JobDef } from "./pages/PlatformJobsPage";
import { LogsPage } from "./pages/LogsPage";
import { SettingsPage } from "./pages/SettingsPage";

type Tab = "channels" | "tiktok" | "youtube" | "logs" | "settings";

const TABS: { id: Tab; label: string }[] = [
  { id: "channels", label: "Kênh" },
  { id: "tiktok", label: "TikTok" },
  { id: "youtube", label: "YouTube" },
  { id: "logs", label: "Nhật ký" },
  { id: "settings", label: "Cài đặt" },
];

const TIKTOK_JOBS: JobDef[] = [
  { kind: "comment", label: "Bình luận AI", desc: "Lọc video hợp chủ đề (Haiku) → bình luận." },
  { kind: "scroll", label: "Lướt & thả tim", desc: "Lướt For You và thả tim tự nhiên." },
  { kind: "follow", label: "Follow", desc: "Tự follow creator hợp chủ đề trên For You." },
];

const YOUTUBE_JOBS: JobDef[] = [
  { kind: "comment", label: "Bình luận AI", desc: "Tìm theo từ khoá → Haiku xét → bình luận." },
  { kind: "like", label: "Like video", desc: "Tìm theo từ khoá và like video." },
  { kind: "subscribe", label: "Subscribe", desc: "Subscribe kênh của video hợp chủ đề." },
];

export function App() {
  const [tab, setTab] = useState<Tab>("channels");
  const state = useAppState();

  return (
    <div className="app">
      <header className="app__header">
        <h1>Social Assistant</h1>
        <span className="app__sub">Trợ lý tương tác bằng nick của bạn · TikTok + YouTube</span>
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
          <PlatformJobsPage state={state} platform="tiktok" jobs={TIKTOK_JOBS} />
        ) : tab === "youtube" ? (
          <PlatformJobsPage state={state} platform="youtube" jobs={YOUTUBE_JOBS} />
        ) : tab === "logs" ? (
          <LogsPage state={state} />
        ) : (
          <SettingsPage state={state} />
        )}
      </main>
    </div>
  );
}
