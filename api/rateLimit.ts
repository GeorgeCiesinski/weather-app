/**
 * Shared IP rate limiting for Vercel API routes via Upstash Redis.
 *
 * Skipped during `vercel dev`. Preview and production fail closed if Redis
 * is missing or unreachable.
 */
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export type RateLimitEndpoint = 'advice' | 'weather' | 'geocode';

export type RateLimitResult = { ok: true } | { ok: false; status: 429 | 503; error: string };

type HeaderValue = string | string[] | undefined;

type HeaderMap = Record<string, HeaderValue>;

export type RateLimitRequest = {
  headers?: HeaderMap;
};

const UNKNOWN_IP = 'unknown';

/** Sliding-window budgets per endpoint (preview + production). */
const LIMITS = {
  advice: { tokens: 10, window: '1 h' },
  weather: { tokens: 30, window: '1 h' },
  geocode: { tokens: 20, window: '1 m' },
} as const;

let limiters: Record<RateLimitEndpoint, Ratelimit> | null = null;

/**
 * True when running `vercel dev` (not preview or production deployments).
 */
export function isLocalDev(): boolean {
  return process.env.VERCEL_ENV === 'development';
}

/**
 * Reads a single header value from a Node/Vercel IncomingMessage-style map.
 *
 * Node may give `string` or `string[]`. We take the first entry.
 */
function readHeader(headers: HeaderMap | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  const raw = headers[name];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = value?.trim();
  return trimmed || undefined;
}

/**
 * First IP in an X-Forwarded-For style list (`client, proxy1, proxy2`).
 */
function firstForwardedIp(value: string): string {
  return value.split(',')[0]?.trim() || UNKNOWN_IP;
}

/**
 * Client IP as Vercel presents it on the function request.
 *
 * Preference: x-real-ip (single IP, what @vercel/functions uses), then
 * x-vercel-forwarded-for, then the leftmost x-forwarded-for hop.
 */
export function getClientIp(headers: HeaderMap | undefined): string {
  const realIp = readHeader(headers, 'x-real-ip');
  if (realIp) return firstForwardedIp(realIp);

  const vercelForwarded = readHeader(headers, 'x-vercel-forwarded-for');
  if (vercelForwarded) return firstForwardedIp(vercelForwarded);

  const forwarded = readHeader(headers, 'x-forwarded-for');
  if (forwarded) return firstForwardedIp(forwarded);

  return UNKNOWN_IP;
}

function hasRedisEnv(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

/**
 * Lazily builds one Ratelimit instance per endpoint so we do not connect
 * during local skip or when Vitest mocks this module.
 */
function getLimiters(): Record<RateLimitEndpoint, Ratelimit> {
  if (limiters) return limiters;

  const redis = Redis.fromEnv();
  const create = (endpoint: RateLimitEndpoint): Ratelimit => {
    const { tokens, window } = LIMITS[endpoint];
    return new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(tokens, window),
      prefix: `rl:galesage:${endpoint}`,
      analytics: false,
    });
  };

  limiters = {
    advice: create('advice'),
    weather: create('weather'),
    geocode: create('geocode'),
  };

  return limiters;
}

/**
 * Allows or denies a request for the given API endpoint.
 *
 * @param req - Request that may include Vercel/Node headers.
 * @param endpoint - Which budget to apply.
 */
export async function enforceRateLimit(
  req: RateLimitRequest,
  endpoint: RateLimitEndpoint,
): Promise<RateLimitResult> {
  if (isLocalDev()) {
    return { ok: true };
  }

  if (!hasRedisEnv()) {
    return {
      ok: false,
      status: 503,
      error: 'Rate limit service unavailable',
    };
  }

  try {
    const ip = getClientIp(req.headers);
    const { success } = await getLimiters()[endpoint].limit(ip);
    if (!success) {
      return {
        ok: false,
        status: 429,
        error: 'Too many requests. Try again shortly.',
      };
    }
    return {
      ok: true,
    };
  } catch {
    return {
      ok: false,
      status: 503,
      error: 'Rate limit service unavailable',
    };
  }
}
