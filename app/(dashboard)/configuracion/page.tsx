/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Settings, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { useAuthStore } from '@/store/auth.store';
import { PRIORIDAD_LABELS } from '@/types';

interface Horario {
  dias: number[];
  desde: string;
  hasta: string;
}
interface Cantidad {
  valor: number;
  unidad: 'h' | 'd';
}
interface Plazo {
  primera: Cantidad;
  resolucion: Cantidad;
}
interface Cierre {
  diasCierre: number;
  diasReapertura: number;
}
interface Feriado {
  fecha: string;
  nombre: string;
}

const DIAS = [
  { v: 1, l: 'Lun' },
  { v: 2, l: 'Mar' },
  { v: 3, l: 'Mié' },
  { v: 4, l: 'Jue' },
  { v: 5, l: 'Vie' },
  { v: 6, l: 'Sáb' },
  { v: 0, l: 'Dom' },
];

const input =
  'bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm';

function jornadaHoras(h: Horario): number {
  const [h1, m1] = h.desde.split(':').map(Number);
  const [h2, m2] = h.hasta.split(':').map(Number);
  return (h2 * 60 + m2 - (h1 * 60 + m1)) / 60;
}

function EditorHorario({
  titulo,
  horario,
  onChange,
}: {
  titulo: string;
  horario: Horario;
  onChange: (h: Horario) => void;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-gray-300 text-sm font-medium">{titulo}</h3>
      <div className="flex flex-wrap gap-2">
        {DIAS.map((d) => {
          const activo = horario.dias.includes(d.v);
          return (
            <button
              key={d.v}
              onClick={() =>
                onChange({
                  ...horario,
                  dias: activo ? horario.dias.filter((x) => x !== d.v) : [...horario.dias, d.v],
                })
              }
              className={`px-3 py-1.5 rounded-lg text-sm transition ${
                activo ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {d.l}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-3 text-sm text-gray-400">
        <span>De</span>
        <input type="time" value={horario.desde} onChange={(e) => onChange({ ...horario, desde: e.target.value })} className={input} />
        <span>a</span>
        <input type="time" value={horario.hasta} onChange={(e) => onChange({ ...horario, hasta: e.target.value })} className={input} />
        <span className="text-gray-500">({jornadaHoras(horario)} h por día hábil)</span>
      </div>
    </div>
  );
}

function EditorCantidad({ valor, onChange }: { valor: Cantidad; onChange: (c: Cantidad) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={0.25}
        step={0.25}
        value={valor.valor}
        onChange={(e) => onChange({ ...valor, valor: Number(e.target.value) })}
        className={`${input} w-24`}
      />
      <select
        value={valor.unidad}
        onChange={(e) => onChange({ ...valor, unidad: e.target.value as 'h' | 'd' })}
        className={input}
      >
        <option value="h">horas</option>
        <option value="d">días hábiles</option>
      </select>
    </div>
  );
}

export default function ConfiguracionPage() {
  const router = useRouter();
  const { usuario } = useAuthStore();
  const [horario, setHorario] = useState<Horario | null>(null);
  const [horarioGranja, setHorarioGranja] = useState<Horario | null>(null);
  const [plazos, setPlazos] = useState<Record<number, Plazo>>({});
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [cierre, setCierre] = useState<Cierre>({ diasCierre: 3, diasReapertura: 5 });
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [nuevaFecha, setNuevaFecha] = useState('');
  const [nuevoNombre, setNuevoNombre] = useState('');

  const cargar = async () => {
    try {
      const res = await api.get('/configuracion');
      setHorario(res.data.horario);
      setHorarioGranja(res.data.horarioGranja);
      setPlazos(res.data.plazos);
      setFeriados(res.data.feriados);
      setCierre(res.data.cierre);
    } catch {
      toast.error('Error al cargar la configuración');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (usuario?.rol !== 2 && usuario?.rol !== 3) {
      router.push('/dashboard');
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, []);

  if (loading || !horario || !horarioGranja) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const guardar = async () => {
    setGuardando(true);
    try {
      await api.put('/configuracion', { horario, horarioGranja, plazos, cierre });
      toast.success('Configuración guardada');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  };

  const agregarFeriado = async () => {
    if (!nuevaFecha || !nuevoNombre.trim()) return;
    try {
      await api.post('/configuracion/feriados', { fecha: nuevaFecha, nombre: nuevoNombre.trim() });
      setNuevaFecha('');
      setNuevoNombre('');
      await cargar();
    } catch {
      toast.error('No se pudo agregar el feriado');
    }
  };

  const quitarFeriado = async (fecha: string) => {
    if (!confirm(`¿Quitar el feriado del ${fecha}?`)) return;
    try {
      await api.delete(`/configuracion/feriados?fecha=${fecha}`);
      await cargar();
    } catch {
      toast.error('No se pudo quitar el feriado');
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
          <Settings className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Configuración</h1>
          <p className="text-gray-400 text-sm">Horarios, plazos y feriados con los que se miden los tickets</p>
        </div>
      </div>

      {/* Horarios */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-5">
        <div>
          <h2 className="text-white font-medium">Horario laboral</h2>
          <p className="text-gray-500 text-xs mt-1">
            Los plazos de cada ticket se cuentan con el horario de su lugar de origen. Un ticket sin lugar
            registrado se mide como oficina.
          </p>
        </div>
        <EditorHorario titulo="Oficina (Asunción)" horario={horario} onChange={setHorario} />
        <EditorHorario titulo="Granja" horario={horarioGranja} onChange={setHorarioGranja} />
      </div>

      {/* Plazos */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-white font-medium">Plazos objetivo</h2>
          <p className="text-gray-500 text-xs mt-1">
            Contados desde la recepción del reporte. Un día hábil es una jornada completa del horario del
            lugar de origen ({jornadaHoras(horario)} h en la oficina, {jornadaHoras(horarioGranja)} h en la
            granja). La resolución no aplica a desarrollo ni mejora: su plazo se define en la evaluación.
          </p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 text-xs text-left">
              <th className="pb-2 font-medium">Prioridad</th>
              <th className="pb-2 font-medium">Primera respuesta</th>
              <th className="pb-2 font-medium">Resolución</th>
            </tr>
          </thead>
          <tbody>
            {[4, 3, 2, 1].map((p) => (
              <tr key={p} className="border-t border-gray-800">
                <td className="py-2 text-gray-300">{PRIORIDAD_LABELS[p]}</td>
                {(['primera', 'resolucion'] as const).map((campo) => (
                  <td key={campo} className="py-2">
                    {plazos[p] && (
                      <EditorCantidad
                        valor={plazos[p][campo]}
                        onChange={(c) => setPlazos({ ...plazos, [p]: { ...plazos[p], [campo]: c } })}
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cierre y reapertura */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-white font-medium">Cierre y reapertura</h2>
          <p className="text-gray-500 text-xs mt-1">En días hábiles.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <label className="space-y-1 block">
            <span className="text-gray-400">Cierre automático sin respuesta del usuario</span>
            <input
              type="number"
              min={1}
              value={cierre.diasCierre}
              onChange={(e) => setCierre({ ...cierre, diasCierre: Math.max(1, Math.round(Number(e.target.value))) })}
              className={`${input} w-28 block`}
            />
            <span className="text-gray-600 text-xs">Un ticket Resuelto se cierra solo pasado este plazo</span>
          </label>
          <label className="space-y-1 block">
            <span className="text-gray-400">Plazo para reabrir el mismo ticket</span>
            <input
              type="number"
              min={1}
              value={cierre.diasReapertura}
              onChange={(e) => setCierre({ ...cierre, diasReapertura: Math.max(1, Math.round(Number(e.target.value))) })}
              className={`${input} w-28 block`}
            />
            <span className="text-gray-600 text-xs">Después hay que crear un ticket nuevo vinculado</span>
          </label>
        </div>
      </div>

      <button
        onClick={guardar}
        disabled={guardando}
        className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2"
      >
        {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
        Guardar horarios, plazos y cierre
      </button>

      {/* Feriados */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-white font-medium">Feriados</h2>
          <p className="text-gray-500 text-xs mt-1">
            Una sola lista para ambos horarios. No cuentan como horas hábiles. Agregá los que decrete el
            Poder Ejecutivo y los de los años siguientes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input type="date" value={nuevaFecha} onChange={(e) => setNuevaFecha(e.target.value)} className={input} />
          <input
            value={nuevoNombre}
            onChange={(e) => setNuevoNombre(e.target.value)}
            placeholder="Nombre del feriado"
            className={`${input} flex-1 min-w-48`}
          />
          <button onClick={agregarFeriado} className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm">
            Agregar
          </button>
        </div>
        <ul className="divide-y divide-gray-800">
          {feriados.map((f) => (
            <li key={f.fecha} className="py-2 flex items-center justify-between text-sm">
              <span className="text-gray-300">
                <span className="font-mono text-gray-500 mr-3">{f.fecha}</span>
                {f.nombre}
              </span>
              <button onClick={() => quitarFeriado(f.fecha)} className="text-gray-500 hover:text-red-400">
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
          {feriados.length === 0 && <li className="py-2 text-gray-500 text-sm">Sin feriados cargados</li>}
        </ul>
      </div>
    </div>
  );
}
