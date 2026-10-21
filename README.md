# Social Assistant

Trợ lý tương tác mạng xã hội bằng **chính tài khoản của bạn**, tăng tương tác tự nhiên.
Chrome Extension (Manifest V3). Kiến trúc đa nền tảng, **v1 bắt đầu với TikTok**.

> Mục tiêu: lướt feed đúng chủ đề (lọc từ khoá theo từng "kênh"), sinh bình luận bằng
> Claude Haiku, gõ như người thật, có giãn cách ngẫu nhiên và lịch chạy.

## Stack

- TypeScript + Vite + [@crxjs/vite-plugin](https://crxjs.dev) (MV3)
- React (trang quản lý)
- Claude **Haiku** (`claude-haiku-5-5`) qua Anthropic Messages API

## Chạy dev

```bash
npm install
npm run dev          # Vite + HMR, in ra thư mục dist/ cho CRXJS
```

Rồi: Chrome → `chrome://extensions` → bật Developer mode → **Load unpacked** → chọn thư mục `dist/`.

## Build

```bash
npm run build        # typecheck + đóng gói vào dist/
```

## Cấu trúc

```
src/
├─ background/    # service worker: scheduler (alarms), job-runner, messaging
├─ platforms/
│  ├─ types.ts    # PlatformAdapter, JobRunner
│  ├─ registry.ts
│  └─ tiktok/     # selectors + content (isolated) + page/typer (MAIN world)
├─ ai/            # anthropic (Haiku), prompts, relevance (lọc từ khoá mềm)
├─ core/          # types, storage, profiles, log, humanize, rpc
└─ ui/            # React: Kênh / TikTok / Nhật ký / Cài đặt
```

## Khái niệm chính

- **Channel Profile**: mỗi kênh một chủ đề, có bộ từ khoá lọc + system prompt riêng
  (seed sẵn kênh *IELTS*). Chọn kênh đang hoạt động để chạy.
- **Lọc từ khoá mềm** (`ai/relevance.ts`): chấm điểm caption theo từ khoá (không dấu),
  video đạt ngưỡng mới gọi AI → tiết kiệm và bám đúng chủ đề.

## Cấu hình

Tab **Cài đặt** → nhập Anthropic API key (lưu trong `chrome.storage.local`, chỉ dùng
để gọi Haiku). Quyền `debugger` dùng cho đường gõ comment "trusted" dự phòng — khi
dùng, tab TikTok cần hiển thị và không mở DevTools.

## Trạng thái

v1 scaffold: core + AI + UI đã chạy khung. Logic DOM TikTok (tìm video, gõ, đăng,
lướt, follow) sẽ hoàn thiện ở Milestone 3–4.
