/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { Historial } from '@/types';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Plus, ArrowRight, UserCheck,
  MessageSquare, AlertCircle, Clock
} from 'lucide-react';

const TIPO_CONFIG: Record<string, {
  icon: any;
  color: string;
  bgColor: string;
}> = {
  CREACION: {
    icon: Plus,
    color: 'text-green-400',
    bgColor: 'bg-green-500/20 border-green-500/30',
  },
  ESTADO: {
    icon: ArrowRight,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20 border-blue-500/30',
  },
  ASIGNACION: {
    icon: UserCheck,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20 border-purple-500/30',
  },
  COMENTARIO: {
    icon: MessageSquare,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20 border-yellow-500/30',
  },
  PRIORIDAD: {
    icon: AlertCircle,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20 border-orange-500/30',
  },
};

interface Props {
  historiales: Historial[];
}

export default function Timeline({ historiales }: Props) {
  if (!historiales || historiales.length === 0) {
    return (
      <div className="text-center py-8 text-gray-600 text-sm">
        <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
        Sin actividad registrada
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Línea vertical */}
      <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-800" />

      <div className="space-y-4">
        {historiales.map((item) => {
          const config = TIPO_CONFIG[item.tipo] ?? TIPO_CONFIG['CREACION'];
          const Icon = config.icon;

          return (
            <div key={item.id} className="relative flex gap-4 pl-2">

              {/* Ícono */}
              <div className={`relative z-10 w-6 h-6 rounded-full border flex items-center justify-center shrink-0 ${config.bgColor}`}>
                <Icon className={`w-3 h-3 ${config.color}`} />
              </div>

              {/* Contenido */}
              <div className="flex-1 pb-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-white text-sm">{item.descripcion}</p>

                    {/* Valor anterior → nuevo */}
                    {item.valorAnterior && item.valorNuevo && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded line-through">
                          {item.valorAnterior}
                        </span>
                        <ArrowRight className="w-3 h-3 text-gray-600" />
                        <span className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded">
                          {item.valorNuevo}
                        </span>
                      </div>
                    )}

                    {/* Usuario */}
                    {item.usuario && (
                      <p className="text-gray-500 text-xs mt-1">
                        por <span className="text-gray-400">{item.usuario.nombre}</span>
                      </p>
                    )}
                  </div>

                  {/* Fecha */}
                  <div className="text-right shrink-0">
                    <p className="text-gray-600 text-xs">
                      {formatDistanceToNow(new Date(item.fechaCreacion), {
                        addSuffix: true,
                        locale: es,
                      })}
                    </p>
                    <p className="text-gray-700 text-xs">
                      {format(new Date(item.fechaCreacion), 'dd/MM HH:mm')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}