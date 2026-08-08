"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CATEGORIAS, SEM_CATEGORIA } from "@/lib/categorias";
import { formatarMoeda } from "@/lib/format";
import { normalizarNome } from "@/lib/matching";
import type { UnidadeBase } from "@/lib/preco-unitario";

export type ProdutoNaLista = {
  id: string;
  nome: string;
  categoria: string | null;
  compras: number;
  precoMedio: { valor: number; unidade: UnidadeBase } | null;
};

export default function ListaProdutos({
  produtos,
  categoriasAtivas = true,
}: {
  produtos: ProdutoNaLista[];
  categoriasAtivas?: boolean;
}) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [salvando, setSalvando] = useState<string | null>(null);

  const filtrados = useMemo(() => {
    const alvo = normalizarNome(busca);
    if (!alvo) return produtos;
    return produtos.filter((p) => normalizarNome(p.nome).includes(alvo));
  }, [produtos, busca]);

  const porCategoria = useMemo(() => {
    const mapa = new Map<string, ProdutoNaLista[]>();
    for (const produto of filtrados) {
      const chave = produto.categoria || SEM_CATEGORIA;
      const atual = mapa.get(chave) ?? [];
      atual.push(produto);
      mapa.set(chave, atual);
    }
    // categorias conhecidas primeiro, na ordem definida; "Sem categoria" por último
    const ordem = [...CATEGORIAS, SEM_CATEGORIA];
    return [...mapa.entries()].sort(
      (a, b) => ordem.indexOf(a[0] as never) - ordem.indexOf(b[0] as never)
    );
  }, [filtrados]);

  async function definirCategoria(produtoId: string, categoria: string) {
    setSalvando(produtoId);
    try {
      await fetch("/api/produtos/categoria", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ produto_id: produtoId, categoria: categoria || null }),
      });
      router.refresh();
    } finally {
      setSalvando(null);
    }
  }

  return (
    <div>
      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="🔍  Buscar produto..."
        className="mb-4 w-full rounded-lg border border-alelo-200 bg-white px-4 py-2.5 outline-none focus:border-alelo-500"
      />

      {produtos.length === 0 && (
        <p className="text-sm text-neutral-500">
          Nenhum produto ainda — registre uma compra para começar o histórico.
        </p>
      )}
      {produtos.length > 0 && filtrados.length === 0 && (
        <p className="text-sm text-neutral-500">Nenhum produto encontrado para “{busca}”.</p>
      )}

      <div className="space-y-5">
        {porCategoria.map(([categoria, itens]) => (
          <section key={categoria}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-alelo-600">
              {categoria} <span className="text-neutral-400">({itens.length})</span>
            </h2>
            <div className="space-y-2">
              {itens.map((produto) => (
                <div key={produto.id} className="rounded-lg border border-alelo-100 bg-white p-3">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/produtos/${produto.id}`} className="min-w-0 flex-1">
                      <p className="truncate font-medium text-alelo-800">{produto.nome}</p>
                      <p className="text-xs text-neutral-500">
                        {produto.compras} compra{produto.compras === 1 ? "" : "s"}
                      </p>
                    </Link>
                    <div className="shrink-0 text-right">
                      {produto.precoMedio ? (
                        <>
                          <p className="font-semibold text-alelo-900">
                            {formatarMoeda(produto.precoMedio.valor)}
                          </p>
                          <p className="text-xs text-neutral-500">por {produto.precoMedio.unidade}</p>
                        </>
                      ) : (
                        <p className="text-xs text-neutral-400">sem medida</p>
                      )}
                    </div>
                  </div>
                  {categoriasAtivas && (
                    <select
                      value={produto.categoria ?? ""}
                      onChange={(e) => definirCategoria(produto.id, e.target.value)}
                      disabled={salvando === produto.id}
                      className="mt-2 w-full rounded border border-alelo-100 bg-alelo-50/50 px-2 py-1 text-xs text-alelo-700 disabled:opacity-50"
                    >
                      <option value="">Sem categoria</option>
                      {CATEGORIAS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
