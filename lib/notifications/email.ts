import sgMail from '@sendgrid/mail';

export interface EmailTicketData {
  numero: string;
  titulo: string;
  descripcion: string;
  prioridad: string;
  estado: string;
  reportadoPor: string;
  urlTicket: string;
}

const fromEmail = process.env.SENDGRID_FROM ?? 'noreply@itticketpy.com';

let configured = false;
function ensureConfigured() {
  if (configured) return;
  const apiKey = process.env.SENDGRID_API_KEY;
  if (apiKey) sgMail.setApiKey(apiKey);
  configured = true;
}

async function enviar(msg: { to: string; subject: string; html: string }) {
  ensureConfigured();
  try {
    await sgMail.send({ from: fromEmail, to: msg.to, subject: msg.subject, html: msg.html });
    console.log(`Email enviado a ${msg.to}: ${msg.subject}`);
  } catch (error) {
    console.error(`Error enviando email a ${msg.to}:`, error);
  }
}

export async function enviarTicketCreado(destinatario: string, data: EmailTicketData) {
  await enviar({
    to: destinatario,
    subject: `[${data.numero}] Nuevo ticket: ${data.titulo}`,
    html: templateTicketCreado(data),
  });
}

export async function enviarTicketAsignado(
  destinatario: string,
  data: EmailTicketData,
  tecnico: string,
) {
  await enviar({
    to: destinatario,
    subject: `[${data.numero}] Ticket asignado a ${tecnico}`,
    html: templateTicketAsignado(data, tecnico),
  });
}

export async function enviarCambioEstado(
  destinatario: string,
  data: EmailTicketData,
  estadoAnterior: string,
) {
  await enviar({
    to: destinatario,
    subject: `[${data.numero}] Estado actualizado: ${data.estado}`,
    html: templateCambioEstado(data, estadoAnterior),
  });
}

export async function enviarNuevoComentario(
  destinatario: string,
  data: EmailTicketData,
  comentario: string,
  autor: string,
) {
  await enviar({
    to: destinatario,
    subject: `[${data.numero}] Nuevo comentario de ${autor}`,
    html: templateNuevoComentario(data, comentario, autor),
  });
}

function baseTemplate(contenido: string, titulo: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

              <!-- Header -->
              <tr>
                <td style="background-color:#1e293b;padding:24px 32px;border-radius:12px 12px 0 0;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td>
                        <div style="display:inline-block;background-color:#2563eb;color:#fff;font-weight:bold;font-size:14px;padding:8px 12px;border-radius:8px;">IT</div>
                        <span style="color:#ffffff;font-weight:600;font-size:16px;margin-left:12px;">ITTicketPy</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Contenido -->
              <tr>
                <td style="background-color:#ffffff;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none;">
                  <h2 style="color:#0f172a;font-size:20px;margin:0 0 24px 0;">${titulo}</h2>
                  ${contenido}
                  <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
                  <p style="color:#94a3b8;font-size:12px;margin:0;">
                    Este es un mensaje automático del sistema ITTicketPy. Por favor no respondas este email.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

function infoTicket(data: EmailTicketData): string {
  const prioridadColor: Record<string, string> = {
    Baja: '#6b7280',
    Media: '#3b82f6',
    Alta: '#f97316',
    Crítica: '#ef4444',
  };
  const estadoColor: Record<string, string> = {
    Abierto: '#eab308',
    'En Progreso': '#3b82f6',
    Resuelto: '#22c55e',
    Cerrado: '#6b7280',
  };

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:0;margin-bottom:24px;">
      <tr>
        <td style="padding:16px 20px;">
          <table width="100%" cellpadding="4" cellspacing="0">
            <tr>
              <td style="color:#64748b;font-size:13px;width:140px;">Número</td>
              <td style="color:#0f172a;font-size:13px;font-weight:600;font-family:monospace;">${data.numero}</td>
            </tr>
            <tr>
              <td style="color:#64748b;font-size:13px;">Título</td>
              <td style="color:#0f172a;font-size:13px;font-weight:500;">${data.titulo}</td>
            </tr>
            <tr>
              <td style="color:#64748b;font-size:13px;">Prioridad</td>
              <td>
                <span style="background-color:${prioridadColor[data.prioridad] ?? '#6b7280'}20;color:${prioridadColor[data.prioridad] ?? '#6b7280'};font-size:12px;padding:2px 8px;border-radius:99px;font-weight:500;">
                  ${data.prioridad}
                </span>
              </td>
            </tr>
            <tr>
              <td style="color:#64748b;font-size:13px;">Estado</td>
              <td>
                <span style="background-color:${estadoColor[data.estado] ?? '#6b7280'}20;color:${estadoColor[data.estado] ?? '#6b7280'};font-size:12px;padding:2px 8px;border-radius:99px;font-weight:500;">
                  ${data.estado}
                </span>
              </td>
            </tr>
            <tr>
              <td style="color:#64748b;font-size:13px;">Reportado por</td>
              <td style="color:#0f172a;font-size:13px;">${data.reportadoPor}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <a href="${data.urlTicket}" style="display:inline-block;background-color:#2563eb;color:#ffffff;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:500;margin-bottom:24px;">
      Ver ticket →
    </a>
  `;
}

function templateTicketCreado(data: EmailTicketData): string {
  const contenido = `
    <p style="color:#475569;font-size:14px;margin:0 0 20px 0;">
      Se ha creado un nuevo ticket en el sistema. A continuación los detalles:
    </p>
    ${infoTicket(data)}
    <div style="background-color:#f8fafc;border-left:4px solid #2563eb;padding:16px;border-radius:0 8px 8px 0;margin-bottom:24px;">
      <p style="color:#64748b;font-size:12px;margin:0 0 4px 0;">Descripción</p>
      <p style="color:#0f172a;font-size:14px;margin:0;">${data.descripcion}</p>
    </div>
  `;
  return baseTemplate(contenido, '🎫 Nuevo ticket creado');
}

function templateTicketAsignado(data: EmailTicketData, tecnico: string): string {
  const contenido = `
    <p style="color:#475569;font-size:14px;margin:0 0 20px 0;">
      El ticket ha sido asignado a <strong style="color:#2563eb;">${tecnico}</strong> para su atención.
    </p>
    ${infoTicket(data)}
  `;
  return baseTemplate(contenido, '👤 Ticket asignado');
}

function templateCambioEstado(data: EmailTicketData, estadoAnterior: string): string {
  const contenido = `
    <p style="color:#475569;font-size:14px;margin:0 0 20px 0;">
      El estado del ticket ha sido actualizado.
    </p>
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
      <span style="background-color:#f1f5f9;color:#64748b;padding:6px 12px;border-radius:6px;font-size:13px;text-decoration:line-through;">
        ${estadoAnterior}
      </span>
      <span style="color:#94a3b8;">→</span>
      <span style="background-color:#2563eb20;color:#2563eb;padding:6px 12px;border-radius:6px;font-size:13px;font-weight:500;">
        ${data.estado}
      </span>
    </div>
    ${infoTicket(data)}
  `;
  return baseTemplate(contenido, '🔄 Estado actualizado');
}

function templateNuevoComentario(data: EmailTicketData, comentario: string, autor: string): string {
  const contenido = `
    <p style="color:#475569;font-size:14px;margin:0 0 20px 0;">
      <strong>${autor}</strong> ha agregado un comentario en tu ticket.
    </p>
    <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:24px;">
      <p style="color:#64748b;font-size:12px;margin:0 0 8px 0;">Comentario de ${autor}</p>
      <p style="color:#0f172a;font-size:14px;margin:0;">${comentario}</p>
    </div>
    ${infoTicket(data)}
  `;
  return baseTemplate(contenido, '💬 Nuevo comentario');
}
