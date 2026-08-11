export type UnidadeMedida = "kg" | "g" | "L" | "ml" | "un";

export const UNIDADES: UnidadeMedida[] = ["kg", "g", "L", "ml", "un"];

export type ItemNotaBruto = {
  nome: string;
  quantidade: number;
  unidade: UnidadeMedida | null;
  preco_unitario: number | null;
  preco_total: number;
};

export type NotaFiscalExtraidaBruta = {
  mercado_nome: string;
  data_compra: string | null;
  forma_pagamento_detectada: string | null;
  valor_total: number | null;
  itens: ItemNotaBruto[];
  campos_incertos: string[];
};

// Extrai mercado/data/itens/valores de um texto cru de OCR usando
// heurísticas de layout comum de cupom fiscal brasileiro. Como não há
// nenhum entendimento semântico por trás (é OCR genérico, não IA), a
// extração é propositalmente conservadora: qualquer coisa que não bater
// num padrão reconhecível vira campo incerto, para o usuário revisar.

function paraNumero(texto: string): number {
  return parseFloat(texto.replace(/\./g, "").replace(",", "."));
}

const PADRAO_VALOR = /(\d{1,3}(?:\.\d{3})*,\d{2})/;
const PADRAO_DATA = /(\d{2})[/.\-](\d{2})[/.\-](\d{2,4})/;

// Linhas que nunca são item de produto: totais, dados fiscais, linhas de
// desconto/tributo lançadas logo abaixo do item, e as linhas de forma de
// pagamento.
const LINHAS_IGNORAR =
  /total|desconto|troco|subtotal|cnpj|cpf|cupom|nfc-?e|consumidor|valor pago|valor a pagar|\bpagar\b|documento|obrigad|\bfcp\b|\bicms\b|tributo|acr[eé]scimo|forma de pagamento|pagamento|vale[- ]?(alimenta|refei)|cart[aã]o|d[eé]bito|cr[eé]dito|\bpix\b|dinheiro|\bva\b|\bvr\b/i;

const FORMAS_PAGAMENTO: [RegExp, string][] = [
  [/cart[aã]o[^\n]{0,15}d[eé]bito|d[eé]bito/i, "Cartão de Débito"],
  [/cart[aã]o[^\n]{0,15}cr[eé]dito|cr[eé]dito/i, "Cartão de Crédito"],
  [/\bpix\b/i, "Pix"],
  [/dinheiro/i, "Dinheiro"],
  [/vale[- ]?alimenta[cç][aã]o|\bva\b/i, "Vale Alimentação"],
];

// ── Padrões de item ──────────────────────────────────────────────────────
//
// (A) Layout de atacado, com coluna de embalagem entre a descrição e a
//     quantidade — é o do Atacadão/Assaí e o que mais aparece por aqui:
//       AR087037 REF.PEPSI BLACK PET  1X1,5L  4 UND9  5,69  22,76
//       └código  └descrição           └embal. └qtd    └unit └total
//     O sufixo numérico em "UND9"/"BDJ9" é o código de tributação impresso
//     colado na unidade; entra no padrão pra não quebrar o casamento.
const PADRAO_ITEM_EMBALAGEM =
  /^(.+?)\s+(\d+\s*[xX]\s*\d+(?:[.,]\d+)?\s*[A-Za-z]{0,4})\s+(\d+(?:[.,]\d+)?)\s+([A-Za-z]{1,4})\d?\s+(\d+(?:\.\d{3})*[.,]\d{2})\s+(\d+(?:\.\d{3})*[.,]\d{2})$/;

// (B) Granel, primeira linha: traz nome, peso e preço por quilo.
//       AR085321 FILE MIGNON SUINO   1,518kg x 24,90 RS/kg
//   O "R$" sai impresso/lido como "RS" com frequência, então a moeda antes
//   da barra é opcional e aceita as duas formas.
const PADRAO_GRANEL_CABECALHO =
  /^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(kg|g|lt|l|ml)\s*[xX*]\s*(\d+(?:[.,]\d+)?)\s*(?:R?[S$])?\s*\/\s*(kg|g|lt|l|ml)\b/i;

// (B) Granel, segunda linha: repete a quantidade e fecha com o total.
//       1,518  KG9  X  24,90                       37,80
const PADRAO_GRANEL_TOTAL =
  /^(\d+(?:[.,]\d+)?)\s+([A-Za-z]{1,4})\d?\s+[xX*]\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:\.\d{3})*[.,]\d{2})$/;

// (C) Layout simples: "PRODUTO X   2 UN X 3,50   7,00"
const PADRAO_ITEM_COMPLETO =
  /^(.{3,}?)\s+(\d+(?:[.,]\d+)?)\s*(un|kg|g|l|ml|lt|und|unid|pc|pct|cx)?\s*[xX]\s*(\d+[.,]\d{2})\s+(\d+[.,]\d{2})$/i;

// (D) Último recurso: "PRODUTO X   7,00"
const PADRAO_ITEM_SIMPLES = /^(.{3,}?)\s+(\d+[.,]\d{2})$/;

// Tamanho de embalagem embutido no nome: "REQUEIJAO 300ML", "ARROZ 5KG".
const PADRAO_MEDIDA_NO_NOME = /(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|lt)\b/i;

// Coluna de embalagem isolada: "1X1,5L", "1X30UND", "1X2,4Kg", "1X1KIT".
const PADRAO_EMBALAGEM = /^(\d+)\s*[xX]\s*(\d+(?:[.,]\d+)?)\s*([A-Za-z]{0,4})$/;

// Código de produto no início da descrição ("AR087037 REF.PEPSI ..."). Só
// remove quando o token realmente parece código: alfanumérico, sem
// pontuação, com pelo menos três dígitos — assim "REF.PEPSI" e "ATUM 88"
// não são confundidos com código.
const PADRAO_CODIGO = /^([A-Za-z]{0,4}\d[A-Za-z\d]{3,})\s+/;

function normalizarUnidade(bruta: string | null | undefined): UnidadeMedida | null {
  if (!bruta) return null;
  const u = bruta.trim().toLowerCase();
  if (u === "kg") return "kg";
  if (u === "g" || u === "gr") return "g";
  if (u === "l" || u === "lt") return "L";
  if (u === "ml") return "ml";
  if (["un", "und", "unid", "uni", "pc", "pct", "cx", "bdj", "kit", "pt", "fd"].includes(u)) {
    return "un";
  }
  return null;
}

function limparNome(bruto: string): string {
  let nome = bruto.trim();
  const codigo = nome.match(PADRAO_CODIGO);
  if (codigo && (codigo[1].match(/\d/g) ?? []).length >= 3) {
    nome = nome.slice(codigo[0].length);
  }
  return nome.replace(/\s{2,}/g, " ").trim();
}

function medidaDoNome(nome: string): { valor: number; unidade: UnidadeMedida } | null {
  const m = nome.match(PADRAO_MEDIDA_NO_NOME);
  if (!m) return null;
  const unidade = normalizarUnidade(m[2]);
  if (!unidade || unidade === "un") return null;
  return { valor: paraNumero(m[1]), unidade };
}

// Interpreta a coluna de embalagem ("1X1,5L") como quanto vem em cada
// unidade vendida. "1X2UND" = pacote com 2 unidades; "1X480G" = 480g por
// pacote; "1X1KIT" não tem medida útil e cai em unidade avulsa.
function interpretarEmbalagem(bruta: string): { valor: number; unidade: UnidadeMedida } | null {
  const m = bruta.replace(/\s+/g, "").match(PADRAO_EMBALAGEM);
  if (!m) return null;
  const unidade = normalizarUnidade(m[3]);
  if (!unidade) return null;
  return { valor: paraNumero(m[1]) * paraNumero(m[2]), unidade };
}

// Resolve quantidade + unidade finais de um item: quando a linha já traz uma
// unidade de peso/volume (ex: granel vendido por kg), usa ela direto; quando é
// vendido por unidade mas o nome tem o tamanho da embalagem, multiplica para
// chegar no total comprado (2 un de 300ml = 600ml).
function resolverMedida(
  nome: string,
  quantidadeLinha: number,
  unidadeLinha: UnidadeMedida | null
): { quantidade: number; unidade: UnidadeMedida | null } {
  if (unidadeLinha && unidadeLinha !== "un") {
    return { quantidade: quantidadeLinha, unidade: unidadeLinha };
  }

  const embalagem = medidaDoNome(nome);
  if (embalagem) {
    return { quantidade: quantidadeLinha * embalagem.valor, unidade: embalagem.unidade };
  }

  return { quantidade: quantidadeLinha, unidade: unidadeLinha ?? "un" };
}

// O nome do mercado costuma ser a razão social no topo, muitas vezes na
// mesma linha do CNPJ e seguida do endereço.
function nomeDoMercado(linhas: string[]): string | null {
  for (const linha of linhas.slice(0, 8)) {
    const limpa = linha
      .replace(/CNPJ:?\s*[\d./-]+/i, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (limpa.length < 4) continue;
    if (/documento|nota fiscal|consumidor|eletr[oô]nic|cupom|extrato|\bvia\b|auxiliar/i.test(limpa)) {
      continue;
    }
    if (/^(rua|r\.|av|avenida|estrada|estr|rod|rodovia|trav|pra[cç]a|al\.)\b/i.test(limpa)) continue;
    if (!/[A-Za-zÀ-ÿ]{3,}/.test(limpa)) continue;
    return limpa;
  }
  return null;
}

// O que efetivamente saiu do bolso é o "valor a pagar" (já com desconto),
// não o "valor total" bruto — é ele que precisa bater com o débito do vale.
function valorPago(linhas: string[]): number | null {
  const prioridades = [
    /valor a pagar|total a pagar|valor pago/i,
    /valor total|total r\$/i,
    /\btotal\b/i,
  ];
  for (const alvo of prioridades) {
    for (const linha of linhas) {
      if (!alvo.test(linha)) continue;
      if (/sub\s?total|desconto|troco|itens?|qtde/i.test(linha)) continue;
      const m = linha.match(PADRAO_VALOR);
      if (m) return paraNumero(m[1]);
    }
  }
  return null;
}

export function interpretarTextoNota(textoOcr: string): NotaFiscalExtraidaBruta {
  const linhas = textoOcr
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const campos_incertos: string[] = [];

  const mercado = nomeDoMercado(linhas);
  const mercado_nome = mercado ?? "Mercado";
  if (!mercado) campos_incertos.push("mercado");

  const matchData = textoOcr.match(PADRAO_DATA);
  let data_compra: string | null = null;
  if (matchData) {
    const [, dia, mes, anoBruto] = matchData;
    const ano = anoBruto.length === 2 ? `20${anoBruto}` : anoBruto;
    data_compra = `${ano}-${mes}-${dia}`;
  } else {
    campos_incertos.push("data_compra");
  }

  let forma_pagamento_detectada: string | null = null;
  for (const [regex, nome] of FORMAS_PAGAMENTO) {
    if (regex.test(textoOcr)) {
      forma_pagamento_detectada = nome;
      break;
    }
  }
  if (!forma_pagamento_detectada) campos_incertos.push("forma_pagamento");

  const valor_total = valorPago(linhas);
  if (valor_total == null) campos_incertos.push("valor_total");

  const itens: ItemNotaBruto[] = [];

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    if (LINHAS_IGNORAR.test(linha)) continue;

    // (A) layout de atacado, com coluna de embalagem
    const comEmbalagem = linha.match(PADRAO_ITEM_EMBALAGEM);
    if (comEmbalagem) {
      const [, nomeBruto, embalagemBruta, qtd, unidadeBruta, unit, total] = comEmbalagem;
      const nome = limparNome(nomeBruto);
      const quantidadeComprada = paraNumero(qtd);
      const embalagem = interpretarEmbalagem(embalagemBruta);
      const unidadeLinha = normalizarUnidade(unidadeBruta);

      // Cada unidade vendida contém `embalagem.valor` da medida real:
      // 4 garrafas de 1,5L = 6L; 12 garrafas de 510ml = 6120ml.
      const medida = embalagem
        ? { quantidade: quantidadeComprada * embalagem.valor, unidade: embalagem.unidade }
        : resolverMedida(nome, quantidadeComprada, unidadeLinha);

      itens.push({
        nome,
        quantidade: medida.quantidade,
        unidade: medida.unidade,
        preco_unitario: paraNumero(unit),
        preco_total: paraNumero(total),
      });
      continue;
    }

    // (B) granel em duas linhas
    const granel = linha.match(PADRAO_GRANEL_CABECALHO);
    if (granel) {
      const [, nomeBruto, peso, unidadeBruta, precoPorUnidade] = granel;
      const quantidade = paraNumero(peso);
      const unidade = normalizarUnidade(unidadeBruta);
      const unitario = paraNumero(precoPorUnidade);

      // a linha seguinte fecha o item com o valor total pago
      let total = Math.round(quantidade * unitario * 100) / 100;
      const proxima = linhas[i + 1];
      const fechamento = proxima?.match(PADRAO_GRANEL_TOTAL);
      if (fechamento) {
        total = paraNumero(fechamento[4]);
        i++; // consome a linha de fechamento
      }

      itens.push({
        nome: limparNome(nomeBruto),
        quantidade,
        unidade,
        preco_unitario: unitario,
        preco_total: total,
      });
      continue;
    }

    // linha de fechamento de granel sem cabeçalho legível: ignora, senão
    // vira um item fantasma chamado "1,518"
    if (PADRAO_GRANEL_TOTAL.test(linha)) continue;

    // (C) layout simples com quantidade e unitário
    const completo = linha.match(PADRAO_ITEM_COMPLETO);
    if (completo) {
      const [, nomeBruto, qtd, unidadeBruta, unit, total] = completo;
      const nome = limparNome(nomeBruto);
      const medida = resolverMedida(nome, paraNumero(qtd), normalizarUnidade(unidadeBruta));
      itens.push({
        nome,
        quantidade: medida.quantidade,
        unidade: medida.unidade,
        preco_unitario: paraNumero(unit),
        preco_total: paraNumero(total),
      });
      continue;
    }

    // (D) só nome e valor — sempre marcado como incerto
    const simples = linha.match(PADRAO_ITEM_SIMPLES);
    if (simples) {
      const [, nomeBruto, total] = simples;
      const nome = limparNome(nomeBruto);
      const medida = resolverMedida(nome, 1, null);
      campos_incertos.push(`item_${itens.length}`);
      itens.push({
        nome,
        quantidade: medida.quantidade,
        unidade: medida.unidade,
        preco_unitario: null,
        preco_total: paraNumero(total),
      });
    }
  }

  return { mercado_nome, data_compra, forma_pagamento_detectada, valor_total, itens, campos_incertos };
}
