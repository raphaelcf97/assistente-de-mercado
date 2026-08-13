import { supabaseAdmin } from "@/lib/supabase";
import { formatarMoeda, formatarData } from "@/lib/format";
import { CARTEIRAS_VALE, ROTULO_CARTEIRA, type CarteiraVale } from "@/lib/carteiras";
import ConfigVale from "./ConfigVale";
import ExtratoVale from "./ExtratoVale";
import LancarMovimentacao from "./LancarMovimentacao";

export const dynamic = "force-dynamic";

export default async function ValePage() {
  const supabase = supabaseAdmin();

  const [{ data: saldoRows }, { data: configs }, { data: transacoes }] = await Promise.all([
    supabase.from("vale_saldo").select("carteira, saldo"),
    supabase.from("vale_config").select("carteira, valor_recarga, dia_do_mes"),
    supabase
      .from("vale_transacoes")
      .select("id, tipo, carteira, valor, data, descricao")
      .order("data", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  const saldo = (c: CarteiraVale) => saldoRows?.find((s) => s.carteira === c)?.saldo ?? 0;
  const config = (c: CarteiraVale) => configs?.find((x) => x.carteira === c);

  return (
    <div className="mx-auto max-w-md p-4 pb-24">
      <h1 className="mb-4 text-lg font-semibold text-alelo-900">Meus vales</h1>

      {/* saldo das duas carteiras lado a lado */}
      <div className="mb-5 grid grid-cols-2 gap-3">
        {CARTEIRAS_VALE.map((c) => (
          <div
            key={c}
            className={`rounded-2xl p-4 text-center text-white shadow-sm ${
              c === "alimentacao"
                ? "bg-gradient-to-br from-alelo-500 to-alelo-700"
                : "bg-gradient-to-br from-[#00b887] to-[#00805d]"
            }`}
          >
            <p className="text-xs opacity-80">{ROTULO_CARTEIRA[c]}</p>
            <p className="text-2xl font-semibold">{formatarMoeda(saldo(c))}</p>
          </div>
        ))}
      </div>

      <div className="mb-5">
        <LancarMovimentacao carteiraInicial="refeicao" />
      </div>

      <div className="mb-5 space-y-3">
        {CARTEIRAS_VALE.map((c) => (
          <ConfigVale
            key={c}
            carteira={c}
            valorRecargaInicial={config(c)?.valor_recarga ?? 0}
            diaDoMesInicial={config(c)?.dia_do_mes ?? 1}
          />
        ))}
      </div>

      <ExtratoVale
        transacoes={(transacoes ?? []).map((t) => ({
          id: t.id,
          tipo: t.tipo,
          carteira: t.carteira as CarteiraVale,
          valor: t.valor,
          data: formatarData(t.data),
          descricao: t.descricao,
        }))}
      />
    </div>
  );
}
