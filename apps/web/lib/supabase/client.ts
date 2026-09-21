'use client';
import { createBrowserClient } from '@supabase/ssr';
import { getPublicSupabaseConfig } from './config';
export function createClient() {
  const config = getPublicSupabaseConfig();
  return createBrowserClient(config.url, config.publishableKey);
}
