# Federal & California Tax Calculator

**Live Demo:** https://taxing-one.vercel.app/

A web-based tax estimation tool for calculating both Federal and California state income taxes. The calculator helps individuals estimate their tax liability, including support for various income types, deductions, and FICA taxes. Currently configured for the 2025 tax year, with 2026 Federal tax data being added.

## Features

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

## Tech Stack

- [Next.js](https://nextjs.org/) - React framework
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Tailwind CSS](https://tailwindcss.com/) - Styling

## Disclaimer

This calculator provides estimates only and should not be used as tax advice. Consult a qualified tax professional for actual tax planning and filing.
