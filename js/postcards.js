// ============================================================
// POSTCARD WALL
// Visitors leave short notes for one another as colourful postcards.
// ============================================================
(function () {
  var API = "/api/postcards";
  var KEEP = 200;
  var POLL_MS = 30000;
  var THEMES = [
    { name: "Yellow", value: 1 },
    { name: "Green", value: 2 },
    { name: "Purple", value: 4 },
    { name: "Coral", value: 6 },
    { name: "Orange", value: 7 }
  ];
  var THEME_INDEX = [0, 0, 1, 1, 2, 2, 3, 4];
  var STAMPS = ["✦", "♥", "☀", "✉"];
  var tile = $("postcardTile");
  if (!tile) return;

  var form = $("postcardForm");
  var messageEl = $("postcardMessage");
  var countEl = $("postcardCount");
  var statusEl = $("postcardStatus");
  var listEl = $("postcardAllList");
  var totalEl = $("postcardDialogTotal");
  var dialog = $("postcardDialog");
  var openButton = $("postcardOpen");
  var sendBtn = $("postcardSend");
  var postcards = [];
  var seen = {};
  var demoMode = false;
  var selectedTheme = Math.floor(Math.random() * THEMES.length);
  var selectedStamp = Math.floor(Math.random() * STAMPS.length);

  var SEEDS = [
    { id: "s1", name: "Ritam", msg: "Welcome! Leave a little note for someone passing through.", theme: 1, stamp: 0, t: Date.now() - 86400000 * 3 },
    { id: "s2", name: "A friend", msg: "Remember to drink some water today.", theme: 2, stamp: 2, t: Date.now() - 86400000 * 2 },
    { id: "s3", name: "Someone", msg: "The 8-ball said yes. I regret nothing.", theme: 3, stamp: 1, t: Date.now() - 3600000 * 30 },
    { id: "s4", name: "Anonymous", msg: "Good little corner of the internet.", theme: 5, stamp: 0, t: Date.now() - 3600000 * 9 },
    { id: "s5", name: "Visitor", msg: "I came for the jukebox and stayed for the postcards.", theme: 4, stamp: 3, t: Date.now() - 3600000 * 2 }
  ];

  function clean(text) {
    return String(text || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  }

  function clampInt(value, max) {
    value = parseInt(value, 10);
    return value >= 0 && value < max ? value : 0;
  }

  function normalize(postcard) {
    var storedTheme = clampInt(postcard.theme == null ? postcard.color : postcard.theme, THEME_INDEX.length);
    return {
      id: String(postcard.id),
      name: clean(postcard.name).slice(0, 24),
      msg: clean(postcard.msg).slice(0, 160),
      theme: THEME_INDEX[storedTheme],
      stamp: clampInt(postcard.stamp == null ? postcard.shape : postcard.stamp, STAMPS.length),
      t: Number(postcard.t) || Date.now()
    };
  }

  function timeAgo(time) {
    var seconds = Math.max(0, (Date.now() - time) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return Math.floor(seconds / 60) + "m ago";
    if (seconds < 86400) return Math.floor(seconds / 3600) + "h ago";
    return Math.floor(seconds / 86400) + "d ago";
  }

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function readLocal() {
    try {
      var saved = memory.get("ritam.postcards.local");
      if (saved) return JSON.parse(saved).map(normalize);
      var legacy = JSON.parse(memory.get("ritam.jar.local") || "[]").map(normalize);
      if (legacy.length) memory.set("ritam.postcards.local", JSON.stringify(legacy.slice(-30).map(serializeLocal)));
      return legacy;
    } catch (e) {
      return [];
    }
  }

  function saveLocal(postcard) {
    var local = readLocal();
    local.push(postcard);
    memory.set("ritam.postcards.local", JSON.stringify(local.slice(-30).map(serializeLocal)));
  }

  function serializeLocal(postcard) {
    return {
      id: postcard.id,
      name: postcard.name,
      msg: postcard.msg,
      theme: THEMES[postcard.theme].value,
      stamp: postcard.stamp,
      t: postcard.t
    };
  }

  function addPostcards(items) {
    var added = false;
    items.forEach(function (item) {
      if (seen[item.id]) return;
      seen[item.id] = true;
      postcards.push(item);
      added = true;
    });
    if (!added) return;
    while (postcards.length > KEEP) {
      var removed = postcards.shift();
      delete seen[removed.id];
    }
    render();
  }

  function render() {
    listEl.textContent = "";
    postcards.slice().sort(function (a, b) { return b.t - a.t; }).forEach(function (postcard) {
      var card = document.createElement("li");
      card.className = "postcard postcard-tone-" + postcard.theme;

      var header = document.createElement("div");
      header.className = "postcard-header";
      var sender = document.createElement("strong");
      sender.textContent = postcard.name || "Anonymous";
      var stamp = document.createElement("span");
      stamp.className = "postcard-stamp";
      stamp.setAttribute("aria-label", THEMES[postcard.theme].name + " postcard stamp");
      stamp.textContent = STAMPS[postcard.stamp];
      header.appendChild(sender);
      header.appendChild(stamp);

      var when = document.createElement("div");
      when.className = "small";
      when.textContent = timeAgo(postcard.t);
      var message = document.createElement("p");
      message.className = "postcard-message";
      message.textContent = postcard.msg;

      card.appendChild(header);
      card.appendChild(when);
      card.appendChild(message);
      listEl.appendChild(card);
    });
    var count = postcards.length;
    totalEl.textContent = count + (count === 1 ? " message" : " messages");
    openButton.textContent = "See all messages (" + count + ")";
  }

  function loadPostcards() {
    return fetch(API)
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        var items = (data.postcards || []).map(normalize).reverse();
        addPostcards(items);
        if (!items.length) setStatus("The wall is waiting for its first postcard.");
      })
      .catch(function () {
        demoMode = true;
        addPostcards(SEEDS.map(normalize).concat(readLocal()));
        setStatus("Demo mode: messages are saved on this device.");
      });
  }

  function poll() {
    if (demoMode || document.hidden || !dialog.open) return;
    fetch(API)
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        addPostcards((data.postcards || []).map(normalize).reverse());
      })
      .catch(function () {
        setStatus("Couldn’t refresh the postcard wall. Your message is still here.");
      });
  }

  function buildPickers() {
    var themes = $("postcardThemes");
    var stamps = $("postcardStamps");

    THEMES.forEach(function (theme, index) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "postcard-color postcard-color-" + index;
      button.setAttribute("aria-label", theme.name);
      button.setAttribute("aria-pressed", String(index === selectedTheme));
      button.addEventListener("click", function () {
        selectedTheme = index;
        Array.prototype.forEach.call(themes.children, function (child, i) {
          child.setAttribute("aria-pressed", String(i === index));
        });
      });
      themes.appendChild(button);
    });

    STAMPS.forEach(function (symbol, index) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "postcard-stamp-choice";
      button.textContent = symbol;
      button.setAttribute("aria-label", "Stamp " + (index + 1));
      button.setAttribute("aria-pressed", String(index === selectedStamp));
      button.addEventListener("click", function () {
        selectedStamp = index;
        Array.prototype.forEach.call(stamps.children, function (child, i) {
          child.setAttribute("aria-pressed", String(i === index));
        });
      });
      stamps.appendChild(button);
    });
  }

  function submit() {
    var msg = clean(messageEl.value);
    var name = clean($("postcardName").value);
    if (!msg) {
      setStatus("Write a little message first.");
      messageEl.focus();
      return;
    }

    sendBtn.disabled = true;
    setStatus("Sending postcard…");
    fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name,
        msg: msg,
        theme: THEMES[selectedTheme].value,
        stamp: selectedStamp,
        website: $("postcardWebsite").value
      })
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          return { res: res, data: data };
        });
      })
      .then(function (response) {
        if (response.res.status === 429) {
          setStatus("One postcard every 30 seconds, please.");
          return;
        }
        if (response.res.status === 400) {
          setStatus(response.data.error === "links" ? "Links aren’t allowed on the wall, sorry." : "That didn’t look right. Try changing the text.");
          return;
        }

        var postcard;
        if (response.res.ok) {
          postcard = response.data.postcard ? normalize(response.data.postcard) : null;
        } else if (demoMode || [404, 405, 501, 503].indexOf(response.res.status) >= 0) {
          demoMode = true;
          postcard = normalize({
            id: "L" + Date.now(),
            name: name,
            msg: msg,
            theme: THEMES[selectedTheme].value,
            stamp: selectedStamp,
            t: Date.now()
          });
          saveLocal(postcard);
        } else {
          throw new Error("HTTP " + response.res.status);
        }

        if (postcard) addPostcards([postcard]);
        messageEl.value = "";
        countEl.textContent = "0 / 160";
        setStatus(demoMode ? "Added on this device." : "Postcard sent!");
      })
      .catch(function () {
        setStatus("Couldn’t send your postcard. Try again in a bit.");
      })
      .then(function () {
        sendBtn.disabled = false;
      });
  }

  buildPickers();
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    submit();
  });
  openButton.addEventListener("click", function () {
    if (!dialog.open) dialog.showModal();
  });
  $("postcardClose").addEventListener("click", function () { dialog.close(); });
  dialog.addEventListener("close", function () { openButton.focus(); });
  messageEl.addEventListener("input", function () {
    countEl.textContent = messageEl.value.length + " / 160";
  });

  loadPostcards();
  window.setInterval(poll, POLL_MS);
})();
