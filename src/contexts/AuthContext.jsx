import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

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
      
      const userRole = roleData?.roles?.role || 'client';
      const cleanProfile = profile ? { ...profile } : {};
      
      const fullUser = {
        ...sessionUser,
        ...cleanProfile,
        role: userRole.toLowerCase(),
      };

      console.log('✅ [AuthContext] User profile loaded:', fullUser.email);
      if (fullUser.tdee_kcal) {
          console.log(`🔥 [AuthContext] TDEE Detected: ${fullUser.tdee_kcal} kcal`);
      }
      setUser(fullUser);

    } catch (error) {
      console.error('❌ [AuthContext] Error fetching user profile:', error);
      setUser({ ...sessionUser, role: 'client' });
    } finally {
      setLoading(false);
    }
  };

  // Function to manually refresh user data (used by Onboarding)
  const refreshUser = async () => {
      if (user?.id) {
          // We construct a minimal session user object to pass to fetchUserProfile
          // preserving the ID and email from current state
          const minimalUser = { id: user.id, email: user.email };
          await fetchUserProfile(minimalUser);
      }
  };

  useEffect(() => {
    let mounted = true;

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
        console.error("Unexpected error during session fetch:", err);
        if (mounted) setLoading(false);
      }
    };

    fetchUserSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        await fetchUserProfile(session.user);
      } else if (event === 'SIGNED_OUT') {
        if (mounted) setUser(null);
      } else if (event === 'USER_UPDATED' && session) {
        await fetchUserProfile(session.user);
      }
    });

    return () => {
      mounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);
  
  const login = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { success: false, error: error.message };
      
      if (data.user) {
          // Explicitly fetch profile immediately after login
          await fetchUserProfile(data.user);
          return { success: true, user: data.user }; // Note: user state will be updated async
      }
      return { success: false, error: 'An unknown error occurred.' };
    } catch (err) {
      console.error("Login exception:", err);
      return { success: false, error: err.message || 'Login failed unexpectedly.' };
    }
  };

  const signup = async (email, password, fullName) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: 'https://bibofit.com/login',
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }
      
      return { success: true, user: data.user };
    } catch (err) {
      console.error("Signup exception:", err);
      return { success: false, error: err.message };
    }
  };

  const signInWithProvider = async (provider) => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider,
        options: {
          redirectTo: window.location.origin + '/dashboard',
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
    ensureDefaultTemplate
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