# Federal & Multi-State Tax Calculator

**Live:** https://estimate.tax/

A web-based tax estimation tool for calculating Federal and state income taxes. Supports California, Colorado, District of Columbia, Florida, Illinois, New York (including NYC local tax), and Washington. The calculator helps individuals estimate their tax liability, including support for various income types, deductions, and FICA taxes. Supports the 2025 and 2026 tax years; 2026 is the default.

## Features

- **Multi-State Support**:
  - **California**: Full income tax with mental health services tax for high earners
  - **Colorado**: Flat 4.4% income tax on federal taxable income, with the state deduction addbacks
  - **District of Columbia**: Progressive income tax (4%-10.75%)
  - **Florida**: No state income tax
  - **Illinois**: Flat-rate income tax with personal exemptions and the property tax credit
  - **New York**: State income tax with the tax benefit recapture for higher incomes, and optional NYC local tax with the school tax credit for city residents
  - **Washington**: Capital gains tax only (no wage income tax)
- **Filing Statuses**: Single, Married Filing Jointly, Married Filing Separately
- **Income Types**: Wages, interest, ordinary and qualified dividends, short-term and long-term capital gains
- **Deductions**: Automatic standard vs. itemized comparison
  - SALT (State and Local Taxes) with the AGI-based cap phasedown
  - Mortgage interest with balance-based limits
  - Charitable contributions, including the 2026 floor of 0.5% of AGI
  - The 2026 limit on itemized deductions for top-bracket filers
  - State itemized deductions for California, New York and DC: property tax without the federal cap, state mortgage limits, and each state's income-based reduction
  - 401(k) pre-tax contributions
- **FICA Taxes**: Social Security and Medicare on wages, shown for information and kept out of the tax owed since employers withhold them
- **Safe Harbor**: Estimated payment calculations to avoid underpayment penalties
- **Capital Losses**: Schedule D netting of current year losses and prior year carryovers, including the $3,000 deduction against other income

## Getting Started

```bash
# Install dependencies
bun install

# Run development server
bun run dev

# Run tests
bun run test

# Run linter
bun run lint

# Build for production
bun run build
```

Open [http://localhost:3000](http://localhost:3000) to view the calculator.

## Testing

The project uses [Vitest](https://vitest.dev/) with [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/).

### Running Tests

```bash
bun run test          # Run all tests in watch mode
bun run test:run      # Run tests once (CI mode)
bun run test:coverage # Run with coverage report
```

### Test Structure

- **`lib/__tests__/`** - Unit tests for calculation logic
  - Tax calculators (federal, state-specific)
  - Deduction calculations
  - Utility functions and formatters
- **`components/*/__tests__/`** - React component tests (colocated with components)
  - Form input behavior
  - Display rendering
  - User interactions

Tax data and the rules behind it are checked against official sources; see [`data/VERIFICATION.md`](data/VERIFICATION.md) for sources, known approximations and values still waiting on publication.

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

- `components/Forms/ConfigurationSection.tsx` - Add state to dropdown
- `components/TaxCalculator.tsx` - Import data and add calculator case
- `components/Displays/TaxResultsDisplay.tsx` - Add breakdown component case
- `lib/__tests__/testData.ts` - Export test data for the new state

### 6. Add Tests

Create `lib/__tests__/{state}TaxCalculator.test.ts` with tests covering:

- Bracket calculations
- Deductions (standard vs. itemized)
- Loss carryovers
- Safe harbor rules
- Edge cases

See `lib/__tests__/README.md` for more context on (non-UI) tests.

## Tech Stack

- [Bun](https://bun.sh/) - JavaScript runtime and package manager
- [Next.js](https://nextjs.org/) - React framework
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Vitest](https://vitest.dev/) - Testing

## Privacy

The calculator runs entirely in your browser. There is no account to create and no database: the figures you type are never sent anywhere, and the only network traffic is loading the page and anonymous page-view analytics. Anything that needs to remember your figures between visits will keep them in your own browser via local storage.

The site also offers an MCP endpoint (below) for programs and AI assistants. A program that calls it sends its inputs to the server, which calculates a result and returns it. The server keeps nothing: it has no database, does not write inputs or results to its logs, and uses them for nothing but answering that one request.

## MCP Interface (for AI Assistants)

estimate.tax exposes a [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) endpoint so that AI assistants such as Claude, and other programs, can run the same calculations as the site.

**Endpoint:** `POST https://estimate.tax/api/mcp` (MCP Streamable HTTP, no auth, 600 requests per hour per IP)

Add it to any MCP client as a remote server URL, for example in Claude Code:

```bash
claude mcp add --transport http estimate-tax https://estimate.tax/api/mcp
```

### Available Tools

| Tool                        | What it answers                                                                                      |
| --------------------------- | ---------------------------------------------------------------------------------------------------- |
| `estimate_tax`              | Federal and state tax, amount owed or refund, safe harbor, with notes and assumptions                |
| `check_safe_harbor`         | Whether withholding and payments reach the safe harbor, and how much more is needed                  |
| `compare_charitable_giving` | What each of several gift amounts saves in federal and state tax, and what limits the deduction      |
| `compare_filing_status`     | A couple's tax on one joint return against two separate returns, for a given split                   |
| `estimate_withholding`      | What an employer would withhold over the year on these wages                                         |
| `list_jurisdictions`        | Supported years and states, what each covers, and when the data was verified                         |

Every tool is stateless: send the whole return in the call. Field names are the same as the site's inputs (`federalIncome`, `longTermCapitalGains`, `priorYearFederalTax`, and so on); only `filingStatus` and `selectedState` are required, and withholding left out is estimated from wages, as on the site.

### Example

```bash
curl -X POST https://estimate.tax/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "estimate_tax",
      "arguments": {
        "filingStatus": "single",
        "selectedState": "california",
        "federalIncome": 400000,
        "longTermCapitalGains": 50000,
        "charitableContributions": 20000,
        "priorYearFederalTax": 90000,
        "priorYearStateTax": 30000
      }
    }
  }'
```

## Disclaimer

This calculator provides estimates only and should not be used as tax advice. Consult a qualified tax professional for actual tax planning and filing.
