/**
 * Config: single source of truth for the sheet layout and dropdown lists.
 * Change values here; Code.gs and Index.html read from this.
 */
const CONFIG = {
  SHEET_NAME: 'Stock',
  CURRENCY: 'IDR',
  ID_PREFIX: 'ITM-',
  RECENT_LIMIT: 10,

  COLUMNS: [
    'ID', 'Date Added', 'Item', 'Category', 'Quantity',
    'Unit', 'Price (per unit)', 'Total', 'Location', 'Notes',
  ],

  CATEGORIES: ['Food', 'Drinks', 'Cleaning', 'Toiletries', 'Medicine', 'Household', 'Other'],
  UNITS: ['pcs', 'pack', 'box', 'kg', 'g', 'L', 'ml', 'bottle'],
  LOCATIONS: ['Kitchen', 'Fridge', 'Bathroom', 'Storage', 'Bedroom'],
};
