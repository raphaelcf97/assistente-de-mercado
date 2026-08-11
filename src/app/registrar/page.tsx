import { supabaseAdmin } from "@/lib/supabase";
import { precoMedioPorUnidade, precoPorUnidadeDoItem } from "@/lib/preco-unitario";
import FormularioCompra, { type ProdutoConhecido } from "./FormularioCompra";

export const dynamic = "force-dynamic";

// A tela já nasce com todo o histórico em mãos. O volume é pequeno (uso
// pessoal, um punhado de compras por mês), então carregar tudo de uma vez
// deixa a busca de produto e a comparação de preço instantâneas enquanto se
// digita, sem uma requisição por tecla.
export default async function RegistrarPage() {
  const supabase = supabaseAdmin();

  const [{ data: mercados }, { data: produtos }, { data: compras }, { data: itens }] =
    await Promise.all([
      supabase.from("mercados").select("id, nome").order("nome"),
      supabase.from("produtos").select("id, nome_canonico").order("nome_canonico"),
      supabase.from("compras").select("id, data_compra, mercado_id"),
      supabase.from("itens_compra").select("produto_id, quantidade, unidade, preco_total, compra_id"),
    ]);

  const nomeDoMercado = new Map((mercados ?? []).map((m) => [m.id, m.nome]));
  const dadosDaCompra = new Map(
    (compras ?? []).map((c) => [c.id, { data: c.data_compra, mercado: nomeDoMercado.get(c.mercado_id) ?? "" }])
  );

  const porProduto = new Map<
    string,
    { quantidade: number; unidade: string | null; preco_total: number; data: string; mercado: string }[]
  >();
  for (const item of itens ?? []) {
    const compra = dadosDaCompra.get(item.compra_id);
    if (!compra) continue;
    const lista = porProduto.get(item.produto_id) ?? [];
    lista.push({
      quantidade: item.quantidade,
      unidade: item.unidade,
      preco_total: item.preco_total,
      data: compra.data,
      mercado: compra.mercado,
    });
    porProduto.set(item.produto_id, lista);
  }

  const conhecidos: ProdutoConhecido[] = (produtos ?? []).map((produto) => {
    const historico = porProduto.get(produto.id) ?? [];
    const maisRecente = [...historico].sort((a, b) => b.data.localeCompare(a.data))[0];
    const ultimoPreco = maisRecente
      ? precoPorUnidadeDoItem(maisRecente.quantidade, maisRecente.unidade, maisRecente.preco_total)
      : null;

    return {
      id: produto.id,
      nome: produto.nome_canonico,
      compras: historico.length,
      precoMedio: precoMedioPorUnidade(historico),
      ultimo:
        maisRecente && ultimoPreco
          ? { ...ultimoPreco, data: maisRecente.data, mercado: maisRecente.mercado }
          : null,
    };
  });

  return (
    <FormularioCompra
      mercados={(mercados ?? []).map((m) => ({ id: m.id, nome: m.nome }))}
      produtos={conhecidos}
    />
  );
}
