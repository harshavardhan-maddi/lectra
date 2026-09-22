import React, { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const getInitialUser = () => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  };

  const [user, setUser] = useState(getInitialUser);
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [loading, setLoading] = useState(true);

  // Helper for silent background re-login if token expires on device
  const attemptSilentReAuth = async () => {
    try {
      const sessionStr = localStorage.getItem('auth_session');
      if (!sessionStr) return false;
      const { userId, password } = JSON.parse(sessionStr);
      if (!userId || !password) return false;

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, password }),
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        return true;
      }
    } catch (err) {
      console.error('Silent re-auth failed:', err);
    }
    return false;
  };

  // Set auth state on mount and preserve device session
  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('token');
      if (storedToken === 'watchman-session-token') {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          try {
            setUser(JSON.parse(storedUser));
            setToken(storedToken);
            setLoading(false);
            return;
          } catch (e) {}
        }
      }
      if (storedToken) {
        try {
          const res = await fetch('/api/auth/me', {
            headers: {
              'Authorization': `Bearer ${storedToken}`,
            },
          });
          
          if (res.ok) {
            const userData = await res.json();
            setUser(userData);
            localStorage.setItem('user', JSON.stringify(userData));
            setToken(storedToken);
          } else if (res.status === 401) {
            // Token expired; attempt silent re-login with saved device session credentials
            const reAuthSuccess = await attemptSilentReAuth();
            if (!reAuthSuccess) {
              // Only logout if credentials are no longer valid (e.g. account deleted/changed)
              logout();
            }
          }
        } catch (error) {
          console.error('Failed to verify token on boot (network offline/glitch):', error);
          // Network error: DO NOT logout. Preserve cached device session!
        }
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (userId, password) => {
    // 1. Check custom watchman accounts stored on device
    try {
      const customWatchmen = JSON.parse(localStorage.getItem('lectra_custom_watchmen') || '[]');
      const matchedCustomWatchman = customWatchmen.find(w => w.userId.toLowerCase() === userId.toLowerCase());
      if (matchedCustomWatchman && matchedCustomWatchman.password === password) {
        const watchmanUser = {
          id: matchedCustomWatchman.id || 90001,
          name: matchedCustomWatchman.name || 'Campus Gate Watchman',
          userId: matchedCustomWatchman.userId,
          role: 'WATCHMAN',
          className: null,
        };
        const customToken = `watchman-token-${matchedCustomWatchman.userId}`;
        localStorage.setItem('token', customToken);
        localStorage.setItem('user', JSON.stringify(watchmanUser));
        localStorage.setItem('auth_session', JSON.stringify({ userId, password }));
        setToken(customToken);
        setUser(watchmanUser);
        return watchmanUser;
      }
    } catch (e) {
      console.warn('Custom watchman check error:', e);
    }

    // 2. Default Watchman Gate Security fallback credentials
    if (userId.toLowerCase() === 'watchman' || userId.toLowerCase() === 'security' || userId.toLowerCase() === 'gate') {
      if (password === 'watchman' || password === 'watchman123' || password === 'security123' || password === 'password123' || password === 'gate123') {
        const watchmanUser = {
          id: 9999,
          name: 'Main Gate Security (Watchman)',
          userId: 'watchman',
          role: 'WATCHMAN',
          className: null,
        };
        localStorage.setItem('token', 'watchman-session-token');
        localStorage.setItem('user', JSON.stringify(watchmanUser));
        localStorage.setItem('auth_session', JSON.stringify({ userId, password }));
        setToken('watchman-session-token');
        setUser(watchmanUser);
        return watchmanUser;
      }
    }

    // 3. Authenticate with backend API
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, password }),
      });

      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || 'Login failed');
        }

        // Store token, user profile, and session credentials on device
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('auth_session', JSON.stringify({ userId, password }));

        setToken(data.token);
        setUser(data.user);
        return data.user;
      } else {
        const text = await res.text();
        const snippet = text.slice(0, 100).replace(/<[^>]*>/g, '').trim();
        throw new Error(
          `Server returned an invalid response (HTTP ${res.status}${snippet ? `: ${snippet}` : ''}). Verify your backend is running and the database is configured.`
        );
      }
    } catch (error) {
      throw new Error(error.message || 'Failed to connect to authentication server. Is the database running?');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('auth_session');
    setToken('');
    setUser(null);
  };

  const [selectedDepartment, setSelectedDepartmentState] = useState(
    localStorage.getItem('lectra_selected_department') || 'ALL'
  );

  const setSelectedDepartment = (dept) => {
    setSelectedDepartmentState(dept);
    if (dept) {
      localStorage.setItem('lectra_selected_department', dept);
    } else {
      localStorage.removeItem('lectra_selected_department');
    }
  };

  const registerUser = async (name, userId, password, role, className, department) => {
    // If registering a Watchman, cache in local custom watchmen registry
    if (role === 'WATCHMAN') {
      const customWatchmen = JSON.parse(localStorage.getItem('lectra_custom_watchmen') || '[]');
      if (customWatchmen.some(w => w.userId.toLowerCase() === userId.toLowerCase())) {
        throw new Error('Watchman User ID already exists');
      }
      const newWatchman = {
        id: 90000 + Math.floor(Math.random() * 9000),
        name,
        userId,
        password,
        role: 'WATCHMAN',
        className: null,
        department: null,
        createdAt: new Date().toISOString()
      };
      customWatchmen.unshift(newWatchman);
      localStorage.setItem('lectra_custom_watchmen', JSON.stringify(customWatchmen));

      // Also call backend to persist in database system_settings
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ name, userId, password, role, className, department: null }),
        });
        if (res.ok) {
          const data = await res.json();
          return data.user;
        }
      } catch (e) {
        console.warn('Backend watchman persist notice:', e);
      }
      return newWatchman;
    }

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ name, userId, password, role, className, department }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Registration failed');
    }
    return data.user;
  };

  const deleteUser = async (id) => {
    // Check if watchman in local registry
    try {
      const customWatchmen = JSON.parse(localStorage.getItem('lectra_custom_watchmen') || '[]');
      const filtered = customWatchmen.filter(w => w.id !== id);
      if (filtered.length !== customWatchmen.length) {
        localStorage.setItem('lectra_custom_watchmen', JSON.stringify(filtered));
      }
    } catch (e) {
      console.warn('Local watchman delete notice:', e);
    }

    const res = await fetch(`/api/auth/users/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Delete user failed');
    }
    return data;
  };

  const updateUserAdmin = async (id, userData) => {
    const res = await fetch(`/api/auth/users/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(userData),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to update user');
    }

    // If the updated user is the currently logged-in user, keep local session in sync
    if (user && data.user && data.user.id === user.id) {
      const updatedUser = { ...user, ...data.user };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    }

    return data.user;
  };

  const getUsersList = async (departmentFilter) => {
    let users = [];
    try {
      let url = '/api/auth/users';
      if (departmentFilter && departmentFilter !== 'ALL') {
        url += `?department=${encodeURIComponent(departmentFilter)}`;
      }
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (res.ok) {
        users = await res.json();
      }
    } catch (e) {
      console.warn('Backend users fetch error:', e);
    }

    // Merge custom watchmen from device cache so they always appear immediately
    try {
      const customWatchmen = JSON.parse(localStorage.getItem('lectra_custom_watchmen') || '[]');
      const userIds = new Set(users.map(u => u.userId.toLowerCase()));
      for (const w of customWatchmen) {
        if (!userIds.has(w.userId.toLowerCase())) {
          users.push({
            id: w.id,
            name: w.name,
            userId: w.userId,
            role: 'WATCHMAN',
            className: null,
            department: null,
            createdAt: w.createdAt || new Date().toISOString()
          });
        }
      }
    } catch (e) {
      console.warn('Local watchmen merge error:', e);
    }

    return users;
  };

  const getDepartmentsList = async () => {
    try {
      const res = await fetch('/api/auth/departments', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Failed to fetch departments:', e);
    }
    return ['Department of CSE(emerging Technologies)'];
  };

  const updateProfile = async (name, userId, password) => {
    const res = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ name, userId, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to update profile');
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));

    if (password) {
      localStorage.setItem('auth_session', JSON.stringify({ userId: data.user.userId, password }));
    } else {
      const existingSessionStr = localStorage.getItem('auth_session');
      if (existingSessionStr) {
        try {
          const existingSession = JSON.parse(existingSessionStr);
          localStorage.setItem('auth_session', JSON.stringify({ ...existingSession, userId: data.user.userId }));
        } catch (e) {}
      }
    }

    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const authenticateWithBiometrics = (jwtToken, userProfile) => {
    localStorage.setItem('token', jwtToken);
    localStorage.setItem('user', JSON.stringify(userProfile));
    setToken(jwtToken);
    setUser(userProfile);
  };

  const fetchWithAuth = async (url, options = {}) => {
    let currentToken = localStorage.getItem('token') || token;
    const headers = {
      ...(options.headers || {}),
      'Authorization': `Bearer ${currentToken}`,
    };

    let response = await fetch(url, { ...options, headers });

    if (response.status === 401 && !url.includes('/api/auth/login')) {
      const refreshed = await attemptSilentReAuth();
      if (refreshed) {
        const newToken = localStorage.getItem('token');
        const newHeaders = {
          ...(options.headers || {}),
          'Authorization': `Bearer ${newToken}`,
        };
        response = await fetch(url, { ...options, headers: newHeaders });
      }
    }

    return response;
  };

  const value = {
    user,
    token,
    loading,
    selectedDepartment,
    setSelectedDepartment,
    login,
    logout,
    registerUser,
    updateUserAdmin,
    deleteUser,
    getUsersList,
    getDepartmentsList,
    updateProfile,
    authenticateWithBiometrics,
    attemptSilentReAuth,
    fetchWithAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
