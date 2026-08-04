import { findTicketById } from '@/lib/tickets/service';
import { ESTADO_LABELS, ESTADO_COLORS, PRIORIDAD_LABELS, PRIORIDAD_COLORS } from '@/types';
import {
  CheckCircle2, Clock, Tag, User, Building2, XCircle,
  Inbox, Wrench, Lock, Paperclip, Download, File, FileText,
  FileSpreadsheet, MessageCircle,
} from 'lucide-react';

// Página pública (sin login) — es el link que el cliente recibe por
// WhatsApp para hacer seguimiento de su ticket. Se accede por el id (UUID
// aleatorio), no por el número secuencial, para que no sea adivinable.

const IMAGENES = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

function extension(nombre: string): string {
  return nombre.split('.').pop()?.toLowerCase() ?? '';
}

function iconoArchivo(nombre: string) {
  const ext = extension(nombre);
  if (ext === 'pdf') return FileText;
  if (['xls', 'xlsx', 'csv'].includes(ext)) return FileSpreadsheet;
  if (['doc', 'docx'].includes(ext)) return FileText;
  return File;
}

function formatTamanio(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Esta página se renderiza en el servidor (Vercel corre en UTC), así que
// sin fijar el huso horario acá las fechas salen 3 horas adelantadas para
// cualquiera que la vea desde Paraguay.
function formatPY(fecha: Date | string): string {
  return new Date(fecha).toLocaleString('es-PY', { timeZone: 'America/Asuncion' });
}

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
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-sm w-full text-center animate-[popIn_0.4s_ease-out_both]">
          <XCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-white font-medium">Ticket no encontrado</p>
          <p className="text-gray-500 text-sm mt-1">Revisá que el link esté completo.</p>
        </div>
      </div>
    );
  }

  const fechaAsignacion = ticket.historiales?.find((h) => h.tipo === 'ASIGNACION')?.fechaCreacion;

  const pasos = [
    { valor: 1, label: 'Ticket recibido', icon: Inbox, fecha: ticket.fechaCreacion },
    { valor: 2, label: 'En progreso', icon: Wrench, fecha: fechaAsignacion },
    { valor: 3, label: 'Resuelto', icon: CheckCircle2, fecha: ticket.estado >= 3 ? ticket.fechaResolucion : undefined },
    { valor: 4, label: 'Cerrado', icon: Lock, fecha: ticket.estado === 4 ? ticket.fechaResolucion : undefined },
  ];

  return (
    <div className="min-h-screen bg-gray-950 py-10 px-4">
      <div className="max-w-lg mx-auto space-y-4">

        {/* Header */}
        <div
          className="flex items-center gap-2 mb-2 animate-[fadeInUp_0.5s_ease-out_both]"
        >
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">IT</span>
          </div>
          <span className="text-white font-semibold text-sm">ITTicketPy</span>
        </div>

        {/* Card principal */}
        <div
          className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5 animate-[fadeInUp_0.5s_ease-out_0.05s_both]"
        >
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
              <span>Creado {formatPY(ticket.fechaCreacion)}</span>
            </div>
            {ticket.fechaResolucion && (
              <div className="flex items-center gap-2 text-gray-400">
                <CheckCircle2 className="w-4 h-4 text-gray-500 shrink-0" />
                <span>Resuelto {formatPY(ticket.fechaResolucion)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Timeline de estado */}
        <div
          className="bg-gray-900 border border-gray-800 rounded-2xl p-6 animate-[fadeInUp_0.5s_ease-out_0.1s_both]"
        >
          <h2 className="text-white font-medium text-sm mb-5">Estado del ticket</h2>
          <div>
            {pasos.map((paso, i) => {
              const completado = ticket.estado > paso.valor;
              const actual = ticket.estado === paso.valor;
              const alcanzado = completado || actual;
              const Icon = paso.icon;
              const esUltimo = i === pasos.length - 1;

              return (
                <div key={paso.valor} className="relative flex gap-4">
                  {/* Columna del ícono + línea conectora */}
                  <div className="flex flex-col items-center shrink-0">
                    <div
                      className={`relative w-9 h-9 rounded-full flex items-center justify-center border-2 transition-colors animate-[popIn_0.4s_ease-out_both] ${
                        alcanzado
                          ? paso.valor >= 3
                            ? 'bg-green-500 border-green-400'
                            : 'bg-blue-500 border-blue-400'
                          : 'bg-gray-800 border-gray-700'
                      } ${actual ? 'animate-[softPulse_2s_ease-in-out_infinite]' : ''}`}
                      style={{ animationDelay: `${i * 120}ms` }}
                    >
                      <Icon className={`w-4 h-4 ${alcanzado ? 'text-white' : 'text-gray-600'}`} />
                    </div>
                    {!esUltimo && (
                      <div className="w-0.5 flex-1 min-h-[28px] bg-gray-800 overflow-hidden mt-0.5">
                        <div
                          className={`w-full h-full origin-top ${
                            completado ? 'bg-green-500 animate-[growLine_0.5s_ease-out_both]' : ''
                          }`}
                          style={{ animationDelay: `${i * 120 + 150}ms` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Etiqueta + fecha */}
                  <div className={`pb-6 ${esUltimo ? 'pb-0' : ''}`}>
                    <p className={`text-sm font-medium ${alcanzado ? 'text-white' : 'text-gray-600'}`}>
                      {paso.label}
                    </p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {paso.fecha
                        ? formatPY(paso.fecha)
                        : actual
                          ? 'En curso'
                          : 'Pendiente'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Adjuntos */}
        {ticket.adjuntos && ticket.adjuntos.length > 0 && (
          <div
            className="bg-gray-900 border border-gray-800 rounded-2xl p-6 animate-[fadeInUp_0.5s_ease-out_0.15s_both]"
          >
            <h2 className="text-white font-medium text-sm mb-4 flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-gray-500" />
              Archivos adjuntos ({ticket.adjuntos.length})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {ticket.adjuntos.map((a, i) => {
                const esImagen = IMAGENES.includes(extension(a.nombreArchivo));
                const Icon = iconoArchivo(a.nombreArchivo);
                return (
                  <a
                    key={a.id}
                    href={a.rutaArchivo}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block bg-gray-800 border border-gray-700 rounded-xl overflow-hidden hover:border-blue-500/60 hover:-translate-y-0.5 transition-all duration-200 animate-[fadeInUp_0.4s_ease-out_both]"
                    style={{ animationDelay: `${150 + i * 60}ms` }}
                  >
                    {esImagen ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={a.rutaArchivo}
                        alt={a.nombreArchivo}
                        className="w-full aspect-video object-cover bg-gray-950 group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full aspect-video flex items-center justify-center bg-gray-950">
                        <Icon className="w-7 h-7 text-gray-500 group-hover:text-blue-400 transition-colors" />
                      </div>
                    )}
                    <div className="p-2.5">
                      <p className="text-gray-300 text-xs truncate group-hover:text-white transition-colors">
                        {a.nombreArchivo}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-gray-600 text-xs">{formatTamanio(a.tamanio)}</span>
                        <Download className="w-3 h-3 text-gray-600 group-hover:text-blue-400 transition-colors" />
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* Conversación con soporte */}
        {ticket.mensajesChat && ticket.mensajesChat.length > 0 && (
          <div
            className="bg-gray-900 border border-gray-800 rounded-2xl p-6 animate-[fadeInUp_0.5s_ease-out_0.2s_both]"
          >
            <h2 className="text-white font-medium text-sm mb-4 flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-gray-500" />
              Conversación
            </h2>
            <div className="space-y-4">
              {ticket.mensajesChat.map((m, i) => {
                const esCliente = m.usuarioId === ticket.usuarioId;
                return (
                  <div
                    key={m.id}
                    className="flex gap-3 animate-[fadeInUp_0.4s_ease-out_both]"
                    style={{ animationDelay: `${200 + i * 50}ms` }}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      esCliente ? 'bg-gray-600' : 'bg-blue-500'
                    }`}>
                      <span className="text-white text-xs font-bold">
                        {m.usuario?.nombre?.charAt(0) ?? 'U'}
                      </span>
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">
                        {esCliente ? 'Vos' : m.usuario?.nombre ?? 'Soporte'}
                      </p>
                      <p className="text-gray-400 text-sm">{m.contenido}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <p className="text-center text-gray-600 text-xs pt-2 animate-[fadeInUp_0.5s_ease-out_0.25s_both]">
          ITTicketPy · Sistema de tickets
        </p>
      </div>
    </div>
  );
}
