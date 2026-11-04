/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { Ticket } from '@/types';

// Análisis de causa y reincidencia (PR-INF-03, P2). El análisis es obligatorio
// para tickets Críticos y reincidentes antes de resolverlos. La reincidencia
// se marca a mano; el sistema solo avisa cuando hubo 3 o más tickets del mismo
// sistema o servicio en los últimos 30 días.
export default function AnalisisCausa({ ticket, onChanged }: { ticket: Ticket; onChanged: () => Promise<void> }) {
  const [causa, setCausa] = useState(ticket.analisisCausa ?? '');
  const [guardando, setGuardando] = useState(false);

  const exigido = ticket.prioridad === 4 || ticket.reincidente;
  const posibleReincidencia = (ticket.mismoSistema30d ?? 0) >= 3;

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

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
      <h3 className="text-white font-medium">Análisis de causa</h3>

      {posibleReincidencia && !ticket.reincidente && (
        <p className="text-xs text-orange-400 bg-orange-500/10 rounded-lg px-3 py-2">
          Hubo {ticket.mismoSistema30d} tickets de {ticket.sistemaModulo} en los últimos 30 días. Si es la misma falla,
          marcalo como reincidente.
        </p>
      )}

      <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
        <input
          type="checkbox"
          checked={ticket.reincidente}
          disabled={guardando}
          onChange={(e) => guardar({ reincidente: e.target.checked }, 'Reincidencia actualizada')}
        />
        Reincidente (misma falla 3 o más veces en 30 días)
      </label>

      <div>
        <label className="text-gray-500 text-xs mb-1 block">
          Causa de la falla{exigido ? ' (obligatoria para resolver este ticket)' : ''}
        </label>
        <textarea
          value={causa}
          onChange={(e) => setCausa(e.target.value)}
          rows={3}
          placeholder="¿Qué provocó la falla? ¿Se abrió una acción correctiva? (referencia libre)"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm resize-none"
        />
      </div>
      <button
        disabled={guardando || causa.trim() === (ticket.analisisCausa ?? '').trim()}
        onClick={() => guardar({ analisisCausa: causa }, 'Análisis de causa guardado')}
        className="text-xs px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-40"
      >
        Guardar análisis
      </button>
    </div>
  );
}
