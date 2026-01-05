import { useLiveQuery } from 'dexie-react-hooks';
import { db, Mesa } from '../db';
import { Link } from 'react-router-dom';
import { Plus, History, Clock, Settings, AlertCircle, CheckCircle2 } from 'lucide-react';
import { formatDuration } from '../utils/format';
import { clsx } from 'clsx';
import { useState, useEffect } from 'react';

export function Home() {
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);

  const mesas = useLiveQuery(() => 
    db.mesas
      .where('status')
      .notEqual('fechada')
      .reverse()
      .sortBy('abertaEm')
  );

  const updateStatus = async (id: string, status: 'lancado' | 'esperando_lancamento') => {
      await db.transaction('rw', db.mesas, db.itens, async () => {
        await db.mesas.update(id, { statusLancamento: status });
        // Sync items with mesa status
        await db.itens.where('mesaId').equals(id).modify({ lancado: status === 'lancado' });
      });
    setEditingStatusId(null);
  };

  const pendingItemsCount = useLiveQuery(async () => {
    if (!mesas) return {};
    const counts: Record<string, number> = {};
    for (const mesa of mesas) {
      const itens = await db.itens.where('mesaId').equals(mesa.id).toArray();
      counts[mesa.id] = itens.filter(i => !i.entregue && !i.cancelado).length;
    }
    return counts;
  }, [mesas]);

  const handleStatusClick = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingStatusId(id);
  };

  // Force re-render every minute to update duration
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  // Auto-seed and Deduplicate products
  useEffect(() => {
    const seedAndCleanup = async () => {
      const itemsToEnsure = [
        {
          nome: 'Pastel',
          tipoOpcao: 'sabores',
          sabores: ['Frango com queijo', 'Romeu e Julieta', 'Cupim com Queijo', 'Sertanejo']
        },
        {
          nome: 'Bolinho',
          tipoOpcao: 'sabores',
          sabores: ['Quatro Queijos', 'Calabresa com Queijo', 'Bacalhau', 'Frango com Queijo']
        },
        {
          nome: 'Pirao Kids',
          tipoOpcao: 'sabores',
          sabores: ['Frango', 'Carne de Sol', 'Fumeiro']
        },
        {
          nome: 'Porção Extra',
          tipoOpcao: 'sabores',
          sabores: ['Arroz', 'Farofa', 'Salada', 'Pirao', 'Banana da Terra', 'Vatapa']
        },
        {
          nome: 'Pirão',
          tipoOpcao: 'sabores_com_tamanho',
          sabores: ['Carne de Sol', 'Ao molho', 'Alho e Oleo', 'Fumeiro', 'Sertanejo', 'Cupim', 'Frango', 'Costela']
        },
        {
          nome: 'Pirão G Combinado',
          tipoOpcao: 'combinado',
          sabores: ['Carne de Sol', 'Ao molho', 'Alho e Oleo', 'Fumeiro', 'Sertanejo', 'Cupim', 'Frango', 'Costela']
        }
      ];

      for (const item of itemsToEnsure) {
        // Find all products with this name (case insensitive)
        const existing = await db.produtos
          .filter(p => p.nome.toLowerCase() === item.nome.toLowerCase())
          .toArray();

        if (existing.length === 0) {
          // Create if not exists
          await db.produtos.add({
            nome: item.nome,
            tipoOpcao: item.tipoOpcao as any,
            sabores: item.sabores,
            favorito: false,
            ultimoUso: new Date().toISOString(),
            preco: 0
          });
        } else {
          // Deduplicate: Keep the best match (same type) or newest
          const sorted = existing.sort((a, b) => {
            // Priority 1: Match the desired type
            const aTypeMatch = a.tipoOpcao === item.tipoOpcao ? 1 : 0;
            const bTypeMatch = b.tipoOpcao === item.tipoOpcao ? 1 : 0;
            if (aTypeMatch !== bTypeMatch) return bTypeMatch - aTypeMatch;
            
            // Priority 2: Newest ID
            return (b.id || 0) - (a.id || 0);
          });

          // Keep the first one
          const toKeep = sorted[0];
          
          // If the best match doesn't have correct type/flavors, update it
          if (toKeep.tipoOpcao !== item.tipoOpcao || JSON.stringify(toKeep.sabores) !== JSON.stringify(item.sabores)) {
             await db.produtos.update(toKeep.id!, {
               tipoOpcao: item.tipoOpcao as any,
               sabores: item.sabores
             });
          }

          // Delete others
          const toDelete = sorted.slice(1);
          if (toDelete.length > 0) {
            await db.produtos.bulkDelete(toDelete.map(p => p.id!));
          }
        }
      }
    };
    
    seedAndCleanup();
  }, []);

  const getStatusColor = (mesa: Mesa) => {
    switch (mesa.status) {
      case 'aberta': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'em_andamento': 
        if (mesa.statusLancamento === 'lancado') {
          return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
        }
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'finalizando': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-zinc-800 text-zinc-400 border-zinc-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'aberta': return 'Nova';
      case 'em_andamento': return 'Em andamento';
      case 'finalizando': return 'Finalizando';
      default: return status;
    }
  };

  return (
    <div className="p-4 pb-24 max-w-md mx-auto min-h-screen relative">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-zinc-100">Mesas Abertas</h1>
        <div className="flex gap-2">
          <Link to="/produtos" className="p-2 rounded-full bg-zinc-900 text-zinc-400 hover:text-zinc-100">
            <Settings size={24} />
          </Link>
          <Link to="/historico" className="p-2 rounded-full bg-zinc-900 text-zinc-400 hover:text-zinc-100">
            <History size={24} />
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3">
        {mesas?.map(mesa => (
          <Link 
            key={mesa.id} 
            to={`/mesa/${mesa.id}`}
            onContextMenu={(e) => {
              e.preventDefault();
              handleStatusClick(e, mesa.id);
            }}
            className={clsx(
              "flex flex-col p-3 rounded-xl border transition-all active:scale-[0.98] min-h-[140px]",
              "bg-zinc-900",
              getStatusColor(mesa)
            )}
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">Mesa {mesa.numero}</span>
                {((pendingItemsCount?.[mesa.id] ?? 0) > 0) && (
                  <span className={clsx(
                    "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border",
                    "bg-amber-500/20 text-amber-300 border-amber-500/30"
                  )}>
                    +{pendingItemsCount?.[mesa.id] ?? 0}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2 mb-2">
              <div className="flex flex-wrap gap-1">
                {mesa.status !== 'em_andamento' && (
                  <span className={clsx(
                    "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider",
                    "bg-black/20"
                  )}>
                    {getStatusLabel(mesa.status)}
                  </span>
                )}
              </div>

              <button
                onClick={(e) => handleStatusClick(e, mesa.id)}
                className={clsx(
                  "w-full px-2 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider border flex items-center justify-center gap-1 transition-colors",
                  mesa.statusLancamento === 'lancado'
                    ? "bg-blue-500/20 text-blue-300 border-blue-500/30 hover:bg-blue-500/30"
                    : "bg-orange-500/20 text-orange-300 border-orange-500/30 hover:bg-orange-500/30"
                )}
              >
                {mesa.statusLancamento === 'lancado' ? (
                   <>
                     <CheckCircle2 size={12} />
                     Lançado
                   </>
                ) : (
                   <>
                     <AlertCircle size={12} />
                     Pendente
                   </>
                )}
              </button>
            </div>
            
            <div className="mt-auto flex items-center gap-1.5 text-xs opacity-80 pt-2 border-t border-black/10">
              <Clock size={14} />
              <span>{formatDuration(mesa.abertaEm)}</span>
            </div>
          </Link>
        ))}

        {mesas?.length === 0 && (
          <div className="col-span-2 text-center py-12 text-zinc-500">
            <p>Nenhuma mesa aberta</p>
          </div>
        )}
      </div>

      <Link 
        to="/mesa/nova"
        className="fixed bottom-6 right-6 w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-900/50 active:scale-90 transition-transform"
      >
        <Plus size={32} color="white" />
      </Link>

      {editingStatusId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-in fade-in duration-200" onClick={() => setEditingStatusId(null)}>
          <div className="bg-zinc-900 rounded-xl p-6 w-full max-w-sm space-y-4 border border-zinc-800 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-zinc-100 text-center">Alterar Status de Lançamento</h3>
            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={() => updateStatus(editingStatusId, 'esperando_lancamento')}
                className="p-4 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20 font-medium hover:bg-orange-500/20 flex items-center justify-center gap-2"
              >
                <AlertCircle size={20} />
                Esperando Lançamento
              </button>
              <button
                onClick={() => updateStatus(editingStatusId, 'lancado')}
                className="p-4 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium hover:bg-blue-500/20 flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={20} />
                Lançado
              </button>
            </div>
            <button 
              onClick={() => setEditingStatusId(null)}
              className="w-full p-3 text-zinc-400 hover:text-zinc-200 text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
