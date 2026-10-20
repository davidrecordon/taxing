# Calculation Logic Tests

Unit tests for all tax calculation logic. These tests verify mathematical correctness against official tax tables and rules.

## Running Tests

```bash
bun run test            # Watch mode
bun run test:run        # Single run (CI)
bun run test:coverage   # With coverage report
```

## Test Files

| File                              | Description                                                             |
| --------------------------------- | ----------------------------------------------------------------------- |
| `federalTaxCalculator.test.ts`    | Federal income tax, FICA, LTCG, NIIT, self-employment, QBI, AGI         |
| `californiaTaxCalculator.test.ts` | CA state tax, mental health surtax, itemized deductions, safe harbor    |
| `coloradoTaxCalculator.test.ts`   | CO flat tax, federal taxable income basis, addbacks and subtraction     |
| `dcTaxCalculator.test.ts`         | DC progressive tax, itemized deductions, matching the federal deduction |
| `floridaTaxCalculator.test.ts`    | FL no income tax, zero calculations                                     |
| `illinoisTaxCalculator.test.ts`   | IL flat tax, personal exemptions, income limit, property tax credit     |
| `newYorkTaxCalculator.test.ts`    | NY state tax, NYC local tax, high-income safe harbor                    |
| `washingtonTaxCalculator.test.ts` | WA capital gains tax, exemption, surtax                                 |
| `deductionCalculator.test.ts`     | Federal and state deductions: SALT cap, mortgage limits, income limits  |
| `taxUtils.test.ts`                | Effective rates, LTCG stacking, capital loss netting, dividends         |
| `formatters.test.ts`              | Currency and percentage formatting                                      |

## Shared Test Utilities

### `testData.ts`

Centralized data loader providing typed exports for all tax data:

```typescript
import {
  federalBrackets,
  ltcgBrackets,
  federalDeductions,
  federalLimits,
  ficaData,
  sharedLimits,
  californiaBrackets,
  californiaDeductions,
  californiaLimits,
  // ... other state data
  createDefaultInputs,
} from "./testData";
```

The `createDefaultInputs()` helper creates a `TaxInputs` object with sensible defaults:

```typescript
// All fields default to 0, filingStatus to 'single', selectedState to 'california'
const inputs = createDefaultInputs({
  federalIncome: 100000,
  longTermCapitalGains: 50000,
});
```

## Test Categories

Each calculator test file follows a consistent structure:

### Federal (`federalTaxCalculator.test.ts`)

- **basic bracket math** - Ordinary income through 7 brackets
- **FICA taxes** - Social Security cap, Medicare, Additional Medicare
- **long-term capital gains** - 0%/15%/20% bracket stacking
- **401k contributions** - Pre-tax deduction from AGI
- **pre-tax medical deductions** - Reduces taxable income
- **adjusted gross income** - AGI before the standard or itemized deduction
- **FICA and the tax owed** - FICA on wages is informational, not part of the total
- **2026 itemized deduction limits** - Charitable floor and the overall limitation
- **negative LTCG/STCG** - Current year loss handling
- **interest and dividends** - Qualified vs ordinary rates, NIIT, no FICA, no carryover offset
- **safe harbor calculations** - 90% current / 110% prior year
- **loss carryover edge cases** - ST, LT, and combined carryovers
- **LTCG bracket stacking** - Gains stacked on ordinary income
- **bracket boundary edge cases** - Exact threshold testing
- **FICA edge cases** - Wage base boundaries
- **refund and remaining owed** - Payment calculations
- **Net Investment Income Tax (NIIT)** - 3.8% surtax on investment income
- **Self-Employment Tax** - SE tax and deduction
- **QBI Deduction** - 20% qualified business income deduction
- **golden integration tests** - Full scenario verification
- **QBI phaseout exact verification** - Phaseout threshold testing

### State Calculators

Each state calculator tests:

- **Bracket calculations** - State-specific rates and thresholds
- **Capital gains treatment** - Ordinary income vs special rates
- **Loss carryovers** - Interaction with state calculations
- **Safe harbor** - State-specific rules (high-income thresholds vary)
- **Pre-tax deductions** - 401k, medical
- **Self-employment income** - State treatment
- **Payment summary** - Refund/owed calculations
- **Edge cases** - Zero income, negative values, boundaries

### Deductions (`deductionCalculator.test.ts`)

- **SALT cap and standard vs itemized** - Fully phased-down $10,000 cap, automatic comparison
- **mortgage interest proration** - Balance limits ($750k/$375k MFS)
- **MFS edge cases** - Half limits for married filing separately
- **boundary cases** - Exact threshold testing
- **AGI-dependent SALT cap** - Full cap, 30% phasedown above the threshold, floor, by tax year
- **charitable floor and overall limitation** - 2026 federal limits on itemized deductions
- **California, New York and DC deductions** - Property tax without the cap, state mortgage limits, each state's income-based reduction

### Utilities

- **taxUtils.test.ts** - Effective rate calculations, LTCG tax with bracket stacking
- **formatters.test.ts** - `formatCurrency()` and `formatPercent()` functions

## Writing New Tests

### Pattern

```typescript
import { describe, it, expect } from "vitest";
import { calculateSomeTax } from "../someTaxCalculator";
import { createDefaultInputs, someBrackets, someLimits } from "./testData";

describe("calculateSomeTax", () => {
  describe("category of behavior", () => {
    it("should handle specific case", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
      });

      const result = calculateSomeTax(inputs, someBrackets, someLimits);

      expect(result.totalTax).toBe(12345);
    });
  });
});
```

### Guidelines

1. **Use `testData.ts`** - Import data and helpers from the shared module
2. **Use `createDefaultInputs()`** - Only specify fields relevant to the test
3. **Group by behavior** - Use nested `describe()` blocks for categories
4. **Test edge cases** - Zero values, negative values, exact boundaries
5. **Verify against official sources** - See `data/VERIFICATION.md` for source URLs
6. **Keep tests focused** - One assertion per behavior where practical

## Updating Tests After Data Changes

When tax data in `data/*.json` changes:

1. Run `bun run test:run` to identify failing tests
2. Verify the new expected values against official sources
3. Update test expectations to match verified correct values
4. Update `data/VERIFICATION.md` if needed
5. Run `bun run test:run` again to confirm all pass
