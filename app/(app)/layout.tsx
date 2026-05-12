import { BottomNav } from "@/components/bottom-nav";
import { ResumeWorkoutBanner } from "@/components/resume-workout-banner";
import { getInProgressSession } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const inProgress = await getInProgressSession();

  return (
    <div className="min-h-dvh">
      <main className="mx-auto w-full max-w-[420px] pb-32">{children}</main>
      {inProgress ? <ResumeWorkoutBanner session={inProgress} /> : null}
      <BottomNav />
    </div>
  );
}
