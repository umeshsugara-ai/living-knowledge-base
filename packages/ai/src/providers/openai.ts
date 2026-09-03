/**
 * packages/ai/src/providers/openai.ts — T-019 C2. OpenAI adapter (chain member per D-008's
 * no-single-AI-dependency rule). Calls the Chat Completions REST endpoint through the injected
 * `transport`; no real network call in tests (C2).
 */
import type { CompleteResult, Job, ModelInfo, Provider, Transport } from "../provider.js";

/** Static-but-labeled manifest (C3) — refresh via https://platform.openai.com/docs/models. */
export const OPENAI_MODELS: ModelInfo[] = [
  { id: "gpt-5.1", label: "GPT-5.1" },
  { id: "gpt-5.1-mini", label: "GPT-5.1 Mini" },
  { id: "gpt-5.1-nano", label: "GPT-5.1 Nano" },
];

const DEFAULT_MODEL = "gpt-5.1-mini";
const API_URL = "https://api.openai.com/v1/chat/completions";

export interface OpenAiConfig {
  apiKey: string;
  model?: string;
}

export class OpenAiProvider implements Provider {
  readonly name = "openai";

  constructor(
    private readonly transport: Transport,
    private readonly config: OpenAiConfig,
  ) {}

  async complete(job: Job): Promise<CompleteResult> {
    const model = this.config.model ?? DEFAULT_MODEL;
    const res = await this.transport({
      kind: "http",
      url: API_URL,
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.config.apiKey}`,
      },
      body: {
        model,
        messages: job.messages.map((m) => ({ role: m.role, content: m.content })),
      },
    });

    if (res.status < 200 || res.status >= 300) {
      throw new Error(`openai API error ${res.status}: ${JSON.stringify(res.body)}`);
    }

    const body = res.body as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const text = body.choices?.[0]?.message?.content ?? "";

    return {
      text,
      usage: {
        inputTokens: body.usage?.prompt_tokens ?? 0,
        outputTokens: body.usage?.completion_tokens ?? 0,
      },
      provider: this.name,
      model,
      costUsd: 0,
    };
  }

  async listModels(): Promise<ModelInfo[]> {
    return OPENAI_MODELS;
  }
}
