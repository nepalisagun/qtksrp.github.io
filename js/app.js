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

  /** Short quotes for grades K–8: kindness, effort, curiosity, and self-worth. */
  var DAILY_QUOTES = [
    { text: "Mistakes are proof that you are trying.", author: "— Jennifer Lim" },
    { text: "You are braver than you believe, stronger than you seem, and smarter than you think.", author: "— A. A. Milne" },
    { text: "In a world where you can be anything, be kind.", author: "— Unknown" },
    { text: "The more that you read, the more things you will know.", author: "— Dr. Seuss" },
    { text: "Why fit in when you were born to stand out?", author: "— Dr. Seuss" },
    { text: "You have brains in your head. You have feet in your shoes. You can steer yourself any direction you choose.", author: "— Dr. Seuss" },
    { text: "The best way out is always through.", author: "— Robert Frost" },
    { text: "I have not failed. I've just found 10,000 ways that won't work.", author: "— Thomas Edison" },
    { text: "It always seems impossible until it's done.", author: "— Nelson Mandela" },
    { text: "You miss 100% of the shots you don't take.", author: "— Wayne Gretzky" },
    { text: "Whether you think you can or you think you can't — you're right.", author: "— Henry Ford" },
    { text: "The future belongs to those who believe in the beauty of their dreams.", author: "— Eleanor Roosevelt" },
    { text: "Be yourself; everyone else is already taken.", author: "— Oscar Wilde" },
    { text: "Nothing is impossible. The word itself says I'm possible!", author: "— Audrey Hepburn" },
    { text: "You are enough just as you are.", author: "— Meghan Markle" },
    { text: "Start where you are. Use what you have. Do what you can.", author: "— Arthur Ashe" },
    { text: "A person who never made a mistake never tried anything new.", author: "— Albert Einstein" },
    { text: "I am still learning.", author: "— Michelangelo (at age 87)" },
    { text: "Wonder is the beginning of wisdom.", author: "— Socrates" },
    { text: "The expert in anything was once a beginner.", author: "— Helen Hayes" },
    { text: "Practice isn't the thing you do once you're good. It's the thing you do that makes you good.", author: "— Malcolm Gladwell" },
    { text: "If you can dream it, you can do it.", author: "— Walt Disney" },
    { text: "All our dreams can come true, if we have the courage to pursue them.", author: "— Walt Disney" },
    { text: "You must do the things you think you cannot do.", author: "— Eleanor Roosevelt" },
    { text: "Kindness is a language the deaf can hear and the blind can see.", author: "— Mark Twain" },
    { text: "No act of kindness, no matter how small, is ever wasted.", author: "— Aesop" },
    { text: "Try to be a rainbow in someone's cloud.", author: "— Maya Angelou" },
    { text: "We rise by lifting others.", author: "— Robert Ingersoll" },
    { text: "Alone we can do so little; together we can do so much.", author: "— Helen Keller" },
    { text: "The only way to have a friend is to be one.", author: "— Ralph Waldo Emerson" },
    { text: "You've got to get up every morning with determination if you're going to go to bed with satisfaction.", author: "— George Lorimer" },
    { text: "Don't watch the clock; do what it does. Keep going.", author: "— Sam Levenson" },
    { text: "It does not matter how slowly you go as long as you do not stop.", author: "— Confucius" },
    { text: "The secret of getting ahead is getting started.", author: "— Mark Twain" },
    { text: "You don't have to be perfect to be amazing.", author: "— Unknown" },
    { text: "Every accomplishment starts with the decision to try.", author: "— Unknown" },
    { text: "Courage doesn't always roar. Sometimes courage is the quiet voice at the end of the day saying, I will try again tomorrow.", author: "— Mary Anne Radmacher" },
    { text: "Believe you can and you're halfway there.", author: "— Theodore Roosevelt" },
    { text: "What lies behind us and what lies before us are tiny matters compared to what lies within us.", author: "— Ralph Waldo Emerson" },
    { text: "Education is the most powerful weapon which you can use to change the world.", author: "— Nelson Mandela" },
    { text: "Happiness grows when we share it with others.", author: "— Unknown" },
    { text: "Fall seven times, stand up eight.", author: "— Japanese proverb" },
    { text: "Stars can't shine without darkness.", author: "— Unknown" },
    { text: "Your attitude, not your aptitude, will determine your altitude.", author: "— Zig Ziglar" },
    { text: "If you want to lift yourself up, lift up someone else.", author: "— Booker T. Washington" },
    { text: "Do what you can, with what you have, where you are.", author: "— Theodore Roosevelt" },
    { text: "The best way to predict your future is to create it.", author: "— Abraham Lincoln (often attributed)" },
    { text: "You are capable of more than you know.", author: "— Unknown" },
    { text: "Small steps every day add up to big journeys.", author: "— Unknown" },
    { text: "Curiosity is the wick in the candle of learning.", author: "— William Arthur Ward" },
    { text: "Reading is to the mind what exercise is to the body.", author: "— Joseph Addison" },
    { text: "Today a reader, tomorrow a leader.", author: "— Margaret Fuller" },
    { text: "A little progress each day adds up to big results.", author: "— Unknown" },
    { text: "Teamwork makes the dream work.", author: "— John C. Maxwell" },
    { text: "Treat others the way you want to be treated.", author: "— The Golden Rule" },
    { text: "Listening is an act of love.", author: "— Unknown" },
    { text: "When you know better, you do better.", author: "— Maya Angelou" },
    { text: "Peace begins with a smile.", author: "— Mother Teresa" },
    { text: "Joy is not in things; it is in us.", author: "— Richard Wagner" },
    { text: "The sun himself is weak when he first rises, and gathers strength and courage as the day gets on.", author: "— Charles Dickens" },
  ];

  function dayNumberForQuote() {
    var d = new Date();
    var start = new Date(d.getFullYear(), 0, 0);
    var diff = d.getTime() - start.getTime();
    var dayOfYear = Math.floor(diff / 86400000);
    return d.getFullYear() * 400 + dayOfYear;
  }

  function initQuoteOfDay() {
    var textEl = document.getElementById("quote-text");
    var authorEl = document.getElementById("quote-author");
    var dateEl = document.getElementById("quote-date");
    if (!textEl || !authorEl) return;

    var idx = dayNumberForQuote() % DAILY_QUOTES.length;
    var q = DAILY_QUOTES[idx];
    textEl.textContent = '"' + q.text + '"';
    authorEl.textContent = q.author;

    if (dateEl) {
      dateEl.textContent = new Date().toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }
  }

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
      initQuoteOfDay();
      initFacts();
    });
  } else {
    initJokes();
    initRainbow();
    initQuoteOfDay();
    initFacts();
  }
})();
