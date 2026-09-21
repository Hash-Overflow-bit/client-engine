import { describe, expect, it } from 'vitest';
import { navigation } from '../lib/navigation';
describe('platform navigation', () => {
  it('contains every top-level milestone route once', () => {
    expect(navigation.map((item) => item.href)).toEqual(['/dashboard', '/leads', '/pipeline', '/follow-ups', '/campaigns', '/meetings', '/proposals', '/deals', '/settings']);
    expect(new Set(navigation.map((item) => item.href)).size).toBe(navigation.length);
  });
});
