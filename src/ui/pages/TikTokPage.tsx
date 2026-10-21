import type { AppState, JobKind } from "@/core/types";
import { sendCommand } from "@/core/rpc";

const JOBS: { kind: JobKind; label: string; desc: string }[] = [
  { kind: "comment", label: "Bình luận AI", desc: "Lọc video đúng chủ đề → Haiku sinh comment → đăng." },
  { kind: "scroll", label: "Lướt & thả tim", desc: "Lướt For You và thả tim tự nhiên." },
  { kind: "follow", label: "Follow", desc: "Follow các tài khoản trong nguồn của kênh." },
];

export function TikTokPage({ state }: { state: AppState }) {
  const rt = state.runtime.tiktok;
  const active = state.profiles.find((p) => p.id === state.activeProfileId);

  return (
    <section className="stack">
      <p className="muted">
        Kênh đang chạy: <strong>{active?.name ?? "—"}</strong>. Đổi kênh ở tab Kênh.
      </p>
      {JOBS.map((job) => {
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
              <p className="muted">
                Lượt kế tiếp: {new Date(j.nextAt).toLocaleString("vi-VN")}
              </p>
            )}
            <div className="row">
              <button
                onClick={() =>
                  void sendCommand({ type: "RUN_ONCE", platform: "tiktok", kind: job.kind })
                }
              >
                Chạy thử 1 lần
              </button>
              {j.enabled ? (
                <button
                  className="danger"
                  onClick={() =>
                    void sendCommand({ type: "STOP_JOB", platform: "tiktok", kind: job.kind })
                  }
                >
                  Tắt lịch
                </button>
              ) : (
                <button
                  className="primary"
                  onClick={() =>
                    void sendCommand({ type: "START_JOB", platform: "tiktok", kind: job.kind })
                  }
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
