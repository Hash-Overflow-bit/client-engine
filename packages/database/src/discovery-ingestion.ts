import type { LeadSource, Prospect, SearchCriteria } from '@client-engine/integrations';
import { prospectIdentity, type ProspectStore } from './index';

export const APOLLO_DAILY_PROSPECT_LIMIT = 15;
export const CONTROLLED_LIVE_TEST_PROSPECT_LIMIT = 10;

export type DiscoveryRunResult = Readonly<{
  searched: number;
  skippedExisting: number;
  enriched: number;
  inserted: number;
  updated: number;
  failed: number;
  capped: boolean;
  failures: ReadonlyArray<Readonly<{ sourceExternalId: string; reason: string }>>;
}>;

export type DiscoveryRunOptions = Readonly<{
  workspaceId: string;
  day: string;
  criteria: SearchCriteria;
  provider: LeadSource;
  store: ProspectStore;
  dailyLimit?: number;
}>;

/**
 * Runs one bounded Apollo discovery pass. The store is responsible for
 * transactional upserts and workspace scoping; this service never calls
 * Supabase directly and never sends outreach.
 */
export async function runDiscovery(options: DiscoveryRunOptions): Promise<DiscoveryRunResult> {
  const configuredLimit = Math.floor(options.dailyLimit ?? APOLLO_DAILY_PROSPECT_LIMIT);
  const dailyLimit = resolveDiscoveryDailyLimit(configuredLimit, process.env);
  const alreadyDiscovered = await options.store.countDiscoveries(options.workspaceId, options.day);
  const remaining = Math.max(dailyLimit - alreadyDiscovered, 0);
  if (remaining === 0) return { searched: 0, skippedExisting: 0, enriched: 0, inserted: 0, updated: 0, failed: 0, capped: true, failures: [] };

  const candidates = deduplicate(await options.provider.search({ ...options.criteria, perPage: Math.min(options.criteria.perPage ?? dailyLimit, remaining) }));
  let skippedExisting = 0;
  let enriched = 0;
  let inserted = 0;
  let updated = 0;
  let failed = 0;
  let capacityExhausted = false;
  const failures: Array<{ sourceExternalId: string; reason: string }> = [];

  for (const prospect of candidates.slice(0, remaining)) {
    const existing = await options.store.findExistingProspect(options.workspaceId, prospectIdentity(prospect));
    if (existing) {
      skippedExisting += 1;
      continue;
    }
    if (!await options.store.tryReserveDiscoverySlot(options.workspaceId, options.day, dailyLimit)) {
      capacityExhausted = true;
      break;
    }
    try {
      const enrichedProspect = await options.provider.enrich(prospect);
      enriched += 1;
      const company = await options.store.upsertCompany(options.workspaceId, {
        name: enrichedProspect.company.name,
        domain: enrichedProspect.company.domain ?? null,
        website: enrichedProspect.company.website ?? null,
        industry: enrichedProspect.company.industry ?? null,
        employeeCount: enrichedProspect.company.employeeCount,
        linkedinUrl: enrichedProspect.company.linkedinUrl ?? null,
      });
      const lead = await options.store.upsertLead(options.workspaceId, {
        companyId: company.id,
        name: enrichedProspect.name,
        email: enrichedProspect.email ?? null,
        role: enrichedProspect.role ?? null,
        linkedinUrl: enrichedProspect.linkedinUrl ?? null,
        source: enrichedProspect.source ?? enrichedProspect.provider,
        sourceExternalId: enrichedProspect.sourceExternalId,
      });
      if (lead.created) inserted += 1;
      else updated += 1;
      await options.store.recordLeadDiscovered(options.workspaceId, {
        leadId: lead.id,
        companyId: company.id,
        effectKey: `lead_discovered:${enrichedProspect.source ?? enrichedProspect.provider}:${enrichedProspect.sourceExternalId}`,
        details: { source: enrichedProspect.source ?? enrichedProspect.provider, sourceExternalId: enrichedProspect.sourceExternalId, matchConfidence: enrichedProspect.matchConfidence },
      });
    } catch (error) {
      failed += 1;
      failures.push({ sourceExternalId: prospect.sourceExternalId, reason: error instanceof Error ? error.message : 'Unknown discovery failure' });
    }
  }

  return { searched: candidates.length, skippedExisting, enriched, inserted, updated, failed, capped: capacityExhausted || alreadyDiscovered + inserted >= dailyLimit, failures };
}

/**
 * The controlled-live-test guard is deliberately enforced before a provider is
 * queried. It applies to the shared ingestion service, so Apollo, manual and
 * CSV sources cannot bypass it. The persistent daily reservation then makes
 * concurrent retries respect the same cap.
 */
export function resolveDiscoveryDailyLimit(configuredLimit: number, env: NodeJS.ProcessEnv = process.env): number {
  const normalLimit = Math.min(Math.max(configuredLimit, 0), APOLLO_DAILY_PROSPECT_LIMIT);
  if (env.LIVE_TEST_MODE !== 'true') return normalLimit;
  const requested = Number(env.LIVE_TEST_MAX_PROSPECTS);
  const cap = Number.isInteger(requested) && requested >= 1 && requested <= CONTROLLED_LIVE_TEST_PROSPECT_LIMIT
    ? requested
    : CONTROLLED_LIVE_TEST_PROSPECT_LIMIT;
  return Math.min(normalLimit, cap);
}

function deduplicate(prospects: ReadonlyArray<Prospect>): Prospect[] {
  const seen = new Set<string>();
  const unique: Prospect[] = [];
  for (const prospect of prospects) {
    const identity = prospectIdentity(prospect);
    const key = identity.email ?? (prospect.domain ?? prospect.companyName
      ? `${identity.name}|${(prospect.domain ?? prospect.companyName)?.trim().toLowerCase()}`
      : `${identity.source}:${identity.sourceExternalId}`);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(prospect);
  }
  return unique;
}
