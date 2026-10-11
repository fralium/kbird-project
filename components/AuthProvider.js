import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { api, AUTH_EXPIRED_EVENT } from '@/utils/api';

const AuthContext = createContext();

const SKIP_AUTO_LOGIN_KEY = 'kbird-skip-auto-login';
const APP_MODE_KEY = 'kbird-app-mode';

const defaultAppMode = {
  singleUserMode: true,
  registrationEnabled: false,
  autoLogin: true,
};

function readCachedAppMode() {
  if (typeof window === 'undefined') return defaultAppMode;
  try {
    const raw = sessionStorage.getItem(APP_MODE_KEY);
    if (!raw) return defaultAppMode;
    const parsed = JSON.parse(raw);
    return {
      singleUserMode: Boolean(parsed.singleUserMode),
      registrationEnabled: Boolean(parsed.registrationEnabled),
      autoLogin: Boolean(parsed.autoLogin),
    };
  } catch {
    return defaultAppMode;
  }
}

function writeCachedAppMode(mode) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(APP_MODE_KEY, JSON.stringify(mode));
  } catch {
    // ignore
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [appMode, setAppMode] = useState(defaultAppMode);

  // 登录 - 使用 useCallback 稳定函数引用
  const login = useCallback(async (usernameOrEmail, password) => {
    try {
      const data = await api.users.login(
        { usernameOrEmail, password },
        { skipAuthHandling: true }
      );

      if (data.success && data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user || data.data || null));
        sessionStorage.removeItem(SKIP_AUTO_LOGIN_KEY);

        setToken(data.token);
        setUser(data.user || data.data || null);

        return { success: true, user: data.user || data.data || null };
      }
      return { success: false, message: data.message || '登录失败' };
    } catch (error) {
      console.error('登录错误:', error);
      return { success: false, message: error.message || '网络错误，请重试' };
    }
  }, []);

  const clearAuthState = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  }, []);

  const logout = useCallback(() => {
    sessionStorage.setItem(SKIP_AUTO_LOGIN_KEY, '1');
    clearAuthState();
    if (typeof window !== 'undefined') {
      // 单机自用：退回首页即可；多用户：去登录页
      const mode = readCachedAppMode();
      window.location.assign(mode.singleUserMode ? '/' : '/login');
    }
  }, [clearAuthState]);

  const getAuthHeaders = useCallback(() => {
    if (!token) return {};
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }, [token]);

  const refreshUser = useCallback(async () => {
    const t = token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
    if (!t) return;
    try {
      const data = await api.users.getProfile();
      if (data.success && data.data) {
        setUser(data.data);
        if (typeof window !== 'undefined') {
          localStorage.setItem('user', JSON.stringify(data.data));
        }
      }
    } catch (e) {
      console.error('刷新用户信息失败', e);
    }
  }, [token]);

  const setUserData = useCallback((userData) => {
    setUser(userData || null);
    if (typeof window !== 'undefined') {
      if (userData) {
        localStorage.setItem('user', JSON.stringify(userData));
      } else {
        localStorage.removeItem('user');
      }
    }
  }, []);

  /** 注册/外部登录成功后同步 token + user，避免只写 localStorage 导致 isAuthenticated 仍为 false */
  const setAuthSession = useCallback((nextToken, userData) => {
    if (typeof window !== 'undefined') {
      if (nextToken) {
        localStorage.setItem('token', nextToken);
      }
      if (userData) {
        localStorage.setItem('user', JSON.stringify(userData));
      } else if (userData === null) {
        localStorage.removeItem('user');
      }
      sessionStorage.removeItem(SKIP_AUTO_LOGIN_KEY);
    }
    if (nextToken) setToken(nextToken);
    if (userData !== undefined) setUser(userData || null);
  }, []);

  /** 本机自动登录（初始化完成后 / token 过期后可再调） */
  const ensureLocalSession = useCallback(async () => {
    if (typeof window === 'undefined') return { success: false };
    if (sessionStorage.getItem(SKIP_AUTO_LOGIN_KEY) === '1') {
      return { success: false, skipped: true };
    }
    try {
      const data = await api.users.localSession({ skipAuthHandling: true });
      if (data?.success && data.token) {
        setAuthSession(data.token, data.user || null);
        return { success: true, user: data.user || null };
      }
      return { success: false, message: data?.message };
    } catch (error) {
      return { success: false, message: error?.message || '本机自动登录失败' };
    }
  }, [setAuthSession]);

  const isAuthenticatedValue = useMemo(() => {
    return !!token && !!user;
  }, [token, user]);

  const isAuthenticated = useCallback(() => {
    return isAuthenticatedValue;
  }, [isAuthenticatedValue]);

  const hasInitializedRef = useRef(false);
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    const initAuth = async () => {
      if (typeof window === 'undefined') {
        setLoading(false);
        return;
      }

      setAppMode(readCachedAppMode());

      const tryLocalSession = async () => {
        await ensureLocalSession();
      };

      try {
        // 拉取单机模式开关（失败则沿用缓存/默认）
        try {
          const status = await api.init.checkStatus();
          if (status && typeof status === 'object') {
            const nextMode = {
              singleUserMode: status.singleUserMode !== false,
              registrationEnabled: Boolean(status.registrationEnabled),
              autoLogin: Boolean(status.autoLogin),
            };
            setAppMode(nextMode);
            writeCachedAppMode(nextMode);

            const storedToken = localStorage.getItem('token');
            const storedUser = localStorage.getItem('user');
            const skipAutoLogin = sessionStorage.getItem(SKIP_AUTO_LOGIN_KEY) === '1';

            if (storedToken) {
              setToken(storedToken);

              if (storedUser) {
                try {
                  const userData = JSON.parse(storedUser);
                  setUser(userData);
                } catch {
                  // Ignore stale cached user payload and continue with token verification.
                }
              }

              try {
                const data = await api.users.getProfile({ skipAuthHandling: true });
                if (data.success) {
                  setUser(data.data || null);
                }
              } catch (error) {
                if (Number(error?.status) === 401) {
                  // 换库 / 新实例后旧 token 失效，清掉后走本机自动登录
                  clearAuthState();
                  if (!skipAutoLogin && nextMode.autoLogin && status.initialized) {
                    await tryLocalSession();
                  }
                } else {
                  console.warn('个人资料刷新失败，保留本地登录状态:', error?.message || error);
                }
              }
            } else {
              setUser(null);
              localStorage.removeItem('user');

              if (!skipAutoLogin && nextMode.autoLogin && status.initialized) {
                await tryLocalSession();
              }
            }
            return;
          }
        } catch {
          // fall through to token-only path
        }

        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');
        const skipAutoLogin = sessionStorage.getItem(SKIP_AUTO_LOGIN_KEY) === '1';
        const cachedMode = readCachedAppMode();

        if (storedToken) {
          setToken(storedToken);

          if (storedUser) {
            try {
              const userData = JSON.parse(storedUser);
              setUser(userData);
            } catch {
              // Ignore stale cached user payload and continue with token verification.
            }
          }

          try {
            const data = await api.users.getProfile({ skipAuthHandling: true });
            if (data.success) {
              setUser(data.data || null);
            }
          } catch (error) {
            if (Number(error?.status) === 401) {
              clearAuthState();
              if (!skipAutoLogin && cachedMode.autoLogin !== false) {
                await tryLocalSession();
              }
            } else {
              console.warn('个人资料刷新失败，保留本地登录状态:', error?.message || error);
            }
          }
        } else {
          setUser(null);
          localStorage.removeItem('user');
          if (!skipAutoLogin && cachedMode.autoLogin !== false) {
            await tryLocalSession();
          }
        }
      } catch (error) {
        console.error('认证初始化失败:', error);
        clearAuthState();
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, [clearAuthState, ensureLocalSession]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onAuthExpired = async (event) => {
      clearAuthState();
      const message = event?.detail?.message || '登录状态已失效，请重新登录';
      const mode = readCachedAppMode();
      if (mode.singleUserMode && mode.autoLogin) {
        sessionStorage.removeItem(SKIP_AUTO_LOGIN_KEY);
        const result = await ensureLocalSession();
        if (result.success) {
          return;
        }
      }
      sessionStorage.setItem('auth-expired-message', message);
      if (window.location.pathname !== '/login') {
        window.location.assign(mode.singleUserMode ? '/' : '/login');
      }
    };

    window.addEventListener(AUTH_EXPIRED_EVENT, onAuthExpired);
    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, onAuthExpired);
    };
  }, [clearAuthState, ensureLocalSession]);

  const contextValue = useMemo(
    () => ({
      user,
      token,
      loading,
      appMode,
      login,
      logout,
      getAuthHeaders,
      isAuthenticated,
      refreshUser,
      setUserData,
      setAuthSession,
      ensureLocalSession,
      clearAuthState,
    }),
    [user, token, loading, appMode, login, logout, getAuthHeaders, isAuthenticated, refreshUser, setUserData, setAuthSession, ensureLocalSession, clearAuthState]
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
