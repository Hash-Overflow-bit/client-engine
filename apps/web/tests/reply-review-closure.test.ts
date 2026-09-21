import { describe, expect, it } from 'vitest';
import { getEffectiveReplyIntent, replyIntentSchema } from '@client-engine/reply-classification';

describe('reply review closure', () => {
  it('supports every canonical intent and keeps human precedence', () => {
    expect(replyIntentSchema.options).toEqual(['POSITIVE', 'QUESTION', 'NOT_NOW', 'NOT_INTERESTED', 'REFERRAL', 'OUT_OF_OFFICE', 'UNSUBSCRIBE', 'OTHER']);
    expect(replyIntentSchema.safeParse('UNSUPPORTED').success).toBe(false);
    expect(getEffectiveReplyIntent({ humanOverride: 'QUESTION', confirmedAi: 'POSITIVE', unresolvedAi: 'OTHER' })).toBe('QUESTION');
    expect(getEffectiveReplyIntent({ confirmedAi: 'POSITIVE', unresolvedAi: 'OTHER' })).toBe('POSITIVE');
    expect(getEffectiveReplyIntent({ unresolvedAi: 'OTHER' })).toBe('OTHER');
  });

  it('does not infer an intent when no classification exists', () => {
    expect(getEffectiveReplyIntent({})).toBeNull();
  });
});
