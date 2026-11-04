// Reglas de negocio de P2 (desarrollo, mejora, causa, proveedor). Puras: no
// tocan la base de datos, para poder probarlas una por una.

import { ESTADO, esDesarrolloOMejora } from './estados';

export interface ReglaIncumplida {
  message: string;
  code?: string;
}

export interface TicketParaReglas {
  tipo: number;
  prioridad: number;
  reincidente: boolean;
  analisisCausa: string | null;
  dependeProveedor: boolean;
  proveedorEntregablesVerificados: boolean;
  conformidadFecha: Date | string | null;
  produccionFecha: string | null;
  evalConCosto: boolean;
  aprobaciones: { tipo: string }[];
}

export interface CambiosParaReglas {
  estado?: number;
  prioridad?: number;
  reincidente?: boolean;
  analisisCausa?: string; // ya recortado
  dependeProveedor?: boolean;
  proveedorEntregablesVerificados?: boolean;
  evalConCosto?: boolean;
  produccionFecha?: string; // ya recortado
  // Campos de evaluación / pruebas / producción que se quieren tocar.
  camposDesarrolloTocados: boolean;
}

export function validarReglasP2(
  ticket: TicketParaReglas,
  cambios: CambiosParaReglas,
  cambiaEstado: boolean,
): ReglaIncumplida | null {
  // Evaluación, pruebas y producción solo existen para desarrollo y mejora.
  if (cambios.camposDesarrolloTocados && !esDesarrolloOMejora(ticket.tipo)) {
    return {
      message:
        'La evaluación, las pruebas y la puesta en producción son solo para solicitudes de desarrollo y mejora',
    };
  }

  if (cambiaEstado && cambios.estado === ESTADO.RESUELTO) {
    // Crítico o reincidente: análisis de causa antes de resolver (y por lo
    // tanto antes de cerrar).
    const prioridad = cambios.prioridad ?? ticket.prioridad;
    const reincidente = cambios.reincidente ?? ticket.reincidente;
    const causa = cambios.analisisCausa !== undefined ? cambios.analisisCausa : (ticket.analisisCausa ?? '').trim();
    if ((prioridad === 4 || reincidente) && !causa) {
      return {
        message: `Un ticket ${prioridad === 4 ? 'Crítico' : 'reincidente'} necesita el análisis de causa antes de resolverse`,
        code: 'ANALISIS_CAUSA',
      };
    }
    // Depende de un proveedor: entregables verificados antes de resolver.
    const entregables = cambios.proveedorEntregablesVerificados ?? ticket.proveedorEntregablesVerificados;
    if ((cambios.dependeProveedor ?? ticket.dependeProveedor) && !entregables) {
      return {
        message: 'El ticket depende de un proveedor: verificá los entregables antes de resolverlo',
        code: 'ENTREGABLES',
      };
    }
  }

  const conformidadOk = !!ticket.conformidadFecha;

  // Desarrollo y mejora: sin conformidad del usuario no se cierra.
  if (
    cambiaEstado &&
    cambios.estado === ESTADO.CERRADO &&
    esDesarrolloOMejora(ticket.tipo) &&
    !conformidadOk
  ) {
    return {
      message: 'Sin la conformidad del usuario no se puede cerrar una solicitud de desarrollo o mejora',
      code: 'CONFORMIDAD',
    };
  }

  // Puesta en producción: una sola vez, con conformidad, aprobación del
  // Gerente de TI y, si hay costo, de Gerencia General.
  if (cambios.produccionFecha) {
    if (ticket.produccionFecha) {
      return { message: 'La puesta en producción ya está registrada y no se modifica' };
    }
    if (!conformidadOk) {
      return { message: 'Sin la conformidad del usuario no se puede pasar a producción', code: 'CONFORMIDAD' };
    }
    const aprobadas = new Set(ticket.aprobaciones.map((a) => a.tipo));
    if (!aprobadas.has('TI')) {
      return { message: 'Falta la aprobación del Gerente de TI para pasar a producción', code: 'APROBACION' };
    }
    if ((cambios.evalConCosto ?? ticket.evalConCosto) && !aprobadas.has('GG')) {
      return {
        message: 'La solicitud tiene costo: falta la aprobación de Gerencia General para pasar a producción',
        code: 'APROBACION',
      };
    }
  }

  return null;
}
