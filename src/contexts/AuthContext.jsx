import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error("Error getting session:", error);
        setLoading(false);
        return;
      }
      
      if (session) {
        await fetchUserProfile(session.user);
      } else {
        setLoading(false);
      }
    };

    fetchUserSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        await fetchUserProfile(session.user);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      } else if (event === 'USER_UPDATED' && session) {
        await fetchUserProfile(session.user);
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const fetchUserProfile = async (sessionUser) => {
    setLoading(true);
    try {
      // Step 1: Fetch the profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', sessionUser.id)
        .single();
      
      if (profileError && profileError.code !== 'PGRST116') { // PGRST116 means no rows found
        throw profileError;
      }
      
      // Step 2: Fetch the role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('roles(role)')
        .eq('user_id', sessionUser.id)
        .single();

      if (roleError && roleError.code !== 'PGRST116') {
        throw roleError;
      }
      
      const userRole = roleData?.roles?.role || 'client';
      
      const fullUser = {
        ...sessionUser,
        ...profile,
        role: userRole.toLowerCase(),
      };

      console.log('AuthContext: User profile loaded. Role:', fullUser.role);
      setUser(fullUser);

    } catch (error) {
      console.error('Error fetching user profile:', error);
      // Fallback in case of any error
      setUser({ ...sessionUser, role: 'client' });
    } finally {
      setLoading(false);
    }
  };
  
  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { success: false, error: error.message };
    if (data.user) {
        // Fetch user profile and role upon successful login
        const { data: roleData, error: roleError } = await supabase
            .from('user_roles')
            .select('roles(role)')
            .eq('user_id', data.user.id)
            .single();

        if (roleError && roleError.code !== 'PGRST116') {
             console.error("Profile fetch error on login:", roleError);
             return { success: true, user: { ...data.user, role: 'client' } };
        }
        
        const userRole = roleData?.roles?.role || 'client';
        const loggedInUser = { ...data.user, role: userRole.toLowerCase() };
        
        console.log('AuthContext: Login successful. Role detected:', loggedInUser.role);
        return { success: true, user: loggedInUser };
    }
    return { success: false, error: 'An unknown error occurred.' };
  };

  const signUp = async (email, password, fullName) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });
    if (error) return { success: false, error: error.message };
    return { success: true, user: data.user };
  };

  const signInWithProvider = async (provider) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: provider,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
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

  const value = {
    user,
    loading,
    login,
    signUp,
    signInWithProvider,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};