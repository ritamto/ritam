// Shortcut: $("id") instead of document.getElementById("id")
function $(id) { return document.getElementById(id); }

var barrier = $("barrier");
var expandButton = $("expand");
var releaseButton = $("release");
var soundButton = $("sound");

// "closed" -> "busy" (while the animation plays) -> "open" -> back to "closed"
var state = "closed";
var soundOn = false;
var audio = null;

// People who turned off animations in their device settings get a quick fade instead
var calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;


/* =====================================================
   SOUND: a deep boom made in code, so there is nothing to download
   ===================================================== */
function boom() {
  if (!soundOn) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    var t = audio.currentTime;

    // 1. A low tone that drops in pitch
    var tone = audio.createOscillator();
    var toneVolume = audio.createGain();
    tone.type = "sine";
    tone.frequency.setValueAtTime(140, t);
    tone.frequency.exponentialRampToValueAtTime(30, t + 1.4);
    toneVolume.gain.setValueAtTime(0.0001, t);
    toneVolume.gain.exponentialRampToValueAtTime(0.5, t + 0.05);
    toneVolume.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    tone.connect(toneVolume).connect(audio.destination);
    tone.start(t);
    tone.stop(t + 1.7);

    // 2. A rumble made from filtered noise that fades out
    var length = audio.sampleRate * 1.5;
    var buffer = audio.createBuffer(1, length, audio.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    var noise = audio.createBufferSource();
    var filter = audio.createBiquadFilter();
    var noiseVolume = audio.createGain();
    noise.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.value = 300;
    noiseVolume.gain.value = 0.25;
    noise.connect(filter).connect(noiseVolume).connect(audio.destination);
    noise.start(t);
  } catch (e) {}
}

soundButton.onclick = function () {
  soundOn = !soundOn;
  soundButton.textContent = "Sound: " + (soundOn ? "on" : "off");
  soundButton.setAttribute("aria-pressed", soundOn ? "true" : "false");
};


/* =====================================================
   THE EXPANSION
   ===================================================== */
function expand() {
  if (state !== "closed") return;
  state = "busy";

  document.body.classList.add("casting");     // flash and shake
  boom();

  // After the flash, open the barrier
  setTimeout(function () {
    document.body.classList.remove("casting");
    barrier.classList.add("open");
    barrier.inert = false;                    // lets keyboard users reach the links
  }, calm ? 150 : 1000);

  // Once everything has faded in, hand over control
  setTimeout(function () {
    state = "open";
    releaseButton.focus();
  }, calm ? 700 : 2400);
}

function release() {
  if (state !== "open") return;
  state = "closed";
  barrier.classList.remove("open");
  barrier.inert = true;
  expandButton.focus();
}

expandButton.onclick = expand;
releaseButton.onclick = release;
document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") release();      // Escape also lets you out
});