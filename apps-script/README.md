# Storing the answers

1. Create a new Google Sheet (for example "Expert review answers") with the account that will own the data.
2. In the Sheet: Extensions → Apps Script. Replace the editor's code with `Code.gs` from this folder and save.
3. Choose the function `setup` and press Run. Allow access when asked. The sheets "experts" and "answers" appear.
4. Deploy → New deployment → type "Web app". Execute as: Me. Who has access: Anyone. Deploy, and copy the web app URL.
5. Put that URL into `config.js` as `scriptUrl`.
6. Check it: open the site with a test code, `?e=check&o=0`, answer the first page and press Next. A row for "check"
   appears in both sheets. Delete those rows afterwards.

After changing `Code.gs`: Deploy → Manage deployments → edit → Version: New version, so the URL stays the same.

"answers" holds one row per expert and question; when an expert goes back to a page and changes it, the row is replaced.
Choices with several parts (a matrix, a ranking, a click on a screenshot) are stored as JSON. "experts" holds one row per
expert: their view order, the pages done and the seconds spent on each page.
