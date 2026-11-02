/**
 * Code.gs: server side (Google Apps Script, bound to the Home Stock Tracker sheet).
 * Open the sheet > Extensions > Apps Script, paste Config.gs, Code.gs and Index.html,
 * then Deploy > New deployment > Web app.
 */

/**
 * Web app entry point.
 * - With ?action=... it answers as a JSON API (used by the Android app).
 * - Otherwise it serves the HTML form. If an access key exists, the link must include ?key=YOUR_KEY.
 */
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action) return api_(p.action, p.key, p.data ? JSON.parse(p.data) : null);
  if (!keyMatches_(p.key, true)) {
    return HtmlService.createHtmlOutput(
      '<p style="font-family:Arial;padding:24px">Not authorized. Open the link that ends with ?key=YOUR_KEY.</p>');
  }
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Home Stock')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** JSON API for the Android app. Body: {"action": "...", "key": "...", "data": {...}} */
function doPost(e) {
  let body = {};
  try { body = JSON.parse(e.postData.contents); } catch (err) { /* handled below */ }
  return api_(body.action, body.key, body.data);
}

function api_(action, key, data) {
  let out;
  try {
    if (!keyMatches_(key, false)) {
      out = { ok: false, error: 'Wrong or missing access key. Run createAccessKey in Apps Script.' };
    } else if (action === 'getConfig') {
      out = { ok: true, result: getConfig() };
    } else if (action === 'getRecentItems') {
      out = { ok: true, result: getRecentItems() };
    } else if (action === 'addItem') {
      out = { ok: true, result: addItem(data || {}) };
    } else {
      out = { ok: false, error: 'Unknown action: ' + action };
    }
  } catch (err) {
    out = { ok: false, error: String(err && err.message || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * The HTML page is open when no key has been created yet (allowIfUnset = true).
 * The JSON API always requires a key.
 */
function keyMatches_(key, allowIfUnset) {
  const stored = PropertiesService.getScriptProperties().getProperty('ACCESS_KEY');
  if (!stored) return allowIfUnset;
  return String(key || '') === stored;
}

/**
 * Run this once from the Apps Script editor (select it, click Run).
 * It creates the access key for the Android app and prints it in the Execution log.
 * Running it again replaces the key, so the old one stops working.
 */
function createAccessKey() {
  const key = Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('ACCESS_KEY', key);
  Logger.log('Access key: ' + key);
  Logger.log('Web link for a browser: add ?key=' + key + ' to the end of your Web app URL.');
  return key;
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

/** Most recent items (newest first) plus this month's totals by category. */
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
  const catRange = summary.getRange(CONFIG.SUMMARY_CATEGORY_RANGE);
  const catDisplay = catRange.getDisplayValues();
  const categories = catRange.getValues()
    .map((r, i) => ({
      name: String(r[0]), items: Number(r[1]) || 0,
      spend: Number(r[2]) || 0, spendText: catDisplay[i][2],
    }))
    .filter(c => c.spend > 0)
    .sort((a, b) => b.spend - a.spend);

  return {
    items,
    categories,
    month: summary.getRange(CONFIG.SUMMARY_MONTH_CELL).getDisplayValue(),
    monthItems: summary.getRange(CONFIG.SUMMARY_COUNT_CELL).getDisplayValue(),
    monthTotal: summary.getRange(CONFIG.SUMMARY_TOTAL_CELL).getDisplayValue(),
  };
}
