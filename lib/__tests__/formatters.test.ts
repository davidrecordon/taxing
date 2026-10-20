import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  formatNumberWithCommas,
  formatPercent,
  parseNumericInput,
} from "../formatters";

describe("formatCurrency", () => {
  it("formats whole dollars with a dollar sign and thousands separators", () => {
    expect(formatCurrency(500)).toBe("$500");
    expect(formatCurrency(1000)).toBe("$1,000");
    expect(formatCurrency(1234567)).toBe("$1,234,567");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("$0");
  });

  it("puts the minus sign before the dollar sign", () => {
    expect(formatCurrency(-500)).toBe("-$500");
    expect(formatCurrency(-1234567)).toBe("-$1,234,567");
  });

  it("rounds cents to the nearest dollar", () => {
    expect(formatCurrency(1234.4)).toBe("$1,234");
    expect(formatCurrency(1234.5)).toBe("$1,235");
    expect(formatCurrency(999.5)).toBe("$1,000");
  });
});

describe("formatPercent", () => {
  describe("choosing decimal places automatically", () => {
    it("shows no decimals for a whole percentage", () => {
      expect(formatPercent(0)).toBe("0%");
      expect(formatPercent(0.1)).toBe("10%");
      expect(formatPercent(0.22)).toBe("22%");
      expect(formatPercent(1)).toBe("100%");
    });

    it("shows one decimal when the percentage needs it", () => {
      expect(formatPercent(0.095)).toBe("9.5%");
      expect(formatPercent(0.075)).toBe("7.5%");
      expect(formatPercent(0.125)).toBe("12.5%");
    });

    it("shows two decimals when the percentage needs them", () => {
      expect(formatPercent(0.0495)).toBe("4.95%");
      expect(formatPercent(0.0725)).toBe("7.25%");
      expect(formatPercent(0.1234)).toBe("12.34%");
    });

    it("shows at most two decimals, rounding the rest", () => {
      expect(formatPercent(0.12344)).toBe("12.34%");
      expect(formatPercent(0.12346)).toBe("12.35%");
    });
  });

  describe("explicit decimal places", () => {
    it("rounds to a whole percentage when 0 is given", () => {
      expect(formatPercent(0.1, 0)).toBe("10%");
      expect(formatPercent(0.0495, 0)).toBe("5%");
      expect(formatPercent(0.1234, 0)).toBe("12%");
    });

    it("shows one decimal when 1 is given, adding a trailing zero", () => {
      expect(formatPercent(0.1, 1)).toBe("10.0%");
      expect(formatPercent(0.1234, 1)).toBe("12.3%");
      expect(formatPercent(0.1266, 1)).toBe("12.7%");
    });

    it("shows two decimals when 2 is given, adding trailing zeros", () => {
      expect(formatPercent(0.1, 2)).toBe("10.00%");
      expect(formatPercent(0.095, 2)).toBe("9.50%");
      expect(formatPercent(0.1234, 2)).toBe("12.34%");
    });
  });
});

describe("parseNumericInput", () => {
  it("parses plain digits", () => {
    expect(parseNumericInput("1234")).toBe(1234);
  });

  it("parses a decimal amount", () => {
    expect(parseNumericInput("1234.56")).toBe(1234.56);
  });

  it("strips thousands separators", () => {
    expect(parseNumericInput("1,234,567")).toBe(1234567);
  });

  it("strips a dollar sign, spaces and other characters", () => {
    expect(parseNumericInput("$1,234.50")).toBe(1234.5);
    expect(parseNumericInput(" 1 234 ")).toBe(1234);
    expect(parseNumericInput("12abc34")).toBe(1234);
  });

  it("keeps only the first decimal point", () => {
    expect(parseNumericInput("1.2.3")).toBe(1.23);
    expect(parseNumericInput("1,000.50.25")).toBe(1000.5025);
  });

  it("returns 0 when there is nothing to parse", () => {
    expect(parseNumericInput("")).toBe(0);
    expect(parseNumericInput("abc")).toBe(0);
    expect(parseNumericInput(".")).toBe(0);
  });

  describe("when negative values are not allowed (the default)", () => {
    it("drops a leading minus sign", () => {
      expect(parseNumericInput("-500")).toBe(500);
      expect(parseNumericInput("-1,234.56", false)).toBe(1234.56);
    });
  });

  describe("when negative values are allowed", () => {
    it("keeps a leading minus sign", () => {
      expect(parseNumericInput("-500", true)).toBe(-500);
      expect(parseNumericInput("-1,234.56", true)).toBe(-1234.56);
    });

    it("accepts spaces before the minus sign", () => {
      expect(parseNumericInput("  -500", true)).toBe(-500);
    });

    it("ignores a minus sign that is not at the start", () => {
      expect(parseNumericInput("5-00", true)).toBe(500);
      expect(parseNumericInput("$-500", true)).toBe(500);
    });

    it("still parses positive values", () => {
      expect(parseNumericInput("1,234", true)).toBe(1234);
    });

    it("returns 0 for a minus sign on its own", () => {
      expect(parseNumericInput("-", true)).toBe(0);
    });
  });
});

describe("formatNumberWithCommas", () => {
  it("returns an empty string for empty input", () => {
    expect(formatNumberWithCommas("")).toBe("");
  });

  it("leaves numbers below 1,000 unchanged", () => {
    expect(formatNumberWithCommas("0")).toBe("0");
    expect(formatNumberWithCommas("999")).toBe("999");
  });

  it("adds a separator every three digits from 1,000 up", () => {
    expect(formatNumberWithCommas("1000")).toBe("1,000");
    expect(formatNumberWithCommas("123456")).toBe("123,456");
    expect(formatNumberWithCommas("1234567")).toBe("1,234,567");
  });

  it("repositions separators that are already there", () => {
    expect(formatNumberWithCommas("1,234")).toBe("1,234");
    expect(formatNumberWithCommas("1,2345")).toBe("12,345");
    expect(formatNumberWithCommas("12,34567")).toBe("1,234,567");
  });

  it("leaves the digits after the decimal point ungrouped", () => {
    expect(formatNumberWithCommas("1234.56")).toBe("1,234.56");
    expect(formatNumberWithCommas("1234.56789")).toBe("1,234.56789");
  });

  it("keeps a trailing decimal point while the user is typing", () => {
    expect(formatNumberWithCommas("1234.")).toBe("1,234.");
  });

  it("keeps a leading decimal point", () => {
    expect(formatNumberWithCommas(".5")).toBe(".5");
  });

  it("keeps a leading minus sign", () => {
    expect(formatNumberWithCommas("-999")).toBe("-999");
    expect(formatNumberWithCommas("-1234")).toBe("-1,234");
    expect(formatNumberWithCommas("-1234567.5")).toBe("-1,234,567.5");
  });
});
