import { describe, expect, it, vi } from 'vitest';
import { ApolloProspectProvider, type EnrichedProspect, type Prospect } from '@client-engine/integrations';
import { resolveDiscoveryDailyLimit, runDiscovery, type ProspectStore } from '@client-engine/database';

const searchPayload = {
  total_entries: 1,
  people: [{ id: 'apollo-person-1', first_name: 'Alex', last_name_obfuscated: 'Jo***n', title: 'Founder', last_refreshed_at: '2026-09-18T10:00:00.000+00:00', has_email: true, has_city: true, organization: { name: 'InvoiceAI', has_industry: true } }],
};

const enrichmentPayload = {
  person: {
    id: 'apollo-person-1', first_name: 'Alex', last_name: 'Johnson', name: 'Alex Johnson', title: 'Founder', linkedin_url: 'https://www.linkedin.com/in/alex-johnson', email_status: 'verified', email: 'alex@invoiceai.com', organization: { id: 'apollo-company-1', name: 'InvoiceAI', website_url: 'https://invoiceai.com', primary_domain: 'invoiceai.com', industry: 'software', estimated_num_employees: 12, linkedin_url: 'https://www.linkedin.com/company/invoiceai' }, match_confidence: 'high',
  },
  match_confidence: 'high',
};

describe('ApolloProspectProvider', () => {
  it('maps documented search and enrichment payloads without exposing the API shape', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
      requests.push({ url: String(url), init });
      return new Response(requests.length === 1 ? JSON.stringify(searchPayload) : JSON.stringify(enrichmentPayload), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    const provider = new ApolloProspectProvider({ apiKey: 'test-key', fetchImpl });

    const prospects = await provider.search({ titles: ['founder'], seniorities: ['founder'], perPage: 15 });
    const enriched = await provider.enrich(prospects[0]);

    expect(requests[0].url).toContain('/mixed_people/api_search');
    expect(requests[0].url).toContain('person_titles%5B%5D=founder');
    expect(requests[0].init?.headers).toMatchObject({ 'x-api-key': 'test-key' });
    expect(enriched.email).toBe('alex@invoiceai.com');
    expect(enriched.company.employeeCount).toBe(12);
  });

  it('fails closed when Apollo returns a shape outside the validated contract', async () => {
    const provider = new ApolloProspectProvider({ apiKey: 'test-key', fetchImpl: async () => new Response('{"people":[{"id":1}]}', { status: 200 }) });
    await expect(provider.search({})).rejects.toThrow('failed validation');
  });
});

describe('Apollo discovery ingestion', () => {
  it('enforces the controlled live-test prospect cap before provider work', () => {
    expect(resolveDiscoveryDailyLimit(15, { LIVE_TEST_MODE: 'true', LIVE_TEST_MAX_PROSPECTS: '10' })).toBe(10);
    expect(resolveDiscoveryDailyLimit(15, { LIVE_TEST_MODE: 'true', LIVE_TEST_MAX_PROSPECTS: '999' })).toBe(10);
    expect(resolveDiscoveryDailyLimit(15, { LIVE_TEST_MODE: 'false', LIVE_TEST_MAX_PROSPECTS: '10' })).toBe(15);
  });

  it('deduplicates, enriches, upserts, records activity, and caps a run at 15 prospects', async () => {
    const prospect: Prospect = { provider: 'apollo', sourceExternalId: 'apollo-1', firstName: 'Alex', lastName: 'Johnson', name: 'Alex Johnson', role: 'Founder', companyName: 'InvoiceAI', domain: 'invoiceai.com', linkedinUrl: null, sourceMetadata: {} };
    const enriched: EnrichedProspect = { ...prospect, email: 'alex@invoiceai.com', emailStatus: 'verified', matchConfidence: 'high', company: { name: 'InvoiceAI', domain: 'invoiceai.com', website: 'https://invoiceai.com', industry: 'software', employeeCount: 12, linkedinUrl: null } };
    const provider = { source: 'apollo', search: vi.fn(async () => [prospect, { ...prospect, sourceExternalId: 'apollo-2' }]), enrich: vi.fn(async () => enriched) };
    const store: ProspectStore = { countDiscoveries: vi.fn(async () => 0), tryReserveDiscoverySlot: vi.fn(async () => true), findExistingProspect: vi.fn(async () => null), upsertCompany: vi.fn(async () => ({ id: 'company-1' })), upsertLead: vi.fn(async () => ({ id: 'lead-1', created: true })), recordLeadDiscovered: vi.fn(async () => undefined) };

    const result = await runDiscovery({ workspaceId: 'workspace-1', day: '2026-09-19', criteria: { perPage: 15 }, provider, store });

    expect(provider.search).toHaveBeenCalledWith(expect.objectContaining({ perPage: 15 }));
    expect(provider.enrich).toHaveBeenCalledTimes(1);
    expect(store.upsertLead).toHaveBeenCalledTimes(1);
    expect(store.recordLeadDiscovered).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ searched: 1, enriched: 1, inserted: 1, skippedExisting: 0, failed: 0 });
  });

  it('does not query Apollo after the workspace daily cap is reached', async () => {
    const provider = { source: 'apollo', search: vi.fn(), enrich: vi.fn() };
    const store: ProspectStore = { countDiscoveries: vi.fn(async () => 15), tryReserveDiscoverySlot: vi.fn(), findExistingProspect: vi.fn(), upsertCompany: vi.fn(), upsertLead: vi.fn(), recordLeadDiscovered: vi.fn() };
    const result = await runDiscovery({ workspaceId: 'workspace-1', day: '2026-09-19', criteria: {}, provider, store });
    expect(provider.search).not.toHaveBeenCalled();
    expect(result.capped).toBe(true);
  });
});
