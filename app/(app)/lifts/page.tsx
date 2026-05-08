import { getAllLifts } from "@/lib/queries";
import { db } from "@/lib/db";
import { tmHistory } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import LiftsClient from "./lifts-client";

export default async function LiftsPage({ searchParams }: { searchParams: Promise<{ l?: string }> }) {
  const { l } = await searchParams;
  const lifts = await getAllLifts();
  const initial = (l as string | undefined) ?? "bench_press";

  // Pre-fetch tm history for all so client can switch tabs without a roundtrip
  const histories: Record<string, Array<{ trainingMax: number; effectiveFrom: string; reason: string; amrapReps: number | null; notes: string | null }>> = {};
  for (const lift of lifts) {
    const rows = await db
      .select()
      .from(tmHistory)
      .where(eq(tmHistory.liftId, lift.id))
      .orderBy(desc(tmHistory.effectiveFrom));
    histories[lift.name] = rows.map((r) => ({
      trainingMax: r.trainingMax,
      effectiveFrom: (r.effectiveFrom as Date).toISOString(),
      reason: r.reason,
      amrapReps: r.amrapReps,
      notes: r.notes,
    }));
  }

  const lifted = lifts.map((l) => ({
    name: l.name,
    currentOneRm: l.currentOneRm,
    trainingMax: l.trainingMax,
  }));

  return <LiftsClient initial={initial} lifts={lifted} histories={histories} />;
}
