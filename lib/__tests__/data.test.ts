import { readdirSync, readFileSync } from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import { SUPPORTED_YEARS } from "../config";
import { FilingStatus, TaxBracket } from "../types";

// The shape of the data files. The figures themselves are checked against
// official sources in data/VERIFICATION.md and by the calculator tests.

const dataDirectory = path.resolve(__dirname, "../../data");
const dataFiles = readdirSync(dataDirectory)
  .filter((file) => file.endsWith(".json"))
  .sort();
const bracketFiles = dataFiles.filter((file) => file.includes("brackets"));
const filingStatuses: FilingStatus[] = [
  "single",
  "marriedFilingJointly",
  "marriedFilingSeparately",
];

const load = (file: string): Record<string, unknown> =>
  JSON.parse(readFileSync(path.join(dataDirectory, file), "utf8"));

// Every key path in a value, so two years can be compared field by field
const keyPaths = (value: unknown, prefix = ""): string[] => {
  if (Array.isArray(value)) {
    return [`${prefix}[${value.length}]`];
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) =>
      keyPaths(child, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [prefix];
};

describe.each(dataFiles)("data/%s", (file) => {
  const data = load(file);

  it("has an entry for every supported tax year, and no others", () => {
    expect(Object.keys(data).sort()).toEqual([...SUPPORTED_YEARS].sort());
  });

  it("has the same fields in every year", () => {
    // A rule that starts in one year still needs a value (such as a rate of
    // 0) in the others, or the code would need a year check
    const [firstYear, ...otherYears] = SUPPORTED_YEARS;
    const withoutArrayLengths = (paths: string[]) =>
      paths.map((keyPath) => keyPath.replace(/\[\d+\]$/, "[]")).sort();

    for (const year of otherYears) {
      expect(withoutArrayLengths(keyPaths(data[year]))).toEqual(
        withoutArrayLengths(keyPaths(data[firstYear])),
      );
    }
  });
});

describe.each(bracketFiles)("bracket schedules in data/%s", (file) => {
  const data = load(file) as Record<
    string,
    { brackets: Record<FilingStatus, TaxBracket[]> }
  >;
  const schedules = SUPPORTED_YEARS.flatMap((year) =>
    filingStatuses.map((filingStatus) => ({
      name: `${year} ${filingStatus}`,
      brackets: data[year].brackets[filingStatus],
    })),
  );

  // The schedule's name is passed to expect so a failure says which one
  it("starts every schedule at zero", () => {
    for (const { name, brackets } of schedules) {
      expect(brackets[0].min, name).toBe(0);
    }
  });

  it("has no gaps or overlaps between brackets", () => {
    for (const { name, brackets } of schedules) {
      for (let i = 1; i < brackets.length; i++) {
        expect(brackets[i].min, name).toBe(brackets[i - 1].max);
      }
    }
  });

  it("ends every schedule with a bracket that has no upper limit", () => {
    for (const { name, brackets } of schedules) {
      expect(brackets[brackets.length - 1].max, name).toBeNull();
      for (const bracket of brackets.slice(0, -1)) {
        expect(bracket.max, name).toBeGreaterThan(bracket.min);
      }
    }
  });

  it("has rates between 0% and 100% that never fall as income rises", () => {
    for (const { name, brackets } of schedules) {
      for (const [i, bracket] of brackets.entries()) {
        expect(bracket.rate, name).toBeGreaterThanOrEqual(0);
        expect(bracket.rate, name).toBeLessThan(1);
        if (i > 0) {
          expect(bracket.rate, name).toBeGreaterThanOrEqual(
            brackets[i - 1].rate,
          );
        }
      }
    }
  });
});
