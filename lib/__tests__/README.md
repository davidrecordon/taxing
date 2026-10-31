# Calculation Logic Tests

Tests for the tax calculations. They are organised so that every rule is tested in exactly one place, and so that a reader can check the arithmetic of each test by hand.

## Running Tests

```bash
bun run test            # Watch mode
bun run test:run        # Single run (CI)
bun run test:coverage   # With coverage report
```

## Where Each Rule Is Tested

The calculation code is layered: shared building blocks, then one calculator per jurisdiction, then code that combines federal and state results. The tests follow the same layers. A rule is tested in the file that owns it and nowhere else; files further up the stack only check that they call it with the right inputs.

### Building blocks

| File                          | Owns |
| ----------------------------- | ---- |
| `taxUtils.test.ts`            | Walking a bracket schedule, stacking long-term gains on ordinary income, netting capital gains, losses and carryovers (including the $3,000 / $1,500 limit), splitting dividends, taxable interest, effective rates |
| `deductionCalculator.test.ts` | Standard versus itemized (including a forced choice), and every itemized rule, for federal, California, New York and DC: SALT cap and phase-down, mortgage limits, charitable floor, each jurisdiction's high-income limit, DC following the federal deduction type |
| `stateCalcUtils.test.ts`      | What states that tax all income as ordinary income share: state income and AGI, pre-tax deductions, the deductible half of self-employment tax, payments, refund or amount owed, the safe harbor comparison |
| `spouseInputs.test.ts`        | Dividing a joint return between two spouses for the married-filing-separately comparison |
| `withholdingEstimate.test.ts` | Withholding estimated from wages: the annual schedule on regular wages, the flat rates on bonuses and stock, and when the estimate stands in for a blank field |
| `formatters.test.ts`          | Currency, percentage and number-input formatting |
| `data.test.ts`                | The shape of the data files: every supported year is present with the same fields, and every bracket schedule is well formed |
| `stateData.test.ts`           | Loading and caching state data |

### Calculators

Every state file also owns which kinds of income the state taxes and its safe harbor percentages.

| File                              | Owns |
| --------------------------------- | ---- |
| `federalTaxCalculator.test.ts`    | The ordinary and long-term schedules by filing status, which income is ordinary and which is taxed at long-term rates, AGI, payroll tax, self-employment tax, the QBI deduction, NIIT, the income tested by the 2026 itemized limit, a forced deduction choice, what makes up total tax, the federal safe harbor percentages |
| `californiaTaxCalculator.test.ts` | California schedules, the mental health tax, the safe harbor cutoff for high incomes |
| `coloradoTaxCalculator.test.ts`   | The flat rate on federal taxable income, addbacks and subtractions |
| `dcTaxCalculator.test.ts`         | The DC schedule, and passing the federal deduction through |
| `floridaTaxCalculator.test.ts`    | No income tax; what is reported as income |
| `illinoisTaxCalculator.test.ts`   | The flat rate, the personal exemption and its income limit, the property tax credit |
| `newYorkTaxCalculator.test.ts`    | New York schedules, tax benefit recapture, New York City tax and school tax credit |
| `washingtonTaxCalculator.test.ts` | Tax on long-term gains only: the standard deduction, both rate tiers, the 80% rule; what is reported as income |

### Federal and state together

| File                         | Owns |
| ---------------------------- | ---- |
| `deductionChoice.test.ts`    | Choosing standard or itemized by the lower combined tax (DC, Colorado) |
| `charitableScenario.test.ts` | What a charitable gift saves in federal and state tax, and what limits it, for every state |

## How a Calculator Test File Is Laid Out

Every calculator file uses the same sections, in this order, leaving out any that do not apply:

1. **Worked examples** - two to four complete returns, each with the full arithmetic in a comment, covering each filing status the jurisdiction treats differently. These are the tests to read first.
2. **One `describe` per rule the jurisdiction owns**, named for the rule ("mental health tax", "tax benefit recapture"). Each has the ordinary case, then the boundaries: exactly at each threshold and one dollar over, and each filing status that changes the figures.
3. **Shared building blocks** - one test per building block showing that this calculator feeds it the right inputs: state income rather than federal, its own deduction function, its own safe harbor percentages. The building block's own rules are not re-tested here.
4. **Zero and empty inputs**.
5. **By tax year** - a `describe.each(SUPPORTED_YEARS)` block that checks each year's data is picked up, using figures read from that year's data.

## Writing a Test

- **State the rule in the test name**, with its figure: `applies the 1% mental health tax above $1,000,000 of taxable income`.
- **Show the arithmetic in a comment** and assert a literal number worked out by hand from the rule. Do not compute the expected value with the same formula as the code, and do not copy it from a failing run.
- **Test each threshold at the threshold and one dollar past it.** Most mistakes in tax code are `>` against `>=`.
- **Use round, synthetic figures.** The repository is public: never use real personal or financial details.
- **One rule per test.** If a test needs a second rule to make its point, pick inputs that keep the second rule out of the way (for example, income below a phase-out).
- **Use `toBe` for whole dollars and `toBeCloseTo(value, 2)` for cents.**
- Tests outside the "By tax year" block use the default tax year, whose figures appear as literals.

When a test's expected value has to change because the data or a rule changed, work out the new value from the official source (see `data/VERIFICATION.md`) before touching the test.

## Shared Test Utilities

### `testData.ts`

Typed data for the default tax year (`federalBrackets`, `californiaLimits`, `ficaData` and so on), `loadTestDataForYear(year)` for the by-year blocks, and `createDefaultInputs()`:

```typescript
// All amounts default to 0, filingStatus to 'single', selectedState to 'california'
const inputs = createDefaultInputs({
  federalIncome: 100000,
  longTermCapitalGains: 50000,
});
```

### `calculateResults.ts`

`calculateResults(state, overrides, year)` runs the federal and state calculators together the way the app does, including the shared deduction choice for DC and Colorado. Use it when a test is about federal and state combined; use the calculator directly when it is about one jurisdiction.
