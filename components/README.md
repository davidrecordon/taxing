# React Components

UI components for the tax calculator application.

## Structure

```
components/
  TaxCalculator.tsx      # Main orchestrator - connects inputs to calculators to display
                         # Also renders summary cards (Federal/State refund/owed)
  Displays/              # Result display components
    FederalBreakdown.tsx   # Federal tax breakdown with brackets, payroll tax, credits, safe harbor
    TaxResultsDisplay.tsx  # Routes to appropriate federal/state breakdown displays
  Forms/                 # Input form components
    ConfigurationSection.tsx  # Filing status and state selection
    DeductionInputs.tsx       # Deductions (property tax, mortgage, charitable, 401k)
    IncomeInputs.tsx          # Income fields (wages, interest, dividends, capital gains)
    PriorYearInputs.tsx       # Prior year tax and loss carryovers
    WithholdingInputs.tsx     # Tax withholding and estimated payments, with the estimate from wages as a hint
  Modals/                # Modal dialogs
    CharitableWhatIfModal.tsx      # Tax saved by giving half, the same, or double
    FilingStatusComparisonModal.tsx # MFJ vs MFS comparison
  States/                # State-specific breakdown components
    CaliforniaBreakdown.tsx
    ColoradoBreakdown.tsx
    DCBreakdown.tsx
    FloridaBreakdown.tsx
    IllinoisBreakdown.tsx
    NewYorkBreakdown.tsx
    WashingtonBreakdown.tsx
  shared/                # Shared display components
    BracketTable.tsx       # Reusable tax bracket breakdown table
    InvestmentIncomeRows.tsx # Interest and dividend rows for income sections
    ItemizedDeductionDetails.tsx # Itemized deduction components and limits
    TaxSummarySection.tsx  # Reusable payment summary section
  UI/                    # Reusable UI primitives
    AnalyticsWrapper.tsx   # Analytics integration wrapper
    CurrencyInput.tsx      # Formatted currency input field
    Dialog.tsx             # Modal dialog shell used by everything in Modals/
    ErrorBoundary.tsx      # React error boundary
    ThemeSelector.tsx      # Light/dark theme toggle
    useDialogKeyboard.ts   # Focus, Tab and Escape handling for Dialog
```

## Data Flow

```
TaxCalculator.tsx
    │
    ├─► Forms/*                 # User enters data
    │     └─► TaxInputs state
    │
    ├─► lib/*Calculators        # Calculations run on state change
    │     └─► CalculationResults
    │
    └─► Displays/*              # Results displayed
          ├─► FederalBreakdown
          └─► States/*Breakdown
```

## On-Screen Text

For the wording of labels, hints, warnings and notes, follow "Writing On-Screen Text" in `CLAUDE.md`.

## Testing

Tests are colocated with components in `__tests__/` subdirectories. Each behaviour is tested with the component that owns it:

- `__tests__/` - The whole calculator, from typing into the form to a result on screen
- `Forms/__tests__/` - Which fields each form shows and when, its hints and warnings, and that each field updates the right input
- `Displays/__tests__/` - The Federal breakdown, and showing the right state breakdown for the selected state
- `Modals/__tests__/` - What each dialog shows. Opening, closing and keyboard behaviour belong to `Dialog` and are tested in `UI/__tests__/`
- `States/__tests__/` - State breakdowns, rendered from real calculator results via `calculateResults.tsx`
- `UI/__tests__/` - The currency input, the dialog shell, the theme switch and the error boundary
- `shared/__tests__/` - Pieces the breakdowns share: bracket tables, itemized deduction details, the payment summary

The numbers themselves are tested in `lib/__tests__/`; component tests check that they are shown, not how they are worked out.

Run tests with `bun run test:run` (plain `bun test` uses Bun's own runner, which has no DOM for the component tests).

## Adding a New State Display

1. Create `States/{State}Breakdown.tsx`
2. Import shared components from `shared/`
3. Add case to `TaxResultsDisplay.tsx` switch statement
4. Add tests in `States/__tests__/{State}Breakdown.test.tsx`
