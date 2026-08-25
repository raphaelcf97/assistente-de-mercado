"use client";

import { useState } from "react";

// Alterna entre a visão do mês corrente e o histórico completo dentro de um
// mesmo gráfico/tabela. As duas versões já vêm prontas (calculadas e
// renderizadas no servidor) — o componente só decide qual mostrar, sem
// recalcular nada no cliente.
export default function AlternadorPeriodo({
  mensal,
  total,
  desdeMensal,
  padrao = "total",
}: {
  mensal: React.ReactNode;
  total: React.ReactNode;
  // data (já formatada, ex. "22/08") de onde o recorte "Mensal" começa —
  // não é o dia 1º, é a última recarga de alguma carteira. Mostrar isso
  // evita a mesma confusão que gerou essa mudança: "mensal" aqui não é
  // calendário civil.
  desdeMensal?: string | null;
  padrao?: "mensal" | "total";
}) {
  const [modo, setModo] = useState<"mensal" | "total">(padrao);

  return (
    <div>
      <div className="mb-2 flex items-center justify-end gap-2">
        {modo === "mensal" && desdeMensal && (
          <span className="text-[11px] text-neutral-400">desde {desdeMensal}</span>
        )}
        <div className="flex gap-1">
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
      </div>
      {modo === "mensal" ? mensal : total}
    </div>
  );
}
