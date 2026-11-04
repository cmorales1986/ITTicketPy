import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Vincula/desvincula el número de WhatsApp de wuzapi desde el panel, sin
// exponer WUZAPI_TOKEN al navegador: todo pasa por acá, solo para admins.

async function requireAdmin() {
  const { session, error } = await requireSession();
  if (error) return { error };
  if (session.rol < 2) {
    return { error: NextResponse.json({ message: 'No autorizado' }, { status: 403 }) };
  }
  return { error: null };
}

function wuzapiConfig() {
  const url = process.env.WUZAPI_URL;
  const token = process.env.WUZAPI_TOKEN;
  if (!url || !token) return null;
  return { base: url.replace(/\/$/, ''), token };
}

async function wuzapi(path: string, method: 'GET' | 'POST', body?: unknown) {
  const cfg = wuzapiConfig()!;
  const res = await fetch(`${cfg.base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Token: cfg.token },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const json = await res.json().catch(() => null);
  return { ok: res.ok, json };
}

// Estado de la sesión y, si hay que escanear, el QR actual.
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;
  if (!wuzapiConfig()) {
    return NextResponse.json({ message: 'WUZAPI_URL / WUZAPI_TOKEN no configurados' }, { status: 500 });
  }

  try {
    const status = await wuzapi('/session/status', 'GET');
    const data = status.json?.data ?? {};
    const connected = !!data.connected;
    const loggedIn = !!data.loggedIn;

    let qr: string | null = null;
    if (connected && !loggedIn) {
      const qrRes = await wuzapi('/session/qr', 'GET');
      qr = qrRes.json?.data?.QRCode || null;
    }

    return NextResponse.json({ connected, loggedIn, jid: data.jid || null, qr });
  } catch (err) {
    console.error('Error consultando sesión de wuzapi:', err);
    return NextResponse.json({ message: 'No se pudo contactar a wuzapi' }, { status: 502 });
  }
}

// Inicia la conexión (genera el QR). Mantiene la suscripción a "Message",
// la única que usa el webhook de tickets.
export async function POST() {
  const { error } = await requireAdmin();
  if (error) return error;
  if (!wuzapiConfig()) {
    return NextResponse.json({ message: 'WUZAPI_URL / WUZAPI_TOKEN no configurados' }, { status: 500 });
  }

  try {
    const { ok, json } = await wuzapi('/session/connect', 'POST', {
      Subscribe: ['Message'],
      Immediate: true,
    });
    return NextResponse.json({ ok, message: json?.error || null }, { status: ok ? 200 : 502 });
  } catch (err) {
    console.error('Error conectando sesión de wuzapi:', err);
    return NextResponse.json({ message: 'No se pudo contactar a wuzapi' }, { status: 502 });
  }
}

// Cierra la sesión (para forzar un QR nuevo si quedó trabada).
export async function DELETE() {
  const { error } = await requireAdmin();
  if (error) return error;
  if (!wuzapiConfig()) {
    return NextResponse.json({ message: 'WUZAPI_URL / WUZAPI_TOKEN no configurados' }, { status: 500 });
  }

  try {
    const { ok } = await wuzapi('/session/logout', 'POST');
    return NextResponse.json({ ok }, { status: ok ? 200 : 502 });
  } catch (err) {
    console.error('Error cerrando sesión de wuzapi:', err);
    return NextResponse.json({ message: 'No se pudo contactar a wuzapi' }, { status: 502 });
  }
}
