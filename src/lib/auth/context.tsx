'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { createClient } from '@/lib/database/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  supabaseId: string;
}

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  updateProfile: (data: { name?: string; email?: string }) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  // Fetch user profile from our users table
  const fetchUserProfile = async (supabaseUserId: string) => {
    try {
      const response = await fetch(`/api/users/${supabaseUserId}`);
      if (response.ok) {
        const data = await response.json();
        return data.user;
      }
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
    }
    return null;
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      const session = data.session;
      setSession(session);
      if (session?.user) {
        // Fetch our app user profile
        fetchUserProfile(session.user.id).then((profile) => {
          setUser(profile ? {
            id: profile.id,
            supabaseId: profile.supabaseId,
            email: profile.email,
            name: profile.name,
            avatar: null,
          } : session.user ? {
            id: session.user.id,
            supabaseId: session.user.id,
            email: session.user.email || '',
            name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
            avatar: session.user.user_metadata?.avatar_url || null,
          } : null);
          setLoading(false);
        });
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: string, session: Session | null) => {
      setSession(session as Session | null);
      if (session?.user) {
        const profile = await fetchUserProfile(session.user.id);
        setUser(profile ? {
          id: profile.id,
          supabaseId: profile.supabaseId,
          email: profile.email,
          name: profile.name,
          avatar: null,
        } : {
          id: session.user.id,
          supabaseId: session.user.id,
          email: session.user.email || '',
          name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
          avatar: session.user.user_metadata?.avatar_url || null,
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message || null };
  };

  const signUp = async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        data: { full_name: name }
      }
    });
    
    if (!error && data.user) {
      // Create user profile in our database
      await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supabaseId: data.user.id,
          email,
          name,
        }),
      });
    }
    
    return { error: error?.message || null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  const updateProfile = async (data: { name?: string; email?: string }) => {
    if (!user?.id) return { error: 'Not authenticated' };
    
    try {
      const response = await fetch(`/api/users/${user.supabaseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        return { error: 'Failed to update profile' };
      }
      
      const updated = await response.json();
      setUser(prev => prev ? { ...prev, name: updated.user?.name || prev.name } : null);
      return { error: null };
    } catch {
      return { error: 'Failed to update profile' };
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
