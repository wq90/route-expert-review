/** @OnlyCurrentDoc */
// (the annotation above limits the script to the spreadsheet it belongs to: Google then asks for access to this one
// spreadsheet only, not to all of the account's spreadsheets)

// Google Apps Script for the expert review: stores the answers in this spreadsheet. Setup: apps-script/README.md.
//
//   POST { type: "page"|"final", page: "<page id>", expert: {...}, answers: { <question id>: value } } -> { ok: true }
//
// Sheets: "experts" (one row per expert, updated after every page) and "answers" (one row per expert and question; a
// page sent again, after the expert went back to it, replaces that question's row).

var EXPERT_COLS = ["pid", "no_link", "test", "order", "order_source", "views_order", "started_at", "finished_at", "pages_done",
  "finished", "page_seconds", "window_w", "window_h", "version", "updated_at"];
var ANSWER_COLS = ["pid", "page", "question", "answer", "test", "received_at", "sent_at", "version"];

// Run once from the editor: creates the two sheets with their header rows
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  [["experts", EXPERT_COLS], ["answers", ANSWER_COLS]].forEach(function (s) {
    var sh = ss.getSheetByName(s[0]) || ss.insertSheet(s[0]);
    sh.getRange(1, 1, 1, s[1].length).setValues([s[1]]).setFontWeight("bold");
    sh.setFrozenRows(1);
  });
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() { return json({ ok: true }); }

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var data = JSON.parse(e.postData.contents);
    var ex = data.expert || {};
    var pid = String(ex.pid || "").slice(0, 60);
    if (!pid) return json({ ok: false, error: "no pid" });
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var received = new Date().toISOString();
    var sh = ss.getSheetByName("answers");
    var rows = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues() : [];
    var at = {};
    rows.forEach(function (r, i) { at[r[0] + "|" + r[2]] = i + 2; });
    var answers = data.answers || {};
    Object.keys(answers).forEach(function (q) {
      var v = answers[q];
      var row = [pid, String(data.page || ""), q, typeof v === "string" ? v : JSON.stringify(v), !!ex.test, received, String(data.sent_at || ""), String(ex.version || "")];
      var r = at[pid + "|" + q];
      if (!r) { r = sh.getLastRow() + 1; at[pid + "|" + q] = r; }
      sh.getRange(r, 1, 1, ANSWER_COLS.length).setValues([row]);
    });
    upsertExpert(ss.getSheetByName("experts"), ex, pid, received);
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function upsertExpert(sh, ex, pid, received) {
  var row = EXPERT_COLS.map(function (c) {
    if (c === "pid") return pid;
    if (c === "updated_at") return received;
    var v = ex[c];
    return v === undefined || v === null ? "" : v;
  });
  var n = sh.getLastRow();
  var ids = n > 1 ? sh.getRange(2, 1, n - 1, 1).getValues() : [];
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === pid) { sh.getRange(i + 2, 1, 1, EXPERT_COLS.length).setValues([row]); return; }
  }
  sh.getRange(n + 1, 1, 1, EXPERT_COLS.length).setValues([row]);
}
