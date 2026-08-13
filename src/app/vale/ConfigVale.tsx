"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ConfigVale({
  carteira,
  valorRecargaInicial,
  diaDoMesInicial,
}: {
  carteira: "alimentacao" | "refeicao";
  valorRecargaInicial: number;
  diaDoMesInicial: number;
}) {
  const router = useRouter();
  const [valorRecarga, setValorRecarga] = useState(String(valorRecargaInicial));
  const [diaDoMes, setDiaDoMes] = useState(String(diaDoMesInicial));
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setMensagem(null);
    try {
      const res = await fetch("/api/vale/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carteira,
          valor_recarga: Number(valorRecarga),
          dia_do_mes: Number(diaDoMes),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setMensagem(data.erro ?? "Falha ao salvar.");
        return;
      }
      setMensagem("Configuração salva.");
      router.refresh();
    } catch {
      setMensagem("Falha de conexão.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="rounded-lg border border-alelo-100 bg-white p-4">
      <h2 className="mb-3 text-sm font-medium text-alelo-800">
        Recarga mensal automática — {carteira === "alimentacao" ? "Alimentação" : "Refeição"}
      </h2>
      <div className="mb-3 flex gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-xs text-neutral-500">Valor (R$)</label>
          <input
            type="number"
            step="0.01"
            value={valorRecarga}
            onChange={(e) => setValorRecarga(e.target.value)}
            className="w-full rounded-lg border border-alelo-200 px-3 py-2 outline-none focus:border-alelo-500"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs text-neutral-500">Dia do mês</label>
          <input
            type="number"
            min={1}
            max={28}
            value={diaDoMes}
            onChange={(e) => setDiaDoMes(e.target.value)}
            className="w-full rounded-lg border border-alelo-200 px-3 py-2 outline-none focus:border-alelo-500"
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={salvando}
        className="w-full rounded-lg bg-alelo-500 py-2.5 text-sm font-medium text-white transition-colors hover:bg-alelo-600 disabled:opacity-40"
      >
        {salvando ? "Salvando..." : "Salvar"}
      </button>
      {mensagem && <p className="mt-2 text-xs text-neutral-500">{mensagem}</p>}
    </form>
  );
}
