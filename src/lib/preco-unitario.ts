// Converte quantidade/unidade de cada item para uma base comparável (kg, L
// ou un) e calcula o preço médio nessa base — é isso que permite comparar
// embalagens diferentes do mesmo produto (ex: requeijão de 300ml vs 85ml).

export type UnidadeBase = "kg" | "L" | "un";

type ItemMedido = {
  quantidade: number | null;
  unidade: string | null;
  preco_total: number;
};

function paraBase(
  quantidade: number,
  unidade: string
): { quantidade: number; unidade: UnidadeBase } | null {
  switch (unidade) {
    case "kg":
      return { quantidade, unidade: "kg" };
    case "g":
      return { quantidade: quantidade / 1000, unidade: "kg" };
    case "L":
      return { quantidade, unidade: "L" };
    case "ml":
      return { quantidade: quantidade / 1000, unidade: "L" };
    case "un":
      return { quantidade, unidade: "un" };
    default:
      return null;
  }
}

export function precoMedioPorUnidade(
  itens: ItemMedido[]
): { valor: number; unidade: UnidadeBase } | null {
  const acumulado: Record<UnidadeBase, { preco: number; quantidade: number; compras: number }> = {
    kg: { preco: 0, quantidade: 0, compras: 0 },
    L: { preco: 0, quantidade: 0, compras: 0 },
    un: { preco: 0, quantidade: 0, compras: 0 },
  };

  for (const item of itens) {
    if (!item.unidade || !item.quantidade || item.quantidade <= 0) continue;
    const base = paraBase(item.quantidade, item.unidade);
    if (!base || base.quantidade <= 0) continue;
    acumulado[base.unidade].preco += item.preco_total;
    acumulado[base.unidade].quantidade += base.quantidade;
    acumulado[base.unidade].compras += 1;
  }

  // usa a unidade predominante nas compras daquele produto
  const predominante = (Object.keys(acumulado) as UnidadeBase[])
    .filter((u) => acumulado[u].compras > 0 && acumulado[u].quantidade > 0)
    .sort((a, b) => acumulado[b].compras - acumulado[a].compras)[0];

  if (!predominante) return null;

  return {
    valor: acumulado[predominante].preco / acumulado[predominante].quantidade,
    unidade: predominante,
  };
}
