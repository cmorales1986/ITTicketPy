export type EstadoPlazo =
  | 'en_plazo'
  | 'por_vencer'
  | 'vencido'
  | 'cumplido'
  | 'cumplido_tarde'
  | 'sin_dato'
  | 'no_aplica';

export interface Medicion {
  estado: EstadoPlazo;
  limite: string | null;
  usadosMin: number | null;
  plazoMin: number | null;
}

export interface Sla {
  respuesta: Medicion;
  resolucion: Medicion;
  resumen: EstadoPlazo;
}

export interface Empresa {
  id: string;
  nombre: string;
  activa: boolean;
}

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: number; // 0=Usuario, 1=Técnico, 2=Admin
  numeroWhatsApp?: string;
  empresaId?: string;
  empresa?: Empresa;
  activo: boolean;
}

export interface Historial {
  id: string;
  ticketId: string;
  usuarioId: string;
  usuario?: Usuario;
  tipo: string; // CREACION, ESTADO, ASIGNACION, COMENTARIO, PRIORIDAD
  valorAnterior?: string;
  valorNuevo?: string;
  descripcion: string;
  fechaCreacion: string;
}

export interface Categoria {
  id: string;
  nombre: string;
  descripcion?: string;
  activa: boolean;
}

export interface Adjunto {
  id: string;
  ticketId: string;
  nombreArchivo: string;
  rutaArchivo: string;
  tamanio: number;
  fechaCarga: string;
}

export interface Ticket {
  id: string;
  numero: string;
  titulo: string;
  descripcion: string;
  prioridad: number; // 1=Baja, 2=Media, 3=Alta, 4=Crítica
  estado: number;   // 1=Nuevo, 2=En Proceso, 3=Resuelto, 4=Cerrado, 5=Cancelado
  canal?: string | null; // WHATSAPP | CORREO | LLAMADA (null en históricos)
  tipo: number; // 1=Incidente/Soporte, 2=Solicitud de desarrollo, 3=Mejora
  sistemaModulo?: string | null;
  urgencia?: number | null;
  solucion?: string | null;
  motivoCancelacion?: string | null;
  dependeProveedor: boolean;
  proveedorNombre?: string | null;
  proveedorFechaCompromiso?: string | null;
  proveedorNotas?: string | null;
  fechaPrimeraRespuesta?: string | null;
  motivoDesvio?: string | null;
  fechaCierre?: string | null;
  lugarOrigen?: string | null; // OFICINA | GRANJA
  fechaRecepcion?: string | null;
  conformidadFecha?: string | null;
  conformidadCanal?: string | null;
  conformidadNota?: string | null;
  reaperturas: number;
  cerradoSinRespuesta: boolean;
  ticketAnteriorId?: string | null;
  ticketAnterior?: Ticket | null;
  continuaciones?: Ticket[];
  sla?: Sla;
  reapertura?: { permitida: boolean; limite: string | null } | null;
  usuarioId: string;
  usuario?: Usuario;
  tecnicoAsignadoId?: string;
  tecnicoAsignado?: Usuario;
  categoriaId?: string;
  categoria?: Categoria;
  empresaId?: string;
  empresa?: Empresa;
  fechaCreacion: string;
  fechaResolucion?: string;
  calificacion?: number;
  comentarioEncuesta?: string;
  comentarios?: Comentario[];
  historiales?: Historial[];
  adjuntos?: Adjunto[];
  mensajesChat?: MensajeChat[];
}

export interface Comentario {
  id: string;
  ticketId: string;
  usuarioId: string;
  usuario?: Usuario;
  contenido: string;
  interno: boolean;
  fechaCreacion: string;
}

export interface MensajeChat {
  id: string;
  ticketId: string;
  usuarioId: string;
  usuario?: Usuario;
  contenido: string;
  fechaCreacion: string;
}

export const PRIORIDAD_LABELS: Record<number, string> = {
  1: 'Baja',
  2: 'Media',
  3: 'Alta',
  4: 'Crítica',
};

// Paleta oscura consistente con el resto del panel (fondo tenue + texto de
// acento) — las clases bg-*-100/text-*-700 de antes eran para tema claro y
// se veían lavadas sobre el fondo oscuro.
export const PRIORIDAD_COLORS: Record<number, string> = {
  1: 'bg-gray-500/10 text-gray-400',
  2: 'bg-blue-500/10 text-blue-400',
  3: 'bg-orange-500/10 text-orange-400',
  4: 'bg-red-500/10 text-red-400',
};

export const ESTADO_LABELS: Record<number, string> = {
  1: 'Nuevo',
  2: 'En Proceso',
  3: 'Resuelto',
  4: 'Cerrado',
  5: 'Cancelado',
};

export const ESTADO_COLORS: Record<number, string> = {
  1: 'bg-yellow-500/10 text-yellow-400',
  2: 'bg-blue-500/10 text-blue-400',
  3: 'bg-green-500/10 text-green-400',
  4: 'bg-gray-500/10 text-gray-400',
  5: 'bg-red-500/10 text-red-400',
};
