import type { ItemExtraidoStatus, Produto, ProdutoAlias } from "@/lib/types";

// Matching de produto por nome é feito em memória (JS), sem depender de
// extensões do Postgres — o volume de dados é pequeno (uso pessoal).

const LIMIAR_PARECIDO = 0.55;

export function normalizarNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function bigramas(texto: string): string[] {
  const t = texto.replace(/\s+/g, " ");
  if (t.length < 2) return [t];
  const pares: string[] = [];
  for (let i = 0; i < t.length - 1; i++) pares.push(t.slice(i, i + 2));
  return pares;
}

// coeficiente de Dice entre dois textos, 0 (nada em comum) a 1 (idênticos)
export function similaridade(a: string, b: string): number {
  const na = normalizarNome(a);
  const nb = normalizarNome(b);
  if (na === nb) return 1;

  const bigA = bigramas(na);
  const bigB = bigramas(nb);
  const contagemB = new Map<string, number>();
  for (const bg of bigB) contagemB.set(bg, (contagemB.get(bg) ?? 0) + 1);

  let interseccao = 0;
  for (const bg of bigA) {
    const restante = contagemB.get(bg) ?? 0;
    if (restante > 0) {
      interseccao++;
      contagemB.set(bg, restante - 1);
    }
  }

  return (2 * interseccao) / (bigA.length + bigB.length);
}

export type ClassificacaoProduto = {
  status: ItemExtraidoStatus;
  produto_id: string | null;
  sugestao_produto_id: string | null;
  sugestao_produto_nome: string | null;
};

export function classificarProduto(
  nomeLidoNaNota: string,
  produtos: Pick<Produto, "id" | "nome_canonico">[],
  aliases: Pick<ProdutoAlias, "produto_id" | "nome_alias">[]
): ClassificacaoProduto {
  const alvo = normalizarNome(nomeLidoNaNota);

  // candidatos: nome canônico de cada produto + seus aliases
  const candidatos: { produto_id: string; nome: string }[] = [
    ...produtos.map((p) => ({ produto_id: p.id, nome: p.nome_canonico })),
    ...aliases.map((a) => ({ produto_id: a.produto_id, nome: a.nome_alias })),
  ];

  for (const c of candidatos) {
    if (normalizarNome(c.nome) === alvo) {
      return {
        status: "match_exato",
        produto_id: c.produto_id,
        sugestao_produto_id: null,
        sugestao_produto_nome: null,
      };
    }
  }

  let melhor: { produto_id: string; nome: string; score: number } | null = null;
  for (const c of candidatos) {
    const score = similaridade(nomeLidoNaNota, c.nome);
    if (!melhor || score > melhor.score) melhor = { ...c, score };
  }

  if (melhor && melhor.score >= LIMIAR_PARECIDO) {
    return {
      status: "match_parecido",
      produto_id: null,
      sugestao_produto_id: melhor.produto_id,
      sugestao_produto_nome: melhor.nome,
    };
  }

  return {
    status: "novo",
    produto_id: null,
    sugestao_produto_id: null,
    sugestao_produto_nome: null,
  };
}
