'use server';

// ============================================================
// PSMI System — User Management Server Actions
// ============================================================

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Profile, UserRole } from '@/lib/types/database';

export type UserProfileWithAuth = Profile & {
  location_name?: string;
  email?: string;
  is_approved: boolean;
};

export async function listUsers(): Promise<{
  data: UserProfileWithAuth[];
  active: UserProfileWithAuth[];
  pending: UserProfileWithAuth[];
  error: string | null;
}> {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    // 1. Fetch profiles with location names
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select(
        `
        *,
        locations(name)
      `
      )
      .order('created_at', { ascending: false });

    if (profilesError) {
      return { data: [], active: [], pending: [], error: profilesError.message };
    }

    // 2. Fetch auth users to get email and approval status from metadata
    let authUsersMap = new Map<string, { email: string; is_approved: boolean }>();
    try {
      const { data: authData } = await adminSupabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      if (authData?.users) {
        authData.users.forEach((u) => {
          const isExplicitlyPending =
            u.user_metadata?.is_approved === false ||
            u.app_metadata?.is_approved === false;
          authUsersMap.set(u.id, {
            email: u.email || '',
            is_approved: !isExplicitlyPending,
          });
        });
      }
    } catch (err) {
      console.warn('Could not fetch auth users list:', err);
    }

    // 3. Merge profiles and auth metadata
    const allUsers: UserProfileWithAuth[] = (profilesData || []).map((u) => {
      const authInfo = authUsersMap.get(u.id);
      const isApproved =
        u.is_approved !== undefined && u.is_approved !== null
          ? Boolean(u.is_approved)
          : authInfo
          ? authInfo.is_approved
          : true; // Default existing profiles to approved

      return {
        ...u,
        email: authInfo?.email || u.email || undefined,
        is_approved: isApproved,
        location_name:
          (u.locations as unknown as { name: string })?.name || undefined,
      };
    });

    const active = allUsers.filter((u) => u.is_approved);
    const pending = allUsers.filter((u) => !u.is_approved);

    return { data: allUsers, active, pending, error: null };
  } catch (err: any) {
    return { data: [], active: [], pending: [], error: err?.message || 'Failed to list users.' };
  }
}

// ── Register a new user (Self-Signup, Pending Approval) ─────────
export async function registerUser(data: {
  email: string;
  full_name: string;
  password: string;
}): Promise<{ error: string | null; success?: boolean }> {
  try {
    const email = data.email.trim().toLowerCase();
    const fullName = data.full_name.trim();
    const password = data.password;

    if (!email || !email.includes('@')) {
      return { error: 'Please provide a valid email address.' };
    }
    if (!fullName) {
      return { error: 'Full name is required.' };
    }
    if (!password || password.length < 8) {
      return { error: 'Password must be at least 8 characters.' };
    }

    const adminSupabase = createAdminClient();

    // 1. Create auth user with email_confirm: true (no mail tokens required)
    // and is_approved: false in metadata
    const { data: userData, error: createError } =
      await adminSupabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          is_approved: false,
        },
      });

    if (createError) {
      const msg = createError.message;
      if (msg.includes('already registered') || msg.includes('already exists')) {
        return { error: 'An account with this email already exists.' };
      }
      return { error: msg || 'Failed to create account.' };
    }

    const userId = userData.user?.id;
    if (!userId) {
      return { error: 'Could not create account.' };
    }

    // 2. Upsert profile with pending status
    const profilePayload: Record<string, any> = {
      id: userId,
      full_name: fullName,
      role: 'VIEWER', // default safe role until admin approves
      location_id: null,
    };

    // Attempt to write email & is_approved if columns exist
    try {
      profilePayload.email = email;
      profilePayload.is_approved = false;
      await adminSupabase.from('profiles').upsert(profilePayload);
    } catch {
      // Fallback without new columns if schema migration is pending
      delete profilePayload.is_approved;
      delete profilePayload.email;
      await adminSupabase.from('profiles').upsert(profilePayload);
    }

    return { success: true, error: null };
  } catch (err: any) {
    return {
      error: err?.message || 'An unexpected error occurred during registration.',
    };
  }
}

// ── Approve a pending user & assign role/location ──────────────
export async function approveUser(data: {
  user_id: string;
  role: UserRole;
  location_id?: string;
}): Promise<{ error: string | null; success?: boolean }> {
  try {
    const adminSupabase = createAdminClient();

    // 1. Update auth user metadata
    const { error: authError } = await adminSupabase.auth.admin.updateUserById(
      data.user_id,
      {
        user_metadata: {
          is_approved: true,
        },
      }
    );

    if (authError) {
      return { error: authError.message };
    }

    // 2. Update profile with role and location
    const updatePayload: Record<string, any> = {
      role: data.role,
      location_id: data.location_id || null,
    };

    try {
      updatePayload.is_approved = true;
      await adminSupabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', data.user_id);
    } catch {
      delete updatePayload.is_approved;
      await adminSupabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', data.user_id);
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { error: err?.message || 'Failed to approve user.' };
  }
}

// ── Reject/Decline a registration request ───────────────────────
export async function rejectUser(data: {
  user_id: string;
}): Promise<{ error: string | null; success?: boolean }> {
  try {
    const adminSupabase = createAdminClient();

    // Delete profile first
    await adminSupabase.from('profiles').delete().eq('id', data.user_id);

    // Delete auth user
    const { error } = await adminSupabase.auth.admin.deleteUser(data.user_id);
    if (error) {
      return { error: error.message };
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { error: err?.message || 'Failed to decline user request.' };
  }
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

// ── Direct / Manual Invite action ──────────────────────────────
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
      const { data: inviteData, error: inviteError } =
        await adminSupabase.auth.admin.inviteUserByEmail(data.email, {
          redirectTo,
          data: {
            full_name: data.full_name,
            is_approved: true, // Manually invited users are approved by default
          },
        });

      if (!inviteError && inviteData?.user?.id) {
        userId = inviteData.user.id;
        emailSent = true;
      }
    } catch {
      // Supabase email service may fail if custom SMTP is not set up
    }

    // 2. If email sending failed, use generateLink so direct link is ready
    if (!userId) {
      const { data: linkData, error: linkError } =
        await adminSupabase.auth.admin.generateLink({
          type: 'invite',
          email: data.email,
          options: {
            redirectTo,
            data: {
              full_name: data.full_name,
              is_approved: true,
            },
          },
        });

      if (linkError) {
        const rawMsg = linkError.message;
        const cleanMsg =
          !rawMsg || rawMsg === '{}'
            ? 'Failed to create user. This email may already be registered.'
            : rawMsg;
        return { error: cleanMsg };
      }

      if (linkData?.user?.id) {
        userId = linkData.user.id;
        inviteLink = linkData.properties?.action_link || null;
      }
    }

    // 3. Upsert profile with assigned role and location (marked as approved)
    if (userId) {
      const profileData: Record<string, any> = {
        id: userId,
        full_name: data.full_name,
        role: data.role,
        location_id: data.location_id || null,
      };

      try {
        profileData.email = data.email;
        profileData.is_approved = true;
        await adminSupabase.from('profiles').upsert(profileData);
      } catch {
        delete profileData.email;
        delete profileData.is_approved;
        await adminSupabase.from('profiles').upsert(profileData);
      }
    }

    return { error: null, inviteLink, emailSent };
  } catch (err: any) {
    const msg =
      err?.message && err.message !== '{}'
        ? err.message
        : 'An unexpected error occurred while inviting user.';
    return { error: msg };
  }
}
