// Pure auth helpers — no `next/headers` import, so this module is safe to use
// from standalone scripts (e.g. the multi-user migration) as well as from the
// Next.js runtime.
import { createHmac, timingSafeEqual } from "crypto";

// The single pre-existing account. Before multi-user, sessions were signed with
// a fixed `sub: "sam"` and every row in the DB belonged to this one user. The
// migration backfills all existing data to this exact id, and `resolveUserId`
// maps the legacy `sub` onto it — so the original user's live cookie keeps
// working and nothing about their experience changes.
export const LEGACY_SUB = "sam";
export const LEGACY_USER_ID = "00000000-0000-0000-0000-000000000001";

// Deterministic, queryable hash of a PIN. Peppered with SESSION_SECRET so a DB
// leak alone does not reveal raw PINs; deterministic so login is a single
// equality lookup on `users.pin_hash`.
export function hashPin(pin: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET must be set (>=16 chars)");
  }
  return createHmac("sha256", secret).update(pin.trim()).digest("hex");
}

export function pinHashesEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// Map a verified JWT `sub` to a concrete user id. Legacy tokens carry
// `sub: "sam"` and resolve to the migrated legacy user.
export function resolveUserId(sub: string | undefined | null): string | null {
  if (!sub) return null;
  if (sub === LEGACY_SUB) return LEGACY_USER_ID;
  return sub;
}
