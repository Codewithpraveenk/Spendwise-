import { getMonthlySpending } from './finance.js';

export function getBudgetProgress(budgets, transactions, month) {
  const spending = getMonthlySpending(transactions, month);
  const spentByCategory = new Map(spending.categories.map((entry) => [entry.category, entry.amountPaise]));
  const items = budgets.filter((budget) => budget.month === month).map((budget) => {
    const spentPaise = spentByCategory.get(budget.category) ?? 0;
    const percentage = spentPaise / budget.limitPaise * 100;
    return {
      ...budget,
      spentPaise,
      remainingPaise: budget.limitPaise - spentPaise,
      percentage,
      status: spentPaise > budget.limitPaise ? 'over' : spentPaise === budget.limitPaise ? 'at-limit' : percentage >= 80 ? 'near' : 'within',
    };
  });
  const plannedCategories = new Set(items.map((item) => item.category));
  const unbudgeted = spending.categories.filter((entry) => !plannedCategories.has(entry.category));
  const limitPaise = items.reduce((sum, item) => sum + item.limitPaise, 0);
  const spentPaise = items.reduce((sum, item) => sum + item.spentPaise, 0);
  return { items, limitPaise, spentPaise, remainingPaise: limitPaise - spentPaise, unbudgeted, unbudgetedPaise: unbudgeted.reduce((sum, entry) => sum + entry.amountPaise, 0) };
}

export function getPaymentOccurrences(schedules, transactions, month, today) {
  const [year, monthNumber] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return schedules.filter((schedule) => schedule.startMonth <= month && (!schedule.endMonth || schedule.endMonth >= month)).map((schedule) => {
    // A payment due on the 31st falls on the final day of shorter months.
    const dueDate = `${month}-${String(Math.min(schedule.dueDay, lastDay)).padStart(2, '0')}`;
    const linkedId = schedule.paidTransactions[month];
    // A September bill can be paid in October; expense totals follow payment date.
    const linkedTransaction = transactions.find((record) => record.id === linkedId);
    const payment = linkedTransaction?.type === 'expense' && linkedTransaction.date <= today ? linkedTransaction : null;
    const status = payment ? 'paid' : dueDate < today ? 'overdue' : dueDate === today ? 'due-today' : 'upcoming';
    return { ...schedule, dueDate, status, paidDate: payment?.date, paidAmountPaise: payment?.amountPaise, linkedTransactionId: linkedTransaction?.id };
  }).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id));
}

export const paymentStatusLabels = {
  paid: 'Paid',
  overdue: 'Overdue',
  'due-today': 'Due today',
  upcoming: 'Upcoming',
};
