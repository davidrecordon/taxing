# Calculation Logic Tests

Unit tests for all tax calculation logic. These tests verify mathematical correctness against official tax tables and rules.

## Running Tests

```bash
npm test                # Watch mode
npm run test:run        # Single run (CI)
npm run test:coverage   # With coverage report
```

## Test Files

| File | Tests | Description |
|------|-------|-------------|
| `federalTaxCalculator.test.ts` | 65 | Federal income tax, FICA, LTCG, NIIT, self-employment, QBI |
| `californiaTaxCalculator.test.ts` | 35 | CA state tax, mental health surtax, safe harbor |
| `coloradoTaxCalculator.test.ts` | 8 | CO flat tax, federal taxable income basis |
| `dcTaxCalculator.test.ts` | 15 | DC progressive tax, same brackets all statuses |
| `floridaTaxCalculator.test.ts` | 9 | FL no income tax, zero calculations |
| `illinoisTaxCalculator.test.ts` | 19 | IL flat tax, personal exemptions |
| `newYorkTaxCalculator.test.ts` | 39 | NY state tax, NYC local tax, high-income safe harbor |
| `washingtonTaxCalculator.test.ts` | 22 | WA capital gains tax, exemption, surtax |
| `deductionCalculator.test.ts` | 31 | Standard vs itemized, SALT cap, mortgage proration |
| `taxUtils.test.ts` | 19 | Effective rate calculations, LTCG stacking |
| `formatters.test.ts` | 10 | Currency and percentage formatting |

**Total: 343 tests**

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
} from './testData';
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
- **negative LTCG/STCG** - Current year loss handling
- **safe harbor calculations** - 90% current / 100% prior year
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
- **SALT cap and standard vs itemized** - $10,000 cap, automatic comparison
- **mortgage interest proration** - Balance limits ($750k/$375k MFS)
- **MFS edge cases** - Half limits for married filing separately
- **boundary cases** - Exact threshold testing
- **AGI-dependent SALT cap** - Elevated caps for AGI < $500k

### Utilities
- **taxUtils.test.ts** - Effective rate calculations, LTCG tax with bracket stacking
- **formatters.test.ts** - `formatCurrency()` and `formatPercent()` functions

## Writing New Tests

### Pattern

```typescript
import { describe, it, expect } from 'vitest';
import { calculateSomeTax } from '../someTaxCalculator';
import { createDefaultInputs, someBrackets, someLimits } from './testData';

describe('calculateSomeTax', () => {
  describe('category of behavior', () => {
    it('should handle specific case', () => {
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

1. Run `npm test` to identify failing tests
2. Verify the new expected values against official sources
3. Update test expectations to match verified correct values
4. Update `data/VERIFICATION.md` if needed
5. Run `npm test` again to confirm all pass
