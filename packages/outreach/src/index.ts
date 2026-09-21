import { z } from 'zod';

// Internal domain input, not an invented provider response schema.
export const sendContextSchema = z.strictObject({
  sendEnabled: z.boolean(),
  globalKillSwitch: z.boolean().optional(),
  mode: z.enum(['approval', 'auto']),
  approvedRevision: z.string().min(1).nullable(),
  currentRevision: z.string().min(1),
  autoPolicyApproved: z.boolean(),
  suppressed: z.boolean(),
  do_not_contact: z.boolean(),
  emailVerified: z.boolean(),
  replyReceived: z.boolean(),
  meetingBooked: z.boolean(),
  sentToday: z.number().int().nonnegative(),
  dailyLimit: z.number().int().positive(),
});
export type SendContext = z.infer<typeof sendContextSchema>;
export const outboundControlSchema = z.strictObject({ killSwitchEnabled: z.boolean() });

/** Pure preflight, not a dispatcher. Runtime environment comes from trusted server
 * configuration, never webhook/request data. Workers must recheck current stored
 * state immediately before sending and serialize this with reply/stop processing.
 */
export function evaluateSend(
  input: unknown,
  environment: string | undefined = process.env.CLIENT_ENGINE_ENV,
  control: unknown = { killSwitchEnabled: process.env.OUTBOUND_KILL_SWITCH === 'true' },
): { allowed: boolean; reason: string } {
  if (environment !== 'production') return { allowed: false, reason: 'Non-production sending disabled' };
  const parsedControl = outboundControlSchema.safeParse(control);
  if (!parsedControl.success || parsedControl.data.killSwitchEnabled) return { allowed: false, reason: 'Global outbound kill switch enabled' };
  const parsed = sendContextSchema.safeParse(input);
  if (!parsed.success) return { allowed: false, reason: 'Invalid send context' };
  const c = parsed.data;
  if (c.globalKillSwitch) return { allowed: false, reason: 'Global outbound kill switch enabled' };
  if (!c.sendEnabled) return { allowed: false, reason: 'Sending disabled' };
  if (c.do_not_contact || c.suppressed || c.replyReceived || c.meetingBooked) return { allowed: false, reason: 'Sequence stopped' };
  if (!c.emailVerified) return { allowed: false, reason: 'Email not verified' };
  if (c.sentToday >= c.dailyLimit) return { allowed: false, reason: 'Daily limit reached' };
  if (c.mode === 'approval') {
    if (c.approvedRevision !== c.currentRevision) return { allowed: false, reason: 'Current draft requires approval' };
  } else if (!c.autoPolicyApproved) return { allowed: false, reason: 'Auto-send policy requires approval' };
  return { allowed: true, reason: 'Preflight passed' };
}
