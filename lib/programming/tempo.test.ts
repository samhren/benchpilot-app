import { describe, expect, it } from "vitest";
import { getTempoForBenchSet } from "./tempo";

describe("getTempoForBenchSet", () => {
  it("Mon heavy 75% → pause_1s", () => {
    expect(
      getTempoForBenchSet({ sessionType: "upper_a", percentage: 75, isAmrap: false, isMainLift: true }),
    ).toBe("pause_1s");
  });

  it("Mon heavy 85% → pause_1s", () => {
    expect(
      getTempoForBenchSet({ sessionType: "upper_a", percentage: 85, isAmrap: false, isMainLift: true }),
    ).toBe("pause_1s");
  });

  it("Mon heavy AMRAP (hypothetical) still pause_1s", () => {
    expect(
      getTempoForBenchSet({ sessionType: "upper_a", percentage: 90, isAmrap: true, isMainLift: true }),
    ).toBe("pause_1s");
  });

  it("Wed wave 50% → touch_and_go", () => {
    expect(
      getTempoForBenchSet({ sessionType: "upper_b", percentage: 50, isAmrap: false, isMainLift: true }),
    ).toBe("touch_and_go");
  });

  it("Wed wave 70% → touch_and_go", () => {
    expect(
      getTempoForBenchSet({ sessionType: "upper_b", percentage: 70, isAmrap: false, isMainLift: true }),
    ).toBe("touch_and_go");
  });

  it("Wed wave 79.9% → touch_and_go (just under threshold)", () => {
    expect(
      getTempoForBenchSet({ sessionType: "upper_b", percentage: 79.9, isAmrap: false, isMainLift: true }),
    ).toBe("touch_and_go");
  });

  it("Wed wave 80% → pause_1s (threshold inclusive)", () => {
    expect(
      getTempoForBenchSet({ sessionType: "upper_b", percentage: 80, isAmrap: false, isMainLift: true }),
    ).toBe("pause_1s");
  });

  it("Wed wave 90% → pause_1s", () => {
    expect(
      getTempoForBenchSet({ sessionType: "upper_b", percentage: 90, isAmrap: false, isMainLift: true }),
    ).toBe("pause_1s");
  });

  it("Fri AMRAP 80% → pause_1s_first_rep", () => {
    expect(
      getTempoForBenchSet({ sessionType: "upper_c", percentage: 80, isAmrap: true, isMainLift: true }),
    ).toBe("pause_1s_first_rep");
  });

  it("Fri non-AMRAP set → touch_and_go", () => {
    expect(
      getTempoForBenchSet({ sessionType: "upper_c", percentage: 65, isAmrap: false, isMainLift: true }),
    ).toBe("touch_and_go");
  });

  it("Close-grip bench (not main lift) → controlled", () => {
    expect(
      getTempoForBenchSet({ sessionType: "upper_a", percentage: 70, isAmrap: false, isMainLift: false }),
    ).toBe("controlled");
  });

  it("DB bench on Wed (not main lift) → controlled", () => {
    expect(
      getTempoForBenchSet({ sessionType: "upper_b", percentage: 80, isAmrap: false, isMainLift: false }),
    ).toBe("controlled");
  });

  it("Incline DB on Fri (not main lift) → controlled", () => {
    expect(
      getTempoForBenchSet({ sessionType: "upper_c", percentage: 70, isAmrap: true, isMainLift: false }),
    ).toBe("controlled");
  });
});
