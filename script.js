// Small shortcut so we can write $("id") instead of document.getElementById("id")
function $(id) { return document.getElementById(id); }

// Saves a number in the visitor's own browser (for "best" scores).
// If the browser blocks saving, the page still works.
var memory = {
  get: function (key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
  set: function (key, value) { try { localStorage.setItem(key, value); } catch (e) {} }
};

// Respect people who turned off animations in their device settings
var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;


/* =====================================================
   LIVE DATE AND TIME (top of the page)
   ===================================================== */
function updateTime() {
  var now = new Date();
  $("now").textContent = now.toLocaleString(undefined, {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "numeric", minute: "2-digit", second: "2-digit"
  });
}
updateTime();
setInterval(updateTime, 1000);   // refresh every second


/* =====================================================
   1. DOODLE PAD
   ===================================================== */
var canvas = $("canvas");
var ctx = canvas.getContext("2d");
var penColors = ["#1d1230", "#e5383b", "#ff8c00", "#1b9e5a", "#1f6feb", "#8e44ad", "#ffffff"];
var penColor = penColors[0];
var penSize = 6;
var strokes = [];        // every line you have drawn (so Undo works)
var currentStroke = null;
var isDrawing = false;

// Make a round colour button for each colour
penColors.forEach(function (color, i) {
  var button = document.createElement("button");
  button.className = "swatch";
  button.style.background = color;
  button.setAttribute("aria-label", "Colour " + (i + 1));
  button.setAttribute("aria-pressed", i === 0 ? "true" : "false");
  button.onclick = function () {
    penColor = color;
    var all = $("swatches").children;
    for (var j = 0; j < all.length; j++) all[j].setAttribute("aria-pressed", "false");
    button.setAttribute("aria-pressed", "true");
  };
  $("swatches").appendChild(button);
});

// Turn a mouse or finger position into a position on the canvas
function pointOnCanvas(event) {
  var box = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - box.left) * canvas.width / box.width,
    y: (event.clientY - box.top) * canvas.height / box.height
  };
}

// Repaint the whole canvas from the saved strokes
function redraw() {
  ctx.fillStyle = "#f6f3ff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  strokes.forEach(function (stroke) {
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.beginPath();
    stroke.points.forEach(function (p, i) {
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    });
    if (stroke.points.length === 1) ctx.lineTo(stroke.points[0].x + 0.1, stroke.points[0].y);  // a single dot
    ctx.stroke();
  });
}

canvas.addEventListener("pointerdown", function (event) {
  isDrawing = true;
  canvas.setPointerCapture(event.pointerId);
  currentStroke = { color: penColor, size: penSize, points: [pointOnCanvas(event)] };
  strokes.push(currentStroke);
  redraw();
});
canvas.addEventListener("pointermove", function (event) {
  if (!isDrawing) return;
  currentStroke.points.push(pointOnCanvas(event));
  redraw();
});
canvas.addEventListener("pointerup", function () { isDrawing = false; });
canvas.addEventListener("pointercancel", function () { isDrawing = false; });

$("undo").onclick = function () { strokes.pop(); redraw(); };
$("clear").onclick = function () { strokes = []; redraw(); };
$("save").onclick = function () {
  var link = document.createElement("a");
  link.download = "doodle.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
};
redraw();


/* =====================================================
   2. REACTION TEST
   ===================================================== */
var pad = $("pad");
var reactionState = "idle";     // idle -> wait -> go
var startedAt = 0;
var waitTimer;
var reactionBest = parseInt(memory.get("reaction-best"), 10);
if (reactionBest) $("reactionBest").textContent = reactionBest + " ms";

function padClicked() {
  if (reactionState === "idle") {
    // Start: wait a random 1.5 to 4 seconds, then turn green
    reactionState = "wait";
    pad.className = "wait";
    pad.textContent = "Wait for green...";
    waitTimer = setTimeout(function () {
      reactionState = "go";
      pad.className = "go";
      pad.textContent = "Now!";
      startedAt = performance.now();
    }, 1500 + Math.random() * 2500);

  } else if (reactionState === "wait") {
    // Clicked too early
    clearTimeout(waitTimer);
    reactionState = "idle";
    pad.className = "";
    pad.textContent = "Too early! Click to try again";

  } else {
    // Clicked on green: work out the time
    var ms = Math.round(performance.now() - startedAt);
    $("reactionTime").textContent = ms;
    reactionState = "idle";
    pad.className = "";
    pad.textContent = "Click to go again";
    if (!reactionBest || ms < reactionBest) {
      reactionBest = ms;
      memory.set("reaction-best", ms);
      $("reactionBest").textContent = ms + " ms";
    }
  }
}
pad.addEventListener("pointerdown", padClicked);
pad.addEventListener("keydown", function (event) {
  if (event.key === "Enter" || event.key === " ") { event.preventDefault(); padClicked(); }
});


/* =====================================================
   3. TYPING SPRINT
   Want your own lines? Add them to this list.
   Format: { text: "the line", by: "who said it" }
   ===================================================== */
var lines = [
  { text: "It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.", by: "Jane Austen, Pride and Prejudice" },
  { text: "It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness.", by: "Charles Dickens, A Tale of Two Cities" },
  { text: "Call me Ishmael. Some years ago, never mind how long precisely, having little money, I thought I would sail about a little.", by: "Herman Melville, Moby-Dick" },
  { text: "All happy families are alike; each unhappy family is unhappy in its own way.", by: "Leo Tolstoy, Anna Karenina" },
  { text: "All the world's a stage, and all the men and women merely players.", by: "William Shakespeare, As You Like It" },
  { text: "Why, sometimes I've believed as many as six impossible things before breakfast.", by: "Lewis Carroll, Through the Looking-Glass" },
  { text: "You see, but you do not observe. The distinction is clear.", by: "Arthur Conan Doyle, A Scandal in Bohemia" },
  { text: "When you have eliminated the impossible, whatever remains, however improbable, must be the truth.", by: "Arthur Conan Doyle, The Sign of Four" },
  { text: "I can resist everything except temptation.", by: "Oscar Wilde, Lady Windermere's Fan" },
  { text: "Always forgive your enemies; nothing annoys them so much.", by: "Oscar Wilde" },
  { text: "I have nothing to declare except my genius.", by: "Oscar Wilde, supposedly" },
  { text: "The report of my death was an exaggeration.", by: "Mark Twain" },
  { text: "Get your facts first, and then you can distort them as you please.", by: "Mark Twain" },
  { text: "Be careful about reading health books. You may die of a misprint.", by: "Mark Twain, attributed" },
  { text: "A man walks into a bar. Ouch.", by: "An old gag" },
  { text: "I told my wife she was drawing her eyebrows too high. She looked surprised.", by: "A very old joke" },
  { text: "I would tell you a joke about a roof, but it would go over your head.", by: "A groaner" },
  { text: "I used to be a banker, but I lost interest.", by: "A groaner" },
  { text: "Why did the chicken cross the road? To get to the other side.", by: "The oldest joke in the book" },
  { text: "I am reading a book about anti-gravity. It is impossible to put down.", by: "A groaner" },
  { text: "A tortoise was asked how he felt after being mugged by two snails. I do not know, he said, it all happened so fast.", by: "A classic gag" }
];

var currentLine = null;
var typingStart = 0;
var typedBox = $("typed");
var wpmBest = parseInt(memory.get("wpm-best"), 10);
if (wpmBest) $("wpmBest").textContent = wpmBest;

// Colour each letter: green = right, red = wrong, faded = not typed yet
function showTarget(typedSoFar) {
  var html = "";
  var text = currentLine.text;
  for (var i = 0; i < text.length; i++) {
    var letter = text[i].replace("&", "&amp;").replace("<", "&lt;");
    var kind = i < typedSoFar.length ? (typedSoFar[i] === text[i] ? "ok" : "bad") : "rest";
    html += '<span class="' + kind + '">' + letter + "</span>";
  }
  $("target").innerHTML = html;
}

// Pick a random line (never the same one twice in a row)
function nextLine() {
  var next;
  do { next = lines[Math.floor(Math.random() * lines.length)]; } while (next === currentLine);
  currentLine = next;
  typingStart = 0;
  typedBox.value = "";
  typedBox.disabled = false;
  $("source").textContent = "";
  showTarget("");
}

typedBox.addEventListener("input", function () {
  var value = typedBox.value;
  if (!typingStart && value.length) typingStart = performance.now();   // clock starts on first key
  showTarget(value);

  if (value === currentLine.text) {
    // Finished: a "word" counts as 5 letters
    var minutes = (performance.now() - typingStart) / 60000;
    var wpm = Math.round((currentLine.text.length / 5) / minutes);
    $("wpm").textContent = wpm;
    $("source").textContent = "That one was from: " + currentLine.by;
    typedBox.disabled = true;
    if (!wpmBest || wpm > wpmBest) {
      wpmBest = wpm;
      memory.set("wpm-best", wpm);
      $("wpmBest").textContent = wpm;
    }
  }
});

$("newLine").onclick = function () { nextLine(); typedBox.focus(); };
nextLine();


/* =====================================================
   4. FOCUS TIMER
   ===================================================== */
var chosenMinutes = 25;
var secondsLeft = 25 * 60;
var finishTime = 0;
var timerId = null;

function twoDigits(n) { return (n < 10 ? "0" : "") + n; }
function formatTime(s) { return twoDigits(Math.floor(s / 60)) + ":" + twoDigits(s % 60); }

function showTimer() {
  $("clock").textContent = formatTime(secondsLeft);
  document.title = timerId ? formatTime(secondsLeft) + " | Workshop" : "Ritam's Workshop";
}

// A short beep when time is up
function beep() {
  try {
    var audio = new (window.AudioContext || window.webkitAudioContext)();
    var tone = audio.createOscillator();
    var volume = audio.createGain();
    tone.connect(volume);
    volume.connect(audio.destination);
    tone.frequency.value = 660;
    volume.gain.value = 0.15;
    tone.start();
    tone.stop(audio.currentTime + 0.6);
  } catch (e) {}
}

function stopTimer() {
  clearInterval(timerId);
  timerId = null;
  $("start").textContent = "Start";
}

// Length buttons (25, 5, 50)
document.querySelectorAll("[data-minutes]").forEach(function (button) {
  button.onclick = function () {
    stopTimer();
    chosenMinutes = Number(button.dataset.minutes);
    secondsLeft = chosenMinutes * 60;
    $("timerMessage").textContent = "";
    showTimer();
  };
});

$("start").onclick = function () {
  if (timerId) { stopTimer(); showTimer(); return; }          // pause
  finishTime = Date.now() + secondsLeft * 1000;
  $("timerMessage").textContent = "";
  $("start").textContent = "Pause";
  timerId = setInterval(function () {
    secondsLeft = Math.max(0, Math.round((finishTime - Date.now()) / 1000));
    showTimer();
    if (secondsLeft === 0) {
      stopTimer();
      beep();
      $("timerMessage").textContent = "Time's up. Go stretch your legs.";
      showTimer();
    }
  }, 250);
};

$("reset").onclick = function () {
  stopTimer();
  secondsLeft = chosenMinutes * 60;
  $("timerMessage").textContent = "";
  showTimer();
};


/* =====================================================
   5. DECIDER
   ===================================================== */
// Read the options box: split on new lines or commas, drop empty ones
function readOptions() {
  return $("options").value
    .split(/[\n,]+/)
    .map(function (s) { return s.trim(); })
    .filter(Boolean);
}

$("pick").onclick = function () {
  var choices = readOptions();
  var result = $("result");
  if (choices.length < 2) { result.textContent = "Give me at least two options."; return; }

  var winner = choices[Math.floor(Math.random() * choices.length)];
  if (reduceMotion) { result.textContent = winner; return; }

  // Flick through the options, slowing down, then land on the winner
  var step = 0;
  var totalSteps = 18;
  (function spin() {
    step++;
    result.textContent = step < totalSteps ? choices[Math.floor(Math.random() * choices.length)] : winner;
    if (step < totalSteps) setTimeout(spin, 50 + step * step * 1.2);
  })();
};

$("flip").onclick = function () {
  $("result").textContent = Math.random() < 0.5 ? "Heads" : "Tails";
};

/* =====================================================
   6. MAGIC 8-BALL
   Add or change answers in this list whenever you like.
   ===================================================== */
var answers = [
  "Yes, go for it",
  "Definitely",
  "Without a doubt",
  "Looks good to me",
  "Most likely",
  "I wouldn't bet against it",
  "Ask me later",
  "Hard to say",
  "Not sure, try again",
  "Better not tell you now",
  "Don't count on it",
  "I'd say no",
  "Very doubtful",
  "My gut says no",
  "Ha, no chance"
];

var ball = $("ball");
var answerBox = $("answer");
var shaking = false;

function shakeBall() {
  if (shaking) return;

  // Make the person ask something first
  if ($("question").value.trim() === "") {
    answerBox.classList.add("talking");
    answerBox.textContent = "Ask me something first";
    return;
  }

  shaking = true;
  answerBox.classList.remove("talking");
  answerBox.textContent = "8";

  var wait = reduceMotion ? 0 : 700;     // skip the shake if animations are turned off
  if (!reduceMotion) ball.classList.add("shake");

  setTimeout(function () {
    ball.classList.remove("shake");
    answerBox.classList.add("talking");
    answerBox.textContent = answers[Math.floor(Math.random() * answers.length)];
    shaking = false;
  }, wait);
}

$("shake").onclick = shakeBall;
$("ball").onclick = shakeBall;                      // clicking the ball works too
$("question").addEventListener("keydown", function (event) {
  if (event.key === "Enter") shakeBall();           // press Enter to shake
});


/* =====================================================
   7. SCRATCHPAD
   Saves automatically in this browser (not on a server).
   ===================================================== */
var notes = $("notes");
var saveTimer;

// Count words and show a status line
function updateInfo(message) {
  var text = notes.value.trim();
  var words = text === "" ? 0 : text.split(/\s+/).length;
  $("notesInfo").textContent = words + (words === 1 ? " word" : " words") + (message ? " | " + message : "");
}

// Bring back whatever was saved last time
notes.value = memory.get("scratchpad") || "";
updateInfo("");

// Save shortly after you stop typing
notes.addEventListener("input", function () {
  updateInfo("saving...");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(function () {
    memory.set("scratchpad", notes.value);
    updateInfo("saved");
  }, 500);
});

$("copyNotes").onclick = function () {
  if (!navigator.clipboard) { updateInfo("copy not supported here"); return; }
  navigator.clipboard.writeText(notes.value).then(
    function () { updateInfo("copied"); },
    function () { updateInfo("couldn't copy"); }
  );
};

$("downloadNotes").onclick = function () {
  var file = new Blob([notes.value], { type: "text/plain" });
  var link = document.createElement("a");
  link.href = URL.createObjectURL(file);
  link.download = "scratchpad.txt";
  link.click();
  URL.revokeObjectURL(link.href);
};

$("clearNotes").onclick = function () {
  if (notes.value === "") return;
  if (confirm("Clear everything in the scratchpad? This can't be undone.")) {
    notes.value = "";
    memory.set("scratchpad", "");
    updateInfo("cleared");
  }
};
/* =====================================================
   COIN FAVICON
   Stays still. Flips once when someone clicks "Flip a coin".
   ===================================================== */
(function () {
  var link = document.getElementById("favicon");
  if (!link) return;

  var canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  var pen = canvas.getContext("2d");

  // The same R shape as in favicon.svg
  var letterR = new Path2D(
    "M16 12H38C48 12 52 18 52 25C52 31 48 35 42 36L53 52H40L31 37H28V52H16Z" +
    "M28 22V30H37C40 30 41 28 41 26C41 24 40 22 37 22Z"
  );

  // Draw the coin squashed sideways by "squash" (1 = full width, 0.06 = edge-on)
  function drawCoin(squash) {
    pen.clearRect(0, 0, 64, 64);
    pen.save();
    pen.translate(32, 32);
    pen.scale(squash, 1);

    pen.beginPath();
    pen.arc(0, 0, 29, 0, Math.PI * 2);
    pen.fillStyle = "#ffd84d";
    pen.fill();
    pen.lineWidth = 4;
    pen.strokeStyle = "#1d1230";
    pen.stroke();

    pen.beginPath();
    pen.arc(0, 0, 22, 0, Math.PI * 2);
    pen.lineWidth = 2;
    pen.setLineDash([3, 3]);
    pen.stroke();
    pen.setLineDash([]);

    pen.rotate(-5 * Math.PI / 180);
    pen.scale(0.62, 0.62);
    pen.translate(-34.5, -32);
    pen.fillStyle = "#1d1230";
    pen.fill(letterR, "evenodd");

    pen.restore();
  }

  var flipping = false;

  function flipFavicon() {
    if (flipping || reduceMotion) return;     // one flip at a time, and none if animations are off
    flipping = true;

    var duration = 1400;                      // how long one flip lasts (milliseconds)
    var begin = Date.now();
    var last = -1;

    var timer = setInterval(function () {
      var p = Math.min(1, (Date.now() - begin) / duration);   // 0 to 1

      if (p >= 1) {
        // Done: go back to the normal still icon
        clearInterval(timer);
        link.type = "image/svg+xml";
        link.href = "favicon.svg";
        flipping = false;
        return;
      }

      // Two spins: the coin goes edge-on twice, then lands face-up
      var squash = Math.max(0.06, Math.abs(Math.cos(p * 4 * Math.PI)));
      squash = Math.round(squash * 20) / 20;
      if (squash === last) return;
      last = squash;

      drawCoin(squash);
      link.type = "image/png";
      link.href = canvas.toDataURL("image/png");
    }, 60);
  }

  // Runs in addition to the Decider's own "Flip a coin" code, so you don't need to change that
  $("flip").addEventListener("click", flipFavicon);
})();

/* =====================================================
   8. JUKEBOX (YouTube Music-Only Full Tracks)
   ===================================================== */
var YT_API_KEY = "AIzaSyBywYmbNu2Fh631pt7BHL_LZEJ3b_om1Us";
var ytPlayer = null;
var ytReady = false;
var progressTimer = null;
var songs = [];           // the current search results
var playingIndex = -1;    // which result is playing

// Load YouTube IFrame API script automatically
var tag = document.createElement("script");
tag.src = "https://youtube.com";
document.head.appendChild(tag);

window.onYouTubeIframeAPIReady = function () {
  ytPlayer = new YT.Player("ytPlayer", {
    height: "200",
    width: "200",
    playerVars: {
      controls: 0,
      modestbranding: 1,
      rel: 0,
      playsinline: 1
    },
    events: {
      onReady: function () { ytReady = true; },
      onStateChange: onPlayerStateChange
    }
  });
};

function onPlayerStateChange(event) {
  // 1 = Playing, 2 = Paused, 0 = Ended
  if (event.data === YT.PlayerState.PLAYING) {
    $("playPause").textContent = "Pause";
    $("dockLabel").textContent = "♪ Playing";
    startProgressLoop();
  } else if (event.data === YT.PlayerState.PAUSED) {
    $("playPause").textContent = "Play";
    $("dockLabel").textContent = "♪ Jukebox";
    stopProgressLoop();
  } else if (event.data === YT.PlayerState.ENDED) {
    stopProgressLoop();
    if (playingIndex + 1 < songs.length) playSong(playingIndex + 1);
  }
}

function startProgressLoop() {
  stopProgressLoop();
  progressTimer = setInterval(function () {
    if (!ytPlayer || !ytPlayer.getCurrentTime) return;
    var cur = ytPlayer.getCurrentTime();
    var dur = ytPlayer.getDuration();
    if (dur > 0) $("seek").value = (cur / dur) * 100;
    $("nowTime").textContent = mmss(cur);
  }, 500);
}

function stopProgressLoop() {
  clearInterval(progressTimer);
}

function say(message) { $("musicStatus").textContent = message; }

function mmss(seconds) {
  if (!isFinite(seconds)) return "0:00";
  var m = Math.floor(seconds / 60);
  var s = Math.floor(seconds % 60);
  return m + ":" + (s < 10 ? "0" : "") + s;
}

// Search YouTube strictly for Music (videoCategoryId=10)
function searchMusic(query) {
  query = query.trim();
  if (!query) { say("Type an artist or a song first."); return; }
  say("Searching...");

 var url = "https://googleapis.com" + encodeURIComponent(query + " official audio") + "&key=" + YT_API_KEY;


  fetch(url)
    .then(function (response) {
      if (!response.ok) throw new Error("bad response");
      return response.json();
    })
    .then(function (data) {
      songs = (data.items || []).map(function (item) {
        // Decode HTML entities like &amp; in YouTube titles
        var txt = document.createElement("textarea");
        txt.innerHTML = item.snippet.title;
        return {
          videoId: item.id.videoId,
          trackName: txt.value,
          artistName: item.snippet.channelTitle.replace(" - Topic", ""),
          artworkUrl: item.snippet.thumbnails.default.url
        };
      });
      showSongs();
      say(songs.length ? songs.length + " tracks found. Click one to play." : "Nothing found. Try another search.");
    })
    .catch(function () {
      say("Couldn't reach YouTube. Check your API key or connection.");
    });
}

// Build the list of results on the page
function showSongs() {
  var list = $("tracks");
  list.innerHTML = "";
  playingIndex = -1;

  songs.forEach(function (song, index) {
    var item = document.createElement("li");
    var button = document.createElement("button");
    button.className = "track";

    var art = document.createElement("img");
    art.src = song.artworkUrl;
    art.alt = "";
    art.width = 48;
    art.height = 48;

    var text = document.createElement("span");
    var title = document.createElement("b");
    title.textContent = song.trackName;
    var artist = document.createElement("small");
    artist.textContent = song.artistName;
    text.append(title, document.createElement("br"), artist);

    button.append(art, text);
    button.onclick = function () { playSong(index); };
    item.appendChild(button);
    list.appendChild(item);
  });
}

// Start playing one result
function playSong(index) {
  var song = songs[index];
  if (!song || !ytReady) return;
  playingIndex = index;

  ytPlayer.loadVideoById(song.videoId);

  $("nowTitle").textContent = song.trackName;
  $("nowArtist").textContent = song.artistName;
  $("seek").value = 0;
  $("nowTime").textContent = "0:00";
  $("now").hidden = false;

  var buttons = $("tracks").querySelectorAll(".track");
  buttons.forEach(function (b, i) {
    b.setAttribute("aria-current", i === index ? "true" : "false");
  });
}

// Player controls
$("playPause").onclick = function () {
  if (!ytReady || playingIndex === -1) return;
  var state = ytPlayer.getPlayerState();
  if (state === YT.PlayerState.PLAYING) {
    ytPlayer.pauseVideo();
  } else {
    ytPlayer.playVideo();
  }
};

$("seek").addEventListener("input", function () {
  if (!ytReady || !ytPlayer.getDuration) return;
  var dur = ytPlayer.getDuration();
  if (dur > 0) ytPlayer.seekTo(($("seek").value / 100) * dur, true);
});

// Search button, Enter key, and the quick-pick chips
$("musicGo").onclick = function () { searchMusic($("musicSearch").value); };
$("musicSearch").addEventListener("keydown", function (event) {
  if (event.key === "Enter") searchMusic($("musicSearch").value);
});
document.querySelectorAll("[data-q]").forEach(function (chip) {
  chip.onclick = function () {
    $("musicSearch").value = chip.dataset.q;
    searchMusic(chip.dataset.q);
  };
});

/* =====================================================
   JUKEBOX DOCK: open and close the side panel
   ===================================================== */
var dock = $("dock");

$("dockTab").onclick = function () {
  var open = dock.classList.toggle("open");
  $("dockTab").setAttribute("aria-expanded", open ? "true" : "false");
};
