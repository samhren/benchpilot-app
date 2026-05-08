import { describe, expect, it } from "vitest";
import { getCurrentBlock, getWeekInBlock } from "./blocks";

describe("getCurrentBlock", () => {
  it.each([
    [1, 1],
    [4, 1],
    [5, 2],
    [8, 2],
    [9, 3],
    [12, 3],
  ] as const)("week %i → block %s", (wk, block) => {
    expect(getCurrentBlock(wk)).toBe(block);
  });
  it("week 13 → deload", () => expect(getCurrentBlock(13)).toBe("deload"));
  it("week 14 → test", () => expect(getCurrentBlock(14)).toBe("test"));
  it("invalid throws", () => expect(() => getCurrentBlock(15)).toThrow());
});

describe("getWeekInBlock", () => {
  it.each([
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 4],
    [5, 1],
    [8, 4],
    [9, 1],
    [12, 4],
  ] as const)("week %i → wk-in-block %i", (wk, w) => {
    expect(getWeekInBlock(wk)).toBe(w);
  });
  it("deload throws", () => expect(() => getWeekInBlock(13)).toThrow());
});
