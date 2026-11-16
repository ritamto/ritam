/* =====================================================
   COIN FAVICON
   Stays still. Flips once when someone clicks "Flip a coin".
   ===================================================== */
(function () {
  var link = document.getElementById("favicon");
  if (!link) return;

  var canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  var pen = canvas.getContext("2d");

  // The same R shape as in favicon.svg
  var letterR = new Path2D(
    "M16 12H38C48 12 52 18 52 25C52 31 48 35 42 36L53 52H40L31 37H28V52H16Z" +
    "M28 22V30H37C40 30 41 28 41 26C41 24 40 22 37 22Z"
  );

  // Draw the coin squashed sideways by "squash" (1 = full width, 0.06 = edge-on)
  function drawCoin(squash) {
    pen.clearRect(0, 0, 64, 64);
    pen.save();
    pen.translate(32, 32);
    pen.scale(squash, 1);

    pen.beginPath();
    pen.arc(0, 0, 29, 0, Math.PI * 2);
    pen.fillStyle = "#ffd84d";
    pen.fill();
    pen.lineWidth = 4;
    pen.strokeStyle = "#1d1230";
    pen.stroke();

    pen.beginPath();
    pen.arc(0, 0, 22, 0, Math.PI * 2);
    pen.lineWidth = 2;
    pen.setLineDash([3, 3]);
    pen.stroke();
    pen.setLineDash([]);

    pen.rotate(-5 * Math.PI / 180);
    pen.scale(0.62, 0.62);
    pen.translate(-34.5, -32);
    pen.fillStyle = "#1d1230";
    pen.fill(letterR, "evenodd");

    pen.restore();
  }

  var flipping = false;

  function flipFavicon() {
    if (flipping || reduceMotion) return;     // one flip at a time, and none if animations are off
    flipping = true;

    var duration = 1400;                      // how long one flip lasts (milliseconds)
    var begin = Date.now();
    var last = -1;

    var timer = setInterval(function () {
      var p = Math.min(1, (Date.now() - begin) / duration);   // 0 to 1

      if (p >= 1) {
        // Done: go back to the normal still icon
        clearInterval(timer);
        link.type = "image/svg+xml";
        link.href = "favicon.svg";
        flipping = false;
        return;
      }

      // Two spins: the coin goes edge-on twice, then lands face-up
      var squash = Math.max(0.06, Math.abs(Math.cos(p * 4 * Math.PI)));
      squash = Math.round(squash * 20) / 20;
      if (squash === last) return;
      last = squash;

      drawCoin(squash);
      link.type = "image/png";
      link.href = canvas.toDataURL("image/png");
    }, 60);
  }

  // Runs in addition to the Decider's own "Flip a coin" code, so you don't need to change that
  $("flip").addEventListener("click", flipFavicon);
})();
