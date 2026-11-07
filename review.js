// The expert review: draws the pages in questions.js one at a time, keeps the answers in this browser (localStorage), and
// sends each page's answers to the Google Apps Script when the expert moves on, so a reload or a later visit continues
// where they were. Each expert has a personal link: ?e=<code>&o=<0-5>, the code naming them in the sheet (with this browser's own
// suffix) and o the order of the six weather views on the F2 page. The plain address, without a link, works for anyone. ?test=1 sends nothing, starts afresh at every load and shows the answers on the
// last page; ?reset=1 forgets what this browser kept for the link and starts again (answers already sent stay in the sheet).
// Every answer may be left empty, except the consent.
(function () {
  "use strict";
  var C = window.REVIEW_CONFIG, R = window.REVIEW;
  var params = new URLSearchParams(location.search);
  var TEST = !C.scriptUrl || params.has("test");
  var code = (params.get("e") || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
  var STORE = "rer_v1_" + (code || "nolink"), QUEUE = "rer_queue_v1";
  // Williams base order for six views (as in the online study); an expert's link turns it by o
  var BASE = [0, 1, 5, 2, 4, 3];
  var SECTION = { A: "About you", B: "The problem", C: "Tasks", D: "Requirements", E: "Model and data", F: "The route views", G: "To finish" };
  var app = document.getElementById("app");

  function now() { return new Date().toISOString(); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  // --- state -----------------------------------------------------------------------------------------------------------
  var S = (TEST || params.has("reset") ? null : load()) || fresh();
  function fresh() {
    var o = parseInt(params.get("o"), 10);
    var given = o >= 0 && o < 6;
    return {
      // the link's code with this browser's own suffix, so a link opened by someone else, or on another computer, never
      // replaces the answers already sent under it
      pid: code ? code + "-" + Math.random().toString(36).slice(2, 6) : "nolink-" + Math.random().toString(36).slice(2, 10), noLink: !code,
      order: given ? o : Math.floor(Math.random() * 6), orderSource: given ? "link" : "random",
      page: 0, answers: {}, pageMs: {}, pagesDone: [], startedAt: now(), finishedAt: null,
    };
  }
  function load() { try { return JSON.parse(localStorage.getItem(STORE)); } catch (e) { return null; } }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) { /* kept in memory only */ } }
  function viewOrder() { return BASE.map(function (x) { return R.views[(x + S.order) % 6][0]; }); }
  function viewName(id) { return R.views.filter(function (x) { return x[0] === id; })[0][1]; }

  // a "views" item becomes, in the expert's order, each view's card with its own questions under it (ids like F2_strap_t1)
  var PAGES = R.pages.map(function (page) {
    var items = [];
    page.items.forEach(function (it) {
      if (it.type !== "views") return items.push(it);
      viewOrder().forEach(function (v, i) {
        items.push({ type: "viewcard", view: v, n: i + 1, file: it.file.replace("{view}", v), key: it.key.replace("{view}", v) });
        it.per.forEach(function (q) { items.push(Object.assign({}, q, { id: page.id + "_" + v + "_" + q.suffix })); });
        items.push({ type: "viewend" });
      });
    });
    return Object.assign({}, page, { items: items });
  });

  // --- sending: a queue kept in localStorage, so nothing is lost when the network or the page drops --------------------
  function queue() { try { return JSON.parse(localStorage.getItem(QUEUE) || "[]"); } catch (e) { return []; } }
  function setQueue(q) { try { localStorage.setItem(QUEUE, JSON.stringify(q)); } catch (e) { /* kept in memory only */ } }
  var memQueue = [];
  function send(payload) {
    payload.sent_at = now();
    if (TEST) { S.testLog = (S.testLog || []).concat([payload]); save(); return Promise.resolve(true); }
    var q = queue(); q.push(payload); setQueue(q); memQueue.push(payload);
    return flush();
  }
  function post(payload) {
    var ctrl = new AbortController(), timer = setTimeout(function () { ctrl.abort(); }, 15000);
    // a plain-text body keeps this a "simple" request, which an Apps Script web app accepts from any site
    return fetch(C.scriptUrl, { method: "POST", body: JSON.stringify(payload), signal: ctrl.signal })
      .then(function (r) { return r.json(); })
      .then(function (d) { clearTimeout(timer); if (!d || !d.ok) throw new Error((d && d.error) || "not stored"); return true; });
  }
  var flushing = null;
  function flush(attempt) {
    if (flushing && !attempt) return flushing;
    attempt = attempt || 1;
    var q = queue();
    if (!q.length) q = memQueue.slice();
    if (!q.length) { flushing = null; return Promise.resolve(true); }
    flushing = post(q[0]).then(function () {
      setQueue(queue().slice(1)); memQueue.shift();
      return flush(1);
    }).catch(function () {
      if (attempt >= 4) { flushing = null; return false; }
      return new Promise(function (res) { setTimeout(res, [0, 1000, 3000, 7000][attempt]); }).then(function () { return flush(attempt + 1); });
    });
    return flushing;
  }
  function expert() {
    return {
      pid: S.pid, no_link: S.noLink, test: TEST, order: S.order, order_source: S.orderSource, views_order: viewOrder().join(" "),
      started_at: S.startedAt, finished_at: S.finishedAt || "", pages_done: S.pagesDone.join(" "), finished: !!S.finishedAt,
      page_seconds: JSON.stringify(Object.keys(S.pageMs).reduce(function (o, k) { o[k] = Math.round(S.pageMs[k] / 1000); return o; }, {})),
      window_w: window.innerWidth, window_h: window.innerHeight, version: C.version,
    };
  }
  // the answers that belong to a page: its items' ids, with their "other" and comment fields
  function pageAnswers(page) {
    var out = {};
    page.items.forEach(function (it) {
      [it.id, it.other, it.id && it.id + "_comment"].forEach(function (k) { if (k && S.answers[k] !== undefined) out[k] = S.answers[k]; });
    });
    return out;
  }

  // --- drawing ---------------------------------------------------------------------------------------------------------
  function shotHtml(file, alt, cls, extra) {
    return '<div class="shot-wrap ' + (cls || "") + '"' + (extra || "") + '><img class="shot" src="' + esc(file) + '" alt="' + esc(alt) + '" data-ph="' + esc(alt) + '"></div>';
  }
  function field(it, inner) {
    var err = it.type === "rank" ? "Give each one a different rank, or leave it empty." : "Please tick the box to take part.";
    return '<div class="item' + (it.check ? " check-q" : "") + '" data-item="' + esc(it.id) + '">' +
      (it.label ? '<div class="label">' + esc(it.label) + "</div>" : "") + inner + '<div class="err" hidden>' + err + "</div></div>";
  }
  function otherHtml(it) {
    if (!it.other) return "";
    var v = S.answers[it.other] || "";
    return '<div class="other" data-other-for="' + esc(it.id) + '"' + (shouldShowOther(it) ? "" : " hidden") + '><label class="small muted">' +
      esc(it.otherLabel || "Please say which") + '</label><textarea class="short-area" data-key="' + esc(it.other) + '">' + esc(v) + "</textarea></div>";
  }
  function shouldShowOther(it) {
    if (it.otherAlways) return true;
    var v = S.answers[it.id];
    return v === "yes" || (Array.isArray(v) && v.indexOf("other") >= 0);
  }
  function choiceList(it, kind) {
    var v = S.answers[it.id], opts = it.options;
    // the F2 questions list the views in the order the page shows them, "none" last
    if (it.inViewOrder) opts = viewOrder().map(function (id) { return opts.filter(function (o) { return o[0] === id; })[0]; })
      .concat(opts.filter(function (o) { return viewOrder().indexOf(o[0]) < 0; }));
    return '<fieldset class="options"><legend class="sr">' + esc(it.label) + "</legend>" + opts.map(function (o) {
      var on = kind === "radio" ? v === o[0] : Array.isArray(v) && v.indexOf(o[0]) >= 0;
      return '<label><input type="' + kind + '" name="' + esc(it.id) + '" value="' + esc(o[0]) + '"' + (on ? " checked" : "") + "> " + esc(o[1]) + "</label>";
    }).join("") + "</fieldset>";
  }

  function itemHtml(it, page) {
    var v = it.id ? S.answers[it.id] : undefined;
    switch (it.type) {
      case "para": return '<p class="para">' + (it.html ? it.text : esc(it.text)) + "</p>";
      case "task": return '<div class="task"><div class="task-tag">Task ' + esc(it.tasks) + "</div><p>" + esc(it.text) + "</p></div>";
      case "consent": return field(it, consentHtml() + '<label class="check"><input type="checkbox" data-key="consent"' + (v ? " checked" : "") +
        "> <span>I have read the above and agree to take part.</span></label>");
      case "text": return field(it, '<textarea data-key="' + esc(it.id) + '">' + esc(v || "") + "</textarea>");
      case "short": return field(it, '<input type="text" class="short" data-key="' + esc(it.id) + '" value="' + esc(v || "") + '" placeholder="' + esc(it.placeholder || "") + '">');
      case "number": return field(it, '<div class="num"><input type="number" data-key="' + esc(it.id) + '" min="' + it.min + '" max="' + it.max + '" step="' + (it.step || 1) +
        '" value="' + (v === undefined || v === null ? "" : esc(v)) + '">' + (it.unit ? '<span class="unit">' + esc(it.unit) + "</span>" : "") +
        '<label class="check inline"><input type="checkbox" data-cant="' + esc(it.id) + '"' + (v === "cant" ? " checked" : "") + "> I can’t tell</label></div>");
      case "radio": return field(it, choiceList(it, "radio") + otherHtml(it));
      case "checks": return field(it, choiceList(it, "checkbox") + otherHtml(it));
      case "pick": return field(it, '<p class="small muted">Choose ' + it.n + ".</p>" + choiceList(it, "checkbox"));
      case "scale": return field(it, '<div class="scale"><span class="end">1 ' + esc(it.low) + "</span>" + [1, 2, 3, 4, 5, 6, 7].map(function (n) {
        return '<label><input type="radio" name="' + esc(it.id) + '" value="' + n + '"' + (v === n ? " checked" : "") + ">" + n + "</label>";
      }).join("") + '<span class="end">7 ' + esc(it.high) + "</span></div>");
      case "matrix": return field(it, matrixHtml(it));
      case "rank": return field(it, rankHtml(it));
      case "shot":
        var click = clickFor(page, it.id);
        var img = shotHtml(it.file, it.alt, click ? "clickable" : "zoomable", click ? ' data-click="' + esc(click.id) + '"' : "");
        return '<figure class="fig">' + (it.key ? '<div class="view-body">' + img + keyHtml(it.key, it.alt) + "</div>" : img) +
          (it.caption ? "<figcaption>" + esc(it.caption) + "</figcaption>" : "") +
          (click ? '<button type="button" class="link" data-zoom="' + esc(it.file) + '">Enlarge</button>' : "") + "</figure>";
      case "click": return field(it, '<p class="small muted">Click on the image above. Click again to move your mark.</p>' +
        '<label class="check"><input type="checkbox" data-cant="' + esc(it.id) + '"' + (v === "cant" ? " checked" : "") + "> I can’t tell</label>");
      // a view's card stays open over its questions; "viewend" closes it
      case "viewcard": return '<div class="view-card" data-view="' + it.view + '"><div class="view-name">' + it.n + ". " + esc(viewName(it.view)) + "</div>" +
        '<div class="view-body">' + shotHtml(it.file, viewName(it.view) + ": the stretch of route", "zoomable") + keyHtml(it.key, viewName(it.view)) + "</div>" +
        '<div class="view-qs">';
      case "viewend": return "</div></div>";
    }
    return "";
  }
  function keyHtml(file, name) {
    return '<div class="view-key"><div class="key-title">Key</div><img class="zoomable" src="' + esc(file) + '" alt="Key of ' + esc(name) + '"></div>';
  }
  function clickFor(page, shotId) { return page.items.filter(function (x) { return x.type === "click" && x.on === shotId; })[0]; }
  function consentHtml() {
    return '<div class="consent"><p><strong>' + esc(C.title) + "</strong>, " + esc(C.institution) + ".</p><ul>" +
      "<li>Your answers are stored in a spreadsheet that only the research team can open.</li>" +
      "<li>In publications you appear only as an expert number (such as E7), and quotes are not linked to your name.</li>" +
      "<li>Please don’t include confidential information: vessel names, clients or real operational data.</li>" +
      "<li>Taking part is voluntary. You can skip questions, stop at any time, and ask for your answers to be deleted.</li>" +
      "<li>Questions: " + esc(C.contactEmail) + "</li></ul></div>";
  }
  function matrixHtml(it) {
    var v = S.answers[it.id] || {}, c = S.answers[it.id + "_comment"] || {};
    return '<div class="matrix-wrap"><table class="matrix"><thead><tr><th></th>' + it.options.map(function (o) { return "<th>" + esc(o[1]) + "</th>"; }).join("") +
      "</tr></thead><tbody>" + it.rows.map(function (r) {
        return '<tr data-row="' + esc(r[0]) + '"><th scope="row"><b>' + esc(r[0]) + "</b> " + esc(r[1]) + "</th>" + it.options.map(function (o) {
          return '<td><input type="radio" aria-label="' + esc(r[0] + ": " + o[1]) + '" name="' + esc(it.id + "__" + r[0]) + '" value="' + esc(o[0]) + '"' + (v[r[0]] === o[0] ? " checked" : "") + "></td>";
        }).join("") + '</tr><tr class="comment-row"><td colspan="' + (it.options.length + 1) + '"><input type="text" class="comment" data-comment="' +
          esc(it.id) + '" data-row="' + esc(r[0]) + '" placeholder="' + esc(it.comment) + '" value="' + esc(c[r[0]] || "") + '"></td></tr>';
      }).join("") + "</tbody></table></div>";
  }
  function rankHtml(it) {
    var v = S.answers[it.id], cant = v === "cant", k = it.options.length;
    return '<div class="rank">' + it.options.map(function (o) {
      var r = v && typeof v === "object" ? v[o[0]] : "";
      return '<label class="rank-row"><select data-rank="' + esc(it.id) + '" data-opt="' + esc(o[0]) + '"' + (cant ? " disabled" : "") + '><option value="">–</option>' +
        Array.apply(null, Array(k)).map(function (_, i) { return '<option value="' + (i + 1) + '"' + (r === i + 1 ? " selected" : "") + ">" + (i + 1) + "</option>"; }).join("") +
        "</select> " + esc(o[1]) + "</label>";
    }).join("") + (it.cant ? '<label class="check"><input type="checkbox" data-cant="' + esc(it.id) + '"' + (cant ? " checked" : "") + "> Can’t judge</label>" : "") + "</div>";
  }

  var enteredAt = Date.now();
  function leavePage() {
    var id = PAGES[S.page] && PAGES[S.page].id;
    if (id) S.pageMs[id] = (S.pageMs[id] || 0) + (Date.now() - enteredAt);
    enteredAt = Date.now();
  }

  function render() {
    if (S.finishedAt) return renderEnd();
    var page = PAGES[S.page], n = PAGES.length;
    var html = page.items.map(function (it) { return itemHtml(it, page); }).join("");
    app.innerHTML = '<div class="rv-head"><span>' + esc(page.section) + ". " + esc(SECTION[page.section]) + "</span><span>Page " + (S.page + 1) + " of " + n + "</span></div>" +
      '<div class="progress"><span style="width:' + (100 * S.page / n) + '%"></span></div>' +
      '<section class="page" data-page="' + esc(page.id) + '"><h1>' + esc(page.title) + "</h1>" + html +
      '<div class="actions nav">' + (S.page > 0 ? '<button type="button" class="secondary" id="back">Back</button>' : "") +
      '<button type="button" id="next">' + (S.page === n - 1 ? "Finish" : "Next") + '</button><span class="nav-msg small" hidden></span></div>' +
      (TEST ? '<p class="small muted">Test mode: nothing is sent.</p>' : "") + "</section>";
    app.querySelectorAll("img.shot").forEach(placeholderOnError);
    drawMarks();
    window.scrollTo(0, 0);
  }
  function placeholderOnError(img) {
    var swap = function () {
      var d = document.createElement("div");
      d.className = "ph";
      d.textContent = "Screenshot to come: " + img.getAttribute("data-ph");
      img.replaceWith(d);
      drawMarks();
    };
    if (img.complete && img.naturalWidth === 0) swap(); else img.addEventListener("error", swap);
  }
  function drawMarks() {
    app.querySelectorAll("[data-click]").forEach(function (w) {
      var v = S.answers[w.getAttribute("data-click")], m = w.querySelector(".mark");
      if (v && typeof v === "object") {
        if (!m) { m = document.createElement("span"); m.className = "mark"; w.appendChild(m); }
        m.style.left = v.x * 100 + "%"; m.style.top = v.y * 100 + "%";
      } else if (m) m.remove();
    });
  }

  function renderEnd() {
    app.innerHTML = '<section class="page"><h1>Thank you</h1><p>Your answers have been saved.</p>' +
      "<p>If you would like to add something later, write to " + esc(C.contactEmail) + ".</p>" +
      (TEST ? '<p class="small muted">Test mode: this is what would have been sent.</p><pre class="data">' + esc(JSON.stringify(S.testLog || [], null, 1)) + "</pre>" : "") + "</section>";
  }

  // --- answers ---------------------------------------------------------------------------------------------------------
  function itemOf(id) { return PAGES[S.page].items.filter(function (x) { return x.id === id; })[0]; }
  function set(k, v) { S.answers[k] = v; save(); }
  app.addEventListener("input", onInput);
  app.addEventListener("change", onInput);
  function onInput(e) {
    var t = e.target;
    if (t.matches("textarea[data-key], input.short, input[type=checkbox][data-key]")) {
      set(t.getAttribute("data-key"), t.type === "checkbox" ? t.checked : t.value);
    } else if (t.matches("input[type=number][data-key]")) {
      var k = t.getAttribute("data-key");
      set(k, t.value === "" ? null : Number(t.value));
      var cb = app.querySelector('[data-cant="' + k + '"]'); if (cb && t.value !== "") cb.checked = false;
    } else if (t.matches("input[data-cant]")) {
      var id = t.getAttribute("data-cant"), it = itemOf(id);
      if (t.checked) set(id, "cant"); else delete S.answers[id];
      if (it.type === "number") { var n = app.querySelector('input[type=number][data-key="' + id + '"]'); if (t.checked) n.value = ""; }
      if (it.type === "rank") app.querySelectorAll('[data-rank="' + id + '"]').forEach(function (s) { s.disabled = t.checked; if (t.checked) s.value = ""; });
      if (it.type === "click") drawMarks();
      save();
    } else if (t.matches("select[data-rank]")) {
      var rid = t.getAttribute("data-rank"), r = {};
      app.querySelectorAll('[data-rank="' + rid + '"]').forEach(function (s) { if (s.value) r[s.getAttribute("data-opt")] = Number(s.value); });
      set(rid, r);
    } else if (t.matches("input.comment")) {
      var cid = t.getAttribute("data-comment") + "_comment", c = S.answers[cid] || {};
      c[t.getAttribute("data-row")] = t.value; set(cid, c);
    } else if (t.type === "radio" && t.name.indexOf("__") > 0) {
      var parts = t.name.split("__"), m = S.answers[parts[0]] || {};
      m[parts[1]] = t.value; set(parts[0], m);
    } else if (t.type === "radio") {
      set(t.name, itemOf(t.name).type === "scale" ? Number(t.value) : t.value);
      toggleOther(t.name);
    } else if (t.type === "checkbox" && t.name) {
      var item = itemOf(t.name), boxes = app.querySelectorAll('input[name="' + t.name + '"]');
      if (t.checked && (t.value === "none")) boxes.forEach(function (b) { if (b !== t) b.checked = false; });
      if (t.checked && t.value !== "none") boxes.forEach(function (b) { if (b.value === "none") b.checked = false; });
      var vals = []; boxes.forEach(function (b) { if (b.checked) vals.push(b.value); });
      if (item.type === "pick") boxes.forEach(function (b) { b.disabled = !b.checked && vals.length >= item.n; });
      set(t.name, vals);
      toggleOther(t.name);
    }
    if (e.type === "change") clearErr(t);
  }
  function toggleOther(id) {
    var it = itemOf(id), box = it && it.other && app.querySelector('[data-other-for="' + id + '"]');
    if (box) box.hidden = !shouldShowOther(it);
  }
  function clearErr(t) {
    var item = t.closest(".item");
    if (item && valid(itemOf(item.getAttribute("data-item")))) { item.classList.remove("invalid"); item.querySelector(".err").hidden = true; }
  }

  app.addEventListener("click", function (e) {
    var t = e.target;
    var w = t.closest("[data-click]");
    if (w) {
      var box = w.getBoundingClientRect(), cid = w.getAttribute("data-click");
      set(cid, { x: +((e.clientX - box.left) / box.width).toFixed(4), y: +((e.clientY - box.top) / box.height).toFixed(4) });
      var cb = app.querySelector('[data-cant="' + cid + '"]'); if (cb) cb.checked = false;
      drawMarks();
      var item = app.querySelector('[data-item="' + cid + '"]'); if (item) { item.classList.remove("invalid"); item.querySelector(".err").hidden = true; }
      return;
    }
    var z = t.closest("[data-zoom]") || (t.matches("img.zoomable, .zoomable img.shot") ? t : null);
    if (z) return zoom(z.getAttribute("data-zoom") || z.getAttribute("src"));
    if (t.id === "next") return next();
    if (t.id === "back") { leavePage(); S.page--; save(); render(); }
  });

  // --- checking a page -------------------------------------------------------------------------------------------------
  function valid(it) {
    if (!it || !it.id) return true;
    var v = S.answers[it.id];
    switch (it.type) {
      case "consent": return v === true;
      case "text": case "short": return typeof v === "string" && v.trim().length > 0;
      case "number": return v === "cant" || (typeof v === "number" && isFinite(v) && v >= it.min && v <= it.max);
      case "radio": return typeof v === "string" && v.length > 0;
      case "checks": return Array.isArray(v) && v.length > 0;
      case "pick": return Array.isArray(v) && v.length === it.n;
      case "scale": return typeof v === "number";
      case "click": return v === "cant" || (v && typeof v === "object" && isFinite(v.x));
      case "matrix": return !!v && it.rows.every(function (r) { return !!v[r[0]]; });
      case "rank": // some may be left unranked, but no two the same
        if (v === "cant" || !v) return true;
        var ranks = it.options.map(function (o) { return v[o[0]]; }).filter(Boolean);
        return ranks.every(function (x, i) { return ranks.indexOf(x) === i; });
    }
    return true;
  }
  function next() {
    var page = PAGES[S.page], bad = [];
    page.items.forEach(function (it) {
      if (!it.id || !(it.required || it.type === "rank")) return;
      var el = app.querySelector('[data-item="' + it.id + '"]');
      var ok = valid(it);
      if (el) { el.classList.toggle("invalid", !ok); el.querySelector(".err").hidden = ok; }
      if (!ok) bad.push(el);
    });
    var msg = app.querySelector(".nav-msg");
    if (bad.length) {
      var rank = page.items.filter(function (x) { return x.type === "rank" && !valid(x); })[0];
      msg.textContent = rank ? "Each kind of uncertainty needs a different rank." : "Please tick the box to agree before you start.";
      msg.hidden = false;
      if (bad[0]) bad[0].scrollIntoView({ block: "center" });
      return;
    }
    leavePage();
    if (S.pagesDone.indexOf(page.id) < 0) S.pagesDone.push(page.id);
    var last = S.page === PAGES.length - 1;
    if (last) S.finishedAt = now(); else S.page++;
    save();
    send({ type: last ? "final" : "page", page: page.id, expert: expert(), answers: pageAnswers(page) });
    render();
  }

  // --- enlarging a screenshot ------------------------------------------------------------------------------------------
  var lb = document.getElementById("lightbox");
  function zoom(src) { lb.querySelector("img").src = src; lb.hidden = false; }
  lb.addEventListener("click", function () { lb.hidden = true; });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") lb.hidden = true; });

  // --- window size -----------------------------------------------------------------------------------------------------
  document.getElementById("min-size").textContent = C.minWidth + " × " + C.minHeight;
  function checkSize() { document.getElementById("too-small").hidden = window.innerWidth >= C.minWidth && window.innerHeight >= C.minHeight; }
  window.addEventListener("resize", checkSize);
  checkSize();

  save();
  if (queue().length) flush();
  render();
  window.__review = { state: function () { return S; }, viewOrder: viewOrder };
})();
