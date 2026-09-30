import type { FetchLike } from "@/lib/sources/http";

/** Fake fetch: first route whose substring matches the URL answers. */
export function fakeFetch(routes: Array<[string, unknown, number?]>): FetchLike & { calls: string[] } {
  const calls: string[] = [];
  const impl = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    const route = routes.find(([match]) => url.includes(match));
    if (!route) return new Response("not found", { status: 404 });
    const [, body, status = 200] = route;
    const text = typeof body === "string" ? body : JSON.stringify(body);
    return new Response(text, { status });
  }) as FetchLike & { calls: string[] };
  impl.calls = calls;
  return impl;
}
