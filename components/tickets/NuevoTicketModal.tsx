/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { Categoria, Ticket, Usuario } from '@/types';
import { X, Loader2 } from 'lucide-react';
import { TIPO_LABELS, URGENCIA_LABELS } from '@/lib/tickets/estados';

const schema = z.object({
  titulo: z.string().min(5, 'Mínimo 5 caracteres'),
  descripcion: z.string().min(10, 'Mínimo 10 caracteres'),
  prioridad: z.number().min(1).max(4),
  categoriaId: z.string().optional(),
  usuarioId: z.string().optional(),
  // PR-INF-03
  canal: z.enum(['CORREO', 'LLAMADA']).optional(),
  tipo: z.number().min(1).max(3),
  sistemaModulo: z.string().min(1, 'Indicá el sistema o módulo afectado'),
  urgencia: z.number().min(1).max(4),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  categorias: Categoria[];
  onCreated: () => void;
  // Técnicos/admins pueden cargar el ticket a nombre de otro usuario (ej.
  // alguien reportó el problema por teléfono en vez de escribir).
  puedeElegirUsuario?: boolean;
  // Si se pasa, el ticket nuevo queda vinculado a este (reapertura fuera de
  // plazo): hereda el solicitante y el sistema/módulo.
  ticketAnterior?: Ticket;
}

export default function NuevoTicketModal({ open, onClose, categorias, onCreated, puedeElegirUsuario, ticketAnterior }: Props) {
  const [loading, setLoading] = useState(false);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { prioridad: 2, tipo: 1, urgencia: 2, canal: 'LLAMADA' },
  });

  useEffect(() => {
    if (open && ticketAnterior) {
      reset({
        titulo: `Continuación de ${ticketAnterior.numero}: ${ticketAnterior.titulo}`,
        descripcion: '',
        prioridad: ticketAnterior.prioridad,
        categoriaId: ticketAnterior.categoriaId ?? '',
        canal: 'LLAMADA',
        tipo: ticketAnterior.tipo,
        sistemaModulo: ticketAnterior.sistemaModulo ?? '',
        urgencia: ticketAnterior.urgencia ?? 2,
      });
    }
  }, [open, ticketAnterior, reset]);

  useEffect(() => {
    if (open && puedeElegirUsuario && !ticketAnterior) {
      api.get('/usuarios')
        .then((res) => setUsuarios(res.data.filter((u: Usuario) => u.activo)))
        .catch(() => toast.error('Error al cargar usuarios'));
    }
  }, [open, puedeElegirUsuario, ticketAnterior]);

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      await api.post('/tickets', {
        ...data,
        // Un ticket vinculado conserva al solicitante del anterior.
        usuarioId: ticketAnterior ? ticketAnterior.usuarioId : data.usuarioId || undefined,
        ticketAnteriorId: ticketAnterior?.id,
        // Los clientes no eligen canal: el servidor lo registra como PORTAL.
        canal: puedeElegirUsuario ? data.canal : undefined,
      });
      toast.success('Ticket creado correctamente');
      reset();
      onCreated();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al crear ticket');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 className="text-white font-semibold text-lg">{ticketAnterior ? 'Nuevo ticket vinculado' : 'Nuevo ticket'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">

          {ticketAnterior && (
            <p className="text-xs text-blue-300 bg-blue-500/10 rounded-lg px-3 py-2">
              Vinculado a {ticketAnterior.numero}. Reportado por {ticketAnterior.usuario?.nombre ?? 'el mismo solicitante'}.
            </p>
          )}

          {puedeElegirUsuario && !ticketAnterior && (
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Reportado por</label>
              <select
                {...register('usuarioId')}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 text-sm"
              >
                <option value="">Vos mismo/a</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>{u.nombre} — {u.email}</option>
                ))}
              </select>
              <p className="text-gray-600 text-xs mt-1">Elegí a otro usuario si estás cargando el ticket por él/ella (ej. reportó por teléfono)</p>
            </div>
          )}

          {puedeElegirUsuario && (
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Canal de ingreso *</label>
              <select
                {...register('canal')}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 text-sm"
              >
                <option value="CORREO">Correo electrónico</option>
                <option value="LLAMADA">Llamada</option>
              </select>
              <p className="text-gray-600 text-xs mt-1">Los reportes por WhatsApp los crea el bot automáticamente</p>
            </div>
          )}

          <div>
            <label className="text-sm text-gray-400 mb-1 block">Título *</label>
            <input
              {...register('titulo')}
              placeholder="Ej: PC no enciende en área contabilidad"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
            />
            {errors.titulo && <p className="text-red-400 text-xs mt-1">{errors.titulo.message}</p>}
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-1 block">Descripción *</label>
            <textarea
              {...register('descripcion')}
              rows={4}
              placeholder="Describí el problema con el mayor detalle posible..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm resize-none"
            />
            {errors.descripcion && <p className="text-red-400 text-xs mt-1">{errors.descripcion.message}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Prioridad *</label>
              <select
                {...register('prioridad', { valueAsNumber: true })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 text-sm"
              >
                <option value={1}>Baja</option>
                <option value={2}>Media</option>
                <option value={3}>Alta</option>
                <option value={4}>Crítica</option>
              </select>
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-1 block">Categoría</label>
              <select
                {...register('categoriaId')}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 text-sm"
              >
                <option value="">Sin categoría</option>
                {categorias.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Tipo *</label>
              <select
                {...register('tipo', { valueAsNumber: true })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 text-sm"
              >
                {Object.entries(TIPO_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Urgencia percibida *</label>
              <select
                {...register('urgencia', { valueAsNumber: true })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 text-sm"
              >
                {Object.entries(URGENCIA_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-1 block">Sistema / módulo afectado *</label>
            <input
              {...register('sistemaModulo')}
              placeholder="Ej: SAP B1 — Compras"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
            />
            {errors.sistemaModulo && <p className="text-red-400 text-xs mt-1">{errors.sistemaModulo.message}</p>}
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-700 text-gray-400 hover:text-white rounded-lg text-sm transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition flex items-center justify-center gap-2 text-sm"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Creando...' : 'Crear ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}