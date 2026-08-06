// ============================================================
// PSMI System — Supabase Browser Client
// ============================================================
// Use this client in Client Components (hooks, event handlers).
// ============================================================

import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/lib/types/database';

export function createClient() {
  return createBrowserClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
