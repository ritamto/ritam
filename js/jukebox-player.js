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
