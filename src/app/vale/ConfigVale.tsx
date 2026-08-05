"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ConfigVale({
  valorRecargaInicial,
  diaDoMesInicial,
}: {
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
        body: JSON.stringify({ valor_recarga: Number(valorRecarga), dia_do_mes: Number(diaDoMes) }),
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
    <form onSubmit={salvar} className="rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-medium text-neutral-700">Recarga mensal automática</h2>
      <div className="mb-3 flex gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-xs text-neutral-500">Valor (R$)</label>
          <input
            type="number"
            step="0.01"
            value={valorRecarga}
            onChange={(e) => setValorRecarga(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2"
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
            className="w-full rounded-lg border border-neutral-300 px-3 py-2"
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={salvando}
        className="w-full rounded-lg bg-neutral-900 py-2.5 text-sm font-medium text-white disabled:opacity-40"
      >
        {salvando ? "Salvando..." : "Salvar"}
      </button>
      {mensagem && <p className="mt-2 text-xs text-neutral-500">{mensagem}</p>}
    </form>
  );
}
