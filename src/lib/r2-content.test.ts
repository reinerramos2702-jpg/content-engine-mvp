import { describe, expect, it } from 'vitest';
import { buildContentAssetKey, isContentAssetKeyForWorkspace } from './r2';

describe('content calendar R2 keys', () => {
  it('aísla por workspace, sanitiza segmentos y usa nombres aleatorios', () => {
    const first = buildContentAssetKey('../workspace / peligro', '.JpG?');
    const second = buildContentAssetKey('../workspace / peligro', '.JpG?');

    expect(first).toMatch(/^content-calendar\/---workspace---peligro\/[a-f0-9]{32}\.jpg$/);
    expect(second).toMatch(/^content-calendar\/---workspace---peligro\/[a-f0-9]{32}\.jpg$/);
    expect(first).not.toBe(second);
    expect(first).not.toContain('..');
  });

  it('acepta solo claves emitidas bajo el prefijo del workspace activo', () => {
    const key = buildContentAssetKey('workspace-a', 'png');
    expect(isContentAssetKeyForWorkspace(key, 'workspace-a')).toBe(true);
    expect(isContentAssetKeyForWorkspace(key, 'workspace-b')).toBe(false);
    expect(isContentAssetKeyForWorkspace('content-calendar/workspace-a/../../secret.png', 'workspace-a')).toBe(false);
  });
});
