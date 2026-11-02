/**
 * Config: single source of truth for how the app talks to the spreadsheet.
 * The dropdown options themselves live on the "Lists" tab, so they can be
 * edited in the sheet without touching code.
 */
const CONFIG = {
  CURRENCY: 'IDR',
  ID_PREFIX: 'ITM-',
  RECENT_LIMIT: 10,

  SHEETS: {
    STOCK: 'Stock',
    LISTS: 'Lists',
    SUMMARY: 'This Month',
  },

  // Stock tab column positions (1-based). Must match the header row.
  COL: {
    ID: 1, DATE: 2, ITEM: 3, CATEGORY: 4, QTY: 5,
    UNIT: 6, PRICE: 7, TOTAL: 8, LOCATION: 9, NOTES: 10,
  },

  // Lists tab columns (1-based), data starts on row 2.
  LIST_COL: { CATEGORY: 1, UNIT: 2, LOCATION: 3 },

  // "This Month" tab cells read by the app.
  SUMMARY_MONTH_CELL: 'B4',
  SUMMARY_TOTAL_CELL: 'C16',
};
