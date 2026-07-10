/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/immutability */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';
import { Ticket, Categoria, ESTADO_LABELS, ESTADO_COLORS, PRIORIDAD_LABELS, PRIORIDAD_COLORS } from '@/types';
import { Plus, Search, Filter, Loader2, Ticket as TicketIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth.store';
import NuevoTicketModal from '@/components/tickets/NuevoTicketModal';

export default function TicketsPage() {
  const router = useRouter();
  const { usuario } = useAuthStore();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  // Filtros
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroPrioridad, setFiltroPrioridad] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [ticketsRes, categoriasRes] = await Promise.all([
        api.get('/tickets'),
        api.get('/categorias'),
      ]);
      setTickets(ticketsRes.data);
      setCategorias(categoriasRes.data);
    } catch (err) {
      toast.error('Error al cargar tickets');
    } finally {
      setLoading(false);
    }
  };

  const ticketsFiltrados = tickets.filter(ticket => {
    const matchSearch = ticket.titulo.toLowerCase().includes(search.toLowerCase()) ||
      ticket.numero.toLowerCase().includes(search.toLowerCase());
    const matchEstado = filtroEstado ? ticket.estado === Number(filtroEstado) : true;
    const matchPrioridad = filtroPrioridad ? ticket.prioridad === Number(filtroPrioridad) : true;
    return matchSearch && matchEstado && matchPrioridad;
  });

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
          <h1 className="text-2xl font-bold text-white">Tickets</h1>
          <p className="text-gray-400 mt-1">{ticketsFiltrados.length} tickets encontrados</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg transition font-medium text-sm"
        >
          <Plus className="w-4 h-4" />
          Nuevo ticket
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="flex flex-col md:flex-row gap-3">

          {/* Búsqueda */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar por título o número..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
            />
          </div>

          {/* Filtro Estado */}
          <select
            value={filtroEstado}
            onChange={e => setFiltroEstado(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 text-sm"
          >
            <option value="">Todos los estados</option>
            <option value="1">Abierto</option>
            <option value="2">En Progreso</option>
            <option value="3">Resuelto</option>
            <option value="4">Cerrado</option>
          </select>

          {/* Filtro Prioridad */}
          <select
            value={filtroPrioridad}
            onChange={e => setFiltroPrioridad(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 text-sm"
          >
            <option value="">Todas las prioridades</option>
            <option value="1">Baja</option>
            <option value="2">Media</option>
            <option value="3">Alta</option>
            <option value="4">Crítica</option>
          </select>

          {/* Limpiar filtros */}
          {(search || filtroEstado || filtroPrioridad) && (
            <button
              onClick={() => { setSearch(''); setFiltroEstado(''); setFiltroPrioridad(''); }}
              className="px-4 py-2.5 text-gray-400 hover:text-white border border-gray-700 rounded-lg text-sm transition"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {ticketsFiltrados.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <TicketIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No hay tickets</p>
            <p className="text-sm mt-1">Creá uno nuevo con el botón de arriba</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-gray-500 text-xs font-medium px-4 py-3 uppercase tracking-wider">Número</th>
                <th className="text-left text-gray-500 text-xs font-medium px-4 py-3 uppercase tracking-wider">Título</th>
                <th className="text-left text-gray-500 text-xs font-medium px-4 py-3 uppercase tracking-wider">Prioridad</th>
                <th className="text-left text-gray-500 text-xs font-medium px-4 py-3 uppercase tracking-wider">Estado</th>
                <th className="text-left text-gray-500 text-xs font-medium px-4 py-3 uppercase tracking-wider">Asignado</th>
                <th className="text-left text-gray-500 text-xs font-medium px-4 py-3 uppercase tracking-wider">Creado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {ticketsFiltrados.map((ticket) => (
                <tr
                  key={ticket.id}
                  onClick={() => router.push(`/tickets/${ticket.id}`)}
                  className="hover:bg-gray-800/50 cursor-pointer transition"
                >
                  <td className="px-4 py-3">
                    <span className="text-gray-400 text-sm font-mono">{ticket.numero}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-white text-sm font-medium">{ticket.titulo}</span>
                    {ticket.categoria && (
                      <span className="text-gray-500 text-xs ml-2">{ticket.categoria.nombre}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${PRIORIDAD_COLORS[ticket.prioridad]}`}>
                      {PRIORIDAD_LABELS[ticket.prioridad]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${ESTADO_COLORS[ticket.estado]}`}>
                      {ESTADO_LABELS[ticket.estado]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {ticket.tecnicoAsignado ? (
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs font-bold">
                            {ticket.tecnicoAsignado.nombre.charAt(0)}
                          </span>
                        </div>
                        <span className="text-gray-300 text-sm">{ticket.tecnicoAsignado.nombre}</span>
                      </div>
                    ) : (
                      <span className="text-gray-600 text-sm">Sin asignar</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-gray-500 text-sm">
                      {formatDistanceToNow(new Date(ticket.fechaCreacion), { addSuffix: true, locale: es })}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Modal nuevo ticket */}
      <NuevoTicketModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        categorias={categorias}
        onCreated={() => { setModalOpen(false); fetchData(); }}
      />
    </div>
  );
}