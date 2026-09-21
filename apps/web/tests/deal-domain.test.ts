import { describe, expect, it } from 'vitest';
import { canCloseDeal, dealLossSchema, dealOutcomeSchema, proposalValue, sumByCurrency } from '../lib/deal-domain';

describe('deal outcome safety', () => {
  it('allows only open deals to close', () => { expect(canCloseDeal('open')).toBe(true); expect(canCloseDeal('won')).toBe(false); expect(canCloseDeal('lost')).toBe(false); });
  it('requires a human-confirmed value and ISO currency for a win', () => { expect(dealOutcomeSchema.safeParse({ dealId: '00000000-0000-4000-8000-000000000001', value: 1300, currency: 'USD' }).success).toBe(true); expect(dealOutcomeSchema.safeParse({ dealId: '00000000-0000-4000-8000-000000000001', value: 1300, currency: 'usd' }).success).toBe(false); });
  it('accepts only controlled loss reasons', () => { expect(dealLossSchema.safeParse({ dealId: '00000000-0000-4000-8000-000000000001', reason: 'BUDGET' }).success).toBe(true); expect(dealLossSchema.safeParse({ dealId: '00000000-0000-4000-8000-000000000001', reason: 'PRICE_TOO_HIGH' }).success).toBe(false); });
  it('uses fixed proposal pricing only as a human-visible suggestion', () => { expect(proposalValue({ mode: 'FIXED', currency: 'USD', amount: 1500, hourlyRate: null, min: null, max: null })).toEqual({ value: 1500, currency: 'USD' }); expect(proposalValue({ mode: 'RANGE', currency: 'USD', amount: null, hourlyRate: null, min: 1000, max: 2000 })).toBeNull(); });
  it('never sums across currencies', () => expect(sumByCurrency([{ value: 1200, currency: 'USD' }, { value: 900, currency: 'GBP' }])).toEqual({ USD: 1200, GBP: 900 }));
});
