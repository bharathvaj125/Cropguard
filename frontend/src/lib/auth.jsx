import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, session, setUnauthorizedHandler } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // "loading" until we know whether the stored token is still valid.
  const [loading, setLoading] = useState(Boolean(session.token));

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    if (!session.token) return;
    api
      .get('/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => session.clear())
      .finally(() => setLoading(false));
  }, []);

  const accept = useCallback((data) => {
    session.set(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAdmin: user?.role === 'admin',
      login: async (email, password) => accept(await api.post('/auth/login', { email, password })),
      register: async (form) => accept(await api.post('/auth/register', form)),
      updateProfile: async (form) => {
        const data = await api.patch('/auth/me', form);
        setUser(data.user);
      },
      changePassword: async (currentPassword, newPassword) =>
        accept(await api.post('/auth/change-password', { currentPassword, newPassword })),
      deleteAccount: async (password) => {
        await api.delete('/auth/me', { password });
        session.clear();
        setUser(null);
      },
      logout: () => {
        session.clear();
        setUser(null);
      },
    }),
    [user, loading, accept],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
