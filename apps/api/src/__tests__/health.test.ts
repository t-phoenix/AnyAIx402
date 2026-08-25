import { describe, expect, it } from 'vitest';
import { app } from '../index';

describe('GET /health', () => {
  it('returns status ok with a version and timestamp', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.version).toBe('0.1.0');
    expect(typeof body.timestamp).toBe('string');
  });
});

describe('unmatched routes', () => {
  it('returns a structured 404 error', async () => {
    const res = await app.request('/this-route-does-not-exist');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_INPUT');
  });
});
