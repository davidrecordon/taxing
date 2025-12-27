# Tax Data Files

This directory contains tax bracket, deduction, and limit data for each supported tax year.

## File Structure

All files use a multi-year structure with the tax year as the top-level key:

```json
{
  "2025": { ... },
  "2026": { ... }
}
```

## Files

### `federal-brackets.json`
Federal income tax brackets by filing status.

```typescript
{
  brackets: {
    single: [{ min: number, max: number | null, rate: number }],
    marriedFilingJointly: [...],
    marriedFilingSeparately: [...]
  }
}
```

### `federal-ltcg-brackets.json`
Long-term capital gains tax brackets (0%, 15%, 20%).

Same structure as `federal-brackets.json`.

### `california-brackets.json`
California state income tax brackets.

Same structure as `federal-brackets.json`.

### `federal-deductions.json` / `california-deductions.json`
Standard deduction amounts by filing status.

```typescript
{
  standardDeduction: {
    single: number,
    marriedFilingJointly: number,
    marriedFilingSeparately: number
  }
}
```

### `limits.json`
Various tax limits and thresholds.

```typescript
{
  saltLimit: {
    default: number,
    marriedFilingSeparately: number,
    elevated: { ... },
    elevatedAgiThreshold: number
  },
  contribution401k: {
    standard: number,
    catchUp50Plus: number
  },
  mortgageBalanceLimit: {
    federal: { default: number, marriedFilingSeparately: number },
    california: number
  },
  capitalLossLimit: {
    default: number,
    marriedFilingSeparately: number
  },
  caMentalHealthTax: {
    threshold: number,
    thresholdMFS: number,
    rate: number
  },
  safeHarbor: {
    currentYearPercent: number,
    federalPriorYearPercent: number,
    californiaPriorYearPercent: number
  }
}
```

### `fica.json`
Social Security and Medicare tax rates and thresholds.

```typescript
{
  socialSecurity: {
    rate: number,
    wageBaseCap: number
  },
  medicareBase: {
    rate: number
  },
  medicareAdditional: {
    rate: number,
    thresholds: {
      single: number,
      marriedFilingJointly: number,
      marriedFilingSeparately: number
    }
  }
}
```

## Adding a New Tax Year

1. Add a new year key to each JSON file (e.g., `"2027": { ... }`)
2. Copy the structure from the previous year
3. Update values based on IRS/FTB announcements
4. Update `TAX_YEAR` in `lib/config.ts` when ready to switch
5. Run tests to verify: `npm test`

## Data Sources

- Federal brackets: [IRS Revenue Procedures](https://www.irs.gov/newsroom/irs-provides-tax-inflation-adjustments)
- California brackets: [FTB Tax Rates](https://www.ftb.ca.gov/file/personal/tax-calculator-tables.html)
- FICA limits: [SSA Wage Base](https://www.ssa.gov/oact/cola/cbb.html)
