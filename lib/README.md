# Tax Calculation Library

Core calculation logic for Federal and state income taxes.

## Structure

```
lib/
  config.ts              # Tax year configuration
  types.ts               # TypeScript type definitions
  formatters.ts          # Currency/percentage formatting utilities
  taxUtils.ts            # Shared calculation utilities
  charitableScenario.ts  # Tax saved by charitable giving, for the what-if tool
  spouseInputs.ts        # Divides a joint return for the filing status comparison
  withholdingEstimate.ts # Withholding worked out from wages, used where none is entered
  deductionCalculator.ts # Federal and state deduction logic (standard vs itemized)
  deductionChoice.ts     # Picks the deduction type where it changes state tax (DC, CO)
  federalTaxCalculator.ts # Federal income tax calculations
  stateData.ts           # Lazy loading of state tax data by state and year
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
    │     ├─ Determine deduction (standard vs itemized), with the 2026
    │     │  charitable floor and overall itemized limitation
    │     ├─ Calculate tax by bracket
    │     ├─ Add LTCG / qualified dividend tax, SE tax, and NIIT
    │     ├─ Calculate FICA on wages (informational, not in the total)
    │     └─ Calculate safe harbor
    │
    └─► {state}TaxCalculator.ts (DC and Colorado also take the federal result)
          ├─ Calculate state income and AGI (calculateStateIncome)
          ├─ Apply state deductions/exemptions, addbacks and credits
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

- `calculateTaxByBrackets()` - Progressive tax calculation with a bracket breakdown
- `calculateLTCGTaxWithStacking()` - Long-term rates stacked on ordinary income
- `calculateEffectiveRates()` - Effective rate calculations
- `netCapitalGains()` - Schedule D netting of gains, losses, and carryovers (used by federal and state calculators). Known approximation: at very low incomes the carryover to next year can be understated by up to the annual deduction limit; see the function comment.
- `splitDividends()` - Qualified vs non-qualified dividend split
- `taxableInterest()` - Taxable interest, ignoring negative entries

### deductionCalculator.ts

Federal deductions:

- `calculateFederalDeductions()` - Standard vs itemized comparison, SALT cap, mortgage interest limit, and the 2026 charitable floor
- `calculateSaltLimit()` - SALT cap, phasing down above an AGI threshold to a floor
- `applyFederalItemizedLimit()` - The 2026 overall limitation for top-bracket filers

State deductions, where property tax is deductible outside the SALT cap and state income tax is not:

- `calculateCaliforniaDeductions()` - 6% / 80% high-income limitation
- `calculateNewYorkDeductions()` - New York itemized deduction adjustment tiers
- `calculateDCDeductions()` - 5% limitation; follows the federal standard-or-itemized choice, which `calculateWithSharedDeductionChoice()` in `deductionChoice.ts` makes for the lower combined tax

Percentage-of-AGI limits on charitable contributions are not modelled.

### withholdingEstimate.ts

What an employer would withhold over the year, from the wage inputs, standing in for a withholding amount the user has not entered:

- `estimateWithholding()` - Federal regular wages by the ordinary brackets after pre-tax deductions and the standard deduction (the percentage method for a W-4 with no adjustments); California regular wages by EDD's Method B tables (`data/california-withholding.json`); Colorado and Illinois wages at the flat rate less the employer worksheet's annual allowance (`data/colorado-withholding.json`, `data/illinois-withholding.json`); bonuses and stock at the flat supplemental rates (federal 22%, 37% above $1,000,000 in the year; California 10.23%; Colorado and Illinois have no separate rate). State withholding is estimated for California, Colorado and Illinois only.
- `applyWithholdingEstimate()` - The inputs the calculators run on: an entered amount always wins, and the result says which amounts were estimated

### states/stateCalcUtils.ts

Shared state calculator utilities:

- `calculateStateIncome()` - Wages, gross income, capital loss offsets and AGI for states that tax all income as ordinary
- `calculatePaymentSummary()` - Withholding and payments
- `calculateSafeHarbor()` - Safe harbor calculations

## Adding a New Calculator

1. Create `lib/states/{state}TaxCalculator.ts`
2. Import data from `data/{state}-*.json` files
3. Implement the calculation function returning `TaxCalculationResult`
4. Use `stateCalcUtils.ts` for state income and AGI, payment summary and safe harbor
5. Add tests in `lib/__tests__/{state}TaxCalculator.test.ts`
