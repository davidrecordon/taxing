# Tax Calculation Library

Core calculation logic for Federal and state income taxes.

## Structure

```
lib/
  config.ts              # Tax year configuration
  types.ts               # TypeScript type definitions
  defaultInputs.ts       # A blank return
  calculate.ts           # Runs the federal and state calculators together (page, tests, MCP)
  taxData.ts             # Loads every data file for a year synchronously (MCP, tests)
  formatters.ts          # Currency/percentage formatting utilities
  taxUtils.ts            # Shared calculation utilities
  charitableScenario.ts  # Tax saved by charitable giving, for the what-if tool
  earners.ts             # Splits a joint return's wages into two earners for payroll tax and withholding
  spouseInputs.ts        # Divides a joint return for the filing status comparison
  withholdingEstimate.ts # Withholding worked out from wages, used where none is entered
  deductionCalculator.ts # Federal and state deduction logic (standard vs itemized)
  deductionChoice.ts     # Picks the deduction type where it changes state tax (DC, CO)
  federalTaxCalculator.ts # Federal income tax calculations
  stateData.ts           # Lazy loading of state tax data by state and year (the page)
  clientIp.ts            # Client IP from proxy headers, for rate limiting
  rateLimiter.ts         # In-memory sliding window rate limiter for the MCP endpoint
  mcp/
    schemas.ts           # Zod input schemas for the tools (the JSON Schema is derived from them)
    summaries.ts         # Compact results, notes, assumptions, rounding
    dataStatus.ts        # Verification status per year, mirrors data/VERIFICATION.md
    server.ts            # createTaxServer(): the six tools on an McpServer
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

`calculate.ts` runs the two halves below together. `calculateTaxes()` takes the inputs as entered, choosing the federal deduction type together with the state's for DC and Colorado; `calculateEstimate()` first fills in withholding that was not entered from the wage inputs, which is what the page and the MCP server show. The charitable what-if and the joint-versus-separate comparison are here too, so the page and the MCP tools run the same code.

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
    │     ├─ Take credits off the income tax (not below zero)
    │     ├─ Add LTCG / qualified dividend tax, SE tax, NIIT and Additional
    │     │  Medicare on wages (earners.ts: per earner for the withheld part)
    │     ├─ Calculate Social Security and Medicare (informational, not in the total)
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

- `estimateWithholding()` - Federal regular wages by the ordinary brackets after pre-tax deductions and the standard deduction (the percentage method for a W-4 with no adjustments); California regular wages by EDD's Method B tables (`data/california-withholding.json`); Colorado and Illinois wages at the flat rate less the employer worksheet's annual allowance (`data/colorado-withholding.json`, `data/illinois-withholding.json`); New York regular wages by the Method II annual schedule, Method III above its threshold, and the city's schedule for a city resident (`data/newyork-withholding.json`, `data/nyc-withholding.json`); bonuses and stock at the flat supplemental rates (federal 22%, 37% above $1,000,000 in the year; California 10.23%; New York 11.70% plus the city's 4.25%; Colorado and Illinois have no separate rate). State withholding is estimated for California, Colorado, Illinois and New York; DC's is not.
- `applyWithholdingEstimate()` - The inputs the calculators run on: an entered amount always wins, and the result says which amounts were estimated

### mcp/

The MCP server behind `app/api/mcp/route.ts`. `server.ts` registers six read-only tools on an `McpServer` from `@modelcontextprotocol/server`: `estimate_tax`, `check_safe_harbor`, `compare_charitable_giving`, `compare_filing_status`, `estimate_withholding` and `list_jurisdictions`. Every tool takes the whole return in the call and calls `calculate.ts`; nothing is stored. `schemas.ts` holds the Zod input schemas, whose `.describe()` text is what an assistant reads (form names are allowed there, unlike on screen). `summaries.ts` builds the compact result, the on-screen notes, the list of assumptions for fields the caller left out, and rounds every amount to cents. `dataStatus.ts` must be updated whenever the "Data Status" section of `data/VERIFICATION.md` changes.

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
