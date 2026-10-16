import { categoriesByType } from '../data/categories.js';

export const MAX_AMOUNT_PAISE = 1000000000;

export function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value && value >= '2000-01-01' && value <= '2100-12-31';
}

export function getToday() {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const read = (type) => parts.find((part) => part.type === type).value;
  return `${read('year')}-${read('month')}-${read('day')}`;
}

export function parseAmount(value) {
  // Parse rupees as text, then combine whole rupees and paise without rounding.
  if (typeof value !== 'string' || !/^\d{1,8}(\.\d{1,2})?$/.test(value.trim())) return null;
  const [rupees, fraction = ''] = value.trim().split('.');
  const amount = Number(rupees) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(amount) && amount > 0 && amount <= MAX_AMOUNT_PAISE ? amount : null;
}

export function validateTransactionForm(values, today = getToday()) {
  const errors = {};
  if (!values.description.trim() || values.description.trim().length > 100) errors.description = 'Enter a description between 1 and 100 characters.';
  if (parseAmount(values.amount) === null) errors.amount = 'Enter an amount from ₹0.01 to ₹1,00,00,000 with up to two decimal places.';
  if (!isValidDate(values.date) || values.date > today) errors.date = 'Choose a valid date from 1 January 2000 through today.';
  if (!categoriesByType[values.type]) errors.type = 'Choose income or expense.';
  if (!categoriesByType[values.type]?.includes(values.category)) errors.category = 'Choose a category that matches the transaction type.';
  return errors;
}

export function isValidTransaction(record) {
  return record !== null && typeof record === 'object'
    && typeof record.id === 'string' && record.id.length > 0 && record.id.length <= 100
    && typeof record.description === 'string' && record.description.trim().length > 0 && record.description.length <= 100
    && isValidDate(record.date)
    && categoriesByType[record.type]?.includes(record.category) === true
    && Number.isSafeInteger(record.amountPaise) && record.amountPaise > 0 && record.amountPaise <= MAX_AMOUNT_PAISE;
}

export function isValidTransactionList(records) {
  return Array.isArray(records) && records.length <= 10000
    && records.every(isValidTransaction)
    && new Set(records.map((record) => record.id)).size === records.length;
}
