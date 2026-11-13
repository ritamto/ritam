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
