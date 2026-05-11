export type Tempo = "pause_1s" | "pause_1s_first_rep" | "touch_and_go" | "controlled";

export function getTempoForBenchSet(params: {
  sessionType: "upper_a" | "upper_b" | "upper_c";
  percentage: number;
  isAmrap: boolean;
  isMainLift: boolean;
}): Tempo {
  if (!params.isMainLift) return "controlled";
  if (params.sessionType === "upper_a") return "pause_1s";
  if (params.sessionType === "upper_c" && params.isAmrap) return "pause_1s_first_rep";
  if (params.sessionType === "upper_b") {
    return params.percentage >= 80 ? "pause_1s" : "touch_and_go";
  }
  return "touch_and_go";
}

export const TEMPO_CHIP_LABEL: Record<Tempo, string> = {
  pause_1s: "PAUSE 1s every rep",
  pause_1s_first_rep: "PAUSE rep 1 · TnG the rest",
  touch_and_go: "Touch-and-go · no bounce",
  controlled: "",
};

export const TEMPO_EXPLANATION: Record<Tempo, string> = {
  pause_1s:
    "Heavy bench day. Pause 1 second on the chest, every rep. Builds bottom-end strength where most missed reps happen. Wilson et al. — pause kills the stretch-shortening cycle bounce, training pure concentric strength.",
  pause_1s_first_rep:
    "AMRAP set. Pause the first rep 1 second (validates the rep standard). Touch-and-go the remaining reps — controlled descent, light chest contact, no bouncing. Pausing every rep tanks your rep count due to fatigue and undersells your TM progression.",
  touch_and_go:
    "Volume work. Controlled descent, light kiss of the chest, immediate press. No crashing the bar into your chest — that's a bounce, not touch-and-go. If you can't control the descent, the weight is too heavy.",
  controlled: "",
};

export function getSessionTempoSummary(
  sessionType: "upper_a" | "upper_b" | "upper_c",
): string {
  if (sessionType === "upper_a") return "Tempo: paused reps throughout";
  if (sessionType === "upper_b") return "Tempo: TnG below 80%, paused at 80%+";
  return "Tempo: pause rep 1, TnG the rest";
}
