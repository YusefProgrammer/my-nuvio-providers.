// نسخة تشخيصية مبسطة - مؤقتة
const BASE_URL = "https://topcinemaa.one";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function log() {
  var args = Array.prototype.slice.call(arguments);
  console.log.apply(console, ["[TopCinema-DEBUG]"].concat(args));
}

function getStreams(tmdbId, mediaType, season, episode) {
  log("START - tmdbId:", tmdbId, "type:", mediaType, "s:", season, "e:", episode);

  // 1. بحث ثابت عن فيلم Shrek
  var searchUrl = BASE_URL + "/search/?query=Shrek";
  log("Searching:", searchUrl);

  return fetch(searchUrl, { headers: { "User-Agent": USER_AGENT } })
    .then(function(res) {
      log("Search response status:", res.status);
      return res.text();
    })
    .then(function(html) {
      log("Search HTML length:", html.length);

      // استخراج أول رابط نتيجة
      var match = html.match(/<a[^>]+href=["']([^"']*shrek[^"']*)["']/i);
      if (match && match[1]) {
        var pageUrl = match[1].indexOf("http") === 0 ? match[1] : BASE_URL + match[1];
        log("Found page:", pageUrl);

        // 2. جلب صفحة الفيلم
        return fetch(pageUrl, { headers: { "User-Agent": USER_AGENT } })
          .then(function(r) { return r.text(); })
          .then(function(pageHtml) {
            log("Page HTML length:", pageHtml.length);

            // 3. البحث عن iframe
            var iframes = pageHtml.match(/<iframe[^>]+src=["']([^"']+)["']/gi) || [];
            log("Found iframes:", iframes.length);

            var streams = [];
            for (var i = 0; i < iframes.length; i++) {
              var srcMatch = iframes[i].match(/src=["']([^"']+)["']/);
              if (srcMatch && srcMatch[1] && srcMatch[1].indexOf("http") === 0) {
                log("Stream URL:", srcMatch[1]);
                streams.push({
                  name: "TopCinema-DEBUG",
                  title: "Debug Stream " + i,
                  url: srcMatch[1],
                  quality: "HD"
                });
              }
            }
            log("Returning streams:", streams.length);
            return streams;
          });
      } else {
        log("No Shrek page found in search results");
        return [];
      }
    })
    .catch(function(err) {
      log("ERROR:", err.message);
      return [];
    });
}

module.exports = { getStreams: getStreams };