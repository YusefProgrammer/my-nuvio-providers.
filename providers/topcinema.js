/**
 * TopCinema - Nuvio JS Provider (Fixed Scope Bug + VidTube Resolver)
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

/* ---------------- TMDB ---------------- */

function tmdbTitles(tmdbId, mediaType) {
  var type = mediaType === "tv" ? "tv" : "movie";
  var url = "https://api.themoviedb.org/3/" + type + "/" + tmdbId +
            "?api_key=" + TMDB_API_KEY + "&append_to_response=translations,alternative_titles";
  return fetch(url)
    .then(function (res) { return res.json(); })
    .then(function (d) {
      var titles = [];
      if (d.title || d.name) titles.push(d.title || d.name);
      if (d.original_title && titles.indexOf(d.original_title) === -1) titles.push(d.original_title);
      if (d.original_name && titles.indexOf(d.original_name) === -1) titles.push(d.original_name);
      if (d.translations && d.translations.translations) {
        for (var i = 0; i < d.translations.translations.length; i++) {
          var tr = d.translations.translations[i];
          if (tr.iso_639_1 === "ar" && tr.data) {
            var t = tr.data.title || tr.data.name;
            if (t && titles.indexOf(t) === -1) titles.push(t);
          }
        }
      }
      return { titles: titles, year: (d.release_date || d.first_air_date || "").split("-")[0] || null };
    })
    .catch(function (e) { log("TMDB error:", e.message); return { titles: [], year: null }; });
}

/* ---------------- Search ---------------- */

function findItemUrl(titles, isMovie) {
  var queries = titles.slice(0, 4);
  var promises = queries.map(function (q) {
    return fetch(BASE_URL + "/search/?query=" + encodeURIComponent(q), {
      headers: { "User-Agent": USER_AGENT }
    })
    .then(function (res) { return res.text(); })
    .then(function (html) { return parseSearchResults(html, titles, isMovie); })
    .catch(function () { return null; });
  });

  return Promise.all(promises).then(function (results) {
    for (var i = 0; i < results.length; i++) {
      if (results[i]) { log("Found page:", results[i]); return results[i]; }
    }
    return null;
  });
}

function parseSearchResults(html, wantedTitles, isMovie) {
  var re = /<a\b[^>]*?href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  var m, best = null, bestScore = 0;
  var wanted = wantedTitles.map(function (t) { return t.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/g, ""); });

  while ((m = re.exec(html)) !== null) {
    var href = m[1];
    var text = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
    var normText = text.replace(/[^a-z0-9\u0600-\u06FF]+/g, "");
    if (/\/(category|tag|page|search|login|register|contact|wp-content|feed|author)\b/i.test(href)) continue;
    if (href.indexOf(BASE_URL) === -1 && href.indexOf("/") !== 0) continue;

    var score = 0;
    for (var i = 0; i < wanted.length; i++) {
      if (normText === wanted[i]) { score = 3000; break; }
      if (normText.indexOf(wanted[i]) !== -1) score = Math.max(score, 2000);
    }
    var isSeries = /مسلسل|series|episode|حلقة/i.test(text) || /series|episode/i.test(href);
    if (isMovie && isSeries) score -= 500;
    if (!isMovie && !isSeries) score -= 500;

    if (score > bestScore) { bestScore = score; best = fixUrl(href, BASE_URL); }
  }
  return best;
}

/* ---------------- VidTube Resolver ---------------- */

function resolveVidTube(embedUrl) {
  log("Resolving VidTube:", embedUrl);
  return fetch(embedUrl, { headers: { "User-Agent": USER_AGENT, "Referer": BASE_URL } })
    .then(function (res) { return res.text(); })
    .then(function (html) {
      var links = [], seen = {};
      var mp4Regex = /https?:\/\/[^\s"'<>\\]+\.mp4[^\s"'<>\\]*/gi;
      var match;
      while ((match = mp4Regex.exec(html)) !== null) {
        var u = match[0];
        if (seen[u]) continue;
        seen[u] = true;
        var qm = u.match(/(\d{3,4})p/);
        links.push({ url: u, quality: qm ? qm[1] + "p" : "HD", label: "VidTube" });
      }
      var m3u8Regex = /https?:\/\/[^\s"'<>\\]+\.m3u8[^\s"'<>\\]*/gi;
      while ((match = m3u8Regex.exec(html)) !== null) {
        var u2 = match[0];
        if (seen[u2]) continue;
        seen[u2] = true;
        links.push({ url: u2, quality: "HLS", label: "VidTube-HLS" });
      }
      log("VidTube direct links:", links.length);
      return links;
    })
    .catch(function (e) { log("VidTube error:", e.message); return []; });
}

/* ---------------- Episode Finder ---------------- */

function findEpisodeUrl(seriesHtml, season, episode) {
  var re = /<a\b[^>]*?href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  var m, wantedEp = parseInt(episode, 10), wantedSeason = parseInt(season, 10) || 1;
  var candidates = [];

  while ((m = re.exec(seriesHtml)) !== null) {
    var href = m[1];
    var text = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!/حلقة|الحلقة|episode|ep\s*\d+/i.test(text) && !/episode|ep[-_]?\d+/i.test(href)) continue;

    var epMatch = text.match(/(?:الحلقة|حلقة|episode|ep)\s*(\d+)/i) ||
                  href.match(/(?:episode|ep)[-_]?(\d+)/i);
    if (!epMatch) continue;
    var epNum = parseInt(epMatch[1], 10);
    var seasonMatch = text.match(/(?:الموسم|season)\s*(\d+)/i) || href.match(/(?:season|s)[-_]?(\d+)/i);
    var seasonNum = seasonMatch ? parseInt(seasonMatch[1], 10) : 1;

    if (seasonNum === wantedSeason && epNum === wantedEp) {
      candidates.unshift({ url: fixUrl(href, BASE_URL), score: 100 });
    } else if (epNum === wantedEp) {
      candidates.push({ url: fixUrl(href, BASE_URL), score: 50 });
    }
  }

  if (candidates.length > 0) {
    candidates.sort(function (a, b) { return b.score - a.score; });
    return candidates[0].url;
  }
  return null;
}

/* ---------------- Extract Streams ---------------- */

function extractStreams(html, pageUrl) {
  var streams = [], seen = {};

  var iframeRegex = /<iframe\b[^>]*?src=["']([^"']+)["'][^>]*>/gi;
  var im;
  while ((im = iframeRegex.exec(html)) !== null) {
    var iu = fixUrl(im[1], BASE_URL);
    if (seen[iu]) continue;
    if (/facebook|google|youtube|googletagmanager|google-analytics/i.test(iu)) continue;
    seen[iu] = true;
    streams.push({ type: "embed", url: iu });
  }

  var directRegex = /https?:\/\/[^\s"'<>\\]+\.(?:m3u8|mp4|mkv)[^\s"'<>\\]*/gi;
  var dm;
  while ((dm = directRegex.exec(html)) !== null) {
    var dUrl = dm[0];
    if (seen[dUrl]) continue;
    if (/\.(jpg|png|gif|webp)/i.test(dUrl)) continue;
    seen[dUrl] = true;
    var isHls = dUrl.indexOf(".m3u8") !== -1;
    streams.push({ type: "direct", url: dUrl, quality: isHls ? "1080p" : "720p", label: "Direct" });
  }

  return streams;
}

/* ---------------- Main ---------------- */

function getStreams(tmdbId, mediaType, season, episode) {
  log("START:", tmdbId, mediaType, "S" + season, "E" + episode);
  var isMovie = mediaType === "movie";

  return tmdbTitles(tmdbId, mediaType)
    .then(function (info) {
      if (!info.titles.length) { log("No TMDB titles"); return null; }
      log("Titles:", info.titles.join(" | "));
      return findItemUrl(info.titles, isMovie);
    })
    .then(function (pageUrl) {
      if (!pageUrl) { log("No page found"); return []; }
      log("Main page:", pageUrl);

      return fetch(pageUrl, { headers: { "User-Agent": USER_AGENT } })
        .then(function (res) { return res.text(); })
        .then(function (html) {
          log("Main page HTML length:", html.length);

          // For series: find and fetch episode page
          if (!isMovie && season != null && episode != null) {
            var epUrl = findEpisodeUrl(html, season, episode);
            if (!epUrl) {
              log("Episode S" + season + "E" + episode + " NOT found in series page");
              return [];
            }
            log("Episode page:", epUrl);
            return fetch(epUrl, { headers: { "User-Agent": USER_AGENT } })
              .then(function (r) { return r.text(); })
              .then(function (epHtml) {
                log("Episode HTML length:", epHtml.length);
                return extractStreams(epHtml, epUrl);
              });
          }

          // For movie: extract from main page
          return extractStreams(html, pageUrl);
        });
    })
    .then(function (items) {
      if (!items || !items.length) { log("No items extracted"); return []; }
      log("Extracted items:", items.length);

      var promises = items.map(function (item) {
        if (item.type === "direct") {
          return Promise.resolve([item]);
        }
        if (item.type === "embed") {
          if (/vidtube\.one/i.test(item.url)) {
            return resolveVidTube(item.url);
          }
          return fetch(item.url, { headers: { "User-Agent": USER_AGENT } })
            .then(function (r) { return r.text(); })
            .then(function (eh) {
              return extractStreams(eh, item.url).filter(function (d) { return d.type === "direct"; });
            })
            .catch(function () { return []; });
        }
        return Promise.resolve([]);
      });

      return Promise.all(promises).then(function (results) {
        var flat = [], seen = {};
        results.forEach(function (arr) {
          arr.forEach(function (s) {
            if (s.url && !seen[s.url]) { seen[s.url] = true; flat.push(s); }
          });
        });
        log("Final streams:", flat.length);
        return flat;
      });
    })
    .then(function (streams) {
      return streams.map(function (s) {
        var isHls = s.url.indexOf(".m3u8") !== -1;
        return {
          name: "TopCinema - " + (s.quality || "HD"),
          title: "TopCinema \u2022 " + (s.label || "Server") + " (" + (isHls ? "HLS" : "MP4") + ")",
          url: s.url,
          quality: s.quality || "HD",
          provider: "topcinema",
          headers: { "User-Agent": USER_AGENT, "Referer": BASE_URL },
          type: isHls ? "hls" : "mp4"
        };
      });
    })
    .catch(function (err) {
      log("FATAL:", err && err.message);
      return [];
    });
}

module.exports = { getStreams: getStreams };