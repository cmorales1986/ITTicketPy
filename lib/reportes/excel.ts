// Exportación del listado de tickets a Excel (PR-INF-03). Mantiene las 6
// columnas del FL-INF-01 (hoy sin efecto, pero era el registro conocido) y
// suma el N.º de ticket y datos de apoyo para la auditoría. El ticket es el
// registro; el Excel es solo un listado, pensado como copia independiente de
// la base de datos.

import ExcelJS from 'exceljs';
import { aFechaExcel } from '@/lib/tickets/horario';

export interface TicketExportable {
  numero: string;
  fechaCreacion: Date | string;
  fechaRecepcion: Date | string | null;
  fechaCierre: Date | string | null;
  usuario?: { nombre: string } | null;
  tecnicoAsignado?: { nombre: string } | null;
  titulo: string;
  descripcion: string;
  estado: number;
  tipo: number;
  canal: string | null;
  lugarOrigen: string | null;
  prioridad: number;
  sistemaModulo: string | null;
  solucion: string | null;
  motivoCancelacion: string | null;
  motivoDesvio: string | null;
  cerradoSinRespuesta: boolean;
  reaperturas: number;
  dependeProveedor: boolean;
  proveedorNombre: string | null;
  conformidadFecha: Date | string | null;
  conformidadCanal: string | null;
  conformidadNota: string | null;
  analisisCausa: string | null;
  reincidente: boolean;
  produccionFecha: string | null;
}

const ESTADOS: Record<number, string> = { 1: 'Nuevo', 2: 'En Proceso', 3: 'Resuelto', 4: 'Cerrado', 5: 'Cancelado' };
const PRIORIDADES: Record<number, string> = { 1: 'Baja', 2: 'Media', 3: 'Alta', 4: 'Crítica' };
const TIPOS: Record<number, string> = {
  1: 'Incidente',
  2: 'Solicitud de desarrollo',
  3: 'Mejora',
  4: 'Soporte',
  5: 'Solicitud de usuario',
};
const CANALES: Record<string, string> = {
  WHATSAPP: 'WhatsApp',
  WHATSAPP_PERSONAL: 'WhatsApp personal',
  WHATSAPP_TECNICO: 'WhatsApp técnico',
  CORREO: 'Correo electrónico',
  LLAMADA: 'Llamada',
  PORTAL: 'Portal',
};
const LUGARES: Record<string, string> = { OFICINA: 'Oficina', GRANJA: 'Granja' };

// Observaciones: la solución o el motivo de cancelación, más lo que un
// auditor querría ver de un vistazo.
export function observaciones(t: TicketExportable): string {
  const partes: string[] = [];
  if (t.estado === 5 && t.motivoCancelacion) partes.push(`Motivo de cancelación: ${t.motivoCancelacion}`);
  if (t.solucion) partes.push(`Solución: ${t.solucion}`);
  if (t.cerradoSinRespuesta) partes.push('Cerrado automáticamente sin respuesta del usuario');
  if (t.reaperturas > 0) partes.push(`Reabierto ${t.reaperturas} ${t.reaperturas === 1 ? 'vez' : 'veces'}`);
  if (t.motivoDesvio) partes.push(`Motivo del desvío: ${t.motivoDesvio}`);
  if (t.dependeProveedor) partes.push(`Proveedor: ${t.proveedorNombre ?? 'sin indicar'}`);
  if (t.analisisCausa) partes.push(`Causa: ${t.analisisCausa}`);
  if (t.reincidente) partes.push('Reincidente');
  if (t.produccionFecha) partes.push(`Puesta en producción: ${String(t.produccionFecha).slice(0, 10)}`);
  return partes.join(' | ');
}

function conformidad(t: TicketExportable): string {
  if (!t.conformidadFecha) return '';
  const canal = t.conformidadCanal ? (CANALES[t.conformidadCanal] ?? t.conformidadCanal) : '';
  const fecha = new Intl.DateTimeFormat('es-PY', {
    timeZone: 'America/Asuncion',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(t.conformidadFecha));
  return `${fecha}${canal ? ` por ${canal}` : ''}${t.conformidadNota ? ` — ${t.conformidadNota}` : ''}`;
}

// FL-INF-01_2026-11.xlsx si el rango es un mes calendario completo;
// FL-INF-01_2026-11-02_a_2026-11-08.xlsx en cualquier otro caso (p. ej. una semana).
export function nombreArchivoExportacion(desde: string, hasta: string): string {
  const [a, m] = desde.split('-').map(Number);
  const ultimoDia = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const esMesCompleto = desde === `${desde.slice(0, 7)}-01` && hasta === `${desde.slice(0, 7)}-${String(ultimoDia).padStart(2, '0')}`;
  return esMesCompleto ? `FL-INF-01_${desde.slice(0, 7)}.xlsx` : `FL-INF-01_${desde}_a_${hasta}.xlsx`;
}

export async function construirExcel(opciones: {
  desde: string;
  hasta: string;
  tickets: TicketExportable[];
  generadoPor: string;
  generadoEn: Date;
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ITTicketPy';
  const ws = wb.addWorksheet('Tickets');

  const columnas = [
    { header: 'N.º Ticket', width: 12 },
    { header: 'Fecha de la Solicitud', width: 20 },
    { header: 'Usuario', width: 24 },
    { header: 'Descripción', width: 60 },
    { header: 'Estado', width: 13 },
    { header: 'Fecha de Cierre', width: 20 },
    { header: 'Observaciones', width: 60 },
    { header: 'Tipo', width: 22 },
    { header: 'Prioridad', width: 11 },
    { header: 'Canal', width: 18 },
    { header: 'Lugar de origen', width: 15 },
    { header: 'Sistema o servicio afectado', width: 24 },
    { header: 'Atendido por', width: 22 },
    { header: 'Conformidad del usuario', width: 36 },
  ];

  ws.mergeCells(1, 1, 1, columnas.length);
  ws.getCell(1, 1).value = `Listado de tickets — ${opciones.desde} al ${opciones.hasta}`;
  ws.getCell(1, 1).font = { bold: true, size: 14 };
  ws.mergeCells(2, 1, 2, columnas.length);
  ws.getCell(2, 1).value =
    `Generado por ${opciones.generadoPor} el ${opciones.generadoEn.toLocaleString('es-PY', { timeZone: 'America/Asuncion' })}. ` +
    'Incluye los tickets recibidos en el período y los cerrados o cancelados en él. ' +
    'La fecha de la solicitud es la de recepción del reporte.';
  ws.getCell(2, 1).font = { italic: true, color: { argb: 'FF6B7280' } };

  const FILA_ENCABEZADO = 4;
  ws.getRow(FILA_ENCABEZADO).values = columnas.map((c) => c.header);
  ws.getRow(FILA_ENCABEZADO).eachCell((celda) => {
    celda.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
    celda.alignment = { vertical: 'middle', wrapText: true };
  });
  columnas.forEach((c, i) => (ws.getColumn(i + 1).width = c.width));

  for (const t of opciones.tickets) {
    const fila = ws.addRow([
      t.numero,
      aFechaExcel(new Date(t.fechaRecepcion ?? t.fechaCreacion)),
      t.usuario?.nombre ?? '',
      t.titulo === t.descripcion ? t.titulo : `${t.titulo} — ${t.descripcion}`,
      ESTADOS[t.estado] ?? String(t.estado),
      t.fechaCierre ? aFechaExcel(new Date(t.fechaCierre)) : '',
      observaciones(t),
      TIPOS[t.tipo] ?? '',
      PRIORIDADES[t.prioridad] ?? '',
      t.canal ? (CANALES[t.canal] ?? t.canal) : 'Sin registrar',
      t.lugarOrigen ? (LUGARES[t.lugarOrigen] ?? t.lugarOrigen) : 'Sin registrar',
      t.sistemaModulo ?? '',
      t.tecnicoAsignado?.nombre ?? '',
      conformidad(t),
    ]);
    fila.getCell(2).numFmt = 'dd/mm/yyyy hh:mm';
    fila.getCell(6).numFmt = 'dd/mm/yyyy hh:mm';
    fila.alignment = { vertical: 'top', wrapText: true };
  }

  ws.views = [{ state: 'frozen', ySplit: FILA_ENCABEZADO }];
  ws.autoFilter = {
    from: { row: FILA_ENCABEZADO, column: 1 },
    to: { row: FILA_ENCABEZADO, column: columnas.length },
  };

  return Buffer.from(await wb.xlsx.writeBuffer());
}
