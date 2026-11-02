# Home Stock Tracker: Framework

## 1. Objective
Log what's in stock at home, and what it cost, in under 10 seconds per item. Everything lives in one spreadsheet that's easy to filter, total and share with the household.

**Success criteria**
- Adding an item takes 3 taps or fewer after the form opens
- Every entry shows up in the Google Sheet immediately, with no manual copying
- Works on a phone browser, so there's no app-store install
- Free to run, with no server to maintain

## 2. Users
- **Primary:** you, adding items after shopping
- **Secondary:** other household members (shared link, same sheet)

## 3. Recommended stack

| Layer | Choice | Why |
|---|---|---|
| Spreadsheet (database) | **Google Sheets** | Free, shareable, already on your Google account |
| Backend | **Google Apps Script** | Lives inside the Sheet, no hosting, no API keys |
| Frontend | **HTML form served by Apps Script** | Opens as a link and can be added to your phone home screen |

*Alternatives considered:* a local Excel/CSV app (offline, but no phone sync), or React + Sheets API (more flexible, but needs hosting and OAuth setup). Both are overkill for Phase 1.

## 4. Data model (spreadsheet columns)

Sheet tab: `Stock`

| # | Column | Type | Input | Example |
|---|---|---|---|---|
| A | ID | text | auto | `ITM-0001` |
| B | Date Added | date | auto | `2026-11-02` |
| C | Item | text | **required** | Rice 5kg |
| D | Category | list | optional | Food |
| E | Quantity | number | optional (default 1) | 2 |
| F | Unit | list | optional (default `pcs`) | pack |
| G | Price (per unit) | number | **required** | 75000 |
| H | Total | formula | auto (`E × G`) | 150000 |
| I | Location | list | optional | Kitchen |
| J | Notes | text | optional | Promo at supermarket |

**Default lists (editable in `Config.gs`)**
- Categories: Food, Drinks, Cleaning, Toiletries, Medicine, Household, Other
- Units: pcs, pack, box, kg, g, L, ml, bottle
- Locations: Kitchen, Fridge, Bathroom, Storage, Bedroom

Currency is set in `Config.gs` (defaults to IDR).

## 5. User flow (Phase 1)

```
Open link → [Item name] → [Price] → (optional: qty / category / location) → Save
         → "Saved ✓" toast → form clears, ready for the next item
         → list below the form shows the 10 most recent items + total spend
```

## 6. Screens

1. **Add Item** (main screen): two big required fields (Item, Price), with the optional fields collapsed under "More details"
2. **Recent Items:** the latest entries plus a running total, shown below the form
3. **The Sheet itself:** full history, filtering and pivots. No custom UI needed

## 7. Roadmap

| Phase | Scope | Outcome |
|---|---|---|
| **1. MVP** | Add item form, auto-append to Sheet, recent list | Working tool on your phone |
| **2. Stock control** | Use/consume item (qty −1), Min Stock column, Low/Out status | Know what's running out |
| **3. Insights** | Monthly spend by category, price history per item | Spot where the money goes |
| **4. Convenience** | Auto-generated shopping list, barcode scan, edit/delete from the app | Less typing |

## 8. Open decisions (need your approval)
1. **Google Sheets + Apps Script** as the stack? (recommended)
2. Are the **columns** in section 4 right? Add or remove any?
3. **Currency:** IDR or something else?
4. Should **other household members** be able to add items too?
