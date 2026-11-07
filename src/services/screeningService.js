import api from './apiClient';

// Backend contract required: GET /screening-criteria, POST /screening-criteria, PUT /screening-criteria/:id
export const getScreeningCriteria = async () => {
  const response = await api.get('/screening-criteria');
  return response.data;
};

export const createScreeningCriterion = async (payload) => {
  const response = await api.post('/screening-criteria', payload);
  return response.data;
};
