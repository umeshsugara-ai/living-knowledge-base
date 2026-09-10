import { describe, test, expect, vi } from "vitest";
import * as client from "./client.js";
import { getSession } from "./sessions.js";

describe("sessions API", () => {
  test("normalizes pre-encoded session ids before calling apiFetch", async () => {
    const apiFetchSpy = vi.spyOn(client, "apiFetch").mockResolvedValue({ session: null } as never);
    await getSession("lkb-test-key", "abc%2Fdef");
    expect(apiFetchSpy).toHaveBeenCalledWith("/sessions/abc%2Fdef", "lkb-test-key");
    apiFetchSpy.mockRestore();
  });

  test("encodes raw ids that include reserved characters", async () => {
    const apiFetchSpy = vi.spyOn(client, "apiFetch").mockResolvedValue({ session: null } as never);
    await getSession("lkb-test-key", "abc/def");
    expect(apiFetchSpy).toHaveBeenCalledWith("/sessions/abc%2Fdef", "lkb-test-key");
    apiFetchSpy.mockRestore();
  });

  test("keeps malformed percent-encoding from crashing by encoding raw input", async () => {
    const apiFetchSpy = vi.spyOn(client, "apiFetch").mockResolvedValue({ session: null } as never);
    await getSession("lkb-test-key", "%");
    expect(apiFetchSpy).toHaveBeenCalledWith("/sessions/%25", "lkb-test-key");
    apiFetchSpy.mockRestore();
  });
});

