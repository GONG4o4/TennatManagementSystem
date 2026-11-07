import api from './apiClient';

// Backend contract required: GET /properties, POST /properties, PUT /properties/:id
export const getProperties = async () => {
  const response = await api.get('/properties');
  return response.data;
};

export const createProperty = async (payload) => {
  const response = await api.post('/properties', payload);
  return response.data;
};

export const updateProperty = async (id, payload) => {
  const response = await api.put(`/properties/${id}`, payload);
  return response.data;
};
