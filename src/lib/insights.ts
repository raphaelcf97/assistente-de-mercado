// Cálculos da aba de Insights.
//
// Tudo aqui é função pura sobre linhas cruas do banco — sem Supabase, sem
// React — pra que cada conta possa ser testada isoladamente. Insight errado
// é pior que insight nenhum: ele parece uma informação.

import { paraBase, type UnidadeBase } from "@/lib/preco-unitario";
import { normalizarNome } from "@/lib/matching";

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

// Produtos que aparecem na nota mas não fazem sentido rastrear por preço:
// sacola é cobrada por unidade e não é algo que valha comparar entre
// mercados ou acompanhar variação — é ruído nos insights de preço, embora
// o valor gasto nela continue contando normalmente no total da compra.
const IGNORADOS_EM_INSIGHTS_DE_PRECO = ["sacola"];

function ehIgnoradoEmPreco(nomeProduto: string): boolean {
  const normalizado = normalizarNome(nomeProduto);
  return IGNORADOS_EM_INSIGHTS_DE_PRECO.some((termo) => normalizado.includes(termo));
}

// Um item só entra nas contas de preço se dá pra convertê-lo para uma base
// comparável. Item sem medida informada fica de fora — não dá pra dizer se
// R$8,90 é caro sem saber de quanto.
type ItemNormalizado = ItemBruto & { base: number; unidadeBase: UnidadeBase };

function normalizar(itens: ItemBruto[]): ItemNormalizado[] {
  const saida: ItemNormalizado[] = [];
  for (const item of itens) {
    if (ehIgnoradoEmPreco(item.produto_nome)) continue;
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

// ── 7. Ritmo do ciclo atual de cada vale ─────────────────────────────────
//
// Nem o início nem o fim do balanço usam o calendário civil: começa na
// última recarga e termina na próxima, porque é esse o intervalo em que o
// dinheiro da carteira de fato circula.

// Próxima ocorrência do dia de recarga a partir de hoje. Se hoje já é o
// dia da recarga, considera que ela é hoje (0 dias faltando) em vez de
// pular pro mês seguinte.
function proximaRecarga(hoje: Date, diaDoMes: number): Date {
  const hojeMeiaNoite = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  let alvo = new Date(hoje.getFullYear(), hoje.getMonth(), diaDoMes);
  if (alvo.getTime() < hojeMeiaNoite.getTime()) {
    alvo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, diaDoMes);
  }
  return alvo;
}

function diasEntre(inicio: Date, fim: Date): number {
  const MS_POR_DIA = 24 * 60 * 60 * 1000;
  return Math.round((fim.getTime() - inicio.getTime()) / MS_POR_DIA);
}

// O alternador Mensal/Total do resto da página usa esse mesmo corte de
// "última recarga", agora entre QUALQUER carteira (não uma só, como no
// ritmo acima) — a pergunta ali é "desde quando o dinheiro que estou
// gastando agora entrou", não "desde quando essa carteira específica
// recarregou". Cobre o caso descrito pelo usuário: o vale recarrega
// alguns dias antes da virada do mês, com o valor já "referente ao mês
// seguinte" — nesse dia, pra ele, o "mês" que está em curso já mudou,
// mesmo que o calendário ainda não tenha virado a página.
export function inicioDoPeriodoAtual(
  transacoes: { tipo: string; data: string }[],
  hoje = new Date()
): string | null {
  const hojeISO = hoje.toLocaleDateString("sv-SE");
  const recargas = transacoes
    .filter((t) => t.tipo === "recarga" && t.data <= hojeISO)
    .sort((a, b) => b.data.localeCompare(a.data));
  return recargas[0]?.data ?? null;
}

export type RitmoCarteira = {
  carteira: string;
  entrou: number;
  saiu: number;
  saldo: number;
  diasRestantes: number;
  porDiaRestante: number | null;
  recargaConfigurada: boolean;
  inicioCiclo: string | null; // data da última recarga, ou null se nunca recarregou
};

// Antes isso somava "entrou"/"saiu" desde o dia 1º do mês civil, que não
// tem nenhuma relação com o ciclo real da carteira: se a recarga cai dia
// 22 e hoje é dia 22, o gasto de dias 1-21 pertence ao ciclo ANTERIOR
// (pago pela recarga de julho), não a este. Misturar os dois no mesmo
// balde fazia o "ritmo" parecer errado mesmo quando não estava.
//
// A referência certa é a última recarga registrada: o ciclo atual começa
// nela e vai até a próxima. Sem nenhuma recarga no histórico ainda, cai no
// histórico inteiro por falta de um marco pra cortar.
export function ritmoDoCiclo(
  transacoes: { carteira: string; tipo: string; valor: number; data: string }[],
  saldos: Record<string, number>,
  diasRecarga: Record<string, number>,
  carteiras: string[],
  hoje = new Date()
): RitmoCarteira[] {
  const hojeISO = hoje.toLocaleDateString("sv-SE");
  const hojeMeiaNoite = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

  return carteiras.map((carteira) => {
    const daCarteira = transacoes.filter((t) => t.carteira === carteira);

    const ultimaRecarga = daCarteira
      .filter((t) => t.tipo === "recarga" && t.data <= hojeISO)
      .sort((a, b) => b.data.localeCompare(a.data))[0];
    const inicioCiclo = ultimaRecarga?.data ?? null;

    const doCiclo = inicioCiclo ? daCarteira.filter((t) => t.data >= inicioCiclo) : daCarteira;
    const entrou = doCiclo.filter((t) => t.valor > 0).reduce((s, t) => s + t.valor, 0);
    const saiu = doCiclo.filter((t) => t.valor < 0).reduce((s, t) => s + Math.abs(t.valor), 0);
    const saldo = saldos[carteira] ?? 0;

    // sem dia de recarga configurado (ainda não veio nenhuma), não há
    // "próxima recarga" pra contar
    const diaDoMes = diasRecarga[carteira];
    const diasRestantes = diaDoMes
      ? Math.max(0, diasEntre(hojeMeiaNoite, proximaRecarga(hoje, diaDoMes)))
      : 0;

    return {
      carteira,
      entrou,
      saiu,
      saldo,
      diasRestantes,
      porDiaRestante: diaDoMes && diasRestantes > 0 ? saldo / diasRestantes : null,
      recargaConfigurada: Boolean(diaDoMes),
      inicioCiclo,
    };
  });
}
