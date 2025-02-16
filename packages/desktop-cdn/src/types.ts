export interface Env {
  LOG_SCOPES?: string; // Comma-separated scopes to log, * - all
  R2_BUCKET: R2Bucket; // R2 client instance
}

export type ParsedRange =
  | { offset: number; length: number }
  | { suffix: number };

export const supportedPlatforms = ["linux", "mac", "windows"] as const;
export type PlatformName = (typeof supportedPlatforms)[number];
