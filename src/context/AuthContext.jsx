import { createContext, useContext, useMemo, useState } from 'react';
import { login as loginRequest, register as registerRequest } from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const storedUser = localStorage.getItem('tenant_app_user');
      const token = localStorage.getItem('tenant_app_token');
      if (!storedUser || !token || token === 'demo-token') {
        localStorage.removeItem('tenant_app_user');
        localStorage.removeItem('tenant_app_token');
        return null;
      }

      const parsed = JSON.parse(storedUser);
      if (!['landlord', 'applicant', 'tenant'].includes(parsed.role)) {
        localStorage.removeItem('tenant_app_user');
        localStorage.removeItem('tenant_app_token');
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(false);

  const acceptSession = (payload) => {
    const userPayload = payload?.user;
    const token = payload?.accessToken || payload?.token;
    if (!userPayload || !['landlord', 'applicant', 'tenant'].includes(userPayload.role) || !token) {
      throw new Error('The authentication response must include a valid account role and access token.');
    }

    localStorage.setItem('tenant_app_user', JSON.stringify(userPayload));
    localStorage.setItem('tenant_app_token', token);
    setUser(userPayload);
    return userPayload;
  };

  const login = async ({ email, password }) => {
    setIsLoading(true);
    try {
      return acceptSession(await loginRequest({ email, password }));
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (formData) => {
    setIsLoading(true);
    try {
      return acceptSession(await registerRequest(formData));
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('tenant_app_user');
    localStorage.removeItem('tenant_app_token');
    setUser(null);
  };

  const syncUser = (userPayload) => {
    if (!userPayload || !['landlord', 'applicant', 'tenant'].includes(userPayload.role)) return;
    localStorage.setItem('tenant_app_user', JSON.stringify(userPayload));
    setUser(userPayload);
  };

  const value = useMemo(
    () => ({ user, isLoading, login, register, logout, syncUser }),
    [user, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
