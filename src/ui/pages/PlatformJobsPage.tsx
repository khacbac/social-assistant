import type { AppState, JobKind, PlatformId } from "@/core/types";
import { sendCommand } from "@/core/rpc";

export interface JobDef {
  kind: JobKind;
  label: string;
  desc: string;
}

export function PlatformJobsPage({
  state,
  platform,
  jobs,
}: {
  state: AppState;
  platform: PlatformId;
  jobs: JobDef[];
}) {
  const rt = state.runtime[platform];
  const channels = state.profiles.filter((p) => p.platform === platform);
  const activeId = state.activeProfileId[platform];

  if (channels.length === 0) {
    return (
      <section className="stack">
        <p className="muted">
          Chưa có kênh {platform} nào. Qua tab <strong>Kênh</strong> tạo một kênh trước.
        </p>
      </section>
    );
  }

  return (
    <section className="stack">
      <label className="field">
        <span>Kênh đang chạy</span>
        <select
          value={activeId ?? ""}
          onChange={(e) => void sendCommand({ type: "SET_ACTIVE_PROFILE", id: e.target.value })}
        >
          <option value="" disabled>
            — chọn kênh —
          </option>
          {channels.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      {!activeId && <p className="muted">Hãy chọn kênh đang chạy để bật job.</p>}

      {jobs.map((job) => {
        const j = rt[job.kind];
        return (
          <div key={job.kind} className="card">
            <div className="card__head">
              <div>
                <strong>{job.label}</strong>
                <p className="muted">{job.desc}</p>
              </div>
              <span className={`badge ${j.enabled ? "on" : ""}`}>
                {j.enabled ? "Đang bật lịch" : "Tắt"}
              </span>
            </div>
            {j.nextAt && (
              <p className="muted">Lượt kế tiếp: {new Date(j.nextAt).toLocaleString("vi-VN")}</p>
            )}
            <div className="row">
              <button
                onClick={() => void sendCommand({ type: "RUN_ONCE", platform, kind: job.kind })}
              >
                Chạy thử 1 lần
              </button>
              {j.enabled ? (
                <button
                  className="danger"
                  onClick={() => void sendCommand({ type: "STOP_JOB", platform, kind: job.kind })}
                >
                  Tắt lịch
                </button>
              ) : (
                <button
                  className="primary"
                  onClick={() => void sendCommand({ type: "START_JOB", platform, kind: job.kind })}
                >
                  Bật lịch
                </button>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}
