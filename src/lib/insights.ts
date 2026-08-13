// Cálculos da aba de Insights.
//
// Tudo aqui é função pura sobre linhas cruas do banco — sem Supabase, sem
// React — pra que cada conta possa ser testada isoladamente. Insight errado
// é pior que insight nenhum: ele parece uma informação.

import { paraBase, type UnidadeBase } from "@/lib/preco-unitario";

export type ItemBruto = {
  produto_id: string;
  produto_nome: string;
  mercado_id: string;
  mercado_nome: string;
  data: string; // YYYY-MM-DD
  quantidade: number;
  unidade: string | null;
  preco_total: number;
};

export type CompraBruta = {
  data: string;
  valor_total: number;
  categoria: string;
  carteira: string;
  mercado_nome: string;
};

// Um item só entra nas contas de preço se dá pra convertê-lo para uma base
// comparável. Item sem medida informada fica de fora — não dá pra dizer se
// R$8,90 é caro sem saber de quanto.
type ItemNormalizado = ItemBruto & { base: number; unidadeBase: UnidadeBase };

function normalizar(itens: ItemBruto[]): ItemNormalizado[] {
  const saida: ItemNormalizado[] = [];
  for (const item of itens) {
    if (!item.unidade || !item.quantidade || item.quantidade <= 0) continue;
    const base = paraBase(item.quantidade, item.unidade);
    if (!base || base.quantidade <= 0) continue;
    saida.push({ ...item, base: base.quantidade, unidadeBase: base.unidade });
  }
  return saida;
}

function agrupar<T>(lista: T[], chave: (item: T) => string): Map<string, T[]> {
  const mapa = new Map<string, T[]>();
  for (const item of lista) {
    const k = chave(item);
    const atual = mapa.get(k) ?? [];
    atual.push(item);
    mapa.set(k, atual);
  }
  return mapa;
}

// ── 1. Onde cada produto sai mais barato ────────────────────────────────
//
// O insight mais acionável do app: só aparece para produtos comprados em
// mais de um mercado, porque é aí que existe escolha a fazer.

export type PrecoNoMercado = { mercado: string; preco: number; compras: number };

export type ComparativoProduto = {
  produto_id: string;
  produto: string;
  unidade: UnidadeBase;
  mercados: PrecoNoMercado[]; // ordenado do mais barato pro mais caro
  diferencaPct: number;
};

export function comparativoMercados(itens: ItemBruto[]): ComparativoProduto[] {
  const resultado: ComparativoProduto[] = [];

  for (const [, doProduto] of agrupar(normalizar(itens), (i) => i.produto_id)) {
    // se o produto foi comprado ora por peso ora por unidade, compara só
    // dentro da base predominante
    const porBase = agrupar(doProduto, (i) => i.unidadeBase);
    const [unidadeBase, itensDaBase] = [...porBase.entries()].sort(
      (a, b) => b[1].length - a[1].length
    )[0];

    const porMercado = agrupar(itensDaBase, (i) => i.mercado_id);
    if (porMercado.size < 2) continue;

    const mercados: PrecoNoMercado[] = [];
    for (const [, noMercado] of porMercado) {
      const gasto = noMercado.reduce((s, i) => s + i.preco_total, 0);
      const quantidade = noMercado.reduce((s, i) => s + i.base, 0);
      if (quantidade <= 0) continue;
      mercados.push({
        mercado: noMercado[0].mercado_nome,
        preco: gasto / quantidade,
        compras: noMercado.length,
      });
    }
    if (mercados.length < 2) continue;

    mercados.sort((a, b) => a.preco - b.preco);
    const barato = mercados[0].preco;
    const caro = mercados[mercados.length - 1].preco;
    if (barato <= 0) continue;

    resultado.push({
      produto_id: doProduto[0].produto_id,
      produto: doProduto[0].produto_nome,
      unidade: unidadeBase as UnidadeBase,
      mercados,
      diferencaPct: (caro / barato - 1) * 100,
    });
  }

  // maior diferença primeiro — é onde a escolha de mercado pesa mais
  return resultado.sort((a, b) => b.diferencaPct - a.diferencaPct);
}

// ── 2. Quanto custou não comprar no mais barato ─────────────────────────
//
// Só considera produtos com preço conhecido em mais de um mercado: sem
// alternativa conhecida, não havia escolha a fazer e não faz sentido
// chamar de perda.

export function economiaPotencial(itens: ItemBruto[]): number {
  const normalizados = normalizar(itens);
  const menorPreco = new Map<string, number>();

  for (const comp of comparativoMercados(itens)) {
    menorPreco.set(`${comp.produto_id}|${comp.unidade}`, comp.mercados[0].preco);
  }

  let total = 0;
  for (const item of normalizados) {
    const piso = menorPreco.get(`${item.produto_id}|${item.unidadeBase}`);
    if (piso === undefined) continue;
    const pagoPorUnidade = item.preco_total / item.base;
    if (pagoPorUnidade > piso) total += (pagoPorUnidade - piso) * item.base;
  }
  return total;
}

// ── 3. O que subiu e o que desceu ───────────────────────────────────────
//
// Compara a compra mais recente contra a mais antiga do mesmo produto, na
// mesma base. É a inflação da sua cesta, não a do IBGE.

export type VariacaoProduto = {
  produto_id: string;
  produto: string;
  unidade: UnidadeBase;
  primeiro: number;
  ultimo: number;
  variacaoPct: number;
  dataPrimeiro: string;
  dataUltimo: string;
};

export function variacaoPrecos(itens: ItemBruto[]): VariacaoProduto[] {
  const resultado: VariacaoProduto[] = [];

  for (const [, doProduto] of agrupar(normalizar(itens), (i) => i.produto_id)) {
    const porBase = agrupar(doProduto, (i) => i.unidadeBase);
    const [unidadeBase, itensDaBase] = [...porBase.entries()].sort(
      (a, b) => b[1].length - a[1].length
    )[0];

    const datas = [...new Set(itensDaBase.map((i) => i.data))].sort();
    if (datas.length < 2) continue;

    const precoNaData = (data: string) => {
      const naData = itensDaBase.filter((i) => i.data === data);
      const gasto = naData.reduce((s, i) => s + i.preco_total, 0);
      const quantidade = naData.reduce((s, i) => s + i.base, 0);
      return quantidade > 0 ? gasto / quantidade : null;
    };

    const primeiro = precoNaData(datas[0]);
    const ultimo = precoNaData(datas[datas.length - 1]);
    if (primeiro === null || ultimo === null || primeiro <= 0) continue;

    resultado.push({
      produto_id: doProduto[0].produto_id,
      produto: doProduto[0].produto_nome,
      unidade: unidadeBase as UnidadeBase,
      primeiro,
      ultimo,
      variacaoPct: (ultimo / primeiro - 1) * 100,
      dataPrimeiro: datas[0],
      dataUltimo: datas[datas.length - 1],
    });
  }

  return resultado.sort((a, b) => Math.abs(b.variacaoPct) - Math.abs(a.variacaoPct));
}

// ── 4. Para onde vai o dinheiro ─────────────────────────────────────────

export type Fatia = { rotulo: string; valor: number; pct: number };

function fatias(entradas: Map<string, number>): Fatia[] {
  const total = [...entradas.values()].reduce((s, v) => s + v, 0);
  if (total <= 0) return [];
  return [...entradas.entries()]
    .map(([rotulo, valor]) => ({ rotulo, valor, pct: (valor / total) * 100 }))
    .sort((a, b) => b.valor - a.valor);
}

export function gastoPorCategoria(compras: CompraBruta[]): Fatia[] {
  const mapa = new Map<string, number>();
  for (const c of compras) mapa.set(c.categoria, (mapa.get(c.categoria) ?? 0) + c.valor_total);
  return fatias(mapa);
}

export function gastoPorEstabelecimento(compras: CompraBruta[]): Fatia[] {
  const mapa = new Map<string, number>();
  for (const c of compras) mapa.set(c.mercado_nome, (mapa.get(c.mercado_nome) ?? 0) + c.valor_total);
  return fatias(mapa);
}

// ── 5. Gasto por dia da semana ──────────────────────────────────────────
//
// O usuário perguntou "qual fim de semana gastei mais" — esse é o recorte
// que responde de forma estável, acumulando todos os sábados juntos.

export const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function gastoPorDiaSemana(compras: CompraBruta[]): { dia: string; valor: number }[] {
  const totais = new Array(7).fill(0);
  for (const c of compras) {
    // meio-dia evita que o fuso empurre a data pro dia anterior
    const d = new Date(`${c.data}T12:00:00`);
    if (Number.isNaN(d.getTime())) continue;
    totais[d.getDay()] += c.valor_total;
  }
  return DIAS.map((dia, i) => ({ dia, valor: totais[i] }));
}

// ── 6. Os produtos que mais pesam na conta ──────────────────────────────

export type ProdutoNaCesta = {
  produto_id: string;
  produto: string;
  gasto: number;
  compras: number;
  pct: number;
};

export function cestaPrincipal(itens: ItemBruto[], limite = 8): ProdutoNaCesta[] {
  const total = itens.reduce((s, i) => s + i.preco_total, 0);
  if (total <= 0) return [];

  const resultado: ProdutoNaCesta[] = [];
  for (const [produto_id, doProduto] of agrupar(itens, (i) => i.produto_id)) {
    const gasto = doProduto.reduce((s, i) => s + i.preco_total, 0);
    resultado.push({
      produto_id,
      produto: doProduto[0].produto_nome,
      gasto,
      compras: doProduto.length,
      pct: (gasto / total) * 100,
    });
  }
  return resultado.sort((a, b) => b.gasto - a.gasto).slice(0, limite);
}

// ── 7. Ritmo do vale no mês corrente ────────────────────────────────────

export type RitmoCarteira = {
  carteira: string;
  entrou: number;
  saiu: number;
  saldo: number;
  diasRestantes: number;
  porDiaRestante: number | null;
};

export function ritmoDoMes(
  transacoes: { carteira: string; valor: number; data: string }[],
  saldos: Record<string, number>,
  carteiras: string[],
  hoje = new Date()
): RitmoCarteira[] {
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();
  const primeiroDia = new Date(ano, mes, 1).toLocaleDateString("sv-SE");
  const ultimoDiaMes = new Date(ano, mes + 1, 0).getDate();
  const diasRestantes = Math.max(0, ultimoDiaMes - hoje.getDate());

  return carteiras.map((carteira) => {
    const doMes = transacoes.filter((t) => t.carteira === carteira && t.data >= primeiroDia);
    const entrou = doMes.filter((t) => t.valor > 0).reduce((s, t) => s + t.valor, 0);
    const saiu = doMes.filter((t) => t.valor < 0).reduce((s, t) => s + Math.abs(t.valor), 0);
    const saldo = saldos[carteira] ?? 0;
    return {
      carteira,
      entrou,
      saiu,
      saldo,
      diasRestantes,
      porDiaRestante: diasRestantes > 0 ? saldo / diasRestantes : null,
    };
  });
}
