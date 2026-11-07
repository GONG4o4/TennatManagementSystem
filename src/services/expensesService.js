import api from './apiClient';

// Backend contract required: GET /expenses, POST /expenses, GET /expenses/summary
export const getExpenses = async () => {
  const response = await api.get('/expenses');
  return response.data;
};

export const createExpense = async (payload) => {
  const response = await api.post('/expenses', payload);
  return response.data;
};
