// Settings for the expert review (README.md).
window.REVIEW_CONFIG = {
  version: "2026-11-07",

  // The Google Apps Script web app that stores the answers (apps-script/README.md). Empty, or ?test=1 in the address:
  // nothing is sent, and the last page shows the answers instead.
  scriptUrl: "https://script.google.com/macros/s/AKfycbyC1qu-cS7Yr-N7qaVdHGVYpovzPrmKXZujb-gUnzy8fwjlxRxvID8U3lz5JKoVPmyKxA/exec",

  // Shown on the first page
  title: "Weather routing: expert review",
  institution: "King Abdullah University of Science and Technology (KAUST)",
  contactEmail: "multi.vis.w@gmail.com",

  // Below this window size the page asks for a larger one: the screenshots need the room
  minWidth: 1000,
  minHeight: 650,
};
