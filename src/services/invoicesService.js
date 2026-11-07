import api from './apiClient';

// Backend contract required: GET /invoices, POST /invoices/:id/verify, GET /invoices/:id/receipts
export const getInvoices = async () => {
  const response = await api.get('/invoices');
  return response.data;
};

export const verifyInvoice = async (id) => {
  const response = await api.post(`/invoices/${id}/verify`);
  return response.data;
};
