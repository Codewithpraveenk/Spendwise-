const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatINR(amountPaise) {
  return inrFormatter.format(amountPaise / 100);
}

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
});

export function formatDate(date) {
  return dateFormatter.format(new Date(`${date}T00:00:00Z`));
}

const monthFormatter = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export function formatMonth(month) {
  return monthFormatter.format(new Date(`${month}-01T00:00:00Z`));
}
