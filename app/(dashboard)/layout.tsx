'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import Sidebar from '@/components/layout/Sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { usuario, hydrated, fetchSession } = useAuthStore();

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  useEffect(() => {
    if (hydrated && !usuario) {
      router.push('/login');
    }
  }, [hydrated, usuario, router]);

  if (!usuario) return null;

  return (
    <div className="flex h-screen" style={{ backgroundColor: '#f8fafc' }}>
      <Sidebar />
      <main
        className="flex-1 lg:ml-64 pt-14 lg:pt-0 overflow-auto"
        style={{ backgroundColor: '#f8fafc' }}
      >
        <div className="p-4 sm:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
