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
