# Mecklenburg County Tax Bill Scraper

Reads parcel IDs from column P of your Excel file, scrapes the 2024 tax bill from
Polaris3G, and writes Assessed Value, Millage Rate, Direct Assessments, and Interest
back into columns J–M. Validates each row's total against the formula in column N.

---

## One-time Setup (on your local machine)

```bash
# 1. Install Python 3.10+ if you don't have it: https://www.python.org/downloads/

# 2. Install required libraries
pip install playwright openpyxl

# 3. Install the Chromium browser for Playwright
playwright install chromium
```

---

## Run

```bash
python scrape_tax_bills.py --file "C:\Users\YourName\Desktop\parcels.xlsx"
```

On Mac/Linux:
```bash
python scrape_tax_bills.py --file "/Users/yourname/Desktop/parcels.xlsx"
```

A Chrome window will open so you can watch it work.

---

## What it does

| Step | Action |
|------|--------|
| 1 | Reads parcel IDs from column P, rows 3–227 |
| 2 | Searches each parcel on Polaris3G |
| 3 | Navigates to Tax Bill Information → selects 2024 |
| 4 | Scrapes Assessed Value → **col J** |
| 5 | Scrapes Total Millage Rate → **col K** (stored as decimal, e.g. 0.7572) |
| 6 | Sums all Direct Assessment line items → **col L** |
| 7 | Scrapes Interest Due → **col M** |
| 8 | Compares GIS total to col N formula (flags mismatches > $1) |
| 9 | Saves every 10 parcels in case of crash |
| 10 | Writes all skipped/error rows to `errors.csv` next to your Excel file |

---

## Output files

| File | Contents |
|------|----------|
| Your Excel file | Columns J–M filled in for each parcel |
| `errors.csv` | Rows that were skipped (no result, no 2024 bill, or error) |

---

## If the script can't find values

The Polaris3G portal uses dynamic JavaScript — if the selectors need adjusting,
open the site manually, right-click the element you want, and choose
"Inspect" to find the exact CSS class or text label.

Then update the relevant `_extract_after()` label list at the top of the script.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `playwright install` fails | Run as Administrator / sudo |
| Browser opens but search doesn't work | The portal may have changed its search field — inspect and update `search_sel` |
| All parcels skipped | Confirm column P has plain 8-digit strings (no spaces, no formulas) |
| Millage looks wrong (e.g. 757.2 instead of 0.7572) | Check portal format; adjust the `/1000` divisor in `scrape_parcel()` |
