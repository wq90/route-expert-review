// Every page and question of the expert review, in order. Every answer may be left empty; only the consent is required. review.js draws them; the analysis reads the same ids. Changing
// an id after experts have started splits their answers, so add new ids instead.
//
// Item types: text (open answer), short (one line), number, radio, checks, matrix (one choice per row, an optional comment
// per row), pick (choose exactly n), rank (order the items), scale (1-7), click (a point on a screenshot, or "I can't
// tell"), shot (a screenshot, with a key beside it if given), views (the six weather views of one stretch, each followed
// by the questions in its "per" list), task (the task a screen is about), para (text only).
window.REVIEW = (function () {
  var TASKS = [
    ["T1", "See what weather the ship will meet, and where, relative to the way it is heading."],
    ["T2", "Judge what the weather does to the ship’s speed, and where that is worst."],
    ["T3", "Understand why a suggested route goes where it goes."],
    ["T4", "Change the route using your own knowledge, for example by keeping the ship out of an area."],
    ["T5", "Compare routes on time, fuel and weather, and choose the best one for this voyage’s priorities."],
    ["T6", "Decide how far to trust the plan, given that forecasts can be wrong."],
  ];
  var REQS = [
    ["R1", "Show the weather each part of the route will have when the ship is there, not the weather at one moment."],
    ["R2", "Show the weather relative to the ship’s heading: from ahead, the side or behind, and from which side."],
    ["R3", "Show what the weather does to the ship’s speed, all factors combined, and where the effect is worst."],
    ["R4", "Explain why a suggested route goes where it goes, for example how much fuel the waves or the wind cost on each part."],
    ["R5", "Let the user keep the ship out of areas, and recalculate the route within seconds."],
    ["R6", "Compare routes on time, fuel and the weather they meet."],
    ["R7", "Show how far the forecast, and so the route, can be trusted."],
    ["R8", "Flag where a route would break the vessel’s safety limits."],
    ["R9", "Help choose when to depart."],
    ["R10", "Show the weather around the route, not only on it."],
  ];
  var DOES = [["yes", "Yes"], ["sometimes", "Sometimes"], ["no", "No"], ["cant", "Can’t judge"]];
  var NEED = [["essential", "Essential"], ["useful", "Useful"], ["not_needed", "Not needed"], ["cant", "Can’t judge"]];
  var FAIR = [["fair", "Fair"], ["fair_changes", "Fair, with changes"], ["not_fair", "Not fair"], ["cant", "Can’t judge"]];
  var REL = [["ahead", "From ahead"], ["side", "From the side"], ["behind", "From behind"], ["cant", "I can’t tell"]];
  // the six weather views, in the online study's order; F2 shows them in an order given by the expert's link (review.js)
  var VIEWS = [
    ["strap", "Weather strap"], ["weather", "Weather arrows"], ["strokes", "Tapered strokes"],
    ["symbols", "Chart symbols"], ["rose", "Three-spoke rose"], ["wsi", "Weather speed index"],
  ];

  // an image of a route view: its task, the image (with the view's key beside it), then the four steps: what they
  // conclude, the check question(s), the rating, what is wrong
  function screen(o) {
    var items = (o.intro || []).map(function (t) { return { type: "para", text: t }; });
    items.push({ type: "task", text: o.task, tasks: o.tasks });
    items.push({ id: o.id + "_shot", type: "shot", file: o.shot.file, key: o.shot.key, caption: o.shot.caption, alt: o.shot.alt });
    items.push({ id: o.id + "_conclude", type: "text", label: "What do you conclude from this image? What would you decide?" });
    (o.check || []).forEach(function (c) { c.check = true; items.push(c); });
    items.push({ id: o.id + "_rating", type: "scale", label: "How well does this image support the task above?", low: "Not at all", high: "Very well" });
    items.push({ id: o.id + "_wrong", type: "text", label: "What is wrong, misleading or missing here?" });
    return { id: o.id, section: "F", title: o.title, items: items };
  }

  var pages = [
    {
      id: "welcome", section: "A", title: "Weather routing: expert review", items: [
        { type: "para", html: true, text: "Thank you for taking part. We are designing a tool that shows the weather along a ship’s route, suggests routes with an optimiser, lets a person keep the ship out of areas and compares routes. We would like your view, as an expert in the field, on what such a tool must do, on whether its model and data are sound, and on how it draws the weather along a route." },
        { type: "para", text: "It takes about 30 minutes, on a computer. Your answers are saved after every page, so you can stop and come back with the same link on the same computer and browser." },
        { type: "para", text: "If a colleague could answer too, please send them the address of this page without your personal link: " + window.REVIEW_CONFIG.siteUrl + " (your own link keeps your answers)." },
        { type: "para", text: "First we ask for your own view, before you see anything of the tool. Please answer in your own words; short answers are fine, and you can leave any question empty. If a question is outside your field, choose “Can’t judge”: that is a useful answer too." },
        { type: "consent", id: "consent", required: true },
      ]
    },
    {
      id: "background", section: "A", title: "About you", items: [
        { id: "A_field", type: "checks", label: "Your field (choose all that apply)", options: [["maritime", "Maritime"], ["engineering", "Ocean engineering"], ["climate", "Maritime climate"], ["other", "Other"]], other: "A_field_other" },
        { id: "A_years", type: "number", label: "Years working in this field", min: 0, max: 60 },
        { id: "A_sea", type: "radio", label: "Have you worked at sea, or with route planners or ship operators?", options: [["yes", "Yes"], ["no", "No"]], other: "A_sea_how", otherLabel: "If yes, how?" },
        { id: "A_redsea", type: "radio", label: "How well do you know the Red Sea’s weather and sea conditions?", options: [["well", "Well"], ["little", "A little"], ["no", "Not at all"]] },
        { id: "A_tools", type: "checks", label: "Weather-routing tools: have you … (choose all that apply)", options: [["used", "Used one"], ["built", "Built or developed one"], ["studied", "Studied or evaluated one"], ["none", "None of these"]] },
      ]
    },
    {
      id: "problem", section: "B", title: "The problem, in your view", items: [
        { type: "para", text: "Please answer from your own experience. You haven’t seen the tool yet, and that is on purpose." },
        { id: "B_need", type: "text", label: "When the weather affects a voyage, what does a planner or master most need to know, and when?" },
        { id: "B_good", type: "text", label: "What decides whether a route is good: time, fuel, safety, comfort, something else? What gives way when they conflict?" },
        { id: "B_tools", type: "text", label: "What do weather-routing tools get wrong, or leave out, today?" },
        { id: "B_case", type: "text", label: "Think of one voyage, event or case from your work where the weather changed the route, or should have. What happened?" },
      ]
    },
    {
      id: "tasks", section: "C", title: "Tasks", items: [
        { type: "para", text: "These are six things we think people do when they plan a route with the weather in mind. We wrote them ourselves, so they may be wrong." },
        { id: "C_does", type: "matrix", label: "Is this something people planning a route do?", rows: TASKS, options: DOES, comment: "How would you put it? (optional)" },
        { id: "C_top3", type: "pick", n: 3, label: "Which three matter most?", options: TASKS.map(function (t) { return [t[0], t[0] + " " + t[1]]; }) },
        { id: "C_missing", type: "text", label: "What task is missing?" },
      ]
    },
    {
      id: "requirements", section: "D", title: "What the tool must do", items: [
        { type: "para", text: "For each requirement, how important is it for a tool that helps plan routes with the weather?" },
        { id: "D_need", type: "matrix", label: "A weather-routing tool should …", rows: REQS, options: NEED, comment: "Comment (optional)" },
        { id: "D_recommend", type: "radio", label: "When there are several routes, should the tool recommend one for the voyage’s priorities, or leave the choice to the user?", options: [["recommend", "Recommend one"], ["user", "Leave it to the user"], ["both", "Both: recommend one, and let the user choose"], ["cant", "Can’t judge"]], other: "D_recommend_why", otherLabel: "Why?", otherAlways: true },
        { id: "D_else", type: "text", label: "What else must such a tool do?" },
      ]
    },
    {
      id: "model", section: "E", title: "The model and the data", items: [
        { id: "E_forecast", type: "text", label: "The tool uses one 7-day forecast, updated every day, from ocean, wave and atmosphere models of the Red Sea. For routing, what are the limits of such a forecast: lead time, resolution, variables?" },
        { type: "para", html: true, text: "<strong>How the tool judges what slows the ship.</strong> Waves cost speed most when they come from ahead, about a third as much from the side, and nothing from behind. A head wind costs speed, and a following wind helps a little. A current along the track adds to the speed or takes from it." },
        { id: "E_index", type: "radio", label: "Is this a fair simplification?", options: FAIR, other: "E_index_why", otherLabel: "For which ships, or in which conditions, does it fail?", otherAlways: true },
        { type: "para", html: true, text: "<strong>A rule of thumb.</strong> In an online test of the views, people are told: “Waves, wind and current against the ship’s direction slow it; in the same direction they speed it up; from the side they do little.”" },
        { id: "E_rule", type: "radio", label: "Is that fair as a rule of thumb?", options: FAIR, other: "E_rule_why", otherLabel: "What would you change?", otherAlways: true },
        { id: "E_vars", type: "checks", label: "Which of these should a routing tool show or use? (choose all that apply)", options: [["swell", "Swell and wind sea separately"], ["period", "Wave period"], ["gusts", "Wind gusts"], ["visibility", "Visibility (fog, dust)"], ["tide", "Tidal currents"], ["depth", "Water depth (shallow-water effects)"], ["none", "None of these"]], other: "E_vars_other", otherLabel: "Others", otherAlways: true },
        { id: "E_vessel", type: "text", label: "The tool models one large tanker. Which ship types should a study of it cover?" },
        { id: "E_uncert", type: "rank", label: "Which kinds of uncertainty matter most for a route? Rank them, 1 for the most important.", options: [["spread", "Forecast spread (ensembles)"], ["lead", "Lead time: forecasts further ahead are less certain"], ["model", "Model error against observations"], ["vessel", "The vessel model: how the ship responds"]], cant: true },
        { id: "E_robust", type: "text", label: "How would you judge whether a route is robust to forecast errors?" },
      ]
    },
    screen({
      id: "F1", title: "The voyage", tasks: "T1, T2",
      intro: ["From here on you see how the tool draws the weather along a route: images of its route views, drawn with the real forecast for one voyage, from Jizan to Duba, leaving on Sunday 8 November at 06:00 and arriving 60 hours later. Only the route the tool suggests is shown. Click an image to enlarge it.",
        "Each place on the route carries the forecast for the time the ship is there. The labels along the route mark every 6 hours."],
      task: "Before departure, you want to know what weather the ship will meet on this voyage, and where it will slow the ship most.",
      shot: { file: "shots/F1.jpg", key: "shots/keys/wsi.jpg", alt: "The route on the map, coloured by the weather speed index", caption: "The line’s colour is the weather’s combined effect on speed: red slows the ship, blue helps it, pale means little effect." },
      check: [{ id: "F1_where", type: "click", on: "F1_shot", label: "Click on the route where the weather slows the ship most." }]
    }),
    {
      id: "F2", section: "F", title: "Six ways to draw the weather", items: [
        { type: "task", tasks: "T1, T2", text: "You look more closely at one stretch of the same route, from Monday 00:00 to 06:00: where the waves and the wind come from, relative to the ship, how strong they are, and what they do to its speed. The same stretch is drawn in six ways, each with its key. Please answer the questions under each one." },
        // each view with its own questions under it, in the order the expert's link gives (review.js)
        {
          id: "F2_views", type: "views", views: VIEWS, file: "shots/F2_{view}.jpg", key: "shots/keys/{view}.jpg", per: [
            { suffix: "read", type: "text", label: "What does this view tell you about the weather on this stretch, and what it does to the ship?" },
            { suffix: "t1", type: "scale", label: "How well does it show the weather the ship meets, relative to its heading (T1)?", low: "Not at all", high: "Very well" },
            { suffix: "t2", type: "scale", label: "How well does it show what the weather does to the ship’s speed (T2)?", low: "Not at all", high: "Very well" },
            { suffix: "unclear", type: "text", label: "What is unclear or misleading in it?" },
          ]
        },
        { id: "F2_t1", inViewOrder: true, type: "radio", label: "Of the six, which would you use to see the weather the ship meets (T1)?", options: VIEWS.concat([["none", "None of them"]]) },
        { id: "F2_t2", inViewOrder: true, type: "radio", label: "Which would you use to judge the weather’s effect on the ship’s speed (T2)?", options: VIEWS.concat([["none", "None of them"]]) },
        { id: "F2_wrong", type: "text", label: "Anything else about the six views?" },
      ]
    },
    screen({
      id: "F3", title: "One point on the route", tasks: "T1",
      task: "You want the exact conditions the ship meets at one point of the route, at the time it is there.",
      shot: { file: "shots/F3.jpg", alt: "The card shown for one point of the route", caption: "Hovering on the route shows this card for that point, at the time the ship is there. The diagram shows the wind, waves and current around the ship, bow up." },
      check: [
        { id: "F3_wind", type: "number", label: "What wind speed does the ship meet here?", unit: "m/s", min: 0, max: 60, step: 0.1 },
        { id: "F3_winddir", type: "radio", label: "Where does that wind come from, relative to the ship?", options: REL },
      ]
    }),
    {
      id: "next", section: "G", title: "The views as a whole, and what comes next", items: [
        { id: "G_trust", type: "text", label: "Would you rely on these views when planning a voyage? What would you need before you did?" },
        { id: "G_users", type: "text", label: "Who uses, or should use, a tool like this? Can you name roles or kinds of organisation we could ask?" },
        { id: "G_case", type: "text", label: "Which real case would show best whether the tool works: a voyage type, a season, a weather event in the Red Sea?" },
        { id: "G_data", type: "text", label: "What data would show that the routes are good: ship tracks, noon reports, a hindcast, simulation, something else?" },
        { id: "G_else", type: "text", label: "Anything else?" },
      ]
    },
  ];
  return { pages: pages, views: VIEWS, tasks: TASKS, requirements: REQS };
})();
