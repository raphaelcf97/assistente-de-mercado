import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { uploadFotoNota } from "@/lib/storage";
import { normalizarNome } from "@/lib/matching";
import type { CompraConfirmada } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);
  const foto = formData?.get("foto");
  const payloadRaw = formData?.get("payload");
  if (!foto || !(foto instanceof File) || typeof payloadRaw !== "string") {
    return NextResponse.json({ erro: "Requisição incompleta." }, { status: 400 });
  }

  const compra = JSON.parse(payloadRaw) as CompraConfirmada;
  const supabase = supabaseAdmin();

  // 1. mercado (usa existente ou cria)
  let mercadoId = compra.mercado_id;
  if (!mercadoId) {
    const { data, error } = await supabase
      .from("mercados")
      .insert({ nome: compra.mercado_nome })
      .select("id")
      .single();
    if (error || !data) {
      return NextResponse.json({ erro: `Falha ao criar mercado: ${error?.message}` }, { status: 500 });
    }
    mercadoId = data.id;
  }

  // 2. foto
  const mediaType = foto.type === "image/png" ? "image/png" : "image/jpeg";
  const bytes = Buffer.from(await foto.arrayBuffer());
  let fotoPath: string | null = null;
  try {
    fotoPath = await uploadFotoNota(bytes, mediaType);
  } catch {
    fotoPath = null; // não bloqueia o salvamento da compra por falha no upload da foto
  }

  // 3. produtos: resolve produto_id de cada item (vincula existente ou cria novo)
  const itensResolvidos: {
    produto_id: string;
    nome_lido_na_nota: string;
    quantidade: number;
    unidade: string | null;
    preco_unitario: number | null;
    preco_total: number;
  }[] = [];

  for (const item of compra.itens) {
    let produtoId = item.produto_id;

    if (!produtoId) {
      const nomeCanonico = item.novo_produto_nome?.trim() || item.nome_lido_na_nota;
      const { data, error } = await supabase
        .from("produtos")
        .insert({ nome_canonico: nomeCanonico })
        .select("id")
        .single();
      if (error || !data) {
        return NextResponse.json({ erro: `Falha ao criar produto: ${error?.message}` }, { status: 500 });
      }
      produtoId = data.id;
    } else {
      // se o nome lido difere do nome já vinculado, guarda como alias para melhorar matching futuro
      const { data: produto } = await supabase
        .from("produtos")
        .select("nome_canonico")
        .eq("id", produtoId)
        .single();
      if (produto && normalizarNome(produto.nome_canonico) !== normalizarNome(item.nome_lido_na_nota)) {
        const { data: aliasExistente } = await supabase
          .from("produto_aliases")
          .select("id")
          .eq("produto_id", produtoId)
          .ilike("nome_alias", item.nome_lido_na_nota)
          .maybeSingle();
        if (!aliasExistente) {
          await supabase
            .from("produto_aliases")
            .insert({ produto_id: produtoId, nome_alias: item.nome_lido_na_nota });
        }
      }
    }

    itensResolvidos.push({
      produto_id: produtoId,
      nome_lido_na_nota: item.nome_lido_na_nota,
      quantidade: item.quantidade,
      unidade: item.unidade,
      preco_unitario: item.preco_unitario,
      preco_total: item.preco_total,
    });
  }

  // 4. compra
  const { data: compraSalva, error: erroCompra } = await supabase
    .from("compras")
    .insert({
      mercado_id: mercadoId,
      data_compra: compra.data_compra,
      valor_total: compra.valor_total,
      forma_pagamento_detectada: compra.forma_pagamento_detectada,
      pago_vale_alimentacao: compra.pago_vale_alimentacao,
      foto_url: fotoPath,
    })
    .select("id")
    .single();

  if (erroCompra || !compraSalva) {
    return NextResponse.json({ erro: `Falha ao salvar compra: ${erroCompra?.message}` }, { status: 500 });
  }

  // 5. itens da compra
  const { error: erroItens } = await supabase.from("itens_compra").insert(
    itensResolvidos.map((item) => ({ ...item, compra_id: compraSalva.id }))
  );
  if (erroItens) {
    return NextResponse.json({ erro: `Falha ao salvar itens: ${erroItens.message}` }, { status: 500 });
  }

  // 6. debita do vale alimentação, se aplicável
  if (compra.pago_vale_alimentacao) {
    await supabase.from("vale_transacoes").insert({
      tipo: "compra",
      valor: -Math.abs(compra.valor_total),
      data: compra.data_compra,
      compra_id: compraSalva.id,
      descricao: `Compra em ${compra.mercado_nome}`,
    });
  }

  return NextResponse.json({ ok: true, compra_id: compraSalva.id });
}
