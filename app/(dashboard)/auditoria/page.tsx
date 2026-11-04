/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Printer, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { useAuthStore } from '@/store/auth.store';
import { ESTADO_LABELS, PRIORIDAD_LABELS } from '@/types';

interface Cumplimiento {
  medidos: number;
  enPlazo: number;
  porcentaje: number | null;
}
interface Reporte {
  mes: string;
  totalRecibidos: number;
  cumplimiento: { prioridad: number; total: number; primeraRespuesta: Cumplimiento; resolucion: Cumplimiento }[];
  porTipo: { clave: string; total: number }[];
  porEstado: { clave: string; total: number }[];
  porSistema: { clave: string; total: number }[];
  criticos: {
    id: string;
    numero: string;
    titulo: string;
    estado: number;
    sistema: string;
    recepcion: string;
    analisisCausa: string | null;
    motivoDesvio: string | null;
  }[];
}

// Mes anterior en formato AAAA-MM: es el que se revisa a principios de mes.
function mesAnterior(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function Pct({ c }: { c: Cumplimiento }) {
  if (c.porcentaje === null) return <span className="text-gray-600">—</span>;
  const color = c.porcentaje >= 90 ? 'text-green-400' : c.porcentaje >= 70 ? 'text-yellow-400' : 'text-red-400';
  return (
    <span>
      <span className={`font-semibold ${color}`}>{c.porcentaje}%</span>
      <span className="text-gray-500 text-xs ml-2">
        ({c.enPlazo} de {c.medidos})
      </span>
    </span>
  );
}

function TablaConteo({ titulo, filas }: { titulo: string; filas: { clave: string; total: number }[] }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 break-inside-avoid">
      <h3 className="text-white font-medium mb-3">{titulo}</h3>
      {filas.length === 0 ? (
        <p className="text-gray-500 text-sm">Sin datos</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {filas.map((f) => (
              <tr key={f.clave} className="border-t border-gray-800 first:border-0">
                <td className="py-1.5 text-gray-300">{f.clave}</td>
                <td className="py-1.5 text-right text-white font-medium">{f.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function AuditoriaPage() {
  const router = useRouter();
  const { usuario } = useAuthStore();
  const [mes, setMes] = useState(mesAnterior());
  const [reporte, setReporte] = useState<Reporte | null>(null);
  const [loading, setLoading] = useState(true);

  const esAdmin = usuario?.rol === 2 || usuario?.rol === 3;

  useEffect(() => {
    if (usuario && !esAdmin) router.push('/dashboard');
  }, [usuario]);

  useEffect(() => {
    if (!esAdmin || !/^\d{4}-\d{2}$/.test(mes)) return;
    let vigente = true;
    api
      .get<Reporte>('/reportes/auditoria', { params: { mes } })
      .then((res) => vigente && setReporte(res.data))
      .catch(() => vigente && toast.error('No se pudo generar el reporte'))
      .finally(() => vigente && setLoading(false));
    return () => {
      vigente = false;
    };
  }, [mes, esAdmin]);

  if (!esAdmin) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Reportes de auditoría</h1>
            <p className="text-gray-400 text-sm">Tickets recibidos en el mes · PR-INF-03</p>
          </div>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <input
            type="month"
            value={mes}
            onChange={(e) => {
              setLoading(true);
              setMes(e.target.value);
            }}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={() => window.print()}
            disabled={!reporte}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition text-sm"
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
        </div>
      </div>

      {loading || !reporte ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
        </div>
      ) : (
        <>
          <p className="text-gray-400 text-sm">
            {reporte.totalRecibidos} {reporte.totalRecibidos === 1 ? 'ticket recibido' : 'tickets recibidos'} en {reporte.mes}.
          </p>

          {/* Cumplimiento de plazos */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 break-inside-avoid">
            <h2 className="text-white font-medium">Cumplimiento de plazos por prioridad</h2>
            <p className="text-gray-500 text-xs mt-1 mb-3">
              Porcentaje de tickets que respetaron el plazo. Solo cuentan los plazos ya determinados: los que siguen
              corriendo, los históricos sin dato y la resolución de desarrollo y mejora sin plazo propuesto quedan afuera.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs text-left">
                    <th className="pb-2 font-medium">Prioridad</th>
                    <th className="pb-2 font-medium">Tickets</th>
                    <th className="pb-2 font-medium">Primera respuesta</th>
                    <th className="pb-2 font-medium">Resolución</th>
                  </tr>
                </thead>
                <tbody>
                  {reporte.cumplimiento.map((f) => (
                    <tr key={f.prioridad} className={`border-t border-gray-800 ${f.prioridad === 0 ? 'font-medium' : ''}`}>
                      <td className="py-2 text-gray-200">{f.prioridad === 0 ? 'Total' : PRIORIDAD_LABELS[f.prioridad]}</td>
                      <td className="py-2 text-gray-300">{f.total}</td>
                      <td className="py-2">
                        <Pct c={f.primeraRespuesta} />
                      </td>
                      <td className="py-2">
                        <Pct c={f.resolucion} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Por tipo, estado y sistema */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <TablaConteo titulo="Por tipo" filas={reporte.porTipo} />
            <TablaConteo titulo="Por estado" filas={reporte.porEstado} />
            <TablaConteo titulo="Por sistema o servicio afectado" filas={reporte.porSistema} />
          </div>

          {/* Críticos */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-white font-medium">Tickets Críticos y su análisis de causa</h2>
            {reporte.criticos.length === 0 ? (
              <p className="text-gray-500 text-sm mt-2">No hubo tickets Críticos en el mes.</p>
            ) : (
              <ul className="divide-y divide-gray-800 mt-3">
                {reporte.criticos.map((c) => (
                  <li key={c.numero} className="py-3 space-y-1 break-inside-avoid">
                    <p className="text-sm">
                      <Link href={`/tickets/${c.id}`} className="font-mono text-blue-400 hover:text-blue-300 mr-2">
                        {c.numero}
                      </Link>
                      <span className="text-gray-200">{c.titulo}</span>
                      <span className="text-gray-500 text-xs ml-2">
                        {ESTADO_LABELS[c.estado]} · {c.sistema}
                      </span>
                    </p>
                    <p className="text-sm text-gray-400">
                      <span className="text-gray-500">Causa:</span>{' '}
                      {c.analisisCausa ?? <span className="text-orange-400">Sin análisis de causa registrado</span>}
                    </p>
                    {c.motivoDesvio && (
                      <p className="text-sm text-gray-400">
                        <span className="text-gray-500">Motivo del desvío:</span> {c.motivoDesvio}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
