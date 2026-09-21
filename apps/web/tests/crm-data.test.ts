import { describe, expect, it } from 'vitest';
import { dashboardMetrics, funnelStages, getLead, leadsForStage } from '../lib/crm-data';

describe('CRM dashboard fixtures', () => {
  it('keeps the requested dashboard metrics in funnel order', () => {
    expect(dashboardMetrics.map((metric) => [metric.label, metric.value])).toEqual([
      ['Leads', '183'],
      ['Qualified', '72'],
      ['Contacted', '40'],
      ['Replies', '13'],
      ['Interested', '6'],
      ['Meetings', '4'],
      ['Proposals', '3'],
      ['Won', '2'],
    ]);
  });

  it('exposes every pipeline stage and links cards to a lead record', () => {
    expect(funnelStages).toHaveLength(8);
    expect(leadsForStage('qualified').some((lead) => lead.id === 'alex-johnson')).toBe(true);
    expect(getLead('alex-johnson').company).toBe('InvoiceAI');
  });

  it('renders a safe preview for an unknown route id', () => {
    const lead = getLead('missing-lead');
    expect(lead.id).toBe('missing-lead');
    expect(lead.score).toBe(0);
    expect(lead.nextAction).toBe('Complete enrichment');
  });
});
