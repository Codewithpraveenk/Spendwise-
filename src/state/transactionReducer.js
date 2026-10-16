export function transactionReducer(state, action) {
  switch (action.type) {
    case 'add':
      if (state.records.length >= 10000 || state.records.some((record) => record.id === action.record.id)) return state;
      return { ...state, records: [...state.records, action.record] };
    case 'update':
      return { ...state, records: state.records.map((record) => record.id === action.record.id ? action.record : record) };
    case 'delete': {
      const index = state.records.findIndex((record) => record.id === action.id);
      if (index === -1) return state;
      return { records: state.records.filter((record) => record.id !== action.id), lastDeleted: { record: state.records[index], index } };
    }
    case 'undo': {
      if (!state.lastDeleted || state.records.length >= 10000) return state;
      const records = [...state.records];
      if (!records.some((record) => record.id === state.lastDeleted.record.id)) records.splice(state.lastDeleted.index, 0, state.lastDeleted.record);
      return { records, lastDeleted: null };
    }
    case 'restore':
      return { records: structuredClone(action.records), lastDeleted: null };
    default:
      return state;
  }
}
