import { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Produto } from '../db';
import { ArrowLeft, Plus, Search, Trash2, Upload, X, Pencil, ImageIcon, Wine, Pizza, Utensils, Download } from 'lucide-react';
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
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);

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

  const handleExport = async () => {
    const items = await db.produtos.toArray();
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      items
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cardapio.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const items: any[] = Array.isArray(json) ? json : Array.isArray(json?.items) ? json.items : [];
      if (!items.length) {
        setImportStatus('Arquivo inválido ou vazio');
        return;
      }
      const existing = await db.produtos.toArray();
      const mapByName = new Map(existing.map(p => [p.nome.toLowerCase(), p.id!]));
      let added = 0, updated = 0;
      for (const i of items) {
        const base = {
          nome: i.nome,
          preco: typeof i.preco === 'number' ? i.preco : 0,
          favorito: !!i.favorito,
          ultimoUso: new Date().toISOString(),
          foto: i.foto,
          temOpcaoTamanho: i.temOpcaoTamanho ?? (i.tipoOpcao === 'tamanho_pg'),
          tipoOpcao: i.tipoOpcao ?? (i.temOpcaoTamanho ? 'tamanho_pg' : 'padrao'),
          sabores: i.sabores,
          isDrink: !!i.isDrink
        } as Produto;
        if (!base.nome) continue;
        const id = mapByName.get(base.nome.toLowerCase());
        if (id) {
          await db.produtos.update(id, base);
          updated++;
        } else {
          await db.produtos.add(base);
          added++;
        }
      }
      setImportStatus(`Importação concluída: ${added} adicionados, ${updated} atualizados`);
      e.target.value = '';
    } catch (err) {
      console.error(err);
      setImportStatus('Falha ao importar arquivo');
    }
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
          <button
            onClick={handleExport}
            title="Exportar cardápio (JSON)"
            className="bg-zinc-800 text-zinc-200 font-bold p-2.5 rounded-xl flex items-center justify-center border border-zinc-700 hover:bg-zinc-700 active:scale-95 transition-transform"
          >
            <Download size={18} />
          </button>
          <button
            onClick={() => importInputRef.current?.click()}
            title="Importar cardápio (JSON)"
            className="bg-zinc-800 text-zinc-200 font-bold p-2.5 rounded-xl flex items-center justify-center border border-zinc-700 hover:bg-zinc-700 active:scale-95 transition-transform"
          >
            <Upload size={18} />
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={handleImportFileChange}
          />
        </div>
      </header>

      {importStatus && (
        <div className="px-4">
          <div className="mt-2 bg-zinc-900 border border-zinc-800 text-zinc-300 text-sm rounded-xl px-3 py-2">
            {importStatus}
          </div>
        </div>
      )}

      {/* Product List */}
      <div className="p-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
        {filteredProdutos?.map((prod, idx) => (
          <div 
            key={prod.id} 
            style={{ animationDelay: `${idx * 50}ms` }}
            className="group relative flex flex-col bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 hover:border-zinc-700 transition-all duration-300 animate-in fade-in zoom-in-50 fill-mode-backwards"
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
                  <ImageIcon size={24} strokeWidth={1.5} />
                </div>
              )}
              
              {/* Type Badge - Smaller */}
              <div className="absolute top-1.5 left-1.5 bg-black/60 backdrop-blur-md p-1 rounded-md border border-white/10 shadow-lg">
                {prod.isDrink ? <Wine size={14} className="text-purple-400" /> : 
                 (prod.tipoOpcao === 'sabores' || prod.tipoOpcao === 'sabores_com_tamanho') ? <Pizza size={14} className="text-orange-400" /> :
                 <Utensils size={14} className="text-blue-400" />}
              </div>

              {/* Delete Button (Floating) - Smaller */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteConfirmationId(prod.id!);
                }}
                className="absolute top-1.5 right-1.5 p-1.5 bg-red-500/80 backdrop-blur-md text-white rounded-md hover:bg-red-500 transition-colors opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 duration-200 shadow-lg"
              >
                <Trash2 size={14} />
              </button>

              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent opacity-60" />
            </div>

            {/* Content */}
            <div 
              onClick={() => handleEdit(prod)}
              className="p-2 pt-1.5 relative cursor-pointer"
            >
              <div className="flex items-start justify-between gap-1">
                <span className="font-bold text-xs leading-tight text-zinc-200 line-clamp-2">{prod.nome}</span>
              </div>
              
              <div className="mt-1.5 flex flex-wrap gap-1">
                {prod.tipoOpcao !== 'padrao' && (
                  <span className="text-[9px] px-1 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/50 leading-none">
                    {prod.tipoOpcao === 'refrigerante' ? 'Bebida' : 
                     prod.tipoOpcao === 'tamanho_pg' ? 'P/G' : 
                     prod.tipoOpcao === 'combinado' ? 'Combinado' : 'Variações'}
                  </span>
                )}
                {prod.isDrink && (
                   <span className="text-[9px] px-1 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 leading-none">
                     Drink
                   </span>
                )}
              </div>
            </div>
          </div>
        ))}

        {filteredProdutos?.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-12 text-zinc-500 gap-3">
            <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center">
              <Search size={20} />
            </div>
            <p className="text-sm">Nenhum produto encontrado</p>
          </div>
        )}
      </div>

      {/* Modal Add/Edit Product */}
      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 w-full max-w-sm max-h-[90vh] rounded-2xl border border-zinc-800 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-zinc-800 shrink-0">
              <h2 className="text-lg font-bold">{editingId ? 'Editar Produto' : 'Novo Produto'}</h2>
              <button onClick={resetForm} className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800">
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto p-4 scrollbar-hide">
              <form id="product-form" onSubmit={handleSave} className="space-y-4">
                {/* Image Upload - More Compact */}
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="h-32 w-full bg-zinc-800 rounded-xl border-2 border-dashed border-zinc-700 flex flex-col items-center justify-center cursor-pointer hover:border-zinc-500 transition-colors relative overflow-hidden group"
                >
                  {foto ? (
                    <>
                      <img src={foto} alt="Preview" className="w-full h-full object-cover opacity-80 group-hover:opacity-60 transition-opacity" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Pencil className="text-white drop-shadow-md" size={24} />
                      </div>
                    </>
                  ) : (
                    <>
                      <Upload size={24} className="text-zinc-500 mb-2" />
                      <span className="text-xs text-zinc-500">Toque para adicionar foto</span>
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
                  <label className="text-xs font-bold text-zinc-400 block mb-1 uppercase tracking-wider">Nome do Produto</label>
                  <input
                    type="text"
                    value={nome}
                    onChange={e => setNome(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-zinc-100 focus:ring-2 focus:ring-blue-600 outline-none text-sm"
                    placeholder="Ex: Hambúrguer"
                    autoFocus
                  />
                </div>

                {/* Option Type */}
                <div>
                  <label className="text-xs font-bold text-zinc-400 block mb-1 uppercase tracking-wider">Tipo de Opção</label>
                  <select
                    value={tipoOpcao}
                    onChange={e => setTipoOpcao(e.target.value as any)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-zinc-100 outline-none focus:ring-2 focus:ring-blue-600 text-sm"
                  >
                    <option value="padrao">Padrão (Sem variações)</option>
                    <option value="tamanho_pg">Tamanho (P/G)</option>
                    <option value="refrigerante">Refrigerante (Lata/Litro/KS + Normal/Zero)</option>
                    <option value="sabores">Apenas Sabores/Variações</option>
                    <option value="sabores_com_tamanho">Sabores + Tamanho (P/G)</option>
                    <option value="combinado">Combinado (Escolha Múltipla)</option>
                  </select>
                </div>

                {/* Is Drink Checkbox - Compact */}
                <div 
                  className="flex items-center gap-3 bg-zinc-950/50 p-2.5 rounded-lg border border-zinc-800 cursor-pointer active:bg-zinc-900 transition-colors" 
                  onClick={() => setIsDrink(!isDrink)}
                >
                  <div className={clsx(
                    "w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0",
                    isDrink ? "bg-blue-600 border-blue-600" : "border-zinc-600 bg-zinc-900"
                  )}>
                    {isDrink && <Plus size={14} className="text-white rotate-45" />}
                  </div>
                  <div>
                    <span className="text-sm font-bold text-zinc-200">É Bebida/Drink?</span>
                    <p className="text-[10px] text-zinc-500 leading-tight">Habilita opções "Com/Sem Álcool"</p>
                  </div>
                </div>

                {/* Sabores List */}
                {(tipoOpcao === 'sabores' || tipoOpcao === 'sabores_com_tamanho' || tipoOpcao === 'combinado') && (
                  <div className="space-y-2 bg-zinc-950/50 p-3 rounded-xl border border-zinc-800">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Sabores/Variações</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newSabor}
                        onChange={e => setNewSabor(e.target.value)}
                        placeholder="Novo sabor..."
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
                        <Plus size={18} />
                      </button>
                    </div>
                    
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                      {sabores.map(sabor => (
                        <div key={sabor} className="bg-zinc-800 text-zinc-200 text-xs font-medium px-2 py-1 rounded-md flex items-center gap-1 border border-zinc-700/50">
                          <span>{sabor}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveSabor(sabor)}
                            className="text-zinc-500 hover:text-red-400 p-0.5 rounded-full hover:bg-zinc-700/50"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                      {sabores.length === 0 && (
                        <p className="text-zinc-600 text-xs italic w-full text-center py-1">Nenhuma variação</p>
                      )}
                    </div>
                  </div>
                )}
              </form>
            </div>

            <div className="p-4 border-t border-zinc-800 shrink-0 bg-zinc-900 rounded-b-2xl">
              <button
                type="submit"
                form="product-form"
                disabled={!nome || ((tipoOpcao === 'sabores' || tipoOpcao === 'sabores_com_tamanho' || tipoOpcao === 'combinado') && sabores.length === 0)}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 shadow-lg shadow-blue-900/20"
              >
                {editingId ? 'Salvar Alterações' : 'Criar Produto'}
              </button>
            </div>
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
