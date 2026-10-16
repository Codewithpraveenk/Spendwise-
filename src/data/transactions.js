// Fictional records. Positive integer paise avoid floating-point money totals.
export const transactions = [
  { id: 't01', date: '2026-10-01', description: 'Monthly allowance', category: 'Allowance', type: 'income', amountPaise: 1500000 },
  { id: 't02', date: '2026-10-02', description: 'Hostel rent', category: 'Housing', type: 'expense', amountPaise: 550000 },
  { id: 't03', date: '2026-10-03', description: 'Campus canteen', category: 'Food', type: 'expense', amountPaise: 12000 },
  { id: 't04', date: '2026-10-05', description: 'Bus pass', category: 'Transport', type: 'expense', amountPaise: 60000 },
  { id: 't05', date: '2026-10-07', description: 'Weekend tutoring', category: 'Part-time work', type: 'income', amountPaise: 300000 },
  { id: 't06', date: '2026-10-08', description: 'Groceries', category: 'Food', type: 'expense', amountPaise: 85000 },
  { id: 't07', date: '2026-10-10', description: 'Mobile recharge', category: 'Utilities', type: 'expense', amountPaise: 29900 },
  { id: 't08', date: '2026-10-12', description: 'Course books', category: 'Education', type: 'expense', amountPaise: 125000 },
  { id: 't09', date: '2026-10-14', description: 'Lunch with friends', category: 'Food', type: 'expense', amountPaise: 36000 },
  { id: 't10', date: '2026-10-15', description: 'Music subscription', category: 'Subscriptions', type: 'expense', amountPaise: 5900 },
  { id: 't11', date: '2026-09-01', description: 'Monthly allowance', category: 'Allowance', type: 'income', amountPaise: 1500000 },
  { id: 't12', date: '2026-09-02', description: 'Hostel rent', category: 'Housing', type: 'expense', amountPaise: 550000 },
  { id: 't13', date: '2026-09-09', description: 'Groceries', category: 'Food', type: 'expense', amountPaise: 110000 },
  { id: 't14', date: '2026-09-18', description: 'Laptop repair', category: 'Education', type: 'expense', amountPaise: 950000 },
];

export const defaultMonth = '2026-10';
export const availableMonths = [
  { value: '2026-10', label: 'October 2026' },
  { value: '2026-09', label: 'September 2026' },
  { value: '2026-08', label: 'August 2026' },
];
