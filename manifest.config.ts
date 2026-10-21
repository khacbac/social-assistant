import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json" with { type: "json" };

const TIKTOK_MATCHES = [
  "https://www.tiktok.com/*",
  "https://tiktok.com/*",
  "https://*.tiktok.com/*",
];

export default defineManifest({
  manifest_version: 3,
  name: "Social Assistant",
  version: pkg.version,
  description: pkg.description,
  icons: {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png",
  },
  action: {
    default_title: "Social Assistant",
  },
  background: {
    service_worker: "src/background/index.ts",
    type: "module",
  },
  options_ui: {
    page: "index.html",
    open_in_tab: true,
  },
  permissions: ["storage", "alarms", "tabs", "scripting", "debugger"],
  host_permissions: [...TIKTOK_MATCHES, "https://api.anthropic.com/*"],
  content_scripts: [
    {
      matches: TIKTOK_MATCHES,
      js: ["src/platforms/tiktok/content/index.ts"],
      run_at: "document_idle",
    },
    {
      matches: TIKTOK_MATCHES,
      js: ["src/platforms/tiktok/page/typer.iife.ts"],
      run_at: "document_start",
      world: "MAIN",
    },
  ],
});
