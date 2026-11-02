# Home Stock Tracker

Log household items (name + price) from your phone. Each entry becomes a row in a Google Sheet, and the sheet totals this month's spending by category. Prices are in IDR.

```
[ Phone / Laptop ]  →  [ Web form (Apps Script) ]  →  [ Google Sheet ]
  type item + price       validates + writes row       Stock log + This Month summary
```

## The spreadsheet

| Tab | What it holds |
|---|---|
| **This Month** | Item count and spend per category for the month in the yellow cell (defaults to the current month), plus a bar chart |
| **Stock** | One row per item: ID, Date Added, Item, Category, Quantity, Unit, Price (IDR), Total (IDR), Location, Notes. ID and Total calculate automatically |
| **Lists** | Category, Unit and Location options used by the dropdowns. Edit here to change them |

Row 2 on Stock is an example (Rice 5kg). Delete its values before you start.

## Set up the phone app (one time, about 5 minutes)

1. Open the Google Sheet, then **Extensions > Apps Script**.
2. Create three files and paste in the contents from `src/`: `Config.gs`, `Code.gs`, and an HTML file named `Index` (`Index.html`).
3. Click **Deploy > New deployment**, choose type **Web app**, set *Execute as: Me* and *Who has access: Only myself* (or *Anyone with Google account* for the household), then **Deploy** and approve the permissions.
4. Open the web app URL on your phone and use **Add to Home Screen**.

## Android app (APK)

GitHub Actions builds the APK on every change to `android/` or `src/Index.html`, and publishes it under **Releases** (`HomeStock-v1.0.N.apk`).

1. Do the Apps Script setup above. Make sure you've pasted the latest `Code.gs`.
2. In the Apps Script editor, pick **createAccessKey** in the function menu and click **Run**. Copy the key from the Execution log.
3. **Deploy > Manage deployments > Edit**: set *Who has access* to **Anyone**, choose *Version: New version*, then Deploy. The access key protects the data. After this, the browser link only works with `?key=YOUR_KEY` added to the end.
4. On the phone, open the repo's **Releases** page, download the latest `.apk` and install it (allow "Install unknown apps" for your browser when asked).
5. Open Home Stock, then paste the Web app URL and the access key, and tap **Connect**.

The app shows the same screen as `src/Index.html` (bundled into the APK), and sends requests to the Apps Script `doPost` JSON API.

## Repo structure

```
Homeapp/
├── README.md
├── docs/FRAMEWORK.md        ← objective, data model, user flow, roadmap
├── src/                     ← Google Apps Script project
│   ├── Config.gs            ← tab names, column positions, currency
│   ├── Code.gs              ← addItem, getRecentItems, getConfig, JSON API + access key
│   └── Index.html           ← mobile form + recent items + month total
├── android/                 ← Android app (WebView shell + native HTTP bridge)
├── .github/workflows/       ← builds and releases the APK
└── tools/build_sheet.py     ← regenerates the starter spreadsheet (.xlsx)
```
