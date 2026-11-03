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
  if (p.action) return api_(p.action, p.key, p.data ? JSON.parse(p.data) : null, p.callback);
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

/**
 * Runs one API action. With a callback name (browser file using JSONP) the JSON is
 * wrapped as callback(...), which works from pages opened straight from disk.
 */
function api_(action, key, data, callback) {
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
  const json = JSON.stringify(out);
  if (callback && /^[A-Za-z_$][\w$]*$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
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

/** @return {GoogleAppsScript.Spreadsheet.Sheet} */
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
    users: CONFIG.USERS,
  };
}

/**
 * Adds the "Added By" column to the Stock tab the first time it is needed.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sh
 */
function ensureAddedByColumn_(sh) {
  const col = CONFIG.COL.ADDED_BY;
  if (sh.getMaxColumns() < col) sh.insertColumnsAfter(sh.getMaxColumns(), col - sh.getMaxColumns());
  const head = sh.getRange(1, col);
  if (String(head.getValue()).trim() !== '') return;
  head.setValue('Added By');
  sh.getRange(1, CONFIG.COL.ITEM).copyFormatToRange(sh, col, col, 1, 1);
  sh.setColumnWidth(col, 110);
  if (sh.getMaxRows() > 1) {
    sh.getRange(2, col, sh.getMaxRows() - 1, 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(CONFIG.USERS, true).setAllowInvalid(true).build());
  }
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
 *          category?:string, unit?:string, location?:string, notes?:string, addedBy?:string}} data
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

  const addedBy = String(data.addedBy || '').trim();
  if (addedBy && CONFIG.USERS.indexOf(addedBy) < 0) {
    return { ok: false, error: 'Unknown user: ' + addedBy };
  }

  const lock = LockService.getDocumentLock();
  lock.waitLock(10000);
  try {
    const sh = sheet_(CONFIG.SHEETS.STOCK);
    ensureAddedByColumn_(sh);
    const r = nextEmptyRow_(sh);
    const C = CONFIG.COL;

    // B..G: Date, Item, Category, Quantity, Unit, Price
    sh.getRange(r, C.DATE, 1, 6).setValues([[
      parseDate_(data.date), item, data.category || '', qty, data.unit || '', price,
    ]]);
    // I..K: Location, Notes, Added By
    sh.getRange(r, C.LOCATION, 1, 3).setValues([[data.location || '', data.notes || '', addedBy]]);
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

/** Most recent items (newest first), this month's totals by category and by person. */
function getRecentItems() {
  const sh = sheet_(CONFIG.SHEETS.STOCK);
  ensureAddedByColumn_(sh);
  const C = CONFIG.COL;
  const width = C.ADDED_BY;
  const last = sh.getLastRow();
  const range = last < 2 ? null : sh.getRange(2, 1, last - 1, width);
  const rows = range ? range.getDisplayValues() : [];
  const raw = range ? range.getValues() : [];

  const items = rows
    .filter(r => r[C.ITEM - 1].trim() !== '')
    .slice(-CONFIG.RECENT_LIMIT)
    .reverse()
    .map(r => ({
      id: r[C.ID - 1], date: r[C.DATE - 1], item: r[C.ITEM - 1],
      category: r[C.CATEGORY - 1], quantity: r[C.QTY - 1], unit: r[C.UNIT - 1],
      total: r[C.TOTAL - 1], location: r[C.LOCATION - 1], addedBy: r[C.ADDED_BY - 1],
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

  // Spend per person for the month shown on the This Month tab.
  const start = summary.getRange(CONFIG.SUMMARY_MONTH_CELL).getValue();
  const people = CONFIG.USERS.map(name => ({ name, spend: 0, items: 0 }));
  if (start instanceof Date) {
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    raw.forEach(r => {
      const d = r[C.DATE - 1];
      if (!String(r[C.ITEM - 1]).trim() || !(d instanceof Date) || d < start || d >= end) return;
      const who = String(r[C.ADDED_BY - 1] || '').trim() || 'Not set';
      let p = people.find(x => x.name === who);
      if (!p) { p = { name: who, spend: 0, items: 0 }; people.push(p); }
      p.spend += Number(r[C.TOTAL - 1]) || 0;
      p.items += 1;
    });
  }

  return {
    items,
    categories,
    people,
    month: summary.getRange(CONFIG.SUMMARY_MONTH_CELL).getDisplayValue(),
    monthItems: summary.getRange(CONFIG.SUMMARY_COUNT_CELL).getDisplayValue(),
    monthTotal: summary.getRange(CONFIG.SUMMARY_TOTAL_CELL).getDisplayValue(),
  };
}

/* ======================================================================
 * Sheet styling
 * ==================================================================== */

const STYLE = {
  font: 'Arial',
  navy: '#1F3A5F', grey: '#7F8C8D', ink: '#14243A', muted: '#6B7785',
  band: '#F5F7FA', line: '#E1E6ED', total: '#E8EEF4', input: '#FFF4CC', inputLine: '#E6C35C',
  idr: '"Rp"#,##0;-"Rp"#,##0;"-"',
  // Category tag colours (background, text), matching the app.
  tags: [
    ['#E3ECFB', '#1F55B8'], ['#DDF3F0', '#0B7A6D'], ['#FBE3E4', '#B42328'], ['#FDF1DC', '#9A5B00'],
    ['#EEE3F6', '#6B35A0'], ['#D9EEFF', '#0066B3'], ['#ECECEF', '#5B5D68'],
  ],
  // Person tag colours (background, text), matching the app.
  people: [['#EEEBFE', '#5B4BD6'], ['#FDE4EF', '#B4235F'], ['#DDF3F0', '#0B7A6D'], ['#FDF1DC', '#9A5B00']],
};

/**
 * Run once from the Apps Script editor (select it, click Run) to tidy up all tabs.
 * Only formatting changes. Data, formulas and cell positions stay the same,
 * so the app keeps working. Safe to run again at any time.
 */
function tidyUpSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const categories = readList_(CONFIG.LIST_COL.CATEGORY);
  styleSummary_(sheet_(CONFIG.SHEETS.SUMMARY));
  ensureAddedByColumn_(sheet_(CONFIG.SHEETS.STOCK));
  styleStock_(sheet_(CONFIG.SHEETS.STOCK), categories);
  styleLists_(sheet_(CONFIG.SHEETS.LISTS));
  ss.setActiveSheet(sheet_(CONFIG.SHEETS.SUMMARY));
  SpreadsheetApp.flush();
}

/** @param {GoogleAppsScript.Spreadsheet.Sheet} sh */
function styleSummary_(sh) {
  sh.setHiddenGridlines(true);
  sh.setTabColor(STYLE.navy);

  // Trim the empty grid so the page reads as one dashboard.
  if (sh.getMaxColumns() > 14) sh.deleteColumns(15, sh.getMaxColumns() - 14);
  if (sh.getMaxRows() > 30) sh.deleteRows(31, sh.getMaxRows() - 30);

  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns())
    .setFontFamily(STYLE.font).setFontColor(STYLE.ink).setVerticalAlignment('middle');

  sh.setColumnWidth(1, 180);
  sh.setColumnWidth(2, 150);
  sh.setColumnWidth(3, 150);
  sh.setColumnWidth(4, 130);
  sh.setColumnWidth(5, 32);
  sh.setColumnWidths(6, 9, 80);

  sh.setRowHeight(1, 46);
  sh.setRowHeight(2, 22);
  sh.setRowHeight(3, 14);
  sh.setRowHeights(4, 2, 30);
  sh.setRowHeight(6, 14);
  sh.setRowHeight(7, 34);
  sh.setRowHeights(8, 8, 30);
  sh.setRowHeight(16, 36);

  // Title and note
  sh.getRange('A1').setFontSize(20).setFontWeight('bold').setFontColor(STYLE.navy);
  sh.getRange('A2').setFontSize(10).setFontStyle('italic').setFontColor(STYLE.muted);

  // Month selector
  sh.getRange('A4:A5').setFontColor(STYLE.muted).setFontSize(10);
  sh.getRange('A4').setFontWeight('bold');
  sh.getRange('B4')
    .setNumberFormat('mmmm yyyy').setFontSize(12).setFontWeight('bold')
    .setHorizontalAlignment('left').setBackground(STYLE.input)
    .setBorder(true, true, true, true, null, null, STYLE.inputLine, SpreadsheetApp.BorderStyle.SOLID);
  sh.getRange('B5').setNumberFormat('dd mmm yyyy').setHorizontalAlignment('left').setFontColor(STYLE.muted);

  // Table header
  sh.getRange('A7:D7')
    .setBackground(STYLE.navy).setFontColor('#FFFFFF').setFontWeight('bold').setFontSize(11)
    .setHorizontalAlignment('center');
  sh.getRange('A7').setHorizontalAlignment('left');

  // Table body: banded rows with thin separators
  sh.getRange('A8:D15').setFontSize(11).setFontWeight('normal').setFontStyle('normal')
    .setBorder(null, null, true, null, null, true, STYLE.line, SpreadsheetApp.BorderStyle.SOLID);
  for (let r = 8; r <= 15; r++) {
    sh.getRange(r, 1, 1, 4).setBackground(r % 2 === 0 ? '#FFFFFF' : STYLE.band);
  }
  sh.getRange('A15:D15').setFontStyle('italic').setFontColor(STYLE.muted);
  sh.getRange('A8:A16').setHorizontalAlignment('left');
  sh.getRange('B8:B16').setHorizontalAlignment('center');
  sh.getRange('C8:D16').setHorizontalAlignment('right');

  // Total row
  sh.getRange('A16:D16')
    .setBackground(STYLE.total).setFontWeight('bold').setFontSize(12).setFontColor(STYLE.navy)
    .setBorder(true, null, true, null, null, null, STYLE.navy, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  // Chart: rebuilt so it is aligned and styled like the table
  sh.getCharts().forEach(c => sh.removeChart(c));
  const chart = sh.newChart()
    .setChartType(Charts.ChartType.BAR)
    .addRange(sh.getRange('A7:A15'))
    .addRange(sh.getRange('C7:C15'))
    .setNumHeaders(1)
    .setPosition(4, 6, 0, 0)
    .setOption('title', 'Spend by category')
    .setOption('titleTextStyle', { color: STYLE.ink, fontSize: 14, bold: true })
    .setOption('legend', { position: 'none' })
    .setOption('colors', [STYLE.navy])
    .setOption('bar', { groupWidth: '60%' })
    .setOption('hAxis', { format: 'short', gridlines: { color: STYLE.line }, textStyle: { color: STYLE.muted } })
    .setOption('vAxis', { textStyle: { color: STYLE.ink } })
    .setOption('chartArea', { left: 110, top: 50, width: '72%', height: '78%' })
    .setOption('backgroundColor', '#FFFFFF')
    .setOption('width', 620)
    .setOption('height', 390)
    .build();
  sh.insertChart(chart);
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sh
 * @param {string[]} categories
 */
function styleStock_(sh, categories) {
  const C = CONFIG.COL;
  sh.setHiddenGridlines(true);
  sh.setTabColor('#12A594');
  const cols = C.ADDED_BY;
  if (sh.getMaxColumns() > cols) sh.deleteColumns(cols + 1, sh.getMaxColumns() - cols);

  const rows = sh.getMaxRows();
  const all = sh.getRange(1, 1, rows, cols);
  all.setFontFamily(STYLE.font).setFontSize(10).setFontColor(STYLE.ink).setVerticalAlignment('middle');

  // Alternating rows that extend to every row, including new ones.
  sh.getBandings().forEach(b => b.remove());
  all.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, true, false)
    .setHeaderRowColor(STYLE.navy)
    .setFirstRowColor('#FFFFFF')
    .setSecondRowColor(STYLE.band);

  // Header: grey marks the columns that calculate automatically.
  sh.getRange(1, 1, 1, cols)
    .setBackground(STYLE.navy).setFontColor('#FFFFFF').setFontWeight('bold')
    .setHorizontalAlignment('center').setWrap(true);
  sh.getRange(1, C.ID).setBackground(STYLE.grey);
  sh.getRange(1, C.TOTAL).setBackground(STYLE.grey);
  sh.setRowHeight(1, 36);
  if (rows > 1) sh.setRowHeights(2, rows - 1, 28);
  sh.setFrozenRows(1);

  const widths = { ID: 90, DATE: 110, ITEM: 230, CATEGORY: 120, QTY: 80, UNIT: 70, PRICE: 120, TOTAL: 130, LOCATION: 110, NOTES: 260, ADDED_BY: 110 };
  Object.keys(widths).forEach(k => sh.setColumnWidth(C[k], widths[k]));

  if (rows > 1) {
    const col = c => sh.getRange(2, c, rows - 1, 1);
    col(C.ID).setHorizontalAlignment('center').setFontColor(STYLE.muted);
    col(C.DATE).setHorizontalAlignment('center').setNumberFormat('dd mmm yyyy');
    col(C.ITEM).setHorizontalAlignment('left');
    col(C.CATEGORY).setHorizontalAlignment('center');
    col(C.QTY).setHorizontalAlignment('center');
    col(C.UNIT).setHorizontalAlignment('center');
    col(C.PRICE).setHorizontalAlignment('right').setNumberFormat(STYLE.idr);
    col(C.TOTAL).setHorizontalAlignment('right').setNumberFormat(STYLE.idr).setFontWeight('bold');
    col(C.LOCATION).setHorizontalAlignment('center');
    col(C.NOTES).setHorizontalAlignment('left').setFontColor(STYLE.muted);
    col(C.ADDED_BY).setHorizontalAlignment('center');

    // Coloured category tags, same colours as the app.
    const catRange = col(C.CATEGORY);
    const others = sh.getConditionalFormatRules().filter(rule =>
      !rule.getRanges().some(r => r.getColumn() === C.CATEGORY || r.getColumn() === C.ADDED_BY));
    const tagRules = categories.map((name, i) => {
      const [bg, fg] = STYLE.tags[i % STYLE.tags.length];
      return SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo(name).setBackground(bg).setFontColor(fg).setBold(true)
        .setRanges([catRange]).build();
    });
    const whoRange = col(C.ADDED_BY);
    const personRules = CONFIG.USERS.map((name, i) => {
      const [bg, fg] = STYLE.people[i % STYLE.people.length];
      return SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo(name).setBackground(bg).setFontColor(fg).setBold(true)
        .setRanges([whoRange]).build();
    });
    sh.setConditionalFormatRules(others.concat(tagRules, personRules));
  }

  const filter = sh.getFilter();
  if (filter && filter.getRange().getNumColumns() < cols) filter.remove();
  if (!sh.getFilter()) sh.getRange(1, 1, rows, cols).createFilter();
}

/** @param {GoogleAppsScript.Spreadsheet.Sheet} sh */
function styleLists_(sh) {
  sh.setHiddenGridlines(true);
  sh.setTabColor(STYLE.grey);
  const rows = sh.getMaxRows();
  sh.getRange(1, 1, rows, sh.getMaxColumns()).setFontFamily(STYLE.font).setFontSize(10)
    .setFontColor(STYLE.ink).setVerticalAlignment('middle');
  sh.getRange('A1:C1').setBackground(STYLE.navy).setFontColor('#FFFFFF').setFontWeight('bold')
    .setHorizontalAlignment('center');
  sh.getRange('A2:C30').setHorizontalAlignment('center')
    .setBorder(null, null, null, null, true, true, STYLE.line, SpreadsheetApp.BorderStyle.SOLID);
  sh.getRange('E1').setFontStyle('italic').setFontColor(STYLE.muted);
  sh.setColumnWidths(1, 3, 150);
  sh.setColumnWidth(4, 24);
  sh.setRowHeight(1, 32);
  if (rows > 1) sh.setRowHeights(2, rows - 1, 26);
  sh.setFrozenRows(1);
}
