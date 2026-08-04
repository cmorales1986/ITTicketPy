import { findTicketById } from '@/lib/tickets/service';
import { ESTADO_LABELS, ESTADO_COLORS, PRIORIDAD_LABELS, PRIORIDAD_COLORS } from '@/types';
import { CheckCircle2, Clock, Tag, User, Building2, XCircle } from 'lucide-react';

// Página pública (sin login) — es el link que el cliente recibe por
// WhatsApp para hacer seguimiento de su ticket. Se accede por el id (UUID
// aleatorio), no por el número secuencial, para que no sea adivinable.
export default async function SeguimientoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ticket = await findTicketById(id);

  if (!ticket) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-sm w-full text-center">
          <XCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-white font-medium">Ticket no encontrado</p>
          <p className="text-gray-500 text-sm mt-1">Revisá que el link esté completo.</p>
        </div>
      </div>
    );
  }

  const comentariosPublicos = (ticket.comentarios ?? []).filter((c) => !c.interno);

  return (
    <div className="min-h-screen bg-gray-950 py-10 px-4">
      <div className="max-w-lg mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">IT</span>
          </div>
          <span className="text-white font-semibold text-sm">ITTicketPy</span>
        </div>

        {/* Card principal */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="text-gray-500 font-mono text-sm">{ticket.numero}</span>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${PRIORIDAD_COLORS[ticket.prioridad]}`}>
                {PRIORIDAD_LABELS[ticket.prioridad]}
              </span>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${ESTADO_COLORS[ticket.estado]}`}>
                {ESTADO_LABELS[ticket.estado]}
              </span>
            </div>
            <h1 className="text-white text-lg font-bold">{ticket.titulo}</h1>
            <p className="text-gray-400 text-sm mt-2 whitespace-pre-wrap">{ticket.descripcion}</p>
          </div>

          <div className="border-t border-gray-800 pt-4 space-y-2.5 text-sm">
            {ticket.empresa && (
              <div className="flex items-center gap-2 text-gray-400">
                <Building2 className="w-4 h-4 text-gray-500 shrink-0" />
                <span>{ticket.empresa.nombre}</span>
              </div>
            )}
            {ticket.categoria && (
              <div className="flex items-center gap-2 text-gray-400">
                <Tag className="w-4 h-4 text-gray-500 shrink-0" />
                <span>{ticket.categoria.nombre}</span>
              </div>
            )}
            {ticket.tecnicoAsignado && (
              <div className="flex items-center gap-2 text-gray-400">
                <User className="w-4 h-4 text-gray-500 shrink-0" />
                <span>Asignado a {ticket.tecnicoAsignado.nombre}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-gray-400">
              <Clock className="w-4 h-4 text-gray-500 shrink-0" />
              <span>Creado {new Date(ticket.fechaCreacion).toLocaleString('es-PY')}</span>
            </div>
            {ticket.fechaResolucion && (
              <div className="flex items-center gap-2 text-gray-400">
                <CheckCircle2 className="w-4 h-4 text-gray-500 shrink-0" />
                <span>Resuelto {new Date(ticket.fechaResolucion).toLocaleString('es-PY')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Comentarios visibles */}
        {comentariosPublicos.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-white font-medium text-sm mb-4">Actualizaciones</h2>
            <div className="space-y-4">
              {comentariosPublicos.map((c) => (
                <div key={c.id} className="flex gap-3">
                  <div className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-white text-xs font-bold">
                      {c.usuario?.nombre?.charAt(0) ?? 'U'}
                    </span>
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{c.usuario?.nombre ?? 'Soporte'}</p>
                    <p className="text-gray-400 text-sm">{c.contenido}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-gray-600 text-xs pt-2">
          ITTicketPy · Sistema de tickets
        </p>
      </div>
    </div>
  );
}
