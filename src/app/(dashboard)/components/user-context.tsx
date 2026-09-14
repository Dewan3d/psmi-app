'use client';

// ============================================================
// PSMI System — User & Role Context
// ============================================================
// Provides reactive access to the authenticated user's profile,
// role, and RBAC flags (isAdmin, isViewer) across all dashboard pages.
// ============================================================

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getSession } from '@/actions/auth';
import { Profile, UserRole } from '@/lib/types/database';

interface UserContextValue {
  profile: Profile | null;
  role: UserRole | null;
  isAdmin: boolean;
  isViewer: boolean;
  loading: boolean;
  refetch: () => Promise<void>;
}

const UserContext = createContext<UserContextValue>({
  profile: null,
  role: null,
  isAdmin: false,
  isViewer: false,
  loading: true,
  refetch: async () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadUser = useCallback(async () => {
    try {
      const session = await getSession();
      if (session?.profile) {
        setProfile(session.profile as Profile);
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.error('Failed to load user session:', err);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const role = profile?.role || null;
  const isAdmin = role === 'ADMIN';
  const isViewer = role === 'VIEWER';

  return (
    <UserContext.Provider
      value={{
        profile,
        role,
        isAdmin,
        isViewer,
        loading,
        refetch: loadUser,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
