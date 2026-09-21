export const funnelStages = [
  'new',
  'qualified',
  'ready',
  'contacted',
  'replied',
  'meeting',
  'proposal',
  'won',
] as const;

export type FunnelStage = (typeof funnelStages)[number];

export type Lead = Readonly<{
  id: string;
  name: string;
  role: string;
  company: string;
  companyDomain: string;
  email: string;
  initials: string;
  stage: FunnelStage;
  score: number;
  source: string;
  lastActivity: string;
  nextAction: string;
  research: string;
  painPoint: string;
  serviceMatch: string;
  conversation: ReadonlyArray<Readonly<{ direction: 'outbound' | 'inbound'; text: string; time: string }>>;
  aiActivity: ReadonlyArray<Readonly<{ label: string; detail: string; status: 'complete' | 'review' }>>;
  researchDetails: Readonly<{ verifiedSignals: ReadonlyArray<Readonly<{ url: string; reasoning: string }>>; possibleNeeds: readonly string[]; personalizationAngles: ReadonlyArray<Readonly<{ url: string; reasoning: string }>>; confidence: number; portfolioMatch: string }>;
}>;

const alexJohnson: Lead = {
  id: 'alex-johnson',
  name: 'Alex Johnson',
  role: 'Founder',
  company: 'InvoiceAI',
  companyDomain: 'invoiceai.com',
  email: 'alex@invoiceai.com',
  initials: 'AJ',
  stage: 'qualified',
  score: 87,
  source: 'Apollo',
  lastActivity: '2 hours ago',
  nextAction: 'Review draft before sending',
  research:
    'InvoiceAI helps small finance teams automate invoice collection and reconciliation. The team recently launched a self-serve plan and is hiring for growth, suggesting a focus on improving qualified pipeline without adding manual work.',
  painPoint:
    'The founder is still handling outbound research and follow-ups personally, which makes consistent pipeline generation difficult while the product team is scaling.',
  serviceMatch:
    'A focused acquisition workflow can connect their ICP research, qualification, and personalized follow-up into one reviewable system.',
  conversation: [
    { direction: 'outbound', text: 'Shared a short idea for reducing manual prospect research.', time: 'Today, 9:42 AM' },
    { direction: 'inbound', text: 'This is close to a problem we are actively working through.', time: 'Today, 10:18 AM' },
  ],
  aiActivity: [
    { label: 'Qualification', detail: 'High-fit founder-led SaaS profile', status: 'complete' },
    { label: 'Company research', detail: '4 source-backed observations ready', status: 'complete' },
    { label: 'Outreach draft', detail: 'Waiting for human approval', status: 'review' },
  ],
  researchDetails: { verifiedSignals: [{ url: 'https://invoiceai.com', reasoning: 'Public site describes automated invoice collection and reconciliation.' }], possibleNeeds: ['May benefit from a more consistent founder-led acquisition process.'], personalizationAngles: [{ url: 'https://invoiceai.com', reasoning: 'Self-serve invoicing workflow is a relevant context for automation.' }], confidence: 0.88, portfolioMatch: 'AI SaaS and acquisition automation experience' },
};

export const leads: ReadonlyArray<Lead> = [
  alexJohnson,
  {
    ...alexJohnson,
    id: 'maya-patel',
    name: 'Maya Patel',
    role: 'Co-founder',
    company: 'LedgerLoop',
    companyDomain: 'ledgerloop.io',
    email: 'maya@ledgerloop.io',
    initials: 'MP',
    stage: 'ready',
    score: 92,
    lastActivity: 'Yesterday',
    nextAction: 'Approve first-touch draft',
  },
  {
    ...alexJohnson,
    id: 'daniel-lee',
    name: 'Daniel Lee',
    role: 'CEO',
    company: 'Northstar Labs',
    companyDomain: 'northstarlabs.co',
    email: 'daniel@northstarlabs.co',
    initials: 'DL',
    stage: 'contacted',
    score: 78,
    lastActivity: 'Yesterday',
    nextAction: 'Wait for reply',
  },
  {
    ...alexJohnson,
    id: 'sophia-martin',
    name: 'Sophia Martin',
    role: 'Head of Growth',
    company: 'BrightDesk',
    companyDomain: 'brightdesk.app',
    email: 'sophia@brightdesk.app',
    initials: 'SM',
    stage: 'replied',
    score: 84,
    lastActivity: '3 hours ago',
    nextAction: 'Suggest a discovery call',
  },
  {
    ...alexJohnson,
    id: 'omar-hassan',
    name: 'Omar Hassan',
    role: 'Founder',
    company: 'RoutePilot',
    companyDomain: 'routepilot.dev',
    email: 'omar@routepilot.dev',
    initials: 'OH',
    stage: 'meeting',
    score: 89,
    lastActivity: 'Monday',
    nextAction: 'Prepare meeting brief',
  },
  {
    ...alexJohnson,
    id: 'emma-wilson',
    name: 'Emma Wilson',
    role: 'COO',
    company: 'FieldNote',
    companyDomain: 'fieldnote.co',
    email: 'emma@fieldnote.co',
    initials: 'EW',
    stage: 'proposal',
    score: 95,
    lastActivity: 'Monday',
    nextAction: 'Follow up on proposal',
  },
  {
    ...alexJohnson,
    id: 'noah-kim',
    name: 'Noah Kim',
    role: 'Founder',
    company: 'SignalStack',
    companyDomain: 'signalstack.io',
    email: 'noah@signalstack.io',
    initials: 'NK',
    stage: 'won',
    score: 91,
    lastActivity: 'Aug 28',
    nextAction: 'Schedule kickoff',
  },
  {
    ...alexJohnson,
    id: 'lucas-brown',
    name: 'Lucas Brown',
    role: 'Product Lead',
    company: 'AtlasBoard',
    companyDomain: 'atlasboard.com',
    email: 'lucas@atlasboard.com',
    initials: 'LB',
    stage: 'new',
    score: 63,
    lastActivity: 'Aug 27',
    nextAction: 'Enrich company profile',
  },
];

export const dashboardMetrics = [
  { label: 'Leads', value: '183', delta: '+12 this week', tone: 'neutral' },
  { label: 'Qualified', value: '72', delta: '39% of leads', tone: 'blue' },
  { label: 'Contacted', value: '40', delta: '56% of qualified', tone: 'violet' },
  { label: 'Replies', value: '13', delta: '32.5% response rate', tone: 'amber' },
  { label: 'Interested', value: '6', delta: '46% of replies', tone: 'emerald' },
  { label: 'Meetings', value: '4', delta: '67% of interested', tone: 'teal' },
  { label: 'Proposals', value: '3', delta: '75% of meetings', tone: 'orange' },
  { label: 'Won', value: '2', delta: '67% close rate', tone: 'green' },
] as const;

export function getLead(id: string): Lead {
  return leads.find((lead) => lead.id === id) ?? {
    ...alexJohnson,
    id,
    name: 'Lead preview',
    role: 'Contact',
    company: 'Unlinked company',
    companyDomain: 'example.com',
    email: 'contact@example.com',
    initials: 'LP',
    stage: 'new',
    score: 0,
    nextAction: 'Complete enrichment',
  };
}

export function leadsForStage(stage: FunnelStage): ReadonlyArray<Lead> {
  return leads.filter((lead) => lead.stage === stage);
}
