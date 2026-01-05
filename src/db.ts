import Dexie, { Table } from 'dexie';

export interface Mesa {
  id: string;
  numero: number;
  pessoas?: number;
  observacao?: string;
  abertaEm: string; // ISO String
  fechadaEm?: string | null; // ISO String
  status: 'aberta' | 'em_andamento' | 'finalizando' | 'fechada';
  statusLancamento?: 'lancado' | 'esperando_lancamento';
  totalEstimado: number; // To make listing easier
  pagamento?: string;
}

export interface ItemPedido {
  id: string;
  mesaId: string;
  descricao: string;
  quantidade: number;
  valor: number;
  observacao?: string;
  entregue: boolean;
  cancelado?: boolean;
  lancado?: boolean;
  criadoEm: string; // ISO String
}

export class GarcomDatabase extends Dexie {
  mesas!: Table<Mesa>;
  itens!: Table<ItemPedido>;
  produtos!: Table<Produto>;

  constructor() {
    super('GarcomAppDB');
    this.version(1).stores({
      mesas: 'id, numero, status, abertaEm',
      itens: 'id, mesaId, criadoEm',
      produtos: '++id, nome, favorito'
    });
    
    // Add ultimoUso index in version 2
    this.version(2).stores({
      produtos: '++id, nome, favorito, ultimoUso'
    });

    // Add foto index in version 3
    this.version(3).stores({
      produtos: '++id, nome, favorito, ultimoUso, foto'
    });

    // Add temOpcaoTamanho in version 4
    this.version(4).stores({
      produtos: '++id, nome, favorito, ultimoUso, foto, temOpcaoTamanho'
    });

    // Add tipoOpcao in version 5
    this.version(5).stores({
      produtos: '++id, nome, favorito, ultimoUso, foto, temOpcaoTamanho, tipoOpcao'
    });

    // Add sabores in version 6
    this.version(6).stores({
      produtos: '++id, nome, favorito, ultimoUso, foto, temOpcaoTamanho, tipoOpcao, sabores'
    });

    // Version 7: Just update type definition, schema is same as v6 since fields exist
    this.version(7).stores({
      produtos: '++id, nome, favorito, ultimoUso, foto, temOpcaoTamanho, tipoOpcao, sabores'
    });

    // Version 8: Same schema, type update for 'combinado'
    this.version(8).stores({
      produtos: '++id, nome, favorito, ultimoUso, foto, temOpcaoTamanho, tipoOpcao, sabores'
    });

    // Version 9: Add statusLancamento to mesas
    this.version(9).stores({
      mesas: 'id, numero, status, abertaEm, statusLancamento'
    });

    // Version 10: Add lancado to itens
    this.version(10).stores({
      itens: 'id, mesaId, criadoEm, lancado'
    });


    // Handle database upgrades when multiple tabs are open
    this.on('versionchange', () => {
      this.close();
      window.location.reload();
      return false;
    });
  }
}

export interface Produto {
  id?: number;
  nome: string;
  preco: number;
  favorito: boolean;
  ultimoUso: string;
  foto?: string; // Base64 string
  temOpcaoTamanho?: boolean; // @deprecated use tipoOpcao
  tipoOpcao?: 'padrao' | 'tamanho_pg' | 'refrigerante' | 'sabores' | 'sabores_com_tamanho' | 'combinado';
  sabores?: string[];
  isDrink?: boolean;
}

export const db = new GarcomDatabase();
