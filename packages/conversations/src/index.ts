import { z } from 'zod';

export const inboundMessageSchema=z.strictObject({workspaceId:z.string().min(1),conversationId:z.string().min(1),leadId:z.string().min(1),body:z.string().trim().min(1).max(10000),subject:z.string().trim().max(240).nullable().optional(),receivedAt:z.string().datetime().nullable().optional(),provider:z.string().trim().min(1).max(80).default('manual'),providerMessageId:z.string().trim().max(240).nullable().optional(),providerThreadId:z.string().trim().max(240).nullable().optional(),rawMetadata:z.record(z.string(),z.unknown()).optional()});
export type InboundMessage=z.infer<typeof inboundMessageSchema>;
export interface InboundMessageSource { normalize(input:unknown):Promise<InboundMessage>; }
export class ManualInboundMessageSource implements InboundMessageSource { async normalize(input:unknown){return inboundMessageSchema.parse(input);} }
export type FollowUpContext=Readonly<{workspaceMatches:boolean;hasInboundReply:boolean;doNotContact:boolean;unsubscribed:boolean;leadStage:string;deliverySent:boolean;outboundAllowed:boolean;campaignActive?:boolean}>;
export function canFollowUp(value:FollowUpContext):boolean{return value.workspaceMatches&&value.outboundAllowed&&value.deliverySent&&value.campaignActive!==false&&!value.hasInboundReply&&!value.doNotContact&&!value.unsubscribed&&['contacted'].includes(value.leadStage);}
export function hasInboundReply(messages:ReadonlyArray<Readonly<{direction:string}>>):boolean{return messages.some((message)=>message.direction==='inbound');}
