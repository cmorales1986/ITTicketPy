/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/immutability */
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/axios";
import {
  Ticket,
  Usuario,
  ESTADO_LABELS,
  ESTADO_COLORS,
  PRIORIDAD_LABELS,
  PRIORIDAD_COLORS,
} from "@/types";
import Timeline from "@/components/tickets/Timeline";
import { useAuthStore } from "@/store/auth.store";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowLeft,
  Loader2,
  Send,
  User,
  Clock,
  Tag,
  AlertCircle,
  UserCheck,
} from "lucide-react";

export default function TicketDetallePage() {
  const { id } = useParams();
  const router = useRouter();
  const { usuario } = useAuthStore();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [tecnicos, setTecnicos] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [comentario, setComentario] = useState("");
  const [enviandoComentario, setEnviandoComentario] = useState(false);
  const [actualizando, setActualizando] = useState(false);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const [ticketRes, tecnicosRes] = await Promise.all([
        api.get(`/tickets/${id}`),
        api.get("/usuarios/tecnicos"),
      ]);
      setTicket(ticketRes.data);
      setTecnicos(tecnicosRes.data);
    } catch (err) {
      toast.error("Error al cargar el ticket");
      router.push("/tickets");
    } finally {
      setLoading(false);
    }
  };

  const cambiarEstado = async (estado: number) => {
    setActualizando(true);
    try {
      await api.put(`/tickets/${id}`, { estado });
      await fetchData();
      toast.success("Estado actualizado");
    } catch {
      toast.error("Error al actualizar estado");
    } finally {
      setActualizando(false);
    }
  };

  const asignarTecnico = async (tecnicoId: string) => {
    setActualizando(true);
    try {
      await api.patch(`/tickets/${id}/asignar`, { tecnicoId });
      await fetchData();
      toast.success("Técnico asignado");
    } catch {
      toast.error("Error al asignar técnico");
    } finally {
      setActualizando(false);
    }
  };

  const enviarComentario = async () => {
    if (!comentario.trim()) return;
    setEnviandoComentario(true);
    try {
      await api.post(`/tickets/${id}/comentarios`, { contenido: comentario });
      setComentario("");
      await fetchData();
      toast.success("Comentario agregado");
    } catch {
      toast.error("Error al enviar comentario");
    } finally {
      setEnviandoComentario(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!ticket) return null;

  const isTecnicoOrAdmin = (usuario?.rol ?? 0) >= 1;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/tickets")}
          className="text-gray-400 hover:text-white transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <div className="flex items-center gap-3">
            <span className="text-gray-500 font-mono text-sm">
              {ticket.numero}
            </span>
            <span
              className={`text-xs px-2 py-1 rounded-full font-medium ${PRIORIDAD_COLORS[ticket.prioridad]}`}
            >
              {PRIORIDAD_LABELS[ticket.prioridad]}
            </span>
            <span
              className={`text-xs px-2 py-1 rounded-full font-medium ${ESTADO_COLORS[ticket.estado]}`}
            >
              {ESTADO_LABELS[ticket.estado]}
            </span>
          </div>
          <h1 className="text-xl font-bold text-white mt-1">{ticket.titulo}</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl">
        {/* Columna principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Descripción */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-white font-medium mb-3">Descripción</h3>
            <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
              {ticket.descripcion}
            </p>
          </div>

          {/* Comentarios */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl">
            <div className="p-5 border-b border-gray-800">
              <h3 className="text-white font-medium">
                Comentarios ({ticket.comentarios?.length ?? 0})
              </h3>
            </div>

            <div className="divide-y divide-gray-800">
              {ticket.comentarios?.length === 0 && (
                <div className="p-8 text-center text-gray-600 text-sm">
                  No hay comentarios aún
                </div>
              )}
              {ticket.comentarios?.map((c) => (
                <div key={c.id} className="p-4 flex gap-3">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-white text-xs font-bold">
                      {c.usuario?.nombre?.charAt(0) ?? "U"}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white text-sm font-medium">
                        {c.usuario?.nombre ?? "Usuario"}
                      </span>
                      {c.interno && (
                        <span className="text-xs bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded-full">
                          Interno
                        </span>
                      )}
                      <span className="text-gray-600 text-xs">
                        {formatDistanceToNow(new Date(c.fechaCreacion), {
                          addSuffix: true,
                          locale: es,
                        })}
                      </span>
                    </div>
                    <p className="text-gray-300 text-sm">{c.contenido}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Input comentario */}
            <div className="p-4 border-t border-gray-800">
              <div className="flex gap-3">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-white text-xs font-bold">
                    {usuario?.nombre?.charAt(0) ?? "U"}
                  </span>
                </div>
                <div className="flex-1 flex gap-2">
                  <input
                    type="text"
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && enviarComentario()}
                    placeholder="Escribí un comentario..."
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
                  />
                  <button
                    onClick={enviarComentario}
                    disabled={enviandoComentario || !comentario.trim()}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition"
                  >
                    {enviandoComentario ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
          {/* Timeline */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl">
            <div className="p-5 border-b border-gray-800">
              <h3 className="text-white font-medium flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-500" />
                Actividad ({ticket.historiales?.length ?? 0})
              </h3>
            </div>
            <div className="p-5">
              <Timeline historiales={ticket.historiales ?? []} />
            </div>
          </div>
        </div>

        {/* Sidebar derecho */}
        <div className="space-y-4">
          {/* Info */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
            <h3 className="text-white font-medium text-sm">Información</h3>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-gray-500" />
                <span className="text-gray-400">Reportado por</span>
                <span className="text-white ml-auto">
                  {ticket.usuario?.nombre ?? "-"}
                </span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-gray-500" />
                <span className="text-gray-400">Creado</span>
                <span className="text-white ml-auto text-xs">
                  {format(new Date(ticket.fechaCreacion), "dd/MM/yyyy HH:mm")}
                </span>
              </div>

              {ticket.categoria && (
                <div className="flex items-center gap-2 text-sm">
                  <Tag className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-400">Categoría</span>
                  <span className="text-white ml-auto">
                    {ticket.categoria.nombre}
                  </span>
                </div>
              )}

              {ticket.fechaResolucion && (
                <div className="flex items-center gap-2 text-sm">
                  <AlertCircle className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-400">Resuelto</span>
                  <span className="text-white ml-auto text-xs">
                    {format(
                      new Date(ticket.fechaResolucion),
                      "dd/MM/yyyy HH:mm",
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Acciones - solo técnicos y admins */}
          {isTecnicoOrAdmin && (
            <>
              {/* Cambiar estado */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
                <h3 className="text-white font-medium text-sm">
                  Cambiar estado
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {[1, 2, 3, 4].map((estado) => (
                    <button
                      key={estado}
                      onClick={() => cambiarEstado(estado)}
                      disabled={actualizando || ticket.estado === estado}
                      className={`text-xs py-2 px-3 rounded-lg transition font-medium disabled:opacity-40 ${
                        ticket.estado === estado
                          ? ESTADO_COLORS[estado]
                          : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
                      }`}
                    >
                      {ESTADO_LABELS[estado]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Asignar técnico */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-gray-500" />
                  <h3 className="text-white font-medium text-sm">
                    Asignar técnico
                  </h3>
                </div>
                <select
                  value={ticket.tecnicoAsignadoId ?? ""}
                  onChange={(e) =>
                    e.target.value && asignarTecnico(e.target.value)
                  }
                  disabled={actualizando}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm"
                >
                  <option value="">Sin asignar</option>
                  {tecnicos.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
