import { NextRequest, NextResponse } from 'next/server';
import { findTicketById } from '@/lib/tickets/service';

// Sin autenticación a propósito — es el link que recibe el cliente por
// WhatsApp para hacer seguimiento de su ticket. Se accede por el id (UUID
// aleatorio) del ticket, no por el número secuencial, para que no sea
// adivinable. Solo se exponen los campos necesarios para mostrar el estado:
// nada de emails, ni comentarios internos, ni otros datos sensibles.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ticket = await findTicketById(id);
  if (!ticket) {
    return NextResponse.json({ message: 'Ticket no encontrado' }, { status: 404 });
  }

  return NextResponse.json({
    numero: ticket.numero,
    titulo: ticket.titulo,
    descripcion: ticket.descripcion,
    prioridad: ticket.prioridad,
    estado: ticket.estado,
    fechaCreacion: ticket.fechaCreacion,
    fechaResolucion: ticket.fechaResolucion,
    reportadoPor: ticket.usuario?.nombre ?? null,
    tecnicoAsignado: ticket.tecnicoAsignado?.nombre ?? null,
    categoria: ticket.categoria?.nombre ?? null,
    empresa: ticket.empresa?.nombre ?? null,
    calificacion: ticket.calificacion,
    comentarios: (ticket.comentarios ?? [])
      .filter((c) => !c.interno)
      .map((c) => ({
        autor: c.usuario?.nombre ?? 'Usuario',
        contenido: c.contenido,
        fechaCreacion: c.fechaCreacion,
      })),
  });
}
