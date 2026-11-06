import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const hasSupabasePublicConfig = !!url && !!anon;
export const hasSupabaseAdminConfig = !!url && !!serviceKey;

/** Public client (anon key) — safe for the browser. Used for reads. */
export const supabasePublic = () => {
	if (!url || !anon) throw new Error('Supabase public env is not configured.');
	return createClient(url, anon);
};

/** Admin client (service role) — server-only. Used for inserts/deletes. */
export const supabaseAdmin = () => {
	if (!url || !serviceKey) throw new Error('Supabase admin env is not configured.');
	return createClient(url, serviceKey, { auth: { persistSession: false } });
};