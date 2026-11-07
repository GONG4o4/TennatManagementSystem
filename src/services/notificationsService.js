import api from './apiClient';

// Backend contract required: GET /notifications, PATCH /notifications/:id/read
export const getNotifications = async () => {
  const response = await api.get('/notifications');
  return response.data;
};

export const markNotificationRead = async (id) => {
  const response = await api.patch(`/notifications/${id}/read`);
  return response.data;
};
