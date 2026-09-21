export const navigation = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/leads', label: 'Leads' },
  { href: '/pipeline', label: 'Pipeline' },
  { href: '/follow-ups', label: 'Follow-ups' },
  { href: '/campaigns', label: 'Campaigns' },
  { href: '/meetings', label: 'Meetings' },
  { href: '/proposals', label: 'Proposals' },
  { href: '/deals', label: 'Deals' },
  { href: '/settings', label: 'Settings' },
] as const;
export type NavigationItem = (typeof navigation)[number];
