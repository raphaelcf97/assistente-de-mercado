import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
    }
  }

  const supabase = supabaseAdmin();
  const { data: config } = await supabase
    .from("vale_config")
    .select("valor_recarga, dia_do_mes, ativo")
    .eq("id", 1)
    .maybeSingle();

  if (!config || !config.ativo) {
    return NextResponse.json({ ok: true, recarregado: false, motivo: "config inativa" });
  }

  const hoje = new Date();
  const diaHoje = hoje.getUTCDate();
  if (diaHoje !== config.dia_do_mes) {
    return NextResponse.json({ ok: true, recarregado: false, motivo: "não é o dia da recarga" });
  }

  const inicioMes = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
  const { data: recargaExistente } = await supabase
    .from("vale_transacoes")
    .select("id")
    .eq("tipo", "recarga")
    .gte("data", inicioMes)
    .limit(1)
    .maybeSingle();

  if (recargaExistente) {
    return NextResponse.json({ ok: true, recarregado: false, motivo: "recarga do mês já existe" });
  }

  const hojeISO = hoje.toISOString().slice(0, 10);
  const { error } = await supabase.from("vale_transacoes").insert({
    tipo: "recarga",
    valor: config.valor_recarga,
    data: hojeISO,
    descricao: "Recarga mensal automática",
  });

  if (error) {
    return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, recarregado: true, valor: config.valor_recarga });
}
