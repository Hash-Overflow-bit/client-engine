'use client';
import { useState } from 'react';
import { prepareMeetingBookingAction } from '../app/actions/meetings';
export function PrepareMeetingButton({leadId,conversationId}:Readonly<{leadId:string;conversationId:string}>){const[message,setMessage]=useState('');return <div className="mt-3"><button onClick={()=>void prepareMeetingBookingAction(leadId,conversationId).then(r=>setMessage(r.ok?(r.prepared.bookingUrl?'Booking link ready':'Manual meeting ready'):r.error??'Unable to prepare meeting'))} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold">Prepare Meeting</button>{message&&<p className="mt-1 text-xs text-slate-600">{message}</p>}</div>}
