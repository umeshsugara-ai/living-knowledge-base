/**
 * packages/ai/src/providers/ollama.ts — T-019 C2/C3. Local Ollama adapter (chain member per
 * D-008's no-single-AI-dependency rule — the offline/local option). `listModels()` is the one
 * adapter whose manifest is a REAL transport call, shaped like Ollama's local `/api/tags`
 * endpoint (C3), still injectable so tests use a fake.
 */
import type { CompleteResult, Job, ModelInfo, Provider, Transport } from "../provider.js";

const DEFAULT_MODEL = "llama3.1";
const DEFAULT_BASE_URL = "http://localhost:11434";

export interface OllamaConfig {
  baseUrl?: string;
  model?: string;
}

export class OllamaProvider implements Provider {
  readonly name = "ollama";
  private readonly baseUrl: string;

  constructor(
    private readonly transport: Transport,
    private readonly config: OllamaConfig = {},
  ) {
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  }

  async complete(job: Job): Promise<CompleteResult> {
    const model = this.config.model ?? DEFAULT_MODEL;
    const res = await this.transport({
      kind: "http",
      url: `${this.baseUrl}/api/chat`,
      method: "POST",
      headers: { "content-type": "application/json" },
      body: {
        model,
        stream: false,
        messages: job.messages.map((m) => ({ role: m.role, content: m.content })),
      },
    });

    if (res.status < 200 || res.status >= 300) {
      throw new Error(`ollama API error ${res.status}: ${JSON.stringify(res.body)}`);
    }

    const body = res.body as {
      message?: { content?: string };
      prompt_eval_count?: number;
      eval_count?: number;
    };

    return {
      text: body.message?.content ?? "",
      usage: {
        inputTokens: body.prompt_eval_count ?? 0,
        outputTokens: body.eval_count ?? 0,
      },
      provider: this.name,
      model,
      costUsd: 0,
    };
  }

  /** Calls the local /api/tags-shaped transport for a live model manifest (C3). */
  async listModels(): Promise<ModelInfo[]> {
    const res = await this.transport({
      kind: "http",
      url: `${this.baseUrl}/api/tags`,
      method: "GET",
    });

    if (res.status < 200 || res.status >= 300) {
      throw new Error(`ollama /api/tags error ${res.status}: ${JSON.stringify(res.body)}`);
    }

    const body = res.body as { models?: { name?: string }[] };
    return (body.models ?? [])
      .filter((m): m is { name: string } => typeof m.name === "string")
      .map((m) => ({ id: m.name, label: m.name }));
  }
}
