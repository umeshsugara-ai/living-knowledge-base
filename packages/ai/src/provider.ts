/**
 * packages/ai/src/provider.ts — T-019 C1. The ONE `Provider` interface every adapter under
 * `providers/*.ts` implements, plus the shared `Message`/`Job`/`CompleteResult` shapes and the
 * `Transport` seam every adapter's HTTP/CLI call goes through (ARCHITECTURE H10; contract
 * `qa/contracts/ai-provider-seam.md` C1-C2). No adapter re-declares these shapes — they import
 * from here.
 */

export type Role = "system" | "user" | "assistant" | "tool";

export interface Message {
  role: Role;
  content: string;
}

export interface Job {
  kind: string;
  messages: Message[];
  tools?: unknown[];
  schema?: unknown;
  maxCost?: number;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export interface CompleteResult {
  text: string;
  json?: unknown;
  usage: Usage;
  provider: string;
  model: string;
  costUsd: number;
}

export interface ModelInfo {
  id: string;
  label: string;
}

/**
 * One `Provider` per adapter. `complete` runs one job; `listModels` returns the provider's
 * dropdown manifest (C3 — static-but-labeled for gemini/openai/anthropic/claude-code, a real
 * transport call for ollama).
 */
export interface Provider {
  readonly name: string;
  complete(job: Job): Promise<CompleteResult>;
  listModels(): Promise<ModelInfo[]>;
}

/**
 * Every adapter's network/process call is injected as a `Transport` (C2) so tests never touch
 * a real network or spawn a real process — a fake transport returns a canned `TransportResponse`
 * instead. One shape covers both HTTP-style adapters (gemini/openai/anthropic/ollama) and
 * CLI-style adapters (claude-code) rather than declaring two seams.
 */
export interface TransportRequest {
  /** "http" for a fetch-shaped call, "cli" for a spawned-process call. */
  kind: "http" | "cli";
  /** http: full URL. */
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  /** cli: the binary to run (e.g. "claude") and its argv. */
  command?: string;
  args?: string[];
  stdin?: string;
}

export interface TransportResponse {
  /** http: HTTP status. cli: process exit code. */
  status: number;
  /** http: parsed JSON body (or raw text if not JSON). cli: parsed stdout JSON if parseable. */
  body: unknown;
  /** cli: raw stdout text; http: raw response text when not JSON. */
  text?: string;
}

export type Transport = (req: TransportRequest) => Promise<TransportResponse>;
