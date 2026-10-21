import { defaultState, getState, setState, updateState } from "@/core/storage";
import { log } from "@/core/log";
import type { Command, CommandResult } from "@/core/rpc";
import { runJob } from "./job-runner";
import { handleAlarm, startJob, stopJob } from "./scheduler";

const STORAGE_KEY = "social-assistant:state";

// Khởi tạo state lần đầu cài đặt.
chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  if (!stored[STORAGE_KEY]) {
    await setState(defaultState());
    await log("info", "Social Assistant đã cài đặt. Kênh mẫu: IELTS.");
  }
});

// Alarm -> chạy job.
chrome.alarms.onAlarm.addListener((alarm) => {
  void handleAlarm(alarm.name);
});

// Lệnh từ UI.
chrome.runtime.onMessage.addListener((msg: Command, _sender, sendResponse) => {
  handleCommand(msg)
    .then(sendResponse)
    .catch((err: Error) => sendResponse({ ok: false, error: err.message }));
  return true; // phản hồi bất đồng bộ
});

async function handleCommand(cmd: Command): Promise<CommandResult> {
  switch (cmd.type) {
    case "RUN_ONCE":
      void runJob(cmd.platform, cmd.kind);
      return { ok: true };

    case "START_JOB": {
      const state = await getState();
      const profile = state.profiles.find(
        (p) => p.id === state.activeProfileId && p.platform === cmd.platform,
      );
      if (!profile) return { ok: false, error: "Chưa chọn kênh hoạt động." };
      await startJob(cmd.platform, cmd.kind, profile.schedule);
      return { ok: true };
    }

    case "STOP_JOB":
      await stopJob(cmd.platform, cmd.kind);
      return { ok: true };

    case "SAVE_PROFILE":
      await updateState((draft) => {
        const idx = draft.profiles.findIndex((p) => p.id === cmd.profile.id);
        if (idx >= 0) draft.profiles[idx] = cmd.profile;
        else draft.profiles.push(cmd.profile);
      });
      return { ok: true };

    case "DELETE_PROFILE":
      await updateState((draft) => {
        draft.profiles = draft.profiles.filter((p) => p.id !== cmd.id);
        if (draft.activeProfileId === cmd.id) {
          draft.activeProfileId = draft.profiles[0]?.id ?? null;
        }
      });
      return { ok: true };

    case "SET_ACTIVE_PROFILE":
      await updateState((draft) => {
        draft.activeProfileId = cmd.id;
      });
      return { ok: true };

    case "SAVE_AI":
      await updateState((draft) => {
        draft.ai = cmd.ai;
      });
      return { ok: true };

    case "CLEAR_LOGS":
      await updateState((draft) => {
        draft.logs = [];
      });
      return { ok: true };

    default: {
      const _exhaustive: never = cmd;
      return { ok: false, error: `Lệnh không hỗ trợ: ${JSON.stringify(_exhaustive)}` };
    }
  }
}
