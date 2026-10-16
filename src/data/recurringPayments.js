// Fixed fixture date for deterministic tests. The UI uses the current India date.
export const demoToday = '2026-10-16';

// A paid occurrence links to an existing expense, never a second transaction.
// Missing links represent unpaid occurrences in this fictional dataset.
export const recurringPayments = [
  { id: 'rent', name: 'Hostel rent', category: 'Housing', amountPaise: 550000, dueDay: 2, startMonth: '2026-09', paidTransactions: { '2026-09': 't12', '2026-10': 't02' } },
  { id: 'mobile', name: 'Mobile recharge', category: 'Utilities', amountPaise: 29900, dueDay: 10, startMonth: '2026-10', paidTransactions: { '2026-10': 't07' } },
  { id: 'music', name: 'Music subscription', category: 'Subscriptions', amountPaise: 5900, dueDay: 15, startMonth: '2026-10', paidTransactions: { '2026-10': 't10' } },
  { id: 'gym', name: 'Campus gym', category: 'Health', amountPaise: 70000, dueDay: 12, startMonth: '2026-10', paidTransactions: {} },
  { id: 'cloud', name: 'Cloud storage', category: 'Subscriptions', amountPaise: 14900, dueDay: 16, startMonth: '2026-10', paidTransactions: {} },
  { id: 'wifi', name: 'Wi-Fi share', category: 'Utilities', amountPaise: 49900, dueDay: 18, startMonth: '2026-10', paidTransactions: {} },
];
