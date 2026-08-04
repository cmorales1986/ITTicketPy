/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';
import {
  Ticket, Empresa, Categoria,
  ESTADO_LABELS, ESTADO_COLORS, PRIORIDAD_LABELS, PRIORIDAD_COLORS,
} from '@/types';
import { useAuthStore } from '@/store/auth.store';
import { toast } from 'sonner';
import { Loader2, FileDown, Printer, ClipboardList } from 'lucide-react';
import { format } from 'date-fns';
import Estrellas from '@/components/tickets/Estrellas';

function hace30Dias(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ReportesPage() {
  const router = useRouter();
  const { usuario } = useAuthStore();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);

  const [desde, setDesde] = useState(hace30Dias());
  const [hasta, setHasta] = useState(hoy());
  const [filtroEmpresa, setFiltroEmpresa] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');

  useEffect(() => {
    // Solo admins pueden ver esta página
    if (usuario?.rol !== 2 && usuario?.rol !== 3) {
      router.push('/dashboard');
      return;
    }
    Promise.all([api.get('/empresas?all=1'), api.get('/categorias?all=1')])
      .then(([e, c]) => { setEmpresas(e.data); setCategorias(c.data); })
      .catch(() => toast.error('Error al cargar filtros'));
  }, []);

  useEffect(() => {
    if (usuario?.rol !== 2 && usuario?.rol !== 3) return;
    buscar();
  }, [desde, hasta, filtroEmpresa, filtroEstado, filtroCategoria]);

  const buscar = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (desde) params.set('desde', desde);
      if (hasta) params.set('hasta', hasta);
      if (filtroEmpresa) params.set('empresaId', filtroEmpresa);
      if (filtroEstado) params.set('estado', filtroEstado);
      if (filtroCategoria) params.set('categoriaId', filtroCategoria);
      const res = await api.get(`/reportes/tickets?${params.toString()}`);
      setTickets(res.data);
    } catch {
      toast.error('Error al generar el reporte');
    } finally {
      setLoading(false);
    }
  };

  const porEstado = [1, 2, 3, 4].map((e) => ({
    estado: e,
    cantidad: tickets.filter((t) => t.estado === e).length,
  }));

  const exportarCsv = () => {
    const filas = [
      ['Número', 'Título', 'Empresa', 'Categoría', 'Prioridad', 'Estado', 'Reportado por', 'Técnico', 'Creado', 'Resuelto', 'Calificación'],
      ...tickets.map((t) => [
        t.numero,
        t.titulo,
        t.empresa?.nombre ?? '',
        t.categoria?.nombre ?? '',
        PRIORIDAD_LABELS[t.prioridad],
        ESTADO_LABELS[t.estado],
        t.usuario?.nombre ?? '',
        t.tecnicoAsignado?.nombre ?? '',
        format(new Date(t.fechaCreacion), 'dd/MM/yyyy HH:mm'),
        t.fechaResolucion ? format(new Date(t.fechaResolucion), 'dd/MM/yyyy HH:mm') : '',
        t.calificacion ? `${t.calificacion}/5` : '',
      ]),
    ];
    const csv = filas.map((f) => f.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-tickets_${desde}_${hasta}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (usuario?.rol !== 2 && usuario?.rol !== 3) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-white">Reporte de tickets</h1>
          <p className="text-gray-400 mt-1">Para auditoría — actividad de tickets en un rango de fechas</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportarCsv}
            disabled={tickets.length === 0}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg transition text-sm"
          >
            <FileDown className="w-4 h-4" />
            Exportar CSV
          </button>
          <button
            onClick={() => window.print()}
            disabled={tickets.length === 0}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg transition text-sm"
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 print:hidden">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="text-gray-500 text-xs mb-1 block">Desde</label>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-gray-500 text-xs mb-1 block">Hasta</label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-gray-500 text-xs mb-1 block">Empresa</label>
            <select
              value={filtroEmpresa}
              onChange={(e) => setFiltroEmpresa(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="">Todas</option>
              {empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="text-gray-500 text-xs mb-1 block">Categoría</label>
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="">Todas</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="text-gray-500 text-xs mb-1 block">Estado</label>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="">Todos</option>
              <option value="1">Abierto</option>
              <option value="2">En Progreso</option>
              <option value="3">Resuelto</option>
              <option value="4">Cerrado</option>
            </select>
          </div>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs">Total</p>
          <p className="text-white text-2xl font-bold mt-1">{tickets.length}</p>
        </div>
        {porEstado.map(({ estado, cantidad }) => (
          <div key={estado} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-500 text-xs">{ESTADO_LABELS[estado]}</p>
            <p className="text-white text-2xl font-bold mt-1">{cantidad}</p>
          </div>
        ))}
      </div>

      {/* Tabla */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Sin tickets en este rango</p>
            <p className="text-sm mt-1">Probá ajustar los filtros</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-gray-500 text-xs font-medium px-4 py-3 uppercase tracking-wider">Número</th>
                  <th className="text-left text-gray-500 text-xs font-medium px-4 py-3 uppercase tracking-wider">Título</th>
                  <th className="text-left text-gray-500 text-xs font-medium px-4 py-3 uppercase tracking-wider">Empresa</th>
                  <th className="text-left text-gray-500 text-xs font-medium px-4 py-3 uppercase tracking-wider">Prioridad</th>
                  <th className="text-left text-gray-500 text-xs font-medium px-4 py-3 uppercase tracking-wider">Estado</th>
                  <th className="text-left text-gray-500 text-xs font-medium px-4 py-3 uppercase tracking-wider">Reportado por</th>
                  <th className="text-left text-gray-500 text-xs font-medium px-4 py-3 uppercase tracking-wider">Técnico</th>
                  <th className="text-left text-gray-500 text-xs font-medium px-4 py-3 uppercase tracking-wider">Creado</th>
                  <th className="text-left text-gray-500 text-xs font-medium px-4 py-3 uppercase tracking-wider">Calificación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {tickets.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => router.push(`/tickets/${t.id}`)}
                    className="hover:bg-gray-800/50 cursor-pointer transition"
                  >
                    <td className="px-4 py-3"><span className="text-gray-400 text-sm font-mono">{t.numero}</span></td>
                    <td className="px-4 py-3"><span className="text-white text-sm">{t.titulo}</span></td>
                    <td className="px-4 py-3"><span className="text-gray-400 text-sm">{t.empresa?.nombre ?? '-'}</span></td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${PRIORIDAD_COLORS[t.prioridad]}`}>
                        {PRIORIDAD_LABELS[t.prioridad]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${ESTADO_COLORS[t.estado]}`}>
                        {ESTADO_LABELS[t.estado]}
                      </span>
                    </td>
                    <td className="px-4 py-3"><span className="text-gray-400 text-sm">{t.usuario?.nombre ?? '-'}</span></td>
                    <td className="px-4 py-3"><span className="text-gray-400 text-sm">{t.tecnicoAsignado?.nombre ?? 'Sin asignar'}</span></td>
                    <td className="px-4 py-3"><span className="text-gray-500 text-sm">{format(new Date(t.fechaCreacion), 'dd/MM/yyyy HH:mm')}</span></td>
                    <td className="px-4 py-3"><Estrellas calificacion={t.calificacion} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
