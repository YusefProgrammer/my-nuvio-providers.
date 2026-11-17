/**
 * TopCinema - Nuvio JS Provider
 * Scrapes topcinemaa.one using TMDB for accurate title lookup.
 * Compatible with Hermes (Promise chains only, no async/await).
 */

const BASE_URL = "https://topcinemaa.one";
const TMDB_API_KEY = "6c91e91ec97e117e446a62f4d2ace9b7";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function log() {
  var args = Array.prototype.slice.call(arguments);
  console.log.apply(console, ["[TopCinema]"].concat(args));
}

function fixUrl(url, base) {
  if (!url) return "";
  var u = String(url).trim();
  if (u.indexOf("http") === 0) return u;
  if (u.indexOf("//") === 0) return "https:" + u;
  if (u.indexOf("/") === 0) return base + u;
  return base + "/" + u;
}

/* ---------------- TMDB Title Lookup ---------------- */

function tmdbTitles(tmdbId, mediaType) {
  var type = mediaType === "tv" ? "tv" : "movie";
  var url = "https://api.themoviedb.org/3/" + type + "/" + tmdbId +
            "?api_key=" + TMDB_API_KEY + "&append_to_response=translations,alternative_titles";
  return fetch(url)
    .then(function (res) { return res.json(); })
    .then(function (d) {
      var titles = [];
      var en = d.title || d.name;
      var orig = d.original_title || d.original_name;
      if (en) titles.push(en);
      if (orig && orig !== en) titles.push(orig);
      if (d.translations && d.translations.translations) {
        for (var i = 0; i < d.translations.translations.length; i++) {
          var tr = d.translations.translations[i];
          if (tr.iso_639_1 === "ar" && tr.data) {
            var t = tr.data.title || tr.data.name;
            if (t && titles.indexOf(t) === -1) titles.push(t);
          }
        }
      }
      if (d.alternative_titles && d.alternative_titles.results) {
        for (var j = 0; j < d.alternative_titles.results.length; j++) {
          var alt = d.alternative_titles.results[j].title;
          if (alt && titles.indexOf(alt) === -1) titles.push(alt);
        }
      }
      return {
        titles: titles,
        year: (d.release_date || d.first_air_date || "").split("-")[0] || null
      };
    })
    .catch(function (e) {
      log("TMDB error:", e.message);
      return { titles: [], year: null };
    });
}

/* ---------------- Search on TopCinema ---------------- */

function findItemUrl(titles, year, isMovie) {
  var queries = titles.slice(0, 4); // استخدم أول 4 عناوين للبحث
  var promises = queries.map(function (q) {
    return fetch(BASE_URL + "/search/?query=" + encodeURIComponent(q), {
      headers: { "User-Agent": USER_AGENT }
    })
    .then(function (res) { return res.text(); })
    .then(function (html) {
      return parseSearchResults(html, titles, isMovie);
    })
    .catch(function () { return null; });
  });

  return Promise.all(promises).then(function (results) {
    for (var i = 0; i < results.length; i++) {
      if (results[i]) {
        log("Found page:", results[i]);
        return results[i];
      }
    }
    return null;
  });
}

function parseSearchResults(html, wantedTitles, isMovie) {
  // البحث عن روابط داخل عناصر .Small--Box أو .Block--Item
  var re = /<a\b[^>]*?href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  var m;
  var best = null;
  var bestScore = 0;
  var wanted = wantedTitles.map(function (t) { return t.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/g, ""); });

  while ((m = re.exec(html)) !== null) {
    var href = m[1];
    var text = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
    var normText = text.replace(/[^a-z0-9\u0600-\u06FF]+/g, "");

    // تجاهل روابط غير المحتوى
    if (/\/(category|tag|page|search|login|register|contact|wp-content|feed|author)\b/i.test(href)) continue;
    if (href.indexOf(BASE_URL) === -1 && href.indexOf("/") !== 0) continue;

    var score = 0;
    for (var i = 0; i < wanted.length; i++) {
      if (normText === wanted[i]) { score = 3000; break; }
      if (normText.indexOf(wanted[i]) !== -1) { score = Math.max(score, 2000); }
      if (wanted[i].indexOf(normText) !== -1 && normText.length > 3) { score = Math.max(score, 1000); }
    }

    // التحقق من نوع المحتوى (فيلم/مسلسل)
    var isSeries = /مسلسل|series|episode|حلقة/i.test(text) || /series|episode/i.test(href);
    if (isMovie && isSeries) score -= 500;
    if (!isMovie && !isSeries) score -= 500;

    if (score > bestScore) {
      bestScore = score;
      best = fixUrl(href, BASE_URL);
    }
  }
  return best;
}

/* ---------------- Extract Streams from Detail/Watch Page ---------------- */

function extractStreamsFromPage(html, pageUrl) {
  var streams = [];
  var seen = {};

  // 1. استخراج روابط iframe
  var iframeRegex = /<iframe\b[^>]*?src=["']([^"']+)["'][^>]*>/gi;
  var im;
  while ((im = iframeRegex.exec(html)) !== null) {
    var iframeUrl = fixUrl(im[1], BASE_URL);
    if (seen[iframeUrl]) continue;
    if (/facebook|google|youtube|googletagmanager|google-analytics/i.test(iframeUrl)) continue;
    seen[iframeUrl] = true;
    streams.push({ url: iframeUrl, quality: "HD", label: "Embed Server" });
  }

  // 2. استخراج روابط m3u8 / mp4 المباشرة
  var directRegex = /https?:\/\/[^\s"'<>\\]+\.(?:m3u8|mp4|mkv)[^\s"'<>\\]*/gi;
  var dm;
  while ((dm = directRegex.exec(html)) !== null) {
    var dUrl = dm[0];
    if (seen[dUrl]) continue;
    if (dUrl.indexOf(".jpg") !== -1 || dUrl.indexOf(".png") !== -1) continue;
    seen[dUrl] = true;
    var isHls = dUrl.indexOf(".m3u8") !== -1;
    streams.push({ url: dUrl, quality: isHls ? "1080p" : "720p", label: isHls ? "HLS Direct" : "MP4 Direct" });
  }

  // 3. استخراج روابط من داخل JavaScript (إذا كانت مشفرة أو داخل متغيرات)
  var jsRegex = /(?:file|source|src|url)\s*[:=]\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/gi;
  var jm;
  while ((jm = jsRegex.exec(html)) !== null) {
    var jsUrl = fixUrl(jm[1], BASE_URL);
    if (seen[jsUrl]) continue;
    seen[jsUrl] = true;
    streams.push({ url: jsUrl, quality: "HD", label: "JS Server" });
  }

  return streams;
}

/* ---------------- Main Entry Point ---------------- */

function getStreams(tmdbId, mediaType, season, episode) {
  log("tmdbId=" + tmdbId + ", type=" + mediaType + ", s=" + season + ", e=" + episode);

  var isMovie = mediaType === "movie";

  return tmdbTitles(tmdbId, mediaType)
    .then(function (info) {
      if (!info.titles.length) {
        log("No titles found from TMDB");
        return [];
      }
      log("Titles:", info.titles.join(" | "));

      return findItemUrl(info.titles, info.year, isMovie)
        .then(function (pageUrl) {
          if (!pageUrl) {
            log("No page found on TopCinema");
            return [];
          }

          return fetch(pageUrl, { headers: { "User-Agent": USER_AGENT } })
            .then(function (res) { return res.text(); })
            .then(function (html) {
              var streams = extractStreamsFromPage(html, pageUrl);

              // إذا كانت الصفحة تحتوي على رابط مشاهدة منفصل، اجلبه أيضًا
              var watchMatch = html.match(/href=["']([^"']*(?:watch|watching|مشاهدة)[^"']*)["']/i);
              if (watchMatch && watchMatch[1]) {
                var watchUrl = fixUrl(watchMatch[1], BASE_URL);
                return fetch(watchUrl, { headers: { "User-Agent": USER_AGENT } })
                  .then(function (res) { return res.text(); })
                  .then(function (watchHtml) {
                    var watchStreams = extractStreamsFromPage(watchHtml, watchUrl);
                    return streams.concat(watchStreams);
                  })
                  .catch(function () { return streams; });
              }
              return streams;
            });
        });
    })
    .then(function (extracted) {
      if (!extracted || !extracted.length) {
        log("No streams extracted");
        return [];
      }

      // تحويل إلى صيغة Stream Objects الخاصة بـ Nuvio
      var finalStreams = [];
      var seenUrls = {};
      for (var i = 0; i < extracted.length; i++) {
        var s = extracted[i];
        if (!s.url || seenUrls[s.url]) continue;
        seenUrls[s.url] = true;
        var isHls = s.url.indexOf(".m3u8") !== -1;
        finalStreams.push({
          name: "TopCinema - " + (s.quality || "HD"),
          title: "TopCinema \u2022 " + (s.label || "Server") + " (" + (isHls ? "HLS" : "MP4") + ")",
          url: s.url,
          quality: s.quality || "HD",
          provider: "topcinema",
          headers: { "User-Agent": USER_AGENT, "Referer": BASE_URL },
          type: isHls ? "hls" : "mp4"
        });
      }
      log("Final streams:", finalStreams.length);
      return finalStreams;
    })
    .catch(function (err) {
      log("getStreams error:", err.message);
      return [];
    });
}

module.exports = { getStreams: getStreams };