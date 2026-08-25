import { TimeoutError } from './errors.js'

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export interface HttpRequestOptions {
  timeoutMs?: number
  fetchImpl?: FetchLike
  headers?: Record<string, string>
  signal?: AbortSignal
}

export const DEFAULT_TIMEOUT_MS = 5_000

function resolveFetch(fetchImpl?: FetchLike): FetchLike {
  if (fetchImpl) return fetchImpl
  return (input, init) => globalThis.fetch(input, init)
}

/**
 * `fetch` with a hard timeout that surfaces as a typed `TimeoutError`.
 *
 * A fresh `AbortController` is used rather than `AbortSignal.timeout` so the
 * timer can be cleared and the reason distinguished from a caller-side abort.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  options: HttpRequestOptions = {},
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const doFetch = resolveFetch(options.fetchImpl)
  const controller = new AbortController()
  let timedOut = false

  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  const onExternalAbort = () => controller.abort()
  options.signal?.addEventListener('abort', onExternalAbort, { once: true })

  try {
    return await doFetch(url, { ...init, signal: controller.signal })
  } catch (error) {
    if (timedOut) {
      throw new TimeoutError(`Request to ${url} timed out after ${timeoutMs}ms`, {
        details: { url, timeoutMs },
        cause: error,
      })
    }
    throw error
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', onExternalAbort)
  }
}

export async function readJson<T = unknown>(response: Response): Promise<T> {
  const text = await response.text()
  if (text.trim() === '') return undefined as T
  return JSON.parse(text) as T
}

export function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue
    search.set(key, String(value))
  }
  return search.toString()
}

export function base64Encode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64')
}

export function base64Decode(value: string): string {
  return Buffer.from(value, 'base64').toString('utf8')
}
