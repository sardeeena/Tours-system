import { supabase, isSupabaseConfigured, getSupabaseConfig, updateSupabaseCredentials } from '../services/supabaseClient';
import type { Database } from '../types/database.types';

export { supabase, isSupabaseConfigured, getSupabaseConfig, updateSupabaseCredentials };
export type { Database };
export default supabase;


