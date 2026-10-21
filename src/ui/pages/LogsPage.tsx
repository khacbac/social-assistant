import type { AppState } from "@/core/types";
import { sendCommand } from "@/core/rpc";

export function LogsPage({ state }: { state: AppState }) {
  return (
    <section className="stack">
      <div className="row">
        <button className="ghost" onClick={() => void sendCommand({ type: "CLEAR_LOGS" })}>
          Xoá nhật ký
        </button>
      </div>
      {state.logs.length === 0 ? (
        <p className="muted">Chưa có hoạt động nào.</p>
      ) : (
        <ul className="logs">
          {state.logs.map((entry, i) => (
            <li key={`${entry.at}-${i}`} className={`logs__item lvl-${entry.level}`}>
              <time>{new Date(entry.at).toLocaleTimeString("vi-VN")}</time>
              <span>{entry.message}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
