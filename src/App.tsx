import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Home } from './pages/Home';
import { NovaMesa } from './pages/NovaMesa';
import { DetalhesMesa } from './pages/DetalhesMesa';
import { NovoPedido } from './pages/NovoPedido';
import { FecharMesa } from './pages/FecharMesa';
import { Historico } from './pages/Historico';
import { GerenciarProdutos } from './pages/GerenciarProdutos';

function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/produtos" element={<GerenciarProdutos />} />
          <Route path="/mesa/nova" element={<NovaMesa />} />
          <Route path="/mesa/:id" element={<DetalhesMesa />} />
          <Route path="/mesa/:id/pedido" element={<NovoPedido />} />
          <Route path="/mesa/:id/pedido/:itemId" element={<NovoPedido />} />
          <Route path="/mesa/:id/fechar" element={<FecharMesa />} />
          <Route path="/historico" element={<Historico />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
