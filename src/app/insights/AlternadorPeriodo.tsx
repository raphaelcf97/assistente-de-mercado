"use client";

import { useState } from "react";

// Alterna entre a visão do mês corrente e o histórico completo dentro de um
// mesmo gráfico/tabela. As duas versões já vêm prontas (calculadas e
// renderizadas no servidor) — o componente só decide qual mostrar, sem
// recalcular nada no cliente.
export default function AlternadorPeriodo({
  mensal,
  total,
  padrao = "total",
}: {
  mensal: React.ReactNode;
  total: React.ReactNode;
  padrao?: "mensal" | "total";
}) {
  const [modo, setModo] = useState<"mensal" | "total">(padrao);

  return (
    <div>
      <div className="mb-2 flex justify-end gap-1">
        {(["total", "mensal"] as const).map((opcao) => (
          <button
            key={opcao}
            type="button"
            onClick={() => setModo(opcao)}
            className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
              modo === opcao
                ? "bg-alelo-500 text-white"
                : "bg-alelo-50 text-alelo-700 hover:bg-alelo-100"
            }`}
          >
            {opcao === "total" ? "Total" : "Mensal"}
          </button>
        ))}
      </div>
      {modo === "mensal" ? mensal : total}
    </div>
  );
}
