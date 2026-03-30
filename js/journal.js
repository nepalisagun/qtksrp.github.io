(function () {
  "use strict";

  var LS_KEY = "fun_corner_journal_v1";
  var MAX_STORED = 40;
  var MAX_CHARS = 5000;

  var LEVELS = {
    easy: {
      id: "easy",
      label: "Easy",
      minWords: 22,
      minSentences: 2,
      stretchWords: 35,
      blurb: "Good for warming up — a few sentences.",
    },
    moderate: {
      id: "moderate",
      label: "Moderate",
      minWords: 50,
      minSentences: 4,
      stretchWords: 70,
      blurb: "More detail — several sentences with examples or reasons.",
    },
    hard: {
      id: "hard",
      label: "Hard",
      minWords: 85,
      minSentences: 6,
      stretchWords: 115,
      blurb: "Challenge mode — lots of detail, reasons, and clear order.",
    },
  };

  var TOPICS = {
    easy: [
      "What is your favorite animal? Name it and say one true thing about it.",
      "Describe your favorite snack and when you like to eat it.",
      "Who makes you laugh? Write one short story about something funny they did.",
      "What is the best part of your school day? Say why in a few sentences.",
      "If you could design a playground, what two things would you put in it?",
      "What book, movie, or show do you like? Say what happens and why you like it.",
      "Write about a time you helped someone or someone helped you.",
      "What season do you like best (spring, summer, fall, winter)? Give two reasons.",
      "Describe your room or a cozy place at home. What do you like there?",
      "What would you teach a friend to do? List the steps in order.",
    ],
    moderate: [
      "Explain how you get ready for school or for bed. Use time words (first, next, then, finally).",
      "Describe a hobby or sport you enjoy. What do you do, and what is tricky or fun about it?",
      "Write about a goal you have this year. What steps will you take to reach it?",
      "Compare two things you like (for example two games or two foods). How are they alike and different?",
      "Tell about a problem you solved. What was hard, and what did you try?",
      "If you could visit any place for one day, where would you go and what would you do there?",
      "Describe a character from a book or movie. What do they want, and how do they act?",
      "Why is it important to be a good friend? Give examples of what good friends do.",
      "Write about something you are proud of learning. How did you practice?",
      "Imagine a new club at school. What is it called, who would join, and what would you do at meetings?",
    ],
    hard: [
      "Persuade the reader that kids should read or draw every day. Give at least three reasons and a short example for each.",
      "Describe a day from morning to night as if you are writing a short story. Use paragraphs and clear order.",
      "Explain how to teach a younger kid to do something you know well (tie shoes, ride a bike, a game). Include tips if they get stuck.",
      "Write about a time you changed your mind. What did you think first, what happened, and what do you think now?",
      "Compare life in a city and life in the country. Use what you know or imagine — include pros and cons for both.",
      "If you could change one rule at home or school, what would it be? Explain why, and what might go wrong or right.",
      "Describe a problem in your community (litter, kindness, safety) and three ideas kids could do to help.",
      "Write a letter to your future self in 5 years. What do you hope you still enjoy? What do you want to remember?",
      "Explain the plot of your favorite story without spoiling the ending — then say the theme in one sentence.",
      "Imagine you invented a simple machine or app for kids. What problem does it fix, and how would it work?",
    ],
  };

  function daySeed() {
    var d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }

  function topicIndex(diffId, salt) {
    var n = TOPICS[diffId].length;
    var s = daySeed() + salt.charCodeAt(0) * 31 + diffId.length * 7;
    var h = 0;
    var str = String(s) + diffId;
    for (var i = 0; i < str.length; i++) {
      h = (h << 5) - h + str.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h) % n;
  }

  function countWords(text) {
    var t = String(text || "").trim();
    if (!t) return 0;
    return t.split(/\s+/).length;
  }

  function countSentences(text) {
    var t = String(text || "").trim();
    if (!t) return 0;
    var parts = t.split(/[.!?]+/);
    var n = 0;
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].replace(/\s/g, "").length >= 8) n++;
    }
    return Math.max(n, t.length >= 8 && !/[.!?]/.test(t) ? 1 : 0);
  }

  function splitSentenceUnits(text) {
    var t = String(text || "").trim();
    if (!t) return [];
    var out = [];
    var buf = "";
    for (var i = 0; i < t.length; i++) {
      buf += t[i];
      if (/[.!?]/.test(t[i])) {
        out.push(buf.trim());
        buf = "";
        while (i + 1 < t.length && /\s/.test(t[i + 1])) i++;
      }
    }
    if (buf.trim()) out.push(buf.trim());
    return out;
  }

  function countStandaloneLowercaseI(t) {
    var masked = String(t).replace(/\bi['’][a-z]+\b/gi, "I'xx");
    var m = masked.match(/\bi\b/gi);
    return m ? m.length : 0;
  }

  /**
   * Rule-based English conventions only (browser). Not AI; not Sapling / LanguageTool.
   * Difficulty scales how strict the score feels (penalty multiplier).
   */
  function checkConventions(text, levelId) {
    var mult = { easy: 0.72, moderate: 1, hard: 1.18 }[levelId] || 1;
    var t = String(text || "").trim();
    var issues = [];
    var keys = {};

    function addIssue(key, msg) {
      if (keys[key]) return;
      keys[key] = true;
      issues.push(msg);
    }

    if (!t.length) {
      return {
        score: 0,
        issues: ["Write something first, then tap **Check my writing**."],
        checked: [],
        focusNext: ["Add a few words about your topic."],
        penaltyRaw: 0,
      };
    }

    var units = splitSentenceUnits(t);
    var capViol = 0;
    var punctViol = 0;
    var u;
    for (var ui = 0; ui < units.length; ui++) {
      u = units[ui].trim();
      if (u.length < 4) continue;
      var inner = u.replace(/^[\s"'“”]+/, "");
      var fm = inner.match(/[A-Za-z]/);
      if (fm && fm[0] === fm[0].toLowerCase()) capViol++;

      var endPart = u.replace(/[\s"'”]+$/, "");
      if (endPart.length >= 6 && !/[.!?]/.test(endPart.charAt(endPart.length - 1))) punctViol++;
    }

    var iCount = countStandaloneLowercaseI(t);
    var doubled = (t.match(/\b(\w{2,})\s+\1\b/gi) || []).length;

    var longSeg = false;
    var commaRun = false;
    var rough = t.split(/[.!?]+/);
    for (var ri = 0; ri < rough.length; ri++) {
      var seg = rough[ri].trim();
      if (seg.length < 12) continue;
      var wc = countWords(seg);
      if (wc >= 45) longSeg = true;
      if (wc >= 28 && seg.split(",").length > 6) commaRun = true;
    }

    var letters = t.replace(/[^A-Za-z]/g, "");
    var allCapsy = false;
    if (letters.length > 25) {
      var up = (t.match(/[A-Z]/g) || []).length;
      if (up > letters.length * 0.45) allCapsy = true;
    }

    if (capViol) addIssue("cap", "Try starting each sentence with a **capital letter**.");
    if (punctViol) addIssue("punct", "End sentences with **.** **?** or **!** so ideas feel complete.");
    if (iCount) addIssue("i", "When you mean yourself, write **I** (capital), not **i**.");
    if (doubled) addIssue("double", "You might have the **same word twice** in a row — delete one if it’s a mistake.");
    if (longSeg) addIssue("long", "One part is **very long** — try splitting into two shorter sentences.");
    if (commaRun) addIssue("comma", "One part has **many commas** — shorter sentences can make it clearer.");
    if (allCapsy) addIssue("caps", "Lots of **ALL CAPS** — for school writing, normal capitals are easier to read.");

    var penalty =
      Math.min(22, capViol * 4) +
      Math.min(18, punctViol * 3) +
      Math.min(25, iCount * 5) +
      Math.min(12, doubled * 3) +
      (longSeg ? 8 : 0) +
      (commaRun ? 6 : 0) +
      (allCapsy ? 6 : 0);
    penalty = Math.min(92, penalty) * mult;
    var score = Math.round(Math.max(0, Math.min(100, 100 - penalty)));

    var checked = [
      {
        id: "cap",
        label: "Sentence starts (capital letters)",
        ok: capViol === 0,
      },
      {
        id: "punct",
        label: "Ending punctuation (. ? !)",
        ok: punctViol === 0,
      },
      {
        id: "i",
        label: "Capital I when you mean yourself",
        ok: iCount === 0,
      },
      {
        id: "double",
        label: "No doubled words (the the)",
        ok: doubled === 0,
      },
      {
        id: "length",
        label: "Not one huge endless sentence",
        ok: !longSeg,
      },
      {
        id: "comma",
        label: "Comma pile-ups",
        ok: !commaRun,
      },
    ];

    var focusNext = issues.slice(0, 2);
    if (focusNext.length === 0) {
      focusNext.push("Keep using clear sentences — you’re on track for these basic checks!");
    }

    return {
      score: score,
      issues: issues,
      checked: checked,
      focusNext: focusNext,
      penaltyRaw: penalty,
    };
  }

  function gradeWriting(text, level) {
    var words = countWords(text);
    var sentences = countSentences(text);
    var r = LEVELS[level];
    var stars = 1;
    var notes = [];

    if (words >= r.minWords) {
      stars += 1;
      notes.push("You met the word goal for " + r.label + " mode.");
    } else {
      notes.push(
        "Try to write at least **" +
          r.minWords +
          " words** (you have " +
          words +
          "). Add a detail or an example."
      );
    }

    if (sentences >= r.minSentences) {
      stars += 1;
      notes.push("You used enough sentences — nice structure!");
    } else {
      notes.push(
        "Aim for **" +
          r.minSentences +
          " or more sentences** (you have " +
          sentences +
          "). Short answers can become new sentences."
      );
    }

    if (words >= r.stretchWords) {
      stars += 1;
      notes.push("Extra effort: you wrote a lot. That builds strong writing muscles!");
    }

    if (sentences >= r.minSentences + 2 && words >= r.minWords) {
      stars += 1;
      notes.push("You organized your ideas with several parts — great job!");
    }

    if (stars < 5 && words >= r.minWords * 1.2 && sentences >= r.minSentences) {
      stars += 1;
      notes.push("Strong work — keep that voice!");
    }

    if (stars > 5) stars = 5;
    if (stars < 1) stars = 1;

    var conv = checkConventions(text, level);

    var coach =
      "This site uses **rule-based** feedback, not AI. **Writing is analyzed in your browser** — no third-party grammar API. **Stars** = how much you wrote and how you split **sentences**. **Convention score** = simple pattern checks (not a teacher’s grade).";

    return {
      stars: stars,
      words: words,
      sentences: sentences,
      notes: notes,
      coach: coach,
      conventionScore: conv.score,
      conventionChecked: conv.checked,
      conventionIssues: conv.issues,
      focusNext: conv.focusNext,
    };
  }

  function loadJournal() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return [];
      var a = JSON.parse(raw);
      return Array.isArray(a) ? a : [];
    } catch (e) {
      return [];
    }
  }

  function saveJournal(entries) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(entries.slice(-MAX_STORED)));
    } catch (e) {
      /* quota */
    }
  }

  function isPlatformKey(k) {
    var s = String(k || "");
    return s.indexOf("sb_publishable_") === 0 || s.indexOf("sb_secret_") === 0;
  }

  function journalRestHeaders(key, withJson) {
    var k = String(key || "");
    var h = { apikey: k, Accept: "application/json" };
    if (withJson) h["Content-Type"] = "application/json";
    if (!isPlatformKey(k)) h.Authorization = "Bearer " + k;
    return h;
  }

  function postJournalSubmission(row) {
    var cfg = window.FUN_CORNER_REMOTE;
    var table = cfg && cfg.journalSubmissionsTable;
    if (!cfg || !cfg.supabaseUrl || !cfg.anonKey || !table) {
      return Promise.reject(new Error("cloud save not configured"));
    }
    var url =
      String(cfg.supabaseUrl).replace(/\/$/, "") +
      "/rest/v1/" +
      encodeURIComponent(table);
    var headers = journalRestHeaders(cfg.anonKey, true);
    headers.Prefer = "return=minimal";
    return fetch(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(row),
    }).then(function (res) {
      if (!res.ok) return Promise.reject(new Error("post failed"));
    });
  }

  function init() {
    var diffWrap = document.getElementById("journal-difficulty");
    var topicSelect = document.getElementById("journal-topic-select");
    var reqEl = document.getElementById("journal-requirements");
    var bodyEl = document.getElementById("journal-body");
    var checkBtn = document.getElementById("journal-check");
    var saveBtn = document.getElementById("journal-save");
    var newTopicBtn = document.getElementById("journal-new-topic");
    var feedbackEl = document.getElementById("journal-feedback");
    var listEl = document.getElementById("journal-saved-list");
    var clearBtn = document.getElementById("journal-clear-saved");
    var cloudWrap = document.getElementById("journal-cloud-wrap");
    var cloudCb = document.getElementById("journal-save-cloud");

    if (!diffWrap || !topicSelect || !bodyEl || !checkBtn) return;

    var currentDiff = "easy";
    var topicSalt = "a";
    var lastResult = null;

    var remoteCfg = window.FUN_CORNER_REMOTE;
    if (
      cloudWrap &&
      remoteCfg &&
      remoteCfg.journalSubmissionsTable &&
      remoteCfg.supabaseUrl &&
      remoteCfg.anonKey
    ) {
      cloudWrap.classList.remove("journal-cloud-option--hidden");
    }

    function selectedTopicIndex() {
      var i = parseInt(topicSelect.value, 10);
      if (isNaN(i)) return 0;
      return Math.max(0, Math.min(TOPICS[currentDiff].length - 1, i));
    }

    function currentTopic() {
      return TOPICS[currentDiff][selectedTopicIndex()];
    }

    function populateTopicSelect(preserveIndex) {
      var topics = TOPICS[currentDiff];
      var prev = preserveIndex ? selectedTopicIndex() : topicIndex(currentDiff, topicSalt);
      topicSelect.innerHTML = "";
      for (var i = 0; i < topics.length; i++) {
        var opt = document.createElement("option");
        opt.value = String(i);
        var full = topics[i];
        opt.textContent = full.length > 95 ? full.slice(0, 92) + "…" : full;
        opt.setAttribute("title", full);
        topicSelect.appendChild(opt);
      }
      topicSelect.value = String(Math.min(prev, topics.length - 1));
    }

    function renderRequirements() {
      var L = LEVELS[currentDiff];
      reqEl.innerHTML =
        "<strong>" +
        L.label +
        ":</strong> write at least <strong>" +
        L.minSentences +
        " sentences</strong> and about <strong>" +
        L.minWords +
        " words</strong>. " +
        L.blurb;
    }

    function setDifficulty(id) {
      if (!LEVELS[id]) return;
      currentDiff = id;
      var buttons = diffWrap.querySelectorAll("[data-journal-level]");
      for (var i = 0; i < buttons.length; i++) {
        var b = buttons[i];
        var on = b.getAttribute("data-journal-level") === id;
        b.classList.toggle("journal-level--active", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      }
      populateTopicSelect(false);
      renderRequirements();
      feedbackEl.innerHTML = "";
      lastResult = null;
    }

    topicSelect.addEventListener("change", function () {
      feedbackEl.innerHTML = "";
      lastResult = null;
    });

    diffWrap.addEventListener("click", function (ev) {
      var t = ev.target.closest("[data-journal-level]");
      if (!t) return;
      setDifficulty(t.getAttribute("data-journal-level"));
    });

    if (newTopicBtn) {
      newTopicBtn.addEventListener("click", function () {
        var n = TOPICS[currentDiff].length;
        topicSelect.value = String(Math.floor(Math.random() * n));
        feedbackEl.innerHTML = "";
        lastResult = null;
      });
    }

    function noteLi(s) {
      return "<li>" + s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>") + "</li>";
    }

    checkBtn.addEventListener("click", function () {
      var text = bodyEl.value.slice(0, MAX_CHARS);
      var g = gradeWriting(text, currentDiff);
      lastResult = g;
      var stars = "★".repeat(g.stars) + "☆".repeat(5 - g.stars);
      var cs = typeof g.conventionScore === "number" ? g.conventionScore : 0;
      var html =
        '<div class="journal-feedback__scoreline"><span class="journal-feedback__score-num" aria-label="Convention score">' +
        cs +
        '</span><span class="journal-feedback__score-suffix">/100</span> <span class="journal-feedback__score-label">conventions (rule-based)</span></div>' +
        '<div class="journal-feedback__stars" aria-label="' +
        g.stars +
        ' out of 5 stars">' +
        stars +
        " <span class=\"journal-feedback__stars-caption\">length &amp; sentences</span></div>" +
        "<p class=\"journal-feedback__coach\">" +
        g.coach +
        '</p><p class="journal-feedback__subh">We checked</p><ul class="journal-feedback__checked">';
      var chk = g.conventionChecked || [];
      for (var ci = 0; ci < chk.length; ci++) {
        var c = chk[ci];
        var mark = c.ok ? "✓" : "○";
        html +=
          "<li class=\"" +
          (c.ok ? "journal-feedback__checked--ok" : "journal-feedback__checked--miss") +
          '"><span class="journal-feedback__mark" aria-hidden="true">' +
          mark +
          "</span> " +
          c.label.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>") +
          "</li>";
      }
      html += '</ul><p class="journal-feedback__subh">Focus next time</p><ul class="journal-feedback__list journal-feedback__list--focus">';
      var fn = g.focusNext || [];
      for (var fi = 0; fi < fn.length; fi++) {
        html += noteLi(fn[fi]);
      }
      html +=
        '</ul><p class="journal-feedback__subh">Length &amp; sentences</p><ul class="journal-feedback__list">';
      for (var j = 0; j < g.notes.length; j++) {
        html += noteLi(g.notes[j]);
      }
      html +=
        "</ul>" +
        '<p class="journal-feedback__fineprint">Basic English conventions only — not AI. No text goes to grammar APIs unless you check “save to the cloud,” and that only stores your row in <strong>your</strong> Supabase project.</p>' +
        "<p class=\"journal-feedback__meta\">Counted: <strong>" +
        g.words +
        "</strong> words, <strong>" +
        g.sentences +
        "</strong> sentences.</p>";
      feedbackEl.innerHTML = html;

      if (
        cloudCb &&
        cloudCb.checked &&
        remoteCfg &&
        remoteCfg.journalSubmissionsTable &&
        text.trim().length >= 8
      ) {
        postJournalSubmission({
          title: currentTopic(),
          difficulty: currentDiff,
          content: text.slice(0, MAX_CHARS),
          convention_score: cs,
          stars: g.stars,
          words: g.words,
          sentences: g.sentences,
          feedback_issues: g.conventionIssues || [],
        })
          .then(function () {
            var p = document.createElement("p");
            p.className = "journal-feedback__cloud journal-feedback__cloud--ok";
            p.textContent = "Optional cloud copy saved to Supabase.";
            feedbackEl.appendChild(p);
          })
          .catch(function () {
            var p = document.createElement("p");
            p.className = "journal-feedback__cloud journal-feedback__cloud--err";
            p.textContent =
              "Cloud save failed — confirm the table exists, RLS allows insert, and journalSubmissionsTable in community-config.js matches.";
            feedbackEl.appendChild(p);
          });
      }
    });

    saveBtn.addEventListener("click", function () {
      var text = bodyEl.value.trim().slice(0, MAX_CHARS);
      if (text.length < 5) {
        feedbackEl.innerHTML =
          "<p class=\"journal-feedback__coach\">Write something first, then you can save it.</p>";
        return;
      }
      if (!lastResult) {
        lastResult = gradeWriting(text, currentDiff);
      }
      var entries = loadJournal();
      entries.push({
        savedAt: new Date().toISOString(),
        difficulty: currentDiff,
        topic: currentTopic(),
        text: text,
        stars: lastResult.stars,
        words: lastResult.words,
        sentences: lastResult.sentences,
        conventionScore:
          typeof lastResult.conventionScore === "number" ? lastResult.conventionScore : null,
      });
      saveJournal(entries);
      renderList();
      feedbackEl.innerHTML =
        "<p class=\"journal-feedback__coach\">Saved on <strong>this device</strong> in your journal list below.</p>";
    });

    function renderList() {
      if (!listEl) return;
      var entries = loadJournal();
      if (entries.length === 0) {
        listEl.innerHTML = "<li class=\"journal-saved-empty\">No saved entries yet.</li>";
        return;
      }
      listEl.innerHTML = "";
      for (var i = entries.length - 1; i >= 0; i--) {
        var e = entries[i];
        var li = document.createElement("li");
        li.className = "journal-saved-item";
        var d = new Date(e.savedAt);
        var dateStr = d.toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
        var scoreBit =
          typeof e.conventionScore === "number"
            ? " · <span class=\"journal-saved-item__conv\">" + e.conventionScore + "/100</span>"
            : "";
        li.innerHTML =
          "<div class=\"journal-saved-item__head\"><span class=\"journal-saved-item__date\">" +
          dateStr +
          "</span> · <span class=\"journal-saved-item__lvl\">" +
          LEVELS[e.difficulty].label +
          "</span> · <span class=\"journal-saved-item__stars\">" +
          "★".repeat(e.stars) +
          "☆".repeat(5 - e.stars) +
          "</span>" +
          scoreBit +
          "</div><p class=\"journal-saved-item__topic\"><em>" +
          escapeHtml(e.topic) +
          "</em></p><p class=\"journal-saved-item__text\">" +
          escapeHtml(e.text) +
          "</p>";
        listEl.appendChild(li);
      }
    }

    function escapeHtml(s) {
      return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        if (!window.confirm("Delete all saved journal entries on this device?")) return;
        localStorage.removeItem(LS_KEY);
        renderList();
      });
    }

    setDifficulty("easy");
    renderList();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
