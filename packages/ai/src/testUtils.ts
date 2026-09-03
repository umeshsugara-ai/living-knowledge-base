/**
 * packages/ai/src/testUtils.ts — one shared fake-transport helper for every *.test.ts file in
 * this package (contract C7: adapters are tested with fake transports, never a real network/CLI
 * call). Not itself a test — imported by them.
 */
import type { Transport, TransportRequest, TransportResponse } from "./provider.js";

export interface FakeTransport extends Transport {
  calls: TransportRequest[];
}

/**
 * Returns a `Transport` that records every call and answers from `responses` in order (the
 * last response repeats once the queue is exhausted). A response may be a plain
 * `TransportResponse` or a function of the request, for cases that need to vary by call.
 */
export function fakeTransport(
  ...responses: (TransportResponse | ((req: TransportRequest) => TransportResponse))[]
): FakeTransport {
  const calls: TransportRequest[] = [];
  const transport = (async (req: TransportRequest) => {
    calls.push(req);
    const idx = Math.min(calls.length - 1, responses.length - 1);
    const answer = responses[idx];
    if (!answer) throw new Error("fakeTransport: no response configured");
    return typeof answer === "function" ? answer(req) : answer;
  }) as FakeTransport;
  transport.calls = calls;
  return transport;
}

/** A transport that always rejects — for exercising provider-failure / fallback paths. */
export function failingTransport(message = "simulated transport failure"): FakeTransport {
  const calls: TransportRequest[] = [];
  const transport = Object.assign(
    async (req: TransportRequest): Promise<TransportResponse> => {
      calls.push(req);
      throw new Error(message);
    },
    { calls },
  );
  return transport;
}
