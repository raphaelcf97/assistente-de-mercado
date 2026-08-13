import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { CARTEIRAS_VALE } from "@/lib/carteiras";

export const runtime = "nodejs";

// Roda 1x por dia e recarrega cada carteira que faz aniversário hoje. As
// duas são independentes: alimentação pode cair no dia 5 e refeição no 20.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
    }
  }

  const supabase = supabaseAdmin();
  const hoje = new Date();
  const diaHoje = hoje.getUTCDate();
  const hojeISO = hoje.toISOString().slice(0, 10);
  const inicioMes = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);

  const resultado: Record<string, string> = {};

  for (const carteira of CARTEIRAS_VALE) {
    const { data: config } = await supabase
      .from("vale_config")
      .select("valor_recarga, dia_do_mes, ativo")
      .eq("carteira", carteira)
      .maybeSingle();

    if (!config || !config.ativo) {
      resultado[carteira] = "config inativa";
      continue;
    }
    if (config.valor_recarga <= 0) {
      resultado[carteira] = "sem valor configurado";
      continue;
    }
    if (diaHoje !== config.dia_do_mes) {
      resultado[carteira] = "não é o dia da recarga";
      continue;
    }

    // idempotência: uma recarga por carteira por mês, mesmo que o cron rode
    // duas vezes no mesmo dia
    const { data: jaRecarregado } = await supabase
      .from("vale_transacoes")
      .select("id")
      .eq("tipo", "recarga")
      .eq("carteira", carteira)
      .gte("data", inicioMes)
      .limit(1)
      .maybeSingle();

    if (jaRecarregado) {
      resultado[carteira] = "recarga do mês já existe";
      continue;
    }

    const { error } = await supabase.from("vale_transacoes").insert({
      tipo: "recarga",
      carteira,
      valor: config.valor_recarga,
      data: hojeISO,
      descricao: "Recarga mensal automática",
    });

    resultado[carteira] = error ? `erro: ${error.message}` : `recarregado ${config.valor_recarga}`;
  }

  return NextResponse.json({ ok: true, carteiras: resultado });
}
