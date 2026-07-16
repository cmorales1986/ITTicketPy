import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Usuario } from '@/types';
import api from '@/lib/axios';

interface AuthState {
  usuario: Usuario | null;
  hydrated: boolean;
  setAuth: (usuario: Usuario) => void;
  logout: () => void;
  fetchSession: () => Promise<void>;
  isAdmin: () => boolean;
  isTecnico: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      usuario: null,
      hydrated: false,

      setAuth: (usuario) => {
        set({ usuario, hydrated: true });
      },

      logout: () => {
        api.post('/auth/logout').catch(() => {});
        set({ usuario: null, hydrated: true });
      },

      fetchSession: async () => {
        try {
          const res = await api.get('/auth/me');
          set({ usuario: res.data.usuario, hydrated: true });
        } catch {
          set({ usuario: null, hydrated: true });
        }
      },

      isAdmin: () => get().usuario?.rol === 2 || get().usuario?.rol === 3,
      isTecnico: () => (get().usuario?.rol ?? 0) >= 1,
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ usuario: state.usuario }),
    }
  )
);
