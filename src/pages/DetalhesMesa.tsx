import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { formatDuration } from '../utils/format';
import { ArrowLeft, Plus, CheckCircle2, XCircle, DollarSign, Clock, Pencil } from 'lucide-react';
import { clsx } from 'clsx';
import { useState, useEffect } from 'react';

export function DetalhesMesa() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const mesa = useLiveQuery(() => db.mesas.get(id!), [id]);
  const itens = useLiveQuery(() => 
    db.itens.where('mesaId').equals(id!).sortBy('criadoEm')
  , [id]);

  // Timer for duration
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  if (!mesa) return null;

  const toggleEntregue = (itemId: string, current: boolean) => {
    db.itens.update(itemId, { entregue: !current });
    if (navigator.vibrate) navigator.vibrate(20);
  };

  const toggleCancelado = (itemId: string, current?: boolean) => {
    if (confirm('Cancelar este item?')) {
        db.itens.update(itemId, { cancelado: !current });
    }
  };

  return (
    <div className="min-h-screen pb-32 bg-zinc-950 relative">
      {/* Header Sticky */}
      <header className="sticky top-0 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 z-10 p-4">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => navigate('/')} className="p-2 -ml-2 text-zinc-400">
            <ArrowLeft size={24} />
          </button>
          <div className="text-center">
            <h1 className="text-xl font-bold">Mesa {mesa.numero}</h1>
            <div className="flex items-center justify-center gap-1 text-xs text-zinc-400">
              <Clock size={12} />
              {formatDuration(mesa.abertaEm)}
            </div>
          </div>
          <div className="w-10" /> {/* Spacer */}
        </div>
      </header>

      {/* Items List */}
      <div className="p-4 grid grid-cols-2 gap-3">
        {itens?.map(item => (
          <div 
            key={item.id} 
            className={clsx(
              "p-3 rounded-xl border flex flex-col justify-between gap-2 min-h-[140px]",
              item.cancelado ? "bg-zinc-900/50 border-zinc-800 opacity-50" : "bg-zinc-900 border-zinc-800"
            )}
          >
            <div className="flex-1">
              <div className="font-bold leading-tight mb-1">
                <span className="text-xl mr-1.5">{item.quantidade}x</span>
                <span className={clsx("text-sm", item.cancelado && "line-through")}>
                  {item.descricao}
                </span>
              </div>
              {item.observacao && (
                <p className="text-xs text-zinc-400 italic leading-snug line-clamp-3">
                  "{item.observacao}"
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800/50 mt-auto">
              {!item.cancelado && (
                <>
                  <Link
                    to={`/mesa/${id}/pedido/${item.id}`}
                    className="p-1.5 rounded-full bg-zinc-800 text-zinc-400 hover:text-blue-400"
                  >
                    <Pencil size={18} />
                  </Link>
                  <button
                    onClick={() => toggleEntregue(item.id, item.entregue)}
                    className={clsx(
                      "p-1.5 rounded-full transition-colors",
                      item.entregue ? "bg-emerald-500/20 text-emerald-500" : "bg-zinc-800 text-zinc-600"
                    )}
                  >
                    <CheckCircle2 size={18} />
                  </button>
                </>
              )}
               <button
                  onClick={() => toggleCancelado(item.id, item.cancelado)}
                  className="p-1.5 rounded-full bg-zinc-800 text-red-900 hover:text-red-500"
                >
                  <XCircle size={18} />
                </button>
            </div>
          </div>
        ))}
        
        {itens?.length === 0 && (
          <div className="col-span-2 text-center py-12 text-zinc-600">
            <p>Nenhum pedido anotado</p>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-zinc-950 border-t border-zinc-900 flex gap-4">
        <Link 
          to={`/mesa/${id}/fechar`}
          className="flex-1 bg-zinc-800 text-zinc-300 font-bold py-4 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          <DollarSign size={20} />
          Fechar
        </Link>
        <Link 
          to={`/mesa/${id}/pedido`}
          className="flex-[2] bg-blue-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 active:scale-95 transition-transform"
        >
          <Plus size={20} />
          Adicionar Pedido
        </Link>
      </div>
    </div>
  );
}
