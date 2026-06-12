import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ApiClient, ApiError } from './api';

function resp(status: number, body: unknown) {
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe('ApiClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns parsed JSON on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue(resp(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new ApiClient(() => 'tok');
    await expect(client.request('/usage/limits')).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refreshes once on 401 and retries with the new token', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(resp(401, { message: 'expired' }))
      .mockResolvedValueOnce(resp(200, { data: 1 }));
    vi.stubGlobal('fetch', fetchMock);
    const refresh = vi.fn().mockResolvedValue('new-token');
    const client = new ApiClient(() => 'old', refresh);

    await expect(client.request('/usage/summary')).resolves.toEqual({ data: 1 });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryInit = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect((retryInit.headers as Record<string, string>).Authorization).toBe('Bearer new-token');
  });

  it('throws ApiError when refresh cannot recover the session', async () => {
    const fetchMock = vi.fn().mockResolvedValue(resp(401, { message: 'nope' }));
    vi.stubGlobal('fetch', fetchMock);
    const refresh = vi.fn().mockResolvedValue(null);
    const client = new ApiClient(() => 'old', refresh);

    await expect(client.request('/usage/summary')).rejects.toBeInstanceOf(ApiError);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1); // no retry without a fresh token
  });

  it('does not attempt a refresh loop on the auth endpoints', async () => {
    const fetchMock = vi.fn().mockResolvedValue(resp(401, { message: 'no' }));
    vi.stubGlobal('fetch', fetchMock);
    const refresh = vi.fn();
    const client = new ApiClient(() => null, refresh);

    await expect(client.request('/auth/refresh', { method: 'POST' })).rejects.toBeInstanceOf(ApiError);
    expect(refresh).not.toHaveBeenCalled();
  });
});
