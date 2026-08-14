/**
 * Vercel serverless handler that returns weather advice via AI Gateway.
 *
 * POST only. Rate-limits by IP, sanitizes location/days/alerts, then calls
 * generateText. Client errors stay generic (no upstream message leak).
 */
import { generateText } from 'ai';
import type { AdviceMessage, AdviceRequest, AdviceScope } from '../src/types/advice';
import { enforceRateLimit, type RateLimitRequest } from './rateLimit.js';
import { sanitizeAlerts, sanitizeDays } from './adviceSanitize';

type AdviceApiRequest = RateLimitRequest & {
  method?: string;
  body?: Partial<AdviceRequest> | string;
};

type AdviceApiResponse = {
  status: (code: number) => AdviceApiResponse;
  json: (body: unknown) => AdviceApiResponse;
};

const MAX_QUESTION_LENGTH = 500;
const MAX_HISTORY_MESSAGES = 6;
const MAX_MESSAGE_LENGTH = 1000;
const MAX_OUTPUT_TOKENS = 1000;
const MAX_LOCATION_LENGTH = 200;

/**
 * Reads and normalizes the POST body from a Vercel request.
 *
 * Accepts an already-parsed object or a JSON string. Returns null when the body
 * is missing or cannot be parsed.
 *
 * @param req - Incoming API request that may include a body.
 * @returns A partial AdviceRequest object, or null when the body is unusable.
 */
function getBody(req: AdviceApiRequest): Partial<AdviceRequest> | null {
  const raw = req.body;
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Partial<AdviceRequest>;
    } catch {
      return null;
    }
  }
  return raw;
}

/**
 * Type guard for AdviceScope values.
 *
 * @param value - Unknown value from the request body.
 * @returns True when value is 'location' or 'day'.
 */
function isAdviceScope(value: unknown): value is AdviceScope {
  return value === 'location' || value === 'day';
}

/**
 * Validates and trims prior chat turns for the model.
 *
 * Keeps only the most recent messages, enforces role/content shape, and caps
 * each message length. Returns null when history is present but malformed.
 *
 * @param history - Raw history array from the request body.
 * @returns Sanitized AdviceMessage list, an empty array when history is empty,
 *   or null when history is invalid.
 */
function sanitizeHistory(history: unknown): AdviceMessage[] | null {
  if (!Array.isArray(history)) return null;

  const clipped = history.slice(-MAX_HISTORY_MESSAGES);
  const messages: AdviceMessage[] = [];

  for (const item of clipped) {
    if (!item || typeof item !== 'object') return null;
    const role = (item as AdviceMessage).role;
    const content = (item as AdviceMessage).content;
    if (role !== 'user' && role !== 'assistant') return null;
    if (typeof content !== 'string') return null;
    messages.push({
      role,
      content: content.trim().slice(0, MAX_MESSAGE_LENGTH),
    });
  }

  return messages;
}

/**
 * Builds the system prompt for location or day advice scope.
 *
 * @param scope - Whether the question targets the multi-day location window or a single day.
 * @returns System instructions for generateText.
 */
function buildSystemPrompt(scope: AdviceScope): string {
  const scopeRule =
    scope === 'location'
      ? 'Focus on the provided multi-day window (up to five days including today when present).'
      : 'Answer only for the single day in the forecast JSON. When hours are present, use them for time-of-day questions. Alerts are location-wide context.';

  return [
    'You are a concise weather adviser for a consumer weather app.',
    'Use only the supplied location, forecast JSON, and alerts.',
    'Numeric values already include units (for example °C, mm, km/h, %, AQI categories like "42 (Good)", pollutant µg/m³). Do not invent units.',
    'Do not invent alerts or weather data. If something is missing, say so briefly.',
    'You are not an official warning service; for severe weather, urge checking official sources.',
    'Keep answers short and practical.',
    scopeRule,
  ].join(' ');
}

/**
 * Handles AI advice requests from the frontend.
 *
 * Allows POST only, enforces the advice rate limit, validates and allowlists
 * the AdviceRequest body, calls AI Gateway via generateText, and returns
 * either `{ answer }` or `{ error }` with an appropriate status code.
 *
 * @param req - The incoming POST request with an AdviceRequest body.
 * @param res - The response object used to send status codes and JSON.
 * @returns A JSON response with advice text or an error message.
 */
export default async function handler(req: AdviceApiRequest, res: AdviceApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const limited = await enforceRateLimit(req, 'advice');
  if (!limited.ok) {
    return res.status(limited.status).json({ error: limited.error });
  }

  const body = getBody(req);
  if (!body) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const location = typeof body.location === 'string' ? body.location.trim() : '';
  const question = typeof body.question === 'string' ? body.question.trim() : '';
  const scope = body.scope;
  const history = sanitizeHistory(body.history ?? []);

  if (!location) {
    return res.status(400).json({ error: 'Location is required' });
  }

  if (location.length > MAX_LOCATION_LENGTH) {
    return res.status(400).json({ error: 'Location is too long' });
  }

  if (!question) {
    return res.status(400).json({ error: 'Question is required' });
  }

  if (question.length > MAX_QUESTION_LENGTH) {
    return res.status(400).json({ error: 'Question is too long' });
  }

  if (!isAdviceScope(scope)) {
    return res.status(400).json({ error: 'Scope must be location or day' });
  }

  const sanitizedDays = sanitizeDays(body.days, scope);
  if (sanitizedDays === null) {
    return res.status(400).json({ error: 'Forecast days are invalid' });
  }

  const sanitizedAlerts = sanitizeAlerts(body.alerts);
  if (sanitizedAlerts === null) {
    return res.status(400).json({ error: 'Alerts object is invalid' });
  }

  if (history === null) {
    return res.status(400).json({ error: 'History is invalid' });
  }

  const model = process.env.AI_ADVICE_MODEL ?? 'google/gemini-2.5-flash-lite';

  try {
    const result = await generateText({
      model,
      system: buildSystemPrompt(scope),
      messages: [
        ...history,
        {
          role: 'user',
          content: [
            `Location: ${location}`,
            `Forecast JSON:\n${JSON.stringify({ days: sanitizedDays, alerts: sanitizedAlerts })}`,
            `Question: ${question}`,
          ].join('\n\n'),
        },
      ],
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      reasoning: 'minimal', // Options are: minimal, low, medium (default) and high
    });

    console.log(
      JSON.stringify(
        {
          text: result.text,
          finishReason: result.finishReason,
          usage: result.usage,
          // helpful if present on your ai version:
          // reasoningText: result.reasoningText,
          warnings: result.warnings,
        },
        null,
        2,
      ),
    );

    // Guards against fake success (empty text in result)
    if (!result.text.trim()) {
      return res.status(502).json({
        error: 'Upstream advice request failed',
      });
    }

    return res.status(200).json({ answer: result.text });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Advice request failed';

    // Gateway free-tier / rate-limit style failures include 429 in the message.
    if (/429|rate limit|quota/i.test(message)) {
      return res.status(429).json({
        error: 'Advice service is rate limited. Try again shortly.',
      });
    }

    if (/403|restricted model|free tier/i.test(message)) {
      return res.status(403).json({
        error: 'Selected model is not available on the current AI Gateway plan.',
      });
    }

    return res.status(502).json({
      error: 'Upstream advice request failed',
    });
  }
}
