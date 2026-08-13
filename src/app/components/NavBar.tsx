"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITENS = [
  { href: "/registrar", label: "Registrar" },
  { href: "/produtos", label: "Produtos" },
  { href: "/insights", label: "Insights" },
  { href: "/compras", label: "Histórico" },
  { href: "/vale", label: "Vales" },
];

export default function NavBar() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <nav className="sticky bottom-0 z-10 mt-auto flex border-t border-alelo-100 bg-white">
      {ITENS.map((item) => {
        const ativo =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 border-t-2 py-3 text-center text-[11px] font-medium ${
              ativo ? "border-alelo-500 text-alelo-600" : "border-transparent text-neutral-400"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
