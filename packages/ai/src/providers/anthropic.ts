/**
 * packages/ai/src/providers/anthropic.ts — T-019 C2. Supports both an API-key mode (Messages
 * API, feature-flagged off by default per D-005: "Anthropic Messages API is optional behind a
 * feature flag") and an OAuth/Claude-Code-login mode (D-008). The OAuth mode delegates to
 * `claude-code.ts`'s `runClaudeCodePrompt` rather than reimplementing CLI invocation — one
 * implementation of "talk to Claude via the CLI login", not two.
 */
import type { CompleteResult, Job, ModelInfo, Provider, Transport } from "../provider.js";
import { CLAUDE_CODE_MODELS, runClaudeCodePrompt } from "./claude-code.js";

export type AnthropicMode = "api-key" | "oauth";

/** Static-but-labeled manifest (C3) — refresh via https://docs.anthropic.com/en/docs/about-claude/models. */
export const ANTHROPIC_MODELS: ModelInfo[] = [
  { id: "claude-opus-4-1-20250805", label: "Claude Opus 4.1" },
  { id: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5" },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
];

const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";
const API_URL = "https://api.anthropic.com/v1/messages";

export interface AnthropicConfig {
  mode: AnthropicMode;
  /** required when mode === "api-key" */
  apiKey?: string;
  model?: string;
}

export class AnthropicProvider implements Provider {
  readonly name = "anthropic";

  constructor(
    private readonly transport: Transport,
    private readonly config: AnthropicConfig,
  ) {
    if (config.mode === "api-key" && !config.apiKey) {
      throw new Error("AnthropicProvider: mode 'api-key' requires config.apiKey");
    }
  }

  async complete(job: Job): Promise<CompleteResult> {
    const model = this.config.model ?? DEFAULT_MODEL;
    if (this.config.mode === "oauth") {
      return runClaudeCodePrompt(this.transport, job, model, this.name);
    }
    return this.completeApiKey(job, model);
  }

  private async completeApiKey(job: Job, model: string): Promise<CompleteResult> {
    const res = await this.transport({
      kind: "http",
      url: API_URL,
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.config.apiKey ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: {
        model,
        max_tokens: 4096,
        messages: job.messages
          .filter((m) => m.role !== "system")
          .map((m) => ({ role: m.role, content: m.content })),
        system: job.messages.find((m) => m.role === "system")?.content,
      },
    });

    if (res.status < 200 || res.status >= 300) {
      throw new Error(`anthropic API error ${res.status}: ${JSON.stringify(res.body)}`);
    }

    const body = res.body as {
      content?: { type: string; text?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const text = (body.content ?? []).map((c) => c.text ?? "").join("");

    return {
      text,
      usage: {
        inputTokens: body.usage?.input_tokens ?? 0,
        outputTokens: body.usage?.output_tokens ?? 0,
      },
      provider: this.name,
      model,
      costUsd: 0,
    };
  }

  async listModels(): Promise<ModelInfo[]> {
    if (this.config.mode === "oauth") return CLAUDE_CODE_MODELS;
    return ANTHROPIC_MODELS;
  }
}
