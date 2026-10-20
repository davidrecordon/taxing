import { describe, it, expect } from "vitest";
import { SUPPORTED_YEARS, TAX_YEAR } from "../config";
import {
  getStateDataSync,
  isStateDataLoaded,
  loadStateData,
  preloadStateData,
} from "../stateData";
import { STATE_LABELS, TaxState } from "../types";
import { loadTestDataForYear } from "./testData";

const states = Object.keys(STATE_LABELS) as TaxState[];

describe("cached state data", () => {
  // These run first, before anything else in this file has loaded data
  it("is not available until it has been loaded", async () => {
    expect(isStateDataLoaded("washington", "2025")).toBe(false);
    expect(getStateDataSync("washington", "2025")).toBeUndefined();

    const data = await loadStateData("washington", "2025");

    expect(isStateDataLoaded("washington", "2025")).toBe(true);
    expect(getStateDataSync("washington", "2025")).toBe(data);
  });

  it("can be loaded ahead of time without waiting", async () => {
    expect(isStateDataLoaded("florida", "2025")).toBe(false);

    preloadStateData("florida", "2025");
    await expect.poll(() => isStateDataLoaded("florida", "2025")).toBe(true);
  });
});

describe("loadStateData", () => {
  describe.each(SUPPORTED_YEARS)("for %s", (year) => {
    it.each(states)("loads brackets and limits for %s", async (state) => {
      const data = await loadStateData(state, year);

      expect(data.brackets).toBeDefined();
      expect(data.limits).toBeDefined();
    });
  });

  it("loads the data for the year asked for", async () => {
    for (const year of SUPPORTED_YEARS) {
      const data = await loadStateData("california", year);
      const expected = loadTestDataForYear(year);

      expect(data.brackets).toEqual(expected.californiaBrackets);
      expect(data.deductions).toEqual(expected.californiaDeductions);
      expect(data.limits).toEqual(expected.californiaLimits);
    }
  });

  it("loads deductions for the states that have their own", async () => {
    for (const state of ["california", "dc", "illinois", "newyork"] as const) {
      expect((await loadStateData(state)).deductions).toBeDefined();
    }
  });

  it("loads the New York City schedule with New York", async () => {
    const data = await loadStateData("newyork");

    expect((data as { nycBrackets?: unknown }).nycBrackets).toEqual(
      loadTestDataForYear(TAX_YEAR).nycBrackets,
    );
  });

  it("uses the default tax year when none is given", async () => {
    expect(await loadStateData("dc")).toBe(await loadStateData("dc", TAX_YEAR));
  });

  it("returns the same object on later loads", async () => {
    const first = await loadStateData("illinois", "2025");

    expect(await loadStateData("illinois", "2025")).toBe(first);
  });
});
