import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

const THEME_STORAGE_KEY = 'bibofit-theme';
const USER_THEME_STORAGE_PREFIX = 'bibofit-theme-user-';
const ThemeContext = createContext(null);
const isValidTheme = (value) => value === 'dark' || value === 'light';
const getUserThemeStorageKey = (userId) => `${USER_THEME_STORAGE_PREFIX}${userId}`;

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light';
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isValidTheme(savedTheme) ? savedTheme : 'light';
  });
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    const root = document.documentElement;
    const isDark = theme === 'dark';

    root.classList.toggle('dark', isDark);
    root.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    if (userId) {
      window.localStorage.setItem(getUserThemeStorageKey(userId), theme);
    }
  }, [theme, userId]);

  useEffect(() => {
    let cancelled = false;

    const applyThemeForSessionUser = async (sessionUser) => {
      if (!sessionUser?.id) {
        if (!cancelled) setUserId(null);
        return;
      }

      const currentUserId = sessionUser.id;
      if (!cancelled) setUserId(currentUserId);

      const savedUserTheme = window.localStorage.getItem(getUserThemeStorageKey(currentUserId));
      if (isValidTheme(savedUserTheme)) {
        if (!cancelled) setTheme(savedUserTheme);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('preferred_theme')
        .eq('user_id', currentUserId)
        .maybeSingle();

      if (error) {
        console.error('Error loading preferred_theme:', error);
        return;
      }

      const profileTheme = data?.preferred_theme;
      if (isValidTheme(profileTheme) && !cancelled) {
        setTheme(profileTheme);
      }
    };

    const bootstrapTheme = async () => {
      const { data } = await supabase.auth.getSession();
      await applyThemeForSessionUser(data?.session?.user || null);
    };

    bootstrapTheme();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
        await applyThemeForSessionUser(session?.user || null);
        return;
      }

      if (event === 'SIGNED_OUT' && !cancelled) {
        setUserId(null);
      }
    });

    return () => {
      cancelled = true;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const persistProfileTheme = async () => {
      if (!userId || !isValidTheme(theme)) return;

      const { error } = await supabase
        .from('profiles')
        .update({ preferred_theme: theme })
        .eq('user_id', userId);

      if (!cancelled && error) {
        console.error('Error saving preferred_theme:', error);
      }
    };

    persistProfileTheme();
    return () => {
      cancelled = true;
    };
  }, [theme, userId]);

  const value = useMemo(() => ({
    theme,
    isDark: theme === 'dark',
    setTheme,
    toggleTheme: () => setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark')),
  }), [theme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
