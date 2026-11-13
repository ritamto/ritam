function say(message) { $("musicStatus").textContent = message; }

function mmss(seconds) {
  if (!isFinite(seconds)) return "0:00";
  var m = Math.floor(seconds / 60);
  var s = Math.floor(seconds % 60);
  return m + ":" + (s < 10 ? "0" : "") + s;
}

// Strip noisy "(Official Audio)" / "[Lyrics]" text from YouTube titles
function cleanTitle(raw) {
  var txt = document.createElement("textarea");
  txt.innerHTML = raw;
  return txt.value.replace(/\s*[\(\[](official|audio|video|lyrics|visualizer|hd|4k).*?[\)\]]/gi, "").trim();
}

// Convert a YouTube ISO 8601 duration to seconds
function durationInSeconds(duration) {
  var match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(duration || "");
  if (!match) return 0;
  return (Number(match[1]) || 0) * 86400
    + (Number(match[2]) || 0) * 3600
    + (Number(match[3]) || 0) * 60
    + (Number(match[4]) || 0);
}

// Search YouTube for embeddable full-length videos
function searchMusic(query) {
  query = query.trim();
  if (!query) { say("Type an artist or a song first."); return; }
  say("Searching...");

  var url = "https://www.googleapis.com/youtube/v3/search"
    + "?part=snippet&type=video&videoEmbeddable=true&maxResults=12"
    + "&q=" + encodeURIComponent(query)
    + "&key=" + YT_API_KEY;

  fetch(url)
    .then(function (response) {
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.json();
    })
    .then(function (data) {
      var ids = (data.items || []).map(function (item) {
        return item.id.videoId;
      }).filter(Boolean);
      if (!ids.length) return [];

      var videosUrl = "https://www.googleapis.com/youtube/v3/videos"
        + "?part=snippet,contentDetails,status&id=" + encodeURIComponent(ids.join(","))
        + "&key=" + YT_API_KEY;

      return fetch(videosUrl).then(function (response) {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
      }).then(function (videosData) {
        return videosData.items || [];
      });
    })
    .then(function (items) {
      songs = items.filter(function (item) {
        return item.status.embeddable === true
          && durationInSeconds(item.contentDetails.duration) >= 65;
      }).sort(function (a, b) {
        return Number(b.snippet.channelTitle.endsWith(" - Topic"))
          - Number(a.snippet.channelTitle.endsWith(" - Topic"));
      }).map(function (item) {
        return {
          videoId: item.id,
          trackName: cleanTitle(item.snippet.title),
          artistName: item.snippet.channelTitle.replace(" - Topic", ""),
          channelTitle: item.snippet.channelTitle,
          artworkUrl: item.snippet.thumbnails.default.url
        };
      });
      showSongs();
      say(songs.length ? songs.length + " tracks found. Click one to play." : "Nothing found. Try another search.");
    })
    .catch(function (err) {
      console.error("YouTube search error:", err);
      say("Couldn't reach YouTube. Check your API key or connection.");
    });
}

// Build the list of results inside the search dock
function showSongs() {
  var list = $("tracks");
  list.innerHTML = "";
  list.scrollTop = 0;
  playingIndex = -1;

  songs.forEach(function (song, index) {
    var item = document.createElement("li");
    var button = document.createElement("button");
    button.className = "track";

    var art = document.createElement("img");
    art.src = song.artworkUrl;
    art.alt = "";
    art.width = 48;
    art.height = 48;

    var text = document.createElement("span");
    var title = document.createElement("b");
    title.textContent = song.trackName;
    var artist = document.createElement("small");
    artist.textContent = song.artistName;
    text.append(title, document.createElement("br"), artist);

    button.append(art, text);
    button.onclick = function () { playSong(index); };
    item.appendChild(button);
    list.appendChild(item);
  });
}

// Start playing one result in the floating bottom-right player
function playSong(index) {
  var song = songs[index];
  if (!song || !ytReady) return;
  playingIndex = index;

  ytPlayer.loadVideoById(song.videoId);

  $("nowTitle").textContent = song.trackName;
  $("nowArtist").textContent = song.artistName;
  $("seek").value = 0;
  $("nowTime").textContent = "0:00";
  $("now").hidden = false;

  var buttons = $("tracks").querySelectorAll(".track");
  buttons.forEach(function (b, i) {
    b.setAttribute("aria-current", i === index ? "true" : "false");
  });
}
