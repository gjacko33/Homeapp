/**
 * Code.gs: server side (Google Apps Script).
 * FRAMEWORK STUBS: implementation happens in Phase 1 after approval.
 */

/** Serves the web app (the input form). */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Home Stock')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Returns config lists to the form (categories, units, locations, currency). */
function getConfig() {
  // TODO(Phase 1): return the dropdown lists + currency from CONFIG
}

/** One-time setup: creates the "Stock" tab with headers and formatting. */
function setupSheet() {
  // TODO(Phase 1): create sheet if missing, write CONFIG.COLUMNS header row,
  // freeze header, set number/date formats
}

/**
 * Adds one item as a new row.
 * @param {{item:string, price:number, quantity?:number, category?:string,
 *          unit?:string, location?:string, notes?:string}} data
 * @return {{ok:boolean, id?:string, error?:string}}
 */
function addItem(data) {
  // TODO(Phase 1): validate (item + price required), generate ID + date,
  // append row, write Total formula (=Quantity*Price)
}

/** Returns the most recent items + total spend for the list under the form. */
function getRecentItems() {
  // TODO(Phase 1): read last CONFIG.RECENT_LIMIT rows, newest first
}
