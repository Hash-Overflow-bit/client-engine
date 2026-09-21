/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest';
import { DeliveryService, ManualDeliveryProvider } from '@client-engine/delivery';

const input = { workspaceId:'w',leadId:'l',companyId:'c',outreachDraftId:'d',draftVersion:1,recipient:'alex@example.com',subject:'A thought',body:'Hello',channel:'email' as const,provider:'manual' as const };
function store(){let existing:any=null;const create=vi.fn(async(_:string,value:any)=>{existing={id:'delivery-1',...value,sentAt:null,sentBy:null,createdAt:value.preparedAt,updatedAt:value.preparedAt};return existing;});return {store:{findActive:vi.fn(async()=>existing),create,markSent:vi.fn(),recordActivity:vi.fn(async()=>{})},create};}
describe('manual delivery',()=>{it('prepares a snapshot without network sending',async()=>{const h=store();const service=new DeliveryService(new ManualDeliveryProvider(),h.store as never);const result=await service.prepare(input);expect(result.recipient).toBe(input.recipient);expect(result.subject).toBe(input.subject);expect(result.body).toBe(input.body);expect(h.create).toHaveBeenCalledOnce();});it('reuses duplicate preparation',async()=>{const h=store();const service=new DeliveryService(new ManualDeliveryProvider(),h.store as never);await service.prepare(input);await service.prepare(input);expect(h.create).toHaveBeenCalledOnce();});});
