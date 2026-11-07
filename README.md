# Weather routing: expert review

An online questionnaire for a small number of invited experts: what a weather-routing tool must do, whether its model and
data are sound, and what they make of screenshots of the tool. Static files, served by GitHub Pages; the answers go to a
Google Sheet through a Google Apps Script web app.

- `index.html`, `review.js`, `review.css` (on top of `style.css`): the page.
- `questions.js`: every page and question, in order.
- `config.js`: the version, the Apps Script's URL and the contact address.
- `shots/`: the images of the route views and the keys of the six weather views, rendered in high resolution from a real
  route of the online system (by a private script). An image that is missing shows as a marked placeholder.
- `apps-script/`: the script that stores the answers, and how to set it up.

Each expert opens a personal link, `?e=<code>&o=<0-5>`. Answers are kept in the browser and sent after every page, so an
expert can stop and come back with the same link on the same computer; a finished link shows the thank-you page. `?test=1`
sends nothing, starts afresh at every load and shows the answers at the end. `?reset=1` added to a link forgets what this
browser kept for it and starts again (answers already sent stay in the sheet). Every answer may be left empty, except the
consent.

To try it locally: `python3 -m http.server 8000` in this folder, then open http://localhost:8000/?test=1
