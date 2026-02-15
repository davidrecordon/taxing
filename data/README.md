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

### New York

#### `newyork-brackets.json`

New York state income tax brackets.

Same structure as `federal-brackets.json`. Note: NY taxes all capital gains as ordinary income.

#### `newyork-deductions.json`

New York standard deduction amounts.

Same structure as `federal-deductions.json`.

#### `newyork-limits.json`

New York-specific limits and thresholds.

```typescript
{
  safeHarbor: {
    currentYearPercent: number,      // 90% of current year
    priorYearPercent: number,        // 100% of prior year (default)
    highIncomeThreshold: number,     // $150,000 AGI threshold
    highIncomeThresholdMFS: number,  // $75,000 for MFS
    highIncomePercent: number        // 110% for high income
  }
}
```

### NYC (New York City)

#### `nyc-brackets.json`

NYC local income tax brackets for city residents.

Same structure as `federal-brackets.json`. This is an additional tax on top of NY state tax.

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

### Colorado

#### `colorado-brackets.json`

Colorado state income tax brackets (flat 4.4% rate).

Same structure as `federal-brackets.json`. Note: Colorado uses federal taxable income as the starting point, so there is no separate deductions file.

#### `colorado-limits.json`

Colorado-specific limits and thresholds.

```typescript
{
  safeHarbor: {
    currentYearPercent: number,  // 90% of current year tax
    priorYearPercent: number     // 100% of prior year tax
  }
}
```

### Florida

#### `florida-brackets.json`

Florida has no state income tax, so brackets are 0%.

Same structure as `federal-brackets.json` with rate of 0 for all brackets.

#### `florida-limits.json`

Florida-specific limits.

```typescript
{
  safeHarbor: {
    percent: number; // 0 (no tax to safe harbor against)
  }
}
```

### Illinois

#### `illinois-brackets.json`

Illinois state income tax brackets (flat 4.95% rate).

Same structure as `federal-brackets.json`.

#### `illinois-deductions.json`

Illinois uses personal exemptions instead of standard deductions.

```typescript
{
  personalExemption: {
    single: number,
    marriedFilingJointly: number,
    marriedFilingSeparately: number
  }
}
```

#### `illinois-limits.json`

Illinois-specific limits and thresholds.

```typescript
{
  safeHarbor: {
    currentYearPercent: number,
    priorYearPercent: number
  }
}
```

### District of Columbia

#### `dc-brackets.json`

District of Columbia income tax brackets (7 progressive brackets, same for all filing statuses).

Same structure as `federal-brackets.json`. Note: DC taxes all capital gains as ordinary income.

#### `dc-deductions.json`

District of Columbia standard deduction amounts.

Same structure as `federal-deductions.json`.

#### `dc-limits.json`

District of Columbia-specific limits and thresholds.

```typescript
{
  safeHarbor: {
    currentYearPercent: number,  // 90% of current year tax
    priorYearPercent: number     // 110% of prior year tax
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
3. Update values based on IRS/FTB/DOR announcements (see Data Sources below)
4. Verify all values against official sources and update `VERIFICATION.md`
5. Update `TAX_YEAR` in `lib/config.ts` when ready to switch
6. Run tests to verify: `bun test`

## Adding a New State

1. Create `{state}-brackets.json` if the state has income tax brackets
2. Create `{state}-deductions.json` if the state has standard deductions
3. Create `{state}-limits.json` for state-specific limits and safe harbor rules
4. Add corresponding types to `lib/types.ts`
5. Create calculator in `lib/states/`
6. Create breakdown component in `components/States/`

## Data Sources

Official sources for tax data:

- **Federal**: [IRS Rev. Proc. 2024-40](https://www.irs.gov/pub/irs-drop/rp-24-40.pdf) (brackets, deductions, LTCG thresholds)
- **FICA**: [SSA Fact Sheet](https://www.ssa.gov/news/press/factsheets/colafacts2025.pdf) (wage base, rates)
- **California**: [FTB Tax Rate Schedules](https://www.ftb.ca.gov/forms/2025/2025-540-tax-rate-schedules.pdf)
- **Colorado**: [CO DOR Income Tax Guide](https://tax.colorado.gov/individual-income-tax-guide)
- **Florida**: [FL DOR Taxes and Fees](https://floridarevenue.com/taxes/taxesfees/Pages/default.aspx) (no personal income tax)
- **Illinois**: [IL IDOR Tax Rates](https://tax.illinois.gov/research/taxrates/income.html)
- **New York**: [NY DTF Tax Tables](https://www.tax.ny.gov/pit/file/tax-tables.htm)
- **Washington**: [WA DOR Capital Gains](https://dor.wa.gov/taxes-rates/other-taxes/capital-gains-tax)
- **District of Columbia**: [DC OTR Income Tax Rates](https://otr.cfo.dc.gov/page/dc-individual-and-fiduciary-income-tax-rates)

See [`VERIFICATION.md`](VERIFICATION.md) for detailed verification of each value against official sources.
