/* ============================================================
   AREA PLACES — the app asks for an area's place list (e.g. Level -1)
   with action "get-locations" right after sign-in, so the place names
   live only in the spreadsheet and never in the public site code.

   Setup:
   1. Add a tab named "Places" with two columns: Area | Place
      (e.g. "Level -1" | "<place name>"), one row per place.
   2. Paste this file into the Apps Script project.
   3. In doPost, add:   if (body.action === "get-locations") return getLocations_(body);
      and replace isValidLogin_ below with your existing login check.
   ============================================================ */
var PLACES_SHEET = "Places";

function getLocations_(body) {
  if (!isValidLogin_(body.id, body.password)) {
    return json_({ ok: false, error: "Not signed in" });
  }
  var sheet = SpreadsheetApp.getActive().getSheetByName(PLACES_SHEET);
  if (!sheet) return json_({ ok: true, locations: [] });
  var rows = sheet.getDataRange().getValues().slice(1);
  var seen = {};
  var locations = [];
  rows.forEach(function (r) {
    var area = String(r[0]).trim(), place = String(r[1]).trim();
    if (area === body.area && place && !seen[place]) { seen[place] = true; locations.push(place); }
  });
  return json_({ ok: true, locations: locations });
}

// Replace with the same check your "login" action uses.
function isValidLogin_(id, password) {
  throw new Error("Wire isValidLogin_ to the existing login check");
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
