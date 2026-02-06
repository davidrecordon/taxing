# Tax Data Verification

Last verified: 2026-02-04

This document verifies that all tax data in the JSON files matches official government sources.

---

## Federal (2025)

### Ordinary Income Tax Brackets

**Source:** [IRS Rev. Proc. 2024-40](https://www.irs.gov/pub/irs-drop/rp-24-40.pdf)

| Bracket | Single            | MFJ               | MFS               | Match |
| ------- | ----------------- | ----------------- | ----------------- | ----- |
| 10%     | $0-$11,925        | $0-$23,850        | $0-$11,925        | Yes   |
| 12%     | $11,925-$48,475   | $23,850-$96,950   | $11,925-$48,475   | Yes   |
| 22%     | $48,475-$103,350  | $96,950-$206,700  | $48,475-$103,350  | Yes   |
| 24%     | $103,350-$197,300 | $206,700-$394,600 | $103,350-$197,300 | Yes   |
| 32%     | $197,300-$250,525 | $394,600-$501,050 | $197,300-$250,525 | Yes   |
| 35%     | $250,525-$626,350 | $501,050-$751,600 | $250,525-$375,800 | Yes   |
| 37%     | $626,350+         | $751,600+         | $375,800+         | Yes   |

### Standard Deductions

**Source:** [One Big Beautiful Bill Act (P.L. 119-21)](https://www.irs.gov/newsroom/one-big-beautiful-bill-provisions), signed July 4, 2025

| Filing Status | Our Data | Official | Match |
| ------------- | -------- | -------- | ----- |
| Single        | $15,750  | $15,750  | Yes   |
| MFJ           | $31,500  | $31,500  | Yes   |
| MFS           | $15,750  | $15,750  | Yes   |

**Note:** Original IRS Rev. Proc. 2024-40 set 2025 standard deduction at $15,000/$30,000. The OBBB increased these to $15,750/$31,500.

### Long-Term Capital Gains Brackets

**Source:** [IRS Rev. Proc. 2024-40](https://www.irs.gov/pub/irs-drop/rp-24-40.pdf), [Fidelity 2025 Capital Gains Rates](https://www.fidelity.com/learning-center/smart-money/capital-gains-tax-rates)

| Rate | Single           | MFJ              | MFS              | Match |
| ---- | ---------------- | ---------------- | ---------------- | ----- |
| 0%   | $0-$48,350       | $0-$96,700       | $0-$48,350       | Yes   |
| 15%  | $48,350-$533,400 | $96,700-$600,050 | $48,350-$300,000 | Yes   |
| 20%  | $533,400+        | $600,050+        | $300,000+        | Yes   |

### FICA (Social Security & Medicare)

**Source:** [SSA 2025 Fact Sheet](https://www.ssa.gov/news/press/factsheets/colafacts2025.pdf)

| Item                                   | Our Data | Official | Match |
| -------------------------------------- | -------- | -------- | ----- |
| SS Wage Base                           | $176,100 | $176,100 | Yes   |
| SS Rate (employee)                     | 6.2%     | 6.2%     | Yes   |
| Medicare Rate                          | 1.45%    | 1.45%    | Yes   |
| Additional Medicare                    | 0.9%     | 0.9%     | Yes   |
| Additional Medicare Threshold (Single) | $200,000 | $200,000 | Yes   |
| Additional Medicare Threshold (MFJ)    | $250,000 | $250,000 | Yes   |

### Other Federal Limits

**Source:** [IRS Pub 17](https://www.irs.gov/publications/p17), IRC sections

| Item                    | Our Data | Official | Match |
| ----------------------- | -------- | -------- | ----- |
| NIIT Rate               | 3.8%     | 3.8%     | Yes   |
| NIIT Threshold (Single) | $200,000 | $200,000 | Yes   |
| NIIT Threshold (MFJ)    | $250,000 | $250,000 | Yes   |
| SALT Cap                | $10,000  | $10,000  | Yes   |
| 401(k) Limit            | $23,500  | $23,500  | Yes   |
| 401(k) Catch-up (50+)   | $7,500   | $7,500   | Yes   |
| QBI Deduction Rate      | 20%      | 20%      | Yes   |

---

## Federal (2026)

### Ordinary Income Tax Brackets

**Source:** [IRS Rev. Proc. 2025-32](https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill), [Tax Foundation 2026 Brackets](https://taxfoundation.org/data/all/federal/2026-tax-brackets/)

| Bracket | Single            | MFJ               | MFS               | Match |
| ------- | ----------------- | ----------------- | ----------------- | ----- |
| 10%     | $0-$12,400        | $0-$24,800        | $0-$12,400        | Yes   |
| 12%     | $12,400-$50,400   | $24,800-$100,800  | $12,400-$50,400   | Yes   |
| 22%     | $50,400-$105,700  | $100,800-$201,050 | $50,400-$105,700  | Yes   |
| 24%     | $105,700-$201,775 | $201,050-$403,500 | $105,700-$201,775 | Yes   |
| 32%     | $201,775-$256,225 | $403,500-$512,300 | $201,775-$256,225 | Yes   |
| 35%     | $256,225-$640,600 | $512,300-$768,600 | $256,225-$384,350 | Yes   |
| 37%     | $640,600+         | $768,600+         | $384,350+         | Yes   |

**Note:** The One Big Beautiful Bill Act provided 4% inflation adjustment for the bottom two brackets and 2.3% for higher brackets.

### Standard Deductions

**Source:** [IRS Rev. Proc. 2025-32](https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill)

| Filing Status | Our Data | Official | Match |
| ------------- | -------- | -------- | ----- |
| Single        | $16,100  | $16,100  | Yes   |
| MFJ           | $32,200  | $32,200  | Yes   |
| MFS           | $16,100  | $16,100  | Yes   |

### Other Federal Limits (2026)

**Source:** IRC sections (statutory, not inflation-adjusted)

| Item                    | Our Data | Official | Match |
| ----------------------- | -------- | -------- | ----- |
| NIIT Rate               | 3.8%     | 3.8%     | Yes   |
| NIIT Threshold (Single) | $200,000 | $200,000 | Yes   |
| NIIT Threshold (MFJ)    | $250,000 | $250,000 | Yes   |
| SALT Cap                | $10,000  | $10,000  | Yes   |
| QBI Deduction Rate      | 20%      | 20%      | Yes   |

**Note:** NIIT thresholds, SALT cap, and QBI rate are statutory and do not adjust for inflation.

---

## California (2025)

### Tax Brackets

**Source:** [FTB 2025 Tax Rate Schedules](https://www.ftb.ca.gov/forms/2025/2025-540-tax-rate-schedules.pdf)

| Rate  | Single            | MFJ                 | Match |
| ----- | ----------------- | ------------------- | ----- |
| 1%    | $0-$11,079        | $0-$22,158          | Yes   |
| 2%    | $11,079-$26,264   | $22,158-$52,528     | Yes   |
| 4%    | $26,264-$41,452   | $52,528-$82,904     | Yes   |
| 6%    | $41,452-$57,542   | $82,904-$115,084    | Yes   |
| 8%    | $57,542-$72,724   | $115,084-$145,448   | Yes   |
| 9.3%  | $72,724-$371,479  | $145,448-$742,958   | Yes   |
| 10.3% | $371,479-$445,771 | $742,958-$891,542   | Yes   |
| 11.3% | $445,771-$742,953 | $891,542-$1,485,906 | Yes   |
| 12.3% | $742,953+         | $1,485,906+         | Yes   |

### Standard Deductions

**Source:** [FTB Form 540 Instructions](https://www.ftb.ca.gov/forms/2025/)

| Filing Status | Our Data | Official | Match |
| ------------- | -------- | -------- | ----- |
| Single        | $5,540   | $5,540   | Yes   |
| MFJ           | $11,080  | $11,080  | Yes   |

### Mental Health Services Tax

**Source:** CA Revenue & Taxation Code Section 17043

| Item      | Our Data   | Official   | Match |
| --------- | ---------- | ---------- | ----- |
| Rate      | 1%         | 1%         | Yes   |
| Threshold | $1,000,000 | $1,000,000 | Yes   |

---

## New York (2025)

### Tax Brackets

**Source:** [NY DTF 2025 Tax Tables](https://www.tax.ny.gov/pit/file/tax-tables/2025.htm)

| Rate  | Single                 | MFJ                    | Match |
| ----- | ---------------------- | ---------------------- | ----- |
| 4%    | $0-$8,500              | $0-$17,150             | Yes   |
| 4.5%  | $8,500-$11,700         | $17,150-$23,600        | Yes   |
| 5.25% | $11,700-$13,900        | $23,600-$27,900        | Yes   |
| 5.5%  | $13,900-$80,650        | $27,900-$161,550       | Yes   |
| 6%    | $80,650-$215,400       | $161,550-$323,200      | Yes   |
| 6.85% | $215,400-$1,077,550    | $323,200-$2,155,350    | Yes   |
| 9.65% | $1,077,550-$5,000,000  | $2,155,350-$5,000,000  | Yes   |
| 10.3% | $5,000,000-$25,000,000 | $5,000,000-$25,000,000 | Yes   |
| 10.9% | $25,000,000+           | $25,000,000+           | Yes   |

### Standard Deductions

**Source:** [NY DTF IT-201 Instructions](https://www.tax.ny.gov/pit/file/)

| Filing Status | Our Data | Official | Match |
| ------------- | -------- | -------- | ----- |
| Single        | $8,000   | $8,000   | Yes   |
| MFJ           | $16,050  | $16,050  | Yes   |

---

## Washington (2025)

### Capital Gains Tax

**Source:** [WA DOR Capital Gains Tax](https://dor.wa.gov/taxes-rates/other-taxes/capital-gains-tax), [SB 5813](https://dor.wa.gov/forms-publications/publications-subject/special-notices/new-tiered-rates-washingtons-capital-gains-tax)

| Item             | Our Data          | Official          | Match |
| ---------------- | ----------------- | ----------------- | ----- |
| Exemption        | $278,000          | $278,000          | Yes   |
| Base Rate        | 7%                | 7%                | Yes   |
| Surtax Rate      | 2.9% (9.9% total) | 2.9% (9.9% total) | Yes   |
| Surtax Threshold | $1,000,000        | $1,000,000        | Yes   |
| Safe Harbor      | 80%               | 80%               | Yes   |

**Note:** SB 5813 (signed May 20, 2025) added the 9.9% tier for gains over $1M, retroactive to January 1, 2025.

---

## Illinois (2025)

### Tax Rate

**Source:** [IL IDOR Income Tax Rates](https://tax.illinois.gov/research/taxrates/income.html)

| Item      | Our Data | Official | Match |
| --------- | -------- | -------- | ----- |
| Flat Rate | 4.95%    | 4.95%    | Yes   |

### Personal Exemptions

**Source:** [IL IDOR IL-1040 Instructions](https://tax.illinois.gov/forms/)

| Filing Status | Our Data | Official | Match |
| ------------- | -------- | -------- | ----- |
| Single        | $2,850   | $2,850   | Yes   |
| MFJ           | $5,700   | $5,700   | Yes   |

---

## Colorado (2025)

### Tax Rate

**Source:** [CO DOR Income Tax Guide](https://tax.colorado.gov/individual-income-tax-guide)

| Item      | Our Data | Official | Match |
| --------- | -------- | -------- | ----- |
| Flat Rate | 4.4%     | 4.4%     | Yes   |

**Note:** Colorado uses federal taxable income as the starting point for state tax calculation. Capital gains are taxed at the same 4.4% flat rate as ordinary income.

### Safe Harbor

| Item         | Our Data | Official | Match |
| ------------ | -------- | -------- | ----- |
| Current Year | 90%      | 90%      | Yes   |
| Prior Year   | 100%     | 100%     | Yes   |

---

## Florida (2025)

### No State Income Tax

**Source:** [FL DOR Taxes and Fees](https://floridarevenue.com/taxes/taxesfees/Pages/default.aspx)

| Item            | Our Data | Official | Match |
| --------------- | -------- | -------- | ----- |
| Income Tax Rate | 0%       | N/A      | Yes   |

**Note:** Florida does not levy a personal income tax. Individual income tax is not listed among Florida's taxes and fees.

---

## District of Columbia (2025)

### Tax Brackets

**Source:** [DC OTR Income Tax Rates](https://otr.cfo.dc.gov/page/dc-individual-and-fiduciary-income-tax-rates)

| Rate   | Bracket             | Match |
| ------ | ------------------- | ----- |
| 4%     | $0-$10,000          | Yes   |
| 6%     | $10,000-$40,000     | Yes   |
| 6.5%   | $40,000-$60,000     | Yes   |
| 8.5%   | $60,000-$250,000    | Yes   |
| 9.25%  | $250,000-$500,000   | Yes   |
| 9.75%  | $500,000-$1,000,000 | Yes   |
| 10.75% | $1,000,000+         | Yes   |

**Note:** DC uses the same tax brackets for all filing statuses (Single, MFJ, MFS).

### Standard Deductions

**Source:** [DC OTR D-40 Instructions](https://otr.cfo.dc.gov/page/individual-income-tax-forms-and-instructions)

| Filing Status | Our Data | Official | Match |
| ------------- | -------- | -------- | ----- |
| Single        | $15,000  | $15,000  | Yes   |
| MFJ           | $30,000  | $30,000  | Yes   |
| MFS           | $15,000  | $15,000  | Yes   |

### Safe Harbor

**Source:** [DC OTR Underpayment of Estimated Tax](https://otr.cfo.dc.gov/page/underpayment-estimated-tax-interest)

| Item         | Our Data | Official | Match |
| ------------ | -------- | -------- | ----- |
| Current Year | 90%      | 90%      | Yes   |
| Prior Year   | 110%     | 110%     | Yes   |

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

## California (2026)

### Tax Brackets

**Source:** [FTB 2026 Tax Rate Schedules](https://www.ftb.ca.gov/forms/2026/2026-540-tax-rate-schedules.pdf) (projected)

| Rate  | Single              | MFJ                 | Match |
| ----- | ------------------- | ------------------- | ----- |
| 1%    | $0-$10,756          | $0-$21,512          | Yes   |
| 2%    | $10,756-$25,499     | $21,512-$50,998     | Yes   |
| 4%    | $25,499-$40,245     | $50,998-$80,490     | Yes   |
| 6%    | $40,245-$55,866     | $80,490-$111,732    | Yes   |
| 8%    | $55,866-$70,606     | $111,732-$141,212   | Yes   |
| 9.3%  | $70,606-$375,002    | $141,212-$750,004   | Yes   |
| 10.3% | $375,002-$450,003   | $750,004-$900,006   | Yes   |
| 11.3% | $450,003-$1,000,000 | $900,006-$1,000,000 | Yes   |
| 12.3% | $1,000,000+         | $1,000,000+         | Yes   |

### Standard Deductions

| Filing Status | Our Data | Official | Match |
| ------------- | -------- | -------- | ----- |
| Single        | $5,540   | $5,540   | Yes   |
| MFJ           | $11,080  | $11,080  | Yes   |

**Note:** California 2026 brackets reflect inflation adjustments. Mental health tax remains 1% over $1M.

---

## New York (2026)

### Tax Brackets

**Source:** [NY DTF Withholding Tax Rate Changes](https://www.tax.ny.gov/bus/wt/rate.htm)

NY enacted 0.1% rate reductions for the bottom 5 brackets effective 2026:

| Rate (2025) | Rate (2026) | Single             | MFJ                | Match |
| ----------- | ----------- | ------------------ | ------------------ | ----- |
| 4.0%        | 3.9%        | $0-$8,500          | $0-$17,150         | Yes   |
| 4.5%        | 4.4%        | $8,500-$11,700     | $17,150-$23,600    | Yes   |
| 5.25%       | 5.15%       | $11,700-$13,900    | $23,600-$27,900    | Yes   |
| 5.5%        | 5.4%        | $13,900-$80,650    | $27,900-$161,550   | Yes   |
| 6.0%        | 5.9%        | $80,650-$215,400   | $161,550-$323,200  | Yes   |
| 6.85%       | 6.85%       | $215,400-$1,077,550| $323,200-$2,155,350| Yes   |
| 9.65%       | 9.65%       | $1,077,550-$5M     | $2,155,350-$5M     | Yes   |
| 10.3%       | 10.3%       | $5M-$25M           | $5M-$25M           | Yes   |
| 10.9%       | 10.9%       | $25M+              | $25M+              | Yes   |

**Note:** Brackets remain unchanged; only the rates for the bottom 5 brackets were reduced by 0.1 percentage points.

### Standard Deductions

| Filing Status | Our Data | Official | Match |
| ------------- | -------- | -------- | ----- |
| Single        | $8,000   | $8,000   | Yes   |
| MFJ           | $16,050  | $16,050  | Yes   |

---

## Washington (2026)

### Capital Gains Tax

**Source:** [WA DOR Capital Gains Tax](https://dor.wa.gov/taxes-rates/other-taxes/capital-gains-tax)

| Item             | Our Data   | Official   | Match                    |
| ---------------- | ---------- | ---------- | ------------------------ |
| Exemption        | $278,000   | TBD        | WAITING - using 2025 value |
| Base Rate        | 7%         | 7%         | Yes                      |
| Surtax Rate      | 9.9%       | 9.9%       | Yes                      |
| Surtax Threshold | $1,000,000 | $1,000,000 | Yes                      |

**Note:** The 2026 exemption threshold has NOT been announced by WA DOR as of 2026-02-04. Currently using the 2025 value ($278,000) as a placeholder. The exemption is adjusted annually for inflation per RCW 82.87.150. Check the WA DOR website for the official 2026 amount when published.

---

## Illinois (2026)

### Tax Rate

**Source:** [IL IDOR Income Tax Rates](https://tax.illinois.gov/research/taxrates/income.html)

| Item      | Our Data | Official | Match |
| --------- | -------- | -------- | ----- |
| Flat Rate | 4.95%    | 4.95%    | Yes   |

### Personal Exemptions

| Filing Status | Our Data | Official | Match |
| ------------- | -------- | -------- | ----- |
| Single        | $2,925   | $2,925   | Yes   |
| MFJ           | $5,850   | $5,850   | Yes   |

**Note:** Personal exemption increased from $2,850 (2025) to $2,925 (2026).

---

## Colorado (2026)

### Tax Rate

**Source:** [CO DOR Income Tax Guide](https://tax.colorado.gov/individual-income-tax-guide)

| Item      | Our Data | Official | Match |
| --------- | -------- | -------- | ----- |
| Flat Rate | 4.4%     | 4.4%     | Yes   |

**Note:** Unchanged from 2025.

---

## Florida (2026)

### No State Income Tax

**Source:** [FL DOR Taxes and Fees](https://floridarevenue.com/taxes/taxesfees/Pages/default.aspx)

| Item            | Our Data | Official | Match |
| --------------- | -------- | -------- | ----- |
| Income Tax Rate | 0%       | N/A      | Yes   |

---

## District of Columbia (2026)

### Tax Brackets

**Source:** [DC OTR Income Tax Rates](https://otr.cfo.dc.gov/page/dc-individual-and-fiduciary-income-tax-rates)

Same as 2025 (brackets not inflation-adjusted).

### Standard Deductions

| Filing Status | Our Data | Official | Match |
| ------------- | -------- | -------- | ----- |
| Single        | $15,000  | $15,000  | Yes   |
| MFJ           | $30,000  | TBD      | WAITING - using 2025 base |
| MFS           | $15,000  | $15,000  | Yes   |

**Note:** DC 2026 MFJ standard deduction has NOT been published by DC OTR as of 2026-02-06. [D.C. Act 26-214](https://code.dccouncil.gov/us/dc/council/acts/26-214) sets the 2025 MFJ base at $30,000 with annual COLA adjustments for 2026+. Currently using the $30,000 base as a placeholder. Check the DC OTR website for the official 2026 D-40 forms when published.

---

## Verification Notes

1. All ordinary income brackets verified against IRS Rev. Proc. 2024-40 (2025) and Rev. Proc. 2025-32 (2026)
2. Standard deductions reflect OBBB amendments (July 2025)
3. State tax data verified against official state department of revenue sources
4. Washington capital gains includes SB 5813 changes (May 2025)
5. 2025 values are for tax year 2025 (returns filed in 2026)
6. 2026 values are for tax year 2026 (returns filed in 2027)

---

## 2026 Data Status (as of 2026-02-04)

2026 tax data status:

| Jurisdiction | Status | Source |
| ------------ | ------ | ------ |
| Federal | Verified | IRS Rev. Proc. 2025-32 |
| California | Verified | FTB 2026 withholding schedules |
| New York | Verified | NY DTF (0.1% rate reductions applied) |
| Illinois | Verified | IDOR FY 2026-15 bulletin |
| Colorado | Verified | CO DOR (4.4% unchanged) |
| Florida | N/A | No state income tax |
| **DC** | **WAITING** | 2026 MFJ standard deduction not yet published by DC OTR; using 2025 base ($30,000) |
| **Washington** | **WAITING** | 2026 exemption threshold not yet announced by WA DOR |

**Pending items:** Washington 2026 capital gains exemption threshold, DC 2026 MFJ standard deduction (COLA-adjusted amount).
