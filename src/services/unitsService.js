import api from './apiClient';

// Backend contract required: GET /units, POST /units, PUT /units/:id
export const getUnits = async () => {
  const response = await api.get('/units');
  return response.data;
};

export const createUnit = async (payload) => {
  const response = await api.post('/units', payload);
  return response.data;
};

export const updateUnit = async (id, payload) => {
  const response = await api.put(`/units/${id}`, payload);
  return response.data;
};
