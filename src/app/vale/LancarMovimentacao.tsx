"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CARTEIRAS_VALE, ROTULO_CARTEIRA, type CarteiraVale } from "@/lib/carteiras";

function hoje(): string {
  return new Date().toLocaleDateString("sv-SE");
}

// Fica fechado por padrão: é uma ação de exceção, não do dia a dia. O fluxo
// normal é o cron recarregar sozinho e as compras debitarem.
export default function LancarMovimentacao({ carteiraInicial }: { carteiraInicial: CarteiraVale }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [carteira, setCarteira] = useState<CarteiraVale>(carteiraInicial);
  const [tipo, setTipo] = useState<"recarga" | "ajuste">("recarga");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(hoje);
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setMensagem(null);
    try {
      const res = await fetch("/api/vale/transacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carteira,
          tipo,
          valor: Number(valor.replace(",", ".")),
          data,
          descricao,
        }),
      });
      const resposta = await res.json();
      if (!res.ok || !resposta.ok) {
        setMensagem(resposta.erro ?? "Falha ao lançar.");
        return;
      }
      setValor("");
      setDescricao("");
      setMensagem("Lançado.");
      router.refresh();
    } catch {
      setMensagem("Falha de conexão.");
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="w-full rounded-lg border border-dashed border-alelo-300 py-2.5 text-sm font-medium text-alelo-600 hover:bg-alelo-50"
      >
        + Lançar crédito ou corrigir saldo
      </button>
    );
  }

  return (
    <form onSubmit={enviar} className="rounded-lg border border-alelo-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-alelo-800">Lançar movimentação</h2>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="text-lg leading-none text-neutral-300 hover:text-neutral-500"
          aria-label="Fechar"
        >
          ×
        </button>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Carteira</label>
          <select
            value={carteira}
            onChange={(e) => setCarteira(e.target.value as CarteiraVale)}
            className="w-full rounded-lg border border-alelo-200 px-3 py-2 text-sm outline-none focus:border-alelo-500"
          >
            {CARTEIRAS_VALE.map((c) => (
              <option key={c} value={c}>
                {ROTULO_CARTEIRA[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Tipo</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as "recarga" | "ajuste")}
            className="w-full rounded-lg border border-alelo-200 px-3 py-2 text-sm outline-none focus:border-alelo-500"
          >
            <option value="recarga">Recarga</option>
            <option value="ajuste">Ajuste</option>
          </select>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Valor (R$)</label>
          <input
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="0,00"
            className="w-full rounded-lg border border-alelo-200 px-3 py-2 text-sm outline-none focus:border-alelo-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Data</label>
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="w-full rounded-lg border border-alelo-200 px-3 py-2 text-sm outline-none focus:border-alelo-500"
          />
        </div>
      </div>

      <div className="mb-3">
        <label className="mb-1 block text-xs text-neutral-500">Descrição (opcional)</label>
        <input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder={tipo === "recarga" ? "Recarga de agosto" : "Correção de saldo"}
          className="w-full rounded-lg border border-alelo-200 px-3 py-2 text-sm outline-none focus:border-alelo-500"
        />
      </div>

      <p className="mb-3 text-xs text-neutral-400">
        {tipo === "recarga"
          ? "Use quando o crédito caiu fora do dia configurado ou com valor diferente do automático."
          : "Ajuste aceita valor negativo, para corrigir o saldo para baixo."}
      </p>

      <button
        type="submit"
        disabled={salvando}
        className="w-full rounded-lg bg-alelo-500 py-2.5 text-sm font-medium text-white transition-colors hover:bg-alelo-600 disabled:opacity-40"
      >
        {salvando ? "Lançando..." : "Lançar"}
      </button>
      {mensagem && <p className="mt-2 text-xs text-neutral-500">{mensagem}</p>}
    </form>
  );
}
