import { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Produto } from '../db';
import { ArrowLeft, Plus, Search, Trash2, Upload, X, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';

export function GerenciarProdutos() {
  const navigate = useNavigate();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form State
  const [nome, setNome] = useState('');
  const [foto, setFoto] = useState<string | undefined>(undefined);
  const [tipoOpcao, setTipoOpcao] = useState<'padrao' | 'tamanho_pg' | 'refrigerante' | 'sabores' | 'sabores_com_tamanho' | 'combinado'>('padrao');
  const [sabores, setSabores] = useState<string[]>([]);
  const [newSabor, setNewSabor] = useState('');
  const [isDrink, setIsDrink] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const produtos = useLiveQuery(() => 
    db.produtos.toArray()
  );

  const filteredProdutos = produtos?.filter(p => 
    p.nome.toLowerCase().includes(searchTerm.toLowerCase())
  ).reverse(); // Show newest first

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddSabor = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSabor && !sabores.includes(newSabor)) {
      setSabores([...sabores, newSabor]);
      setNewSabor('');
    }
  };

  const handleRemoveSabor = (saborToRemove: string) => {
    setSabores(sabores.filter(s => s !== saborToRemove));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome) return;

    const produtoData = {
      nome,
      preco: 0, // Not used anymore but kept for schema compatibility
      favorito: false,
      ultimoUso: new Date().toISOString(),
      foto,
      temOpcaoTamanho: tipoOpcao === 'tamanho_pg', // Backward compatibility
      tipoOpcao,
      sabores: (tipoOpcao === 'sabores' || tipoOpcao === 'sabores_com_tamanho' || tipoOpcao === 'combinado') ? sabores : undefined,
      isDrink
    };

    if (editingId) {
      await db.produtos.update(editingId, produtoData);
    } else {
      await db.produtos.add(produtoData);
    }

    // Reset
    resetForm();
  };

  const handleEdit = (prod: Produto) => {
    setEditingId(prod.id!);
    setNome(prod.nome);
    setFoto(prod.foto);
    setTipoOpcao(prod.tipoOpcao || (prod.temOpcaoTamanho ? 'tamanho_pg' : 'padrao'));
    setSabores(prod.sabores || []);
    setIsDrink(prod.isDrink || false);
    setIsAdding(true);
  };

  const resetForm = () => {
    setNome('');
    setFoto(undefined);
    setTipoOpcao('padrao');
    setSabores([]);
    setNewSabor('');
    setIsDrink(false);
    setEditingId(null);
    setIsAdding(false);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Tem certeza que deseja excluir este produto?')) {
      await db.produtos.delete(id);
    }
  };

  return (
    <div className="min-h-screen p-4 max-w-md mx-auto">
      <header className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/')} className="p-2 -ml-2 text-zinc-400">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">Cardápio</h1>
      </header>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Pesquisar produtos..."
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-12 pr-4 text-zinc-100 focus:ring-2 focus:ring-blue-600 outline-none"
        />
      </div>

      {/* Add Button */}
      <button
        onClick={() => setIsAdding(true)}
        className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 mb-8 active:scale-[0.98] transition-transform"
      >
        <Plus size={20} />
        Novo Produto
      </button>

      {/* Product List */}
      <div className="grid grid-cols-2 gap-4">
        {filteredProdutos?.map(prod => (
          <div key={prod.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col">
            <div className="aspect-square bg-zinc-800 relative">
              {prod.foto ? (
                <img src={prod.foto} alt={prod.nome} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-600">
                  <span className="text-4xl font-bold">{prod.nome[0].toUpperCase()}</span>
                </div>
              )}
              <button
                onClick={() => handleEdit(prod)}
                className="absolute top-2 right-12 p-2 bg-black/50 text-white rounded-full hover:bg-blue-500 transition-colors"
              >
                <Pencil size={16} />
              </button>
              <button
                onClick={() => handleDelete(prod.id!)}
                className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full hover:bg-red-500 transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
            <div className="p-3 text-center">
              <span className="font-bold block truncate">{prod.nome}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Add/Edit Product */}
      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 w-full max-w-sm rounded-2xl p-6 border border-zinc-800 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">{editingId ? 'Editar Produto' : 'Novo Produto'}</h2>
              <button onClick={resetForm} className="text-zinc-400 hover:text-white">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Image Upload */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="aspect-video bg-zinc-800 rounded-xl border-2 border-dashed border-zinc-700 flex flex-col items-center justify-center cursor-pointer hover:border-zinc-500 transition-colors relative overflow-hidden"
              >
                {foto ? (
                  <img src={foto} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <Upload size={32} className="text-zinc-500 mb-2" />
                    <span className="text-sm text-zinc-500">Toque para adicionar foto</span>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </div>

              {/* Name */}
              <div>
                <label className="text-sm font-medium text-zinc-400 block mb-1">Nome do Produto</label>
                <input
                  type="text"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-100 focus:ring-2 focus:ring-blue-600 outline-none"
                  placeholder="Ex: Hambúrguer"
                  autoFocus
                />
              </div>

              {/* Option Type */}
              <div>
                <label className="text-sm font-medium text-zinc-400 block mb-1">Tipo de Opção</label>
                <select
                  value={tipoOpcao}
                  onChange={e => setTipoOpcao(e.target.value as any)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-100 outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="padrao">Padrão (Sem variações)</option>
                  <option value="tamanho_pg">Tamanho (P/G)</option>
                  <option value="refrigerante">Refrigerante (Lata/Litro/KS + Normal/Zero)</option>
                  <option value="sabores">Apenas Sabores/Variações</option>
                  <option value="sabores_com_tamanho">Sabores + Tamanho (P/G)</option>
                  <option value="combinado">Combinado (Escolha Múltipla)</option>
                </select>
              </div>

              {/* Is Drink Checkbox */}
              <div className="flex items-center gap-3 bg-zinc-950/50 p-3 rounded-xl border border-zinc-800 cursor-pointer" onClick={() => setIsDrink(!isDrink)}>
                <div className={clsx(
                  "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors",
                  isDrink ? "bg-blue-600 border-blue-600" : "border-zinc-600 bg-zinc-900"
                )}>
                  {isDrink && <Plus size={16} className="text-white rotate-45" />}
                </div>
                <div>
                  <span className="text-sm font-bold text-zinc-200">Este produto é um Drink?</span>
                  <p className="text-xs text-zinc-500">Ativa opções como "Com Álcool" e "Sem Álcool"</p>
                </div>
              </div>

              {/* Sabores List */}
              {(tipoOpcao === 'sabores' || tipoOpcao === 'sabores_com_tamanho' || tipoOpcao === 'combinado') && (
                <div className="space-y-3 bg-zinc-950/50 p-3 rounded-xl border border-zinc-800">
                  <label className="text-sm font-medium text-zinc-400">Sabores/Variações</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newSabor}
                      onChange={e => setNewSabor(e.target.value)}
                      placeholder="Adicionar sabor/variação..."
                      className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-sm text-zinc-100 focus:ring-2 focus:ring-blue-600 outline-none"
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddSabor(e);
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAddSabor}
                      disabled={!newSabor}
                      className="bg-zinc-800 hover:bg-zinc-700 text-white p-2 rounded-lg disabled:opacity-50 transition-colors"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {sabores.map(sabor => (
                      <div key={sabor} className="bg-zinc-800 text-zinc-200 text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1">
                        <span>{sabor}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSabor(sabor)}
                          className="text-zinc-500 hover:text-red-400"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    {sabores.length === 0 && (
                      <p className="text-zinc-500 text-xs italic w-full text-center py-2">Nenhuma variação adicionada</p>
                    )}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={!nome || ((tipoOpcao === 'sabores' || tipoOpcao === 'sabores_com_tamanho' || tipoOpcao === 'combinado') && sabores.length === 0)}
                className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl active:scale-[0.98] transition-transform disabled:opacity-50 mt-4"
              >
                {editingId ? 'Salvar Alterações' : 'Criar Produto'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
