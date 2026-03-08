import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import {
  getAuthConfirmedRedirectUrl,
  getDashboardRedirectUrl,
} from '@/lib/authRedirects';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const syncProfileEmail = async (userId, authEmail, profileEmail) => {
    if (!userId || !authEmail) return;
    if (authEmail === profileEmail) return;

    const { error } = await supabase
      .from('profiles')
      .update({ email: authEmail })
      .eq('user_id', userId);

    if (error) {
      console.warn('[AuthContext] Could not sync profile email:', error.message);
    }
  };

  // Define fetchUserProfile outside useEffect so it can be reused
  const fetchUserProfile = async (sessionUser) => {
    try {
      console.log("🔄 [AuthContext] Fetching user profile...");
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', sessionUser.id)
        .single();
      
      if (profileError && profileError.code !== 'PGRST116') { 
        throw profileError;
      }
      
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('roles(role)')
        .eq('user_id', sessionUser.id)
        .single();

      if (roleError && roleError.code !== 'PGRST116') {
        throw roleError;
      }
      
      const userRole = roleData?.roles?.role || 'free';
      const cleanProfile = profile ? { ...profile } : {};

      // Fallback: si el perfil no tiene first_name/last_name, usar auth metadata
      // (cubre casos donde el trigger DB aún no los guardó)
      const userMeta = sessionUser.user_metadata || {};
      if (!cleanProfile.first_name && userMeta.first_name) {
        cleanProfile.first_name = userMeta.first_name;
      }
      if (!cleanProfile.last_name && userMeta.last_name) {
        cleanProfile.last_name = userMeta.last_name;
      }

      await syncProfileEmail(sessionUser.id, sessionUser.email, cleanProfile.email);
      if (sessionUser.email) {
        cleanProfile.email = sessionUser.email;
      }

      const fullUser = {
        ...cleanProfile,
        ...sessionUser,
        role: userRole.toLowerCase(),
      };

      console.log('✅ [AuthContext] User profile loaded:', fullUser.email);
      if (fullUser.tdee_kcal) {
          console.log(`🔥 [AuthContext] TDEE Detected: ${fullUser.tdee_kcal} kcal`);
      }
      setUser(fullUser);
      return fullUser;

    } catch (error) {
      console.error('❌ [AuthContext] Error fetching user profile:', error);
      const fallbackUser = { ...sessionUser, role: 'free' };
      setUser(fallbackUser);
      return fallbackUser;
    } finally {
      setLoading(false);
    }
  };

  // Function to manually refresh user data (used by Onboarding)
  const refreshUser = async () => {
      if (!user?.id) return;

      const { data: { user: sessionUser }, error } = await supabase.auth.getUser();
      if (error) {
        console.warn('[AuthContext] Could not refresh auth user:', error.message);
      }

      if (sessionUser) {
        await fetchUserProfile(sessionUser);
        return;
      }

      const minimalUser = { id: user.id, email: user.email };
      await fetchUserProfile(minimalUser);
  };

  useEffect(() => {
    let mounted = true;

    // Backstop: if the auth fetch timeout fires but the SDK doesn't propagate
    // the error fast enough, force-unblock loading. The fetch timeout in
    // customSupabaseClient (10s) normally fires first and cancels this timer
    // via the finally block below.
    const loadingTimeout = setTimeout(() => {
      if (mounted) {
        console.warn('[AuthContext] Session fetch timed out (backstop).');
        setLoading(false);
      }
    }, 12000);

    const fetchUserSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error("Error getting session:", error);
          if (mounted) setLoading(false);
          return;
        }

        if (session) {
          await fetchUserProfile(session.user);
        } else {
          if (mounted) setLoading(false);
        }
      } catch (err) {
        // The auth fetch timeout (fetchWithAuthTimeout) fired an AbortError.
        // The Supabase SDK handles the AbortError internally: it clears its
        // in-memory session and unblocks its request queue, so the next login
        // attempt will go through normally. We just need to unblock loading.
        console.error("Unexpected error during session fetch:", err);
        if (mounted) setLoading(false);
      } finally {
        clearTimeout(loadingTimeout);
      }
    };

    fetchUserSession();

    const handleAuthEvent = async (event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_IN' && session) {
        await fetchUserProfile(session.user);
        return;
      }

      if (event === 'SIGNED_OUT') {
        setUser(null);
        return;
      }

      if (event === 'USER_UPDATED' && session) {
        await fetchUserProfile(session.user);
      }
    };

    // Avoid awaiting Supabase calls inside the raw auth callback to prevent
    // auth lock contention inside auth-js (can cause stuck sessions on reload).
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setTimeout(() => {
        void handleAuthEvent(event, session);
      }, 0);
    });

    return () => {
      mounted = false;
      clearTimeout(loadingTimeout);
      authListener?.subscription?.unsubscribe();
    };
  }, []);
  
  const login = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { success: false, error: error.message };
      
      if (data.user) {
          // Explicitly fetch profile immediately after login
          const fullUser = await fetchUserProfile(data.user);
          return { success: true, user: fullUser };
      }
      return { success: false, error: 'An unknown error occurred.' };
    } catch (err) {
      console.error("Login exception:", err);
      return { success: false, error: err.message || 'Login failed unexpectedly.' };
    }
  };

  const signup = async (email, password, firstName, lastName, phone) => {
    try {
      const confirmationRedirectUrl = getAuthConfirmedRedirectUrl();
      const fullName = [firstName, lastName].filter(Boolean).join(' ');
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName || null,
            last_name: lastName || null,
            full_name: fullName || null,
            phone: phone || null,
          },
          emailRedirectTo: confirmationRedirectUrl,
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }
      
      return {
        success: true,
        user: data.user,
        session: data.session,
        needsEmailConfirmation: !data.session,
      };
    } catch (err) {
      console.error("Signup exception:", err);
      return { success: false, error: err.message };
    }
  };

  const resendSignupConfirmation = async (email) => {
    try {
      const confirmationRedirectUrl = getAuthConfirmedRedirectUrl();
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: confirmationRedirectUrl,
        },
      });

      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err) {
      console.error("Resend signup confirmation exception:", err);
      return { success: false, error: err.message };
    }
  };

  const signInWithProvider = async (provider) => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider,
        options: {
          redirectTo: getDashboardRedirectUrl(),
        }
      });
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err) {
      console.error("OAuth exception:", err);
      return { success: false, error: err.message };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.warn('Supabase signOut error:', error.message);
      }
    } catch (e) {
      console.error('An unexpected error occurred during signOut:', e);
    } finally {
      setUser(null);
    }
  };

  const ensureDefaultTemplate = async () => {
      try {
           const { data: template } = await supabase
             .from('diet_plans')
             .select('id')
             .eq('name', 'Mi última dieta')
             .eq('is_template', true)
             .maybeSingle();

           if (!template) {
               console.warn("Default template 'Mi última dieta' is missing.");
           }
      } catch (e) {
          console.error("Error ensuring default template:", e);
      }
  };

  const value = {
    user,
    loading,
    login,
    signup,
    signInWithProvider,
    signOut,
    refreshUser,
    ensureDefaultTemplate,
    resendSignupConfirmation
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
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
