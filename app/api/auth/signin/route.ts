import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { hashPin, setSessionCookie, signSession } from "@/lib/auth";
import { bootstrapUserData } from "@/lib/db/bootstrap-user";

const Body = z.object({
  pin: z.string().min(4).max(12),
  // When true, an unrecognised PIN creates a brand-new account instead of
  // being rejected. The client sets this only after the user confirms.
  create: z.boolean().optional(),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }

  const { pin, create } = parsed.data;
  const pinHash = hashPin(pin);

  // Existing account → log in. This also covers the case where the user asked
  // to "create" a PIN that actually already exists.
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.pinHash, pinHash))
    .limit(1);
  if (existing) {
    await setSessionCookie(await signSession(existing.id));
    return NextResponse.json({ ok: true });
  }

  // Unknown PIN, and the user hasn't confirmed account creation yet.
  if (!create) {
    await new Promise((r) => setTimeout(r, 250)); // mild rate-throttle
    return NextResponse.json({ ok: false, reason: "unknown_pin" });
  }

  // Confirmed: create the account and seed its program.
  const [createdUser] = await db.insert(users).values({ pinHash }).returning();
  try {
    await bootstrapUserData(createdUser.id);
  } catch (err) {
    // Roll back the half-created account so the PIN is free to retry.
    // FK cascades drop any partial program/lift rows.
    await db.delete(users).where(eq(users.id, createdUser.id));
    console.error("bootstrapUserData failed", err);
    return NextResponse.json({ ok: false, reason: "bootstrap_failed" }, { status: 500 });
  }

  await setSessionCookie(await signSession(createdUser.id));
  return NextResponse.json({ ok: true, created: true });
}
