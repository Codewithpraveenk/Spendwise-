import { HttpError } from '../errors/HttpError.js';
import { categories, isCalendarDate } from '../models/index.js';

export const invalid = (message) => { throw new HttpError(400, 'INVALID_INPUT', message); };
export const isMonth = (value) => typeof value === 'string' && /^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(value);
export function todayInIndia() {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function checkDate(value) {
  if (typeof value !== 'string' || !isCalendarDate(value) || value > todayInIndia()) invalid('Choose a valid payment or transaction date from 2000 through today in India.');
}
export function checkId(value) {
  if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value)) invalid('Provide a valid record ID.');
  return value;
}
export function checkVersion(value) {
  if (!Number.isSafeInteger(value) || value < 0) invalid('Provide the current integer version of the record.');
  return value;
}
export function exactBody(body, fields) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((key) => !fields.includes(key))) invalid('Provide a JSON object containing only the documented fields.');
  return body;
}
const fields = {
  transactions: ['description', 'type', 'category', 'amountPaise', 'date'],
  budgets: ['month', 'category', 'limitPaise'],
  recurring: ['name', 'category', 'amountPaise', 'dueDay', 'startMonth', 'endMonth'],
};
export function validateRecord(kind, body, updating = false) {
  exactBody(body, [...fields[kind], ...(updating ? ['version'] : [])]);
  if (updating) checkVersion(body.version);
  const result = Object.fromEntries(fields[kind].filter((field) => field in body).map((field) => [field, body[field]]));
  const text = kind === 'transactions' ? 'description' : kind === 'recurring' ? 'name' : null;
  if (text) {
    if (typeof result[text] !== 'string' || !result[text].trim() || result[text].trim().length > 100) invalid(`${text} must contain 1–100 characters.`);
    result[text] = result[text].trim();
  }
  const money = kind === 'budgets' ? 'limitPaise' : 'amountPaise';
  if (!Number.isSafeInteger(result[money]) || result[money] < 1 || result[money] > 1_000_000_000) invalid('Money must be an integer from 1 to 1000000000 paise.');
  const type = kind === 'transactions' ? result.type : 'expense';
  if (typeof type !== 'string' || !Object.hasOwn(categories, type) || !categories[type].includes(result.category)) invalid('Choose a category that matches the transaction type.');
  if (kind === 'transactions') checkDate(result.date);
  if (kind === 'budgets' && !isMonth(result.month)) invalid('Use a valid YYYY-MM budget month.');
  if (kind === 'recurring') {
    if (!Number.isInteger(result.dueDay) || result.dueDay < 1 || result.dueDay > 31) invalid('dueDay must be an integer from 1 to 31.');
    if (!isMonth(result.startMonth) || (result.endMonth !== undefined && result.endMonth !== null && (!isMonth(result.endMonth) || result.endMonth < result.startMonth))) invalid('Provide a valid inclusive schedule month range.');
    result.endMonth ??= null;
  }
  return result;
}

export function listOptions(query) {
  if (Object.keys(query).some((key) => !['month', 'limit', 'cursor'].includes(key))) invalid('Supported query parameters are month, limit, and cursor.');
  if (query.month !== undefined && !isMonth(query.month)) invalid('Use a valid YYYY-MM month filter.');
  if (query.limit !== undefined && (typeof query.limit !== 'string' || !/^\d{1,3}$/.test(query.limit) || +query.limit < 1 || +query.limit > 100)) invalid('limit must be from 1 to 100.');
  if (query.cursor !== undefined) checkId(query.cursor);
  return { month: query.month, limit: Number(query.limit ?? 50), cursor: query.cursor };
}
