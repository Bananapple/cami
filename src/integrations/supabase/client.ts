import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const STUDIO_SLUG = import.meta.env.VITE_STUDIO_SLUG as string | undefined;

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
  // Pass studio slug so anon RLS policies can scope reads to the correct tenant.
  // The x-studio-slug header is read by PostgREST via current_setting('request.headers').
  global: {
    headers: STUDIO_SLUG ? { 'x-studio-slug': STUDIO_SLUG } : {},
  },
});