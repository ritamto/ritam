// Vercel serverless function: keeps the YouTube API key on the server.
// Set YOUTUBE_API_KEY in Vercel -> Project -> Settings -> Environment Variables.
module.exports = async function handler(req, res) {
  var key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    return res.status(500).json({
      error: { message: "Server is missing YOUTUBE_API_KEY.", details: [{ reason: "missingServerKey" }] }
    });
  }

  var q = String(req.query.q || "").trim().slice(0, 100);
  if (!q) return res.status(400).json({ error: { message: "Missing search query." } });

  try {
    var searchUrl = "https://www.googleapis.com/youtube/v3/search"
      + "?part=snippet&type=video&videoEmbeddable=true&maxResults=12"
      + "&q=" + encodeURIComponent(q)
      + "&key=" + key;
    var searchRes = await fetch(searchUrl);
    var searchData = await searchRes.json();
    if (!searchRes.ok) return res.status(searchRes.status).json(searchData);

    var ids = (searchData.items || []).map(function (item) {
      return item.id && item.id.videoId;
    }).filter(Boolean);
    if (!ids.length) return res.status(200).json({ items: [] });

    var videosUrl = "https://www.googleapis.com/youtube/v3/videos"
      + "?part=snippet,contentDetails,status&id=" + encodeURIComponent(ids.join(","))
      + "&key=" + key;
    var videosRes = await fetch(videosUrl);
    var videosData = await videosRes.json();
    if (!videosRes.ok) return res.status(videosRes.status).json(videosData);

    // Cache identical searches for an hour to save API quota
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    return res.status(200).json({ items: videosData.items || [] });
  } catch (err) {
    return res.status(502).json({ error: { message: "Could not reach YouTube." } });
  }
};
