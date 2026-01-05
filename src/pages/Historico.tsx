import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { formatDuration } from '../utils/format';
import { ArrowLeft, Calendar, Trash2, X } from 'lucide-react';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';

export function Historico() {
  const navigate = useNavigate();
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedMesaId, setSelectedMesaId] = useState<string | null>(null);

  const mesas = useLiveQuery(async () => {
    const start = startOfDay(parseISO(date)).toISOString();
    const end = endOfDay(parseISO(date)).toISOString();

    return await db.mesas
      .where('status').equals('fechada')
      .and(m => !!m.fechadaEm && m.fechadaEm >= start && m.fechadaEm <= end)
      .reverse()
      .sortBy('fechadaEm');
  }, [date]);

  const selectedItems = useLiveQuery(async () => {
    if (!selectedMesaId) return [];
    return await db.itens.where('mesaId').equals(selectedMesaId).toArray();
  }, [selectedMesaId]);

  const selectedMesa = mesas?.find(m => m.id === selectedMesaId);

  const handleClearHistory = async () => {
    if (confirm('Tem certeza que deseja apagar TODO o histórico de mesas fechadas? Esta ação não pode ser desfeita.')) {
      const fechadas = await db.mesas.where('status').equals('fechada').toArray();
      const ids = fechadas.map(m => m.id!);
      
      // Delete items for these tables
      await db.itens.where('mesaId').anyOf(ids).delete();
      // Delete tables
      await db.mesas.where('status').equals('fechada').delete();
    }
  };

  return (
    <div className="min-h-screen p-4 max-w-md mx-auto relative">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="p-2 -ml-2 text-zinc-400">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-bold">Histórico</h1>
        </div>
        <button 
          onClick={handleClearHistory}
          className="p-2 text-red-400 hover:bg-red-400/10 rounded-full transition-colors"
          title="Limpar Histórico"
        >
          <Trash2 size={20} />
        </button>
      </header>

      <div className="flex items-center gap-4 mb-6 bg-zinc-900 p-2 rounded-xl border border-zinc-800">
        <Calendar className="text-zinc-400 ml-2" size={20} />
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="bg-transparent text-white w-full outline-none py-2"
        />
      </div>

      <div className="bg-emerald-900/20 border border-emerald-900/50 rounded-xl p-6 mb-8 text-center">
        <span className="text-emerald-400 text-sm uppercase tracking-wider">Mesas Fechadas</span>
        <div className="text-4xl font-bold text-emerald-400 mt-1">
          {mesas?.length || 0}
        </div>
      </div>

      <div className="space-y-3">
        {mesas?.map(mesa => (
          <button 
            key={mesa.id} 
            onClick={() => setSelectedMesaId(mesa.id!)}
            className="w-full text-left bg-zinc-900 border border-zinc-800 rounded-xl p-4 active:scale-[0.98] transition-transform hover:border-zinc-700"
          >
            <div className="flex justify-between items-start mb-2">
              <span className="font-bold text-lg text-zinc-100">Mesa {mesa.numero}</span>
              <span className="text-zinc-500 text-sm">
                {mesa.fechadaEm ? format(parseISO(mesa.fechadaEm), 'HH:mm') : '-'}
              </span>
            </div>
            
            <div className="flex justify-between items-end text-sm text-zinc-400">
               <span>Duração: {formatDuration(mesa.abertaEm)}</span>
            </div>
            {mesa.pagamento && (
                <div className="mt-2 pt-2 border-t border-zinc-800 text-xs text-zinc-500 truncate">
                    Nota: {mesa.pagamento}
                </div>
            )}
          </button>
        ))}

        {mesas?.length === 0 && (
          <div className="text-center py-12 text-zinc-600">
            <p>Nenhuma mesa fechada nesta data</p>
          </div>
        )}
      </div>

      {/* Modal Details */}
      {selectedMesaId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedMesaId(null)}>
          <div 
            className="bg-zinc-900 w-full max-w-sm max-h-[80vh] rounded-2xl flex flex-col shadow-2xl border border-zinc-800 animate-in zoom-in-95 duration-200" 
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">Mesa {selectedMesa?.numero}</h2>
                <p className="text-xs text-zinc-400">Detalhes do pedido</p>
              </div>
              <button 
                onClick={() => setSelectedMesaId(null)}
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {selectedItems?.map(item => (
                <div key={item.id} className={clsx("flex justify-between items-start", item.cancelado && "opacity-50")}>
                  <div>
                    <div className="font-medium flex items-baseline gap-2">
                      <span className="text-zinc-400 text-sm">{item.quantidade}x</span>
                      <span className={clsx(item.cancelado && "line-through")}>{item.descricao}</span>
                    </div>
                    {item.observacao && (
                      <p className="text-xs text-zinc-500 italic">"{item.observacao}"</p>
                    )}
                  </div>
                  {item.cancelado && <span className="text-xs text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full">Cancelado</span>}
                </div>
              ))}
              {selectedItems?.length === 0 && (
                <p className="text-center text-zinc-500 py-4">Nenhum item encontrado.</p>
              )}
            </div>

            {selectedMesa?.pagamento && (
               <div className="p-4 border-t border-zinc-800 bg-zinc-900/50 rounded-b-2xl">
                 <p className="text-xs text-zinc-500 font-medium mb-1">Notas/Observações</p>
                 <p className="text-sm text-zinc-300">{selectedMesa.pagamento}</p>
               </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
