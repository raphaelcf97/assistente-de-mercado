import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import { formatarMoeda, formatarData } from "@/lib/format";

export const dynamic = "force-dynamic";

type HistoricoLinha = {
  mercado_id: string;
  mercado_nome: string;
  preco_medio: number;
  quantidade_compras: number;
  ultima_compra: string;
};

export default async function ProdutoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = supabaseAdmin();

  const [{ data: produto }, { data: historico }] = await Promise.all([
    supabase.from("produtos").select("nome_canonico").eq("id", id).maybeSingle(),
    supabase
      .from("historico_precos")
      .select("mercado_id, mercado_nome, preco_medio, quantidade_compras, ultima_compra")
      .eq("produto_id", id)
      .order("ultima_compra", { ascending: false }),
  ]);

  if (!produto) notFound();

  const linhas = (historico ?? []) as HistoricoLinha[];
  const totalCompras = linhas.reduce((soma, l) => soma + l.quantidade_compras, 0);
  const mediaGeral =
    totalCompras > 0
      ? linhas.reduce((soma, l) => soma + l.preco_medio * l.quantidade_compras, 0) / totalCompras
      : null;

  return (
    <div className="mx-auto max-w-md p-4 pb-24">
      <Link href="/compras" className="mb-2 inline-block text-sm text-alelo-600">
        ← Voltar
      </Link>
      <h1 className="mb-4 text-lg font-semibold text-alelo-900">{produto.nome_canonico}</h1>

      {mediaGeral != null && (
        <div className="mb-4 rounded-lg border border-alelo-100 bg-white p-4">
          <p className="text-xs text-neutral-500">Média geral (todos os mercados)</p>
          <p className="text-xl font-semibold text-alelo-800">{formatarMoeda(mediaGeral)}</p>
        </div>
      )}

      <h2 className="mb-2 text-sm font-medium text-alelo-800">Preço médio por mercado</h2>
      {linhas.length === 0 && <p className="text-sm text-neutral-500">Nenhuma compra registrada ainda.</p>}
      <div className="space-y-2">
        {linhas.map((linha) => (
          <div key={linha.mercado_id} className="flex items-center justify-between rounded-lg border border-alelo-100 bg-white p-3">
            <div>
              <p className="font-medium">{linha.mercado_nome}</p>
              <p className="text-xs text-neutral-500">
                {linha.quantidade_compras} compra(s) · última em {formatarData(linha.ultima_compra)}
              </p>
            </div>
            <p className="font-medium">{formatarMoeda(linha.preco_medio)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
