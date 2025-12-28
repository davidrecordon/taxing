# Federal & Multi-State Tax Calculator

**Live Demo:** https://taxing-one.vercel.app/

A web-based tax estimation tool for calculating Federal and state income taxes. Supports California, Washington, and New York (including NYC local tax). The calculator helps individuals estimate their tax liability, including support for various income types, deductions, and FICA taxes. Currently configured for the 2025 tax year.

## Features

- **Multi-State Support**:
  - **California**: Full income tax with mental health services tax for high earners
  - **Washington**: Capital gains tax only (no wage income tax)
  - **New York**: State income tax with optional NYC local tax for city residents
- **Filing Statuses**: Single, Married Filing Jointly, Married Filing Separately
- **Income Types**: W-2 wages, short-term and long-term capital gains
- **Deductions**: Automatic standard vs. itemized comparison
  - SALT (State and Local Taxes) with AGI-dependent caps
  - Mortgage interest with balance-based limits
  - Charitable contributions
  - 401(k) pre-tax contributions
- **FICA Taxes**: Social Security and Medicare calculations, including additional Medicare tax
- **Safe Harbor**: Estimated payment calculations to avoid underpayment penalties
- **Loss Carryover**: Support for prior year capital loss carryovers

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

Open [http://localhost:3000](http://localhost:3000) to view the calculator.

## Adding a New State

To add support for a new state:

### 1. Create Data Files

Create the necessary JSON files in `data/`:

- `{state}-brackets.json` - Tax brackets by filing status
- `{state}-deductions.json` - Standard deduction amounts (if applicable)
- `{state}-limits.json` - State-specific limits and safe harbor rules

See [`data/README.md`](data/README.md) for detailed file structure documentation.

### 2. Add Types

In `lib/types.ts`:

- Add state to `TaxState` union type
- Add state label to `STATE_LABELS`
- Create `{State}LimitsData` interface for state-specific limits

### 3. Create Calculator

Create `lib/states/{state}TaxCalculator.ts`:

- Import bracket/deduction/limits data
- Implement tax calculation logic
- Handle state-specific rules (capital gains treatment, surtaxes, etc.)
- Calculate safe harbor requirements

### 4. Create UI Components

Create `components/States/{State}Breakdown.tsx`:

- Display income and deduction flow
- Show bracket-by-bracket tax breakdown
- Display safe harbor information

### 5. Wire It Up

Update the following files:

- `components/ConfigurationSection.tsx` - Add state to dropdown
- `components/TaxCalculator.tsx` - Import data and add calculator case
- `components/TaxResultsDisplay.tsx` - Add breakdown component case
- `lib/__tests__/testData.ts` - Export test data for the new state

### 6. Add Tests

Create `lib/__tests__/{state}TaxCalculator.test.ts` with tests covering:

- Bracket calculations
- Deductions (standard vs. itemized)
- Loss carryovers
- Safe harbor rules
- Edge cases

## Tech Stack

- [Next.js](https://nextjs.org/) - React framework
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Vitest](https://vitest.dev/) - Testing

## Disclaimer

This calculator provides estimates only and should not be used as tax advice. Consult a qualified tax professional for actual tax planning and filing.
