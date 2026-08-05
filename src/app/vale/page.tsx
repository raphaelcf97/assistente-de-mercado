import { supabaseAdmin } from "@/lib/supabase";
import { formatarMoeda, formatarData } from "@/lib/format";
import ConfigVale from "./ConfigVale";

export const dynamic = "force-dynamic";

export default async function ValePage() {
  const supabase = supabaseAdmin();

  const [{ data: saldoRow }, { data: config }, { data: transacoes }] = await Promise.all([
    supabase.from("vale_saldo").select("saldo").maybeSingle(),
    supabase.from("vale_config").select("valor_recarga, dia_do_mes").eq("id", 1).maybeSingle(),
    supabase
      .from("vale_transacoes")
      .select("id, tipo, valor, data, descricao")
      .order("data", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const saldo = saldoRow?.saldo ?? 0;

  return (
    <div className="mx-auto max-w-md p-4 pb-24">
      <h1 className="mb-4 text-lg font-semibold text-alelo-900">Vale alimentação</h1>

      <div className="mb-4 rounded-2xl bg-gradient-to-br from-alelo-500 to-alelo-700 p-5 text-center text-white shadow-sm">
        <p className="text-xs text-alelo-100">Saldo atual</p>
        <p className="text-3xl font-semibold">{formatarMoeda(saldo)}</p>
      </div>

      <div className="mb-4">
        <ConfigVale
          valorRecargaInicial={config?.valor_recarga ?? 0}
          diaDoMesInicial={config?.dia_do_mes ?? 1}
        />
      </div>

      <h2 className="mb-2 text-sm font-medium text-alelo-800">Extrato</h2>
      <div className="space-y-2">
        {(transacoes ?? []).map((t) => (
          <div key={t.id} className="flex items-center justify-between rounded-lg border border-alelo-100 bg-white p-3 text-sm">
            <div>
              <p className="font-medium capitalize">{t.tipo}</p>
              <p className="text-xs text-neutral-500">
                {formatarData(t.data)} {t.descricao ? `· ${t.descricao}` : ""}
              </p>
            </div>
            <p className={`font-medium ${t.valor >= 0 ? "text-[#00b887]" : "text-alelo-900"}`}>
              {t.valor >= 0 ? "+" : ""}
              {formatarMoeda(t.valor)}
            </p>
          </div>
        ))}
        {(transacoes ?? []).length === 0 && (
          <p className="text-sm text-neutral-500">Nenhuma movimentação ainda.</p>
        )}
      </div>
    </div>
  );
}
