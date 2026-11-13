// OVERTIME: a one-button runner through three muted worlds.
// This file is plain JavaScript on a canvas. React (app.js) only shows the score and buttons.

(function () {
  var W = 320, H = 180, GROUND = 150;     // a small canvas, scaled up by CSS for the pixel look

  // Each world has its colours and the obstacles it can throw at you.
  // air: true  = flies at head height, so duck under it (or jump over it)
  // air: false = sits on the ground, so jump it
  var WORLDS = [
    { name: "Office", bg: "#1f2329", far: "#282d35", ground: "#363c46", accent: "#6f9aa3", ink: "#aeb7c0",
      obs: [{ w: 16, h: 22 }, { w: 10, h: 14 }, { w: 14, h: 6, air: true }] },          // cubicle, chair, flying papers
    { name: "Server room", bg: "#0d110f", far: "#151c18", ground: "#1c251f", accent: "#5fa86a", ink: "#8fb596",
      obs: [{ w: 20, h: 6 }, { w: 12, h: 30 }, { w: 26, h: 3, air: true }] },           // cables, rack, laser
    { name: "Rooftop", bg: "#251f2e", far: "#2f2839", ground: "#3d3548", accent: "#c08a5a", ink: "#cdb7a4",
      obs: [{ w: 14, h: 12 }, { w: 4, h: 32 }, { w: 10, h: 6, air: true, fast: true }] } // vent, antenna, pigeon
  ];

  window.createRunner = function (canvas, onChange) {
    var ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    var calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var best = 0;
    try { best = Number(localStorage.getItem("overtime-best")) || 0; } catch (e) {}

    var status = "ready";                  // ready -> playing -> over
    var world = 0, spawnWorld = 0;         // the world you are in, and the one new obstacles come from
    var p, things, speed, dist, bonus, nextSpawn, nextPortal, boost, tick, fade, overAt;
    var duckHeld = false, sound = false, audio = null, last = 0, raf = 0;

    function reset() {
      p = { y: GROUND, vy: 0 };            // y is where the feet are
      things = []; speed = 2.4; dist = 0; bonus = 0; tick = 0; fade = 0; boost = 0;
      nextSpawn = 200; nextPortal = 1500;
      world = 0; spawnWorld = 0;
    }
    reset();

    function score() { return Math.floor(dist / 10) + bonus; }

    function notify() {
      onChange({ status: status, score: score(), best: best, world: WORLDS[world].name });
    }

    function beep(freq, length) {
      if (!sound) return;
      try {
        audio = audio || new (window.AudioContext || window.webkitAudioContext)();
        var osc = audio.createOscillator(), vol = audio.createGain();
        osc.type = "square"; osc.frequency.value = freq; vol.gain.value = 0.04;
        osc.connect(vol); vol.connect(audio.destination);
        osc.start(); osc.stop(audio.currentTime + length);
      } catch (e) {}
    }

    function start() { reset(); status = "playing"; notify(); }

    function die() {
      status = "over"; overAt = performance.now();
      if (score() > best) {
        best = score();
        try { localStorage.setItem("overtime-best", best); } catch (e) {}
      }
      beep(120, 0.35);
      notify();
    }

    function jump() {
      if (status !== "playing") {
        if (status === "ready" || performance.now() - overAt > 400) start();   // short pause so a panic tap doesn't restart
        return;
      }
      if (p.y >= GROUND) { p.vy = -6.2; beep(520, 0.07); }
    }

    /* ---------- spawning ---------- */
    function spawn() {
      var def = WORLDS[spawnWorld].obs[Math.floor(Math.random() * 3)];
      var pair = !def.air && def.w < 15 && Math.random() < 0.3 ? 2 : 1;       // sometimes two in a row
      things.push({ k: "obs", x: W + 10, w: def.w * pair, h: def.h, air: def.air, fast: def.fast, wi: spawnWorld });
      if (Math.random() < 0.18) things.push({ k: "coffee", x: W + 70, w: 8, h: 8 });
      nextSpawn = speed * 34 + 50 + Math.random() * 70;
    }

    function spawnPortal() {
      spawnWorld = (spawnWorld + 1) % WORLDS.length;
      things.push({ k: "portal", x: W + 10, w: 10, h: 60, c: WORLDS[spawnWorld].accent });
      nextPortal += 2200;
      nextSpawn = 140;
    }

    /* ---------- one step of the game ---------- */
    function hit(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
    function topOf(t) { return t.air ? GROUND - 17 : GROUND - t.h; }

    function update(dt) {
      tick += dt;
      speed = Math.min(5.2, 2.4 + dist / 4000) * (boost > 0 ? 1.4 : 1);
      var move = speed * dt;
      dist += move;
      boost = Math.max(0, boost - dt);

      // gravity, with a faster fall if you hold duck in the air
      p.vy += (0.38 + (duckHeld && p.y < GROUND ? 0.5 : 0)) * dt;
      p.y = Math.min(GROUND, p.y + p.vy * dt);
      if (p.y === GROUND) p.vy = 0;

      nextSpawn -= move;
      if (dist >= nextPortal) spawnPortal();
      else if (nextSpawn <= 0) spawn();

      var ducking = duckHeld && p.y >= GROUND;
      var ph = ducking ? 10 : 18, pw = ducking ? 12 : 10;
      var box = { x: 42, y: p.y - ph + 2, w: pw - 4, h: ph - 3 };               // slightly forgiving hitbox

      for (var i = things.length - 1; i >= 0; i--) {
        var t = things[i];
        t.x -= move * (t.fast ? 1.35 : 1);
        if (t.x + t.w < -20) { things.splice(i, 1); continue; }

        if (t.k === "portal") {
          if (!t.used && t.x + t.w / 2 <= 45) {
            t.used = true; world = (world + 1) % WORLDS.length; bonus += 50;
            fade = calm ? 0 : 1; beep(880, 0.2); notify();
          }
        } else if (t.k === "coffee") {
          if (hit(box, { x: t.x, y: GROUND - 30, w: t.w, h: t.h })) {
            things.splice(i, 1); boost = 300; bonus += 20; beep(1040, 0.1);
          }
        } else if (boost <= 0 && hit(box, { x: t.x + 1, y: topOf(t) + 1, w: t.w - 2, h: t.h - 1 })) {
          die(); return;
        }
      }
      if (Math.floor(tick) % 6 === 0) notify();
    }

    /* ---------- drawing ---------- */
    function say(text, y, size, color) {
      ctx.fillStyle = color; ctx.textAlign = "center";
      ctx.font = size + "px 'Press Start 2P', monospace";
      ctx.fillText(text, W / 2, y);
    }

    function draw() {
      var w = WORLDS[world], i, x;
      ctx.fillStyle = w.bg; ctx.fillRect(0, 0, W, H);

      // far skyline, scrolling slowly
      var step = Math.floor(dist * 0.25 / 40), off = (dist * 0.25) % 40;
      for (i = -1; i < 9; i++) {
        var bh = 30 + (Math.abs((i + step) * 37) % 5) * 12;
        ctx.fillStyle = w.far; ctx.fillRect(i * 40 - off, GROUND - bh, 32, bh);
        ctx.globalAlpha = 0.2; ctx.fillStyle = w.accent;
        ctx.fillRect(i * 40 - off + 6, GROUND - bh + 8, 4, 4);
        ctx.globalAlpha = 1;
      }

      // ground
      ctx.fillStyle = w.ground; ctx.fillRect(0, GROUND, W, H - GROUND);
      ctx.fillStyle = w.accent; ctx.fillRect(0, GROUND, W, 1);
      ctx.fillStyle = w.bg;
      for (x = -(dist % 16); x < W; x += 16) ctx.fillRect(x, GROUND + 10, 6, 1);

      // things
      things.forEach(function (t) {
        var o = WORLDS[t.wi || 0], y = topOf(t);
        if (t.k === "obs") {
          ctx.fillStyle = t.air ? o.accent : o.ink; ctx.fillRect(t.x, y, t.w, t.h);
          if (!t.air) { ctx.fillStyle = o.accent; ctx.fillRect(t.x, y, t.w, 2); }
        } else if (t.k === "coffee") {
          ctx.fillStyle = "#a9876a"; ctx.fillRect(t.x, GROUND - 30, 6, 7); ctx.fillRect(t.x + 6, GROUND - 28, 2, 3);
          ctx.fillStyle = "#7d8790"; ctx.fillRect(t.x + 2, GROUND - 34 - (Math.floor(tick / 10) % 2), 1, 3);   // steam
        } else {
          ctx.fillStyle = t.c; ctx.fillRect(t.x, GROUND - t.h, t.w, 2); ctx.fillRect(t.x, GROUND - t.h, 2, t.h); ctx.fillRect(t.x + t.w - 2, GROUND - t.h, 2, t.h);
          ctx.globalAlpha = 0.18 + 0.14 * Math.sin(tick / 6); ctx.fillRect(t.x + 2, GROUND - t.h + 2, t.w - 4, t.h - 2);
          ctx.globalAlpha = 1;
        }
      });

      // the player: a tiny office worker
      var ducking = duckHeld && p.y >= GROUND && status === "playing";
      if (status !== "over" && !(boost > 0 && Math.floor(tick / 4) % 2)) {
        var px = 40, py = p.y, stride = Math.floor(dist / 6) % 2;
        if (ducking) {
          ctx.fillStyle = "#8aa0b0"; ctx.fillRect(px, py - 10, 12, 7);
          ctx.fillStyle = "#d8b79a"; ctx.fillRect(px + 7, py - 10, 5, 5);
        } else {
          ctx.fillStyle = "#3a414d"; ctx.fillRect(px + 1, py - 4, 3, 4); ctx.fillRect(px + 6, py - 4 + (p.y < GROUND ? 0 : stride * -1), 3, 4);
          ctx.fillStyle = "#8aa0b0"; ctx.fillRect(px, py - 14, 10, 10);
          ctx.fillStyle = w.accent; ctx.fillRect(px + 6, py - 13, 1, 6);                 // tie
          ctx.fillStyle = "#d8b79a"; ctx.fillRect(px + 2, py - 20, 6, 6);
        }
      }

      // world change flash, and the coffee timer bar
      if (fade > 0) { ctx.globalAlpha = fade * 0.35; ctx.fillStyle = w.accent; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
      if (boost > 0) { ctx.fillStyle = "#a9876a"; ctx.fillRect(6, 6, boost / 6, 3); }

      if (status === "ready") { say("OVERTIME", 80, 16, w.ink); say("PRESS SPACE OR TAP", 104, 7, w.accent); }
      if (status === "over") { say("CLOCKED OUT", 80, 14, w.ink); say("SPACE OR TAP TO RETRY", 104, 7, w.accent); }
    }

    function frame(now) {
      var dt = Math.min(2, (now - last) / 16.667 || 1);
      last = now;
      if (status === "playing") update(dt);
      fade = Math.max(0, fade - 0.04 * dt);
      draw();
      raf = requestAnimationFrame(frame);
    }

    /* ---------- controls ---------- */
    function onKeyDown(e) {
      var k = e.key;
      if (k === " " || k === "ArrowUp" || k === "w" || k === "W") { e.preventDefault(); if (!e.repeat) jump(); }
      if (k === "ArrowDown" || k === "s" || k === "S") { e.preventDefault(); duckHeld = true; }
    }
    function onKeyUp(e) {
      if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") duckHeld = false;
    }
    function onPointerDown(e) {                    // tap the top of the screen to jump, hold the bottom to duck
      e.preventDefault();
      var r = canvas.getBoundingClientRect();
      if (status === "playing" && (e.clientY - r.top) / r.height > 0.6) duckHeld = true; else jump();
    }
    function onPointerUp() { duckHeld = false; }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);

    raf = requestAnimationFrame(frame);
    notify();

    return {
      start: start,
      setSound: function (on) { sound = on; beep(660, 0.08); },
      destroy: function () {
        cancelAnimationFrame(raf);
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        canvas.removeEventListener("pointerdown", onPointerDown);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerUp);
      }
    };
  };
})();
