import { useEffect, useState } from "react";
import {
  COMMENT_LANGUAGE_LABELS,
  type AppState,
  type ChannelProfile,
  type CommentLanguage,
  type PlatformId,
} from "@/core/types";
import { sendCommand } from "@/core/rpc";
import { createBlankProfile } from "@/core/profiles";

const PLATFORM_LABELS: Record<PlatformId, string> = {
  tiktok: "TikTok",
  youtube: "YouTube",
};

export function ChannelsPage({ state }: { state: AppState }) {
  const [selectedId, setSelectedId] = useState<string | null>(state.profiles[0]?.id ?? null);
  const [draft, setDraft] = useState<ChannelProfile | null>(null);

  const selected =
    state.profiles.find((p) => p.id === selectedId) ?? state.profiles[0] ?? null;

  useEffect(() => {
    setDraft((prev) => (prev && prev.id === selected?.id ? prev : selected ? { ...selected } : null));
  }, [selected]);

  const addChannel = async (platform: PlatformId) => {
    const id = `ch-${Date.now()}`;
    const count = state.profiles.filter((p) => p.platform === platform).length + 1;
    await sendCommand({
      type: "SAVE_PROFILE",
      profile: createBlankProfile(id, `${PLATFORM_LABELS[platform]} ${count}`, platform),
    });
    setSelectedId(id);
  };

  if (!draft) {
    return (
      <section className="stack">
        <p className="muted">Chưa có kênh nào.</p>
        <div className="row">
          <button onClick={() => void addChannel("tiktok")}>+ Kênh TikTok</button>
          <button onClick={() => void addChannel("youtube")}>+ Kênh YouTube</button>
        </div>
      </section>
    );
  }

  const set = <K extends keyof ChannelProfile>(key: K, value: ChannelProfile[K]) =>
    setDraft({ ...draft, [key]: value });

  const isYouTube = draft.platform === "youtube";

  return (
    <section className="stack">
      <div className="row">
        <label className="field">
          <span>Sửa kênh</span>
          <select value={selected?.id ?? ""} onChange={(e) => setSelectedId(e.target.value)}>
            {state.profiles.map((p) => (
              <option key={p.id} value={p.id}>
                [{PLATFORM_LABELS[p.platform]}] {p.name}
              </option>
            ))}
          </select>
        </label>
        <button className="ghost" onClick={() => void addChannel("tiktok")}>
          + TikTok
        </button>
        <button className="ghost" onClick={() => void addChannel("youtube")}>
          + YouTube
        </button>
      </div>

      <div className="row">
        <label className="field">
          <span>Tên kênh</span>
          <input value={draft.name} onChange={(e) => set("name", e.target.value)} />
        </label>
        <label className="field">
          <span>Nền tảng</span>
          <input value={PLATFORM_LABELS[draft.platform]} disabled />
        </label>
        <label className="field">
          <span>Ngôn ngữ comment</span>
          <select
            value={draft.commentLanguage}
            onChange={(e) => set("commentLanguage", e.target.value as CommentLanguage)}
          >
            {(Object.keys(COMMENT_LANGUAGE_LABELS) as CommentLanguage[]).map((lang) => (
              <option key={lang} value={lang}>
                {COMMENT_LANGUAGE_LABELS[lang]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="field">
        <span>Chủ đề kênh — AI dùng để xét video có hợp hay không (mô tả tự nhiên)</span>
        <textarea
          rows={3}
          placeholder="VD: Bất cứ thứ gì liên quan tiếng Anh — IELTS, từ vựng, ngữ pháp, phát âm, giao tiếp…"
          value={draft.topic}
          onChange={(e) => set("topic", e.target.value)}
        />
      </label>

      <label className="field">
        <span>
          {isYouTube
            ? "Từ khoá (fallback nếu ô Nguồn trống)"
            : "Từ khoá (chỉ dùng cho job Follow; comment do AI xét)"}
        </span>
        <textarea
          rows={2}
          value={draft.keywords.join(", ")}
          onChange={(e) =>
            set(
              "keywords",
              e.target.value
                .split(",")
                .map((k) => k.trim())
                .filter(Boolean),
            )
          }
        />
      </label>

      <label className="field">
        <span>System prompt (sinh comment)</span>
        <textarea
          rows={8}
          value={draft.systemPrompt}
          onChange={(e) => set("systemPrompt", e.target.value)}
        />
      </label>

      <label className="field">
        <span>
          {isYouTube
            ? "Câu tìm kiếm YouTube (mỗi dòng 1 query, vd: ielts speaking tips)"
            : "Nguồn bình luận (trống = For You; mỗi dòng 1 @user / #hashtag / URL)"}
        </span>
        <textarea
          rows={3}
          value={draft.sources.join("\n")}
          onChange={(e) =>
            set(
              "sources",
              e.target.value
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean),
            )
          }
        />
      </label>

      <fieldset className="field">
        <legend>Lịch chạy</legend>
        <div className="row">
          <label className="field">
            <span>Giãn cách tối thiểu (phút)</span>
            <input
              type="number"
              min={1}
              value={draft.schedule.minMinutes}
              onChange={(e) =>
                set("schedule", { ...draft.schedule, minMinutes: Number(e.target.value) || 1 })
              }
            />
          </label>
          <label className="field">
            <span>Giãn cách tối đa (phút)</span>
            <input
              type="number"
              min={1}
              value={draft.schedule.maxMinutes}
              onChange={(e) =>
                set("schedule", { ...draft.schedule, maxMinutes: Number(e.target.value) || 1 })
              }
            />
          </label>
        </div>
      </fieldset>

      <div className="row">
        <button className="primary" onClick={() => void sendCommand({ type: "SAVE_PROFILE", profile: draft })}>
          Lưu kênh
        </button>
        {state.profiles.length > 1 && (
          <button
            className="danger"
            onClick={() => void sendCommand({ type: "DELETE_PROFILE", id: draft.id })}
          >
            Xoá kênh
          </button>
        )}
      </div>
    </section>
  );
}
