import { z } from 'zod';

export const dealStatusSchema = z.enum(['open', 'won', 'lost']);
export const lossReasonSchema = z.enum(['BUDGET', 'NO_RESPONSE', 'TIMING', 'COMPETITOR', 'SCOPE_MISMATCH', 'NO_DECISION', 'CLIENT_PAUSED', 'TECHNICAL_MISMATCH', 'OTHER']);
export const currencySchema = z.string().regex(/^[A-Z]{3}$/);
export const dealOutcomeSchema = z.object({ dealId: z.string().uuid(), value: z.number().finite().nonnegative(), currency: currencySchema }).strict();
export const dealLossSchema = z.object({ dealId: z.string().uuid(), reason: lossReasonSchema, notes: z.string().max(1_000).optional() }).strict();

export type CurrencyValue = Readonly<{ value: number; currency: string }>;
export function proposalValue(pricing: unknown): CurrencyValue | null {
  const value = z.object({ mode: z.enum(['UNPRICED', 'FIXED', 'HOURLY', 'RANGE']), currency: currencySchema.nullable(), amount: z.number().nonnegative().nullable(), hourlyRate: z.number().nonnegative().nullable(), min: z.number().nonnegative().nullable(), max: z.number().nonnegative().nullable() }).safeParse(pricing);
  if (!value.success || value.data.mode !== 'FIXED' || value.data.amount === null || value.data.currency === null) return null;
  return { value: value.data.amount, currency: value.data.currency };
}

export function sumByCurrency(values: readonly (CurrencyValue | null | undefined)[]): Record<string, number> {
  return values.reduce<Record<string, number>>((result, value) => { if (value) result[value.currency] = (result[value.currency] ?? 0) + value.value; return result; }, {});
}

export function averageByCurrency(values: readonly (CurrencyValue | null | undefined)[]): Record<string, number> {
  const grouped = values.reduce<Record<string, number[]>>((result, value) => { if (value) (result[value.currency] ??= []).push(value.value); return result; }, {});
  return Object.fromEntries(Object.entries(grouped).map(([currency, amounts]) => [currency, amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length]));
}

export function rate(numerator: number, denominator: number): number | null { return denominator === 0 ? null : numerator / denominator; }

export function canCloseDeal(status: z.infer<typeof dealStatusSchema>): boolean { return status === 'open'; }
