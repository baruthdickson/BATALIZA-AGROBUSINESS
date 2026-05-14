// ============================================================================
// SUPABASE CLIENT - Initializes connection to Supabase
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Helper kuangalia connection
export async function checkConnection() {
  try {
    const { data, error } = await supabase.from('roles').select('id').limit(1);
    return !error;
  } catch (e) {
    return false;
  }
}
