'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import {
  LayoutDashboard, Ticket, Kanban,
  Users, LogOut, ChevronRight, Menu, X,
} from 'lucide-react';
import { toast } from 'sonner';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: [0, 1, 2] },
  { href: '/tickets', label: 'Tickets', icon: Ticket, roles: [0, 1, 2] },
  { href: '/kanban', label: 'Kanban', icon: Kanban, roles: [1, 2] },
  { href: '/usuarios', label: 'Usuarios', icon: Users, roles: [2] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { usuario, logout } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    toast.success('Sesión cerrada');
    router.push('/login');
  };

  const filteredNav = navItems.filter(item =>
    item.roles.includes(usuario?.rol ?? 0)
  );

  return (
    <>
      {/* Mobile top bar */}
      <div
        style={{
          backgroundColor: '#111827',
          borderBottom: '1px solid #1f2937',
        }}
        className="lg:hidden fixed top-0 left-0 right-0 h-14 flex items-center justify-between px-4 z-40"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-xs font-bold">IT</span>
          </div>
          <span style={{ color: '#ffffff' }} className="font-semibold text-sm">
            ITTicketPy
          </span>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          style={{ color: '#9ca3af' }}
          className="p-2 hover:text-white transition"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="lg:hidden fixed inset-0 bg-black/60 z-40"
        />
      )}

      {/* Sidebar / drawer */}
      <aside
        style={{
          backgroundColor: '#111827',
          borderRight: '1px solid #1f2937',
          color: '#fff',
        }}
        className={`w-64 flex flex-col h-screen fixed left-0 top-0 z-50 transition-transform duration-200 lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo + Toggle */}
        <div
          style={{ borderBottom: '1px solid #1f2937' }}
          className="p-6"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-sm font-bold">IT</span>
              </div>
              <div>
                <p style={{ color: '#ffffff' }} className="font-semibold text-sm">
                  ITTicketPy
                </p>
                <p style={{ color: '#6b7280' }} className="text-xs">
                  Sistema de tickets
                </p>
              </div>
            </div>
            <button
              onClick={() => setMobileOpen(false)}
              style={{ color: '#9ca3af' }}
              className="lg:hidden p-1 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1">
          {filteredNav.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                style={
                  isActive
                    ? {}
                    : { color: '#9ca3af' }
                }
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition text-sm font-medium group ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'hover:bg-gray-700 hover:!text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
                {isActive && <ChevronRight className="w-3 h-3 ml-auto" />}
              </Link>
            );
          })}
        </nav>

        {/* Usuario */}
        <div
          style={{ borderTop: '1px solid #1f2937' }}
          className="p-4"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">
                {usuario?.nombre?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p style={{ color: '#ffffff' }} className="text-sm font-medium truncate">
                {usuario?.nombre}
              </p>
              <p style={{ color: '#6b7280' }} className="text-xs">
                {usuario?.rol === 2 ? 'Admin' : usuario?.rol === 1 ? 'Técnico' : 'Usuario'}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            style={{ color: '#9ca3af' }}
            className="w-full flex items-center gap-2 px-3 py-2 hover:text-red-400 hover:bg-gray-700 rounded-lg transition text-sm"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}
