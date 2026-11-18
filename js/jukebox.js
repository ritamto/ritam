/* =====================================================
   8. JUKEBOX (YouTube Music-Only + Floating Mini-Player)
   ===================================================== */
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

// Ask our own /api/youtube function (it holds the API key, not the browser)
function searchMusic(query) {
  query = query.trim();
  if (!query) { say("Type an artist or a song first."); return; }
  say("Searching...");

  fetch("/api/youtube?q=" + encodeURIComponent(query))
    .then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) {
        if (!response.ok) {
          var error = new Error("HTTP " + response.status);
          error.status = response.status;
          error.reason = data.error && data.error.reason;
          throw error;
        }
        return data;
      });
    })
    .then(function (data) {
      songs = (data.songs || []).map(function (song) {
        return {
          videoId: song.videoId,
          trackName: cleanTitle(song.title),
          artistName: song.channelTitle.replace(" - Topic", ""),
          channelTitle: song.channelTitle,
          artworkUrl: song.artworkUrl
        };
      });
      showSongs();
      say(songs.length ? songs.length + " tracks found. Click one to play." : "Nothing found. Try another search.");
    })
    .catch(function (err) {
      console.error("YouTube search error:", err);
      if (err.reason === "missingKey") {
        say("The server has no YOUTUBE_API_KEY set. Add it in the Vercel project settings.");
      } else if (err.reason === "ACCESS_DENIED" || err.reason === "forbidden") {
        say("YouTube API access denied. Enable YouTube Data API v3 for the key's Google Cloud project and check its API restrictions.");
      } else if (err.reason === "quotaExceeded" || err.reason === "dailyLimitExceeded") {
        say("YouTube API quota reached. Try again after the quota resets.");
      } else if (err.status === 404) {
        say("Search service not found. Run the site with 'vercel dev' or deploy it.");
      } else if (err.status) {
        say("YouTube search failed (HTTP " + err.status + "). Check the browser console for details.");
      } else {
        say("Couldn't connect. Check your internet connection.");
      }
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
