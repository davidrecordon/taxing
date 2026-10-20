# Tax Calculation Library

Core calculation logic for Federal and state income taxes.

## Structure

```
lib/
  config.ts              # Tax year configuration
  types.ts               # TypeScript type definitions
  formatters.ts          # Currency/percentage formatting utilities
  taxUtils.ts            # Shared calculation utilities
  deductionCalculator.ts # Deduction logic (standard vs itemized)
  federalTaxCalculator.ts # Federal income tax calculations
  states/
    stateCalcUtils.ts         # Shared state calculator utilities
    californiaTaxCalculator.ts
    coloradoTaxCalculator.ts
    dcTaxCalculator.ts
    floridaTaxCalculator.ts
    illinoisTaxCalculator.ts
    newYorkTaxCalculator.ts
    washingtonTaxCalculator.ts
  __tests__/             # Unit tests
```

## Calculation Flow

```
TaxInputs (user form data)
    │
    ├─► federalTaxCalculator.ts
    │     ├─ Calculate gross income (wages + interest + dividends + capital gains)
    │     ├─ Net capital gains, losses, and carryovers (Schedule D)
    │     ├─ Apply pre-tax deductions (401k, medical)
    │     ├─ Calculate AGI (before the standard or itemized deduction)
    │     ├─ Determine deduction (standard vs itemized)
    │     ├─ Calculate tax by bracket
    │     ├─ Add LTCG / qualified dividend tax, SE tax, and NIIT
    │     ├─ Calculate FICA on wages (informational, not in the total)
    │     └─ Calculate safe harbor
    │
    └─► {state}TaxCalculator.ts
          ├─ Apply state-specific income adjustments
          ├─ Apply state deductions/exemptions
          ├─ Calculate tax (progressive or flat)
          └─ Calculate state safe harbor
```

## Key Modules

### types.ts

Central type definitions including:

- `TaxInputs` - Form input data
- `TaxCalculationResult` - Calculator output
- `TaxBracketsData`, `DeductionsData` - Tax data structures
- State-specific limit types

### taxUtils.ts

Shared utilities:

- `calculateTaxByBracket()` - Progressive tax calculation
- `calculateIncomeInBrackets()` - Bracket breakdown
- `calculateEffectiveRates()` - Effective rate calculations
- `netCapitalGains()` - Schedule D netting of gains, losses, and carryovers (used by federal and state calculators). Known approximation: at very low incomes the carryover to next year can be understated by up to the annual deduction limit; see the function comment.
- `splitDividends()` - Qualified vs non-qualified dividend split
- `taxableInterest()` - Taxable interest, ignoring negative entries

### deductionCalculator.ts

Handles federal deduction logic:

- Standard vs itemized comparison
- SALT cap application (`calculateSaltLimit()`: cap phases down above an AGI threshold, to a floor)
- Mortgage interest limits
- Charitable contribution limits

### states/stateCalcUtils.ts

Shared state calculator utilities:

- `calculateStateIncome()` - Wages, gross income, capital loss offsets and AGI for states that tax all income as ordinary
- `calculatePaymentSummary()` - Withholding and payments
- `calculateSafeHarbor()` - Safe harbor calculations

## Adding a New Calculator

1. Create `lib/states/{state}TaxCalculator.ts`
2. Import data from `data/{state}-*.json` files
3. Implement the calculation function returning `TaxCalculationResult`
4. Use `stateCalcUtils.ts` for payment summary and safe harbor
5. Add tests in `lib/__tests__/{state}TaxCalculator.test.ts`
