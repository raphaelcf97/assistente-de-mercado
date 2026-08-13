import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { formatarMoeda, formatarData } from "@/lib/format";
import {
  ROTULO_CARTEIRA,
  ROTULO_CATEGORIA,
  type Carteira,
  type CategoriaCompra,
} from "@/lib/carteiras";

export const dynamic = "force-dynamic";

type CompraComItens = {
  id: string;
  data_compra: string;
  valor_total: number;
  carteira: Carteira;
  categoria: CategoriaCompra;
  forma_pagamento_detectada: string | null;
  mercados: { nome: string } | null;
  itens_compra: {
    id: string;
    nome_lido_na_nota: string;
    quantidade: number;
    unidade: string | null;
    preco_total: number;
    produto_id: string;
    produtos: { nome_canonico: string } | null;
  }[];
};

export default async function ComprasPage() {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("compras")
    .select(
      "id, data_compra, valor_total, carteira, categoria, forma_pagamento_detectada, mercados(nome), itens_compra(id, nome_lido_na_nota, quantidade, unidade, preco_total, produto_id, produtos(nome_canonico))"
    )
    .order("data_compra", { ascending: false })
    .limit(100);

  const compras = (data ?? []) as unknown as CompraComItens[];

  return (
    <div className="mx-auto max-w-md p-4 pb-24">
      <h1 className="mb-4 text-lg font-semibold text-alelo-900">Histórico</h1>

      {error && <p className="text-sm text-red-600">Falha ao carregar: {error.message}</p>}

      {compras.length === 0 && !error && (
        <p className="text-sm text-neutral-500">Nenhum lançamento registrado ainda.</p>
      )}

      <div className="space-y-3">
        {compras.map((compra) => (
          <div key={compra.id} className="rounded-lg border border-alelo-100 bg-white p-4">
            <div className="mb-2 flex items-start justify-between">
              <div className="min-w-0">
                <p className="truncate font-medium">{compra.mercados?.nome ?? "Estabelecimento"}</p>
                <p className="text-xs text-neutral-500">
                  {formatarData(compra.data_compra)}
                  {compra.categoria !== "mercado" &&
                    ` · ${ROTULO_CATEGORIA[compra.categoria] ?? compra.categoria}`}
                </p>
              </div>
              <div className="shrink-0 pl-3 text-right">
                <p className="font-medium">{formatarMoeda(compra.valor_total)}</p>
                <p className="text-xs text-neutral-500">
                  {ROTULO_CARTEIRA[compra.carteira] ?? compra.carteira}
                </p>
              </div>
            </div>
            <ul className="space-y-1 text-sm text-neutral-700">
              {compra.itens_compra.map((item) => (
                <li key={item.id} className="flex justify-between gap-2">
                  <Link href={`/produtos/${item.produto_id}`} className="truncate text-alelo-700 underline decoration-alelo-200">
                    {item.produtos?.nome_canonico ?? item.nome_lido_na_nota}
                  </Link>
                  <span className="shrink-0 text-neutral-500">{formatarMoeda(item.preco_total)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
