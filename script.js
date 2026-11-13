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
  $("dateTime").textContent = now.toLocaleString(undefined, {
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
   8. JUKEBOX (YouTube Music-Only + Floating Mini-Player)
   ===================================================== */
var YT_API_KEY = "AIzaSyBywYmbNu2Fh631pt7BHL_LZEJ3b_om1Us";
var ytPlayer = null;
var ytReady = false;
var progressTimer = null;
var songs = [];           // the current search results
var playingIndex = -1;    // which result is playing

// Load YouTube IFrame API script automatically
var tag = document.createElement("script");
tag.src = "https://www.youtube.com/iframe_api";
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
      onStateChange: onPlayerStateChange,
      onError: function (event) {
        if (event.data !== 101 && event.data !== 150) return;
        say("Track restricted by label, skipping...");
        if (playingIndex + 1 < songs.length) {
          playSong(playingIndex + 1);
        }
      }
    }
  });
};

function onPlayerStateChange(event) {
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

// Strip noisy "(Official Audio)" / "[Lyrics]" text from YouTube titles
function cleanTitle(raw) {
  var txt = document.createElement("textarea");
  txt.innerHTML = raw;
  return txt.value.replace(/\s*[\(\[](official|audio|video|lyrics|visualizer|hd|4k).*?[\)\]]/gi, "").trim();
}

// Convert a YouTube ISO 8601 duration to seconds
function durationInSeconds(duration) {
  var match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(duration || "");
  if (!match) return 0;
  return (Number(match[1]) || 0) * 86400
    + (Number(match[2]) || 0) * 3600
    + (Number(match[3]) || 0) * 60
    + (Number(match[4]) || 0);
}

// Search YouTube for embeddable full-length videos
function searchMusic(query) {
  query = query.trim();
  if (!query) { say("Type an artist or a song first."); return; }
  say("Searching...");

  var url = "https://www.googleapis.com/youtube/v3/search"
    + "?part=snippet&type=video&videoEmbeddable=true"
    + "&videoCategoryId=10&maxResults=25"      // 10 = Music category only
    + "&q=" + encodeURIComponent(query)
    + "&key=" + YT_API_KEY;

  fetch(url)
    .then(function (response) {
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.json();
    })
    .then(function (data) {
      var ids = (data.items || []).map(function (item) {
        return item.id.videoId;
      }).filter(Boolean);
      if (!ids.length) return [];

      var videosUrl = "https://www.googleapis.com/youtube/v3/videos"
        + "?part=snippet,contentDetails,status&id=" + encodeURIComponent(ids.join(","))
        + "&key=" + YT_API_KEY;

      return fetch(videosUrl).then(function (response) {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
      }).then(function (videosData) {
        return videosData.items || [];
      });
    })
    .then(function (items) {
      songs = items.filter(function (item) {
        // Drop anything tagged as a Short
        var text = (item.snippet.title + " " + (item.snippet.description || "")).toLowerCase();
        var isShort = text.indexOf("#short") !== -1;

        return item.status.embeddable === true
          && !isShort
          && durationInSeconds(item.contentDetails.duration) >= 120;   // was 65
      }).sort(function (a, b) {
        return Number(b.snippet.channelTitle.endsWith(" - Topic"))
          - Number(a.snippet.channelTitle.endsWith(" - Topic"));
      }).map(function (item) {
        return {
          videoId: item.id,
          trackName: cleanTitle(item.snippet.title),
          artistName: item.snippet.channelTitle.replace(" - Topic", ""),
          channelTitle: item.snippet.channelTitle,
          artworkUrl: item.snippet.thumbnails.default.url
        };
      });
      showSongs();
      say(songs.length ? songs.length + " tracks found. Click one to play." : "Nothing found. Try another search.");
    })
    .catch(function (err) {
      console.error("YouTube search error:", err);
      say("Couldn't reach YouTube. Check your API key or connection.");
    });
}

// Build the list of results inside the search dock
function showSongs() {
  var list = $("tracks");
  list.innerHTML = "";
  list.scrollTop = 0;
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

// Start playing one result in the floating bottom-right player
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

// Close playback without allowing a late player event to advance the queue.
$("closePlayer").onclick = function () {
  playingIndex = -1;
  if (ytReady && ytPlayer) ytPlayer.stopVideo();
  $("dockLabel").textContent = "♪ Jukebox";
  $("tracks").querySelectorAll(".track").forEach(function (button) {
    button.removeAttribute("aria-current");
  });
  $("now").hidden = true;
};

// Drag the player by its non-interactive surface while keeping it in the viewport.
var miniPlayer = $("now");
var dragState = null;

miniPlayer.addEventListener("pointerdown", function (event) {
  if (event.target.closest && event.target.closest("button, input")) return;
  var rect = miniPlayer.getBoundingClientRect();
  dragState = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    left: rect.left,
    top: rect.top,
    moved: false
  };
  miniPlayer.setPointerCapture(event.pointerId);
});

miniPlayer.addEventListener("pointermove", function (event) {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  var deltaX = event.clientX - dragState.startX;
  var deltaY = event.clientY - dragState.startY;
  if (!dragState.moved && Math.abs(deltaX) + Math.abs(deltaY) < 3) return;

  dragState.moved = true;
  miniPlayer.classList.add("dragging");
  var maxLeft = Math.max(0, window.innerWidth - miniPlayer.offsetWidth);
  var maxTop = Math.max(0, window.innerHeight - miniPlayer.offsetHeight);
  miniPlayer.style.left = Math.max(0, Math.min(maxLeft, dragState.left + deltaX)) + "px";
  miniPlayer.style.top = Math.max(0, Math.min(maxTop, dragState.top + deltaY)) + "px";
  miniPlayer.style.right = "auto";
  miniPlayer.style.bottom = "auto";
  event.preventDefault();
});

function endMiniPlayerDrag(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  miniPlayer.classList.remove("dragging");
  if (miniPlayer.hasPointerCapture(event.pointerId)) {
    miniPlayer.releasePointerCapture(event.pointerId);
  }
  dragState = null;
}

miniPlayer.addEventListener("pointerup", endMiniPlayerDrag);
miniPlayer.addEventListener("pointercancel", endMiniPlayerDrag);

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

$("prevTrack").onclick = function () {
  if (playingIndex > 0) playSong(playingIndex - 1);
};

$("nextTrack").onclick = function () {
  if (playingIndex + 1 < songs.length) playSong(playingIndex + 1);
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

/* =====================================================
   PORTAL RUNNER (game)
   ===================================================== */
(function () {
  var canvas = $("game");
  var ctx = canvas.getContext("2d");
  var W = canvas.width, H = canvas.height;     // 900 x 300

  // The world: a ceiling lane and a floor lane (all numbers are pixels)
  var CEIL = 50, FLOOR = 250, MID = 150;
  var SIZE = 32;        // size of the player
  var GRAV = 0.75;      // how hard gravity pulls
  var JUMP = 13;        // how strong a jump is

  var COLORS = {
    mint: "#7ff0c8", pink: "#ff8fb7", sun: "#ffd84d",
    sky: "#7cc0ff", lilac: "#c1a8ff", ink: "#1d1230", paper: "#f6f3ff"
  };

  var state = "ready";      // ready -> playing -> over
  var p, things, bits;      // player, hazards and pickups, particles
  var speed, distance, bonus, starCount, score;
  var nextSpawn, nextGravity, shield, flash, shake, buffer, overAt;
  var best = parseInt(memory.get("runner-best"), 10) || 0;
  var soundOn = false, soundCtx = null, visible = true;

  // Background dots for a sense of depth (made once)
  var dots = [];
  for (var i = 0; i < 40; i++) {
    dots.push({ x: Math.random() * W, y: Math.random() * H, r: 1 + Math.random() * 1.5, s: 0.1 + Math.random() * 0.3, a: 0.2 + Math.random() * 0.5 });
  }

  /* ---------- Sound (off until you switch it on) ---------- */
  function blip(freq, length, wave) {
    if (!soundOn) return;
    try {
      soundCtx = soundCtx || new (window.AudioContext || window.webkitAudioContext)();
      var osc = soundCtx.createOscillator();
      var vol = soundCtx.createGain();
      osc.type = wave || "square";
      osc.frequency.value = freq;
      vol.gain.value = 0.05;
      osc.connect(vol);
      vol.connect(soundCtx.destination);
      osc.start();
      osc.stop(soundCtx.currentTime + length);
    } catch (e) {}
  }

  /* ---------- Starting a new run ---------- */
  function reset() {
    p = { x: 90, y: FLOOR - SIZE, vy: 0, g: 1, onGround: true };   // g: 1 = floor, -1 = ceiling
    things = [];
    bits = [];
    speed = 6; distance = 0; bonus = 0; starCount = 0; score = 0;
    nextSpawn = 500;
    nextGravity = 1;       // which lane the player will be running on at the far edge
    shield = false; flash = 0; shake = 0; buffer = 0;
  }

  function start() {
    reset();
    state = "playing";
    $("gameStart").textContent = "Restart";
  }

  function die() {
    state = "over";
    overAt = performance.now();
    if (score > best) { best = score; memory.set("runner-best", score); }
    burst(p.x + SIZE / 2, p.y + SIZE / 2, COLORS.pink, 28);
    shake = reduceMotion ? 0 : 14;
    blip(150, 0.3, "sawtooth");
    $("gameStart").textContent = "Play again";
  }

  /* ---------- Spawning things off the right edge ---------- */
  function add(thing) {
    thing.age = 0;
    if (thing.kind === "spike" || thing.kind === "block") {
      thing.y = thing.lane === 1 ? FLOOR - thing.h : CEIL;    // sits on the floor, or hangs from the ceiling
    }
    things.push(thing);
  }

  function spawn() {
    var r = Math.random();
    var x = W + 40;
    // Most hazards go on the side you'll be running on, a few on the other side
    var lane = Math.random() < 0.85 ? nextGravity : -nextGravity;
    var gap = speed * 30 + 170 + Math.random() * 200;      // space before the next thing

    if (r < 0.38) {
      var n = 1 + Math.floor(Math.random() * 3);            // 1 to 3 spikes in a row
      add({ kind: "spike", x: x, w: 26 * n, h: 26, lane: lane });
    } else if (r < 0.58) {
      add({ kind: "block", x: x, w: 34, h: 44, lane: lane });
    } else if (r < 0.70) {
      add({ kind: "drone", x: x, y: MID - 13 + (Math.random() * 44 - 22), w: 40, h: 26 });
    } else if (r < 0.80) {
      add({ kind: "portal", x: x, y: CEIL, w: 34, h: FLOOR - CEIL, dir: -nextGravity });
      nextGravity = -nextGravity;
      gap += 120;                                           // extra room to land after a flip
    } else if (r < 0.92) {
      var cy = lane === 1 ? FLOOR - 30 - Math.random() * 90 : CEIL + 30 + Math.random() * 90;
      for (var i = 0; i < 3; i++) add({ kind: "star", x: x + i * 38, y: cy - 10, w: 20, h: 20 });
      gap += 80;
    } else {
      add({ kind: "shield", x: x, y: lane === 1 ? FLOOR - 46 : CEIL + 18, w: 28, h: 28 });
    }
    nextSpawn = gap;
  }

  /* ---------- Particles (sparkles and crash bits) ---------- */
  function burst(x, y, color, count) {
    for (var i = 0; i < count; i++) {
      bits.push({ x: x, y: y, vx: Math.random() * 8 - 5, vy: Math.random() * 8 - 4, life: 30, max: 30, c: color, r: 2 + Math.random() * 3 });
    }
  }

  /* ---------- Jumping ---------- */
  function doJump() {
    p.vy = -JUMP * p.g;
    p.onGround = false;
    buffer = 0;
    blip(520, 0.08);
  }

  function jump() {
    if (state === "ready") { start(); return; }
    if (state === "over") {
      if (performance.now() - overAt > 500) start();   // short pause so a panicky tap doesn't restart
      return;
    }
    if (p.onGround) doJump(); else buffer = 8;         // remember a jump pressed just before landing
  }

  /* ---------- One step of the game ---------- */
  function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function update(dt) {
    speed = Math.min(14, 6 + distance / 2500);        // gets faster the further you go
    var move = speed * dt;
    distance += move;
    score = Math.floor(distance / 20) + bonus;

    // Gravity and landing
    p.vy += GRAV * p.g * dt;
    p.y += p.vy * dt;
    p.onGround = false;
    if (p.y + SIZE >= FLOOR) { p.y = FLOOR - SIZE; p.vy = 0; p.onGround = (p.g === 1); }
    if (p.y <= CEIL) { p.y = CEIL; p.vy = 0; p.onGround = (p.g === -1); }

    if (buffer > 0) { buffer -= dt; if (p.onGround) doJump(); }

    // A little trail behind the player
    if (Math.random() < 0.6) {
      bits.push({ x: p.x + 2, y: p.y + SIZE / 2 + (Math.random() * 10 - 5), vx: -speed, vy: 0, life: 14, max: 14, c: COLORS.mint, r: 3 });
    }

    // New things from the right
    nextSpawn -= move;
    if (nextSpawn <= 0) spawn();

    // Move things and check for hits
    var hit = { x: p.x + 5, y: p.y + 5, w: SIZE - 10, h: SIZE - 10 };   // a slightly forgiving hitbox
    for (var i = things.length - 1; i >= 0; i--) {
      var t = things[i];
      t.x -= move;
      t.age += dt;
      if (t.x + t.w < -60) { things.splice(i, 1); continue; }

      if (t.kind === "portal") {
        if (!t.used && hit.x + hit.w > t.x && hit.x < t.x + t.w) {
          t.used = true;
          p.g = -p.g;                    // flip gravity
          p.onGround = false;
          p.vy = p.g * 4;
          bonus += 25;
          flash = 1;
          burst(p.x + SIZE / 2, p.y + SIZE / 2, COLORS.lilac, 16);
          blip(880, 0.15, "triangle");
        }
        continue;
      }

      var ty = t.kind === "drone" ? t.y + Math.sin(t.age * 0.08) * 14 : t.y;
      var box = { x: t.x, y: ty, w: t.w, h: t.h };
      if (t.kind === "spike" || t.kind === "block" || t.kind === "drone") {
        box = { x: t.x + 5, y: ty + 5, w: t.w - 10, h: t.h - 10 };      // hazards are a bit forgiving too
      }

      if (!overlap(hit, box)) continue;

      if (t.kind === "star") {
        things.splice(i, 1); bonus += 50; starCount++;
        burst(t.x + 10, ty + 10, COLORS.sun, 8);
        blip(1040, 0.06, "triangle");
      } else if (t.kind === "shield") {
        things.splice(i, 1); shield = true;
        blip(700, 0.15, "triangle");
      } else if (shield) {              // a hazard: the shield takes the hit
        shield = false; things.splice(i, 1);
        flash = 0.7; shake = reduceMotion ? 0 : 8;
        burst(t.x + t.w / 2, ty + t.h / 2, COLORS.sky, 14);
        blip(300, 0.15, "sawtooth");
      } else {
        die();
        return;
      }
    }
  }

  /* ---------- Drawing ---------- */
  function starPath(cx, cy, r) {
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5;
      var rad = i % 2 ? r * 0.45 : r;
      if (i === 0) ctx.moveTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
      else ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
    }
    ctx.closePath();
  }

  function drawThing(t) {
    var y = t.kind === "drone" ? t.y + Math.sin(t.age * 0.08) * 14 : t.y;

    if (t.kind === "spike") {
      ctx.fillStyle = COLORS.pink;
      for (var i = 0; i < t.w / 26; i++) {
        var sx = t.x + i * 26;
        ctx.beginPath();
        if (t.lane === 1) { ctx.moveTo(sx, FLOOR); ctx.lineTo(sx + 13, FLOOR - t.h); ctx.lineTo(sx + 26, FLOOR); }
        else { ctx.moveTo(sx, CEIL); ctx.lineTo(sx + 13, CEIL + t.h); ctx.lineTo(sx + 26, CEIL); }
        ctx.closePath();
        ctx.fill();
      }

    } else if (t.kind === "block") {
      ctx.fillStyle = COLORS.sun;
      ctx.fillRect(t.x, t.y, t.w, t.h);
      ctx.strokeStyle = COLORS.ink; ctx.lineWidth = 3;
      ctx.strokeRect(t.x, t.y, t.w, t.h);
      ctx.beginPath();
      ctx.moveTo(t.x, t.y); ctx.lineTo(t.x + t.w, t.y + t.h);
      ctx.moveTo(t.x + t.w, t.y); ctx.lineTo(t.x, t.y + t.h);
      ctx.stroke();

    } else if (t.kind === "drone") {
      ctx.fillStyle = COLORS.lilac;
      ctx.fillRect(t.x, y + 8, t.w, t.h - 8);
      var blade = t.w * Math.abs(Math.cos(t.age * 0.6));      // spinning propeller
      ctx.fillStyle = COLORS.paper;
      ctx.fillRect(t.x + (t.w - blade) / 2, y + 3, blade, 3);
      ctx.fillStyle = COLORS.ink;
      ctx.beginPath(); ctx.arc(t.x + t.w / 2, y + 17, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = COLORS.pink;
      ctx.beginPath(); ctx.arc(t.x + t.w / 2, y + 17, 2, 0, Math.PI * 2); ctx.fill();

    } else if (t.kind === "portal") {
      var cx = t.x + t.w / 2;
      ctx.beginPath();
      ctx.ellipse(cx, MID, t.w / 2, t.h / 2, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(193,168,255,.18)";
      ctx.fill();
      for (var k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.ellipse(cx, MID, t.w / 2 - k * 5, t.h / 2 - k * 10, 0, 0, Math.PI * 2);
        ctx.strokeStyle = k === 1 ? COLORS.pink : COLORS.mint;
        ctx.lineWidth = 3;
        ctx.setLineDash([12, 8]);
        ctx.lineDashOffset = (k % 2 ? 1 : -1) * t.age * 1.5;
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.fillStyle = COLORS.paper;
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(t.dir === -1 ? "▲" : "▼", cx, MID);       // which way it will send you

    } else if (t.kind === "star") {
      ctx.fillStyle = COLORS.sun;
      starPath(t.x + 10, y + 10, 11 + Math.sin(t.age * 0.15) * 1.5);
      ctx.fill();

    } else if (t.kind === "shield") {
      ctx.beginPath();
      ctx.arc(t.x + 14, y + 14, 12, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(124,192,255,.3)";
      ctx.fill();
      ctx.strokeStyle = COLORS.sky; ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  function drawPlayer() {
    var cx = p.x + SIZE / 2, cy = p.y + SIZE / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.max(-0.4, Math.min(0.4, p.vy * 0.03)) * p.g);   // lean a little in the air
    ctx.beginPath();
    ctx.arc(0, 0, SIZE / 2, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.sun;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = COLORS.ink;
    ctx.stroke();
    ctx.fillStyle = COLORS.ink;
    ctx.font = "800 18px Unbounded, 'Arial Black', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("R", 0, 1);
    ctx.restore();

    if (shield) {
      ctx.beginPath();
      ctx.arc(cx, cy, SIZE / 2 + 7, 0, Math.PI * 2);
      ctx.strokeStyle = COLORS.sky;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  function draw() {
    ctx.save();
    if (shake > 0.5 && !reduceMotion) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

    // Sky
    var sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#1b0f36");
    sky.addColorStop(1, "#0b0618");
    ctx.fillStyle = sky;
    ctx.fillRect(-20, -20, W + 40, H + 40);

    // Background dots
    ctx.fillStyle = COLORS.paper;
    dots.forEach(function (d) {
      ctx.globalAlpha = d.a;
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Floor and ceiling
    ctx.fillStyle = "#2b1a47";
    ctx.fillRect(-20, FLOOR, W + 40, H - FLOOR + 20);
    ctx.fillRect(-20, -20, W + 40, CEIL + 20);
    ctx.strokeStyle = COLORS.mint;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, FLOOR); ctx.lineTo(W, FLOOR);
    ctx.moveTo(0, CEIL); ctx.lineTo(W, CEIL);
    ctx.stroke();
    ctx.fillStyle = "rgba(127,240,200,.35)";          // moving marks that show your speed
    for (var x = -(distance % 60); x < W; x += 60) {
      ctx.fillRect(x, FLOOR + 14, 24, 3);
      ctx.fillRect(x + 30, CEIL - 17, 24, 3);
    }

    things.forEach(drawThing);

    bits.forEach(function (b) {
      ctx.globalAlpha = Math.max(0, b.life / b.max);
      ctx.fillStyle = b.c;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    if (state !== "over") drawPlayer();

    if (flash > 0 && !reduceMotion) {
      ctx.fillStyle = "rgba(127,240,200," + (flash * 0.3) + ")";
      ctx.fillRect(-20, -20, W + 40, H + 40);
    }
    ctx.restore();

    // Score at the top
    ctx.fillStyle = COLORS.paper;
    ctx.font = "600 16px Figtree, system-ui, sans-serif";
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.fillText("Score " + score + "    ◆ " + starCount, 16, 28);
    ctx.textAlign = "right";
    ctx.fillText("Best " + best, W - 16, 28);

    // Messages
    if (state !== "playing") {
      ctx.fillStyle = "rgba(11,6,24,.6)";
      ctx.fillRect(0, MID - 52, W, 104);
      ctx.fillStyle = COLORS.paper;
      ctx.textAlign = "center";
      ctx.font = "800 26px Unbounded, 'Arial Black', sans-serif";
      ctx.fillText(state === "ready" ? "Portal Runner" : "Crashed!", W / 2, MID - 10);
      ctx.font = "600 16px Figtree, system-ui, sans-serif";
      ctx.fillText(state === "ready" ? "Press Space or tap to start" : "Score " + score + ". Tap or press Space to go again", W / 2, MID + 26);
    }
  }

  /* ---------- The game loop ---------- */
  var last = 0;
  function frame(now) {
    var dt = Math.min(2, (now - last) / 16.667 || 1);     // keeps speed steady on slow or fast screens
    last = now;

    if (state === "playing" && visible) update(dt);

    // Things that keep moving even when the game isn't running
    var drift = state === "playing" ? speed : 1.2;
    dots.forEach(function (d) {
      d.x -= drift * d.s * dt;
      if (d.x < 0) { d.x = W; d.y = Math.random() * H; }
    });
    for (var i = bits.length - 1; i >= 0; i--) {
      var b = bits[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0) bits.splice(i, 1);
    }
    flash = Math.max(0, flash - 0.05 * dt);
    shake *= 0.9;

    draw();
    requestAnimationFrame(frame);
  }

  /* ---------- Controls ---------- */
  canvas.addEventListener("pointerdown", function (event) {
    event.preventDefault();
    canvas.focus({ preventScroll: true });
    jump();
  });
  canvas.addEventListener("keydown", function (event) {
    if (event.key === " " || event.key === "ArrowUp" || event.key === "w" || event.key === "W") {
      event.preventDefault();          // stops the page scrolling when you press Space
      jump();
    }
  });

  $("gameStart").onclick = function () { start(); canvas.focus({ preventScroll: true }); };
  $("gameSound").onclick = function () {
    soundOn = !soundOn;
    $("gameSound").textContent = "Sound: " + (soundOn ? "on" : "off");
    blip(660, 0.1);
  };

  // Pause while the game is scrolled out of view
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
    }, { threshold: 0.3 }).observe(canvas);
  }

  reset();
  requestAnimationFrame(frame);
})();