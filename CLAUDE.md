# Claude Code Guidelines

This is a Federal & multi-state tax calculator built with Next.js, TypeScript, and Tailwind CSS.

## Project Structure

```
app/                    # Next.js App Router
components/
  Forms/               # Input form components
  Displays/            # Result display components
  Modals/              # Modal dialogs
  UI/                  # Reusable UI components
  States/              # State-specific breakdown components
  shared/              # Shared display components
  TaxCalculator.tsx    # Main orchestrator component
data/                  # Tax brackets, deductions, limits (JSON)
lib/                   # Calculation logic (see lib/README.md)
```

## Key Patterns

### State Support Pattern
Each supported state follows the same structure:
1. **Data files**: `data/{state}-brackets.json`, `data/{state}-deductions.json`, `data/{state}-limits.json`
2. **Types**: `{State}LimitsData` interface in `lib/types.ts`
3. **Calculator**: `lib/states/{state}TaxCalculator.ts`
4. **Component**: `components/States/{State}Breakdown.tsx`
5. **Tests**: `lib/__tests__/{state}TaxCalculator.test.ts`
6. **Integration**: Wire up in `TaxCalculator.tsx`, `TaxResultsDisplay.tsx`, `ConfigurationSection.tsx`

### Calculation Flow
```
TaxInputs → TaxCalculator.tsx → federalTaxCalculator + stateCalculator → CalculationResults → Display components
```

### Multi-Year Data
All tax data JSON files are keyed by year (e.g., `"2025": { ... }`). The active year is set in `lib/config.ts`.

## Common Tasks
There are multiple `README.md` files throughout the codebase; refer to them regurarly and update them when changes are made which should be better documents.

### Adding a New State
Follow the guide in `README.md` under "Adding a New State". The pattern is well-established.

### Adding a New Input Field
1. Add field to `TaxInputs` type in `lib/types.ts`
2. Add to `defaultInputs` in `TaxCalculator.tsx`
3. Add UI in appropriate form component (`Forms/`)
4. Update calculators to use the new field
5. Add tests

### Modifying Tax Calculations
1. Update the relevant calculator in `lib/` or `lib/states/`
2. Update or add tests in `lib/__tests__/`
3. Run `npm test` to verify

### Updating Tax Data
When updating tax brackets, deductions, or limits in `data/`:
1. Always verify values against official government sources (IRS, FTB, DOR, etc.)
2. Update `data/VERIFICATION.md` with the source URL and verification date
3. Update affected tests with correct expected values
4. Run `npm test` and `npm run build` to verify all tests pass

## Testing & Building

Always run `npm test` and `npm run build` before committing. All tests must pass and the build must succeed.

Tests are colocated with their components:
- `lib/__tests__/` for calculation logic
- `components/*/__tests__/` for React components

## Code Style

- No emojis in code or comments
- Use existing patterns - check similar files before creating new ones
- Prefer editing existing files over creating new ones
- Keep components focused and single-purpose
- Use TypeScript strictly - avoid `any` types
- Alphabetize whenever possible
