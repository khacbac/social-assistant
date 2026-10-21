import { useEffect, useState } from "react";
import { getState, onStateChange } from "@/core/storage";
import type { AppState } from "@/core/types";

/** Hook đọc AppState từ storage và tự cập nhật khi state đổi. */
export function useAppState(): AppState | null {
  const [state, setState] = useState<AppState | null>(null);
  useEffect(() => {
    let alive = true;
    void getState().then((s) => {
      if (alive) setState(s);
    });
    const off = onStateChange((s) => setState(s));
    return () => {
      alive = false;
      off();
    };
  }, []);
  return state;
}
