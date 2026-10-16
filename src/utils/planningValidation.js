import { categoriesByType } from '../data/categories.js';
import { MAX_AMOUNT_PAISE, isValidDate, parseAmount } from './transactionValidation.js';

export function isValidMonth(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}$/.test(value) && isValidDate(`${value}-01`);
}

const validId = (value) => typeof value === 'string' && value.length > 0 && value.length <= 100;
const validAmount = (value) => Number.isSafeInteger(value) && value > 0 && value <= MAX_AMOUNT_PAISE;

export function isValidBudget(budget) {
  return budget !== null && typeof budget === 'object' && validId(budget.id)
    && isValidMonth(budget.month) && categoriesByType.expense.includes(budget.category) && validAmount(budget.limitPaise);
}

export function isValidBudgetList(budgets) {
  return Array.isArray(budgets) && budgets.length <= 10000 && budgets.every(isValidBudget)
    && new Set(budgets.map((budget) => budget.id)).size === budgets.length
    && new Set(budgets.map((budget) => `${budget.month}:${budget.category}`)).size === budgets.length;
}

export function isValidSchedule(schedule) {
  return schedule !== null && typeof schedule === 'object' && validId(schedule.id)
    && typeof schedule.name === 'string' && schedule.name.trim().length > 0 && schedule.name.length <= 100
    && categoriesByType.expense.includes(schedule.category) && validAmount(schedule.amountPaise)
    && Number.isInteger(schedule.dueDay) && schedule.dueDay >= 1 && schedule.dueDay <= 31
    && isValidMonth(schedule.startMonth)
    && (!schedule.endMonth || (isValidMonth(schedule.endMonth) && schedule.endMonth >= schedule.startMonth))
    && schedule.paidTransactions !== null && typeof schedule.paidTransactions === 'object' && !Array.isArray(schedule.paidTransactions)
    && Object.entries(schedule.paidTransactions).every(([month, id]) => isValidMonth(month) && validId(id)
      && month >= schedule.startMonth && (!schedule.endMonth || month <= schedule.endMonth));
}

export function isValidScheduleList(schedules) {
  if (!Array.isArray(schedules) || schedules.length > 1000 || !schedules.every(isValidSchedule)) return false;
  const links = schedules.flatMap((schedule) => Object.values(schedule.paidTransactions));
  return new Set(schedules.map((schedule) => schedule.id)).size === schedules.length && new Set(links).size === links.length;
}

export function validateBudgetForm(values, budgets, editingId) {
  const errors = {};
  if (!isValidMonth(values.month)) errors.month = 'Choose a month between January 2000 and December 2100.';
  if (!categoriesByType.expense.includes(values.category)) errors.category = 'Choose an expense category.';
  if (parseAmount(values.amount) === null) errors.amount = 'Enter a limit from ₹0.01 to ₹1,00,00,000 with up to two decimal places.';
  if (budgets.some((budget) => budget.id !== editingId && budget.month === values.month && budget.category === values.category)) errors.category = 'This category already has a budget for this month. Edit its existing limit.';
  return errors;
}

export function validateScheduleForm(values, paidTransactions = {}) {
  const errors = {};
  if (!values.name.trim() || values.name.trim().length > 100) errors.name = 'Enter a name between 1 and 100 characters.';
  if (!categoriesByType.expense.includes(values.category)) errors.category = 'Choose an expense category.';
  if (parseAmount(values.amount) === null) errors.amount = 'Enter an amount from ₹0.01 to ₹1,00,00,000 with up to two decimal places.';
  if (!/^\d{1,2}$/.test(values.dueDay) || Number(values.dueDay) < 1 || Number(values.dueDay) > 31) errors.dueDay = 'Enter a day from 1 to 31.';
  if (!isValidMonth(values.startMonth)) errors.startMonth = 'Choose a valid starting month.';
  if (values.endMonth && (!isValidMonth(values.endMonth) || values.endMonth < values.startMonth)) errors.endMonth = 'End month must be on or after the starting month.';
  const linkedMonths = Object.keys(paidTransactions);
  if (linkedMonths.some((month) => month < values.startMonth)) errors.startMonth = 'Keep months with linked payments inside the schedule.';
  if (values.endMonth && linkedMonths.some((month) => month > values.endMonth)) errors.endMonth = 'Keep months with linked payments inside the schedule.';
  return errors;
}
