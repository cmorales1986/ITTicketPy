/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { Categoria, Empresa, Ticket, Usuario } from '@/types';
import { X, Loader2, UserPlus } from 'lucide-react';
import { LUGAR_LABELS, SISTEMAS_AFECTADOS, TIPO_LABELS, TIPOS_ORDEN, URGENCIA_LABELS } from '@/lib/tickets/estados';

// Un sistema guardado como "Otro: detalle" vuelve a separarse en el select y
// el campo de detalle.
function separarSistema(valor?: string | null): { sistemaModulo: string; sistemaOtro: string } {
  if (valor?.startsWith('Otro: ')) return { sistemaModulo: 'Otro', sistemaOtro: valor.slice('Otro: '.length) };
  return { sistemaModulo: valor ?? '', sistemaOtro: '' };
}

const schema = z.object({
  titulo: z.string().min(5, 'Mínimo 5 caracteres'),
  descripcion: z.string().min(10, 'Mínimo 10 caracteres'),
  prioridad: z.number().min(1).max(4),
  categoriaId: z.string().optional(),
  usuarioId: z.string().optional(),
  // PR-INF-03
  canal: z.enum(['CORREO', 'LLAMADA', 'WHATSAPP_PERSONAL', 'WHATSAPP_TECNICO']).optional(),
  tipo: z.number().min(1).max(5),
  sistemaModulo: z.string().min(1, 'Elegí el sistema o servicio afectado'),
  sistemaOtro: z.string().optional(),
  urgencia: z.number().min(1).max(4),
  // Solo cuando el equipo carga el ticket a mano (correo o llamada).
  lugarOrigen: z.enum(['OFICINA', 'GRANJA']).optional(),
  fechaRecepcion: z.string().optional(),
  // Ticket antiguo ya resuelto: se registra directamente Cerrado.
  esAntiguo: z.boolean().optional(),
  solucion: z.string().optional(),
  fechaSolucion: z.string().optional(),
}).superRefine((d, ctx) => {
  if (d.esAntiguo) {
    if ((d.solucion?.trim().length ?? 0) < 5) {
      ctx.addIssue({ code: 'custom', path: ['solucion'], message: 'Indicá la solución aplicada (mínimo 5 caracteres)' });
    }
    if (!d.fechaSolucion) {
      ctx.addIssue({ code: 'custom', path: ['fechaSolucion'], message: 'Indicá cuándo se resolvió' });
    } else if (d.fechaRecepcion && d.fechaSolucion < d.fechaRecepcion) {
      ctx.addIssue({ code: 'custom', path: ['fechaSolucion'], message: 'No puede ser anterior a la recepción' });
    }
  }
  if (d.sistemaModulo === 'Otro' && !d.sistemaOtro?.trim()) {
    ctx.addIssue({ code: 'custom', path: ['sistemaOtro'], message: 'Indicá cuál' });
  }
});

// Valor para <input type="datetime-local"> con la hora actual.
function ahoraLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

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
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [nuevoUsuarioAbierto, setNuevoUsuarioAbierto] = useState(false);
  const [nuevoUsuario, setNuevoUsuario] = useState({ nombre: '', numeroWhatsApp: '', email: '', empresaId: '' });
  const [creandoUsuario, setCreandoUsuario] = useState(false);

  const { register, handleSubmit, reset, control, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { prioridad: 2, tipo: 1, urgencia: 2, canal: 'LLAMADA', sistemaModulo: '', lugarOrigen: 'OFICINA', fechaRecepcion: ahoraLocal() },
  });

  const sistemaElegido = useWatch({ control, name: 'sistemaModulo' });
  const esAntiguo = useWatch({ control, name: 'esAntiguo' });

  useEffect(() => {
    if (open && ticketAnterior) {
      reset({
        titulo: `Continuación de ${ticketAnterior.numero}: ${ticketAnterior.titulo}`,
        descripcion: '',
        prioridad: ticketAnterior.prioridad,
        categoriaId: ticketAnterior.categoriaId ?? '',
        canal: 'LLAMADA',
        tipo: ticketAnterior.tipo,
        ...separarSistema(ticketAnterior.sistemaModulo),
        urgencia: ticketAnterior.urgencia ?? 2,
        lugarOrigen: (ticketAnterior.lugarOrigen as 'OFICINA' | 'GRANJA' | null) ?? 'OFICINA',
        fechaRecepcion: ahoraLocal(),
      });
    }
  }, [open, ticketAnterior, reset]);

  useEffect(() => {
    if (open && puedeElegirUsuario && !ticketAnterior) {
      api.get('/usuarios')
        .then((res) => setUsuarios(res.data.filter((u: Usuario) => u.activo)))
        .catch(() => toast.error('Error al cargar usuarios'));
      api.get('/empresas')
        .then((res) => setEmpresas(res.data.filter((e: Empresa) => e.activa)))
        .catch(() => toast.error('Error al cargar empresas'));
    }
  }, [open, puedeElegirUsuario, ticketAnterior]);

  // Alta rápida de un contacto desde el formulario: queda elegido como
  // "Reportado por".
  const crearUsuario = async () => {
    if (nuevoUsuario.nombre.trim().length < 2) {
      toast.error('Escribí el nombre del usuario');
      return;
    }
    setCreandoUsuario(true);
    try {
      const res = await api.post('/usuarios', {
        nombre: nuevoUsuario.nombre,
        numeroWhatsApp: nuevoUsuario.numeroWhatsApp || undefined,
        email: nuevoUsuario.email || undefined,
        empresaId: nuevoUsuario.empresaId || undefined,
      });
      const creado: Usuario = { ...res.data, rol: 0, activo: true };
      setUsuarios((prev) => [...prev, creado]);
      setValue('usuarioId', creado.id);
      setNuevoUsuario({ nombre: '', numeroWhatsApp: '', email: '', empresaId: '' });
      setNuevoUsuarioAbierto(false);
      toast.success('Usuario creado');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al crear el usuario');
    } finally {
      setCreandoUsuario(false);
    }
  };

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
        sistemaModulo: data.sistemaModulo === 'Otro' ? `Otro: ${data.sistemaOtro!.trim()}` : data.sistemaModulo,
        sistemaOtro: undefined,
        lugarOrigen: puedeElegirUsuario ? data.lugarOrigen : undefined,
        fechaRecepcion: puedeElegirUsuario && data.fechaRecepcion ? new Date(data.fechaRecepcion).toISOString() : undefined,
        retroactivo:
          puedeElegirUsuario && data.esAntiguo
            ? { solucion: data.solucion!.trim(), fechaSolucion: new Date(data.fechaSolucion!).toISOString() }
            : undefined,
        esAntiguo: undefined,
        solucion: undefined,
        fechaSolucion: undefined,
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
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800 shrink-0">
          <h2 className="text-white font-semibold text-lg">{ticketAnterior ? 'Nuevo ticket vinculado' : 'Nuevo ticket'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4 overflow-y-auto">

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
              <button
                type="button"
                onClick={() => setNuevoUsuarioAbierto((v) => !v)}
                className="mt-2 inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300"
              >
                <UserPlus className="w-3.5 h-3.5" />
                {nuevoUsuarioAbierto ? 'Cancelar nuevo usuario' : 'Agregar usuario nuevo'}
              </button>
              {nuevoUsuarioAbierto && (
                <div className="mt-2 space-y-2 rounded-lg border border-gray-700 bg-gray-800/50 p-3">
                  <input
                    value={nuevoUsuario.nombre}
                    onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, nombre: e.target.value })}
                    placeholder="Nombre completo *"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500"
                  />
                  <select
                    value={nuevoUsuario.empresaId}
                    onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, empresaId: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Sin empresa</option>
                    {empresas.map((e) => (
                      <option key={e.id} value={e.id}>{e.nombre}</option>
                    ))}
                  </select>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      value={nuevoUsuario.numeroWhatsApp}
                      onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, numeroWhatsApp: e.target.value })}
                      placeholder="WhatsApp (595981...)"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500"
                    />
                    <input
                      value={nuevoUsuario.email}
                      onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, email: e.target.value })}
                      placeholder="Email (opcional)"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={crearUsuario}
                    disabled={creandoUsuario}
                    className="w-full bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm py-2 rounded-lg flex items-center justify-center gap-2"
                  >
                    {creandoUsuario && <Loader2 className="w-4 h-4 animate-spin" />}
                    Crear y elegir
                  </button>
                </div>
              )}
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
                <option value="WHATSAPP_PERSONAL">WhatsApp personal</option>
                <option value="WHATSAPP_TECNICO">WhatsApp técnico</option>
              </select>
              <p className="text-gray-600 text-xs mt-1">Los mensajes al número del bot los crea el bot automáticamente</p>
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
                {TIPOS_ORDEN.map((v) => (
                  <option key={v} value={v}>{TIPO_LABELS[v]}</option>
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
            <label className="text-sm text-gray-400 mb-1 block">Sistema o servicio afectado *</label>
            <select
              {...register('sistemaModulo')}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 text-sm"
            >
              <option value="">Elegí uno…</option>
              {SISTEMAS_AFECTADOS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {errors.sistemaModulo && <p className="text-red-400 text-xs mt-1">{errors.sistemaModulo.message}</p>}
            {sistemaElegido === 'Otro' && (
              <input
                {...register('sistemaOtro')}
                placeholder="¿Cuál?"
                className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
              />
            )}
            {errors.sistemaOtro && <p className="text-red-400 text-xs mt-1">{errors.sistemaOtro.message}</p>}
          </div>

          {puedeElegirUsuario && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Lugar de origen *</label>
                <select
                  {...register('lugarOrigen')}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 text-sm"
                >
                  {Object.entries(LUGAR_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Fecha y hora de recepción *</label>
                <input
                  type="datetime-local"
                  {...register('fechaRecepcion')}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 text-sm"
                />
              </div>
              <p className="text-gray-600 text-xs sm:col-span-2">
                Los plazos se cuentan desde la recepción del reporte y con el horario del lugar de origen.
              </p>
            </div>
          )}

          {puedeElegirUsuario && !ticketAnterior && (
            <div className="rounded-lg border border-gray-700 p-3 space-y-3">
              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input type="checkbox" {...register('esAntiguo')} className="rounded" />
                Es un ticket antiguo que ya se resolvió
              </label>
              {esAntiguo && (
                <>
                  <p className="text-gray-500 text-xs">
                    Se registra directamente como Cerrado, con la fecha de recepción de arriba como fecha del ticket. No se avisa a nadie por WhatsApp.
                  </p>
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Fecha y hora de la solución *</label>
                    <input
                      type="datetime-local"
                      {...register('fechaSolucion')}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 text-sm"
                    />
                    {errors.fechaSolucion && <p className="text-red-400 text-xs mt-1">{errors.fechaSolucion.message}</p>}
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Solución aplicada *</label>
                    <textarea
                      {...register('solucion')}
                      rows={3}
                      placeholder="Qué se hizo para resolverlo..."
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm resize-none"
                    />
                    {errors.solucion && <p className="text-red-400 text-xs mt-1">{errors.solucion.message}</p>}
                  </div>
                </>
              )}
            </div>
          )}

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