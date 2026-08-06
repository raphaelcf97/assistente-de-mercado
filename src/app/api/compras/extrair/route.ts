import { NextResponse } from "next/server";
import { interpretarTextoNota } from "@/lib/parse-nota";
import { supabaseAdmin } from "@/lib/supabase";
import { classificarProduto, normalizarNome } from "@/lib/matching";
import type { CampoIncerto, CompraExtraida, ItemExtraido, Mercado, Produto, ProdutoAlias } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const texto = body?.texto;
  if (typeof texto !== "string" || !texto.trim()) {
    return NextResponse.json({ erro: "Nenhum texto de nota recebido." }, { status: 400 });
  }

  const bruta = interpretarTextoNota(texto);

  const supabase = supabaseAdmin();
  const [{ data: mercados }, { data: produtos }, { data: aliases }] = await Promise.all([
    supabase.from("mercados").select("id, nome, apelido, created_at"),
    supabase.from("produtos").select("id, nome_canonico, unidade_padrao, created_at"),
    supabase.from("produto_aliases").select("id, produto_id, nome_alias, created_at"),
  ]);

  const mercadosExistentes = (mercados ?? []) as Mercado[];
  const produtosExistentes = (produtos ?? []) as Produto[];
  const aliasesExistentes = (aliases ?? []) as ProdutoAlias[];

  const alvoMercado = normalizarNome(bruta.mercado_nome);
  const mercadoExistente = mercadosExistentes.find((m) => normalizarNome(m.nome) === alvoMercado);

  const itens: ItemExtraido[] = bruta.itens.map((item) => {
    const classificacao = classificarProduto(item.nome, produtosExistentes, aliasesExistentes);
    return {
      nome_lido_na_nota: item.nome,
      quantidade: item.quantidade,
      unidade: item.unidade,
      preco_unitario: item.preco_unitario,
      preco_total: item.preco_total,
      status: classificacao.status,
      produto_id: classificacao.produto_id,
      sugestao_produto_id: classificacao.sugestao_produto_id,
      sugestao_produto_nome: classificacao.sugestao_produto_nome,
    };
  });

  const campos_incertos = (bruta.campos_incertos ?? []).filter((c): c is CampoIncerto =>
    ["mercado", "data_compra", "valor_total", "forma_pagamento"].includes(c) || /^item_\d+$/.test(c)
  );

  const compraExtraida: CompraExtraida = {
    mercado_nome: bruta.mercado_nome,
    mercado_id: mercadoExistente?.id ?? null,
    data_compra: bruta.data_compra,
    forma_pagamento_detectada: bruta.forma_pagamento_detectada,
    valor_total: bruta.valor_total,
    itens,
    campos_incertos,
  };

  return NextResponse.json({ ok: true, compra: compraExtraida });
}
