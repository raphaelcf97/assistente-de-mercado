import Link from "next/link";

const ATALHOS = [
  { href: "/registrar", titulo: "Registrar", descricao: "Compra de mercado ou gasto fora" },
  { href: "/produtos", titulo: "Meus produtos", descricao: "Quanto você paga normalmente em cada um" },
  { href: "/compras", titulo: "Histórico", descricao: "Tudo que você já lançou" },
  { href: "/vale", titulo: "Meus vales", descricao: "Saldo de alimentação e refeição" },
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-md p-4 pb-24">
      <h1 className="mb-1 text-lg font-semibold text-alelo-900">Assistente de Mercado</h1>
      <p className="mb-6 text-sm text-neutral-500">O que você quer fazer?</p>
      <div className="space-y-3">
        {ATALHOS.map((atalho) => (
          <Link
            key={atalho.href}
            href={atalho.href}
            className="block rounded-lg border border-alelo-100 bg-white p-4 transition-colors hover:border-alelo-300"
          >
            <p className="font-medium text-alelo-800">{atalho.titulo}</p>
            <p className="text-sm text-neutral-500">{atalho.descricao}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
