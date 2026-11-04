/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @next/next/no-img-element */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, MessageCircle, RefreshCw, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { useAuthStore } from '@/store/auth.store';

interface EstadoSesion {
  connected: boolean;
  loggedIn: boolean;
  jid: string | null;
  qr: string | null;
}

export default function WhatsappPage() {
  const router = useRouter();
  const { usuario } = useAuthStore();
  const [estado, setEstado] = useState<EstadoSesion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [accion, setAccion] = useState(false);

  const cargarEstado = useCallback(async () => {
    try {
      const res = await api.get<EstadoSesion>('/whatsapp/session');
      setEstado(res.data);
    } catch {
      toast.error('No se pudo consultar el estado de WhatsApp');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (usuario?.rol !== 2 && usuario?.rol !== 3) {
      router.push('/dashboard');
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarEstado();
  }, []);

  // Mientras no esté logueado refrescamos seguido: el QR vence en ~1 minuto
  // y hay que detectar cuándo el celular lo escaneó.
  useEffect(() => {
    if (estado?.loggedIn) return;
    const id = setInterval(cargarEstado, 4000);
    return () => clearInterval(id);
  }, [estado?.loggedIn, cargarEstado]);

  const conectar = async () => {
    setAccion(true);
    try {
      await api.post('/whatsapp/session');
      await cargarEstado();
    } catch {
      toast.error('No se pudo iniciar la conexión');
    } finally {
      setAccion(false);
    }
  };

  const desconectar = async () => {
    if (!confirm('¿Cerrar la sesión de WhatsApp? Vas a tener que escanear el QR de nuevo.')) return;
    setAccion(true);
    try {
      await api.delete('/whatsapp/session');
      toast.success('Sesión cerrada');
      await cargarEstado();
    } catch {
      toast.error('No se pudo cerrar la sesión');
    } finally {
      setAccion(false);
    }
  };

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
          <MessageCircle className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">WhatsApp</h1>
          <p className="text-sm text-gray-500">Número que recibe y responde los tickets</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {cargando ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : estado?.loggedIn ? (
          <div className="text-center py-4">
            <p className="text-green-600 font-semibold mb-1">Conectado</p>
            <p className="text-sm text-gray-500 mb-6">
              {estado.jid ? `+${estado.jid.split('@')[0].split(':')[0]}` : 'Sesión activa'}
            </p>
            <button
              onClick={desconectar}
              disabled={accion}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
            >
              <LogOut className="w-4 h-4" />
              Cerrar sesión
            </button>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-amber-600 font-semibold mb-1">Desconectado</p>
            <p className="text-sm text-gray-500 mb-4">
              En el celular: WhatsApp → Dispositivos vinculados → Vincular un dispositivo, y escaneá el QR.
            </p>

            {estado?.qr ? (
              <img src={estado.qr} alt="QR de WhatsApp" className="mx-auto w-64 h-64 mb-4" />
            ) : (
              <div className="mx-auto w-64 h-64 mb-4 flex items-center justify-center border border-dashed border-gray-300 rounded-lg text-sm text-gray-400">
                {estado?.connected ? 'Generando QR…' : 'Tocá "Generar QR"'}
              </div>
            )}

            <div className="flex justify-center gap-2">
              <button
                onClick={conectar}
                disabled={accion}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {accion ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Generar QR
              </button>
              {estado?.connected && (
                <button
                  onClick={desconectar}
                  disabled={accion}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Reiniciar sesión
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
