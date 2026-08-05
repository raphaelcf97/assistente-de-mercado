import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, sessionTokenValido } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const autenticado = await sessionTokenValido(token);

  if (!autenticado) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!login|api/auth/login|api/cron|_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons).*)",
  ],
};
