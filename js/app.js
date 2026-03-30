(function () {
  "use strict";

  var JOKES = [
    "Why did the math book look sad? Because it had too many problems!",
    "What do you call a bear with no teeth? A gummy bear!",
    "Why don't eggs tell jokes? They'd crack each other up!",
    "What is a snake's favorite subject? Hiss-tory!",
    "Why did the cookie go to the doctor? It felt crumb-y!",
    "What do clouds wear under their clothes? Thunderwear!",
    "Why can't you give Elsa a balloon? She will let it go!",
    "What do you call a sleeping dinosaur? A dino-snore!",
  ];

  var FACTS = [
    "Honey never spoils — archaeologists have found edible honey in ancient tombs.",
    "Octopuses have three hearts and blue blood.",
    "A group of flamingos is called a flamboyance.",
    "Bananas are berries, but strawberries aren't — botany is weird!",
    "Your brain uses about 20% of your body's energy, even though it's small.",
    "Jupiter is so big that all the other planets could fit inside it — with room left over.",
    "Sloths only go to the bathroom about once a week.",
    "The moon has no atmosphere, so flags there would not wave in wind.",
  ];

  var RAINBOW = [
    { name: "red", label: "Red" },
    { name: "orange", label: "Orange" },
    { name: "yellow", label: "Yellow" },
    { name: "green", label: "Green" },
    { name: "blue", label: "Blue" },
    { name: "purple", label: "Purple" },
  ];

  var COLORS = {
    red: "#e63946",
    orange: "#f4a261",
    yellow: "#ffe66d",
    green: "#2a9d8f",
    blue: "#457b9d",
    purple: "#9b5de5",
  };

  function shuffle(array) {
    var a = array.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function initJokes() {
    var btn = document.getElementById("btn-joke");
    var out = document.getElementById("joke-text");
    if (!btn || !out) return;

    btn.addEventListener("click", function () {
      var pick = JOKES[Math.floor(Math.random() * JOKES.length)];
      out.textContent = pick;
    });
  }

  function initRainbow() {
    var grid = document.getElementById("rainbow-grid");
    var status = document.getElementById("rainbow-status");
    var resetBtn = document.getElementById("btn-rainbow-reset");
    if (!grid || !status) return;

    var order = 0;
    var buttons = [];

    function buildGrid() {
      grid.innerHTML = "";
      buttons = [];
      var shuffled = shuffle(RAINBOW);
      for (var i = 0; i < shuffled.length; i++) {
        var item = shuffled[i];
        var b = document.createElement("button");
        b.type = "button";
        b.className = "rainbow-btn";
        b.style.backgroundColor = COLORS[item.name];
        b.setAttribute("aria-label", item.label);
        b.dataset.color = item.name;
        grid.appendChild(b);
        buttons.push(b);
      }
      attachHandlers();
    }

    function setStatus(msg) {
      status.textContent = msg;
    }

    function flash(el, className) {
      el.classList.add(className);
      window.setTimeout(function () {
        el.classList.remove(className);
      }, 400);
    }

    function attachHandlers() {
      for (var i = 0; i < buttons.length; i++) {
        buttons[i].addEventListener("click", onColorClick);
      }
    }

    function onColorClick(ev) {
      var expected = RAINBOW[order].name;
      var got = ev.currentTarget.dataset.color;
      if (got === expected) {
        flash(ev.currentTarget, "correct-flash");
        order += 1;
        if (order >= RAINBOW.length) {
          setStatus("You did it! Full rainbow — amazing!");
          for (var i = 0; i < buttons.length; i++) {
            buttons[i].disabled = true;
          }
        } else {
          setStatus("Nice! Next: " + RAINBOW[order].label + ".");
        }
      } else {
        flash(ev.currentTarget, "wrong-flash");
        setStatus("Oops! Try " + RAINBOW[order].label + " next.");
      }
    }

    function reset() {
      order = 0;
      for (var i = 0; i < buttons.length; i++) {
        buttons[i].disabled = false;
      }
      setStatus("Find Red first, then Orange, Yellow, Green, Blue, and Purple — in that order!");
      buildGrid();
    }

    if (resetBtn) {
      resetBtn.addEventListener("click", reset);
    }

    buildGrid();
  }

  function initFacts() {
    var list = document.getElementById("facts-list");
    var btn = document.getElementById("btn-shuffle-facts");
    if (!list) return;

    function render() {
      list.innerHTML = "";
      var picks = shuffle(FACTS).slice(0, 4);
      for (var i = 0; i < picks.length; i++) {
        var li = document.createElement("li");
        li.textContent = picks[i];
        list.appendChild(li);
      }
    }

    render();
    if (btn) {
      btn.addEventListener("click", render);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      initJokes();
      initRainbow();
      initFacts();
    });
  } else {
    initJokes();
    initRainbow();
    initFacts();
  }
})();
