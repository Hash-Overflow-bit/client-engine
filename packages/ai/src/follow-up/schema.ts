import { z } from 'zod';
import { followUpPurposeSchema } from '@client-engine/follow-ups';

export const followUpEvidenceRefSchema = z.strictObject({
  type: z.enum(['verified_signal', 'personalization_angle']),
  sourceUrl: z.string().url(),
  claim: z.string().trim().min(1).max(300),
});
export const followUpDraftSchema = z.strictObject({
  subject: z.string().trim().min(1).max(120), body: z.string().trim().min(1).max(1500),
  purpose: followUpPurposeSchema, angle: z.string().trim().max(300).nullable(),
  evidenceRefs: z.array(followUpEvidenceRefSchema).max(6), serviceMatch: z.string().trim().max(160).nullable(), portfolioMatch: z.string().trim().max(200).nullable(),
  confidence: z.number().min(0).max(1), usableForFollowUp: z.boolean(), needsReview: z.boolean(), warnings: z.array(z.string().trim().min(1).max(300)).max(8),
});
export type FollowUpDraftOutput = z.infer<typeof followUpDraftSchema>;
export const followUpDraftJsonSchema = { type: 'object', properties: { subject:{type:'string'}, body:{type:'string'}, purpose:{type:'string',enum:['VALUE_FOLLOW_UP','SECOND_TOUCH','CLOSE_LOOP']}, angle:{type:['string','null']}, evidenceRefs:{type:'array',items:{type:'object',properties:{type:{type:'string',enum:['verified_signal','personalization_angle']},sourceUrl:{type:'string'},claim:{type:'string'}},required:['type','sourceUrl','claim'],additionalProperties:false}}, serviceMatch:{type:['string','null']}, portfolioMatch:{type:['string','null']}, confidence:{type:'number'}, usableForFollowUp:{type:'boolean'}, needsReview:{type:'boolean'}, warnings:{type:'array',items:{type:'string'}} }, required:['subject','body','purpose','angle','evidenceRefs','serviceMatch','portfolioMatch','confidence','usableForFollowUp','needsReview','warnings'], additionalProperties:false } as const;
