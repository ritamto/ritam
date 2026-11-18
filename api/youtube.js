// Serverless proxy for the YouTube Data API.
// The key lives in the YOUTUBE_API_KEY environment variable and never reaches the browser.
const API = "https://www.googleapis.com/youtube/v3";

function durationInSeconds(duration) {
  var match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(duration || "");
  if (!match) return 0;
  return (Number(match[1]) || 0) * 86400
    + (Number(match[2]) || 0) * 3600
    + (Number(match[3]) || 0) * 60
    + (Number(match[4]) || 0);
}

async function callYouTube(path, params) {
  var query = new URLSearchParams(Object.assign({}, params, { key: process.env.YOUTUBE_API_KEY }));
  var response = await fetch(API + path + "?" + query);
  var data = await response.json();
  if (!response.ok) {
    var apiError = data.error || {};
    var detail = (apiError.details || []).find(function (item) { return item.reason; });
    var error = new Error(apiError.message || "HTTP " + response.status);
    error.status = response.status;
    error.reason = (detail && detail.reason)
      || (apiError.errors && apiError.errors[0] && apiError.errors[0].reason);
    throw error;
  }
  return data;
}

module.exports = async function handler(req, res) {
  var q = String((req.query && req.query.q) || "").trim().slice(0, 100);
  if (!q) return res.status(400).json({ error: { reason: "emptyQuery" } });
  if (!process.env.YOUTUBE_API_KEY) return res.status(500).json({ error: { reason: "missingKey" } });

  try {
    var search = await callYouTube("/search", {
      part: "snippet", type: "video", videoEmbeddable: "true", maxResults: "12", q: q
    });
    var ids = (search.items || []).map(function (item) { return item.id.videoId; }).filter(Boolean);
    if (!ids.length) {
      res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
      return res.status(200).json({ songs: [] });
    }

    var videos = await callYouTube("/videos", {
      part: "snippet,contentDetails,status", id: ids.join(",")
    });

    var songs = (videos.items || []).filter(function (item) {
      return item.status.embeddable === true
        && durationInSeconds(item.contentDetails.duration) >= 65;
    }).sort(function (a, b) {
      return Number(b.snippet.channelTitle.endsWith(" - Topic"))
        - Number(a.snippet.channelTitle.endsWith(" - Topic"));
    }).map(function (item) {
      return {
        videoId: item.id,
        title: item.snippet.title,
        channelTitle: item.snippet.channelTitle,
        artworkUrl: item.snippet.thumbnails.default.url
      };
    });

    // Cache successful searches for an hour: saves API quota. Errors are never cached.
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).json({ songs: songs });
  } catch (err) {
    res.status(err.status || 502).json({ error: { status: err.status, reason: err.reason } });
  }
};
