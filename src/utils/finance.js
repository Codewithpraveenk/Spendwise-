export function getMonthlySummary(transactions, month) {
  // Compare date-only strings directly to avoid timezone shifts.
  const records = transactions.filter((transaction) => transaction.date.slice(0, 7) === month);
  let incomePaise = 0;
  let expensePaise = 0;
  for (const transaction of records) {
    if (transaction.type === 'income') incomePaise += transaction.amountPaise;
    if (transaction.type === 'expense') expensePaise += transaction.amountPaise;
  }
  return { incomePaise, expensePaise, netPaise: incomePaise - expensePaise, transactionCount: records.length };
}

export function getMonthlySpending(transactions, month) {
  const [year, monthNumber] = month.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const daily = Array.from({ length: daysInMonth }, (_, index) => ({
    day: index + 1,
    amountPaise: 0,
  }));
  const categoryTotals = new Map();

  for (const transaction of transactions) {
    if (transaction.type !== 'expense' || transaction.date.slice(0, 7) !== month) continue;
    const day = Number(transaction.date.slice(8, 10));
    daily[day - 1].amountPaise += transaction.amountPaise;
    categoryTotals.set(transaction.category, (categoryTotals.get(transaction.category) ?? 0) + transaction.amountPaise);
  }

  const totalPaise = daily.reduce((total, entry) => total + entry.amountPaise, 0);
  const categories = Array.from(categoryTotals, ([category, amountPaise]) => ({
    category,
    amountPaise,
    percentage: totalPaise === 0 ? 0 : amountPaise / totalPaise * 100,
  })).sort((a, b) => b.amountPaise - a.amountPaise || a.category.localeCompare(b.category));

  return { daily, categories, totalPaise };
}
