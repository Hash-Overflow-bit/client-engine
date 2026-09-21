import { getEffectiveReplyIntent } from '@client-engine/reply-classification';
import { averageByCurrency, rate, sumByCurrency, type CurrencyValue } from './deal-domain';

export type AnalyticsRange = '7d' | '30d' | '90d' | 'all';
export type AnalyticsInput = Readonly<{
  leads: readonly { id: string; source: string | null; createdAt: string }[];
  qualificationRuns: readonly { leadId: string | null; createdAt: string }[];
  researchRuns: readonly { leadId: string | null; createdAt: string }[];
  deliveries: readonly { leadId: string; campaignId: string | null; sentAt: string | null }[];
  messages: readonly { leadId: string; campaignId: string | null; direction: string; receivedAt: string | null }[];
  meetings: readonly { leadId: string; campaignId: string | null; status: string; createdAt: string }[];
  proposals: readonly { leadId: string; createdAt: string }[];
  classifications: readonly { id: string; leadId: string; intent: string | null; createdAt: string }[];
  overrides: readonly { classificationId: string; selectedIntent: string; createdAt: string }[];
  reviews: readonly { classificationId: string; status: string; createdAt: string }[];
  deals: readonly { leadId: string | null; campaignId: string | null; source: string | null; serviceId: string | null; status: string; value: number | string | null; currency: string | null; createdAt: string; wonAt: string | null; lostAt: string | null }[];
}>;
export type Breakdown = Readonly<{ key: string; leads: number; contacted: number; replies: number; meetings: number; proposals: number; won: number; wonRevenue: Record<string, number> }>;

function startFor(range: AnalyticsRange, now: Date) { if (range === 'all') return null; const days = range === '7d' ? 7 : range === '30d' ? 30 : 90; return new Date(now.getTime() - days * 86_400_000); }
function inRange(value: string | null | undefined, start: Date | null) { return Boolean(value) && (!start || new Date(String(value)).getTime() >= start.getTime()); }
function ids<T>(rows: readonly T[], predicate: (row: T) => boolean, id: (row: T) => string | null) { return new Set(rows.filter(predicate).map(id).filter((value): value is string => Boolean(value))); }
function numeric(value: number | string | null) { const result = typeof value === 'number' ? value : Number(value); return Number.isFinite(result) ? result : null; }

export function getFunnelAnalytics(input: AnalyticsInput, range: AnalyticsRange, now = new Date()) {
  const start = startFor(range, now);
  const discovered = ids(input.leads, (row) => inRange(row.createdAt, start), (row) => row.id);
  const qualified = ids(input.qualificationRuns, (row) => inRange(row.createdAt, start), (row) => row.leadId);
  const researched = ids(input.researchRuns, (row) => inRange(row.createdAt, start), (row) => row.leadId);
  const contacted = ids(input.deliveries, (row) => row.sentAt !== null && inRange(row.sentAt, start), (row) => row.leadId);
  const replied = ids(input.messages, (row) => row.direction === 'inbound' && inRange(row.receivedAt, start), (row) => row.leadId);
  const latestOverride = new Map<string, string>(); input.overrides.forEach((row) => { if (!latestOverride.has(row.classificationId)) latestOverride.set(row.classificationId, row.selectedIntent); });
  const confirmed = new Set(input.reviews.filter((row) => row.status === 'confirmed').map((row) => row.classificationId));
  const positive = ids(input.classifications, (row) => inRange(row.createdAt, start) && getEffectiveReplyIntent({ humanOverride: latestOverride.get(row.id) as never, confirmedAi: confirmed.has(row.id) ? row.intent as never : null, unresolvedAi: row.intent as never }) === 'POSITIVE', (row) => row.leadId);
  const meetings = ids(input.meetings, (row) => !['cancelled', 'canceled', 'no_show'].includes(row.status) && inRange(row.createdAt, start), (row) => row.leadId);
  const proposals = ids(input.proposals, (row) => inRange(row.createdAt, start), (row) => row.leadId);
  const openDeals = input.deals.filter((row) => row.status === 'open' && inRange(row.createdAt, start));
  const wonDeals = input.deals.filter((row) => row.status === 'won' && inRange(row.wonAt, start));
  const lostDeals = input.deals.filter((row) => row.status === 'lost' && inRange(row.lostAt, start));
  const asCurrency = (rows: AnalyticsInput['deals']): CurrencyValue[] => rows.flatMap((row) => { const value = numeric(row.value); return value === null || !row.currency ? [] : [{ value, currency: row.currency }]; });
  const pipeline = sumByCurrency(asCurrency(openDeals)); const revenue = sumByCurrency(asCurrency(wonDeals));
  const counts = { discovered: discovered.size, qualified: qualified.size, researched: researched.size, contacted: contacted.size, replied: replied.size, positive: positive.size, meetings: meetings.size, proposals: proposals.size, openDeals: openDeals.length, wonDeals: wonDeals.length, lostDeals: lostDeals.length };
  const conversions = { qualificationRate: rate(counts.qualified, counts.discovered), replyRate: rate(counts.replied, counts.contacted), positiveReplyRate: rate(counts.positive, counts.contacted), meetingRate: rate(counts.meetings, counts.contacted), proposalRate: rate(counts.proposals, counts.meetings), closeRate: rate(counts.wonDeals, counts.proposals) };
  const leadSource = new Map(input.leads.map((row) => [row.id, row.source || 'UNKNOWN']));
  const breakdown = (keys: readonly string[], keyForLead: (leadId: string) => string, keyForDeal: (deal: AnalyticsInput['deals'][number]) => string): Breakdown[] => [...new Set(keys)].sort().map((key) => { const leadIds = new Set(input.leads.filter((lead) => keyForLead(lead.id) === key).map((lead) => lead.id)); const keyDeals = wonDeals.filter((deal) => keyForDeal(deal) === key); return { key, leads: [...discovered].filter((id) => leadIds.has(id)).length, contacted: [...contacted].filter((id) => leadIds.has(id)).length, replies: [...replied].filter((id) => leadIds.has(id)).length, meetings: [...meetings].filter((id) => leadIds.has(id)).length, proposals: [...proposals].filter((id) => leadIds.has(id)).length, won: keyDeals.length, wonRevenue: sumByCurrency(asCurrency(keyDeals)) }; });
  const sourceKeys = [...new Set([...input.leads.map((lead) => lead.source || 'UNKNOWN'), ...input.deals.map((deal) => deal.source || 'UNKNOWN')])];
  const campaignByLead = new Map(input.deliveries.filter((delivery) => delivery.campaignId).map((delivery) => [delivery.leadId, delivery.campaignId as string]));
  const campaignKeys = [...new Set([...campaignByLead.values(), ...input.deals.map((deal) => deal.campaignId || 'UNKNOWN')])];
  const serviceKeys = [...new Set(input.deals.map((deal) => deal.serviceId || 'UNKNOWN'))];
  const serviceByLead = new Map(input.deals.filter((deal) => deal.leadId).map((deal) => [deal.leadId as string, deal.serviceId || 'UNKNOWN']));
  return { range, start: start?.toISOString() ?? null, counts, conversions, pipeline, revenue, averageWonDeal: averageByCurrency(asCurrency(wonDeals)), sourcePerformance: breakdown(sourceKeys, (id) => leadSource.get(id) || 'UNKNOWN', (deal) => deal.source || 'UNKNOWN'), campaignPerformance: breakdown(campaignKeys, (id) => campaignByLead.get(id) || 'UNKNOWN', (deal) => deal.campaignId || 'UNKNOWN'), servicePerformance: breakdown(serviceKeys, (id) => serviceByLead.get(id) || 'UNKNOWN', (deal) => deal.serviceId || 'UNKNOWN') };
}
