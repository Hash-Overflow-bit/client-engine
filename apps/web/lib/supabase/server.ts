import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getPublicSupabaseConfig } from './config';
export async function createClient() {
  const config = getPublicSupabaseConfig();
  const cookieStore = await cookies();
  return createServerClient(config.url, config.publishableKey, { cookies: {
    getAll: () => cookieStore.getAll(),
    setAll: (cookiesToSet) => { try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch { /* A future auth proxy owns refresh writes. */ } },
  }});
}

/** Read-only page rendering may remain available before an operator configures Supabase. */
export async function createOptionalClient() {
  try {
    return await createClient();
  } catch (error) {
    if (error instanceof Error && error.message === 'Supabase public configuration is missing.') return null;
    throw error;
  }
}
