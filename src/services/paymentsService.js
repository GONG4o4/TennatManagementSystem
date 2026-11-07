import api from './apiClient';

// Backend contract required: GET /payments/methods, POST /payments/initiate, GET /payments/history
export const getPaymentMethods = async () => {
  const response = await api.get('/payments/methods');
  return response.data;
};

export const initiatePayment = async (payload) => {
  const response = await api.post('/payments/initiate', payload);
  return response.data;
};
