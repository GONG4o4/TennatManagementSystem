import api from './apiClient';

// Backend contract required: GET /applications, PATCH /applications/:id/status, GET /applications/:id/documents
export const getApplications = async () => {
  const response = await api.get('/applications');
  return response.data;
};

export const updateApplicationStatus = async (id, status) => {
  const response = await api.patch(`/applications/${id}/status`, { status });
  return response.data;
};
