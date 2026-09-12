import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { apiFetch, AUTH_INVALIDATED_EVENT, AUTH_KEY_STORAGE_KEY, ApiError } from "./client.js";

describe("apiFetch", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("clears cached API key and emits AUTH_INVALIDATED_EVENT for 401", async () => {
    localStorage.setItem(AUTH_KEY_STORAGE_KEY, "invalid-key");
    const dispatchEventSpy = vi.spyOn(window, "dispatchEvent");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "invalid api key" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    await expect(apiFetch("/sessions", "invalid-key")).rejects.toBeInstanceOf(ApiError);
    expect(localStorage.getItem(AUTH_KEY_STORAGE_KEY)).toBeNull();
    expect(dispatchEventSpy).toHaveBeenCalledTimes(1);
    const event = dispatchEventSpy.mock.calls[0]?.[0];
    expect(event).toBeInstanceOf(CustomEvent);
    expect((event as CustomEvent).type).toBe(AUTH_INVALIDATED_EVENT);
    expect((event as CustomEvent<{ apiKey: string }>).detail.apiKey).toBe("invalid-key");
  });

  test("does not clear cached API key for 403", async () => {
    localStorage.setItem(AUTH_KEY_STORAGE_KEY, "forbidden-key");
    const dispatchEventSpy = vi.spyOn(window, "dispatchEvent");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "forbidden" }), {
          status: 403,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    await expect(apiFetch("/sessions", "forbidden-key")).rejects.toBeInstanceOf(ApiError);
    expect(localStorage.getItem(AUTH_KEY_STORAGE_KEY)).toBe("forbidden-key");
    expect(dispatchEventSpy).not.toHaveBeenCalled();
  });
});

