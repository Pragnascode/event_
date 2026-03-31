const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export function getApiBase() {
  return API_BASE || window.location.origin;
}

export type ApiError = { error?: string } & Record<string, unknown>;

export async function apiFetch<T>(
  path: string,
  opts: {
    method?: "GET" | "POST" | "PUT";
    jwt?: string | null;
    body?: unknown;
    query?: Record<string, string | number | undefined>;
  } = {},
): Promise<T> {
  const { method = "GET", jwt, body, query } = opts;

  const base = API_BASE || window.location.origin;
  const url = new URL(base + path);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined) continue;
      url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url.toString(), {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let payload: ApiError | undefined;
    try {
      payload = (await res.json()) as ApiError;
    } catch {
      // ignore
    }
    const msg = payload?.error ?? `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return (await res.json()) as T;
}

