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

### Federal

#### `federal-brackets.json`
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

#### `federal-ltcg-brackets.json`
Long-term capital gains tax brackets (0%, 15%, 20%).

Same structure as `federal-brackets.json`.

#### `federal-deductions.json`
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

#### `federal-limits.json`
Federal-specific limits and thresholds.

```typescript
{
  saltLimit: {
    default: number,
    marriedFilingSeparately: number,
    elevated: {
      marriedFilingJointly: number,
      single: number,
      marriedFilingSeparately: number
    },
    elevatedAgiThreshold: number
  },
  mortgageBalanceLimit: {
    default: number,
    marriedFilingSeparately: number
  },
  safeHarbor: {
    currentYearPercent: number,
    priorYearPercent: number
  }
}
```

#### `fica.json`
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

### California

#### `california-brackets.json`
California state income tax brackets.

Same structure as `federal-brackets.json`.

#### `california-deductions.json`
California standard deduction amounts.

Same structure as `federal-deductions.json`.

#### `california-limits.json`
California-specific limits and thresholds.

```typescript
{
  mortgageBalanceLimit: number,
  mentalHealthTax: {
    threshold: number,
    thresholdMFS: number,
    rate: number
  },
  safeHarbor: {
    currentYearPercent: number,
    priorYearPercent: number
  }
}
```

### Washington

#### `washington-brackets.json`
Washington long-term capital gains tax brackets.

Same structure as `federal-brackets.json`. Note: Washington has no income tax on wages; this applies only to LTCG.

#### `washington-limits.json`
Washington-specific limits and thresholds.

```typescript
{
  exemption: number,           // LTCG exempt up to this amount
  surtaxThreshold: number,     // Surtax applies above this
  baseRate: number,            // Base LTCG rate (7%)
  surtaxRate: number,          // Additional rate above threshold (2.9%)
  safeHarbor: {
    percent: number            // 80% of current year tax
  }
}
```

### Shared

#### `limits.json`
Cross-cutting limits that apply to all jurisdictions.

```typescript
{
  contribution401k: {
    standard: number,
    catchUp50Plus: number
  },
  capitalLossLimit: {
    default: number,
    marriedFilingSeparately: number
  }
}
```

## Adding a New Tax Year

1. Add a new year key to each JSON file (e.g., `"2027": { ... }`)
2. Copy the structure from the previous year
3. Update values based on IRS/FTB/DOR announcements
4. Update `TAX_YEAR` in `lib/config.ts` when ready to switch
5. Run tests to verify: `npm test`

## Adding a New State

1. Create `{state}-brackets.json` if the state has income tax brackets
2. Create `{state}-deductions.json` if the state has standard deductions
3. Create `{state}-limits.json` for state-specific limits and safe harbor rules
4. Add corresponding types to `lib/types.ts`
5. Create calculator in `lib/states/`
6. Create breakdown component in `components/States/`

## Data Sources

- Federal brackets: [IRS Revenue Procedures](https://www.irs.gov/newsroom/irs-provides-tax-inflation-adjustments)
- California brackets: [FTB Tax Rates](https://www.ftb.ca.gov/file/personal/tax-calculator-tables.html)
- Washington capital gains: [WA DOR](https://dor.wa.gov/taxes-rates/other-taxes/capital-gains-tax)
- FICA limits: [SSA Wage Base](https://www.ssa.gov/oact/cola/cbb.html)
