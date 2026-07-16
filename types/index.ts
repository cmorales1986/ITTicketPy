export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: number; // 0=Usuario, 1=Técnico, 2=Admin
  numeroWhatsApp?: string;
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

export interface Ticket {
  id: string;
  numero: string;
  titulo: string;
  descripcion: string;
  prioridad: number; // 1=Baja, 2=Media, 3=Alta, 4=Crítica
  estado: number;   // 1=Abierto, 2=En Progreso, 3=Resuelto, 4=Cerrado
  usuarioId: string;
  usuario?: Usuario;
  tecnicoAsignadoId?: string;
  tecnicoAsignado?: Usuario;
  categoriaId?: string;
  categoria?: Categoria;
  fechaCreacion: string;
  fechaResolucion?: string;
  comentarios?: Comentario[];
  historiales?: Historial[];
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

export const PRIORIDAD_LABELS: Record<number, string> = {
  1: 'Baja',
  2: 'Media',
  3: 'Alta',
  4: 'Crítica',
};

export const PRIORIDAD_COLORS: Record<number, string> = {
  1: 'bg-gray-100 text-gray-700',
  2: 'bg-blue-100 text-blue-700',
  3: 'bg-orange-100 text-orange-700',
  4: 'bg-red-100 text-red-700',
};

export const ESTADO_LABELS: Record<number, string> = {
  1: 'Abierto',
  2: 'En Progreso',
  3: 'Resuelto',
  4: 'Cerrado',
};

export const ESTADO_COLORS: Record<number, string> = {
  1: 'bg-yellow-100 text-yellow-700',
  2: 'bg-blue-100 text-blue-700',
  3: 'bg-green-100 text-green-700',
  4: 'bg-gray-100 text-gray-700',
};