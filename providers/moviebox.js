// MovieBox Scraper for Nuvio Local Scrapers
// React Native compatible version

var BASE_URL = "https://apig.inmoviebox.com";
var TOKEN = "jdvhhjv255vghhghdhvfch2565656jhdcghfdf";
var APP_ID = "com.community.mbox.in";

var HEADERS = {
  "user-agent": "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Mobile Safari/537.36",
  "x-request-x": APP_ID,
  "Accept": "application/json"
};

function matchQuality(s) {
  if (!s) return "Unknown";
  var v = s.toLowerCase();
  if (v.includes("2160") || v.includes("4k")) return "4K";
  if (v.includes("1080")) return "1080p";
  if (v.includes("720")) return "720p";
  if (v.includes("480")) return "480p";
  return "720p";
}

function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  return new Promise((resolve, reject) => {
    try {
      console.log("[MovieBox] Fetching streams for TMDB ID: " + tmdbId + ", Type: " + mediaType);
      
      // ملاحظة: في نظام Nuvio المعتمد على الـ Backend، يمكنك توجيه الطلب للرابط الرئيسي
      var type = mediaType === "movie" ? "movie" : "tv";
      var searchUrl = BASE_URL + "/wefeed-mobile-bff/subject-api/search/v2?query=" + tmdbId;

      fetch(searchUrl, { headers: HEADERS })
        .then(res => res.json())
        .then(data => {
          var streams = [];
          // استخراج الروابط وتنسيقها لتتوافق مع مشغل نوفيو
          if (data && data.results) {
            // معالجة الروابط المستخرجة
          }
          
          console.log("[MovieBox] Found " + streams.length + " streams.");
          resolve(streams);
        })
        .catch(err => {
          console.error("[MovieBox] Error: " + err.message);
          resolve([]);
        });
    } catch (error) {
      console.error("[MovieBox] Critical Error: " + error.message);
      resolve([]);
    }
  });
}

module.exports = { getStreams };
