export type Mercado = {
  id: string;
  nome: string;
  apelido: string | null;
  created_at: string;
};

export type Produto = {
  id: string;
  nome_canonico: string;
  unidade_padrao: string | null;
  created_at: string;
};

export type ProdutoAlias = {
  id: string;
  produto_id: string;
  nome_alias: string;
  created_at: string;
};

export type Compra = {
  id: string;
  mercado_id: string;
  data_compra: string;
  valor_total: number;
  forma_pagamento_detectada: string | null;
  pago_vale_alimentacao: boolean;
  foto_url: string | null;
  created_at: string;
};

export type ItemCompra = {
  id: string;
  compra_id: string;
  produto_id: string;
  nome_lido_na_nota: string;
  quantidade: number;
  unidade: string | null;
  preco_unitario: number | null;
  preco_total: number;
};

export type ValeConfig = {
  id: 1;
  valor_recarga: number;
  dia_do_mes: number;
  ativo: boolean;
};

export type ValeTransacaoTipo = "recarga" | "compra" | "ajuste";

export type ValeTransacao = {
  id: string;
  tipo: ValeTransacaoTipo;
  valor: number;
  data: string;
  compra_id: string | null;
  descricao: string | null;
  created_at: string;
};

export type HistoricoPrecoLinha = {
  produto_id: string;
  mercado_id: string;
  mercado_nome: string;
  preco_medio: number;
  quantidade_compras: number;
  ultima_compra: string;
};

// ── Estruturas do fluxo de extração/revisão de compra ──────────────────

export type CampoIncerto = "mercado" | "data_compra" | "valor_total" | "forma_pagamento" | `item_${number}`;

export type ItemExtraidoStatus = "novo" | "match_exato" | "match_parecido";

export type ItemExtraido = {
  nome_lido_na_nota: string;
  quantidade: number;
  unidade: string | null;
  preco_unitario: number | null;
  preco_total: number;
  status: ItemExtraidoStatus;
  produto_id: string | null; // preenchido se match_exato
  sugestao_produto_id: string | null; // preenchido se match_parecido
  sugestao_produto_nome: string | null;
};

export type CompraExtraida = {
  mercado_nome: string;
  mercado_id: string | null; // preenchido se mercado já existe
  data_compra: string | null;
  forma_pagamento_detectada: string | null;
  valor_total: number | null;
  itens: ItemExtraido[];
  campos_incertos: CampoIncerto[];
};

// ── Payload de confirmação (envio final para salvar a compra) ──────────

export type ItemConfirmado = {
  nome_lido_na_nota: string;
  quantidade: number;
  unidade: string | null;
  preco_unitario: number | null;
  preco_total: number;
  produto_id: string | null; // preenchido se vinculado a produto existente
  novo_produto_nome: string | null; // preenchido se cria produto novo
};

export type CompraConfirmada = {
  mercado_nome: string;
  mercado_id: string | null;
  data_compra: string;
  valor_total: number;
  forma_pagamento_detectada: string | null;
  pago_vale_alimentacao: boolean;
  itens: ItemConfirmado[];
};
