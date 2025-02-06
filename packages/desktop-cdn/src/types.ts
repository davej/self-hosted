export interface Env {
  LOG_SCOPES?: string; // Comma-separated scopes to log, * - all
  R2_BUCKET: R2Bucket; // R2 client instance
}

export type ParsedRange =
  | { offset: number; length: number }
  | { suffix: number };
