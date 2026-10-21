import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import { fileURLToPath, URL } from "node:url";
import manifest from "./manifest.config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  plugins: [react(), crx({ manifest })],
  server: {
    // CRXJS HMR cho content scripts cần cổng cố định
    port: 5173,
    strictPort: true,
    hmr: { port: 5173 },
  },
  build: {
    target: "esnext",
    rollupOptions: {
      // tiktok-page chạy ở MAIN world, inject qua web_accessible_resources
      input: {},
    },
  },
});
