"""Builds Home Stock Tracker.xlsx (Stock log, This Month summary, Lists).
Upload to Google Drive to convert it to a Google Sheet."""
import datetime as dt
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.comments import Comment
from openpyxl.chart import BarChart, Reference

ROWS = 100  # prefilled formula rows in Stock; the app writes formulas on any row it adds
F = "Arial"
HDR = PatternFill("solid", fgColor="1F3A5F")
AUTO = PatternFill("solid", fgColor="7F8C8D")
INPUT = PatternFill("solid", fgColor="FFFF00")
TOTAL = PatternFill("solid", fgColor="E8EEF4")
hfont = Font(name=F, bold=True, color="FFFFFF")
base = Font(name=F)
bold = Font(name=F, bold=True)
IDR = '"Rp"#,##0;-"Rp"#,##0;"-"'
DATE = "dd mmm yyyy"
thin = Side(style="thin", color="BFBFBF")

CATS = ["Food", "Drinks", "Cleaning", "Toiletries", "Medicine", "Household", "Other"]
UNITS = ["pcs", "pack", "box", "kg", "g", "L", "ml", "bottle"]
LOCS = ["Kitchen", "Fridge", "Bathroom", "Storage", "Bedroom"]

wb = Workbook()
summ = wb.active; summ.title = "This Month"
stock = wb.create_sheet("Stock")
lists = wb.create_sheet("Lists")

# ---------- Lists ----------
for c, (h, vals) in enumerate([("Category", CATS), ("Unit", UNITS), ("Location", LOCS)], 1):
    cell = lists.cell(1, c, h); cell.font = hfont; cell.fill = HDR
    for r, v in enumerate(vals, 2):
        lists.cell(r, c, v).font = base
    lists.column_dimensions[cell.column_letter].width = 16
lists["E1"] = "Edit these lists to change the dropdown options on the Stock tab."
lists["E1"].font = Font(name=F, italic=True, color="595959")
lists.freeze_panes = "A2"

# ---------- Stock ----------
heads = ["ID", "Date Added", "Item", "Category", "Quantity", "Unit",
         "Price (IDR)", "Total (IDR)", "Location", "Notes"]
widths = [11, 14, 28, 14, 10, 9, 15, 15, 13, 32]
auto_cols = {"ID", "Total (IDR)"}
for c, (h, w) in enumerate(zip(heads, widths), 1):
    cell = stock.cell(1, c, h)
    cell.font = hfont; cell.fill = AUTO if h in auto_cols else HDR
    cell.alignment = Alignment(horizontal="center", vertical="center")
    stock.column_dimensions[cell.column_letter].width = w
stock.row_dimensions[1].height = 22
stock["A1"].comment = Comment(
    "How to use: fill in Date Added, Item and Price (required). Category, Quantity, Unit, "
    "Location and Notes are optional; a blank Quantity counts as 1. "
    "Grey columns (ID, Total) calculate automatically. "
    "Row 2 is an example; delete its values when you start.", "Home Stock")
stock.freeze_panes = "A2"

example = [dt.date(2026, 11, 2), "Rice 5kg", "Food", 1, "pack", 75000, None, "Kitchen", "Example row"]
for r in range(2, ROWS + 2):
    stock.cell(r, 1, f'=IF(C{r}="","","ITM-"&TEXT(ROW()-1,"0000"))')
    stock.cell(r, 8, f'=IF(G{r}="","",IF(E{r}="",1,E{r})*G{r})')
    for c in range(1, 11):
        cell = stock.cell(r, c); cell.font = base
    stock.cell(r, 2).number_format = DATE
    stock.cell(r, 7).number_format = IDR
    stock.cell(r, 8).number_format = IDR
for c, v in zip([2, 3, 4, 5, 6, 7, 9, 10], [example[i] for i in [0, 1, 2, 3, 4, 5, 7, 8]]):
    stock.cell(2, c, v)

end = ROWS + 1
for col, rng in [("D", "$A$2:$A$30"), ("F", "$B$2:$B$30"), ("I", "$C$2:$C$30")]:
    dv = DataValidation(type="list", formula1=f"=Lists!{rng}", allow_blank=True)
    dv.add(f"{col}2:{col}{end}"); stock.add_data_validation(dv)
dvd = DataValidation(type="date", operator="greaterThan", formula1="36526", allow_blank=True)
dvd.add(f"B2:B{end}"); stock.add_data_validation(dvd)
dvn = DataValidation(type="decimal", operator="greaterThanOrEqual", formula1="0", allow_blank=True)
dvn.add(f"E2:E{end}"); dvn.add(f"G2:G{end}"); stock.add_data_validation(dvn)

# ---------- This Month ----------
summ["A1"] = "Spending by Category"; summ["A1"].font = Font(name=F, bold=True, size=14)
summ["A2"] = ("Yellow cell is an input. It shows the current month automatically; "
              "type any date in it to see another month.")
summ["A2"].font = Font(name=F, italic=True, color="595959")
summ["A4"] = "Month"; summ["A4"].font = bold
summ["B4"] = "=DATE(YEAR(TODAY()),MONTH(TODAY()),1)"
summ["B4"].number_format = "mmmm yyyy"; summ["B4"].fill = INPUT; summ["B4"].font = bold
summ["A5"] = "Month end"; summ["A5"].font = base
summ["B5"] = "=EOMONTH(B4,0)"; summ["B5"].number_format = DATE; summ["B5"].font = base

sh = ["Category", "Items", "Spend (IDR)", "Share of spend"]
for c, h in enumerate(sh, 1):
    cell = summ.cell(7, c, h); cell.font = hfont; cell.fill = HDR
    cell.alignment = Alignment(horizontal="center")
first, last = 8, 8 + len(CATS) - 1
unc, tot = last + 1, last + 2
crit = 'Stock!$B:$B,">="&$B$4,Stock!$B:$B,"<="&$B$5'
for i in range(len(CATS)):
    r = first + i
    summ.cell(r, 1, f"=Lists!A{i + 2}")
    summ.cell(r, 2, f"=COUNTIFS(Stock!$D:$D,$A{r},{crit})")
    summ.cell(r, 3, f"=SUMIFS(Stock!$H:$H,Stock!$D:$D,$A{r},{crit})")
summ.cell(unc, 1, "Uncategorized")
summ.cell(unc, 2, f"=B{tot}-SUM(B{first}:B{last})")
summ.cell(unc, 3, f"=C{tot}-SUM(C{first}:C{last})")
summ.cell(tot, 1, "Total")
summ.cell(tot, 2, f'=COUNTIFS({crit})')
summ.cell(tot, 3, f"=SUMIFS(Stock!$H:$H,{crit})")
for r in range(first, tot + 1):
    summ.cell(r, 4, f"=IF($C${tot}=0,0,C{r}/$C${tot})")
    for c in range(1, 5):
        cell = summ.cell(r, c); cell.font = bold if r == tot else base
        cell.border = Border(bottom=thin)
        if r == tot: cell.fill = TOTAL
    summ.cell(r, 2).number_format = '#,##0;-#,##0;"-"'
    summ.cell(r, 3).number_format = IDR
    summ.cell(r, 4).number_format = '0.0%;-0.0%;"-"'
for col, w in zip("ABCD", [18, 10, 18, 16]):
    summ.column_dimensions[col].width = w

ch = BarChart(); ch.type = "bar"; ch.title = "Spend by category (IDR)"
ch.add_data(Reference(summ, min_col=3, min_row=7, max_row=unc), titles_from_data=True)
ch.set_categories(Reference(summ, min_col=1, min_row=first, max_row=unc))
ch.legend = None; ch.height = 8; ch.width = 14
summ.add_chart(ch, "F4")

wb.save("Home Stock Tracker.xlsx")
