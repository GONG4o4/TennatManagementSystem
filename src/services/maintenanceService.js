import api from './apiClient';

// Backend contract required: GET /maintenance, PATCH /maintenance/:id/status, POST /maintenance
export const getMaintenanceRequests = async () => {
  const response = await api.get('/maintenance');
  return response.data;
};

export const updateMaintenanceStatus = async (id, status) => {
  const response = await api.patch(`/maintenance/${id}/status`, { status });
  return response.data;
};
