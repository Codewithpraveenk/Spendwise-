export const categoriesByType = {
  income: ['Allowance', 'Part-time work', 'Scholarship', 'Gift', 'Other income'],
  expense: ['Housing', 'Food', 'Transport', 'Education', 'Utilities', 'Subscriptions', 'Health', 'Shopping', 'Entertainment', 'Other expense'],
};

export const allCategories = Object.values(categoriesByType).flat().sort();
