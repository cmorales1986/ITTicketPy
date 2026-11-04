/* eslint-disable react-hooks/immutability */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import api from '@/lib/axios';
import { Ticket, PRIORIDAD_COLORS, PRIORIDAD_LABELS, ESTADO_LABELS } from '@/types';
import { toast } from 'sonner';
import { Loader2, Plus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { ESTADO, transicionPermitida } from '@/lib/tickets/estados';
import { ESTADO_PLAZO_COLORS, ESTADO_PLAZO_LABELS } from '@/lib/tickets/plazos';

const COLUMNAS = [
  { id: 1, label: 'Nuevo', color: 'border-yellow-500' },
  { id: 2, label: 'En Proceso', color: 'border-blue-500' },
  { id: 3, label: 'Resuelto', color: 'border-green-500' },
  { id: 4, label: 'Cerrado', color: 'border-gray-500' },
  { id: 5, label: 'Cancelado', color: 'border-red-500' },
];

export default function KanbanPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const res = await api.get('/tickets');
      setTickets(res.data);
    } catch {
      toast.error('Error al cargar tickets');
    } finally {
      setLoading(false);
    }
  };

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;

    const nuevoEstado = Number(destination.droppableId);
    const estadoActual = Number(source.droppableId);

    // PR-INF-03: solo se permiten las transiciones del procedimiento.
    if (!transicionPermitida(estadoActual, nuevoEstado)) {
      toast.error(`No se puede pasar de ${ESTADO_LABELS[estadoActual]} a ${ESTADO_LABELS[nuevoEstado]}`);
      return;
    }

    // Resuelto y Cancelado exigen un dato obligatorio (solución / motivo).
    const extra: { solucion?: string; motivoCancelacion?: string } = {};
    if (nuevoEstado === ESTADO.RESUELTO) {
      const solucion = window.prompt('Solución aplicada (obligatoria):')?.trim();
      if (!solucion) return;
      extra.solucion = solucion;
    }
    if (nuevoEstado === ESTADO.CANCELADO) {
      const motivo = window.prompt('Motivo de la cancelación (obligatorio):')?.trim();
      if (!motivo) return;
      extra.motivoCancelacion = motivo;
    }

    // Actualizar UI optimistamente
    setTickets(prev =>
      prev.map(t =>
        t.id === draggableId ? { ...t, estado: nuevoEstado } : t
      )
    );

    try {
      try {
        await api.put(`/tickets/${draggableId}`, { estado: nuevoEstado, ...extra });
      } catch (err: any) {
        // Crítico fuera de plazo: hay que explicar el desvío para cerrarlo.
        if (err.response?.data?.code !== 'MOTIVO_DESVIO') throw err;
        const motivoDesvio = window.prompt(`${err.response.data.message}:`)?.trim();
        if (!motivoDesvio) throw err;
        await api.put(`/tickets/${draggableId}`, { estado: nuevoEstado, ...extra, motivoDesvio });
      }
      toast.success(`Ticket movido a ${ESTADO_LABELS[nuevoEstado]}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al actualizar ticket');
      fetchTickets(); // Revertir
    }
  };

  const getTicketsPorEstado = (estado: number) =>
    tickets.filter(t => t.estado === estado);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 h-full">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Kanban</h1>
          <p className="text-gray-400 mt-1">Arrastrá los tickets para cambiar su estado</p>
        </div>
        <button
          onClick={() => router.push('/tickets')}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg transition font-medium text-sm"
        >
          <Plus className="w-4 h-4" />
          Nuevo ticket
        </button>
      </div>

      {/* Board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 h-full overflow-x-auto pb-2">
          {COLUMNAS.map(columna => {
            const ticketsColumna = getTicketsPorEstado(columna.id);

            return (
              <div key={columna.id} className="flex flex-col w-72 shrink-0">

                {/* Header columna */}
                <div className={`bg-gray-900 border border-gray-800 border-t-2 ${columna.color} rounded-xl p-3 mb-3`}>
                  <div className="flex items-center justify-between">
                    <span className="text-white font-medium text-sm">{columna.label}</span>
                    <span className="bg-gray-800 text-gray-400 text-xs px-2 py-0.5 rounded-full font-medium">
                      {ticketsColumna.length}
                    </span>
                  </div>
                </div>

                {/* Droppable */}
                <Droppable droppableId={String(columna.id)}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 rounded-xl min-h-32 p-2 transition-colors space-y-2 ${
                        snapshot.isDraggingOver
                          ? 'bg-gray-800/50 border-2 border-dashed border-gray-600'
                          : 'bg-transparent'
                      }`}
                    >
                      {ticketsColumna.map((ticket, index) => (
                        <Draggable key={ticket.id} draggableId={ticket.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={() => !snapshot.isDragging && router.push(`/tickets/${ticket.id}`)}
                              className={`bg-gray-900 border rounded-xl p-3 cursor-pointer transition-all ${
                                snapshot.isDragging
                                  ? 'border-blue-500 shadow-lg shadow-blue-500/20 rotate-1 scale-105'
                                  : 'border-gray-800 hover:border-gray-600'
                              }`}
                            >
                              {/* Número */}
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-gray-500 text-xs font-mono">
                                  {ticket.numero}
                                </span>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORIDAD_COLORS[ticket.prioridad]}`}>
                                  {PRIORIDAD_LABELS[ticket.prioridad]}
                                </span>
                              </div>

                              {/* Título */}
                              <p className="text-white text-sm font-medium leading-snug mb-3">
                                {ticket.titulo}
                              </p>

                              {/* Footer */}
                              <div className="flex items-center justify-between">
                                {ticket.tecnicoAsignado ? (
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                                      <span className="text-white text-xs font-bold">
                                        {ticket.tecnicoAsignado.nombre.charAt(0)}
                                      </span>
                                    </div>
                                    <span className="text-gray-400 text-xs truncate max-w-20">
                                      {ticket.tecnicoAsignado.nombre.split(' ')[0]}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-gray-600 text-xs">Sin asignar</span>
                                )}
                                <span className="text-gray-600 text-xs">
                                  {formatDistanceToNow(new Date(ticket.fechaCreacion), {
                                    addSuffix: false,
                                    locale: es,
                                  })}
                                </span>
                              </div>

                              {ticket.sla && ticket.estado <= 3 && ticket.sla.resumen !== 'no_aplica' && (
                                <div className="mt-2">
                                  <span
                                    title={`Primera respuesta: ${ESTADO_PLAZO_LABELS[ticket.sla.respuesta.estado]} · Resolución: ${ESTADO_PLAZO_LABELS[ticket.sla.resolucion.estado]}`}
                                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_PLAZO_COLORS[ticket.sla.resumen]}`}
                                  >
                                    {ESTADO_PLAZO_LABELS[ticket.sla.resumen]}
                                  </span>
                                </div>
                              )}

                              {(ticket.reaperturas > 0 || ticket.cerradoSinRespuesta) && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {ticket.reaperturas > 0 && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 font-medium">
                                      Reabierto {ticket.reaperturas} {ticket.reaperturas === 1 ? 'vez' : 'veces'}
                                    </span>
                                  )}
                                  {ticket.cerradoSinRespuesta && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-400 font-medium">
                                      Cerrado sin respuesta
                                    </span>
                                  )}
                                </div>
                              )}

                              {ticket.dependeProveedor && (
                                <div className="mt-2">
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 font-medium">
                                    Depende de proveedor{ticket.proveedorNombre ? `: ${ticket.proveedorNombre}` : ''}
                                  </span>
                                </div>
                              )}

                              {/* Categoría */}
                              {ticket.categoria && (
                                <div className="mt-2 pt-2 border-t border-gray-800">
                                  <span className="text-gray-500 text-xs">
                                    {ticket.categoria.nombre}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}

                      {/* Empty state */}
                      {ticketsColumna.length === 0 && !snapshot.isDraggingOver && (
                        <div className="text-center py-8 text-gray-700 text-xs">
                          Sin tickets
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}