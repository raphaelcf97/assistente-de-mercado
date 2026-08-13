import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Lançamento manual de crédito no vale.
//
// A recarga automática do cron cobre o caso normal, mas não todos: o valor
// muda de um mês pro outro, o crédito cai fora do dia configurado, ou o app
// entra em uso quando já havia saldo. Sem isso, a única saída seria mexer no
// banco na mão.
//
// "compra" fica de fora de propósito — débito vem de lançamento na tela de
// Registrar, pra que todo gasto tenha estabelecimento e data.
const TIPOS_PERMITIDOS = ["recarga", "ajuste"] as const;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  const carteira = body?.carteira;
  const tipo = body?.tipo;
  const valor = Number(body?.valor);
  const data = typeof body?.data === "string" ? body.data : "";
  const descricao = typeof body?.descricao === "string" ? body.descricao.trim() : "";

  if (carteira !== "alimentacao" && carteira !== "refeicao") {
    return NextResponse.json({ erro: "Carteira inválida." }, { status: 400 });
  }
  if (!TIPOS_PERMITIDOS.includes(tipo)) {
    return NextResponse.json({ erro: "Tipo inválido." }, { status: 400 });
  }
  if (!Number.isFinite(valor) || valor === 0) {
    return NextResponse.json({ erro: "Informe um valor diferente de zero." }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return NextResponse.json({ erro: "Data inválida." }, { status: 400 });
  }

  // recarga é sempre crédito; ajuste pode ser dos dois lados (corrigir saldo
  // pra cima ou pra baixo)
  const valorFinal = tipo === "recarga" ? Math.abs(valor) : valor;

  const supabase = supabaseAdmin();
  const { error } = await supabase.from("vale_transacoes").insert({
    tipo,
    carteira,
    valor: valorFinal,
    data,
    descricao: descricao || (tipo === "recarga" ? "Recarga lançada manualmente" : "Ajuste de saldo"),
  });

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
