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
// Attempts Supabase magic-link invite email. If email sending fails
// (e.g. SMTP not configured or rate limits), it generates a direct
// activation link so the admin can copy and send it to the user.
export async function inviteUser(data: {
  email: string;
  full_name: string;
  role: UserRole;
  location_id?: string;
}): Promise<{
  error: string | null;
  inviteLink?: string | null;
  emailSent?: boolean;
}> {
  try {
    const adminSupabase = createAdminClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://psmi-app.vercel.app';
    const redirectTo = `${siteUrl}/set-password`;

    let userId: string | null = null;
    let emailSent = false;
    let inviteLink: string | null = null;

    // 1. Try sending email invite via Supabase
    try {
      const { data: inviteData, error: inviteError } = await adminSupabase.auth.admin.inviteUserByEmail(
        data.email,
        {
          redirectTo,
          data: {
            full_name: data.full_name,
          },
        }
      );

      if (!inviteError && inviteData?.user?.id) {
        userId = inviteData.user.id;
        emailSent = true;
      }
    } catch {
      // Supabase email service may fail if custom SMTP is not set up
    }

    // 2. If email sending failed, use generateLink so the user is still created and gets a direct link
    if (!userId) {
      const { data: linkData, error: linkError } = await adminSupabase.auth.admin.generateLink({
        type: 'invite',
        email: data.email,
        options: {
          redirectTo,
          data: {
            full_name: data.full_name,
          },
        },
      });

      if (linkError) {
        const rawMsg = linkError.message;
        const cleanMsg =
          !rawMsg || rawMsg === '{}'
            ? 'Failed to create user. This email may already be registered or email provider failed.'
            : rawMsg;
        return { error: cleanMsg };
      }

      if (linkData?.user?.id) {
        userId = linkData.user.id;
        inviteLink = linkData.properties?.action_link || null;
      }
    }

    // 3. Upsert profile with assigned role and location
    if (userId) {
      const { error: profileError } = await adminSupabase
        .from('profiles')
        .upsert({
          id: userId,
          full_name: data.full_name,
          role: data.role,
          location_id: data.location_id || null,
        });

      if (profileError) {
        return {
          error: `User account created, but profile update failed: ${profileError.message}`,
          inviteLink,
          emailSent,
        };
      }
    }

    return { error: null, inviteLink, emailSent };
  } catch (err: any) {
    const msg = err?.message && err.message !== '{}' ? err.message : 'An unexpected error occurred while inviting user.';
    return { error: msg };
  }
}
