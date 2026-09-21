import { describe, expect, it } from 'vitest';
import { assertOutreachTransition } from '@client-engine/database';

describe('outreach review state machine', () => {
  it('allows review approval and rejection', () => {
    expect(() => assertOutreachTransition('ready_for_review', 'approved')).not.toThrow();
    expect(() => assertOutreachTransition('ready_for_review', 'rejected')).not.toThrow();
  });
  it('rejects reopening an immutable rejected version', () => {
    expect(() => assertOutreachTransition('rejected', 'approved')).toThrow('Invalid outreach draft transition');
  });
  it('is idempotent for the same state', () => {
    expect(() => assertOutreachTransition('approved', 'approved')).not.toThrow();
  });
});
