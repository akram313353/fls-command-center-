/* ============================================================
   PATROL TIME — how long each patrol took.
   The app sends "log-patrol-event" with event Start / Pause / Resume and,
   when a patrol finishes, Submit / Logout / Closed carrying totalDuration
   (time spent, pauses taken out) and totalPaused. "submit-patrol" also
   carries patrolDuration for the whole round.

   Paste this file into the Apps Script project, then in doPost:
     if (body.action === "log-patrol-event") return logPatrolEvent_(body);
   (replacing the existing log-patrol-event handling), and in the
   "submit-patrol" handler, after each issue row is appended:
     writePatrolDuration_(sheet, sheet.getLastRow(), body.patrolDuration);
   ============================================================ */
var PATROL_LOG_SHEET = "Patrol Timer Log";
var PATROL_LOG_HEADERS = ["Timestamp", "Officer", "Session ID", "Event", "Pause Length", "Patrol Time", "Time Paused"];

function logPatrolEvent_(body) {
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(PATROL_LOG_SHEET) || ss.insertSheet(PATROL_LOG_SHEET);
  if (sheet.getLastRow() === 0) sheet.appendRow(PATROL_LOG_HEADERS).setFrozenRows(1);
  sheet.appendRow([
    body.timestamp ? new Date(body.timestamp) : new Date(),
    body.officer || "", body.sessionId || "", body.event || "",
    body.pauseDuration || "", body.totalDuration || "", body.totalPaused || "",
  ]);
  if (body.totalDuration) sheet.getRange(sheet.getLastRow(), 6).setFontWeight("bold");
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}

// Adds a "Patrol Time" column to the issue sheet so each reported issue
// shows how long that officer's patrol took.
function writePatrolDuration_(sheet, row, duration) {
  if (!duration) return;
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var col = headers.indexOf("Patrol Time") + 1;
  if (!col) { col = lastCol + 1; sheet.getRange(1, col).setValue("Patrol Time").setFontWeight("bold"); }
  sheet.getRange(row, col).setValue(duration);
}
