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
    │     ├─ Calculate gross income (wages + capital gains)
    │     ├─ Apply loss carryovers
    │     ├─ Apply pre-tax deductions (401k, medical)
    │     ├─ Calculate AGI
    │     ├─ Determine deduction (standard vs itemized)
    │     ├─ Calculate tax by bracket
    │     ├─ Add LTCG tax and FICA
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

### deductionCalculator.ts

Handles federal deduction logic:

- Standard vs itemized comparison
- SALT cap application (with AGI-based elevated limits)
- Mortgage interest limits
- Charitable contribution limits

### states/stateCalcUtils.ts

Shared state calculator utilities:

- `calculatePaymentSummary()` - Withholding and payments
- `calculateSafeHarbor()` - Safe harbor calculations

## Adding a New Calculator

1. Create `lib/states/{state}TaxCalculator.ts`
2. Import data from `data/{state}-*.json` files
3. Implement the calculation function returning `TaxCalculationResult`
4. Use `stateCalcUtils.ts` for payment summary and safe harbor
5. Add tests in `lib/__tests__/{state}TaxCalculator.test.ts`
