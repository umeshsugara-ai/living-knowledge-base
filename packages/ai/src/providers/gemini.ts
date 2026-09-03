/**
 * packages/ai/src/providers/gemini.ts — T-019 C2. Gemini adapter (D-005: default first
 * provider — "purchased Gemini API tokens carry 80-90% of the load"). Calls the
 * `generateContent` REST endpoint through the injected `transport`; no real network call in
 * tests (C2).
 */
import type { CompleteResult, Job, ModelInfo, Provider, Transport } from "../provider.js";

/** Static-but-labeled manifest (C3) — refresh via https://ai.google.dev/gemini-api/docs/models. */
export const GEMINI_MODELS: ModelInfo[] = [
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite" },
];

const DEFAULT_MODEL = "gemini-2.5-flash";

function roleToGemini(role: string): string {
  return role === "assistant" ? "model" : "user";
}

export interface GeminiConfig {
  apiKey: string;
  model?: string;
}

export class GeminiProvider implements Provider {
  readonly name = "gemini";

  constructor(
    private readonly transport: Transport,
    private readonly config: GeminiConfig,
  ) {}

  async complete(job: Job): Promise<CompleteResult> {
    const model = this.config.model ?? DEFAULT_MODEL;
    const systemMessages = job.messages.filter((m) => m.role === "system");
    const turnMessages = job.messages.filter((m) => m.role !== "system");

    const res = await this.transport({
      kind: "http",
      url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.config.apiKey}`,
      method: "POST",
      headers: { "content-type": "application/json" },
      body: {
        contents: turnMessages.map((m) => ({
          role: roleToGemini(m.role),
          parts: [{ text: m.content }],
        })),
        systemInstruction: systemMessages.length
          ? { parts: systemMessages.map((m) => ({ text: m.content })) }
          : undefined,
      },
    });

    if (res.status < 200 || res.status >= 300) {
      throw new Error(`gemini API error ${res.status}: ${JSON.stringify(res.body)}`);
    }

    const body = res.body as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };
    const text = (body.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");

    return {
      text,
      usage: {
        inputTokens: body.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: body.usageMetadata?.candidatesTokenCount ?? 0,
      },
      provider: this.name,
      model,
      costUsd: 0,
    };
  }

  async listModels(): Promise<ModelInfo[]> {
    return GEMINI_MODELS;
  }
}
