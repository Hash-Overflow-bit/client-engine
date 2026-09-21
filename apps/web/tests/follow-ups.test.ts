import { describe, expect, it } from 'vitest';
import { canFollowUp } from '@client-engine/conversations';
import { assistedFollowUpPolicy, buildInitialTasks, cancellationReasonFor, evaluateDue } from '@client-engine/follow-ups';

const baseContext = { workspaceMatches: true, hasInboundReply: false, doNotContact: false, unsubscribed: false, leadStage: 'contacted', deliverySent: true, outboundAllowed: true, campaignActive: true };
const sentAt = '2026-09-21T09:00:00.000Z';

describe('follow-up scheduling foundation', () => {
  it('uses the bounded assisted policy and creates idempotent-key-compatible steps', () => {
    expect(assistedFollowUpPolicy.steps.map((step) => [step.sequenceStep, step.offsetDays, step.purpose])).toEqual([[1, 3, 'VALUE_FOLLOW_UP'], [2, 7, 'SECOND_TOUCH'], [3, 14, 'CLOSE_LOOP']]);
    const tasks = buildInitialTasks({ workspaceId: 'w', leadId: 'l', conversationId: 'c', deliveryId: 'd', campaignId: null, sentAt });
    expect(tasks).toHaveLength(3);
    expect(new Set(tasks.map((task) => `${task.deliveryId}:${task.policyId}:${task.sequenceStep}`)).size).toBe(3);
    expect(tasks.map((task) => task.dueAt)).toEqual([
      '2026-09-24T09:00:00.000Z',
      '2026-09-28T09:00:00.000Z',
      '2026-10-05T09:00:00.000Z',
    ]);
  });

  it('keeps future work scheduled and moves an eligible due task to due', () => {
    const task = { status: 'scheduled' as const, dueAt: '2026-09-24T09:00:00.000Z' };
    expect(evaluateDue(task, baseContext, new Date('2026-09-23T09:00:00.000Z')).status).toBe('scheduled');
    expect(evaluateDue(task, baseContext, new Date('2026-09-24T09:00:00.000Z')).status).toBe('due');
    expect(canFollowUp(baseContext)).toBe(true);
  });

  it.each([
    ['INBOUND_REPLY', { hasInboundReply: true }],
    ['UNSUBSCRIBED', { unsubscribed: true }],
    ['DO_NOT_CONTACT', { doNotContact: true }],
    ['DELIVERY_NOT_SENT', { deliverySent: false }],
    ['CAMPAIGN_STOPPED', { campaignActive: false }],
    ['OUTBOUND_DISABLED', { outboundAllowed: false }],
  ] as const)('cancels due work for %s without generating content', (reason, change) => {
    const context = { ...baseContext, ...change };
    expect(canFollowUp(context)).toBe(false);
    expect(cancellationReasonFor(context)).toBe(reason);
    expect(evaluateDue({ status: 'scheduled', dueAt: '2026-09-20T09:00:00.000Z' }, context, new Date('2026-09-21T09:00:00.000Z'))).toMatchObject({ status: 'cancelled', reason });
  });

  it('preserves history states and never treats cancellation as a send', () => {
    expect(evaluateDue({ status: 'cancelled', dueAt: '2026-09-20T09:00:00.000Z' }, baseContext)).toMatchObject({ status: 'cancelled' });
    expect(evaluateDue({ status: 'due', dueAt: '2026-09-20T09:00:00.000Z' }, baseContext)).toMatchObject({ status: 'due' });
  });
});
