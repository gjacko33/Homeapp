/**
 * Code.gs: server side (Google Apps Script, bound to the Home Stock Tracker sheet).
 * Open the sheet > Extensions > Apps Script, paste Config.gs, Code.gs and Index.html,
 * then Deploy > New deployment > Web app.
 */

/** Serves the web app (the input form). */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Home Stock')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function sheet_(name) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('Missing tab: ' + name);
  return sh;
}

/** Reads one column of the Lists tab, skipping blanks. */
function readList_(col) {
  const sh = sheet_(CONFIG.SHEETS.LISTS);
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, col, last - 1, 1).getValues()
    .map(r => String(r[0]).trim())
    .filter(Boolean);
}

/** Dropdown options and currency for the form. */
function getConfig() {
  return {
    currency: CONFIG.CURRENCY,
    categories: readList_(CONFIG.LIST_COL.CATEGORY),
    units: readList_(CONFIG.LIST_COL.UNIT),
    locations: readList_(CONFIG.LIST_COL.LOCATION),
  };
}

/** First row (from 2) whose Item cell is empty. Prefilled formula rows count as empty. */
function nextEmptyRow_(sh) {
  const last = Math.max(sh.getLastRow(), 2);
  const items = sh.getRange(2, CONFIG.COL.ITEM, last - 1, 1).getValues();
  for (let i = 0; i < items.length; i++) {
    if (String(items[i][0]).trim() === '') return i + 2;
  }
  return last + 1;
}

function parseDate_(s) {
  if (!s) return new Date();
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Adds one item as a new row on the Stock tab.
 * @param {{item:string, price:number|string, date?:string, quantity?:number|string,
 *          category?:string, unit?:string, location?:string, notes?:string}} data
 * @return {{ok:boolean, id?:string, row?:number, error?:string}}
 */
function addItem(data) {
  const item = String(data.item || '').trim();
  const price = Number(data.price);
  if (!item) return { ok: false, error: 'Item name is required.' };
  if (data.price === '' || isNaN(price) || price < 0) {
    return { ok: false, error: 'Price must be a number of 0 or more.' };
  }
  const qty = data.quantity === '' || data.quantity == null ? '' : Number(data.quantity);
  if (qty !== '' && (isNaN(qty) || qty <= 0)) {
    return { ok: false, error: 'Quantity must be more than 0.' };
  }

  const lock = LockService.getDocumentLock();
  lock.waitLock(10000);
  try {
    const sh = sheet_(CONFIG.SHEETS.STOCK);
    const r = nextEmptyRow_(sh);
    const C = CONFIG.COL;

    // B..G: Date, Item, Category, Quantity, Unit, Price
    sh.getRange(r, C.DATE, 1, 6).setValues([[
      parseDate_(data.date), item, data.category || '', qty, data.unit || '', price,
    ]]);
    // I..J: Location, Notes
    sh.getRange(r, C.LOCATION, 1, 2).setValues([[data.location || '', data.notes || '']]);
    // ID and Total formulas (rows past the prefilled block need them too)
    sh.getRange(r, C.ID).setFormula(
      `=IF(C${r}="","","${CONFIG.ID_PREFIX}"&TEXT(ROW()-1,"0000"))`);
    sh.getRange(r, C.TOTAL).setFormula(`=IF(G${r}="","",IF(E${r}="",1,E${r})*G${r})`);
    sh.getRange(r, C.DATE).setNumberFormat('dd mmm yyyy');
    sh.getRange(r, C.PRICE, 1, 2).setNumberFormat('"Rp"#,##0;-"Rp"#,##0;"-"');

    SpreadsheetApp.flush();
    return { ok: true, id: sh.getRange(r, C.ID).getDisplayValue(), row: r };
  } finally {
    lock.releaseLock();
  }
}

/** Most recent items (newest first) plus this month's total spend. */
function getRecentItems() {
  const sh = sheet_(CONFIG.SHEETS.STOCK);
  const last = sh.getLastRow();
  const rows = last < 2 ? [] : sh.getRange(2, 1, last - 1, 10).getDisplayValues();
  const C = CONFIG.COL;
  const items = rows
    .filter(r => r[C.ITEM - 1].trim() !== '')
    .slice(-CONFIG.RECENT_LIMIT)
    .reverse()
    .map(r => ({
      id: r[C.ID - 1], date: r[C.DATE - 1], item: r[C.ITEM - 1],
      category: r[C.CATEGORY - 1], quantity: r[C.QTY - 1], unit: r[C.UNIT - 1],
      total: r[C.TOTAL - 1], location: r[C.LOCATION - 1],
    }));

  const summary = sheet_(CONFIG.SHEETS.SUMMARY);
  return {
    items,
    month: summary.getRange(CONFIG.SUMMARY_MONTH_CELL).getDisplayValue(),
    monthTotal: summary.getRange(CONFIG.SUMMARY_TOTAL_CELL).getDisplayValue(),
  };
}
