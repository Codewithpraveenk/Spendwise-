// Monthly category limits in paise. August deliberately has no plan.
const categoryLimits = [
  { category: 'Housing', limitPaise: 550000 },
  { category: 'Food', limitPaise: 200000 },
  { category: 'Transport', limitPaise: 80000 },
  { category: 'Education', limitPaise: 100000 },
  { category: 'Utilities', limitPaise: 50000 },
  { category: 'Subscriptions', limitPaise: 20000 },
];

export const budgets = ['2026-09', '2026-10'].flatMap((month) =>
  categoryLimits.map((budget) => ({ ...budget, id: `${month}-${budget.category}`, month })),
);
