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
