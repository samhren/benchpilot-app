import { NextResponse } from "next/server";
import { z } from "zod";
import { setSessionCookie, signSession } from "@/lib/auth";

const Body = z.object({ password: z.string().min(1) });

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const expected = process.env.APP_PASSWORD;
  if (!expected) return NextResponse.json({ ok: false, error: "APP_PASSWORD not set" }, { status: 500 });
  if (parsed.data.password !== expected) {
    await new Promise((r) => setTimeout(r, 250)); // mild rate-throttle
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const token = await signSession();
  await setSessionCookie(token);
  return NextResponse.json({ ok: true });
}
