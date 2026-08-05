"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITENS = [
  { href: "/", label: "Início" },
  { href: "/registrar", label: "Registrar" },
  { href: "/compras", label: "Compras" },
  { href: "/vale", label: "Vale" },
];

export default function NavBar() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <nav className="sticky bottom-0 z-10 mt-auto flex border-t border-neutral-200 bg-white">
      {ITENS.map((item) => {
        const ativo = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 py-3 text-center text-xs font-medium ${
              ativo ? "text-neutral-900" : "text-neutral-400"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
