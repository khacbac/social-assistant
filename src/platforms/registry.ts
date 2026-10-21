import type { PlatformId } from "@/core/types";
import type { PlatformAdapter } from "./types";
import { tiktokAdapter } from "./tiktok/adapter";

const ADAPTERS: Record<PlatformId, PlatformAdapter> = {
  tiktok: tiktokAdapter,
};

export function getAdapter(platform: PlatformId): PlatformAdapter {
  return ADAPTERS[platform];
}

export function allAdapters(): PlatformAdapter[] {
  return Object.values(ADAPTERS);
}
