"use client";

import { useState } from "react";
import { formatarMoeda } from "@/lib/format";
import { CARTEIRAS_VALE, ROTULO_CARTEIRA, type CarteiraVale } from "@/lib/carteiras";

type Linha = {
  id: string;
  tipo: string;
  carteira: CarteiraVale;
  valor: number;
  data: string;
  descricao: string | null;
};

// Com duas carteiras o extrato único vira confusão — a mesma lista mistura
// débito de mercado e de restaurante sem dizer de onde saiu. O filtro
// resolve, e "Tudo" continua sendo o padrão pra visão geral.
export default function ExtratoVale({ transacoes }: { transacoes: Linha[] }) {
  const [filtro, setFiltro] = useState<CarteiraVale | "tudo">("tudo");

  const visiveis = filtro === "tudo" ? transacoes : transacoes.filter((t) => t.carteira === filtro);

  return (
    <>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium text-alelo-800">Extrato</h2>
        <div className="flex gap-1">
          {(["tudo", ...CARTEIRAS_VALE] as const).map((opcao) => (
            <button
              key={opcao}
              type="button"
              onClick={() => setFiltro(opcao)}
              className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                filtro === opcao
                  ? "bg-alelo-500 text-white"
                  : "bg-alelo-50 text-alelo-700 hover:bg-alelo-100"
              }`}
            >
              {opcao === "tudo" ? "Tudo" : ROTULO_CARTEIRA[opcao]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {visiveis.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between rounded-lg border border-alelo-100 bg-white p-3 text-sm"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-neutral-800">
                {t.descricao || <span className="capitalize">{t.tipo}</span>}
              </p>
              <p className="text-xs text-neutral-500">
                {t.data} · {ROTULO_CARTEIRA[t.carteira]}
              </p>
            </div>
            <p
              className={`shrink-0 pl-3 font-medium ${
                t.valor >= 0 ? "text-[#00b887]" : "text-alelo-900"
              }`}
            >
              {t.valor >= 0 ? "+" : ""}
              {formatarMoeda(t.valor)}
            </p>
          </div>
        ))}
        {visiveis.length === 0 && (
          <p className="text-sm text-neutral-500">Nenhuma movimentação ainda.</p>
        )}
      </div>
    </>
  );
}
