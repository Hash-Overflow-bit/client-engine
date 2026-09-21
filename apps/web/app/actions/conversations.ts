'use server';
import { revalidatePath } from 'next/cache';
import { ManualInboundMessageSource } from '@client-engine/conversations';
import { SupabaseConversationStore } from '@client-engine/database';
import { createClient } from '../../lib/supabase/server';
async function authorize(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('Authentication required');const {data:member,error}=await supabase.from('workspace_members').select('workspace_id').eq('user_id',user.id).order('created_at',{ascending:true}).limit(1).maybeSingle();if(error||!member?.workspace_id)throw new Error('No authorized workspace');return{supabase,user,workspaceId:String(member.workspace_id)};}
export async function recordReplyAction(input:{conversationId:string;leadId:string;body:string;subject?:string;receivedAt?:string}){try{const {supabase,user,workspaceId}=await authorize();const normalized=await new ManualInboundMessageSource().normalize({...input,workspaceId,provider:'manual'});const result=await new SupabaseConversationStore(supabase).recordReply(normalized,user.id);revalidatePath(`/leads/${input.leadId}`);revalidatePath('/pipeline');return{ok:true,...result};}catch(error){return{ok:false,error:error instanceof Error?error.message:'Unable to record reply'};}}
