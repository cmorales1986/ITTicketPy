/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import api from '@/lib/axios';
import { Ticket } from '@/types';
import { APROBACION_LABELS, APROBACION_TIPOS, RESULTADOS_PRUEBAS, type AprobacionTipo } from '@/lib/tickets/estados';

// Solicitudes de desarrollo y mejora (PR-INF-03, P2): evaluación,
// aprobaciones, pruebas y puesta en producción. Solo campos de texto, fechas y
// casillas: sin flujos automáticos ni notificaciones. Lo maneja una persona.

const caja = 'bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3';
const campo =
  'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm';
const etiqueta = 'text-gray-500 text-xs mb-1 block';
const boton =
  'text-xs px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-40 inline-flex items-center gap-2';

function hoyIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function DesarrolloPanel({ ticket, onChanged }: { ticket: Ticket; onChanged: () => Promise<void> }) {
  const [guardando, setGuardando] = useState(false);

  // Evaluación
  const [alcance, setAlcance] = useState(ticket.evalAlcance ?? '');
  const [esfuerzo, setEsfuerzo] = useState(ticket.evalEsfuerzo ?? '');
  const [conCosto, setConCosto] = useState(ticket.evalConCosto);
  const [costo, setCosto] = useState(ticket.evalCosto ?? '');
  const [impacto, setImpacto] = useState(ticket.evalImpacto ?? '');
  const [plazo, setPlazo] = useState(ticket.plazoPropuesto?.slice(0, 10) ?? '');

  // Pruebas y producción
  const [resultado, setResultado] = useState(ticket.pruebasResultado ?? '');
  const [fechaPruebas, setFechaPruebas] = useState(ticket.pruebasFecha?.slice(0, 10) ?? hoyIso());
  const [notaPruebas, setNotaPruebas] = useState(ticket.pruebasNota ?? '');
  const [fechaProduccion, setFechaProduccion] = useState(hoyIso());

  // Aprobación en curso de registrar
  const [aprobando, setAprobando] = useState<AprobacionTipo | null>(null);
  const [quien, setQuien] = useState('');
  const [cuando, setCuando] = useState(hoyIso());
  const [comentario, setComentario] = useState('');

  const guardar = async (cuerpo: Record<string, unknown>, ok: string) => {
    setGuardando(true);
    try {
      await api.put(`/tickets/${ticket.id}`, cuerpo);
      await onChanged();
      toast.success(ok);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  };

  const registrarAprobacion = async () => {
    if (!aprobando) return;
    setGuardando(true);
    try {
      await api.post(`/tickets/${ticket.id}/aprobaciones`, {
        tipo: aprobando,
        aprobadoPor: quien,
        fechaAprobacion: cuando,
        comentario,
      });
      setAprobando(null);
      setQuien('');
      setComentario('');
      await onChanged();
      toast.success('Aprobación registrada');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'No se pudo registrar la aprobación');
    } finally {
      setGuardando(false);
    }
  };

  const ultimaPorTipo = (tipo: AprobacionTipo) =>
    [...(ticket.aprobaciones ?? [])].reverse().find((a) => a.tipo === tipo);

  return (
    <>
      {/* Evaluación */}
      <div className={caja}>
        <h3 className="text-white font-medium">Evaluación</h3>
        <div>
          <label className={etiqueta}>Alcance</label>
          <textarea value={alcance} onChange={(e) => setAlcance(e.target.value)} rows={3} className={`${campo} resize-none`} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={etiqueta}>Esfuerzo estimado</label>
            <input value={esfuerzo} onChange={(e) => setEsfuerzo(e.target.value)} placeholder="Ej: 16 horas" className={campo} />
          </div>
          <div>
            <label className={etiqueta}>Plazo propuesto (es el plazo de resolución)</label>
            <input type="date" value={plazo} onChange={(e) => setPlazo(e.target.value)} className={campo} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
          <input type="checkbox" checked={conCosto} onChange={(e) => setConCosto(e.target.checked)} />
          Tiene costo (exige la aprobación de Gerencia General)
        </label>
        {conCosto && (
          <div>
            <label className={etiqueta}>Costo</label>
            <input value={costo} onChange={(e) => setCosto(e.target.value)} placeholder="Ej: USD 500" className={campo} />
          </div>
        )}
        <div>
          <label className={etiqueta}>Impacto sobre otros sistemas</label>
          <textarea value={impacto} onChange={(e) => setImpacto(e.target.value)} rows={2} className={`${campo} resize-none`} />
        </div>
        <button
          disabled={guardando}
          className={boton}
          onClick={() =>
            guardar(
              {
                evalAlcance: alcance,
                evalEsfuerzo: esfuerzo,
                evalConCosto: conCosto,
                evalCosto: conCosto ? costo : '',
                evalImpacto: impacto,
                plazoPropuesto: plazo,
              },
              'Evaluación guardada',
            )
          }
        >
          {guardando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Guardar evaluación
        </button>
      </div>

      {/* Aprobaciones */}
      <div className={caja}>
        <h3 className="text-white font-medium">Aprobaciones</h3>
        <p className="text-gray-500 text-xs">
          Cada aprobación queda registrada con quién aprobó, cuándo y la evidencia (podés adjuntar el correo o la
          captura al ticket). No se modifican: si hubo un error, registrá otra.
        </p>
        {APROBACION_TIPOS.filter((t) => t !== 'GG' || ticket.evalConCosto).map((tipo) => {
          const a = ultimaPorTipo(tipo);
          return (
            <div key={tipo} className="border border-gray-800 rounded-lg p-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-gray-200">{APROBACION_LABELS[tipo].titulo}</p>
                  <p className="text-xs text-gray-500">{APROBACION_LABELS[tipo].detalle}</p>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                    a ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'
                  }`}
                >
                  {a ? 'Aprobada' : 'Pendiente'}
                </span>
              </div>
              {a && (
                <p className="text-xs text-gray-400">
                  {a.aprobadoPor} · {a.fechaAprobacion.slice(0, 10)} — {a.comentario}
                </p>
              )}
              {aprobando === tipo ? (
                <div className="space-y-2">
                  <input value={quien} onChange={(e) => setQuien(e.target.value)} placeholder="Quién aprobó (nombre)" className={campo} />
                  <input type="date" value={cuando} onChange={(e) => setCuando(e.target.value)} className={campo} />
                  <textarea
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                    rows={2}
                    placeholder="Comentario o evidencia (ej: aprobó por correo del 5/11, adjunto)"
                    className={`${campo} resize-none`}
                  />
                  <div className="flex gap-2">
                    <button onClick={() => setAprobando(null)} className="text-xs px-4 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white">
                      Cancelar
                    </button>
                    <button
                      onClick={registrarAprobacion}
                      disabled={guardando || quien.trim().length < 2 || comentario.trim().length < 3}
                      className={boton}
                    >
                      Registrar aprobación
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAprobando(tipo)} className="text-xs text-blue-400 hover:text-blue-300">
                  {a ? 'Registrar otra aprobación' : 'Registrar aprobación'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Pruebas y puesta en producción */}
      <div className={caja}>
        <h3 className="text-white font-medium">Pruebas y puesta en producción</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={etiqueta}>Resultado de las pruebas</label>
            <select value={resultado} onChange={(e) => setResultado(e.target.value)} className={campo}>
              <option value="">Sin pruebas todavía</option>
              {Object.entries(RESULTADOS_PRUEBAS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={etiqueta}>Fecha de las pruebas</label>
            <input type="date" value={fechaPruebas} onChange={(e) => setFechaPruebas(e.target.value)} className={campo} />
          </div>
        </div>
        <div>
          <label className={etiqueta}>Detalle</label>
          <textarea value={notaPruebas} onChange={(e) => setNotaPruebas(e.target.value)} rows={2} className={`${campo} resize-none`} />
        </div>
        <button
          disabled={guardando || !resultado}
          className={boton}
          onClick={() =>
            guardar({ pruebasResultado: resultado, pruebasFecha: fechaPruebas, pruebasNota: notaPruebas }, 'Pruebas guardadas')
          }
        >
          Guardar pruebas
        </button>

        <div className="border-t border-gray-800 pt-3 space-y-2">
          {ticket.produccionFecha ? (
            <p className="text-sm text-green-400">Puesta en producción registrada el {ticket.produccionFecha.slice(0, 10)}.</p>
          ) : (
            <>
              <p className="text-xs text-gray-500">
                Para pasar a producción hace falta la conformidad del usuario y la aprobación del Gerente de TI
                {ticket.evalConCosto ? ' y de Gerencia General (tiene costo)' : ''}.
              </p>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className={etiqueta}>Fecha de puesta en producción</label>
                  <input type="date" value={fechaProduccion} onChange={(e) => setFechaProduccion(e.target.value)} className={campo} />
                </div>
                <button
                  disabled={guardando}
                  className={boton}
                  onClick={() => guardar({ produccionFecha: fechaProduccion }, 'Puesta en producción registrada')}
                >
                  Registrar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
