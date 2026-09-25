import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from './client-api';

describe('apiFetch content type', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('no fuerza Content-Type al enviar FormData', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const form = new FormData();
    form.append('files', new Blob(['image'], { type: 'image/png' }), 'image.png');

    await apiFetch('/api/content-posts/upload', { method: 'POST', body: form });

    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.has('Content-Type')).toBe(false);
  });

  it('mantiene application/json para bodies JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/api/content-posts', { method: 'POST', body: '{}' });

    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('Content-Type')).toBe('application/json');
  });
});
