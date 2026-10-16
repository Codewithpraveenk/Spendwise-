export const transactionSortOptions = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'amount-desc', label: 'Amount: high to low' },
  { value: 'amount-asc', label: 'Amount: low to high' },
];

export function selectTransactions(records, { month = 'all', type = 'all', category = 'all', query = '', sort = 'newest', id = '' } = {}) {
  const search = query.trim().toLocaleLowerCase('en-IN');
  const filtered = records.filter((record) => (
    (!id || record.id === id)
    &&
    (month === 'all' || record.date.slice(0, 7) === month)
    && (type === 'all' || record.type === type)
    && (category === 'all' || record.category === category)
    && `${record.description} ${record.category}`.toLocaleLowerCase('en-IN').includes(search)
  ));
  return filtered.sort((a, b) => {
    const dateOrder = b.date.localeCompare(a.date) || a.id.localeCompare(b.id);
    if (sort === 'oldest') return a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
    if (sort === 'amount-desc') return b.amountPaise - a.amountPaise || dateOrder;
    if (sort === 'amount-asc') return a.amountPaise - b.amountPaise || dateOrder;
    return dateOrder;
  });
}
