'use server';

// ============================================================
// PSMI System — User Management Server Actions
// ============================================================

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Profile, UserRole } from '@/lib/types/database';

export async function listUsers(): Promise<{
  data: (Profile & { location_name?: string })[];
  error: string | null;
}> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('profiles')
    .select(
      `
      *,
      locations(name)
    `
    )
    .order('created_at', { ascending: false });

  if (error) {
    return { data: [], error: error.message };
  }

  const users = (data || []).map((u) => ({
    ...u,
    location_name:
      (u.locations as unknown as { name: string })?.name || undefined,
  }));

  return { data: users, error: null };
}

export async function updateUserRole(data: {
  user_id: string;
  new_role: UserRole;
}): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('profiles')
    .update({ role: data.new_role })
    .eq('id', data.user_id);

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

export async function assignUserLocation(data: {
  user_id: string;
  location_id: string;
}): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('profiles')
    .update({ location_id: data.location_id })
    .eq('id', data.user_id);

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

// ── Invite a new user (invite-only auth) ──────────────────────
// Sends a Supabase magic-link invite email. The user sets their
// password on first login. Requires SUPABASE_SERVICE_ROLE_KEY.
export async function inviteUser(data: {
  email: string;
  full_name: string;
  role: UserRole;
  location_id?: string;
}): Promise<{ error: string | null }> {
  const adminSupabase = createAdminClient();

  const { data: inviteData, error: inviteError } = await adminSupabase.auth.admin.inviteUserByEmail(
    data.email,
    {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/set-password`,
      data: {
        full_name: data.full_name,
      },
    }
  );

  if (inviteError) {
    return { error: inviteError.message };
  }

  // Update the auto-created profile with the intended role and location
  if (inviteData?.user?.id) {
    await adminSupabase
      .from('profiles')
      .update({
        full_name: data.full_name,
        role: data.role,
        location_id: data.location_id || null,
      })
      .eq('id', inviteData.user.id);
  }

  return { error: null };
}
