// Carteiras de pagamento e tipos de lançamento.

// "outro" cobre dinheiro, cartão próprio, Pix — tudo que não sai de um vale.
// O gasto ainda é registrado (o histórico de preço do produto interessa
// independente de como foi pago), só não debita saldo nenhum.
export type Carteira = "alimentacao" | "refeicao" | "outro";

export const CARTEIRAS: Carteira[] = ["alimentacao", "refeicao", "outro"];

// as que têm saldo e recarga mensal
export type CarteiraVale = "alimentacao" | "refeicao";
export const CARTEIRAS_VALE: CarteiraVale[] = ["alimentacao", "refeicao"];

export const ROTULO_CARTEIRA: Record<Carteira, string> = {
  alimentacao: "Alimentação",
  refeicao: "Refeição",
  outro: "Outro",
};

export function ehCarteiraVale(c: Carteira): c is CarteiraVale {
  return c === "alimentacao" || c === "refeicao";
}

// ── Tipo de lançamento ──────────────────────────────────────────────────
//
// "mercado" é o único que tem itens: é dele que sai o histórico de preços,
// que é o objetivo do app. Os outros são gasto avulso — só valor, lugar e
// data — e existem pra que o saldo do vale feche com a realidade e pra
// permitir, mais pra frente, olhar onde o dinheiro está indo.
export type CategoriaCompra = "mercado" | "restaurante" | "bar" | "lanche" | "delivery" | "outro";

export const CATEGORIAS_COMPRA: CategoriaCompra[] = [
  "mercado",
  "restaurante",
  "bar",
  "lanche",
  "delivery",
  "outro",
];

export const ROTULO_CATEGORIA: Record<CategoriaCompra, string> = {
  mercado: "Mercado",
  restaurante: "Restaurante",
  bar: "Bar",
  lanche: "Lanche",
  delivery: "Delivery",
  outro: "Outro",
};

// categorias sem itemização — a tela esconde a lista de produtos nelas
export const CATEGORIAS_SEM_ITENS: CategoriaCompra[] = CATEGORIAS_COMPRA.filter(
  (c) => c !== "mercado"
);

export function temItens(categoria: CategoriaCompra): boolean {
  return categoria === "mercado";
}
