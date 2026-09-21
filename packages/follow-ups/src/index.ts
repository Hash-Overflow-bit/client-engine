import { z } from 'zod';
import { canFollowUp, type FollowUpContext } from '@client-engine/conversations';

export const followUpPurposeSchema = z.enum(['VALUE_FOLLOW_UP', 'SECOND_TOUCH', 'CLOSE_LOOP']);
export type FollowUpPurpose = z.infer<typeof followUpPurposeSchema>;

export const followUpStatusSchema = z.enum(['scheduled', 'due', 'cancelled', 'completed', 'skipped']);
export type FollowUpStatus = z.infer<typeof followUpStatusSchema>;
export const followUpDateSchema = z.string().datetime({ offset: true });

export const followUpCancellationReasonSchema = z.enum([
  'INBOUND_REPLY',
  'DO_NOT_CONTACT',
  'UNSUBSCRIBED',
  'DELIVERY_NOT_SENT',
  'INVALID_LEAD_STATE',
  'WORKSPACE_MISMATCH',
  'CAMPAIGN_STOPPED',
  'OUTBOUND_DISABLED',
  'MANUAL_CANCEL',
  'MANUAL_SKIP',
  'RESCHEDULED',
  'OTHER',
]);
export type FollowUpCancellationReason = z.infer<typeof followUpCancellationReasonSchema>;

export const followUpPolicyStepSchema = z.strictObject({
  sequenceStep: z.number().int().min(1).max(3),
  offsetDays: z.number().int().positive(),
  purpose: followUpPurposeSchema,
});
export type FollowUpPolicyStep = z.infer<typeof followUpPolicyStepSchema>;

export const followUpPolicySchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  steps: z.array(followUpPolicyStepSchema).min(1).max(3),
});
export type FollowUpPolicy = z.infer<typeof followUpPolicySchema>;

export const assistedFollowUpPolicy: FollowUpPolicy = {
  id: 'assisted-v1',
  name: 'Assisted follow-up opportunities',
  steps: [
    { sequenceStep: 1, offsetDays: 3, purpose: 'VALUE_FOLLOW_UP' },
    { sequenceStep: 2, offsetDays: 7, purpose: 'SECOND_TOUCH' },
    { sequenceStep: 3, offsetDays: 14, purpose: 'CLOSE_LOOP' },
  ],
};

export const followUpTaskSchema = z.strictObject({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  leadId: z.string().min(1),
  conversationId: z.string().min(1),
  deliveryId: z.string().min(1),
  campaignId: z.string().nullable(),
  policyId: z.string().min(1),
  sequenceStep: z.number().int().min(1).max(3),
  purpose: followUpPurposeSchema,
  dueAt: followUpDateSchema,
  status: followUpStatusSchema,
  eligibilityCheckedAt: followUpDateSchema.nullable(),
  cancellationReason: followUpCancellationReasonSchema.nullable(),
  completedAt: followUpDateSchema.nullable(),
  createdAt: followUpDateSchema,
  updatedAt: followUpDateSchema,
});
export type FollowUpTask = z.infer<typeof followUpTaskSchema>;

export type FollowUpTaskCreate = Readonly<Omit<FollowUpTask, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'eligibilityCheckedAt' | 'cancellationReason' | 'completedAt'> & {
  status?: FollowUpStatus;
}>;

export function addScheduleDays(value: Date | string, days: number): Date {
  if (!Number.isInteger(days) || days < 0) throw new Error('Schedule-day offset must be a non-negative integer');
  const result = new Date(value);
  if (Number.isNaN(result.getTime())) throw new Error('Invalid schedule anchor');
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function dueAtForStep(sentAt: Date | string, step: FollowUpPolicyStep): string {
  return addScheduleDays(sentAt, step.offsetDays).toISOString();
}

export function getFollowUpPolicy(policyId = assistedFollowUpPolicy.id): FollowUpPolicy {
  if (policyId !== assistedFollowUpPolicy.id) throw new Error(`Unknown follow-up policy: ${policyId}`);
  return assistedFollowUpPolicy;
}

export function cancellationReasonFor(context: FollowUpContext): FollowUpCancellationReason | null {
  if (!context.workspaceMatches) return 'WORKSPACE_MISMATCH';
  if (context.hasInboundReply) return 'INBOUND_REPLY';
  if (context.unsubscribed) return 'UNSUBSCRIBED';
  if (context.doNotContact) return 'DO_NOT_CONTACT';
  if (!context.deliverySent) return 'DELIVERY_NOT_SENT';
  if (context.campaignActive === false) return 'CAMPAIGN_STOPPED';
  if (!context.outboundAllowed) return 'OUTBOUND_DISABLED';
  if (context.leadStage !== 'contacted') return 'INVALID_LEAD_STATE';
  return null;
}

export type DueDecision = Readonly<{ status: 'scheduled' | 'due' | 'cancelled'; reason: FollowUpCancellationReason | null; checkedAt: string }>;

export function evaluateDue(task: Pick<FollowUpTask, 'status' | 'dueAt'>, context: FollowUpContext, now = new Date()): DueDecision {
  const checkedAt = now.toISOString();
  if (task.status !== 'scheduled') return { status: task.status === 'due' ? 'due' : 'cancelled', reason: null, checkedAt };
  if (new Date(task.dueAt).getTime() > now.getTime()) return { status: 'scheduled', reason: null, checkedAt };
  const reason = cancellationReasonFor(context);
  return reason ? { status: 'cancelled', reason, checkedAt } : { status: 'due', reason: null, checkedAt };
}

export function canExposeAsActionable(context: FollowUpContext): boolean {
  return canFollowUp(context);
}

export function buildInitialTasks(input: Readonly<{ workspaceId: string; leadId: string; conversationId: string; deliveryId: string; campaignId: string | null; policyId?: string; sentAt: string }>): readonly FollowUpTaskCreate[] {
  const policy = getFollowUpPolicy(input.policyId);
  return policy.steps.map((step) => ({ workspaceId: input.workspaceId, leadId: input.leadId, conversationId: input.conversationId, deliveryId: input.deliveryId, campaignId: input.campaignId, policyId: policy.id, sequenceStep: step.sequenceStep, purpose: step.purpose, dueAt: dueAtForStep(input.sentAt, step) }));
}
