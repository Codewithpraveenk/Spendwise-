import { getPaymentOccurrences } from './planning.js';
import { ApiError } from '../services/authApi.js';

// Paid status follows the bill occurrence, while spending follows the expense date.
// Linked expenses are supplied by the server even when paid in another month.
export function getAccountOccurrences(schedules, payments, month, today) {
  const bySchedule = new Map(schedules.map((schedule) => [schedule.id, schedule]));
  const links = new Map();
  const transactionIds = new Set();
  for (const payment of payments) {
    const schedule = bySchedule.get(payment.schedule);
    if (!schedule || payment.billMonth !== month || month < schedule.startMonth || (schedule.endMonth && month > schedule.endMonth) || links.has(payment.schedule) || transactionIds.has(payment.transaction) || !payment.expense || payment.expense.id !== payment.transaction || payment.expense.type !== 'expense') {
      throw new ApiError('Payment history is inconsistent. Reload account records before continuing.', { code: 'INVALID_RESPONSE' });
    }
    links.set(payment.schedule, payment);
    transactionIds.add(payment.transaction);
  }
  const adapted = schedules.map((schedule) => ({ ...schedule, paidTransactions: links.has(schedule.id) ? { [month]: links.get(schedule.id).transaction } : {} }));
  return getPaymentOccurrences(adapted, payments.map((payment) => payment.expense), month, today).map((occurrence) => ({ ...occurrence, recordedPayment: links.get(occurrence.id), hasPaymentHistory: occurrence.hasPaymentHistory || links.has(occurrence.id) }));
}
