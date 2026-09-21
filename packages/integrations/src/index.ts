import { z } from 'zod';
import type { Lead } from '@client-engine/shared';

export interface LeadDiscoveryProvider {
  discover(cursor?: string): Promise<{ leads: Lead[]; cursor?: string }>;
}

export interface OutboundProvider {
  send(input: { to: string; subject: string; body: string; idempotencyKey: string }): Promise<{ messageId: string; threadId: string }>;
}

export type LeadSource = Readonly<{
  source: string;
  search(criteria: SearchCriteria): Promise<Prospect[]>;
  enrich(prospect: Prospect): Promise<EnrichedProspect>;
}>;

export interface BookingEvent { externalId: string; leadId: string; startsAt: string; status: 'scheduled' | 'cancelled' }

const nonEmpty = z.string().trim().min(1);
const optionalNonEmpty = nonEmpty.nullish();
const url = z.string().url().nullish();

export const searchCriteriaSchema = z.strictObject({
  titles: z.array(nonEmpty).max(25).default([]),
  seniorities: z.array(nonEmpty).max(25).default([]),
  personLocations: z.array(nonEmpty).max(25).default([]),
  organizationLocations: z.array(nonEmpty).max(25).default([]),
  organizationDomains: z.array(nonEmpty).max(1000).default([]),
  keywords: optionalNonEmpty,
  employeeRanges: z.array(nonEmpty).max(25).default([]),
  page: z.number().int().positive().default(1),
  perPage: z.number().int().positive().max(100).default(15),
});
export type SearchCriteria = z.input<typeof searchCriteriaSchema>;
export type NormalizedSearchCriteria = z.output<typeof searchCriteriaSchema>;

export const prospectSchema = z.strictObject({
  provider: nonEmpty,
  source: nonEmpty.optional(),
  sourceExternalId: nonEmpty,
  firstName: optionalNonEmpty,
  lastName: optionalNonEmpty,
  name: nonEmpty,
  role: optionalNonEmpty,
  companyName: optionalNonEmpty,
  domain: optionalNonEmpty,
  linkedinUrl: url,
  sourceMetadata: z.record(z.string(), z.unknown()).default({}),
});
export type Prospect = z.output<typeof prospectSchema>;

export const enrichedProspectSchema = prospectSchema.extend({
  email: z.string().email().nullish(),
  emailStatus: optionalNonEmpty,
  matchConfidence: z.enum(['high', 'medium', 'low', 'none']).nullable(),
  company: z.strictObject({
    name: nonEmpty,
    domain: optionalNonEmpty,
    website: url,
    industry: optionalNonEmpty,
    employeeCount: z.number().int().nonnegative().nullable(),
    linkedinUrl: url,
  }),
});
export type EnrichedProspect = z.output<typeof enrichedProspectSchema>;

export type ProspectProvider = LeadSource;

const apolloSearchPersonSchema = z.object({
  id: nonEmpty,
  first_name: optionalNonEmpty,
  last_name_obfuscated: optionalNonEmpty,
  title: z.string().trim().nullish(),
  last_refreshed_at: z.string().datetime({ offset: true }).nullish(),
  has_email: z.boolean(),
  organization: z.object({ name: nonEmpty }),
});
const apolloSearchResponseSchema = z.object({
  total_entries: z.number().int().nonnegative(),
  people: z.array(apolloSearchPersonSchema),
});

const apolloEnrichmentPersonSchema = z.object({
  id: nonEmpty,
  first_name: optionalNonEmpty,
  last_name: optionalNonEmpty,
  name: optionalNonEmpty,
  title: z.string().trim().nullish(),
  linkedin_url: url,
  email_status: optionalNonEmpty,
  email: z.string().email().nullish(),
  organization: z.object({
    id: optionalNonEmpty,
    name: optionalNonEmpty,
    website_url: url,
    primary_domain: optionalNonEmpty,
    industry: optionalNonEmpty,
    estimated_num_employees: z.number().int().nonnegative().nullish(),
    linkedin_url: url,
  }).nullish(),
  match_confidence: z.enum(['high', 'medium', 'low', 'none']).nullish(),
});
const apolloEnrichmentResponseSchema = z.object({
  person: apolloEnrichmentPersonSchema.nullish(),
  match_confidence: z.enum(['high', 'medium', 'low', 'none']).nullish(),
});

type ApolloFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

export type ApolloProspectProviderOptions = Readonly<{
  apiKey: string;
  fetchImpl?: ApolloFetch;
  baseUrl?: string;
}>;

export class ApolloProviderError extends Error {
  readonly status: number;
  readonly operation: 'search' | 'enrich';

  constructor(operation: 'search' | 'enrich', status: number, message: string) {
    super(message);
    this.name = 'ApolloProviderError';
    this.status = status;
    this.operation = operation;
  }
}

export class ApolloProspectProvider implements LeadSource {
  readonly source = 'apollo';
  private readonly apiKey: string;
  private readonly fetchImpl: ApolloFetch;
  private readonly baseUrl: string;

  constructor(options: ApolloProspectProviderOptions) {
    if (!options.apiKey.trim()) throw new Error('Apollo API key is required.');
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.baseUrl = (options.baseUrl ?? 'https://api.apollo.io/api/v1').replace(/\/$/, '');
  }

  async search(criteria: SearchCriteria): Promise<Prospect[]> {
    const normalized = searchCriteriaSchema.parse(criteria);
    const query = new URLSearchParams();
    appendArray(query, 'person_titles[]', normalized.titles);
    appendArray(query, 'person_seniorities[]', normalized.seniorities);
    appendArray(query, 'person_locations[]', normalized.personLocations);
    appendArray(query, 'organization_locations[]', normalized.organizationLocations);
    appendArray(query, 'q_organization_domains_list[]', normalized.organizationDomains);
    appendArray(query, 'organization_num_employees_ranges[]', normalized.employeeRanges);
    if (normalized.keywords) query.set('q_keywords', normalized.keywords);
    query.set('page', String(normalized.page));
    query.set('per_page', String(normalized.perPage));

    const response = await this.request('search', `${this.baseUrl}/mixed_people/api_search?${query.toString()}`);
    const parsed = apolloSearchResponseSchema.safeParse(await parseJson(response, 'search'));
    if (!parsed.success) throw new ApolloProviderError('search', response.status, 'Apollo search response failed validation.');
    return parsed.data.people.map((person) => prospectSchema.parse({
      provider: 'apollo',
      source: 'apollo',
      sourceExternalId: person.id,
      firstName: person.first_name,
      name: [person.first_name, person.last_name_obfuscated].filter(Boolean).join(' ') || 'Unknown prospect',
      role: person.title,
      companyName: person.organization.name,
      domain: undefined,
      linkedinUrl: undefined,
      sourceMetadata: { hasEmail: person.has_email, lastRefreshedAt: person.last_refreshed_at },
    }));
  }

  async enrich(prospect: Prospect): Promise<EnrichedProspect> {
    const input = prospectSchema.parse(prospect);
    const query = new URLSearchParams({ id: input.sourceExternalId });
    const response = await this.request('enrich', `${this.baseUrl}/people/match?${query.toString()}`);
    const parsed = apolloEnrichmentResponseSchema.safeParse(await parseJson(response, 'enrich'));
    if (!parsed.success) throw new ApolloProviderError('enrich', response.status, 'Apollo enrichment response failed validation.');
    const person = parsed.data.person;
    if (!person) {
      return enrichedProspectSchema.parse({ ...input, email: null, emailStatus: null, matchConfidence: parsed.data.match_confidence ?? 'none', company: { name: input.companyName ?? input.name, domain: input.domain, website: null, industry: null, employeeCount: null, linkedinUrl: null } });
    }
    const organization = person.organization;
    return enrichedProspectSchema.parse({
      ...input,
      firstName: person.first_name ?? input.firstName,
      lastName: person.last_name ?? input.lastName,
      name: person.name ?? input.name,
      role: person.title ?? input.role,
      linkedinUrl: person.linkedin_url ?? input.linkedinUrl,
      email: person.email ?? null,
      emailStatus: person.email_status ?? null,
      matchConfidence: person.match_confidence ?? parsed.data.match_confidence ?? 'none',
      company: {
        name: organization?.name ?? input.companyName ?? input.name,
        domain: organization?.primary_domain ?? input.domain,
        website: organization?.website_url ?? null,
        industry: organization?.industry ?? null,
        employeeCount: organization?.estimated_num_employees ?? null,
        linkedinUrl: organization?.linkedin_url ?? null,
      },
    });
  }

  private async request(operation: 'search' | 'enrich', url: string): Promise<Response> {
    const response = await this.fetchImpl(url, { method: 'POST', headers: { accept: 'application/json', 'x-api-key': this.apiKey } });
    if (!response.ok) throw new ApolloProviderError(operation, response.status, `Apollo ${operation} request failed with HTTP ${response.status}.`);
    return response;
  }
}

export type ManualLeadInput = Readonly<{ sourceExternalId?: string | null; name: string; email?: string | null; role?: string | null; companyName: string; domain?: string | null; website?: string | null; industry?: string | null; employeeCount?: number | null; linkedinUrl?: string | null }>;
export const manualLeadInputSchema = z.strictObject({ sourceExternalId: optionalNonEmpty, name: nonEmpty, email: z.string().email().nullish(), role: optionalNonEmpty, companyName: nonEmpty, domain: optionalNonEmpty, website: url, industry: optionalNonEmpty, employeeCount: z.number().int().nonnegative().nullish(), linkedinUrl: url });

export class ManualLeadSource implements LeadSource {
  readonly source = 'manual';
  private readonly records: readonly EnrichedProspect[];
  constructor(inputs: readonly ManualLeadInput[]) {
    this.records = inputs.map((raw, index) => { const input = manualLeadInputSchema.parse(raw); return enrichedProspectSchema.parse({ provider: this.source, source: this.source, sourceExternalId: input.sourceExternalId ?? `manual-${index + 1}`, name: input.name, role: input.role, companyName: input.companyName, domain: input.domain, linkedinUrl: input.linkedinUrl, sourceMetadata: { imported: true }, email: input.email, emailStatus: input.email ? 'manual' : null, matchConfidence: input.email ? 'high' : 'none', company: { name: input.companyName, domain: input.domain, website: input.website, industry: input.industry, employeeCount: input.employeeCount ?? null, linkedinUrl: input.linkedinUrl } }); });
  }
  async search(criteria?: SearchCriteria): Promise<Prospect[]> { void criteria; return this.records.map((record) => prospectSchema.parse({ provider: record.provider, source: record.source, sourceExternalId: record.sourceExternalId, firstName: record.name.split(' ')[0], lastName: undefined, name: record.name, role: record.role, companyName: record.company.name, domain: record.company.domain, linkedinUrl: record.linkedinUrl, sourceMetadata: record.sourceMetadata })); }
  async enrich(prospect: Prospect): Promise<EnrichedProspect> { const input = prospectSchema.parse(prospect); const match = this.records.find((record) => record.sourceExternalId === input.sourceExternalId); if (!match) throw new Error(`Manual lead ${input.sourceExternalId} was not found.`); return match; }
}

export function parseLeadCsv(csv: string): ManualLeadInput[] {
  const rows = parseCsvRows(csv); if (rows.length < 2) return [];
  const headers = rows[0].map((header) => header.trim());
  for (const required of ['name', 'companyName']) if (!headers.includes(required)) throw new Error(`CSV is missing required column: ${required}`);
  return rows.slice(1).filter((row) => row.some((cell) => cell.trim())).map((row) => { const record = Object.fromEntries(headers.map((header, index) => [header, row[index]?.trim() ?? ''])); return manualLeadInputSchema.parse({ sourceExternalId: record.sourceExternalId || null, name: record.name, email: record.email || null, role: record.role || null, companyName: record.companyName, domain: record.domain || null, website: record.website || null, industry: record.industry || null, employeeCount: record.employeeCount ? Number(record.employeeCount) : null, linkedinUrl: record.linkedinUrl || null }); });
}
function parseCsvRows(csv: string): string[][] { const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false; for (let i = 0; i < csv.length; i += 1) { const char = csv[i]; if (char === '"') { if (quoted && csv[i + 1] === '"') { cell += '"'; i += 1; } else quoted = !quoted; } else if (char === ',' && !quoted) { row.push(cell); cell = ''; } else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && csv[i + 1] === '\n') i += 1; row.push(cell); rows.push(row); row = []; cell = ''; } else cell += char; } if (quoted) throw new Error('CSV contains an unterminated quoted field.'); if (cell || row.length) { row.push(cell); rows.push(row); } return rows; }

async function parseJson(response: Response, operation: 'search' | 'enrich'): Promise<unknown> {
  try { return await response.json(); } catch { throw new ApolloProviderError(operation, response.status, 'Apollo returned invalid JSON.'); }
}

function appendArray(query: URLSearchParams, key: string, values: ReadonlyArray<string>): void {
  values.forEach((value) => query.append(key, value));
}
