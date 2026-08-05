import Link from "next/link";

const ATALHOS = [
  { href: "/registrar", titulo: "Registrar compra", descricao: "Tire uma foto da nota fiscal" },
  { href: "/compras", titulo: "Histórico de compras", descricao: "Veja compras e preços por produto" },
  { href: "/vale", titulo: "Vale alimentação", descricao: "Saldo, extrato e recarga mensal" },
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-md p-4 pb-24">
      <h1 className="mb-1 text-lg font-semibold">Assistente de Mercado</h1>
      <p className="mb-6 text-sm text-neutral-500">O que você quer fazer?</p>
      <div className="space-y-3">
        {ATALHOS.map((atalho) => (
          <Link
            key={atalho.href}
            href={atalho.href}
            className="block rounded-lg border border-neutral-200 bg-white p-4 hover:border-neutral-300"
          >
            <p className="font-medium">{atalho.titulo}</p>
            <p className="text-sm text-neutral-500">{atalho.descricao}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
