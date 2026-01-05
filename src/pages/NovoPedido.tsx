import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Produto } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { ArrowLeft, Minus, Plus, Save, Search, ShoppingCart, X, Check, ImageIcon, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';

export function NovoPedido() {
  const { id, itemId } = useParams<{ id: string; itemId?: string }>();
  const navigate = useNavigate();

  // --- EDIT MODE STATE (Single Item) ---
  const [editDescricao, setEditDescricao] = useState('');
  const [editQuantidade, setEditQuantidade] = useState(1);
  const [editObservacao, setEditObservacao] = useState('');

  // --- ADD MODE STATE (Bulk Selection) ---
  const [searchTerm, setSearchTerm] = useState('');
  // Change cart to string keys to support variants: "prodId" or "prodId-size"
  const [cart, setCart] = useState<Record<string, number>>({}); 
  const [cartObservations, setCartObservations] = useState<Record<number, string>>({});
  const [showConfirmation, setShowConfirmation] = useState(false);
  
  // Size selection modal
  const [selectedProductForSize, setSelectedProductForSize] = useState<Produto | null>(null);
  
  // State for Combined Items Modal
  const [selectedFlavorsForCombo, setSelectedFlavorsForCombo] = useState<string[]>([]);

  // Load existing item if editing
  useEffect(() => {
    if (itemId) {
      db.itens.get(itemId).then(item => {
        if (item) {
          setEditDescricao(item.descricao);
          setEditQuantidade(item.quantidade);
          setEditObservacao(item.observacao || '');
        }
      });
    }
  }, [itemId]);

  // Fetch all products for selection grid
  const allProducts = useLiveQuery(() => db.produtos.orderBy('nome').toArray(), []);

  // Filter products
  const filteredProducts = allProducts?.filter(p => 
    p.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate cart totals
  const totalItems = Object.values(cart).reduce((acc, qty) => acc + qty, 0);
  
  // Helper to get total quantity for a product (summing all variants)
  const getProductTotalQty = (prodId: number) => {
    let total = 0;
    Object.entries(cart).forEach(([key, qty]) => {
      if (key === String(prodId) || key.startsWith(`${prodId}-`)) {
        total += qty;
      }
    });
    return total;
  };

  // Helper to get products in cart
  const getSelectedProductsList = () => {
    if (!allProducts) return [];
    
    // Create a list of { product, size, quantity, key }
    const list: Array<{ product: Produto, size?: string, quantity: number, key: string }> = [];
    
    Object.entries(cart).forEach(([key, qty]) => {
      if (qty <= 0) return;
      
      const parts = key.split('-');
      const prodId = parseInt(parts[0]);
      
      // Handle Combined items
      if (parts[1] === 'COMBINADO') {
        const flavors = parts[2]?.split('+').join(' + ');
        const product = allProducts.find(p => p.id === prodId);
        if (product) {
          list.push({ product, size: flavors, quantity: qty, key });
        }
        return;
      }

      const size = parts.length > 1 ? parts.slice(1).join(' ') : undefined;

      const product = allProducts.find(p => p.id === prodId);
      
      if (product) {
        list.push({ product, size, quantity: qty, key });
      }
    });
    
    return list;
  };

  const handleUpdateQuantity = (prodId: number, delta: number, variantKey?: string) => {
    const key = variantKey ? `${prodId}-${variantKey}` : `${prodId}`;
    
    setCart(prev => {
      const current = prev[key] || 0;
      const next = current + delta;
      
      if (next <= 0) {
        const { [key]: _, ...rest } = prev;
        return rest;
      }
      
      return { ...prev, [key]: next };
    });
    
    if (navigator.vibrate) navigator.vibrate(20);
  };

  const handleRemoveProduct = (prodId: number) => {
    setCart(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(key => {
        const parts = key.split('-');
        if (parseInt(parts[0]) === prodId) {
          delete next[key];
        }
      });
      return next;
    });
    if (navigator.vibrate) navigator.vibrate([50, 50]);
  };

  const handleProductClick = (prod: Produto) => {
    // Determine option type (compatibility with old schema)
    const tipo = prod.tipoOpcao || (prod.temOpcaoTamanho ? 'tamanho_pg' : 'padrao');

    if (tipo !== 'padrao') {
      setSelectedProductForSize(prod);
      setSelectedFlavorsForCombo([]); // Reset combo state
    } else {
      handleUpdateQuantity(prod.id!, 1);
    }
  };

  const handleAddCombinedItem = () => {
    if (!selectedProductForSize || selectedFlavorsForCombo.length === 0) return;
    
    const flavorsKey = selectedFlavorsForCombo.sort().join('+');
    const key = `${selectedProductForSize.id}-COMBINADO-${flavorsKey}`;
    
    setCart(prev => {
      const current = prev[key] || 0;
      return { ...prev, [key]: current + 1 };
    });
    
    if (navigator.vibrate) navigator.vibrate(20);
    setSelectedProductForSize(null);
    setSelectedFlavorsForCombo([]);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDescricao || !itemId) return;

    await db.itens.update(itemId, {
      descricao: editDescricao,
      quantidade: editQuantidade,
      observacao: editObservacao,
      lancado: false
    });

    // Update mesa status to pending since an item was modified
    if (id) {
      await db.mesas.update(id, { statusLancamento: 'esperando_lancamento' });
    }

    navigate(-1);
  };

  const handleConfirmOrder = async () => {
    if (!id) return;

    const selectedList = getSelectedProductsList();

    const itemsToAdd = selectedList.map(item => ({
      id: uuidv4(),
      mesaId: id,
      descricao: item.size ? `${item.product.nome} (${item.size})` : item.product.nome,
      quantidade: item.quantity,
      valor: 0, // No value as requested
      observacao: cartObservations[item.product.id!] || '',
      entregue: false,
      lancado: false,
      criadoEm: new Date().toISOString()
    }));

    await db.itens.bulkAdd(itemsToAdd);

    // Update last usage for products (unique products only)
    const uniqueProducts = Array.from(new Set(selectedList.map(item => item.product)));
    const now = new Date().toISOString();
    await Promise.all(uniqueProducts.map(p => 
      db.produtos.update(p.id!, { ultimoUso: now })
    ));

    // Update table status
    const mesa = await db.mesas.get(id);
    if (mesa) {
      await db.mesas.update(id, { 
        statusLancamento: 'esperando_lancamento',
        ...(mesa.status === 'aberta' ? { status: 'em_andamento' } : {})
      });
    }

    if (navigator.vibrate) navigator.vibrate(50);
    navigate(-1);
  };

  // --- RENDER EDIT MODE ---
  if (itemId) {
    return (
      <div className="min-h-screen p-4 max-w-md mx-auto">
        <header className="flex items-center gap-4 mb-6">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-zinc-400">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-bold">Editar Pedido</h1>
        </header>

        <form onSubmit={handleSaveEdit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400">Produto</label>
            <input
              type="text"
              value={editDescricao}
              onChange={e => setEditDescricao(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-lg font-bold text-zinc-100 outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400">Quantidade</label>
            <div className="flex items-center bg-zinc-900 rounded-xl border border-zinc-800 p-1">
              <button
                type="button"
                onClick={() => setEditQuantidade(Math.max(1, editQuantidade - 1))}
                className="p-3 text-zinc-400 hover:text-white rounded-lg"
              >
                <Minus size={20} />
              </button>
              <input
                type="number"
                value={editQuantidade}
                onChange={e => setEditQuantidade(Math.max(1, parseInt(e.target.value) || 1))}
                className="flex-1 bg-transparent text-center text-xl font-bold outline-none appearance-none"
              />
              <button
                type="button"
                onClick={() => setEditQuantidade(editQuantidade + 1)}
                className="p-3 text-zinc-400 hover:text-white rounded-lg"
              >
                <Plus size={20} />
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400">Observação</label>
            <textarea
              value={editObservacao}
              onChange={e => setEditObservacao(e.target.value)}
              rows={2}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-zinc-100 outline-none resize-none"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white font-bold text-xl py-4 rounded-xl shadow-lg mt-8 flex items-center justify-center gap-2"
          >
            <Save size={24} />
            Salvar Alterações
          </button>
        </form>
      </div>
    );
  }

  // --- RENDER ADD MODE (Bulk Selection) ---
  return (
    <div className="min-h-screen flex flex-col bg-zinc-950">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 p-4">
        <div className="flex items-center gap-4 mb-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-zinc-400">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-bold">Adicionar Itens</h1>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar produtos..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-12 pr-4 text-zinc-100 placeholder-zinc-500 focus:ring-2 focus:ring-blue-600 outline-none"
          />
        </div>
      </div>

      {/* Product Grid */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="grid grid-cols-3 gap-2 pb-24">
          {filteredProducts?.map(prod => {
            const qty = getProductTotalQty(prod.id!);
            return (
              <div 
                key={prod.id} 
                onClick={() => handleProductClick(prod)}
                className={clsx(
                  "relative bg-zinc-900 rounded-xl overflow-hidden border transition-all active:scale-95 cursor-pointer touch-manipulation select-none",
                  qty > 0 ? "border-blue-500 ring-1 ring-blue-500" : "border-zinc-800"
                )}
              >
                {/* Image Area */}
                <div className="aspect-square w-full bg-zinc-800 relative">
                  {prod.foto ? (
                    <img src={prod.foto} alt={prod.nome} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-600">
                      <ImageIcon size={24} />
                    </div>
                  )}
                  
                  {/* Quantity Overlay (Centered) */}
                  {qty > 0 && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center backdrop-blur-[1px] p-1 gap-1">
                      {(() => {
                        const tipo = prod.tipoOpcao || (prod.temOpcaoTamanho ? 'tamanho_pg' : 'padrao');
                        
                        if (tipo === 'refrigerante') {
                          return Object.entries(cart)
                            .filter(([k]) => k.startsWith(`${prod.id}-`) && cart[k] > 0)
                            .map(([k, q]) => {
                              const parts = k.split('-');
                              if (parts.length < 3) return null; // Should be ID-Container-Variant
                              const container = parts[1]; // Lata, Litro, KS
                              const variant = parts[2];   // Normal, Zero
                              
                              return (
                                 <span key={k} className="text-xs font-bold text-white drop-shadow-lg leading-tight whitespace-nowrap">
                                   {q} {container} <span className={variant === 'Zero' ? 'text-green-400' : ''}>{variant[0]}</span>
                                 </span>
                              );
                            });
                        }

                        if (tipo === 'sabores_com_tamanho' && prod.sabores) {
                          const total = Object.entries(cart)
                            .filter(([k]) => k.startsWith(`${prod.id}-`))
                            .reduce((acc, [, q]) => acc + q, 0);
                          
                          if (total === 0) return null;

                          // Group by flavor
                          const flavorCounts: Record<string, { P: number, G: number }> = {};
                          
                          Object.entries(cart).forEach(([k, q]) => {
                            if (!k.startsWith(`${prod.id}-`) || q <= 0) return;
                            const parts = k.split('-');
                            // Format: ID-Flavor-Size
                            // But flavor might contain hyphens, so we need to be careful
                            // Last part is always Size (P or G)
                            const size = parts[parts.length - 1];
                            const flavor = parts.slice(1, parts.length - 1).join('-');
                            
                            if (!flavorCounts[flavor]) flavorCounts[flavor] = { P: 0, G: 0 };
                            if (size === 'P') flavorCounts[flavor].P += q;
                            if (size === 'G') flavorCounts[flavor].G += q;
                          });

                          // Show concise summary
                          return (
                            <div className="flex flex-col items-center gap-0.5 w-full px-1">
                              {Object.entries(flavorCounts).slice(0, 3).map(([flavor, counts]) => (
                                <span key={flavor} className="text-[10px] font-bold text-white drop-shadow-lg leading-tight text-center bg-black/40 px-1 rounded w-full truncate">
                                  {flavor}: {counts.P > 0 ? `${counts.P}P` : ''} {counts.G > 0 ? `${counts.G}G` : ''}
                                </span>
                              ))}
                              {Object.keys(flavorCounts).length > 3 && (
                                <span className="text-[10px] text-white">+{Object.keys(flavorCounts).length - 3} mais...</span>
                              )}
                            </div>
                          );
                        }

                        if (tipo === 'combinado') {
                          // Calculate total combined items
                          const combinedCount = Object.keys(cart).filter(k => k.startsWith(`${prod.id}-COMBINADO-`)).reduce((acc, k) => acc + cart[k], 0);
                          
                          if (combinedCount === 0) return null;
                          return <span className="text-4xl font-bold text-white drop-shadow-lg">{combinedCount}</span>;
                        }

                        if (tipo === 'sabores' && prod.sabores) {
                          const total = Object.entries(cart)
                            .filter(([k]) => k.startsWith(`${prod.id}-`))
                            .reduce((acc, [, q]) => acc + q, 0);
                          
                          if (total === 0) return null;

                          // Show breakdown if <= 2 items, otherwise show total
                          const items = Object.entries(cart)
                            .filter(([k]) => k.startsWith(`${prod.id}-`) && cart[k] > 0);
                          
                          if (items.length <= 2) {
                             return items.map(([k, q]) => {
                               const flavor = k.split('-').slice(1).join('-'); // Rejoin in case flavor has hyphen
                               return (
                                <span key={k} className="text-xs font-bold text-white drop-shadow-lg leading-tight text-center">
                                  {q}x {flavor.substring(0, 10)}{flavor.length > 10 ? '...' : ''}
                                </span>
                               );
                             });
                          }
                          
                          return <span className="text-4xl font-bold text-white drop-shadow-lg">{total}</span>;
                        }

                        if (tipo === 'tamanho_pg') {
                          return (
                            <>
                              {cart[`${prod.id}-P`] > 0 && (
                                <span className="text-xl font-bold text-white drop-shadow-lg leading-none whitespace-nowrap">
                                  {cart[`${prod.id}-P`]} P
                                </span>
                              )}
                              {cart[`${prod.id}-G`] > 0 && (
                                <span className="text-xl font-bold text-white drop-shadow-lg leading-none whitespace-nowrap">
                                  {cart[`${prod.id}-G`]} G
                                </span>
                              )}
                            </>
                          );
                        }

                        // Default
                        return <span className="text-4xl font-bold text-white drop-shadow-lg">{qty}</span>;
                      })()}
                    </div>
                  )}
                </div>

                {/* Name */}
                <div className="px-1 py-2 flex items-center justify-center min-h-[2.5rem]">
                  <h3 className={clsx(
                    "text-[10px] font-bold leading-tight text-center break-words whitespace-normal uppercase",
                    qty > 0 ? "text-blue-400" : "text-zinc-300"
                  )}>
                    {prod.nome}
                  </h3>
                </div>

                {/* Decrement Button (Only visible if > 0) */}
                {qty > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveProduct(prod.id!);
                    }}
                    className="absolute top-1 right-1 w-6 h-6 bg-red-500/90 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            );
          })}
          
          {filteredProducts?.length === 0 && (
            <div className="col-span-3 text-center py-12 text-zinc-500">
              Nenhum produto encontrado.
              <br />
              <span className="text-sm">Gerencie o cardápio na tela inicial.</span>
            </div>
          )}
        </div>
      </div>

      {/* Floating Action Button / Bar */}
      {totalItems > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-20">
          <button
            onClick={() => setShowConfirmation(true)}
            className="w-full bg-blue-600 text-white font-bold text-lg py-4 rounded-xl shadow-lg shadow-blue-900/40 active:scale-[0.98] transition-transform flex items-center justify-center gap-3"
          >
            <ShoppingCart size={24} />
            <span>Salvar {totalItems} item(s)</span>
          </button>
        </div>
      )}

      {/* Size Selection Modal */}
      {selectedProductForSize && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 w-full max-w-sm rounded-2xl p-6 border border-zinc-800 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">{selectedProductForSize.nome}</h2>
                <p className="text-zinc-400 text-sm">Selecione o tamanho</p>
              </div>
              <button 
                onClick={() => setSelectedProductForSize(null)} 
                className="text-zinc-400 hover:text-white p-2 -mr-2 -mt-2"
              >
                <X size={24} />
              </button>
            </div>

            <div className="mb-6 overflow-y-auto max-h-[60vh] -mx-2 px-2">
              {(() => {
                const tipo = selectedProductForSize.tipoOpcao || (selectedProductForSize.temOpcaoTamanho ? 'tamanho_pg' : 'padrao');

                if (tipo === 'refrigerante') {
                  return (
                    <div className="space-y-3">
                      {['Lata', 'Litro', 'KS'].map(container => (
                        <div key={container} className="bg-zinc-950 border border-zinc-800 rounded-xl p-3">
                          <h3 className="text-zinc-400 font-bold mb-3 uppercase text-xs tracking-wider border-b border-zinc-800 pb-2">
                            {container}
                          </h3>
                          <div className="grid grid-cols-2 gap-3">
                            {['Normal', 'Zero'].map(variant => {
                              const sizeKey = `${container}-${variant}`;
                              const qty = cart[`${selectedProductForSize.id}-${sizeKey}`] || 0;
                              
                              return (
                                <div key={variant} className={clsx(
                                  "rounded-lg p-2 flex flex-col items-center border transition-colors",
                                  qty > 0 ? "bg-blue-900/20 border-blue-600/50" : "bg-zinc-900 border-zinc-800"
                                )}>
                                  <span className={clsx(
                                    "text-sm font-bold mb-2",
                                    variant === 'Zero' ? "text-green-400" : "text-white"
                                  )}>{variant}</span>
                                  
                                  {qty > 0 ? (
                                    <div className="flex items-center gap-2 w-full justify-center">
                                      <button 
                                        onClick={() => handleUpdateQuantity(selectedProductForSize.id!, -1, sizeKey)}
                                        className="w-8 h-8 rounded-full bg-zinc-800 text-zinc-400 flex items-center justify-center active:scale-90 transition-transform"
                                      >
                                        <Minus size={16} />
                                      </button>
                                      <span className="text-lg font-bold text-white min-w-[1.5rem] text-center">{qty}</span>
                                      <button 
                                        onClick={() => handleUpdateQuantity(selectedProductForSize.id!, 1, sizeKey)}
                                        className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center active:scale-90 transition-transform"
                                      >
                                        <Plus size={16} />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => handleUpdateQuantity(selectedProductForSize.id!, 1, sizeKey)}
                                      className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold py-1.5 rounded-lg transition-colors active:scale-95 text-sm"
                                    >
                                      Adicionar
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                }

                if (tipo === 'sabores_com_tamanho' && selectedProductForSize.sabores) {
                  return (
                    <div className="space-y-4">
                      {selectedProductForSize.sabores.map(sabor => {
                        const keyP = `${sabor}-P`;
                        const keyG = `${sabor}-G`;
                        const qtyP = cart[`${selectedProductForSize.id}-${keyP}`] || 0;
                        const qtyG = cart[`${selectedProductForSize.id}-${keyG}`] || 0;
                        
                        return (
                          <div key={sabor} className={clsx(
                            "bg-zinc-950 border rounded-xl p-3 flex flex-col gap-3",
                            (qtyP > 0 || qtyG > 0) ? "border-blue-500/50 bg-blue-900/10" : "border-zinc-800"
                          )}>
                            <span className="text-sm font-bold text-white text-center leading-tight border-b border-zinc-800 pb-2">{sabor}</span>
                            
                            <div className="grid grid-cols-2 gap-3">
                              {/* Tamanho P */}
                              <div className="flex flex-col items-center gap-1">
                                <span className="text-xs text-zinc-400 font-bold">Pequeno (P)</span>
                                {qtyP > 0 ? (
                                  <div className="flex items-center gap-2">
                                    <button 
                                      onClick={() => handleUpdateQuantity(selectedProductForSize.id!, -1, keyP)}
                                      className="w-8 h-8 rounded-full bg-zinc-800 text-zinc-400 flex items-center justify-center active:scale-90 transition-transform"
                                    >
                                      <Minus size={16} />
                                    </button>
                                    <span className="text-lg font-bold text-white w-4 text-center">{qtyP}</span>
                                    <button 
                                      onClick={() => handleUpdateQuantity(selectedProductForSize.id!, 1, keyP)}
                                      className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center active:scale-90 transition-transform"
                                    >
                                      <Plus size={16} />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handleUpdateQuantity(selectedProductForSize.id!, 1, keyP)}
                                    className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold py-1.5 rounded-lg transition-colors active:scale-95 text-xs"
                                  >
                                    Adicionar
                                  </button>
                                )}
                              </div>

                              {/* Tamanho G */}
                              <div className="flex flex-col items-center gap-1">
                                <span className="text-xs text-zinc-400 font-bold">Grande (G)</span>
                                {qtyG > 0 ? (
                                  <div className="flex items-center gap-2">
                                    <button 
                                      onClick={() => handleUpdateQuantity(selectedProductForSize.id!, -1, keyG)}
                                      className="w-8 h-8 rounded-full bg-zinc-800 text-zinc-400 flex items-center justify-center active:scale-90 transition-transform"
                                    >
                                      <Minus size={16} />
                                    </button>
                                    <span className="text-lg font-bold text-white w-4 text-center">{qtyG}</span>
                                    <button 
                                      onClick={() => handleUpdateQuantity(selectedProductForSize.id!, 1, keyG)}
                                      className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center active:scale-90 transition-transform"
                                    >
                                      <Plus size={16} />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handleUpdateQuantity(selectedProductForSize.id!, 1, keyG)}
                                    className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold py-1.5 rounded-lg transition-colors active:scale-95 text-xs"
                                  >
                                    Adicionar
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                }

                if (tipo === 'combinado' && selectedProductForSize.sabores) {
                  return (
                    <div className="flex flex-col h-full">
                      <div className="flex-1 space-y-2 mb-4">
                        <p className="text-sm text-zinc-400 text-center mb-2">Selecione os sabores para compor o item:</p>
                        {selectedProductForSize.sabores.map(sabor => {
                          const isSelected = selectedFlavorsForCombo.includes(sabor);
                          return (
                            <button
                              key={sabor}
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedFlavorsForCombo(prev => prev.filter(s => s !== sabor));
                                } else {
                                  setSelectedFlavorsForCombo(prev => [...prev, sabor]);
                                }
                              }}
                              className={clsx(
                                "w-full p-4 rounded-xl border flex items-center justify-between transition-all",
                                isSelected 
                                  ? "bg-blue-600/20 border-blue-500 text-white" 
                                  : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-900"
                              )}
                            >
                              <span className="font-bold">{sabor}</span>
                              {isSelected && <Check size={20} className="text-blue-400" />}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        onClick={handleAddCombinedItem}
                        disabled={selectedFlavorsForCombo.length === 0}
                        className="w-full bg-blue-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-bold py-3 rounded-xl active:scale-[0.98] transition-all shadow-lg flex items-center justify-center gap-2"
                      >
                        <Plus size={20} />
                        Adicionar Combinado ({selectedFlavorsForCombo.length})
                      </button>
                    </div>
                  );
                }

                if (tipo === 'sabores' && selectedProductForSize.sabores) {
                  return (
                    <div className="grid grid-cols-2 gap-3">
                      {selectedProductForSize.sabores.map(sabor => {
                        const qty = cart[`${selectedProductForSize.id}-${sabor}`] || 0;
                        return (
                          <div key={sabor} className={clsx(
                            "bg-zinc-950 border rounded-xl p-3 flex flex-col items-center justify-between min-h-[6rem]",
                            qty > 0 ? "border-blue-500/50 bg-blue-900/10" : "border-zinc-800"
                          )}>
                            <span className="text-sm font-bold text-white text-center mb-2 leading-tight">{sabor}</span>
                            
                            {qty > 0 ? (
                              <div className="flex items-center gap-3 w-full justify-center mt-auto">
                                <button 
                                  onClick={() => handleUpdateQuantity(selectedProductForSize.id!, -1, sabor)}
                                  className="w-8 h-8 rounded-full bg-zinc-800 text-zinc-400 flex items-center justify-center active:scale-90 transition-transform"
                                >
                                  <Minus size={16} />
                                </button>
                                <span className="text-xl font-bold text-blue-400">{qty}</span>
                                <button 
                                  onClick={() => handleUpdateQuantity(selectedProductForSize.id!, 1, sabor)}
                                  className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center active:scale-90 transition-transform"
                                >
                                  <Plus size={16} />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleUpdateQuantity(selectedProductForSize.id!, 1, sabor)}
                                className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold py-2 rounded-lg transition-colors active:scale-95 text-xs mt-auto"
                              >
                                Adicionar
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                }

                // Default: Tamanho P/G
                return (
                  <div className="grid grid-cols-2 gap-4">
                    {['P', 'G'].map(size => {
                      const qty = cart[`${selectedProductForSize.id}-${size}`] || 0;
                      return (
                        <div key={size} className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex flex-col items-center">
                          <span className="text-4xl font-black text-white mb-2">{size}</span>
                          
                          {qty > 0 ? (
                            <div className="flex items-center gap-3 w-full justify-center">
                              <button 
                                onClick={() => handleUpdateQuantity(selectedProductForSize.id!, -1, size)}
                                className="w-8 h-8 rounded-full bg-zinc-800 text-zinc-400 flex items-center justify-center active:scale-90 transition-transform"
                              >
                                <Minus size={16} />
                              </button>
                              <span className="text-xl font-bold text-blue-400">{qty}</span>
                              <button 
                                onClick={() => handleUpdateQuantity(selectedProductForSize.id!, 1, size)}
                                className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center active:scale-90 transition-transform"
                              >
                                <Plus size={16} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleUpdateQuantity(selectedProductForSize.id!, 1, size)}
                              className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold py-2 rounded-lg transition-colors active:scale-95"
                            >
                              Adicionar
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            <div className="mb-4">
              <label className="text-sm font-medium text-zinc-400 mb-2 block">Observação (Opcional)</label>
              
              {/* Suggestion Chips for Refrigerante */}
              {(selectedProductForSize.tipoOpcao === 'refrigerante' || selectedProductForSize.nome.toLowerCase().includes('coca') || selectedProductForSize.nome.toLowerCase().includes('refri')) && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {['#Gelo', '#S/Gelo', '#Limao', '#S/Limao'].map(sugestao => (
                    <button
                      key={sugestao}
                      onClick={() => {
                        const currentObs = cartObservations[selectedProductForSize.id!] || '';
                        const newObs = currentObs ? `${currentObs} ${sugestao}` : sugestao;
                        setCartObservations(prev => ({
                          ...prev,
                          [selectedProductForSize.id!]: newObs
                        }));
                      }}
                      className="text-xs bg-zinc-800 text-zinc-300 px-3 py-1.5 rounded-full hover:bg-zinc-700 active:bg-blue-600 active:text-white transition-colors"
                    >
                      {sugestao}
                    </button>
                  ))}
                </div>
              )}

              {/* Suggestion Chips for Drinks */}
              {selectedProductForSize.isDrink && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {['#Com Álcool', '#Sem Álcool', '#Pouco Álcool'].map(sugestao => (
                    <button
                      key={sugestao}
                      onClick={() => {
                        const currentObs = cartObservations[selectedProductForSize.id!] || '';
                        const newObs = currentObs ? `${currentObs} ${sugestao}` : sugestao;
                        setCartObservations(prev => ({
                          ...prev,
                          [selectedProductForSize.id!]: newObs
                        }));
                      }}
                      className="text-xs bg-zinc-800 text-zinc-300 px-3 py-1.5 rounded-full hover:bg-zinc-700 active:bg-blue-600 active:text-white transition-colors"
                    >
                      {sugestao}
                    </button>
                  ))}
                </div>
              )}

              <textarea
                value={cartObservations[selectedProductForSize.id!] || ''}
                onChange={e => setCartObservations(prev => ({
                  ...prev,
                  [selectedProductForSize.id!]: e.target.value
                }))}
                placeholder="Ex: Sem cebola, Com gelo..."
                rows={2}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-100 outline-none resize-none focus:ring-2 focus:ring-blue-600/50"
              />
            </div>

            <button
              onClick={() => setSelectedProductForSize(null)}
              className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl active:scale-[0.98] transition-transform"
            >
              Concluir Seleção
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl border border-zinc-800 animate-in fade-in zoom-in duration-200">
            <div className="p-6">
              <h2 className="text-xl font-bold text-white mb-4">Confirmar Pedido?</h2>
              
              <div className="max-h-[50vh] overflow-y-auto space-y-3 mb-6 pr-2">
                {getSelectedProductsList().map(item => (
                  <div key={item.key} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                    <div className="flex items-center gap-3">
                      {item.product.foto ? (
                        <img src={item.product.foto} alt="" className="w-10 h-10 rounded-lg object-cover bg-zinc-800" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-500">
                          <ImageIcon size={16} />
                        </div>
                      )}
                      <div>
                        <span className="font-medium text-zinc-200 block leading-tight">{item.product.nome}</span>
                        {item.size && (
                          <span className="text-xs font-bold text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded mt-1 inline-block">
                            Tamanho {item.size}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="font-bold text-zinc-100 bg-zinc-800 px-3 py-1 rounded-lg whitespace-nowrap">
                      {item.quantity}x
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmation(false)}
                  className="flex-1 py-3 px-4 rounded-xl font-bold text-zinc-400 bg-zinc-800 hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2"
                >
                  <X size={20} />
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmOrder}
                  className="flex-1 py-3 px-4 rounded-xl font-bold text-white bg-green-600 hover:bg-green-500 transition-colors flex items-center justify-center gap-2"
                >
                  <Check size={20} />
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

