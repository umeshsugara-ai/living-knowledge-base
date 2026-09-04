/**
 * apps/web/src/api/client.ts — one shared fetch wrapper. Reads the API base URL from Vite's env
 * (`VITE_API_BASE_URL`, defaults to same-origin `""` for the Docker/prod case where apps/web is
 * served behind the same reverse proxy as apps/api; dev mode points it at apps/api's real port).
 * Attaches Authorization: Bearer, throws a typed ApiError on any non-2xx so callers can render a
 * real error state instead of guessing from a thrown generic Error.
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(path: string, apiKey: string | null): Promise<T> {
  if (!apiKey) throw new ApiError(401, "no API key set");
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // response wasn't JSON; keep the generic message
    }
    throw new ApiError(res.status, message);
  }
  return res.json() as Promise<T>;
}
