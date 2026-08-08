import { supabaseAdmin } from "@/lib/supabase";
import { precoMedioPorUnidade } from "@/lib/preco-unitario";
import ListaProdutos, { type ProdutoNaLista } from "./ListaProdutos";

export const dynamic = "force-dynamic";

type ProdutoBase = { id: string; nome_canonico: string; categoria: string | null };

// A coluna `categoria` vem da migration 002. Se ela ainda não tiver sido
// rodada no Supabase, a página continua funcionando (sem agrupamento por
// categoria) em vez de quebrar inteira.
async function buscarProdutos(
  supabase: ReturnType<typeof supabaseAdmin>
): Promise<{ produtos: ProdutoBase[]; faltaMigration: boolean }> {
  const comCategoria = await supabase
    .from("produtos")
    .select("id, nome_canonico, categoria")
    .order("nome_canonico");

  if (!comCategoria.error) {
    return { produtos: (comCategoria.data ?? []) as ProdutoBase[], faltaMigration: false };
  }

  const semCategoria = await supabase
    .from("produtos")
    .select("id, nome_canonico")
    .order("nome_canonico");

  return {
    produtos: (semCategoria.data ?? []).map((p) => ({ ...p, categoria: null })),
    faltaMigration: true,
  };
}

export default async function ProdutosPage() {
  const supabase = supabaseAdmin();

  const [{ produtos, faltaMigration }, { data: itens }] = await Promise.all([
    buscarProdutos(supabase),
    supabase.from("itens_compra").select("produto_id, quantidade, unidade, preco_total"),
  ]);

  const itensPorProduto = new Map<
    string,
    { quantidade: number; unidade: string | null; preco_total: number }[]
  >();
  for (const item of itens ?? []) {
    const atual = itensPorProduto.get(item.produto_id) ?? [];
    atual.push({ quantidade: item.quantidade, unidade: item.unidade, preco_total: item.preco_total });
    itensPorProduto.set(item.produto_id, atual);
  }

  const lista: ProdutoNaLista[] = produtos.map((produto) => {
    const doProduto = itensPorProduto.get(produto.id) ?? [];
    return {
      id: produto.id,
      nome: produto.nome_canonico,
      categoria: produto.categoria,
      compras: doProduto.length,
      precoMedio: precoMedioPorUnidade(doProduto),
    };
  });

  return (
    <div className="mx-auto max-w-md p-4 pb-24">
      <h1 className="mb-1 text-lg font-semibold text-alelo-900">Produtos</h1>
      <p className="mb-4 text-sm text-neutral-500">
        Preço médio pago por unidade de medida, para comparar entre embalagens.
      </p>

      {faltaMigration && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          As categorias ainda não estão ativas: rode a migration{" "}
          <code>supabase/migrations/002_categoria_produtos.sql</code> no SQL Editor do Supabase.
        </p>
      )}

      <ListaProdutos produtos={lista} categoriasAtivas={!faltaMigration} />
    </div>
  );
}
