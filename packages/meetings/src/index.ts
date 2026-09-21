import { z } from 'zod';
import { getEffectiveReplyIntent, type ReplyIntent } from '@client-engine/reply-classification';
export const meetingStatusSchema=z.enum(['scheduled','completed','cancelled','no_show']);
export const manualMeetingInputSchema=z.strictObject({leadId:z.string().uuid(),conversationId:z.string().uuid(),startsAt:z.string().datetime({offset:true}),endsAt:z.string().datetime({offset:true}).optional(),durationMinutes:z.number().int().min(5).max(240).optional(),timezone:z.string().trim().min(1).max(80),meetingUrl:z.string().url().nullable().optional(),notes:z.string().trim().max(2000).nullable().optional(),idempotencyKey:z.string().trim().min(1).max(160)}).refine(v=>Boolean(v.endsAt)!==Boolean(v.durationMinutes),{message:'Provide an end time or duration'});
export type ManualMeetingInput=z.infer<typeof manualMeetingInputSchema>;
export type BookingPreparation=Readonly<{provider:'manual'|'calendly';bookingUrl:string|null;defaultDuration:number;timezone:string;title:string;leadId:string;conversationId:string}>;
export interface BookingProvider{readonly provider:'manual'|'calendly';prepareBooking(input:BookingPreparation):Promise<BookingPreparation>}
export class ManualBookingProvider implements BookingProvider{readonly provider='manual' as const;async prepareBooking(input:BookingPreparation){return input;}}
export function effectiveIntent(input:Readonly<{humanOverride?:ReplyIntent|null;confirmedAi?:ReplyIntent|null;unresolvedAi?:ReplyIntent|null}>){return getEffectiveReplyIntent(input);}
export function canCreateMeetingOpportunity(input:Readonly<{workspaceMatches:boolean;effectiveIntent:ReplyIntent|null;explicitAuthorizedAction?:boolean;doNotContact:boolean;unsubscribed:boolean;leadClosedLost:boolean;hasActiveMeeting:boolean}>){return input.workspaceMatches&&!input.doNotContact&&!input.unsubscribed&&!input.leadClosedLost&&!input.hasActiveMeeting&&(input.effectiveIntent==='POSITIVE'||input.explicitAuthorizedAction===true);}
