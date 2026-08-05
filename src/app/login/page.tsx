"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErro(data.erro ?? "Não foi possível entrar.");
        setEnviando(false);
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setErro("Falha de conexão. Tente novamente.");
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-alelo-50 px-4">
      <form
        onSubmit={entrar}
        className="w-full max-w-xs rounded-2xl border border-alelo-100 bg-white p-6 shadow-sm"
      >
        <h1 className="mb-1 text-lg font-semibold text-alelo-900">
          Assistente de Mercado
        </h1>
        <p className="mb-5 text-sm text-neutral-500">Digite seu PIN para entrar.</p>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="w-full rounded-lg border border-alelo-200 px-4 py-3 text-center text-2xl tracking-[0.5em] outline-none focus:border-alelo-500"
          placeholder="••••"
        />
        {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}
        <button
          type="submit"
          disabled={enviando || pin.length === 0}
          className="mt-5 w-full rounded-lg bg-alelo-500 py-3 font-medium text-white transition-colors hover:bg-alelo-600 disabled:opacity-40"
        >
          {enviando ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
