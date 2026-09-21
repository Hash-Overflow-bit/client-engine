import { z } from 'zod';

export const qualificationResultSchema = z.object({
  score: z.number().int().min(0).max(100),
  tier: z.enum(['A', 'B', 'C']),
  reasons: z.array(z.string().trim().min(1).max(240)).min(1).max(6),
  serviceMatch: z.string().trim().min(1).max(160),
  confidence: z.number().min(0).max(1),
  needsReview: z.boolean().default(false),
}).strict();

export type QualificationResult = z.infer<typeof qualificationResultSchema>;

export const qualificationJsonSchema = {
  type: 'object',
  properties: {
    score: { type: 'integer', minimum: 0, maximum: 100 },
    tier: { type: 'string', enum: ['A', 'B', 'C'] },
    reasons: { type: 'array', items: { type: 'string', minLength: 1, maxLength: 240 }, minItems: 1, maxItems: 6 },
    serviceMatch: { type: 'string', minLength: 1, maxLength: 160 },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    needsReview: { type: 'boolean' },
  },
  required: ['score', 'tier', 'reasons', 'serviceMatch', 'confidence', 'needsReview'],
  additionalProperties: false,
} as const;

export function expectedTier(score: number): QualificationResult['tier'] {
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  return 'C';
}
