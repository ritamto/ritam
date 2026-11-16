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
