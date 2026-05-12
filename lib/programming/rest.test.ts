import { describe, expect, it } from "vitest";
import { classifyRestCategory, restSecondsFor } from "./rest";

describe("classifyRestCategory", () => {
  it("AMRAP top set always wins", () => {
    expect(
      classifyRestCategory({ exerciseName: "Bench Press", isMainLift: true, isAmrap: true }),
    ).toBe("amrap");
    expect(restSecondsFor({ exerciseName: "Bench Press", isMainLift: true, isAmrap: true })).toBe(
      240,
    );
  });

  it("main lifts (bench/squat/dead/OHP) are heavy", () => {
    expect(restSecondsFor({ exerciseName: "Bench Press", isMainLift: true, isAmrap: false })).toBe(
      180,
    );
    expect(restSecondsFor({ exerciseName: "Back Squat", isMainLift: true, isAmrap: false })).toBe(
      180,
    );
  });

  it("RDL is moderate even without isMainLift", () => {
    expect(
      restSecondsFor({ exerciseName: "Romanian Deadlift", isMainLift: false, isAmrap: false }),
    ).toBe(120);
  });

  it("BSS / hack squat / incline DB are moderate", () => {
    expect(
      restSecondsFor({
        exerciseName: "Bulgarian Split Squat",
        isMainLift: false,
        isAmrap: false,
      }),
    ).toBe(120);
    expect(
      restSecondsFor({ exerciseName: "Hack Squat", isMainLift: false, isAmrap: false }),
    ).toBe(120);
    expect(
      restSecondsFor({
        exerciseName: "Incline Dumbbell Press",
        isMainLift: false,
        isAmrap: false,
      }),
    ).toBe(120);
  });

  it("isolations get 90s", () => {
    for (const name of ["Bicep Curl", "Lateral Raise", "Standing Calf Raise", "Leg Curl"]) {
      expect(restSecondsFor({ exerciseName: name, isMainLift: false, isAmrap: false })).toBe(90);
    }
  });
});
