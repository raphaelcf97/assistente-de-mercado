// Unidades de medida aceitas no lançamento de item.
//
// A lista é curta de propósito: são as que existem numa embalagem de
// supermercado e as únicas que dá pra converter entre si sem ambiguidade
// (g↔kg, ml↔L). "un" cobre tudo que é vendido por peça — ovo, sabonete,
// rolo de papel — e não converte pra nada.

export type UnidadeMedida = "kg" | "g" | "L" | "ml" | "un";

export const UNIDADES: UnidadeMedida[] = ["kg", "g", "L", "ml", "un"];

export const ROTULO_UNIDADE: Record<UnidadeMedida, string> = {
  kg: "kg",
  g: "g",
  L: "L",
  ml: "ml",
  un: "unidade",
};

// Sugere a unidade a partir do que a pessoa digitou na descrição, pra não
// ter que escolher no select toda vez: "REQUEIJAO 300ML" já entra em ml.
const PISTA_NA_DESCRICAO = /(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|lt)\b/i;

export function medidaNaDescricao(
  descricao: string
): { quantidade: number; unidade: UnidadeMedida } | null {
  const m = descricao.match(PISTA_NA_DESCRICAO);
  if (!m) return null;
  const bruta = m[2].toLowerCase();
  const unidade: UnidadeMedida | null =
    bruta === "kg" ? "kg" : bruta === "g" ? "g" : bruta === "ml" ? "ml" : bruta === "l" || bruta === "lt" ? "L" : null;
  if (!unidade) return null;
  return { quantidade: parseFloat(m[1].replace(",", ".")), unidade };
}
