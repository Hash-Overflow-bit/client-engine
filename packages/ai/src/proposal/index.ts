import { proposalSchema, type ProposalOutput } from './schema';
import { services,portfolio } from '../outreach/registry';
export type HumanPricing=ProposalOutput['pricing'];
export function validateHumanPricing(pricing: HumanPricing): HumanPricing {
  const parsed = proposalSchema.shape.pricing.parse(pricing);
  const numeric = [parsed.amount, parsed.hourlyRate, parsed.min, parsed.max];
  if (parsed.mode === 'UNPRICED' && numeric.some((value) => value !== null)) throw new Error('Unpriced proposals cannot contain numeric pricing.');
  if (parsed.mode === 'FIXED' && (parsed.amount === null || parsed.hourlyRate !== null || parsed.min !== null || parsed.max !== null)) throw new Error('Fixed pricing requires only an amount.');
  if (parsed.mode === 'HOURLY' && (parsed.hourlyRate === null || parsed.amount !== null || parsed.min !== null || parsed.max !== null)) throw new Error('Hourly pricing requires only an hourly rate.');
  if (parsed.mode === 'RANGE' && (parsed.min === null || parsed.max === null || parsed.min > parsed.max || parsed.amount !== null || parsed.hourlyRate !== null)) throw new Error('Range pricing requires a valid minimum and maximum only.');
  return parsed;
}
export function validateProposal(raw:unknown,pricing:HumanPricing):ProposalOutput{const value=proposalSchema.parse(raw);const approvedPricing=validateHumanPricing(pricing);const warn=[...value.warnings];if(JSON.stringify(value.pricing)!==JSON.stringify(approvedPricing))warn.push('AI pricing does not match human-provided pricing.');try{validateHumanPricing(value.pricing);}catch(error){warn.push(error instanceof Error?error.message:'Invalid AI pricing.');}return {...value,pricing:approvedPricing,needsReview:value.needsReview||warn.length>0,warnings:[...new Set(warn)].slice(0,10)};}
export function controlledProposalMatch(service:string|null,portfolioMatch:string|null){return{service:service&&services.some(s=>s.id===service||s.label===service)?service:null,portfolio:portfolioMatch&&portfolio.some(p=>p.enabled&&(p.id===portfolioMatch||p.name===portfolioMatch))?portfolioMatch:null};}
export {proposalSchema,proposalJsonSchema,pricingModeSchema} from './schema'; export type {ProposalOutput} from './schema';
export { canTransitionProposal, proposalStatuses, requireProposalTransition } from './lifecycle';
export type { ProposalStatus } from './lifecycle';
