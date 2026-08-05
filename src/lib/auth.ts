import { SignJWT, jwtVerify } from "jose";
import { timingSafeEqual } from "crypto";

export const SESSION_COOKIE = "amk_session";
const SESSION_DURATION = "365d";

function sessionSecret() {
  const secret = process.env.APP_SESSION_SECRET;
  if (!secret) {
    throw new Error("APP_SESSION_SECRET não configurada. Veja SETUP.md.");
  }
  return new TextEncoder().encode(secret);
}

export function pinValido(pinDigitado: string): boolean {
  const pinCorreto = process.env.APP_PIN;
  if (!pinCorreto) {
    throw new Error("APP_PIN não configurado. Veja SETUP.md.");
  }
  const a = Buffer.from(pinDigitado);
  const b = Buffer.from(pinCorreto);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function criarSessionToken(): Promise<string> {
  return new SignJWT({ dispositivo: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_DURATION)
    .sign(sessionSecret());
}

export async function sessionTokenValido(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, sessionSecret());
    return true;
  } catch {
    return false;
  }
}
