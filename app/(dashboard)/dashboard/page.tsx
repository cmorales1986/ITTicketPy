/* eslint-disable react-hooks/immutability */
'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/axios';
import { Ticket, ESTADO_LABELS, ESTADO_COLORS, PRIORIDAD_LABELS, PRIORIDAD_COLORS } from '@/types';
import { Ticket as TicketIcon, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';

interface Stats {
  total: number;
  abiertos: number;
  enProgreso: number;
  resueltos: number;
  criticos: number;
}

export default function DashboardPage() {
  const { usuario } = useAuthStore();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    abiertos: 0,
    enProgreso: 0,
    resueltos: 0,
    criticos: 0,
  });

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const res = await api.get('/tickets');
      const data: Ticket[] = res.data;
      setTickets(data);
      setStats({
        total: data.length,
        abiertos: data.filter(t => t.estado === 1).length,
        enProgreso: data.filter(t => t.estado === 2).length,
        resueltos: data.filter(t => t.estado === 3).length,
        criticos: data.filter(t => t.prioridad === 4).length,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
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
      <div>
        <h1 className="text-2xl font-bold text-white">
          Hola, {usuario?.nombre?.split(' ')[0]} 👋
        </h1>
        <p className="text-gray-400 mt-1">Resumen del sistema de tickets</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total tickets"
          value={stats.total}
          icon={<TicketIcon className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          label="Abiertos"
          value={stats.abiertos}
          icon={<AlertCircle className="w-5 h-5" />}
          color="yellow"
        />
        <StatCard
          label="En progreso"
          value={stats.enProgreso}
          icon={<Clock className="w-5 h-5" />}
          color="purple"
        />
        <StatCard
          label="Resueltos"
          value={stats.resueltos}
          icon={<CheckCircle className="w-5 h-5" />}
          color="green"
        />
      </div>

      {/* Críticos */}
      {stats.criticos > 0 && (
        <div className="bg-red-950 border border-red-800 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-red-300 text-sm">
            Hay <span className="font-bold text-red-400">{stats.criticos}</span> ticket(s) con prioridad crítica sin resolver.
          </p>
          <Link href="/tickets?prioridad=4" className="ml-auto text-red-400 hover:text-red-300 text-sm font-medium whitespace-nowrap">
            Ver ahora →
          </Link>
        </div>
      )}

      {/* Tickets recientes */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-white font-semibold">Tickets recientes</h2>
          <Link href="/tickets" className="text-blue-400 hover:text-blue-300 text-sm">
            Ver todos →
          </Link>
        </div>

        {tickets.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <TicketIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>No hay tickets aún</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {tickets.slice(0, 8).map((ticket) => (
              <Link
                key={ticket.id}
                href={`/tickets/${ticket.id}`}
                className="flex flex-wrap items-center gap-2 sm:gap-4 p-4 hover:bg-gray-800/50 transition"
              >
                {/* Número */}
                <span className="text-gray-500 text-sm font-mono sm:w-24 shrink-0">
                  {ticket.numero}
                </span>

                {/* Título */}
                <span className="text-white text-sm flex-1 min-w-[120px] truncate order-last sm:order-none basis-full sm:basis-auto">
                  {ticket.titulo}
                </span>

                {/* Prioridad */}
                <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${PRIORIDAD_COLORS[ticket.prioridad]}`}>
                  {PRIORIDAD_LABELS[ticket.prioridad]}
                </span>

                {/* Estado */}
                <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${ESTADO_COLORS[ticket.estado]}`}>
                  {ESTADO_LABELS[ticket.estado]}
                </span>

                {/* Fecha */}
                <span className="hidden sm:inline text-gray-500 text-xs shrink-0">
                  {formatDistanceToNow(new Date(ticket.fechaCreacion), {
                    addSuffix: true,
                    locale: es,
                  })}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Componente StatCard
function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: 'blue' | 'yellow' | 'purple' | 'green';
}) {
  const colors = {
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    yellow: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    green: 'bg-green-500/10 text-green-400 border-green-500/20',
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-gray-400 text-sm">{label}</span>
        <div className={`w-9 h-9 rounded-lg border flex items-center justify-center ${colors[color]}`}>
          {icon}
        </div>
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
    </div>
  );
}