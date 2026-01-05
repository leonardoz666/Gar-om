import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { formatDuration } from '../utils/format';
import { ArrowLeft, Plus, CheckCircle2, XCircle, DollarSign, Clock, Share2, Copy, Send, UtensilsCrossed, Users } from 'lucide-react';
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

  const checkAndUpdateMesaStatus = async () => {
    if (!id) return;
    const allItems = await db.itens.where('mesaId').equals(id).toArray();
    const hasPending = allItems.some(i => !i.lancado && !i.cancelado);
    
    await db.mesas.update(id, {
      statusLancamento: hasPending ? 'esperando_lancamento' : 'lancado'
    });
  };

  const toggleEntregue = (itemId: string, current: boolean) => {
    db.itens.update(itemId, { entregue: !current });
    if (navigator.vibrate) navigator.vibrate(20);
  };

  const toggleLancado = async (itemId: string, current: boolean) => {
    await db.itens.update(itemId, { lancado: !current });
    if (navigator.vibrate) navigator.vibrate(20);
    checkAndUpdateMesaStatus();
  };

  const handleToggleCancel = async () => {
    if (itemToToggleCancel) {
      await db.itens.update(itemToToggleCancel.id, { cancelado: !itemToToggleCancel.current });
      setItemToToggleCancel(null);
      checkAndUpdateMesaStatus();
    }
  };

  const getItemStatus = (item: any) => {
    if (item.cancelado) return { 
      label: 'CANCELADO', 
      color: 'text-red-500', 
      bg: 'bg-red-500/10 border-red-500/20',
      container: 'border-red-500/30 shadow-[0_0_15px_-3px_rgba(239,68,68,0.2)]'
    };
    if (item.entregue) return { 
      label: 'ENTREGUE', 
      color: 'text-emerald-500', 
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      container: 'border-emerald-500/30 shadow-[0_0_15px_-3px_rgba(16,185,129,0.2)]'
    };
    if (item.lancado) return { 
      label: 'LANÇADO', 
      color: 'text-blue-400', 
      bg: 'bg-blue-500/10 border-blue-500/20',
      container: 'border-blue-500/30 shadow-[0_0_15px_-3px_rgba(59,130,246,0.2)]'
    };
    return { 
      label: 'PENDENTE', 
      color: 'text-amber-400', 
      bg: 'bg-amber-500/10 border-amber-500/20',
      container: 'border-amber-500/30 shadow-[0_0_15px_-3px_rgba(245,158,11,0.2)]'
    };
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
      <div className="p-2 grid grid-cols-2 gap-2">
        {itens?.map(item => {
          const status = getItemStatus(item);
          
          return (
            <div 
              key={item.id} 
              className={clsx(
                "p-3 rounded-xl border flex flex-col gap-2 transition-all",
                item.cancelado ? "bg-zinc-900/30" : "bg-zinc-900",
                status.container
              )}
            >
              {/* Header: Name (Clickable) & Timer */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-start gap-1">
                  <Link 
                    to={!item.cancelado ? `/mesa/${id}/pedido/${item.id}` : '#'}
                    className={clsx(
                      "font-bold leading-tight group line-clamp-2",
                      item.cancelado && "opacity-50 pointer-events-none"
                    )}
                  >
                    <span className="text-lg text-zinc-300 mr-1">{item.quantidade}x</span>
                    <span className={clsx(
                      "text-base group-hover:text-blue-400 transition-colors",
                      item.cancelado && "line-through"
                    )}>
                      {item.descricao}
                    </span>
                  </Link>

                  <div className={clsx(
                    "flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap border shrink-0",
                    status.bg,
                    status.color
                  )}>
                    <Clock size={10} className="mr-1" />
                    {formatDuration(item.criadoEm)}
                  </div>
                </div>

                {item.observacao && (
                  <p className="text-[10px] text-zinc-500 italic font-normal line-clamp-2 leading-tight">
                    "{item.observacao}"
                  </p>
                )}
              </div>

              {/* Status Indicator */}
              <div className="flex flex-col gap-2 border-t border-zinc-800/50 pt-2 mt-auto">
                <div className="flex items-center justify-between">
                  <span className={clsx(
                    "text-[9px] font-black uppercase tracking-wider truncate mr-1",
                    status.color
                  )}>
                    {status.label}
                  </span>
                </div>
                
                {/* Action Buttons */}
                <div className="flex items-center justify-between gap-1">
                  {/* Lançado Button */}
                  <button
                    onClick={() => toggleLancado(item.id, !!item.lancado)}
                    disabled={!!item.cancelado}
                    className={clsx(
                      "flex-1 py-2 rounded-lg transition-all border flex items-center justify-center",
                      item.lancado 
                        ? "bg-blue-500 text-white border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]" 
                        : "bg-zinc-800 text-zinc-500 border-zinc-700 hover:border-blue-500/50 hover:text-blue-400",
                      item.cancelado && "opacity-20 grayscale pointer-events-none"
                    )}
                    title={item.lancado ? "Marcar como não lançado" : "Marcar como lançado"}
                  >
                    <UtensilsCrossed size={14} />
                  </button>

                  {/* Entregue Button */}
                  <button
                    onClick={() => toggleEntregue(item.id, item.entregue)}
                    disabled={!!item.cancelado}
                    className={clsx(
                      "flex-1 py-2 rounded-lg transition-all border flex items-center justify-center",
                      item.entregue 
                        ? "bg-emerald-500 text-white border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]" 
                        : "bg-zinc-800 text-zinc-500 border-zinc-700 hover:border-emerald-500/50 hover:text-emerald-400",
                       item.cancelado && "opacity-20 grayscale pointer-events-none"
                    )}
                    title={item.entregue ? "Marcar como não entregue" : "Marcar como entregue"}
                  >
                    <CheckCircle2 size={14} />
                  </button>

                  {/* Cancelar Button */}
                  <button
                    onClick={() => setItemToToggleCancel({ id: item.id, current: !!item.cancelado })}
                    className={clsx(
                      "flex-1 py-2 rounded-lg transition-all border flex items-center justify-center",
                      item.cancelado 
                        ? "bg-red-500 text-white border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]" 
                        : "bg-zinc-800 text-zinc-500 border-zinc-700 hover:border-red-500/50 hover:text-red-400"
                    )}
                    title={item.cancelado ? "Restaurar item" : "Cancelar item"}
                  >
                    <XCircle size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        
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
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-zinc-950 border-t border-zinc-900 flex gap-4 z-20">
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
