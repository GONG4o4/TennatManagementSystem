import api from './apiClient';

// Backend contract required: GET /leases, POST /leases, PUT /leases/:id
export const getLeases = async () => {
  const response = await api.get('/leases');
  return response.data;
};

export const createLease = async (payload) => {
  const response = await api.post('/leases', payload);
  return response.data;
};
