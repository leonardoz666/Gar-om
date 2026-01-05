import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { formatDuration } from '../utils/format';
import { ArrowLeft, CheckCheck, Wallet } from 'lucide-react';
import { ConfirmationModal } from '../components/ConfirmationModal';

export function FecharMesa() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // Only query mesa, since we calculate total from mesa.totalEstimado or we can recalculate if needed.
  // But for "FecharMesa", usually we just need the mesa details.
  const mesa = useLiveQuery(() => db.mesas.get(id!), [id]);

  const [pagamento, setPagamento] = useState('');
  const [showConfirmClose, setShowConfirmClose] = useState(false);

  if (!mesa) return null;

  const handleClose = async () => {
    await db.mesas.update(id!, {
      status: 'fechada',
      fechadaEm: new Date().toISOString(),
      pagamento,
      // Total calculation removed per user request
    });

    if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
    navigate('/');
  };

  const handlePreClose = async () => {
      // Mark as "Finalizando"
      await db.mesas.update(id!, { status: 'finalizando' });
      if (navigator.vibrate) navigator.vibrate(50);
      navigate(-1);
  };

  return (
    <div className="min-h-screen p-4 max-w-md mx-auto flex flex-col">
      <header className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-zinc-400">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">Fechar Mesa {mesa.numero}</h1>
      </header>

      <div className="flex-1 space-y-8">
        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 text-center space-y-2">
           <div className="text-xl text-zinc-400">
             Tempo Aberto: {formatDuration(mesa.abertaEm)}
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-400">
            <Wallet size={16} />
            Notas / Observações
          </label>
          <textarea
            value={pagamento}
            onChange={e => setPagamento(e.target.value)}
            rows={3}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-lg text-zinc-100 focus:ring-2 focus:ring-blue-600 outline-none resize-none"
            placeholder="Observações sobre a mesa..."
          />
        </div>

        {mesa.status !== 'finalizando' && (
             <button 
                onClick={handlePreClose}
                className="w-full bg-amber-600/20 text-amber-500 border border-amber-600/50 font-bold py-3 rounded-xl hover:bg-amber-600/30 transition-colors"
            >
                Marcar como Finalizando (Conta Pedida)
            </button>
        )}
      </div>

      <button
        onClick={() => setShowConfirmClose(true)}
        className="w-full bg-emerald-600 text-white font-bold text-xl py-4 rounded-xl shadow-lg shadow-emerald-900/20 active:scale-[0.98] transition-transform flex items-center justify-center gap-2 mt-auto"
      >
        <CheckCheck size={24} />
        Encerrar Mesa
      </button>

      <ConfirmationModal
        isOpen={showConfirmClose}
        onClose={() => setShowConfirmClose(false)}
        onConfirm={handleClose}
        title="Encerrar Mesa?"
        description="Tem certeza que deseja encerrar esta mesa? Ela será movida para o histórico."
        confirmText="Encerrar"
        variant="success"
      />
    </div>
  );
}
