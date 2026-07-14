import { createBrowserClient } from '@supabase/ssr';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createClient(): any {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    // Return a mock client for build time
    return {
      auth: {
        getSession: async () => ({ data: { session: null } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signInWithPassword: async () => ({ error: new Error('Supabase not configured') }),
        signUp: async () => ({ data: { user: null }, error: new Error('Supabase not configured') }),
        signOut: async () => ({}),
      },
    };
  }
  
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

// Type for Supabase auth helpers
export type SupabaseClient = ReturnType<typeof createClient>;
