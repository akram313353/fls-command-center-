/* ============================================================
   RISK LEVEL — Level 0 issues come in with entry.risk set to
   "Regular", "Medium" or "Risky". Paste this file into the Apps Script
   project behind the FLS spreadsheet, then in the "submit-patrol"
   handler, right after each issue row is appended, call:

     writeRiskLevel_(sheet, sheet.getLastRow(), entry.risk);

   Tower 1 / Tower 2 entries have no risk, so their cell stays blank.
   Colours match the buttons in index.html (RISK_LEVELS).
   ============================================================ */
var RISK_COLUMN_HEADER = "Risk Level";
var RISK_COLORS = {
  Regular: { background: "#2e7d32", font: "#ffffff" }, // green
  Medium:  { background: "#f9a825", font: "#000000" }, // amber
  Risky:   { background: "#c62828", font: "#ffffff" }, // red
};

// Finds the "Risk Level" column, adding it after the last header if missing.
function riskColumn_(sheet) {
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var idx = headers.indexOf(RISK_COLUMN_HEADER);
  if (idx > -1) return idx + 1;
  var col = headers[lastCol - 1] === "" ? lastCol : lastCol + 1;
  sheet.getRange(1, col).setValue(RISK_COLUMN_HEADER).setFontWeight("bold");
  return col;
}

function writeRiskLevel_(sheet, row, risk) {
  if (!risk || !RISK_COLORS[risk]) return;
  var cell = sheet.getRange(row, riskColumn_(sheet));
  cell.setValue(risk)
      .setBackground(RISK_COLORS[risk].background)
      .setFontColor(RISK_COLORS[risk].font)
      .setFontWeight("bold")
      .setHorizontalAlignment("center");
}

/* Optional: so the app can show the risk badge on open Level 0 issues, add
   `risk` to each object the "pending-issues" and "check-duplicates" handlers
   return, e.g. risk: row[riskColumn_(sheet) - 1]. */
