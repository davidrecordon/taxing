# Tax Data Verification

Last verified: 2025-12-28

This document verifies that all tax data in the JSON files matches official government sources.

---

## Federal (2025)

### Ordinary Income Tax Brackets
**Source:** [IRS Rev. Proc. 2024-40](https://www.irs.gov/pub/irs-drop/rp-24-40.pdf)

| Bracket | Single | MFJ | MFS | Match |
|---------|--------|-----|-----|-------|
| 10% | $0-$11,925 | $0-$23,850 | $0-$11,925 | Yes |
| 12% | $11,925-$48,475 | $23,850-$96,950 | $11,925-$48,475 | Yes |
| 22% | $48,475-$103,350 | $96,950-$206,700 | $48,475-$103,350 | Yes |
| 24% | $103,350-$197,300 | $206,700-$394,600 | $103,350-$197,300 | Yes |
| 32% | $197,300-$250,525 | $394,600-$501,050 | $197,300-$250,525 | Yes |
| 35% | $250,525-$626,350 | $501,050-$751,600 | $250,525-$375,800 | Yes |
| 37% | $626,350+ | $751,600+ | $375,800+ | Yes |

### Standard Deductions
**Source:** [One Big Beautiful Bill Act (P.L. 119-21)](https://www.irs.gov/newsroom/one-big-beautiful-bill-provisions), signed July 4, 2025

| Filing Status | Our Data | Official | Match |
|---------------|----------|----------|-------|
| Single | $15,750 | $15,750 | Yes |
| MFJ | $31,500 | $31,500 | Yes |
| MFS | $15,750 | $15,750 | Yes |

**Note:** Original IRS Rev. Proc. 2024-40 set 2025 standard deduction at $15,000/$30,000. The OBBB increased these to $15,750/$31,500.

### Long-Term Capital Gains Brackets
**Source:** [IRS Rev. Proc. 2024-40](https://www.irs.gov/pub/irs-drop/rp-24-40.pdf), [Fidelity 2025 Capital Gains Rates](https://www.fidelity.com/learning-center/smart-money/capital-gains-tax-rates)

| Rate | Single | MFJ | MFS | Match |
|------|--------|-----|-----|-------|
| 0% | $0-$48,350 | $0-$96,700 | $0-$48,350 | Yes |
| 15% | $48,350-$533,400 | $96,700-$600,050 | $48,350-$300,000 | Yes |
| 20% | $533,400+ | $600,050+ | $300,000+ | Yes |

### FICA (Social Security & Medicare)
**Source:** [SSA 2025 Fact Sheet](https://www.ssa.gov/news/press/factsheets/colafacts2025.pdf)

| Item | Our Data | Official | Match |
|------|----------|----------|-------|
| SS Wage Base | $176,100 | $176,100 | Yes |
| SS Rate (employee) | 6.2% | 6.2% | Yes |
| Medicare Rate | 1.45% | 1.45% | Yes |
| Additional Medicare | 0.9% | 0.9% | Yes |
| Additional Medicare Threshold (Single) | $200,000 | $200,000 | Yes |
| Additional Medicare Threshold (MFJ) | $250,000 | $250,000 | Yes |

### Other Federal Limits
**Source:** [IRS Pub 17](https://www.irs.gov/publications/p17), IRC sections

| Item | Our Data | Official | Match |
|------|----------|----------|-------|
| NIIT Rate | 3.8% | 3.8% | Yes |
| NIIT Threshold (Single) | $200,000 | $200,000 | Yes |
| NIIT Threshold (MFJ) | $250,000 | $250,000 | Yes |
| SALT Cap | $10,000 | $10,000 | Yes |
| 401(k) Limit | $23,500 | $23,500 | Yes |
| 401(k) Catch-up (50+) | $7,500 | $7,500 | Yes |
| QBI Deduction Rate | 20% | 20% | Yes |

---

## California (2025)

### Tax Brackets
**Source:** [FTB 2025 Tax Rate Schedules](https://www.ftb.ca.gov/forms/2025/2025-540-tax-rate-schedules.pdf)

| Rate | Single | MFJ | Match |
|------|--------|-----|-------|
| 1% | $0-$11,079 | $0-$22,158 | Yes |
| 2% | $11,079-$26,264 | $22,158-$52,528 | Yes |
| 4% | $26,264-$41,452 | $52,528-$82,904 | Yes |
| 6% | $41,452-$57,542 | $82,904-$115,084 | Yes |
| 8% | $57,542-$72,724 | $115,084-$145,448 | Yes |
| 9.3% | $72,724-$371,479 | $145,448-$742,958 | Yes |
| 10.3% | $371,479-$445,771 | $742,958-$891,542 | Yes |
| 11.3% | $445,771-$742,953 | $891,542-$1,485,906 | Yes |
| 12.3% | $742,953+ | $1,485,906+ | Yes |

### Standard Deductions
**Source:** [FTB Form 540 Instructions](https://www.ftb.ca.gov/forms/2025/)

| Filing Status | Our Data | Official | Match |
|---------------|----------|----------|-------|
| Single | $5,540 | $5,540 | Yes |
| MFJ | $11,080 | $11,080 | Yes |

### Mental Health Services Tax
**Source:** CA Revenue & Taxation Code Section 17043

| Item | Our Data | Official | Match |
|------|----------|----------|-------|
| Rate | 1% | 1% | Yes |
| Threshold | $1,000,000 | $1,000,000 | Yes |

---

## New York (2025)

### Tax Brackets
**Source:** [NY DTF 2025 Tax Tables](https://www.tax.ny.gov/pit/file/tax-tables/2025.htm)

| Rate | Single | MFJ | Match |
|------|--------|-----|-------|
| 4% | $0-$8,500 | $0-$17,150 | Yes |
| 4.5% | $8,500-$11,700 | $17,150-$23,600 | Yes |
| 5.25% | $11,700-$13,900 | $23,600-$27,900 | Yes |
| 5.5% | $13,900-$80,650 | $27,900-$161,550 | Yes |
| 6% | $80,650-$215,400 | $161,550-$323,200 | Yes |
| 6.85% | $215,400-$1,077,550 | $323,200-$2,155,350 | Yes |
| 9.65% | $1,077,550-$5,000,000 | $2,155,350-$5,000,000 | Yes |
| 10.3% | $5,000,000-$25,000,000 | $5,000,000-$25,000,000 | Yes |
| 10.9% | $25,000,000+ | $25,000,000+ | Yes |

### Standard Deductions
**Source:** [NY DTF IT-201 Instructions](https://www.tax.ny.gov/pit/file/)

| Filing Status | Our Data | Official | Match |
|---------------|----------|----------|-------|
| Single | $8,000 | $8,000 | Yes |
| MFJ | $16,050 | $16,050 | Yes |

---

## Washington (2025)

### Capital Gains Tax
**Source:** [WA DOR Capital Gains Tax](https://dor.wa.gov/taxes-rates/other-taxes/capital-gains-tax), [SB 5813](https://dor.wa.gov/forms-publications/publications-subject/special-notices/new-tiered-rates-washingtons-capital-gains-tax)

| Item | Our Data | Official | Match |
|------|----------|----------|-------|
| Exemption | $278,000 | $278,000 | Yes |
| Base Rate | 7% | 7% | Yes |
| Surtax Rate | 2.9% (9.9% total) | 2.9% (9.9% total) | Yes |
| Surtax Threshold | $1,000,000 | $1,000,000 | Yes |
| Safe Harbor | 80% | 80% | Yes |

**Note:** SB 5813 (signed May 20, 2025) added the 9.9% tier for gains over $1M, retroactive to January 1, 2025.

---

## Illinois (2025)

### Tax Rate
**Source:** [IL IDOR Income Tax Rates](https://tax.illinois.gov/research/taxrates/income.html)

| Item | Our Data | Official | Match |
|------|----------|----------|-------|
| Flat Rate | 4.95% | 4.95% | Yes |

### Personal Exemptions
**Source:** [IL IDOR IL-1040 Instructions](https://tax.illinois.gov/forms/)

| Filing Status | Our Data | Official | Match |
|---------------|----------|----------|-------|
| Single | $2,850 | $2,850 | Yes |
| MFJ | $5,700 | $5,700 | Yes |

---

## Colorado (2025)

### Tax Rate
**Source:** [CO DOR Income Tax Guide](https://tax.colorado.gov/individual-income-tax-guide)

| Item | Our Data | Official | Match |
|------|----------|----------|-------|
| Flat Rate | 4.4% | 4.4% | Yes |

**Note:** Colorado uses federal taxable income as the starting point for state tax calculation. Capital gains are taxed at the same 4.4% flat rate as ordinary income.

### Safe Harbor
| Item | Our Data | Official | Match |
|------|----------|----------|-------|
| Current Year | 90% | 90% | Yes |
| Prior Year | 100% | 100% | Yes |

---

## Florida (2025)

### No State Income Tax
**Source:** [FL DOR Taxes and Fees](https://floridarevenue.com/taxes/taxesfees/Pages/default.aspx)

| Item | Our Data | Official | Match |
|------|----------|----------|-------|
| Income Tax Rate | 0% | N/A | Yes |

**Note:** Florida does not levy a personal income tax. Individual income tax is not listed among Florida's taxes and fees.

---

## Discrepancies Fixed (2025-12-28)

### 1. Federal Standard Deduction
- **Before:** Single/MFS $15,700
- **After:** Single/MFS $15,750
- **Source:** One Big Beautiful Bill Act increased from original IRS Rev. Proc. 2024-40 values

### 2. Federal LTCG Brackets
- **Before:** Used 2024 thresholds ($47,025 single, $94,050 MFJ for 0%)
- **After:** Correct 2025 thresholds ($48,350 single, $96,700 MFJ for 0%)
- **Source:** IRS Rev. Proc. 2024-40

---

## Verification Notes

1. All ordinary income brackets verified against IRS Rev. Proc. 2024-40
2. Standard deductions reflect OBBB amendments (July 2025)
3. State tax data verified against official state department of revenue sources
4. Washington capital gains includes SB 5813 changes (May 2025)
5. All values are for tax year 2025 (returns filed in 2026)
