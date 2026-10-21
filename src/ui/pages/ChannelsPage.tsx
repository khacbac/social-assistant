import { useEffect, useState } from "react";
import {
  COMMENT_LANGUAGE_LABELS,
  type AppState,
  type ChannelProfile,
  type CommentLanguage,
} from "@/core/types";
import { sendCommand } from "@/core/rpc";
import { createBlankProfile } from "@/core/profiles";

export function ChannelsPage({ state }: { state: AppState }) {
  const [draft, setDraft] = useState<ChannelProfile | null>(null);

  const active =
    state.profiles.find((p) => p.id === state.activeProfileId) ??
    state.profiles[0] ??
    null;

  // Đồng bộ draft khi đổi kênh active (giữ chỉnh sửa dở nếu cùng id).
  useEffect(() => {
    setDraft((prev) => (prev && prev.id === active?.id ? prev : active ? { ...active } : null));
  }, [active]);

  if (!draft) {
    return (
      <section>
        <p className="muted">Chưa có kênh nào.</p>
        <button onClick={() => void addChannel(state)}>+ Thêm kênh</button>
      </section>
    );
  }

  const set = <K extends keyof ChannelProfile>(key: K, value: ChannelProfile[K]) =>
    setDraft({ ...draft, [key]: value });

  return (
    <section className="stack">
      <div className="row">
        <label className="field">
          <span>Kênh đang hoạt động</span>
          <select
            value={state.activeProfileId ?? ""}
            onChange={(e) =>
              void sendCommand({ type: "SET_ACTIVE_PROFILE", id: e.target.value })
            }
          >
            {state.profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <button className="ghost" onClick={() => void addChannel(state)}>
          + Thêm kênh
        </button>
      </div>

      <div className="row">
        <label className="field">
          <span>Tên kênh</span>
          <input value={draft.name} onChange={(e) => set("name", e.target.value)} />
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
        <span>Từ khoá lọc video (cách nhau dấu phẩy)</span>
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
        <span>Điểm liên quan tối thiểu (số từ khoá khớp)</span>
        <input
          type="number"
          min={1}
          value={draft.minRelevanceScore}
          onChange={(e) => set("minRelevanceScore", Math.max(1, Number(e.target.value) || 1))}
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
        <span>Nguồn bình luận (trống = For You; mỗi dòng 1 @user / #hashtag / URL)</span>
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

      <label className="field">
        <span>Tài khoản để follow (mỗi dòng 1 @user hoặc link trang TikTok)</span>
        <textarea
          rows={3}
          placeholder="@username1&#10;@username2"
          value={draft.followTargets.join("\n")}
          onChange={(e) =>
            set(
              "followTargets",
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
        <button onClick={() => void sendCommand({ type: "SAVE_PROFILE", profile: draft })}>
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

async function addChannel(state: AppState): Promise<void> {
  const id = `ch-${Date.now()}`;
  const profile = createBlankProfile(id, `Kênh ${state.profiles.length + 1}`);
  await sendCommand({ type: "SAVE_PROFILE", profile });
  await sendCommand({ type: "SET_ACTIVE_PROFILE", id });
}
