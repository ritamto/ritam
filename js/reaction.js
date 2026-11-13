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
