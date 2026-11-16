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
