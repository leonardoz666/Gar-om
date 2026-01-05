import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { formatDuration } from '../utils/format';
import { ArrowLeft, Plus, CheckCircle2, XCircle, DollarSign, Clock, Pencil, Share2, Copy } from 'lucide-react';
import { clsx } from 'clsx';
import { useState, useEffect } from 'react';

import { ConfirmationModal } from '../components/ConfirmationModal';

export function DetalhesMesa() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const mesa = useLiveQuery(() => db.mesas.get(id!), [id]);
  const itens = useLiveQuery(() => 
    db.itens.where('mesaId').equals(id!).sortBy('criadoEm')
  , [id]);

  // Modals state
  const [itemToToggleCancel, setItemToToggleCancel] = useState<{id: string, current: boolean} | null>(null);
  const [alertInfo, setAlertInfo] = useState<{title: string, message: string, type: 'success' | 'danger'} | null>(null);

  // Timer for duration
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  const handleShare = async () => {
    if (!mesa || !itens) return;

    const lines = [
      `*MESA ${mesa.numero}*`,
      `_Aberto há: ${formatDuration(mesa.abertaEm)}_`,
      '',
      ...itens.filter(i => !i.cancelado).map(item => {
        let line = `${item.quantidade}x ${item.descricao}`;
        if (item.observacao) line += `\n   _Obs: ${item.observacao}_`;
        return line;
      }),
      '',
      `*Total de Itens: ${itens.filter(i => !i.cancelado).reduce((acc, i) => acc + i.quantidade, 0)}*`
    ];

    const text = lines.join('\n');

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Pedido Mesa ${mesa.numero}`,
          text: text
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(text);
        setAlertInfo({
          title: 'Copiado!',
          message: 'Resumo copiado para a área de transferência.',
          type: 'success'
        });
      } catch (err) {
        setAlertInfo({
          title: 'Erro',
          message: 'Não foi possível copiar o resumo.',
          type: 'danger'
        });
      }
    }
  };

  if (!mesa) return null;

  const toggleEntregue = (itemId: string, current: boolean) => {
    db.itens.update(itemId, { entregue: !current });
    if (navigator.vibrate) navigator.vibrate(20);
  };

  const handleToggleCancel = () => {
    if (itemToToggleCancel) {
      db.itens.update(itemToToggleCancel.id, { cancelado: !itemToToggleCancel.current });
      setItemToToggleCancel(null);
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
          <button 
            onClick={handleShare}
            className="p-2 -mr-2 text-blue-400 hover:bg-blue-400/10 rounded-full transition-colors"
          >
            {navigator.share ? <Share2 size={24} /> : <Copy size={24} />}
          </button>
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
              <div className="flex justify-between items-start mb-1">
                <div className="font-bold leading-tight">
                  <span className="text-xl mr-1.5">{item.quantidade}x</span>
                  <span className={clsx("text-sm", item.cancelado && "line-through")}>
                    {item.descricao}
                  </span>
                </div>
                <div className={clsx(
                  "flex items-center text-[10px] font-medium bg-zinc-950/30 px-1.5 py-0.5 rounded ml-2 whitespace-nowrap",
                  item.cancelado ? "text-zinc-500" :
                  !item.lancado ? "text-amber-400 font-bold" :
                  !item.entregue ? "text-blue-400" : "text-emerald-500"
                )}>
                  <Clock size={10} className="mr-1" />
                  {formatDuration(item.criadoEm)}
                </div>
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
                  onClick={() => setItemToToggleCancel({ id: item.id, current: !!item.cancelado })}
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

      {/* Modals */}
      <ConfirmationModal
        isOpen={!!itemToToggleCancel}
        onClose={() => setItemToToggleCancel(null)}
        onConfirm={handleToggleCancel}
        title={itemToToggleCancel?.current ? "Reativar Item?" : "Cancelar Item?"}
        description={itemToToggleCancel?.current 
          ? "Deseja remover o status de cancelado deste item?" 
          : "Tem certeza que deseja cancelar este item? Ele continuará visível mas marcado como cancelado."
        }
        confirmText={itemToToggleCancel?.current ? "Reativar" : "Cancelar Item"}
        variant={itemToToggleCancel?.current ? "success" : "danger"}
      />

      <ConfirmationModal
        isOpen={!!alertInfo}
        onClose={() => setAlertInfo(null)}
        title={alertInfo?.title || ''}
        description={alertInfo?.message}
        variant={alertInfo?.type === 'success' ? 'success' : 'danger'}
        showCancel={false}
        confirmText="OK"
      />

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
