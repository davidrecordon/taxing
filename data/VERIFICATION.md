# Tax Data Verification

Last verified: 2026-10-19

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
| Additional Medicare Threshold (MFS)    | $125,000 | $125,000 | Yes   |
| Additional Medicare withholding threshold (per employee, any filing status) | $200,000 | $200,000 | Yes   |

**Additional Medicare withholding:** [IRS Form 8959 instructions](https://www.irs.gov/instructions/i8959) and [Topic 560](https://www.irs.gov/taxtopics/tc560): an employer withholds the 0.9% on wages it pays one employee over $200,000 in the year, regardless of filing status, and the withheld amount is credited on the return (Form 8959 Part V, Form 1040 line 25c). The thresholds are statutory and not indexed. The calculator estimates the withheld amount per earner from wages; the spouse's wages on a joint return split the couple's wages into two earners (verified 2026-10-31).

### Other Federal Limits

**Source:** [IRS Pub 17](https://www.irs.gov/publications/p17), [IRS Rev. Proc. 2024-40](https://www.irs.gov/pub/irs-drop/rp-24-40.pdf) section 3.27 (QBI), [26 U.S.C. 164(b)(7)](https://www.law.cornell.edu/uscode/text/26/164) (SALT), IRC sections

| Item                            | Our Data         | Official         | Match |
| ------------------------------- | ---------------- | ---------------- | ----- |
| NIIT Rate                       | 3.8%             | 3.8%             | Yes   |
| NIIT Threshold (Single)         | $200,000         | $200,000         | Yes   |
| NIIT Threshold (MFJ)            | $250,000         | $250,000         | Yes   |
| SALT Cap (Single/MFJ)           | $40,000          | $40,000          | Yes   |
| SALT Cap (MFS)                  | $20,000          | $20,000          | Yes   |
| SALT Phasedown Threshold        | $500,000         | $500,000         | Yes   |
| SALT Phasedown Threshold (MFS)  | $250,000         | $250,000         | Yes   |
| SALT Phasedown Rate             | 30%              | 30%              | Yes   |
| SALT Cap Floor (MFS)            | $10,000 ($5,000) | $10,000 ($5,000) | Yes   |
| 401(k) Limit                    | $23,500          | $23,500          | Yes   |
| 401(k) Catch-up (50+)           | $7,500           | $7,500           | Yes   |
| QBI Deduction Rate              | 20%              | 20%              | Yes   |
| QBI Threshold (Single/MFS)      | $197,300         | $197,300         | Yes   |
| QBI Threshold (MFJ)             | $394,600         | $394,600         | Yes   |
| QBI Phase-in Range (Single/MFS) | $50,000          | $50,000          | Yes   |
| QBI Phase-in Range (MFJ)        | $100,000         | $100,000         | Yes   |

**Mortgage limits (2025 and 2026):** $750,000 ($375,000 MFS), or $1,000,000 ($500,000 MFS) for loans taken out on or before December 15, 2017, selected with a checkbox that appears when the balance is over the standard limit. Source: [2025 Schedule A instructions](https://www.irs.gov/pub/irs-pdf/i1040sca.pdf) ("For qualifying debt taken out on or before December 15, 2017, you can only deduct home mortgage interest on up to $1,000,000 ($500,000 if you are married filing separately)"); Public Law 119-21 section 70108 made the $750,000 limit permanent. Not modelled: a household with both older and newer debt, where the newer limit is reduced by the older debt.

**Correction (2026-10-19):** The QBI thresholds were previously recorded as $191,950 and $383,900 (the 2024 amounts). The SALT cap was previously recorded as $40,000 for MFJ and $20,000 for Single, dropping straight to $10,000 at $500,000 of AGI. The One Big Beautiful Bill Act sets one cap for all filers (half for MFS) and reduces it by 30% of modified AGI over the threshold, down to a $10,000 floor.

**Correction (2026-10-19, MFS):** For married filing separately the full cap is reduced by 30% of modified AGI over half the threshold, floored at $10,000, and then halved (2025 Schedule A State and Local Tax Deduction Worksheet, lines 5 to 10). The first version of this change halved the cap and floor before applying the 30% reduction, which phased the MFS cap down twice as fast as the law does.

---

## Federal (2026)

### Ordinary Income Tax Brackets

**Source:** [IRS Rev. Proc. 2025-32](https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill), [Tax Foundation 2026 Brackets](https://taxfoundation.org/data/all/federal/2026-tax-brackets/)

| Bracket | Single            | MFJ               | MFS               | Match |
| ------- | ----------------- | ----------------- | ----------------- | ----- |
| 10%     | $0-$12,400        | $0-$24,800        | $0-$12,400        | Yes   |
| 12%     | $12,400-$50,400   | $24,800-$100,800  | $12,400-$50,400   | Yes   |
| 22%     | $50,400-$105,700  | $100,800-$211,400 | $50,400-$105,700  | Yes   |
| 24%     | $105,700-$201,775 | $211,400-$403,550 | $105,700-$201,775 | Yes   |
| 32%     | $201,775-$256,225 | $403,550-$512,450 | $201,775-$256,225 | Yes   |
| 35%     | $256,225-$640,600 | $512,450-$768,700 | $256,225-$384,350 | Yes   |
| 37%     | $640,600+         | $768,700+         | $384,350+         | Yes   |

**Note:** The One Big Beautiful Bill Act provided 4% inflation adjustment for the bottom two brackets and 2.3% for higher brackets.

**Correction (2026-10-05):** The MFJ thresholds for the 24%, 32%, 35%, and 37% brackets were previously recorded as $201,050, $403,500, $512,300, and $768,600. They were corrected to $211,400, $403,550, $512,450, and $768,700 after re-verifying against the IRS release and the Tax Foundation table.

### Standard Deductions

**Source:** [IRS Rev. Proc. 2025-32](https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill)

| Filing Status | Our Data | Official | Match |
| ------------- | -------- | -------- | ----- |
| Single        | $16,100  | $16,100  | Yes   |
| MFJ           | $32,200  | $32,200  | Yes   |
| MFS           | $16,100  | $16,100  | Yes   |

### Other Federal Limits (2026)

**Source:** [IRS Rev. Proc. 2025-32](https://www.irs.gov/pub/irs-drop/rp-25-32.pdf) section 4.26 (QBI), [26 U.S.C. 164(b)(7)](https://www.law.cornell.edu/uscode/text/26/164) (SALT), IRC sections

| Item                            | Our Data         | Official         | Match |
| ------------------------------- | ---------------- | ---------------- | ----- |
| NIIT Rate                       | 3.8%             | 3.8%             | Yes   |
| NIIT Threshold (Single)         | $200,000         | $200,000         | Yes   |
| NIIT Threshold (MFJ)            | $250,000         | $250,000         | Yes   |
| SALT Cap (Single/MFJ)           | $40,400          | $40,400          | Yes   |
| SALT Cap (MFS)                  | $20,200          | $20,200          | Yes   |
| SALT Phasedown Threshold        | $505,000         | $505,000         | Yes   |
| SALT Phasedown Threshold (MFS)  | $252,500         | $252,500         | Yes   |
| SALT Phasedown Rate             | 30%              | 30%              | Yes   |
| SALT Cap Floor (MFS)            | $10,000 ($5,000) | $10,000 ($5,000) | Yes   |
| QBI Deduction Rate              | 20%              | 20%              | Yes   |
| QBI Threshold (Single)          | $201,750         | $201,750         | Yes   |
| QBI Threshold (MFS)             | $201,775         | $201,775         | Yes   |
| QBI Threshold (MFJ)             | $403,500         | $403,500         | Yes   |
| QBI Phase-in Range (Single/MFS) | $75,000          | $75,000          | Yes   |
| QBI Phase-in Range (MFJ)        | $150,000         | $150,000         | Yes   |

**Note:** NIIT thresholds and the QBI rate are statutory and do not adjust for inflation. The SALT cap and its phasedown threshold are set by statute and rise 1% a year through 2029. The QBI phase-in range is stored as a width (the Rev. Proc. lists the end of the range: $276,750, $276,775, and $553,500).

**Correction (2026-10-19):** The QBI thresholds and phase-in ranges were previously the 2024 amounts ($191,950 / $383,900 with $50,000 / $100,000 ranges), and the SALT cap was the 2025 amount with the same errors described under Federal (2025).

### Itemized Deduction Changes (2026)

**Source:** [Public Law 119-21](https://www.govinfo.gov/content/pkg/PLAW-119publ21/html/PLAW-119publ21.htm) sections 70111 (IRC 68) and 70425 (IRC 170(b)(1)(I)), [draft 2026 Schedule A](https://www.irs.gov/pub/irs-dft/f1040sa--dft.pdf) line 18, [Rev. Proc. 2025-32](https://www.irs.gov/pub/irs-drop/rp-25-32.pdf) section 4.01, [Pub. 505 (2026)](https://www.irs.gov/pub/irs-pdf/p505.pdf) Worksheets 2-5 and 2-6

| Item                                  | Our Data | Official | Match |
| ------------------------------------- | -------- | -------- | ----- |
| Charitable floor (share of AGI)       | 0.5%     | 0.5%     | Yes   |
| Overall limitation fraction           | 2/37     | 2/37     | Yes   |
| Overall limitation threshold (Single) | $640,600 | $640,600 | Yes   |
| Overall limitation threshold (MFJ)    | $768,700 | $768,700 | Yes   |
| Overall limitation threshold (MFS)    | $384,350 | $384,350 | Yes   |

**Notes:** Neither rule applies for 2025 (rate 0 and numerator 0 in the data). The overall limitation threshold is the start of the 37% bracket and is read from `federal-brackets.json`, not stored separately. It is applied after every other limit, to AGI less the QBI deduction, and the QBI deduction is computed without regard to it. The statute says 2/37; the 2026 Form 1040-ES and Pub. 505 worksheets use 5.4%, a difference of about $0.54 per $1,000. Not modelled: the non-itemizer charitable deduction ($1,000, $2,000 joint, cash gifts only), and the percentage-of-AGI limits on charitable gifts.

### Self-Employment Income: QBI Base and Additional Medicare Tax

**Sources:** [Instructions for Form 8995](https://www.irs.gov/instructions/i8995) ("Determining Your Qualified Business Income"); [Instructions for Form 8959](https://www.irs.gov/instructions/i8959), Part II. Verified 2026-10-20.

| Rule | Calculator | Official |
| ---- | ---------- | -------- |
| Qualified business income | Business income less the deductible half of self-employment tax | Items attributable to the business are taken into account, including the "deductible part of self-employment tax" |
| Additional Medicare tax on self-employment income | 0.9% of net earnings (92.35% of business income) over the threshold | 0.9% of self-employment income from Schedule SE over the threshold |
| Threshold | $200,000, $250,000 joint, $125,000 separate, less wages, not below zero | Same; "reduced (but not below zero) by the total amount of Medicare wages" |

**Notes:** The Additional Medicare tax on self-employment earnings is part of total tax, the amount owed and the safe harbor, because nobody withholds it; the same tax on wages is assumed to be withheld and is shown for information only. It is not part of the deductible half of self-employment tax. Known approximations: the QBI deduction phases out to zero above the threshold, which is right for a specified service business and for a business with no employees or qualified property, and understates the deduction for a business with either; the self-employed health insurance and retirement plan deductions, which would also reduce qualified business income, are not inputs; for a joint return the Social Security wage base and the Additional Medicare threshold are applied to the couple's combined wages and business income as if one person earned them.

**Correction (2026-10-20):** The calculator previously took 20% of gross business income for the QBI deduction, and did not charge the Additional Medicare tax on self-employment earnings.

### Wage Withholding Estimate (2025 and 2026)

**Sources:** [Pub. 15 (2026)](https://www.irs.gov/publications/p15), section 7 Supplemental Wages ("The withholding rate on supplemental wages remains 22% (37% if supplemental wages paid to an employee during the calendar year exceed $1 million)"); [Pub. 15-T](https://www.irs.gov/publications/p15t), Percentage Method Tables for Automated Payroll Systems. Verified 2026-10-30.

| Item                                        | Our Data   | Official   | Match |
| ------------------------------------------- | ---------- | ---------- | ----- |
| Supplemental rate                           | 22%        | 22%        | Yes   |
| Supplemental rate above the threshold       | 37%        | 37%        | Yes   |
| Threshold (supplemental wages in the year)  | $1,000,000 | $1,000,000 | Yes   |

**Notes:** Used only where the user has not entered the amount withheld; an entered amount always wins, and the result says when the figure was estimated. Regular wages (wages less bonuses and stock, 401(k) and pre-tax medical) are withheld on by the ordinary brackets after the standard deduction. That is the percentage method itself for a 2020-or-later W-4 with the Step 2 box unchecked and nothing in Steps 3 and 4: Worksheet 1A line 1g subtracts $8,600 ($12,900 joint) and the 2026 annual STANDARD schedule's 0% band runs to $7,500 ($19,300 joint), which add up to the $16,100 ($32,200) standard deduction, and every later edge is the bracket edge shifted by the same amount (single 10% to $19,900, 12% to $57,900; joint 10% to $44,100, 12% to $120,100). Not modelled: a checked Step 2 box, entries in Steps 3 or 4, a pre-2020 W-4; the pre-tax deductions are taken wholly from regular wages; the Additional Medicare tax withheld is not part of the estimate because payroll tax is kept out of the amount owed. Pub. 15 allows the flat 22% only where income tax was withheld from regular wages this year or last; otherwise the aggregate method applies, which the estimate does not model. The same rates apply for 2025 (Pub. 15 (2025), section 7).

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

**Source:** [FTB Tax News, October 2026 ("2026 Indexing")](https://www.ftb.ca.gov/about-ftb/newsroom/tax-news/index.html), which lists the 2025 amounts alongside 2026

| Filing Status | Our Data | Official | Match |
| ------------- | -------- | -------- | ----- |
| Single        | $5,706   | $5,706   | Yes   |
| MFJ           | $11,412  | $11,412  | Yes   |
| MFS           | $5,706   | $5,706   | Yes   |

**Correction (2026-10-05):** Previously recorded as $5,540/$11,080, which are the 2024 amounts.

### Itemized Deductions

**Source:** [2025 Schedule CA (540) Instructions](https://www.ftb.ca.gov/forms/2025/2025-540-ca-instructions.html) (Part II lines 5a, 5e, 8 and the line 29 Itemized Deductions Worksheet), [FTB Summary of Federal Income Tax Changes](https://www.ftb.ca.gov/about-ftb/data-reports-plans/Summary-of-Federal-Income-Tax-Changes/index.html)

| Item                                     | Our Data   | Official   | Match |
| ---------------------------------------- | ---------- | ---------- | ----- |
| Property tax deductible, no SALT cap     | Yes        | Yes        | Yes   |
| State income tax deductible              | No         | No         | Yes   |
| Mortgage balance limit                   | $1,000,000 | $1,000,000 | Yes   |
| Mortgage balance limit (MFS)             | $500,000   | $500,000   | Yes   |
| High-income limit: rate on excess AGI    | 6%         | 6%         | Yes   |
| High-income limit: maximum reduction     | 80%        | 80%        | Yes   |
| High-income limit threshold (Single/MFS) | $252,203   | $252,203   | Yes   |
| High-income limit threshold (MFJ)        | $504,411   | $504,411   | Yes   |

**Notes:** The limitation uses federal AGI. California does not conform to the 2025 federal law, so the federal 0.5% charitable floor, the 2/37 limit on itemized deductions and the non-itemizer charitable deduction do not apply. Not modelled: the 50%-of-AGI limit on cash gifts, home equity interest, and the rule that both spouses filing separately must make the same choice.

**Correction (2026-10-19):** The calculator previously dropped property tax from California itemized deductions, applied no high-income limitation, and used the $1,000,000 mortgage limit for married filing separately.

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

**Note:** Married filing separately uses the single schedule ([IT-201 instructions, 2025](https://www.tax.ny.gov/forms/html-instructions/2025/it/it201i-2025.htm)). **Correction (2026-10-05):** our MFS data previously ended the 6% bracket at $161,550 instead of $215,400, for both 2025 and 2026.

### Standard Deductions

**Source:** [NY DTF IT-201 Instructions](https://www.tax.ny.gov/pit/file/)

| Filing Status | Our Data | Official | Match |
| ------------- | -------- | -------- | ----- |
| Single        | $8,000   | $8,000   | Yes   |
| MFJ           | $16,050  | $16,050  | Yes   |

### Itemized Deductions

**Source:** [2025 IT-196 Instructions](https://www.tax.ny.gov/pdf/current_forms/it/it196i.pdf) (lines 5 to 15, line 41, and the line 46 Worksheets 3 and 4), [DTF Itemized deductions (2025)](https://www.tax.ny.gov/pit/file/itemized-deductions-2025.htm), [Tax Law section 615](https://www.nysenate.gov/legislation/laws/TAX/615)

| Item                                                   | Our Data    | Official    | Match |
| ------------------------------------------------------ | ----------- | ----------- | ----- |
| Real estate tax deductible, no SALT cap                | Yes         | Yes         | Yes   |
| State and local income tax deductible                  | No          | No          | Yes   |
| Mortgage balance limit                                 | $1,000,000  | $1,000,000  | Yes   |
| Mortgage balance limit (MFS)                           | $500,000    | $500,000    | Yes   |
| Adjustment base (Single/MFS)                           | $100,000    | $100,000    | Yes   |
| Adjustment base (MFJ)                                  | $200,000    | $200,000    | Yes   |
| First tier: share removed, phased in over $50,000      | 25%         | 25%         | Yes   |
| Second tier: phases from 25% to 50% over $50,000 above | $475,000    | $475,000    | Yes   |
| Charitable only (50% of gifts) above NY AGI of         | $1,000,000  | $1,000,000  | Yes   |
| Charitable only (25% of gifts) above NY AGI of         | $10,000,000 | $10,000,000 | Yes   |

**Notes:** The adjustment amounts are statutory (Tax Law 615(f) and (g)) and not indexed, so 2026 uses the same values; the 2026 IT-196 is not yet published. New York itemized deductions use the federal rules as they stood before 2018, so the 2025 federal law changes (0.5% charitable floor, 2/37 limit) are not applied. Not modelled: the older federal overall limitation that IT-196 line 40 still applies above about $340,700 of federal AGI (3% of the excess, at most 80% of deductions; 2025 thresholds $340,700 single, $408,850 joint, $204,400 separate), home equity interest, and the rule that both spouses filing separately must make the same choice.

**Correction (2026-10-19):** The calculator previously dropped property tax from New York itemized deductions, used the federal $750,000 mortgage limit, and applied no income-based adjustment.

### Tax Benefit Recapture

**Source:** [2025 IT-201 Instructions](https://www.tax.ny.gov/pdf/current_forms/it/it201i.pdf) (line 39 and the tax computation worksheets 1 to 11, pages 32 to 37), [Tax Law section 601(d-4)](https://www.nysenate.gov/legislation/laws/TAX/601)

Above $107,650 of NY AGI the benefit of the lower brackets is phased out over the next $50,000 of NY AGI, tier by tier (the fraction is rounded to four decimal places). Above $25,000,000 of NY AGI the tax is 10.9% of taxable income. Married filing separately uses the single amounts.

| Filing status | Taxable income over | Recapture base | Incremental benefit | Match |
| ------------- | ------------------- | -------------- | ------------------- | ----- |
| MFJ           | first tier (5.5%)   | n/a            | n/a                 | Yes   |
| MFJ           | $161,550            | $333           | $807                | Yes   |
| MFJ           | $323,200            | $1,140         | $2,747              | Yes   |
| MFJ           | $2,155,350          | $3,887         | $60,350             | Yes   |
| MFJ           | $5,000,000          | $64,237        | $32,500             | Yes   |
| Single/MFS    | first tier (6%)     | n/a            | n/a                 | Yes   |
| Single/MFS    | $215,400            | $568           | $1,831              | Yes   |
| Single/MFS    | $1,077,550          | $2,399         | $30,172             | Yes   |
| Single/MFS    | $5,000,000          | $32,571        | $32,500             | Yes   |

### New York City School Tax Credit

**Source:** [2025 IT-201 Instructions](https://www.tax.ny.gov/pdf/current_forms/it/it201i.pdf), lines 69 and 69a (pages 20 to 21)

| Item                                                  | Our Data                   | Official                   | Match |
| ----------------------------------------------------- | -------------------------- | -------------------------- | ----- |
| Fixed amount (Single/MFS), income of $250,000 or less | $63                        | $63                        | Yes   |
| Fixed amount (MFJ), income of $250,000 or less        | $125                       | $125                       | Yes   |
| Rate reduction: rate up to the threshold              | 0.171%                     | 0.171%                     | Yes   |
| Rate reduction threshold (Single/MFS)                 | $12,000                    | $12,000                    | Yes   |
| Rate reduction threshold (MFJ)                        | $21,600                    | $21,600                    | Yes   |
| Rate reduction above the threshold (Single/MFS)       | $21 + 0.228% of the excess | $21 + 0.228% of the excess | Yes   |
| Rate reduction above the threshold (MFJ)              | $37 + 0.228% of the excess | $37 + 0.228% of the excess | Yes   |
| Rate reduction income limit                           | $500,000                   | $500,000                   | Yes   |

**Notes:** The calculator applies both parts to New York City residents and limits the total to the city tax (the fixed amount is refundable on the return). It uses NY AGI for the $250,000 test and city taxable income for the $500,000 test. New York City tax itself has no recapture. Not modelled: the $1,000 dependent exemption, the household credits (income of $32,000 or less), and the metropolitan commuter transportation mobility tax on self-employment earnings.

**Correction (2026-10-19):** The calculator previously applied the rate schedule alone, with no tax benefit recapture and no school tax credit.

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

**Note on the 80% figure:** Washington has no estimated-payment regime for this tax; it is due in full with the return. The 80% is the threshold for the substantial underpayment penalty only ([WA DOR capital gains tax](https://dor.wa.gov/taxes-rates/other-taxes/capital-gains-tax): "Substantially underpaid means you have paid less than 80% of the tax due"), and the breakdown says so rather than calling it a safe harbor.

**Correction (2026-10-19):** The $1,000,000 surtax threshold applies to Washington capital gains after the standard deduction (RCW 82.87.040(1)(b) with RCW 82.87.060; the DOR notice refers to "your first $1 million in taxable Washington capital gains"). The 9.9% tier in `washington-brackets.json` therefore starts at $1,278,000 of gains (the deduction plus $1,000,000), not $1,000,000. The 2026 tier must move with the 2026 deduction once it is published.

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

### Income Limit and Property Tax Credit

**Source:** [IL-1040 Instructions](https://tax.illinois.gov/content/dam/soi/en/web/tax/forms/incometax/documents/currentyear/individual/il-1040-instr.pdf), Schedule ICR instructions, [35 ILCS 5/204(g)](https://www.ilga.gov/legislation/ilcs/documents/003500050K204.htm), [35 ILCS 5/208](https://www.ilga.gov/legislation/ilcs/documents/003500050K208.htm)

| Item                                    | Our Data | Official | Match |
| --------------------------------------- | -------- | -------- | ----- |
| Exemption and credit income limit       | $250,000 | $250,000 | Yes   |
| Exemption and credit income limit (MFJ) | $500,000 | $500,000 | Yes   |
| Property tax credit rate                | 5%       | 5%       | Yes   |

**Note:** No exemption or property tax credit is allowed when federal AGI exceeds the limit (a cliff, not a phaseout). The calculator tests the limit against the federal AGI it has already worked out, not Illinois income, since the two differ when there is U.S. Treasury interest or lower Illinois wages. The credit is nonrefundable and applies only to an Illinois principal residence; the calculator assumes the property tax entered qualifies. The limits are statutory, so the same values are used for 2026.

---

## Colorado (2025)

### Tax Rate

**Source:** [CO DOR Income Tax Guide](https://tax.colorado.gov/individual-income-tax-guide)

| Item      | Our Data | Official | Match |
| --------- | -------- | -------- | ----- |
| Flat Rate | 4.4%     | 4.4%     | Yes   |

**Note:** Colorado uses federal taxable income as the starting point for state tax calculation. Capital gains are taxed at the same 4.4% flat rate as ordinary income.

### Additions and Subtractions

**Source:** [CO DOR Individual Income Tax Guide (Jan 2026)](https://tax.colorado.gov/sites/default/files/documents/Individual_Income_Tax_Guide_January_2026.pdf), [Income Tax Topics: State Income Tax Addback (Nov 2025)](https://tax.colorado.gov/sites/default/files/documents/ITT_State_Income_Tax_Addback_Nov_2025.pdf), [DR 0104 (2025)](https://tax.colorado.gov/sites/default/files/documents/DR0104_2025.pdf) lines 2 and 4, [DR 0104AD (2025)](https://tax.colorado.gov/sites/default/files/documents/DR0104AD_2025.pdf) line 12

| Item                                           | Our Data | Official | Match |
| ---------------------------------------------- | -------- | -------- | ----- |
| State income tax addback for itemizers         | Yes      | Yes      | Yes   |
| Deduction addback applies at federal AGI of    | $300,000 | $300,000 | Yes   |
| Deduction addback limit (Single/MFS)           | $12,000  | $12,000  | Yes   |
| Deduction addback limit (MFJ)                  | $16,000  | $16,000  | Yes   |
| Charitable subtraction floor for non-itemizers | $500     | $500     | Yes   |

**Notes:** The state income tax addback is the smaller of (a) the capped federal SALT deduction less property tax and (b) itemized deductions less the standard deduction. The high-income addback is reduced by the state income tax addback, so the larger of the two applies. Not modelled: the QBI deduction addback above $500,000 ($1,000,000 joint) of AGI, because this calculator's QBI deduction is already fully phased out below those incomes.

**Correction (2026-10-19):** The calculator previously applied the flat rate to federal taxable income with no Colorado additions or subtractions.

### Safe Harbor

| Item                                                            | Our Data | Official | Match |
| --------------------------------------------------------------- | -------- | -------- | ----- |
| Current Year                                                    | 70%      | 70%      | Yes   |
| Prior Year                                                      | 100%     | 100%     | Yes   |
| Prior Year, last year's federal AGI over $150,000 ($75,000 MFS) | 110%     | 110%     | Yes   |

**Source:** [DR 0204 (rev. 09/25/25)](https://tax.colorado.gov/sites/default/files/documents/DR0204_2025.pdf): "The required annual amount to be paid is the lesser of: 70% of actual current year net Colorado tax liability, or 100% of preceding year's net Colorado tax liability ... or 110% of preceding year's net Colorado tax liability." The 2026 DR 0104EP has the same wording.

**Correction (2026-10-19):** The current-year share was previously recorded as 90%.

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

### Itemized Deductions

**Source:** [2025 D-40 booklet](https://otr.cfo.dc.gov/sites/default/files/dc/sites/otr/publication/attachments/2025_D40_Book_082026_v1.pdf) (Line 17 and Line 18 instructions, Calculation F), [D.C. Act 26-416](https://code.dccouncil.gov/us/dc/council/acts/26-416), [D.C. Code 47-1803.03](https://code.dccouncil.gov/us/dc/council/code/sections/47-1803.03)

| Item                                      | Our Data | Official | Match |
| ----------------------------------------- | -------- | -------- | ----- |
| Real property tax deductible, no SALT cap | Yes      | Yes      | Yes   |
| State and local income tax deductible     | No       | No       | Yes   |
| Same deduction type as the federal return | Yes      | Yes      | Yes   |
| High-income limit: rate on excess DC AGI  | 5%       | 5%       | Yes   |
| High-income limit threshold               | $200,000 | $200,000 | Yes   |
| High-income limit threshold (MFS)         | $100,000 | $100,000 | Yes   |

**Notes:** Mortgage interest and charitable contributions follow the federal Schedule A amounts. The limitation thresholds are fixed in statute and not indexed, so 2026 uses the same values. For 2026 the federal 0.5% charitable floor flows through with the federal charitable amount; whether DC's 2026 Calculation F starts after the federal 2/37 limitation is not yet published, and the calculator does not apply that limitation to DC. DC does not allow the federal non-itemizer charitable deduction. Because DC requires the same type of deduction as the federal return, and a federal filer may itemize even when the standard deduction is larger, the calculator works out both types and uses the one with the lower combined federal and DC tax.

**Correction (2026-10-19):** The calculator previously dropped property tax from DC itemized deductions, applied no high-income limitation, and chose the larger of the standard and itemized deduction regardless of the federal return.

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

**Source:** [FTB Tax News, October 2026 ("2026 Indexing")](https://www.ftb.ca.gov/about-ftb/newsroom/tax-news/index.html). The 2026 Form 540 tax rate schedules PDF is not published until late December.

| Rate  | Single / MFS      | MFJ                 | Match |
| ----- | ----------------- | ------------------- | ----- |
| 1%    | $0-$11,456        | $0-$22,912          | Yes   |
| 2%    | $11,456-$27,157   | $22,912-$54,314     | Yes   |
| 4%    | $27,157-$42,861   | $54,314-$85,722     | Yes   |
| 6%    | $42,861-$59,498   | $85,722-$118,996    | Yes   |
| 8%    | $59,498-$75,197   | $118,996-$150,394   | Yes   |
| 9.3%  | $75,197-$384,109  | $150,394-$768,218   | Yes   |
| 10.3% | $384,109-$460,927 | $768,218-$921,854   | Yes   |
| 11.3% | $460,927-$768,213 | $921,854-$1,536,426 | Yes   |
| 12.3% | $768,213+         | $1,536,426+         | Yes   |

**Note:** FTB indexed 2026 amounts by 3.4% (California CPI, June 2025 to June 2026). Every threshold above equals the 2025 threshold times 1.034, rounded.

### Standard Deductions

**Source:** [FTB Tax News, October 2026 ("2026 Indexing")](https://www.ftb.ca.gov/about-ftb/newsroom/tax-news/index.html)

| Filing Status | Our Data | Official | Match |
| ------------- | -------- | -------- | ----- |
| Single        | $5,900   | $5,900   | Yes   |
| MFJ           | $11,800  | $11,800  | Yes   |
| MFS           | $5,900   | $5,900   | Yes   |

**Correction (2026-10-05):** The brackets previously recorded here were not official values (the low brackets were the 2024 thresholds and the upper brackets matched no FTB schedule), and the standard deductions were the 2024 amounts. Replaced with the indexed amounts FTB announced in October 2026. Mental health tax remains 1% over $1M.

### Itemized Deductions (2026)

| Item                                     | Our Data | Official | Match                      |
| ---------------------------------------- | -------- | -------- | -------------------------- |
| High-income limit threshold (Single/MFS) | $252,203 | TBD      | WAITING - using 2025 value |
| High-income limit threshold (MFJ)        | $504,411 | TBD      | WAITING - using 2025 value |

**Note:** The FTB indexes these thresholds each year and publishes them in the Schedule CA (540) instructions, expected in late December 2026. The other itemized deduction rules are statutory and unchanged from 2025.

### Employer Withholding (2025 and 2026)

**Sources:** [EDD 2026 Withholding Schedules, Method B](https://edd.ca.gov/siteassets/files/pdf_pub_ctr/26methb.pdf) and the [2025 edition](https://edd.ca.gov/siteassets/files/pdf_pub_ctr/25methb.pdf) (Tables 1, 3, 4 and the annual rate tables 5 and 6); [EDD DE 231PS](https://edd.ca.gov/siteassets/files/pdf_pub_ctr/de231ps.pdf) for the supplemental rates ("For stock options and bonuses that were paid on or after November 1, 2009, the flat rate is 10.23 percent. For other types of supplemental wage payments made on or after November 1, 2009, the flat rate is 6.6 percent."). Verified 2026-10-30.

California employers do not withhold from the tax tables. The Method B schedules carry rates 10% above the tax rates (1.1%, 2.2%, 4.4%, 6.6%, 8.8%, 10.23%, 11.33%, 12.43%, 13.53%, 14.63%; a 2009 budget measure, ABX4 17, that was never reversed) on the prior tax year's bracket edges and standard deduction. `california-withholding.json` holds them by edition.

| Item (2026 edition)                            | Our Data             | Official             | Match |
| ---------------------------------------------- | -------------------- | -------------------- | ----- |
| Single bracket edges                           | $11,079 … $1,000,000 | 2025 tax-year edges  | Yes   |
| Married bracket edges                          | $22,158 … $1,485,906 | 2025 tax-year edges  | Yes   |
| Standard deduction (Table 3), single / married | $5,706 / $11,412     | $5,706 / $11,412     | Yes   |
| Low-income exemption (Table 1), single / married 2+ | $18,896 / $37,791 | $18,896 / $37,791  | Yes   |
| Allowance credit (Table 4), annual             | $168.30              | $168.30              | Yes   |
| Flat rate on bonuses and stock                 | 10.23%               | 10.23%               | Yes   |

| Item (2025 edition)                            | Our Data             | Official             | Match |
| ---------------------------------------------- | -------------------- | -------------------- | ----- |
| Single bracket edges                           | $10,756 … $1,000,000 | 2024 tax-year edges  | Yes   |
| Married bracket edges                          | $21,512 … $1,442,628 | 2024 tax-year edges  | Yes   |
| Standard deduction, single / married           | $5,540 / $11,080     | $5,540 / $11,080     | Yes   |
| Low-income exemption, single / married 2+      | $18,368 / $36,736    | $18,368 / $36,736    | Yes   |
| Allowance credit, annual                       | $163.90              | $163.90              | Yes   |

**Notes:** The estimate assumes no DE 4 for a single filer (EDD withholds as single with zero allowances) and, for a joint return, the married schedule with the two-or-more-allowances deduction and two allowances of credit. The married column for zero or one allowance uses the single deduction and is not modelled. The input is bonuses and stock, so the 6.6% rate for other supplemental pay is not used. State withholding is estimated for California, Colorado, Illinois and New York; for DC the user enters the amount.

---

## New York (2026)

### Tax Brackets

**Source:** [NY DTF Withholding Tax Rate Changes](https://www.tax.ny.gov/bus/wt/rate.htm), [IT-2105-I (2026) tax rate schedules](https://www.tax.ny.gov/pdf/current_forms/it/it2105i.pdf)

NY enacted 0.1% rate reductions for the bottom 5 brackets effective 2026:

| Rate (2025) | Rate (2026) | Single              | MFJ                 | Match |
| ----------- | ----------- | ------------------- | ------------------- | ----- |
| 4.0%        | 3.9%        | $0-$8,500           | $0-$17,150          | Yes   |
| 4.5%        | 4.4%        | $8,500-$11,700      | $17,150-$23,600     | Yes   |
| 5.25%       | 5.15%       | $11,700-$13,900     | $23,600-$27,900     | Yes   |
| 5.5%        | 5.4%        | $13,900-$80,650     | $27,900-$161,550    | Yes   |
| 6.0%        | 5.9%        | $80,650-$215,400    | $161,550-$323,200   | Yes   |
| 6.85%       | 6.85%       | $215,400-$1,077,550 | $323,200-$2,155,350 | Yes   |
| 9.65%       | 9.65%       | $1,077,550-$5M      | $2,155,350-$5M      | Yes   |
| 10.3%       | 10.3%       | $5M-$25M            | $5M-$25M            | Yes   |
| 10.9%       | 10.9%       | $25M+               | $25M+               | Yes   |

**Note:** Brackets remain unchanged; only the rates for the bottom 5 brackets were reduced by 0.1 percentage points.

### Standard Deductions

| Filing Status | Our Data | Official | Match |
| ------------- | -------- | -------- | ----- |
| Single        | $8,000   | $8,000   | Yes   |
| MFJ           | $16,050  | $16,050  | Yes   |

### Tax Benefit Recapture and School Tax Credit (2026)

**Source:** [2026 IT-2105 Instructions](https://www.tax.ny.gov/pdf/current_forms/it/it2105i.pdf) (tax computation worksheets, pages 3 to 5), [Tax Law section 601(d-5)](https://www.nysenate.gov/legislation/laws/TAX/601)

| Filing status | Taxable income over | Recapture base | Incremental benefit | Match |
| ------------- | ------------------- | -------------- | ------------------- | ----- |
| MFJ           | first tier (5.4%)   | n/a            | n/a                 | Yes   |
| MFJ           | $161,550            | $333           | $807                | Yes   |
| MFJ           | $323,200            | $1,140         | $3,071              | Yes   |
| MFJ           | $2,155,350          | $4,211         | $60,350             | Yes   |
| MFJ           | $5,000,000          | $64,561        | $32,500             | Yes   |
| Single/MFS    | first tier (5.9%)   | n/a            | n/a                 | Yes   |
| Single/MFS    | $215,400            | $567           | $2,047              | Yes   |
| Single/MFS    | $1,077,550          | $2,614         | $30,172             | Yes   |
| Single/MFS    | $5,000,000          | $32,786        | $32,500             | Yes   |

**Note:** These come from the 2026 estimated tax instructions and match the statute; re-check against the 2026 IT-201 instructions when published. The New York City school tax credit amounts for 2026 are not yet published, so 2026 reuses the 2025 values (WAITING).

---

### Employer Withholding (2025 and 2026)

**Sources:** [NYS-50-T-NYS (1/26)](https://www.tax.ny.gov/pdf/publications/withholding/nys50_t_nys.pdf), New York State Withholding Tax Tables and Methods, effective January 1, 2026: Table A/B/C (page 14), the Method II annual tax rate schedules (pages 17 and 19), Method III (page 22), and page 3 ("Withhold at the New York State supplemental rate of 11.70% (0.1170)"). [NYS-50-T-NYC (1/26)](https://www.tax.ny.gov/pdf/publications/withholding/nys50_t_nyc.pdf), effective January 1 to December 31, 2026: Table A/B/C (page 24), the annual schedules (pages 25 and 26), and page 3 ("Withhold at the New York City supplemental rate of 4.25% (0.0425)"). For 2025, the [Tax Department bulletin of November 29, 2023](https://content.govdelivery.com/accounts/NYTAX/bulletins/3c1a1c6): "There are no changes to the New York State, New York City, and Yonkers withholding tax tables and methods for 2025. Employers should continue to use the following withholding tax tables and methods for 2025", naming NYS-50-T-NYS (1/23) and NYS-50-T-NYC (1/18), read from the Internet Archive's copies of the state's PDFs. [IT-2104-I (2026)](https://www.tax.ny.gov/forms/current-forms/it/it2104i.htm): "You may not claim a withholding allowance for yourself or, if married, your spouse"; with a 2020-or-later federal W-4 and no IT-2104, "your employer may use zero as your number of allowances". Verified 2026-10-31.

| Item (2026 edition)                                  | Our Data                                 | Official                                 | Match |
| ---------------------------------------------------- | ---------------------------------------- | ---------------------------------------- | ----- |
| Deduction (Table B, annual), single / married        | $7,400 / $7,950                          | $7,400 / $7,950                          | Yes   |
| Exemption (Table C, annual)                          | $1,000                                   | $1,000                                   | Yes   |
| Single schedule edges                                | $8,500 … $265,400, $1,077,550            | $8,500 … $265,400, $1,077,550            | Yes   |
| Single schedule rates                                | 3.90, 4.40, 5.15, 5.40, 5.90, 7.03, 7.53, 6.40, 11.44, 7.35% | same                  | Yes   |
| Married schedule edges                               | $8,500 … $211,550, $323,200, $373,200, $1,077,550, $2,155,350 | same                 | Yes   |
| Married schedule rates                               | 3.90, 4.40, 5.15, 5.40, 5.90, 6.57, 7.07, 8.01, 6.40, 13.49, 7.35, 7.65% | same     | Yes   |
| Method III threshold, single / married               | $1,077,550 / $2,155,350                  | $1,077,550 / $2,155,350                  | Yes   |
| Method III rates (to $5M, to $25M, above)            | 10.45%, 11.10%, 11.70%                   | 10.45%, 11.10%, 11.70%                   | Yes   |
| State supplemental rate                              | 11.70%                                   | 11.70%                                   | Yes   |
| City deduction, single / married                     | $5,000 / $5,500                          | $5,000 / $5,500                          | Yes   |
| City schedule edges and rates                        | $8,000, $8,700, $15,000, $25,000, $60,000; 2.05, 2.80, 3.25, 3.95, 4.15, 4.25% | same | Yes |
| City supplemental rate                               | 4.25%                                    | 4.25%                                    | Yes   |

| Item (2025: NYS-50-T-NYS 1/23, NYS-50-T-NYC 1/18)    | Our Data                                 | Official                                 | Match |
| ---------------------------------------------------- | ---------------------------------------- | ---------------------------------------- | ----- |
| Single schedule rates (same edges)                   | 4.00, 4.50, 5.25, 5.50, 6.00, 7.14, 7.64, 6.50, 11.01, 7.35% | same                  | Yes   |
| Married schedule rates (same edges)                  | 4.00, 4.50, 5.25, 5.50, 6.00, 6.67, 7.17, 8.11, 6.50, 12.84, 7.35, 7.65% | same     | Yes   |
| Deductions, Method III, supplemental rates, city     | As 2026                                  | As 2026                                  | Yes   |

**Notes:** The estimate assumes no exemptions for every status: the IT-2104 gives none for the employee or spouse, and an employee with no certificate is withheld on with zero. Married filing separately uses the single schedule and deduction, as the tax tables do; the "Married, but withhold at higher single rate" box, IT-2104 extra withholding, and Yonkers are not modelled. The city's schedule is the same for single and married; only the deduction differs. The booklets' column 5 accumulates whole-dollar-rounded steps, so the exact walk sits up to about $4 from the printed cumulative tax; a test pins every row within $5. Method III is a cliff: at $1,077,550 of single net wages the whole amount is withheld on at 10.45%, which the estimate reproduces because that is what payroll does.

---

## Washington (2026)

### Capital Gains Tax

**Source:** [WA DOR Capital Gains Tax](https://dor.wa.gov/taxes-rates/other-taxes/capital-gains-tax)

| Item             | Our Data   | Official   | Match                      |
| ---------------- | ---------- | ---------- | -------------------------- |
| Exemption        | $278,000   | TBD        | WAITING - using 2025 value |
| Base Rate        | 7%         | 7%         | Yes                        |
| Surtax Rate      | 9.9%       | 9.9%       | Yes                        |
| Surtax Threshold | $1,000,000 | $1,000,000 | Yes                        |

**Note:** The 2026 exemption threshold has NOT been announced by WA DOR as of 2026-10-05. Currently using the 2025 value ($278,000) as a placeholder. The exemption is adjusted annually for inflation per RCW 82.87.150. Check the WA DOR website for the official 2026 amount when published.

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

### Employer Withholding (2025 and 2026)

**Sources:** [Booklet IL-700-T (R-12/25)](https://tax.illinois.gov/content/dam/soi/en/web/tax/forms/withholding/documents/currentyear/il-700-t.pdf), effective January 1, 2026, and the [R-12/24 edition](https://tax.illinois.gov/content/dam/soi/en/web/tax/forms/withholding/documents/2025/il-700-t.pdf) for 2025: "Generally, the rate for withholding Illinois Income Tax is 4.95 percent. For wages and other compensation, subtract any exemptions from the wages paid and multiply the result by 4.95 percent." Automated payroll method, Step 2: "Multiply the number of allowances your employee claimed on Form IL-W-4, Line 1, by $2,925" ($2,850 in the R-12/24 edition). [Form IL-W-4 (R-07/23)](https://tax.illinois.gov/content/dam/soi/en/web/tax/forms/withholding/documents/currentyear/il-w-4.pdf), allowance worksheet Step 1. Verified 2026-10-31.

| Item                         | Our Data | Official | Match |
| ---------------------------- | -------- | -------- | ----- |
| Rate                         | 4.95%    | 4.95%    | Yes   |
| Line 1 allowance, 2026       | $2,925   | $2,925   | Yes   |
| Line 1 allowance, 2025       | $2,850   | $2,850   | Yes   |
| Separate rate on bonuses     | None     | None     | Yes   |

**Notes:** The estimate assumes the IL-W-4 worksheet's basic allowances are claimed: one for the employee ("No one else can claim me as a dependent") and one more for a spouse on a joint return ("I can claim my spouse as a dependent"), with none on Line 2. The Line 1 allowance equals the personal exemption, so the estimate tracks the tax. An employee with no IL-W-4 on file is withheld on "without allowing any exemptions", which is not modelled. Bonuses and stock are wages here, withheld on at 4.95% once the allowance is used.

---

## Colorado (2026)

### Tax Rate

**Source:** [CO DOR Income Tax Guide](https://tax.colorado.gov/individual-income-tax-guide)

| Item      | Our Data | Official | Match |
| --------- | -------- | -------- | ----- |
| Flat Rate | 4.4%     | 4.4%     | Yes   |

**Note:** Unchanged from 2025.

### Additions and Subtractions (2026)

**Source:** [CO DOR Individual Income Tax Guide (Jan 2026)](https://tax.colorado.gov/sites/default/files/documents/Individual_Income_Tax_Guide_January_2026.pdf), [Proposition MM text](https://www.leg.colorado.gov/ballots/increase-state-taxes-for-school-meals-and-food-assistance-programs/files/text-of-measure)

| Item                                 | Our Data | Official | Match |
| ------------------------------------ | -------- | -------- | ----- |
| Deduction addback limit (Single/MFS) | $1,000   | $1,000   | Yes   |
| Deduction addback limit (MFJ)        | $2,000   | $2,000   | Yes   |

**Note:** Proposition MM (November 2025) lowered the limits from $12,000/$16,000 for 2026 and later. The other rules are unchanged from 2025. The 2026 federal changes (charitable floor, 2/37 limit) flow in through federal taxable income. Because the charitable subtraction is only for filers who take the federal standard deduction, and a federal filer may take either type, the calculator works out both and uses the one with the lower combined federal and Colorado tax.

---

### Employer Withholding (2025 and 2026)

**Sources:** [DR 1098 (10/21/25)](https://tax.colorado.gov/sites/default/files/documents/DR_1098_Colorado_Withholding_Worksheet_for_Employees.pdf), 2026 Colorado Withholding Worksheet for Employers, and the [DR 1098 (11/12/24)](https://tax.colorado.gov/sites/default/files/documents/DR_1098_2024.pdf) edition for 2025. Line 2a: "If the employee did not submit a DR 0004, or if DR 0004 Line 2 is blank, enter the appropriate amount based on the employee's expected filing status from IRS form W-4 Step 1(c): $11,000 if married filing jointly or qualifying surviving spouse; or $5,500 otherwise" ($10,000 and $5,000 in the 11/12/24 edition); line 2c: "Multiply line 2b by 4.40% (0.044)"; rule 4: "If an employee does not submit a W-4 or DR 0004, complete Step 2a as if they submitted a W-4 with an expected filing status of 'single.'" [Colorado Wage Withholding Tax Guide (January 2026)](https://tax.colorado.gov/sites/tax/files/documents/Wage_Withholding_Tax_Guide_Jan_2026.pdf): bonuses are wages subject to the same withholding. Verified 2026-10-31.

| Item                                      | Our Data          | Official          | Match |
| ----------------------------------------- | ----------------- | ----------------- | ----- |
| Rate                                      | 4.40%             | 4.40%             | Yes   |
| Standard allowance 2026, single / joint   | $5,500 / $11,000  | $5,500 / $11,000  | Yes   |
| Standard allowance 2025, single / joint   | $5,000 / $10,000  | $5,000 / $10,000  | Yes   |
| Separate rate on bonuses                  | None              | None              | Yes   |

**Notes:** The estimate assumes no DR 0004, so the allowance follows the W-4 filing status (the "otherwise" amount for single and married filing separately). A DR 0004 Line 2 amount or Line 3 extra withholding is not modelled. Bonuses and stock are wages here, withheld on at 4.40% once the allowance is used.

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

**Source:** [OTR 2026 D-40ES booklet](https://otr.cfo.dc.gov/sites/default/files/dc/sites/otr/publication/attachments/2026_D40ES_Book_wLinks04012026.pdf) (rev. 03/2026), estimated tax worksheet line 2b; [D.C. Act 26-416](https://code.dccouncil.gov/us/dc/council/acts/26-416) (August 2026)

| Filing Status | Our Data | Official   | Match                    |
| ------------- | -------- | ---------- | ------------------------ |
| Single        | $16,100  | Unresolved | WAITING - see note below |
| MFJ           | $32,200  | Unresolved | WAITING - see note below |
| MFS           | $16,100  | Unresolved | WAITING - see note below |

**Note:** The data uses the amounts printed in the March 2026 D-40ES worksheet, which equal the federal 2026 standard deduction. D.C. Act 26-416, passed afterwards, sets the DC standard deduction for 2026 through 2029 at $15,000 ($30,000 joint) increased by an annual cost-of-living adjustment, so the final 2026 amounts are probably lower than the data. OTR has not published the indexed 2026 figures, and the permanent version of the act could not be read to confirm it is in force. Re-check against the 2026 D-40 instructions when published.

---

## Verification Notes

1. All ordinary income brackets verified against IRS Rev. Proc. 2024-40 (2025) and Rev. Proc. 2025-32 (2026)
2. Standard deductions reflect OBBB amendments (July 2025)
3. State tax data verified against official state department of revenue sources
4. Washington capital gains includes SB 5813 changes (May 2025)
5. 2025 values are for tax year 2025 (returns filed in 2026)
6. 2026 values are for tax year 2026 (returns filed in 2027)

---

## 2026 Data Status (as of 2026-10-19)

2026 tax data status:

| Jurisdiction   | Status      | Source                                                                                                                                             |
| -------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Federal        | Verified    | IRS Rev. Proc. 2025-32                                                                                                                             |
| **California** | **WAITING** | Rates and standard deductions verified (FTB Tax News, October 2026); itemized deduction limitation thresholds not yet published, using 2025 values |
| New York       | Verified    | NY DTF IT-2105-I (0.1% rate reductions applied)                                                                                                    |
| Illinois       | Verified    | IDOR FY 2026-15 bulletin                                                                                                                           |
| Colorado       | Verified    | CO DOR (4.4% unchanged)                                                                                                                            |
| Florida        | N/A         | No state income tax                                                                                                                                |
| **DC**         | **WAITING** | Brackets unchanged; 2026 standard deduction unresolved (see District of Columbia 2026)                                                             |
| **Washington** | **WAITING** | 2026 exemption threshold not yet announced by WA DOR; using 2025 value ($278,000)                                                                  |

**Pending items:**

- Washington 2026 capital gains standard deduction (and the 9.9% tier in `washington-brackets.json`, which starts at the deduction plus $1,000,000).
- California 2026 itemized deduction limitation thresholds (Schedule CA (540) instructions, expected late December 2026).
- DC 2026 standard deduction amounts.
- New York 2026 Form IT-196 and IT-201 instructions (itemized deduction and recapture rules are statutory; forms not yet published), and the 2026 New York City school tax credit amounts.

---

## Discrepancies Fixed (2026-10-05)

1. **Federal 2026 MFJ brackets:** four thresholds corrected (see Federal 2026 above). Source: IRS Rev. Proc. 2025-32, Tax Foundation.
2. **California 2026 brackets and standard deductions:** replaced with the FTB-indexed amounts.
3. **California 2025 standard deductions:** $5,540/$11,080 corrected to $5,706/$11,412.
4. **New York MFS brackets (2025 and 2026):** 6% (5.9% in 2026) bracket now ends at $215,400, matching the single schedule.
5. **DC 2026 standard deductions:** $15,000/$30,000 placeholders replaced with $16,100/$32,200 from the OTR 2026 D-40ES booklet.

---

## State Tax Paid for a Prior Year

State income tax is deductible federally in the year it is paid. The [2025 Schedule A instructions](https://www.irs.gov/pub/irs-pdf/i1040sca.pdf), line 5a, include state and local income taxes "paid in 2025 for a prior year, such as taxes paid with your 2024 state or local income tax return", alongside withholding and estimated payments. The calculator adds the balance paid this year for last year's state return to the Federal deduction for state and local taxes (subject to the cap). It is not counted as a payment toward this year's state tax.

---

## U.S. Treasury Interest

Interest on U.S. Treasury obligations is taxable federally but exempt from state and local income tax ([31 U.S.C. 3124(a)](https://www.law.cornell.edu/uscode/text/31/3124): "Stocks and obligations of the United States Government are exempt from taxation by a State"). The calculator removes the Treasury portion of interest from income in California, DC, Illinois and New York, and subtracts it from federal taxable income for Colorado. Not modelled: the share of a mutual fund's dividends that comes from Treasuries, which states treat differently (California and New York require a minimum share of fund assets).

---

## Safe Harbor (2025 and 2026)

The required amount is the lesser of a share of this year's tax and a share of last year's total tax. The calculator makes one annual comparison; installment timing is not modelled.

| Jurisdiction | This year    | Last year | Last year, if last year's income was over $150,000 ($75,000 MFS)                   | Source                                                                                                                                                                         |
| ------------ | ------------ | --------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Federal      | 90%          | 100%      | 110%                                                                               | [Form 2210 instructions](https://www.irs.gov/pub/irs-pdf/i2210.pdf), [Form 1040-ES](https://www.irs.gov/pub/irs-pdf/f1040es.pdf)                                               |
| California   | 90%          | 100%      | 110%; no prior-year method at $1,000,000 or more of this year's AGI ($500,000 MFS) | [FTB 5805 instructions](https://www.ftb.ca.gov/forms/2025/2025-5805-instructions.html), [540-ES instructions](https://www.ftb.ca.gov/forms/2026/2026-540-es-instructions.html) |
| New York     | 90%          | 100%      | 110%                                                                               | [IT-2105.9 instructions](https://www.tax.ny.gov/pdf/current_forms/it/it2105_9i.pdf)                                                                                            |
| Colorado     | see Colorado | 100%      | 110%                                                                               | [DR 0204](https://tax.colorado.gov/sites/default/files/documents/DR0204_2025.pdf)                                                                                              |
| DC           | 90%          | 110%      | 110% (no income tier)                                                              | D-2210 in the 2025 D-40 booklet                                                                                                                                                |
| Illinois     | 90%          | 100%      | 100% (no income tier)                                                              | [IL-2210 instructions](https://tax.illinois.gov/content/dam/soi/en/web/tax/forms/incometax/documents/currentyear/individual/il-2210-instr.pdf)                                 |

**Notes:** The prior-year figure is last year's total tax (for federal, Form 1040 "total tax" less refundable credits), not the amount paid. The higher percentage depends on last year's income, which the calculator cannot know, so a checkbox asks; it starts ticked. One checkbox stands in for federal, California and New York income, which differ slightly. Not modelled: no penalty when last year's tax was zero, the small-balance exemptions (federal under $1,000 after withholding, California $500, New York $300, DC $100, Illinois and Colorado $1,000), installment timing, and changes of filing status between years.

**Correction (2026-10-19):** The calculator previously required 110% federally regardless of last year's income, 100% in California and Colorado regardless of it, and tested New York's threshold against this year's income.

---

## Discrepancies Fixed (2026-10-19)

1. **Federal QBI thresholds and SALT cap (2025 and 2026):** thresholds were the 2024 amounts; the SALT cap is now one amount for all filers with a 30% phasedown, halved for married filing separately after the phasedown.
2. **Federal itemized deductions (2026):** added the 0.5% charitable floor and the 2/37 overall limitation.
3. **California, New York and DC itemized deductions:** property tax is now deductible without a cap, each jurisdiction's income-based limitation is applied, and state mortgage limits are used. DC follows the federal choice of standard or itemized.
4. **Colorado:** added the state income tax addback, the high-income deduction addback and the non-itemizer charitable subtraction.
5. **Illinois:** the personal exemption is disallowed above the income limit, and the 5% property tax credit is applied.
6. **Washington:** the 9.9% tier now starts after the standard deduction.
7. **New York:** added the tax benefit recapture for NY AGI over $107,650 and the New York City school tax credit.
8. **Safe harbor:** the prior-year share now depends on last year's income for federal, California, New York and Colorado.
