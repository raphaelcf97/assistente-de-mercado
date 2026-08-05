import { NextResponse } from "next/server";
import { SESSION_COOKIE, criarSessionToken, pinValido } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const pin = typeof body?.pin === "string" ? body.pin : "";

  if (!pin || !pinValido(pin)) {
    return NextResponse.json({ ok: false, erro: "PIN incorreto." }, { status: 401 });
  }

  const token = await criarSessionToken();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
