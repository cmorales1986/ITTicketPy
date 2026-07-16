/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/immutability */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import { Usuario } from '@/types';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth.store';
import { useRouter } from 'next/navigation';
import {
  Plus, Loader2, Users, Shield,
  Wrench, User, X, Eye, EyeOff, Pencil
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const ROL_LABELS: Record<number, string> = {
  0: 'Usuario',
  1: 'Técnico',
  2: 'Admin',
  3: 'Admin y Técnico',
};

const ROL_COLORS: Record<number, string> = {
  0: 'bg-gray-500/10 text-gray-400',
  1: 'bg-blue-500/10 text-blue-400',
  2: 'bg-purple-500/10 text-purple-400',
  3: 'bg-indigo-500/10 text-indigo-400',
};

const ROL_ICONS: Record<number, any> = {
  0: User,
  1: Wrench,
  2: Shield,
  3: Shield,
};

const schema = z.object({
  nombre: z.string().min(3, 'Mínimo 3 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  rol: z.number().min(0).max(3),
  numeroWhatsApp: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const editSchema = z.object({
  nombre: z.string().min(3, 'Mínimo 3 caracteres'),
  email: z.string().email('Email inválido'),
  rol: z.number().min(0).max(3),
  numeroWhatsApp: z.string().optional(),
});

type EditFormData = z.infer<typeof editSchema>;

export default function UsuariosPage() {
  const router = useRouter();
  const { usuario } = useAuthStore();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [guardando, setGuardando] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { rol: 0 },
  });

  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    reset: resetEdit,
    formState: { errors: editErrors },
  } = useForm<EditFormData>({ resolver: zodResolver(editSchema) });

  const abrirEdicion = (u: Usuario) => {
    setEditando(u);
    resetEdit({
      nombre: u.nombre,
      email: u.email,
      rol: u.rol,
      numeroWhatsApp: u.numeroWhatsApp ?? '',
    });
  };

  const onSubmitEdit = async (data: EditFormData) => {
    if (!editando) return;
    setGuardando(true);
    try {
      await api.patch(`/usuarios/${editando.id}`, data);
      toast.success('Usuario actualizado correctamente');
      setEditando(null);
      fetchUsuarios();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al actualizar usuario');
    } finally {
      setGuardando(false);
    }
  };

  useEffect(() => {
    // Solo admins pueden ver esta página
    if (usuario?.rol !== 2 && usuario?.rol !== 3) {
      router.push('/dashboard');
      return;
    }
    fetchUsuarios();
  }, []);

  const fetchUsuarios = async () => {
    try {
      const res = await api.get('/usuarios');
      setUsuarios(res.data);
    } catch {
      toast.error('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    setCreando(true);
    try {
      await api.post('/auth/register', data);
      toast.success('Usuario creado correctamente');
      reset();
      setModalOpen(false);
      fetchUsuarios();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al crear usuario');
    } finally {
      setCreando(false);
    }
  };

  const toggleActivo = async (id: string, activo: boolean) => {
    try {
      await api.patch(`/usuarios/${id}`, { activo: !activo });
      toast.success(activo ? 'Usuario desactivado' : 'Usuario activado');
      fetchUsuarios();
    } catch {
      toast.error('Error al actualizar usuario');
    }
  };

  // Stats
  const stats = {
    total: usuarios.length,
    admins: usuarios.filter(u => u.rol === 2 || u.rol === 3).length,
    tecnicos: usuarios.filter(u => u.rol === 1 || u.rol === 3).length,
    usuarios: usuarios.filter(u => u.rol === 0).length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Usuarios</h1>
          <p className="text-gray-400 mt-1">Gestión de usuarios del sistema</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg transition font-medium text-sm"
        >
          <Plus className="w-4 h-4" />
          Nuevo usuario
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total, icon: Users, color: 'text-blue-400' },
          { label: 'Admins', value: stats.admins, icon: Shield, color: 'text-purple-400' },
          { label: 'Técnicos', value: stats.tecnicos, icon: Wrench, color: 'text-blue-400' },
          { label: 'Usuarios', value: stats.usuarios, icon: User, color: 'text-gray-400' },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <Icon className={`w-5 h-5 ${stat.color}`} />
                <div>
                  <p className="text-gray-400 text-xs">{stat.label}</p>
                  <p className="text-white text-xl font-bold">{stat.value}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabla */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left text-gray-500 text-xs font-medium px-5 py-3 uppercase tracking-wider">Usuario</th>
              <th className="text-left text-gray-500 text-xs font-medium px-5 py-3 uppercase tracking-wider">Rol</th>
              <th className="text-left text-gray-500 text-xs font-medium px-5 py-3 uppercase tracking-wider">WhatsApp</th>
              <th className="text-left text-gray-500 text-xs font-medium px-5 py-3 uppercase tracking-wider">Estado</th>
              <th className="text-left text-gray-500 text-xs font-medium px-5 py-3 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {usuarios.map(u => {
              const RolIcon = ROL_ICONS[u.rol];
              return (
                <tr key={u.id} className="hover:bg-gray-800/30 transition">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center shrink-0">
                        <span className="text-white text-sm font-bold">
                          {u.nombre.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">{u.nombre}</p>
                        <p className="text-gray-500 text-xs">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${ROL_COLORS[u.rol]}`}>
                      <RolIcon className="w-3 h-3" />
                      {ROL_LABELS[u.rol]}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-gray-400 text-sm">
                      {u.numeroWhatsApp || <span className="text-gray-600">-</span>}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      u.activo
                        ? 'bg-green-500/10 text-green-400'
                        : 'bg-red-500/10 text-red-400'
                    }`}>
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => abrirEdicion(u)}
                        className="text-xs px-3 py-1.5 rounded-lg transition font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 flex items-center gap-1.5"
                      >
                        <Pencil className="w-3 h-3" />
                        Editar
                      </button>
                      {u.id !== usuario?.id && (
                        <button
                          onClick={() => toggleActivo(u.id, u.activo)}
                          className={`text-xs px-3 py-1.5 rounded-lg transition font-medium ${
                            u.activo
                              ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                              : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                          }`}
                        >
                          {u.activo ? 'Desactivar' : 'Activar'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {/* Modal nuevo usuario */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md">

            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <h2 className="text-white font-semibold text-lg">Nuevo usuario</h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">

              <div>
                <label className="text-sm text-gray-400 mb-1 block">Nombre completo *</label>
                <input
                  {...register('nombre')}
                  placeholder="Ej: Juan Pérez"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
                />
                {errors.nombre && <p className="text-red-400 text-xs mt-1">{errors.nombre.message}</p>}
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-1 block">Email *</label>
                <input
                  {...register('email')}
                  type="email"
                  placeholder="juan@empresa.com"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
                />
                {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-1 block">Contraseña *</label>
                <div className="relative">
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Rol *</label>
                  <select
                    {...register('rol', { valueAsNumber: true })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 text-sm"
                  >
                    <option value={0}>Usuario</option>
                    <option value={1}>Técnico</option>
                    <option value={2}>Admin</option>
                    <option value={3}>Admin y Técnico</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-1 block">WhatsApp</label>
                  <input
                    {...register('numeroWhatsApp')}
                    placeholder="+595985123456"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setModalOpen(false); reset(); }}
                  className="flex-1 px-4 py-2.5 border border-gray-700 text-gray-400 hover:text-white rounded-lg text-sm transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creando}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition flex items-center justify-center gap-2 text-sm"
                >
                  {creando && <Loader2 className="w-4 h-4 animate-spin" />}
                  {creando ? 'Creando...' : 'Crear usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal editar usuario */}
      {editando && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md">

            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <h2 className="text-white font-semibold text-lg">Editar usuario</h2>
              <button onClick={() => setEditando(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitEdit(onSubmitEdit)} className="p-6 space-y-4">

              <div>
                <label className="text-sm text-gray-400 mb-1 block">Nombre completo *</label>
                <input
                  {...registerEdit('nombre')}
                  placeholder="Ej: Juan Pérez"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
                />
                {editErrors.nombre && <p className="text-red-400 text-xs mt-1">{editErrors.nombre.message}</p>}
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-1 block">Email *</label>
                <input
                  {...registerEdit('email')}
                  type="email"
                  placeholder="juan@empresa.com"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
                />
                {editErrors.email && <p className="text-red-400 text-xs mt-1">{editErrors.email.message}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Rol *</label>
                  <select
                    {...registerEdit('rol', { valueAsNumber: true })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 text-sm"
                  >
                    <option value={0}>Usuario</option>
                    <option value={1}>Técnico</option>
                    <option value={2}>Admin</option>
                    <option value={3}>Admin y Técnico</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-1 block">WhatsApp</label>
                  <input
                    {...registerEdit('numeroWhatsApp')}
                    placeholder="+595985123456"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditando(null)}
                  className="flex-1 px-4 py-2.5 border border-gray-700 text-gray-400 hover:text-white rounded-lg text-sm transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition flex items-center justify-center gap-2 text-sm"
                >
                  {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
                  {guardando ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}