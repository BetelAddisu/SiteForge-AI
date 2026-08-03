/**
 * Server-side Supabase client factory.
 *
 * Uses @supabase/ssr with cookie storage so API routes and server components
 * can authenticate the current user from their session cookies.
 * Single source of truth — routes should import this instead of re-implementing
 * the cookie wiring locally.
 *
 * Usage:
 *   import { createServerSupabaseClient } from '@/lib/database/server-supabase';
 *   const supabase = await createServerSupabaseClient();
 *   const { data: { user }, error } = await supabase.auth.getUser();
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            try {
              cookieStore.set(name, value, options);
            } catch {
              // Ignore errors in read-only context
            }
          });
        },
      },
    }
  );
}
