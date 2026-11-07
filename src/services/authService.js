import api from './apiClient';

// Required backend contract: POST /auth/login returns { user, accessToken }.
export const login = async ({ email, password }) => {
  const response = await api.post('/auth/login', { email, password });
  return response.data;
};

// Required backend contract: POST /auth/register creates users + role profile,
// hashes the password server-side, and returns { user, accessToken }.
export const register = async ({ name, email, password }) => {
  const response = await api.post('/auth/register', { name, email, password });
  return response.data;
};

// Required backend contract: POST /auth/password updates the current user's hash.
export const changePassword = async ({ currentPassword, newPassword }) => {
  const response = await api.post('/auth/password', { currentPassword, newPassword });
  return response.data;
};
