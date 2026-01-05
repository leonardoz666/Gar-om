import { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Produto } from '../db';
import { ArrowLeft, Plus, Search, Trash2, Upload, X, Pencil, ImageIcon, Wine, Pizza, Utensils } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { ConfirmationModal } from '../components/ConfirmationModal';

export function GerenciarProdutos() {
  const navigate = useNavigate();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<number | null>(null);
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

  const confirmDelete = async () => {
    if (deleteConfirmationId) {
      await db.produtos.delete(deleteConfirmationId);
      setDeleteConfirmationId(null);
    }
  };

  const getProductIcon = (prod: Produto) => {
    if (prod.isDrink) return <Wine size={20} className="text-purple-400" />;
    if (prod.tipoOpcao === 'sabores' || prod.tipoOpcao === 'sabores_com_tamanho') return <Pizza size={20} className="text-orange-400" />;
    return <Utensils size={20} className="text-blue-400" />;
  };

  return (
    <div className="min-h-screen pb-32 bg-zinc-950 relative">
      <header className="sticky top-0 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 z-10 p-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate('/')} className="p-2 -ml-2 text-zinc-400 hover:text-white transition-colors">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-bold">Gerenciar Cardápio</h1>
          <div className="w-10" /> {/* Spacer */}
        </div>

        {/* Search & Add */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar..."
              className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-zinc-100 focus:ring-2 focus:ring-blue-600 outline-none text-sm placeholder:text-zinc-600"
            />
          </div>
          <button
            onClick={() => setIsAdding(true)}
            className="bg-blue-600 text-white font-bold p-2.5 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20 active:scale-95 transition-transform"
          >
            <Plus size={20} />
          </button>
        </div>
      </header>

      {/* Product List */}
      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {filteredProdutos?.map((prod, idx) => (
          <div 
            key={prod.id} 
            style={{ animationDelay: `${idx * 50}ms` }}
            className="group relative flex flex-col bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 hover:border-zinc-700 transition-all duration-300 animate-in fade-in zoom-in-50 fill-mode-backwards"
          >
            {/* Image Area */}
            <div 
              onClick={() => handleEdit(prod)}
              className="aspect-square w-full bg-zinc-800 relative overflow-hidden cursor-pointer"
            >
              {prod.foto ? (
                <img 
                  src={prod.foto} 
                  alt={prod.nome} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-700 bg-zinc-800/50">
                  <ImageIcon size={32} strokeWidth={1.5} />
                </div>
              )}
              
              {/* Type Badge */}
              <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md p-1.5 rounded-lg border border-white/10 shadow-lg">
                {getProductIcon(prod)}
              </div>

              {/* Delete Button (Floating) */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteConfirmationId(prod.id!);
                }}
                className="absolute top-2 right-2 p-2 bg-red-500/80 backdrop-blur-md text-white rounded-lg hover:bg-red-500 transition-colors opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 duration-200 shadow-lg"
              >
                <Trash2 size={16} />
              </button>

              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent opacity-60" />
            </div>

            {/* Content */}
            <div 
              onClick={() => handleEdit(prod)}
              className="p-3 pt-2 relative cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-bold text-sm leading-tight text-zinc-200 line-clamp-2">{prod.nome}</span>
              </div>
              
              <div className="mt-2 flex flex-wrap gap-1">
                {prod.tipoOpcao !== 'padrao' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-zinc-800 text-zinc-400 border border-zinc-700/50">
                    {prod.tipoOpcao === 'refrigerante' ? 'Bebida' : 
                     prod.tipoOpcao === 'tamanho_pg' ? 'P/G' : 
                     prod.tipoOpcao === 'combinado' ? 'Combinado' : 'Variações'}
                  </span>
                )}
                {prod.isDrink && (
                   <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20">
                     Drink
                   </span>
                )}
              </div>
            </div>
          </div>
        ))}

        {filteredProdutos?.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-12 text-zinc-500 gap-3">
            <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center">
              <Search size={24} />
            </div>
            <p>Nenhum produto encontrado</p>
          </div>
        )}
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

      <ConfirmationModal
        isOpen={!!deleteConfirmationId}
        onClose={() => setDeleteConfirmationId(null)}
        onConfirm={confirmDelete}
        title="Excluir Produto?"
        description="Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita."
        confirmText="Excluir"
        variant="danger"
      />
    </div>
  );
}
