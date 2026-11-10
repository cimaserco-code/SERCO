import React, { createContext, useState, useContext, useEffect } from 'react';
import { sercoApi } from '@/api/sercoClient';
import { supabase } from '@/lib/supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isInitialCheck, setIsInitialCheck] = useState(true);
  const [appPublicSettings, setAppPublicSettings] = useState({ id: 'supabase', public_settings: {} });

  useEffect(() => {
    // Si la URL contiene un token de recuperación y no estamos en /reset-password, redirigir
    if (window.location.hash.includes('type=recovery') && window.location.pathname !== '/reset-password') {
      window.location.href = '/reset-password' + window.location.hash;
      return;
    }

    // Check initial auth session
    checkUserAuth(true);

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY' && window.location.pathname !== '/reset-password') {
        window.location.href = '/reset-password' + window.location.hash;
        return;
      }

      if (session) {
        await checkUserAuth(false);
      } else {
        setUser(null);
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
        setAuthChecked(true);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const checkUserAuth = async (isInitial = false) => {
    try {
      if (isInitial) {
        setIsLoadingAuth(true);
      }
      const currentUser = await sercoApi.auth.me();
      if (currentUser) {
        setUser(currentUser);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
      if (isInitial) {
        setIsLoadingAuth(false);
        setIsInitialCheck(false);
      }
      setAuthChecked(true);
    } catch (error) {
      console.error('User auth check failed:', error);
      setUser(null);
      setIsAuthenticated(false);
      if (isInitial) {
        setIsLoadingAuth(false);
        setIsInitialCheck(false);
      }
      setAuthChecked(true);
    }
  };

  const logout = async (shouldRedirect = true) => {
    await sercoApi.auth.logout();
    setUser(null);
    setIsAuthenticated(false);
    if (shouldRedirect) {
      window.location.href = '/login';
    }
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  const checkAppState = async () => {
    // Mock to maintain compatibility with calling code
    setIsLoadingPublicSettings(false);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
