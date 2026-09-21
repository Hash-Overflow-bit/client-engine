import { describe, expect, it } from 'vitest';
import { manualLeadInputSchema } from '@client-engine/integrations';
import { mapLead } from '../lib/live-crm';

describe('live CRM boundary', () => {
  it('validates the manual lead contract', () => {
    expect(manualLeadInputSchema.parse({ name: 'Ada Lovelace', email: 'ada@example.com', role: 'Founder', companyName: 'Analytical Engines', domain: 'analytical.example', website: null, linkedinUrl: null })).toMatchObject({ name: 'Ada Lovelace', companyName: 'Analytical Engines' });
  });

  it('rejects malformed manual lead input', () => {
    expect(() => manualLeadInputSchema.parse({ name: '', companyName: 'Missing Person', email: 'not-an-email' })).toThrow();
  });

  it('maps persisted stages without inventing a record', () => {
    const lead = mapLead({ id: 'lead-1', name: 'Ada Lovelace', role: 'Founder', email: 'ada@example.com', source: 'manual', stage: 'researched', fit_score: 88, company_id: 'company-1', created_at: '2026-09-22T00:00:00Z', updated_at: '2026-09-22T00:00:00Z', companies: { name: 'Analytical Engines', domain: 'analytical.example' } });
    expect(lead).toMatchObject({ id: 'lead-1', name: 'Ada Lovelace', company: 'Analytical Engines', stage: 'qualified', score: 88 });
  });

  it('uses an empty company label when the persisted relation is absent', () => {
    const lead = mapLead({ id: 'lead-2', name: 'Grace Hopper', stage: 'discovered', source: 'manual', company_id: null, companies: null });
    expect(lead.company).toBe('Unlinked company');
    expect(lead.stage).toBe('new');
  });
});
