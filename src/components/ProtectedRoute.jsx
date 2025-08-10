'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/utils/supabaseClient';

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [role, setRole] = useState(null);
  const [roleLoading, setRoleLoading] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router, adminOnly]);

  // Fetch role from profiles when adminOnly is required
  useEffect(() => {
    const fetchRole = async () => {
      if (!adminOnly || !user) return;
      setRoleLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      if (!error) setRole(data?.role ?? null);
      setRoleLoading(false);
    };
    fetchRole();
  }, [adminOnly, user]);

  if (loading || !user || (adminOnly && (roleLoading || role !== 'admin'))) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return children;
}
