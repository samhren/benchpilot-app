import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { LEGACY_SUB, LEGACY_USER_ID, hashPin, pinHashesEqual, resolveUserId } from "@/lib/auth-core";

// Re-export the pure helpers so existing imports of `@/lib/auth` keep working.
export { LEGACY_SUB, LEGACY_USER_ID, hashPin, pinHashesEqual, resolveUserId };

const COOKIE_NAME = "bp_session";
const ALG = "HS256";
const MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30d

function key(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET must be set (>=16 chars)");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(userId: string): Promise<string> {
  return await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SEC}s`)
    .sign(key());
}

export async function verifySession(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, key(), { algorithms: [ALG] });
    return true;
  } catch {
    return false;
  }
}

// The current user's id, or null if unauthenticated. Server-side only.
export async function getSessionUserId(): Promise<string | null> {
  const c = await cookies();
  const token = c.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: [ALG] });
    return resolveUserId(payload.sub);
  } catch {
    return null;
  }
}

// As getSessionUserId, but throws when there is no session. Middleware already
// guarantees a valid session on every app route, so callers in queries/actions
// can treat the throw as unreachable.
export async function requireUserId(): Promise<string> {
  const id = await getSessionUserId();
  if (!id) throw new Error("Not authenticated");
  return id;
}

export async function isAuthenticated(): Promise<boolean> {
  return (await getSessionUserId()) != null;
}

export async function setSessionCookie(token: string): Promise<void> {
  const c = await cookies();
  c.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE_SEC,
    path: "/",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const c = await cookies();
  c.delete(COOKIE_NAME);
}

export const SESSION_COOKIE = COOKIE_NAME;
