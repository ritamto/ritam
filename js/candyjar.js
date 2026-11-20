// ============================================================
// CANDY JAR
// Visitors leave a thought and it becomes a candy in a 3D glass jar.
// Click the jar: the lid pops off and tumbles onto the other cards.
//
// How it works:
//  - Three.js draws the jar on one transparent canvas that sits on top of the
//    grid (it ignores clicks, so the other toys still work underneath).
//  - cannon-es is the physics: one tiny world for the candies inside the jar,
//    and another for the lid, where every card is an invisible shelf.
//  - /api/candies (see api/candies.js) stores the thoughts.
//  - Three.js and cannon-es only download when the jar scrolls into view.
// ============================================================
(function () {
  var tile = $("jarTile");
  if (!tile) return;
  var grid = tile.parentNode;

  var THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
  var CANNON_URL = "https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js";
  var API = "/api/candies";
  var MAX_CANDIES = 90;     // most candies drawn in the jar at once
  var POLL_MS = 30000;      // how often to look for new candies from other visitors

  var PALETTE = [0xff4d6d, 0xff9f1c, 0xffd84d, 0x4dabf7, 0x9b5de5, 0xff8fb7];
  var COLOR_NAMES = ["Red", "Orange", "Yellow", "Blue", "Purple", "Pink"];
  var SHAPE_NAMES = ["Gumball", "Wrapped", "Jellybean", "Lollipop"];

  // Shown only when the server isn't connected (for example when testing locally)
  var SEEDS = [
    { id: "s1", name: "Ritam", msg: "Welcome! Leave a thought and it turns into a candy.", color: 2, shape: 0, t: Date.now() - 86400000 * 3 },
    { id: "s2", name: "A friend", msg: "Remember to drink some water today.", color: 3, shape: 1, t: Date.now() - 86400000 * 2 },
    { id: "s3", name: "Someone", msg: "The 8-ball said yes. I regret nothing.", color: 0, shape: 2, t: Date.now() - 3600000 * 30 },
    { id: "s4", name: "Anonymous", msg: "Good little corner of the internet.", color: 5, shape: 3, t: Date.now() - 3600000 * 9 },
    { id: "s5", name: "Visitor", msg: "I came for the jukebox and stayed for the jar.", color: 4, shape: 0, t: Date.now() - 3600000 * 2 }
  ];

  // ---------- page elements ----------
  var slot = $("jarSlot");
  var note = $("jarNote");
  var form = $("jarForm");
  var statusEl = $("jarStatus");
  var listEl = $("jarList");
  var totalEl = $("jarTotal");
  var msgEl = $("jarMsg");
  var countEl = $("jarCountText");
  var sendBtn = $("jarSend");

  // ---------- state ----------
  var candies = [];          // oldest first: { id, name, msg, color, shape, t }
  var seen = {};             // ids we already have
  var view = null;           // the 3D jar once it is ready (stays null if it can't load)
  var isOpen = false;
  var demoMode = false;
  var inView = false;
  var started = false;
  var pickColor = Math.floor(Math.random() * PALETTE.length);
  var pickShape = Math.floor(Math.random() * SHAPE_NAMES.length);

  // ============================================================
  // Small helpers
  // ============================================================
  function clean(text) {
    return String(text || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  }

  function clampInt(value, max) {
    value = parseInt(value, 10);
    return value >= 0 && value < max ? value : 0;
  }

  function normalize(c) {
    return {
      id: String(c.id),
      name: clean(c.name).slice(0, 24),
      msg: clean(c.msg).slice(0, 160),
      color: clampInt(c.color, PALETTE.length),
      shape: clampInt(c.shape, SHAPE_NAMES.length),
      t: Number(c.t) || Date.now()
    };
  }

  function timeAgo(t) {
    var s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60) return "just now";
    var m = s / 60;
    if (m < 60) return Math.floor(m) + "m ago";
    var h = m / 60;
    if (h < 24) return Math.floor(h) + "h ago";
    return Math.floor(h / 24) + "d ago";
  }

  function setStatus(text) { statusEl.textContent = text; }

  function readLocal() {
    try { return JSON.parse(memory.get("ritam.jar.local") || "[]"); } catch (e) { return []; }
  }

  function saveLocal(candy) {
    var list = readLocal();
    list.push(candy);
    memory.set("ritam.jar.local", JSON.stringify(list.slice(-30)));
  }

  // ============================================================
  // Data: candies, the list under the jar, the note when you poke one
  // ============================================================
  function addCandies(list, drop) {
    var added = 0;
    list.forEach(function (c) {
      if (seen[c.id]) return;
      seen[c.id] = true;
      c.drop = !!drop;      // true = fell in through the open lid
      candies.push(c);
      added++;
    });
    if (!added) return;
    while (candies.length > 200) {
      var old = candies.shift();
      if (view && old.body) view.remove(old);
    }
    syncView();
    renderList();
  }

  function syncView() {
    if (!view) return;
    candies.slice(-MAX_CANDIES).forEach(function (c) {
      if (c.queued) return;
      c.queued = true;
      view.enqueue(c, c.drop && isOpen);
    });
  }

  function renderList() {
    listEl.textContent = "";
    candies.slice().sort(function (a, b) { return b.t - a.t; }).slice(0, 15).forEach(function (c) {
      var li = document.createElement("li");
      var who = document.createElement("strong");
      who.textContent = c.name || "Anonymous";
      var when = document.createElement("span");
      when.className = "small";
      when.textContent = " · " + timeAgo(c.t);
      var text = document.createElement("div");
      text.textContent = c.msg;        // textContent only, so nobody can sneak HTML in
      li.appendChild(who);
      li.appendChild(when);
      li.appendChild(text);
      listEl.appendChild(li);
    });
    totalEl.textContent = candies.length + (candies.length === 1 ? " candy" : " candies");
  }

  function showCandy(c, pop) {
    note.hidden = false;
    note.textContent = "\u201c" + c.msg + "\u201d \u2014 " + (c.name || "Anonymous");
    if (pop && view) view.pop(c);
  }

  function loadData() {
    return fetch(API)
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        var list = (data.candies || []).map(normalize).reverse();   // server sends newest first
        addCandies(list, false);
        if (!list.length) setStatus("The jar is empty. Be the first to add a candy!");
      })
      .catch(function () {
        demoMode = true;
        addCandies(SEEDS.concat(readLocal()).map(normalize), false);
        setStatus("Couldn\u2019t reach the jar\u2019s server, so this is a demo jar only you can see.");
      });
  }

  function poll() {
    if (demoMode || !inView || document.hidden) return;
    fetch(API)
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        if (!data) return;
        addCandies((data.candies || []).map(normalize).reverse(), true);
      })
      .catch(function () {});
  }

  // ============================================================
  // The form
  // ============================================================
  function buildPickers() {
    var colors = $("jarColors");
    var shapes = $("jarShapes");

    PALETTE.forEach(function (hex, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "swatch";
      b.style.background = "#" + ("000000" + hex.toString(16)).slice(-6);
      b.setAttribute("aria-label", COLOR_NAMES[i]);
      b.setAttribute("aria-pressed", String(i === pickColor));
      b.addEventListener("click", function () {
        pickColor = i;
        Array.prototype.forEach.call(colors.children, function (el, j) {
          el.setAttribute("aria-pressed", String(j === i));
        });
      });
      colors.appendChild(b);
    });

    SHAPE_NAMES.forEach(function (name, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.textContent = name;
      b.setAttribute("aria-pressed", String(i === pickShape));
      b.addEventListener("click", function () {
        pickShape = i;
        Array.prototype.forEach.call(shapes.children, function (el, j) {
          el.setAttribute("aria-pressed", String(j === i));
        });
      });
      shapes.appendChild(b);
    });
  }

  function openJar() {
    if (isOpen) return;
    isOpen = true;
    slot.classList.add("open");
    slot.setAttribute("aria-label", "Candy jar, open. Poke a candy to read it.");
    form.hidden = false;
    setStatus("");
    if (view) view.openLid();
    setTimeout(function () { try { msgEl.focus({ preventScroll: true }); } catch (e) {} }, 350);
  }

  function closeJar() {
    if (!isOpen) return;
    isOpen = false;
    slot.classList.remove("open");
    slot.setAttribute("aria-label", "Candy jar. Press to open it and add a thought.");
    form.hidden = true;
    if (view) view.closeLid();
  }

  function submit() {
    var msg = clean(msgEl.value);
    var name = clean($("jarName").value);
    if (!msg) { setStatus("Write a little something first."); msgEl.focus(); return; }

    sendBtn.disabled = true;
    setStatus("Dropping it in\u2026");

    fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name, msg: msg, color: pickColor, shape: pickShape,
        website: $("jarWebsite").value          // hidden field, bots fill it in
      })
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) { return { res: res, data: data }; });
      })
      .then(function (o) {
        if (o.res.status === 429) { setStatus("Easy there! One candy every 30 seconds."); return; }
        if (o.res.status === 400) {
          setStatus(o.data.error === "links" ? "Links aren\u2019t allowed in the jar, sorry." : "That didn\u2019t look right. Try changing the text.");
          return;
        }

        var candy;
        if (o.res.ok) {
          candy = o.data.candy ? normalize(o.data.candy) : null;
        } else if (demoMode || [404, 405, 501, 503].indexOf(o.res.status) >= 0) {
          // No server yet (local testing): keep the candy on this device only
          demoMode = true;
          candy = normalize({ id: "L" + Date.now(), name: name, msg: msg, color: pickColor, shape: pickShape, t: Date.now() });
          saveLocal(candy);
        } else {
          throw new Error("HTTP " + o.res.status);
        }

        if (candy) addCandies([candy], true);
        msgEl.value = "";
        countEl.textContent = "0 / 160";
        setStatus(demoMode ? "In it goes! (Demo jar: only you can see it.)" : "In it goes! Thanks for stopping by.");
        setTimeout(closeJar, 1500);     // let the candy fall in first
      })
      .catch(function () {
        setStatus("Couldn\u2019t reach the jar. Try again in a bit.");
      })
      .then(function () { sendBtn.disabled = false; });
  }

  buildPickers();

  form.addEventListener("submit", function (e) { e.preventDefault(); submit(); });
  $("jarCancel").addEventListener("click", closeJar);
  $("jarAdd").addEventListener("click", function () { isOpen ? closeJar() : openJar(); });
  msgEl.addEventListener("input", function () { countEl.textContent = msgEl.value.length + " / 160"; });

  $("jarPull").addEventListener("click", function () {
    if (!candies.length) { setStatus("The jar is empty. Be the first to add a candy!"); return; }
    showCandy(candies[Math.floor(Math.random() * candies.length)], true);
  });

  slot.addEventListener("click", function (e) {
    if (!isOpen) { openJar(); return; }
    var c = view && view.pick(e.clientX, e.clientY);
    if (c) showCandy(c, true);
  });

  slot.addEventListener("keydown", function (e) {
    if ((e.key === "Enter" || e.key === " ") && !isOpen) { e.preventDefault(); openJar(); }
  });

  slot.addEventListener("pointermove", function (e) {
    if (!isOpen || !view) return;
    slot.style.cursor = view.pick(e.clientX, e.clientY) ? "pointer" : "default";
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && isOpen) closeJar();
  });

  // Clicking the lid where it landed puts it back on the jar
  document.addEventListener("click", function (e) {
    if (view && view.lidHit(e.clientX, e.clientY)) {
      e.stopPropagation();
      e.preventDefault();
      closeJar();
    }
  }, true);

  // ============================================================
  // Start only when the jar is near the screen
  // ============================================================
  function start() {
    if (started) return;
    started = true;
    loadData().then(syncView);
    init3D()
      .then(function (v) { view = v; syncView(); })
      .catch(function (err) {
        console.warn("Candy jar: 3D view unavailable, using the list only.", err);
        slot.classList.add("fallback");
        slot.textContent = "\ud83c\udf6c";
      });
  }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      inView = entries[0].isIntersecting;
      if (inView) start();
    }, { rootMargin: "300px" }).observe(tile);
  } else {
    inView = true;
    start();
  }
  setInterval(poll, POLL_MS);

  // ============================================================
  // The 3D jar. Returns a small object the code above talks to.
  // ============================================================
  function init3D() {
    return Promise.all([import(THREE_URL), import(CANNON_URL)]).then(function (mods) {
      var THREE = mods[0];
      var CANNON = mods[1];

      var K = 0.1;                       // physics units per pixel
      var GRAVITY = -150;                // physics units per second squared
      var R = 64, BODY_H = 170, NECK_R = 44;
      var TOTAL = BODY_H + 38, HALF = TOTAL / 2;   // jar is drawn centred on its middle
      var CANDY_R = 12, DEPTH = 42;      // candy radius, half the jar's front-to-back room
      var LID_R = NECK_R + 5, LID_T = 12;
      var TILT = 0.3;                    // look slightly down into the jar
      var HEAD = 200;                    // canvas space above the jar's card, for the lid to fly into
      var INSET = 34;                    // lid lands this far below a card's top edge
      var W = 100, H = 100, k = 1;       // canvas size and jar scale

      // ---------- renderer, camera, lights ----------
      var renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });   // throws if WebGL is missing
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x000000, 0);
      var canvas = renderer.domElement;
      canvas.id = "jarCanvas";
      canvas.setAttribute("aria-hidden", "true");
      grid.appendChild(canvas);

      var scene = new THREE.Scene();
      var camera = new THREE.OrthographicCamera(0, W, 0, -H, 0.1, 2000);
      camera.position.z = 1000;
      scene.add(new THREE.AmbientLight(0xffffff, 1.6));
      var sun = new THREE.DirectionalLight(0xffffff, 2.4);
      sun.position.set(-200, 300, 500);
      scene.add(sun);

      // ---------- the glass jar ----------
      var jar = new THREE.Group();
      jar.rotation.x = TILT;
      scene.add(jar);

      function jarProfile() {
        var pts = [new THREE.Vector2(0.01, 0)];
        var i, a, t, u;
        for (i = 0; i <= 8; i++) {                                   // rounded bottom corner
          a = (i / 8) * Math.PI / 2;
          pts.push(new THREE.Vector2(R - 14 + 14 * Math.sin(a), 14 - 14 * Math.cos(a)));
        }
        pts.push(new THREE.Vector2(R, BODY_H));                      // straight side
        for (i = 1; i <= 10; i++) {                                  // curved shoulder into the neck
          t = i / 10; u = 1 - t;
          pts.push(new THREE.Vector2(
            u * u * u * R + 3 * u * u * t * R + 3 * u * t * t * NECK_R + t * t * t * NECK_R,
            BODY_H + 3 * u * u * t * 26 + 3 * u * t * t * 8 + t * t * t * 32
          ));
        }
        pts.push(new THREE.Vector2(NECK_R + 3, BODY_H + 32));        // lip
        pts.push(new THREE.Vector2(NECK_R + 3, BODY_H + 38));
        pts.push(new THREE.Vector2(NECK_R, BODY_H + 38));
        return pts;
      }

      var glassGeo = new THREE.LatheGeometry(jarProfile(), 56);
      glassGeo.translate(0, -HALF, 0);
      var glassMesh = new THREE.Mesh(glassGeo, new THREE.MeshPhysicalMaterial({
        color: 0xdff3ff, transparent: true, opacity: 0.2, roughness: 0.08,
        clearcoat: 1, side: THREE.DoubleSide, depthWrite: false
      }));
      jar.add(glassMesh);

      // Two white strips fake the shine on the glass
      var shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.38, depthWrite: false });
      var shineA = new THREE.Mesh(new THREE.PlaneGeometry(9, BODY_H * 0.72), shineMat);
      shineA.position.set(-R * 0.62, -HALF + BODY_H * 0.48, R * 0.8);
      var shineB = new THREE.Mesh(new THREE.PlaneGeometry(4, BODY_H * 0.45), shineMat);
      shineB.position.set(-R * 0.4, -HALF + BODY_H * 0.4, R * 0.85);
      jar.add(shineA);
      jar.add(shineB);

      var candyGroup = new THREE.Group();
      jar.add(candyGroup);

      // Soft blob shadow on the card under the jar
      var shadowCanvas = document.createElement("canvas");
      shadowCanvas.width = shadowCanvas.height = 128;
      var sg = shadowCanvas.getContext("2d");
      var grad = sg.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, "rgba(29,18,48,0.45)");
      grad.addColorStop(1, "rgba(29,18,48,0)");
      sg.fillStyle = grad;
      sg.fillRect(0, 0, 128, 128);
      var shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false })
      );
      shadow.position.z = -50;
      scene.add(shadow);

      // ---------- the lid ----------
      var lidPivot = new THREE.Group();
      lidPivot.rotation.x = TILT;
      scene.add(lidPivot);
      var lidInner = new THREE.Group();
      lidPivot.add(lidInner);
      var lidMat = new THREE.MeshStandardMaterial({ color: 0xffc83d, metalness: 0.4, roughness: 0.35 });
      lidInner.add(new THREE.Mesh(new THREE.CylinderGeometry(LID_R, LID_R, LID_T, 40), lidMat));
      var knob = new THREE.Mesh(new THREE.CylinderGeometry(9, 11, 9, 24), lidMat);
      knob.position.y = LID_T / 2 + 4.5;
      lidInner.add(knob);

      // ---------- candy looks ----------
      var geos = {
        sphere: new THREE.SphereGeometry(CANDY_R, 24, 16),
        bean: new THREE.SphereGeometry(8.5, 20, 14),
        wrapBody: new THREE.SphereGeometry(7.5, 20, 14),
        cone: new THREE.ConeGeometry(5.5, 7, 14),
        disc: new THREE.CylinderGeometry(11, 11, 5, 28),
        stick: new THREE.CylinderGeometry(1.6, 1.6, 12, 8)
      };
      var wrapperMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, transparent: true, opacity: 0.9 });
      var stickMat = new THREE.MeshStandardMaterial({ color: 0xf6f3ff, roughness: 0.6 });
      var candyMats = PALETTE.map(function (hex) {
        return new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15 });
      });

      function buildCandyMesh(c) {
        var g = new THREE.Group();
        var mat = candyMats[c.color];
        var m;
        if (c.shape === 0) {                                   // gumball
          g.add(new THREE.Mesh(geos.sphere, mat));
        } else if (c.shape === 1) {                            // wrapped sweet
          m = new THREE.Mesh(geos.wrapBody, mat);
          m.scale.set(1.25, 0.95, 0.95);
          g.add(m);
          [-1, 1].forEach(function (s) {
            var cone = new THREE.Mesh(geos.cone, wrapperMat);
            cone.rotation.z = s * Math.PI / 2;
            cone.position.x = s * 13;
            g.add(cone);
          });
        } else if (c.shape === 2) {                            // jellybean
          m = new THREE.Mesh(geos.bean, mat);
          m.scale.set(1.4, 1, 0.9);
          g.add(m);
        } else {                                               // lollipop
          m = new THREE.Mesh(geos.disc, mat);
          m.rotation.x = Math.PI / 2;
          g.add(m);
          var stick = new THREE.Mesh(geos.stick, stickMat);
          stick.position.y = -10;
          g.add(stick);
        }
        g.userData.candy = c;
        return g;
      }

      // ---------- physics: candies inside the jar ----------
      var candyWorld = new CANNON.World({ gravity: new CANNON.Vec3(0, GRAVITY, 0) });
      candyWorld.allowSleep = true;
      var candyPhys = new CANNON.Material("candy");
      var glassPhys = new CANNON.Material("glass");
      candyWorld.addContactMaterial(new CANNON.ContactMaterial(candyPhys, candyPhys, { friction: 0.3, restitution: 0.25 }));
      candyWorld.addContactMaterial(new CANNON.ContactMaterial(candyPhys, glassPhys, { friction: 0.25, restitution: 0.2 }));

      function wall(x, y, z, rx, ry, rz) {
        var b = new CANNON.Body({ mass: 0, material: glassPhys });
        b.addShape(new CANNON.Plane());
        b.position.set(x, y, z);
        b.quaternion.setFromEuler(rx, ry, rz);
        candyWorld.addBody(b);
      }
      var wallX = (R - 4) * K, wallZ = DEPTH * K;
      wall(0, (-HALF + 3) * K, 0, -Math.PI / 2, 0, 0);   // floor
      wall(-wallX, 0, 0, 0, Math.PI / 2, 0);             // left
      wall(wallX, 0, 0, 0, -Math.PI / 2, 0);             // right
      wall(0, 0, -wallZ, 0, 0, 0);                       // back
      wall(0, 0, wallZ, 0, Math.PI, 0);                  // front

      var live = [];       // candies that currently exist in the 3D jar, oldest first
      var queue = [];      // candies waiting to be dropped in
      var nextSpawn = 0;

      function spawnNow(entry) {
        var c = entry.c;
        if (c.body) return;
        if (live.length >= MAX_CANDIES) removeCandy(live[0]);
        var body = new CANNON.Body({
          mass: 1, material: candyPhys, shape: new CANNON.Sphere(CANDY_R * K),
          linearDamping: 0.12, angularDamping: 0.35,
          allowSleep: true, sleepSpeedLimit: 0.8, sleepTimeLimit: 0.6
        });
        var spread = entry.above ? 14 : (R - 4 - CANDY_R - 2);
        var x = (Math.random() * 2 - 1) * spread;
        var y = entry.above ? HALF + 30 + Math.random() * 20 : 52 + Math.random() * 10;
        var z = (Math.random() * 2 - 1) * (DEPTH - CANDY_R - 2);
        body.position.set(x * K, y * K, z * K);
        body.velocity.set(0, entry.above ? -20 : 0, 0);
        body.angularVelocity.set(Math.random() * 6 - 3, Math.random() * 6 - 3, Math.random() * 6 - 3);
        c.body = body;
        c.mesh = buildCandyMesh(c);
        c.pulse = 0;
        candyWorld.addBody(body);
        candyGroup.add(c.mesh);
        live.push(c);
        syncCandy(c);
      }

      function removeCandy(c) {
        if (!c.body) return;
        candyWorld.removeBody(c.body);
        candyGroup.remove(c.mesh);
        c.body = null;
        c.mesh = null;
        var i = live.indexOf(c);
        if (i >= 0) live.splice(i, 1);
      }

      function syncCandy(c) {
        var p = c.body.position, q = c.body.quaternion;
        c.mesh.position.set(p.x / K, p.y / K, p.z / K);
        c.mesh.quaternion.set(q.x, q.y, q.z, q.w);
      }

      // ---------- physics: the lid, with every card as a shelf ----------
      var lidWorld = new CANNON.World({ gravity: new CANNON.Vec3(0, GRAVITY, 0) });
      lidWorld.allowSleep = true;
      var lidPhys = new CANNON.Material("lid");
      var shelfPhys = new CANNON.Material("shelf");
      lidWorld.addContactMaterial(new CANNON.ContactMaterial(lidPhys, shelfPhys, { friction: 0.5, restitution: 0.35 }));

      var shelves = [];
      var jarShelf = null;          // the shelf made from the jar's own card
      var jarShelfOn = true;        // off while the lid is still rising out of the jar
      var lidState = "closed";      // closed | flying | returning | hidden
      var lidBody = null;
      var tween = null;
      var zAxis = new THREE.Vector3(0, 0, 1);

      // x, y, w, h are in canvas pixels (y points down)
      function shelf(x, y, w, h) {
        var b = new CANNON.Body({ mass: 0, material: shelfPhys });
        b.addShape(new CANNON.Box(new CANNON.Vec3(w * K / 2, h * K / 2, 4)));
        b.position.set((x + w / 2) * K, -(y + h / 2) * K, 0);
        lidWorld.addBody(b);
        shelves.push(b);
        return b;
      }

      function buildShelves(gridR, tileR, top) {
        shelves.forEach(function (b) { lidWorld.removeBody(b); });
        shelves = [];
        jarShelf = null;
        Array.prototype.forEach.call(grid.querySelectorAll(".tile"), function (el) {
          var r = el.getBoundingClientRect();
          if (r.top < tileR.top - 5 || r.top > tileR.bottom) return;   // only the jar's row
          var b = shelf(r.left - gridR.left, r.top - top + INSET, r.width, Math.max(20, r.height - INSET));
          if (el === tile) jarShelf = b;
        });
        shelf(-60, -300, 60, H + 600);        // left edge of the page content
        shelf(W, -300, 60, H + 600);          // right edge
        shelf(-60, H, W + 120, 60);           // floor (bottom of the jar's card)
        if (jarShelf) jarShelf.collisionResponse = jarShelfOn;
        if (lidBody) lidBody.wakeUp();
      }

      var tmp = new THREE.Vector3();
      function lidClosedPoint() {
        jar.updateMatrixWorld(true);
        return jar.localToWorld(tmp.set(0, HALF + LID_T / 2 - 1, 0));
      }

      function placeLidClosed() {
        lidPivot.position.copy(lidClosedPoint());
        lidInner.quaternion.identity();
        lidPivot.visible = true;
      }

      function makeLidBody(px, py) {
        var b = new CANNON.Body({
          mass: 1, material: lidPhys, linearDamping: 0.05, angularDamping: 0.2,
          allowSleep: true, sleepSpeedLimit: 0.6, sleepTimeLimit: 0.5
        });
        b.addShape(new CANNON.Box(new CANNON.Vec3(LID_R * k * K, LID_T / 2 * k * K, 4)));
        b.addShape(new CANNON.Box(new CANNON.Vec3(10 * k * K, 4.5 * k * K, 4)), new CANNON.Vec3(0, (LID_T / 2 + 4.5) * k * K, 0));
        b.position.set(px * K, -py * K, 0);
        b.linearFactor.set(1, 1, 0);        // slide in the page plane only
        b.angularFactor.set(0, 0, 1);       // spin like a coin, not like a ball
        return b;
      }

      function openLid() {
        if (lidState !== "closed") return;
        if (reduceMotion) { lidState = "hidden"; lidPivot.visible = false; request(); return; }
        var p = lidClosedPoint();
        var px = p.x, py = -p.y;
        lidBody = makeLidBody(px, py);
        var dir = px > W / 2 ? -1 : 1;                           // fly toward the side with more room
        var rise = Math.max(60, py - HEAD) + 70;                 // rise a bit above the jar's card, in pixels
        var vy = Math.sqrt(2 * -GRAVITY * rise * K);
        lidBody.velocity.set(dir * (26 + Math.random() * 14) * Math.min(1, W / 900), vy, 0);
        lidBody.angularVelocity.set(0, 0, -dir * (5 + Math.random() * 4));
        jarShelfOn = false;
        if (jarShelf) jarShelf.collisionResponse = false;
        lidWorld.addBody(lidBody);
        lidState = "flying";
        request();
      }

      function closeLid() {
        if (lidState === "hidden") { lidState = "closed"; placeLidClosed(); request(); return; }
        if (lidState !== "flying") return;
        var q = lidBody.quaternion;
        var ang = 2 * Math.atan2(q.z, q.w);
        while (ang > Math.PI) ang -= 2 * Math.PI;
        while (ang < -Math.PI) ang += 2 * Math.PI;
        tween = { t0: performance.now(), dur: 750, x: lidBody.position.x / K, y: lidBody.position.y / K, ang: ang };
        lidWorld.removeBody(lidBody);
        lidBody = null;
        jarShelfOn = true;
        if (jarShelf) jarShelf.collisionResponse = true;
        lidState = "returning";
        request();
      }

      // ---------- layout: line the canvas up with the card ----------
      var lastW = 0, lastH = 0;

      function layout() {
        var gridR = grid.getBoundingClientRect();
        var tileR = tile.getBoundingClientRect();
        var slotR = slot.getBoundingClientRect();
        var top = tileR.top - HEAD;

        W = Math.max(100, Math.round(gridR.width));
        H = Math.max(100, Math.round(tileR.bottom - top));
        if (W !== lastW || H !== lastH) {
          renderer.setSize(W, H);
          lastW = W; lastH = H;
        }
        canvas.style.left = "0px";
        canvas.style.top = (top - gridR.top) + "px";

        camera.left = 0; camera.right = W; camera.top = 0; camera.bottom = -H;
        camera.updateProjectionMatrix();

        k = Math.max(0.6, Math.min(1.15, slotR.height / (TOTAL * 1.18), slotR.width / (R * 2 * 1.3)));
        var cx = slotR.left + slotR.width / 2 - gridR.left;
        var cy = slotR.top + slotR.height / 2 - top;
        jar.position.set(cx, -cy, 0);
        jar.scale.setScalar(k);
        lidPivot.scale.setScalar(k);
        shadow.position.x = cx;
        shadow.position.y = -(cy + HALF * k * Math.cos(TILT)) + 2;
        shadow.scale.set(R * 2 * k * 1.3, 40 * k, 1);

        buildShelves(gridR, tileR, top);
        if (lidState === "closed") placeLidClosed();
        request();
      }

      var layoutQueued = false;
      function queueLayout() {
        if (layoutQueued) return;
        layoutQueued = true;
        requestAnimationFrame(function () { layoutQueued = false; layout(); });
      }

      if ("ResizeObserver" in window) {
        var ro = new ResizeObserver(queueLayout);
        ro.observe(grid);
        ro.observe(tile);
        ro.observe(slot);
        ro.observe(document.body);
      }
      window.addEventListener("resize", queueLayout);
      window.addEventListener("load", queueLayout);

      // ---------- the animation loop (only runs while something is moving) ----------
      var raf = 0, last = 0;

      function request() { if (!raf) raf = requestAnimationFrame(frame); }

      function frame(now) {
        raf = 0;
        var dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
        last = now;
        var busy = false;
        var i, c;

        // Drop queued candies in, a few per second
        while (queue.length && now >= nextSpawn) {
          spawnNow(queue.shift());
          nextSpawn = now + 45;
        }
        if (queue.length) busy = true;

        // Candies
        if (live.length) {
          candyWorld.step(1 / 120, dt, 6);
          for (i = 0; i < live.length; i++) {
            c = live[i];
            syncCandy(c);
            if (c.body.sleepState !== CANNON.Body.SLEEPING) busy = true;
            if (c.pulse) {
              var p = (now - c.pulse) / 700;
              if (p >= 1) { c.pulse = 0; c.mesh.scale.setScalar(1); }
              else { c.mesh.scale.setScalar(1 + 0.35 * Math.sin(Math.PI * p)); busy = true; }
            }
          }
        }

        // Lid
        if (lidState === "flying" && lidBody) {
          lidWorld.step(1 / 120, dt, 8);
          var b = lidBody;
          // Once the lid has risen above the jar's card and is falling, that card can catch it too
          if (!jarShelfOn && b.velocity.y < 0 && -b.position.y / K < HEAD + INSET - 30 * k) {
            jarShelfOn = true;
            if (jarShelf) jarShelf.collisionResponse = true;
          }
          lidPivot.position.set(b.position.x / K, b.position.y / K, 60);
          lidInner.quaternion.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
          if (b.sleepState !== CANNON.Body.SLEEPING) busy = true;
        } else if (lidState === "returning" && tween) {
          var t = Math.min(1, (now - tween.t0) / tween.dur);
          var e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
          var target = lidClosedPoint();
          lidPivot.position.set(
            tween.x + (target.x - tween.x) * e,
            tween.y + (target.y - tween.y) * e + Math.sin(Math.PI * t) * 80,
            60 + (target.z - 60) * e
          );
          lidInner.quaternion.setFromAxisAngle(zAxis, tween.ang * (1 - e));
          if (t >= 1) { lidState = "closed"; tween = null; placeLidClosed(); }
          else busy = true;
        }

        renderer.render(scene, camera);
        if (busy) request(); else last = 0;
      }

      // ---------- picking a candy with the pointer ----------
      var raycaster = new THREE.Raycaster();
      var ndc = new THREE.Vector2();

      function pick(clientX, clientY) {
        var r = canvas.getBoundingClientRect();
        ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
        raycaster.setFromCamera(ndc, camera);
        var hits = raycaster.intersectObjects(candyGroup.children, true);
        for (var i = 0; i < hits.length; i++) {
          var o = hits[i].object;
          while (o && !o.userData.candy) o = o.parent;
          if (o) return o.userData.candy;
        }
        return null;
      }

      layout();

      // ---------- what the page code can use ----------
      return {
        enqueue: function (c, above) {
          queue.push({ c: c, above: above });
          if (reduceMotion && !above) {
            // No falling for people who asked for less motion: settle everything at once
            while (queue.length) spawnNow(queue.shift());
            for (var i = 0; i < 400; i++) candyWorld.step(1 / 60);
            live.forEach(syncCandy);
          }
          request();
        },
        remove: removeCandy,
        pop: function (c) {
          if (!c.body) return;
          c.body.wakeUp();
          c.body.velocity.set((Math.random() - 0.5) * 10, 38, (Math.random() - 0.5) * 6);
          c.pulse = performance.now();
          request();
        },
        pick: pick,
        openLid: openLid,
        closeLid: closeLid,
        lidHit: function (clientX, clientY) {
          if (lidState !== "flying" || !lidBody) return false;
          var r = canvas.getBoundingClientRect();
          var dx = clientX - r.left - lidBody.position.x / K;
          var dy = clientY - r.top + lidBody.position.y / K;
          return Math.sqrt(dx * dx + dy * dy) < LID_R * k * 0.95;
        }
      };
    });
  }
})();
