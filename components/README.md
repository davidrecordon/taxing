# React Components

UI components for the tax calculator application.

## Structure

```
components/
  TaxCalculator.tsx      # Main orchestrator - connects inputs to calculators to display
  Displays/              # Result display components
    FederalBreakdown.tsx   # Federal tax breakdown with brackets, FICA, safe harbor
    TaxResultsDisplay.tsx  # Routes to appropriate federal/state displays
  Forms/                 # Input form components
    ConfigurationSection.tsx  # Filing status and state selection
    DeductionInputs.tsx       # Deductions (property tax, mortgage, charitable, 401k)
    IncomeInputs.tsx          # Income fields (wages, capital gains)
    PriorYearInputs.tsx       # Prior year tax and loss carryovers
    WithholdingInputs.tsx     # Tax withholding and estimated payments
  Modals/                # Modal dialogs
    CharitableWhatIfModal.tsx      # "What if" scenario for charitable contributions
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
    TaxSummarySection.tsx  # Reusable payment summary section
  UI/                    # Reusable UI primitives
    AnalyticsWrapper.tsx   # Analytics integration wrapper
    CurrencyInput.tsx      # Formatted currency input field
    ErrorBoundary.tsx      # React error boundary
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

## Testing

Tests are colocated with components in `__tests__/` subdirectories:
- `Forms/__tests__/` - Form interaction tests
- `Displays/__tests__/` - Display rendering tests
- `UI/__tests__/` - UI component tests
- `shared/__tests__/` - Shared component tests

Run tests with `npm test`.

## Adding a New State Display

1. Create `States/{State}Breakdown.tsx`
2. Import shared components from `shared/`
3. Add case to `TaxResultsDisplay.tsx` switch statement
4. Add tests in `States/__tests__/{State}Breakdown.test.tsx`
