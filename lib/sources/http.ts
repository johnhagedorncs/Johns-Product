export type FetchLike = typeof fetch;

export const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const PRIVATE_HOST =
  /^(localhost|.*\.local|.*\.internal|0\.0\.0\.0|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|169\.254\.\d+\.\d+|\[?::1\]?|\[?f[cd][0-9a-f]{2}:.*)$/i;

/** Only public http(s) hosts — pasted links must not reach internal addresses. */
export function isPublicUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return /^https?:$/.test(parsed.protocol) && !PRIVATE_HOST.test(parsed.hostname);
  } catch {
    return false;
  }
}

async function request(url: string, fetchImpl: FetchLike, accept: string, timeoutMs: number) {
  if (!isPublicUrl(url)) throw new Error("That link is not a public web address.");
  const response = await fetchImpl(url, {
    headers: { "User-Agent": BROWSER_USER_AGENT, Accept: accept },
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response;
}

export async function fetchJson(url: string, fetchImpl: FetchLike, timeoutMs = 15000): Promise<unknown> {
  return (await request(url, fetchImpl, "application/json", timeoutMs)).json();
}

export async function fetchText(url: string, fetchImpl: FetchLike, timeoutMs = 15000): Promise<string> {
  return (await request(url, fetchImpl, "text/html,application/json;q=0.9,*/*;q=0.8", timeoutMs)).text();
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}
