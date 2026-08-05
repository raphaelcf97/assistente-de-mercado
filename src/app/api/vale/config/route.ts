import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const valor_recarga = Number(body?.valor_recarga);
  const dia_do_mes = Number(body?.dia_do_mes);

  if (!Number.isFinite(valor_recarga) || valor_recarga < 0) {
    return NextResponse.json({ erro: "Valor de recarga inválido." }, { status: 400 });
  }
  if (!Number.isInteger(dia_do_mes) || dia_do_mes < 1 || dia_do_mes > 28) {
    return NextResponse.json({ erro: "Dia do mês deve ser entre 1 e 28." }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("vale_config")
    .update({ valor_recarga, dia_do_mes, ativo: true })
    .eq("id", 1);

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
