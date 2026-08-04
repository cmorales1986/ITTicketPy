import { Star } from 'lucide-react';

interface Props {
  calificacion?: number | null;
  size?: 'sm' | 'md';
}

// Estrellitas de satisfacción que el cliente respondió por WhatsApp al
// cerrarse el ticket (1 a 5). Si todavía no calificó (ticket abierto, o
// cerrado pero sin responder la encuesta), no se muestra nada.
export default function Estrellas({ calificacion, size = 'sm' }: Props) {
  if (!calificacion) return null;

  const px = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const color =
    calificacion >= 4 ? 'text-green-400' : calificacion === 3 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="flex items-center gap-0.5" title={`Calificación del cliente: ${calificacion}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${px} ${i <= calificacion ? `${color} fill-current` : 'text-gray-700'}`}
        />
      ))}
    </div>
  );
}
