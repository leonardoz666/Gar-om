import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { ArrowLeft, Users, StickyNote } from 'lucide-react';

export function NovaMesa() {
  const navigate = useNavigate();
  const [numero, setNumero] = useState('');
  const [pessoas, setPessoas] = useState('');
  const [observacao, setObservacao] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!numero) return;

    const id = uuidv4();
    await db.mesas.add({
      id,
      numero: parseInt(numero),
      pessoas: pessoas ? parseInt(pessoas) : undefined,
      observacao,
      abertaEm: new Date().toISOString(),
      status: 'aberta',
      totalEstimado: 0
    });

    // Vibration feedback
    if (navigator.vibrate) navigator.vibrate(50);

    navigate(`/mesa/${id}`, { replace: true });
  };

  return (
    <div className="min-h-screen p-4 max-w-md mx-auto">
      <header className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-zinc-400">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">Abrir Nova Mesa</h1>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-2">
            Número da Mesa
          </label>
          <input
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            autoFocus
            required
            value={numero}
            onChange={e => setNumero(e.target.value.replace(/\D/g, ''))}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-4xl font-bold text-center text-zinc-100 focus:ring-2 focus:ring-blue-600 outline-none"
            placeholder="0"
          />
        </div>

        <div className="grid grid-cols-1 gap-6">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-400 mb-2">
              <Users size={16} />
              Nº de Pessoas (Opcional)
            </label>
            <input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              value={pessoas}
              onChange={e => setPessoas(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-lg text-zinc-100 focus:ring-2 focus:ring-blue-600 outline-none"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-400 mb-2">
              <StickyNote size={16} />
              Observação
            </label>
            <textarea
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
              rows={3}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-lg text-zinc-100 focus:ring-2 focus:ring-blue-600 outline-none resize-none"
              placeholder="Ex: Aniversário..."
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={!numero}
          className="w-full bg-blue-600 text-white font-bold text-xl py-4 rounded-xl shadow-lg shadow-blue-900/20 active:scale-[0.98] transition-transform disabled:opacity-50 disabled:cursor-not-allowed mt-8"
        >
          Abrir Mesa
        </button>
      </form>
    </div>
  );
}
