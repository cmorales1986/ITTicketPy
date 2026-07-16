/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import { Categoria } from '@/types';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth.store';
import { useRouter } from 'next/navigation';
import { Plus, Loader2, Tag, X, Pencil } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  nombre: z.string().min(2, 'Mínimo 2 caracteres'),
  descripcion: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function CategoriasPage() {
  const router = useRouter();
  const { usuario } = useAuthStore();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<Categoria | null>(null);
  const [guardando, setGuardando] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    reset: resetEdit,
    formState: { errors: editErrors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    // Solo admins pueden ver esta página
    if (usuario?.rol !== 2 && usuario?.rol !== 3) {
      router.push('/dashboard');
      return;
    }
    fetchCategorias();
  }, []);

  const fetchCategorias = async () => {
    try {
      const res = await api.get('/categorias?all=1');
      setCategorias(res.data);
    } catch {
      toast.error('Error al cargar categorías');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    setCreando(true);
    try {
      await api.post('/categorias', data);
      toast.success('Categoría creada correctamente');
      reset();
      setModalOpen(false);
      fetchCategorias();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al crear categoría');
    } finally {
      setCreando(false);
    }
  };

  const abrirEdicion = (c: Categoria) => {
    setEditando(c);
    resetEdit({ nombre: c.nombre, descripcion: c.descripcion ?? '' });
  };

  const onSubmitEdit = async (data: FormData) => {
    if (!editando) return;
    setGuardando(true);
    try {
      await api.patch(`/categorias/${editando.id}`, data);
      toast.success('Categoría actualizada correctamente');
      setEditando(null);
      fetchCategorias();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al actualizar categoría');
    } finally {
      setGuardando(false);
    }
  };

  const toggleActiva = async (id: string, activa: boolean) => {
    try {
      await api.patch(`/categorias/${id}`, { activa: !activa });
      toast.success(activa ? 'Categoría desactivada' : 'Categoría activada');
      fetchCategorias();
    } catch {
      toast.error('Error al actualizar categoría');
    }
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
          <h1 className="text-2xl font-bold text-white">Categorías</h1>
          <p className="text-gray-400 mt-1">Categorías disponibles para clasificar tickets</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg transition font-medium text-sm"
        >
          <Plus className="w-4 h-4" />
          Nueva categoría
        </button>
      </div>

      {/* Tabla */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {categorias.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Tag className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No hay categorías</p>
            <p className="text-sm mt-1">Creá una nueva con el botón de arriba</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[520px]">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-gray-500 text-xs font-medium px-5 py-3 uppercase tracking-wider">Nombre</th>
                <th className="text-left text-gray-500 text-xs font-medium px-5 py-3 uppercase tracking-wider">Descripción</th>
                <th className="text-left text-gray-500 text-xs font-medium px-5 py-3 uppercase tracking-wider">Estado</th>
                <th className="text-left text-gray-500 text-xs font-medium px-5 py-3 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {categorias.map(c => (
                <tr key={c.id} className="hover:bg-gray-800/30 transition">
                  <td className="px-5 py-4">
                    <span className="text-white text-sm font-medium">{c.nombre}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-gray-400 text-sm">
                      {c.descripcion || <span className="text-gray-600">-</span>}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      c.activa
                        ? 'bg-green-500/10 text-green-400'
                        : 'bg-red-500/10 text-red-400'
                    }`}>
                      {c.activa ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => abrirEdicion(c)}
                        className="text-xs px-3 py-1.5 rounded-lg transition font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 flex items-center gap-1.5"
                      >
                        <Pencil className="w-3 h-3" />
                        Editar
                      </button>
                      <button
                        onClick={() => toggleActiva(c.id, c.activa)}
                        className={`text-xs px-3 py-1.5 rounded-lg transition font-medium ${
                          c.activa
                            ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                            : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                        }`}
                      >
                        {c.activa ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Modal nueva categoría */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md">

            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <h2 className="text-white font-semibold text-lg">Nueva categoría</h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Nombre *</label>
                <input
                  {...register('nombre')}
                  placeholder="Ej: Hardware"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
                />
                {errors.nombre && <p className="text-red-400 text-xs mt-1">{errors.nombre.message}</p>}
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-1 block">Descripción</label>
                <textarea
                  {...register('descripcion')}
                  rows={3}
                  placeholder="Describí brevemente esta categoría..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm resize-none"
                />
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
                  {creando ? 'Creando...' : 'Crear categoría'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal editar categoría */}
      {editando && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md">

            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <h2 className="text-white font-semibold text-lg">Editar categoría</h2>
              <button onClick={() => setEditando(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitEdit(onSubmitEdit)} className="p-6 space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Nombre *</label>
                <input
                  {...registerEdit('nombre')}
                  placeholder="Ej: Hardware"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
                />
                {editErrors.nombre && <p className="text-red-400 text-xs mt-1">{editErrors.nombre.message}</p>}
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-1 block">Descripción</label>
                <textarea
                  {...registerEdit('descripcion')}
                  rows={3}
                  placeholder="Describí brevemente esta categoría..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm resize-none"
                />
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
