# Home Stock Tracker

A simple app to log household items (name + price) from your phone, with every entry saved automatically as a row in a Google Sheet.

> **Status:** Framework / scaffold only. See [`docs/FRAMEWORK.md`](docs/FRAMEWORK.md) for the full plan. Nothing is wired up yet. Approve the framework first, then we build Phase 1.

## How it works

```
[ Phone / Laptop ]  →  [ Web form (Apps Script) ]  →  [ Google Sheet ]
  type item + price       validates + appends row       one row per item
```

## Repo structure

```
Homeapp/
├── README.md            ← you are here
├── docs/
│   └── FRAMEWORK.md     ← objective, data model, user flow, roadmap
└── src/                 ← Google Apps Script project (copied into script.google.com)
    ├── Code.gs          ← server logic: setup sheet, add item, list items
    ├── Config.gs        ← sheet name, columns, categories, currency
    └── Index.html       ← mobile input form + item list
```
