import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdviceRequest, SlimDayForecast, SlimHourForecast } from '../src/types/advice';

vi.mock('ai', () => ({
  generateText: vi.fn(),
}));

vi.mock('./rateLimit', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue({ ok: true }),
}));

import { enforceRateLimit } from './rateLimit';
import { generateText } from 'ai';
import handler from './advice';

function createMockResponse() {
  const res = {
    status: vi.fn(() => res),
    json: vi.fn(() => res),
  };

  return res;
}

const slimDay: SlimDayForecast = {
  datetime: '2026-07-15',
  conditions: 'Partly cloudy',
  temp: '22°C',
  tempmax: '28°C',
  tempmin: '16°C',
  feelslike: '23°C',
  feelslikemax: '29°C',
  feelslikemin: '15°C',
  precipprob: '30%',
  precip: '2.5mm',
  precipcover: '10%',
  preciptype: ['rain'],
  snow: '0cm',
  snowdepth: '0cm',
  humidity: '55%',
  cloudcover: '40%',
  windspeed: '12 km/h',
  solarradiation: '239.1 W/m²',
  solarenergy: '20.6 MJ/m²',
  uvindex: '8',
  visibility: '15.1 km',
};

const slimHour: SlimHourForecast = {
  datetime: '14:00:00',
  conditions: 'Clear',
  temp: '24°C',
  feelslike: '25°C',
  precipprob: '10%',
  precip: '0mm',
  preciptype: [],
  windspeed: '8 km/h',
  winddir: 'from S (180°)',
};

function validPayload(overrides: Partial<AdviceRequest> = {}): AdviceRequest {
  return {
    scope: 'location',
    location: 'London, UK',
    question: 'Should I bring an umbrella?',
    history: [],
    days: [slimDay],
    alerts: { count: 0, alerts: [] },
    ...overrides,
  };
}

describe('advice API handler', () => {
  const originalModel = process.env.AI_ADVICE_MODEL;

  beforeEach(() => {
    vi.mocked(generateText).mockReset();
    vi.mocked(enforceRateLimit).mockClear();
    vi.mocked(enforceRateLimit).mockResolvedValue({ ok: true });
    vi.mocked(generateText).mockResolvedValue({
      text: 'Bring a light jacket.',
      finishReason: 'stop',
      usage: {},
      warnings: [],
    } as unknown as Awaited<ReturnType<typeof generateText>>);
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    if (originalModel === undefined) {
      delete process.env.AI_ADVICE_MODEL;
    } else {
      process.env.AI_ADVICE_MODEL = originalModel;
    }
    vi.restoreAllMocks();
  });

  it('returns 405 for non-POST methods', async () => {
    const res = createMockResponse();
    await handler({ method: 'GET', body: validPayload() }, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: 'Method not allowed' });
    expect(generateText).not.toHaveBeenCalled();
    expect(enforceRateLimit).not.toHaveBeenCalled();
  });

  it('returns 429 when the rate limiter denies the request', async () => {
    vi.mocked(enforceRateLimit).mockResolvedValue({
      ok: false,
      status: 429,
      error: 'Too many requests. Try again shortly.',
    });

    const res = createMockResponse();
    await handler({ method: 'POST', body: validPayload() }, res);

    expect(enforceRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST' }),
      'advice',
    );
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Too many requests. Try again shortly.',
    });
    expect(generateText).not.toHaveBeenCalled();
  });

  it('returns 400 when the body is missing', async () => {
    const res = createMockResponse();
    await handler({ method: 'POST' }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid JSON body' });
  });

  it('returns 400 when the body is invalid JSON', async () => {
    const res = createMockResponse();
    await handler({ method: 'POST', body: '{not-json' }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid JSON body' });
  });

  it('returns 400 when location is missing', async () => {
    const res = createMockResponse();
    await handler({ method: 'POST', body: validPayload({ location: '  ' }) }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Location is required' });
  });

  it('returns 400 when question is missing', async () => {
    const res = createMockResponse();
    await handler({ method: 'POST', body: validPayload({ question: '' }) }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Question is required' });
  });

  it('returns 400 when question is too long', async () => {
    const res = createMockResponse();
    await handler({ method: 'POST', body: validPayload({ question: 'a'.repeat(501) }) }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Question is too long' });
  });

  it('returns 400 when location is too long', async () => {
    const res = createMockResponse();
    await handler({ method: 'POST', body: validPayload({ location: 'a'.repeat(201) }) }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Location is too long' });
    expect(generateText).not.toHaveBeenCalled();
  });

  it('returns 400 when scope is invalid', async () => {
    const res = createMockResponse();
    await handler(
      { method: 'POST', body: { ...validPayload(), scope: 'week' as AdviceRequest['scope'] } },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Scope must be location or day' });
  });

  it('returns 400 when forecast days are missing', async () => {
    const res = createMockResponse();
    await handler({ method: 'POST', body: validPayload({ days: [] }) }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Forecast days are invalid' });
  });

  it('returns 400 when location scope has more than 5 days', async () => {
    const res = createMockResponse();
    await handler(
      {
        method: 'POST',
        body: validPayload({
          scope: 'location',
          days: [slimDay, slimDay, slimDay, slimDay, slimDay, slimDay],
        }),
      },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Forecast days are invalid' });
  });

  it('accepts location scope with exactly 5 days', async () => {
    const res = createMockResponse();
    await handler(
      {
        method: 'POST',
        body: validPayload({
          scope: 'location',
          days: [slimDay, slimDay, slimDay, slimDay, slimDay],
        }),
      },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(generateText).toHaveBeenCalled();
  });

  it('returns 400 when day scope does not have exactly 1 day', async () => {
    const res = createMockResponse();
    await handler(
      {
        method: 'POST',
        body: validPayload({
          scope: 'day',
          days: [slimDay, slimDay],
        }),
      },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Forecast days are invalid' });
  });

  it('returns 400 when alerts are missing', async () => {
    const res = createMockResponse();
    await handler({ method: 'POST', body: validPayload({ alerts: undefined }) }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Alerts object is invalid' });
  });

  it('returns 400 when history is invalid', async () => {
    const res = createMockResponse();
    await handler(
      {
        method: 'POST',
        body: validPayload({
          history: [{ role: 'system' as 'user', content: 'nope' }],
        }),
      },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'History is invalid' });
  });

  it('parses a JSON string body and returns advice', async () => {
    const res = createMockResponse();
    await handler({ method: 'POST', body: JSON.stringify(validPayload()) }, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ answer: 'Bring a light jacket.' });
  });

  it('calls generateText with location system prompt and forecast payload', async () => {
    const res = createMockResponse();
    const payload = validPayload({
      history: [{ role: 'user', content: 'Earlier question' }],
    });

    await handler({ method: 'POST', body: payload }, res);

    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'google/gemini-2.5-flash-lite',
        system: expect.stringContaining('multi-day window'),
        maxOutputTokens: 1000,
        reasoning: 'minimal',
        messages: [
          { role: 'user', content: 'Earlier question' },
          {
            role: 'user',
            content: expect.stringContaining('Location: London, UK'),
          },
        ],
      }),
    );
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('up to five days'),
      }),
    );

    const call = vi.mocked(generateText).mock.calls[0][0];
    const lastMessage = call.messages?.[call.messages.length - 1];
    const content = String((lastMessage as { content: string }).content);

    expect(content).toContain('Location: London, UK');
    expect(content).toContain('Question: Should I bring an umbrella?');
    expect(content).toContain('"datetime":"2026-07-15"');
    expect(content).toContain('"temp":"22°C"');
    expect(content).toContain('"preciptype":["rain"]');
    expect(content).toContain('"count":0');
    expect(content).not.toContain('"hours"');
  });

  it('uses a day-focused system prompt for day scope', async () => {
    const res = createMockResponse();
    await handler({ method: 'POST', body: validPayload({ scope: 'day', days: [slimDay] }) }, res);

    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('single day'),
      }),
    );
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('time-of-day questions'),
      }),
    );
  });

  it('includes hourly rows in the forecast JSON for day scope', async () => {
    const res = createMockResponse();
    const dayWithHours = {
      ...slimDay,
      hours: [slimHour],
    };
    const payload = validPayload({ scope: 'day', days: [dayWithHours] });

    await handler({ method: 'POST', body: payload }, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const call = vi.mocked(generateText).mock.calls[0][0];
    const lastMessage = call.messages?.[call.messages.length - 1];
    const content = String((lastMessage as { content: string }).content);

    expect(content).toContain('"hours"');
    expect(content).toContain('"datetime":"14:00:00"');
    expect(content).toContain('"winddir":"from S (180°)"');
  });

  it('drops unknown forecast keys before calling the model', async () => {
    const res = createMockResponse();
    const inflated = { ...slimDay, extra: 'x'.repeat(5000) };
    await handler(
      { method: 'POST', body: validPayload({ days: [inflated] as AdviceRequest['days'] }) },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(200);
    const call = vi.mocked(generateText).mock.calls[0][0];
    const lastMessage = call.messages?.[call.messages.length - 1];
    expect(String((lastMessage as { content: string }).content)).not.toContain('"extra"');
  });

  it('returns 400 when day scope has too many hourly rows', async () => {
    const res = createMockResponse();
    const dayWithHours = {
      ...slimDay,
      hours: Array.from({ length: 25 }, () => slimHour),
    };
    await handler(
      { method: 'POST', body: validPayload({ scope: 'day', days: [dayWithHours] }) },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Forecast days are invalid' });
    expect(generateText).not.toHaveBeenCalled();
  });

  it('returns 400 when alert count does not match the alerts array', async () => {
    const res = createMockResponse();
    await handler(
      {
        method: 'POST',
        body: validPayload({ alerts: { count: 0, alerts: [{ summary: 'Wind' }] } }),
      },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Alerts object is invalid' });
    expect(generateText).not.toHaveBeenCalled();
  });

  it('returns 400 when an alert summary is too long', async () => {
    const res = createMockResponse();
    await handler(
      {
        method: 'POST',
        body: validPayload({
          alerts: { count: 1, alerts: [{ summary: 'x'.repeat(401) }] },
        }),
      },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Alerts object is invalid' });
    expect(generateText).not.toHaveBeenCalled();
  });

  it('returns 400 when there are too many alerts', async () => {
    const res = createMockResponse();
    await handler(
      {
        method: 'POST',
        body: validPayload({
          alerts: {
            count: 21,
            alerts: Array.from({ length: 21 }, () => ({ summary: 'Wind' })),
          },
        }),
      },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Alerts object is invalid' });
    expect(generateText).not.toHaveBeenCalled();
  });

  it('uses AI_ADVICE_MODEL when configured', async () => {
    process.env.AI_ADVICE_MODEL = 'openai/gpt-4o-mini';
    const res = createMockResponse();

    await handler({ method: 'POST', body: validPayload() }, res);

    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'openai/gpt-4o-mini' }),
    );
  });

  it('returns 502 when the model returns an empty answer', async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: '   ',
      finishReason: 'stop',
      usage: {},
      warnings: [],
    } as unknown as Awaited<ReturnType<typeof generateText>>);

    const res = createMockResponse();
    await handler({ method: 'POST', body: validPayload() }, res);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Upstream advice request failed',
    });
  });

  it('returns 429 when the upstream message indicates rate limiting', async () => {
    vi.mocked(generateText).mockRejectedValue(new Error('429 rate limit exceeded'));

    const res = createMockResponse();
    await handler({ method: 'POST', body: validPayload() }, res);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Advice service is rate limited. Try again shortly.',
    });
  });

  it('returns 403 when the model is restricted', async () => {
    vi.mocked(generateText).mockRejectedValue(new Error('403 restricted model on free tier'));

    const res = createMockResponse();
    await handler({ method: 'POST', body: validPayload() }, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Selected model is not available on the current AI Gateway plan.',
    });
  });

  it('returns 502 for other upstream failures', async () => {
    vi.mocked(generateText).mockRejectedValue(new Error('gateway timeout'));

    const res = createMockResponse();
    await handler({ method: 'POST', body: validPayload() }, res);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Upstream advice request failed',
    });
  });
});
