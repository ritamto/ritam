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
