export type ItemNotaBruto = {
  nome: string;
  quantidade: number;
  unidade: string | null;
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
const PADRAO_DATA = /(\d{2})[\/.\-](\d{2})[\/.\-](\d{2,4})/;
const LINHAS_IGNORAR = /total|desconto|troco|subtotal|cnpj|cpf|cupom|nfc-?e|consumidor|valor pago|documento|obrigad/i;

const FORMAS_PAGAMENTO: [RegExp, string][] = [
  [/cart[aã]o[^\n]{0,15}d[eé]bito|d[eé]bito/i, "Cartão de Débito"],
  [/cart[aã]o[^\n]{0,15}cr[eé]dito|cr[eé]dito/i, "Cartão de Crédito"],
  [/\bpix\b/i, "Pix"],
  [/dinheiro/i, "Dinheiro"],
  [/vale[- ]?alimenta[cç][aã]o|\bva\b/i, "Vale Alimentação"],
];

// "PRODUTO X   2 UN X 3,50   7,00"
const PADRAO_ITEM_COMPLETO =
  /^(.{3,}?)\s+(\d+(?:[.,]\d+)?)\s*(?:un|kg|g|l|ml|cx|pct)?\s*[xX]\s*(\d+[.,]\d{2})\s+(\d+[.,]\d{2})$/i;

// "PRODUTO X   7,00" (sem quantidade/unitário explícitos)
const PADRAO_ITEM_SIMPLES = /^(.{3,}?)\s+(\d+[.,]\d{2})$/;

export function interpretarTextoNota(textoOcr: string): NotaFiscalExtraidaBruta {
  const linhas = textoOcr
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const campos_incertos: string[] = [];

  const linhaMercado = linhas.find((l) => /[a-zA-ZÀ-ÿ]{3,}/.test(l) && !/^\d/.test(l));
  const mercado_nome = linhaMercado ?? "Mercado";
  if (!linhaMercado) campos_incertos.push("mercado");

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

  let valor_total: number | null = null;
  for (const linha of linhas) {
    if (/\btotal\b/i.test(linha) && !/sub\s?total|desconto|troco|itens?/i.test(linha)) {
      const m = linha.match(PADRAO_VALOR);
      if (m) {
        valor_total = paraNumero(m[1]);
        break;
      }
    }
  }
  if (valor_total == null) campos_incertos.push("valor_total");

  const itens: ItemNotaBruto[] = [];
  for (const linha of linhas) {
    if (LINHAS_IGNORAR.test(linha)) continue;

    const completo = linha.match(PADRAO_ITEM_COMPLETO);
    if (completo) {
      const [, nome, qtd, unit, total] = completo;
      itens.push({
        nome: nome.trim(),
        quantidade: paraNumero(qtd),
        unidade: null,
        preco_unitario: paraNumero(unit),
        preco_total: paraNumero(total),
      });
      continue;
    }

    const simples = linha.match(PADRAO_ITEM_SIMPLES);
    if (simples) {
      const [, nome, total] = simples;
      campos_incertos.push(`item_${itens.length}`);
      itens.push({
        nome: nome.trim(),
        quantidade: 1,
        unidade: null,
        preco_unitario: null,
        preco_total: paraNumero(total),
      });
    }
  }

  return { mercado_nome, data_compra, forma_pagamento_detectada, valor_total, itens, campos_incertos };
}
