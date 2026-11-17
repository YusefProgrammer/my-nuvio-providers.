/**
 * TopCinema - Nuvio JS Provider (Movie + Series + VidTube Resolver)
 * Compatible with Hermes (Promise chains only).
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
      if (results[i]) {
        log("Found page:", results[i]);
        return results[i];
      }
    }
    return null;
  });
}

function parseSearchResults(html, wantedTitles, isMovie) {
  var re = /<a\b[^>]*?href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  var m;
  var best = null;
  var bestScore = 0;
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
      if (normText.indexOf(wanted[i]) !== -1) { score = Math.max(score, 2000); }
      if (wanted[i].indexOf(normText) !== -1 && normText.length > 3) { score = Math.max(score, 1000); }
    }

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

/* ---------------- VidTube Resolver (Critical Fix) ---------------- */

// يستخرج روابط MP4 المباشرة من صفحة embed الخاصة بـ VidTube
function resolveVidTube(embedUrl) {
  log("Resolving VidTube:", embedUrl);
  return fetch(embedUrl, {
    headers: { "User-Agent": USER_AGENT, "Referer": BASE_URL }
  })
  .then(function (res) { return res.text(); })
  .then(function (html) {
    var links = [];
    var seen = {};

    // 1. روابط mp4 مباشرة داخل HTML أو JavaScript
    var mp4Regex = /https?:\/\/[^\s"'<>\\]+\.mp4[^\s"'<>\\]*/gi;
    var match;
    while ((match = mp4Regex.exec(html)) !== null) {
      var url = match[0];
      if (seen[url]) continue;
      seen[url] = true;
      // محاولة استخراج الجودة من الرابط
      var qMatch = url.match(/(\d{3,4})p/);
      var quality = qMatch ? qMatch[1] + "p" : "HD";
      links.push({ url: url, quality: quality });
    }

    // 2. روابط m3u8 (إذا وجدت)
    var m3u8Regex = /https?:\/\/[^\s"'<>\\]+\.m3u8[^\s"'<>\\]*/gi;
    while ((match = m3u8Regex.exec(html)) !== null) {
      var url = match[0];
      if (seen[url]) continue;
      seen[url] = true;
      links.push({ url: url, quality: "HLS" });
    }

    // 3. البحث عن روابط داخل متغيرات JavaScript مثل "file": "..."
    var jsRegex = /["'](?:file|source|src|url)["']\s*:\s*["']([^"']+\.(?:mp4|m3u8)[^"']*)["']/gi;
    while ((match = jsRegex.exec(html)) !== null) {
      var url = fixUrl(match[1], embedUrl);
      if (seen[url]) continue;
      seen[url] = true;
      links.push({ url: url, quality: "HD" });
    }

    log("VidTube found " + links.length + " direct links");
    return links;
  })
  .catch(function (e) {
    log("VidTube resolve error:", e.message);
    return [];
  });
}

/* ---------------- Series Episodes Extraction ---------------- */

// يستخرج روابط الحلقات من صفحة المسلسل
function findEpisodeUrl(seriesHtml, season, episode) {
  // TopCinema يضع روابط الحلقات داخل عناصر مثل:
  // <div class="episodes--list--side"><a href="...">الحلقة 1<em>...</em></a></div>
  // أو داخل <a> مع نص يحتوي على "الحلقة" أو رقم الحلقة.
  var re = /<a\b[^>]*?href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  var m;
  var wantedEp = parseInt(episode, 10);
  var wantedSeason = parseInt(season, 10) || 1;
  var candidates = [];

  while ((m = re.exec(seriesHtml)) !== null) {
    var href = m[1];
    var text = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

    // تجاهل الروابط غير المتعلقة بالحلقات
    if (!/حلقة|الحلقة|episode|ep\s*\d+/i.test(text) && !/episode|ep[-_]?\d+/i.test(href)) continue;

    // محاولة استخراج رقم الحلقة من النص أو الرابط
    var epMatch = text.match(/(?:الحلقة|حلقة|episode|ep)\s*(\d+)/i) ||
                  href.match(/(?:episode|ep)[-_]?(\d+)/i) ||
                  href.match(/(\d+)(?:\/)?$/);
    if (!epMatch) continue;
    var epNum = parseInt(epMatch[1], 10);

    // محاولة استخراج رقم الموسم (إذا وجد)
    var seasonMatch = text.match(/(?:الموسم|season)\s*(\d+)/i) ||
                      href.match(/(?:season|s)[-_]?(\d+)/i);
    var seasonNum = seasonMatch ? parseInt(seasonMatch[1], 10) : 1;

    if (seasonNum === wantedSeason && epNum === wantedEp) {
      // أولوية عالية للتطابق التام
      candidates.unshift({ url: fixUrl(href, BASE_URL), score: 100 });
    } else if (epNum === wantedEp) {
      candidates.push({ url: fixUrl(href, BASE_URL), score: 50 });
    }
  }

  if (candidates.length > 0) {
    // إرجاع أفضل مرشح
    candidates.sort(function (a, b) { return b.score - a.score; });
    return candidates[0].url;
  }
  return null;
}

/* ---------------- Extract Streams from Page ---------------- */

function extractStreams(html, pageUrl) {
  var streams = [];
  var seen = {};

  // 1. روابط iframe (قد تكون embed)
  var iframeRegex = /<iframe\b[^>]*?src=["']([^"']+)["'][^>]*>/gi;
  var im;
  while ((im = iframeRegex.exec(html)) !== null) {
    var iframeUrl = fixUrl(im[1], BASE_URL);
    if (seen[iframeUrl]) continue;
    if (/facebook|google|youtube|googletagmanager|google-analytics/i.test(iframeUrl)) continue;
    seen[iframeUrl] = true;
    streams.push({ type: "embed", url: iframeUrl });
  }

  // 2. روابط m3u8 / mp4 مباشرة
  var directRegex = /https?:\/\/[^\s"'<>\\]+\.(?:m3u8|mp4|mkv)[^\s"'<>\\]*/gi;
  var dm;
  while ((dm = directRegex.exec(html)) !== null) {
    var dUrl = dm[0];
    if (seen[dUrl]) continue;
    if (dUrl.indexOf(".jpg") !== -1 || dUrl.indexOf(".png") !== -1) continue;
    seen[dUrl] = true;
    var isHls = dUrl.indexOf(".m3u8") !== -1;
    streams.push({ type: "direct", url: dUrl, quality: isHls ? "1080p" : "720p" });
  }

  // 3. روابط داخل JavaScript
  var jsRegex = /(?:file|source|src|url)\s*[:=]\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/gi;
  var jm;
  while ((jm = jsRegex.exec(html)) !== null) {
    var jsUrl = fixUrl(jm[1], BASE_URL);
    if (seen[jsUrl]) continue;
    seen[jsUrl] = true;
    streams.push({ type: "direct", url: jsUrl, quality: "HD" });
  }

  return streams;
}

/* ---------------- Main Flow ---------------- */

function getStreams(tmdbId, mediaType, season, episode) {
  log("tmdbId=" + tmdbId + ", type=" + mediaType + ", s=" + season + ", e=" + episode);
  var isMovie = mediaType === "movie";

  return tmdbTitles(tmdbId, mediaType)
    .then(function (info) {
      if (!info.titles.length) { log("No titles from TMDB"); return []; }

      return findItemUrl(info.titles, isMovie)
        .then(function (pageUrl) {
          if (!pageUrl) { log("No page found"); return []; }

          return fetch(pageUrl, { headers: { "User-Agent": USER_AGENT } })
            .then(function (res) { return res.text(); })
            .then(function (html) {
              var targetUrl = pageUrl;

              // إذا كان مسلسلاً، ابحث عن رابط الحلقة المطلوبة
              if (!isMovie && season != null && episode != null) {
                var epUrl = findEpisodeUrl(html, season, episode);
                if (epUrl) {
                  log("Episode URL:", epUrl);
                  targetUrl = epUrl;
                  // جلب صفحة الحلقة نفسها
                  return fetch(epUrl, { headers: { "User-Agent": USER_AGENT } })
                    .then(function (r) { return r.text(); });
                } else {
                  log("Episode not found in series page");
                  // قد يكون رابط الحلقة موجودًا في صفحة المسلسل، لكن لم نعثر عليه.
                  // نجرب استخدام الصفحة الحالية كحل أخير.
                }
              }
              return html;
            })
            .then(function (pageHtml) {
              // استخراج العناصر (embed/direct)
              return extractStreams(pageHtml, targetUrl);
            });
        });
    })
    .then(function (items) {
      if (!items || !items.length) { log("No items extracted"); return []; }

      // معالجة كل عنصر: إذا كان embed VidTube، فك تشفيره
      var promises = items.map(function (item) {
        if (item.type === "direct") {
          return Promise.resolve([{
            url: item.url,
            quality: item.quality || "HD",
            label: "Direct",
            isHls: item.url.indexOf(".m3u8") !== -1
          }]);
        } else if (item.type === "embed") {
          // إذا كان الرابط من VidTube، استخدم دالة الحل
          if (/vidtube\.one/i.test(item.url)) {
            return resolveVidTube(item.url).then(function (links) {
              return links.map(function (l) {
                return {
                  url: l.url,
                  quality: l.quality,
                  label: "VidTube",
                  isHls: l.url.indexOf(".m3u8") !== -1
                };
              });
            });
          } else {
            // محاولة استخراج روابط من أي embed آخر
            return fetch(item.url, { headers: { "User-Agent": USER_AGENT } })
              .then(function (r) { return r.text(); })
              .then(function (embedHtml) {
                var extracted = extractStreams(embedHtml, item.url);
                return extracted.map(function (ex) {
                  return {
                    url: ex.url,
                    quality: ex.quality || "HD",
                    label: "Embed",
                    isHls: ex.url.indexOf(".m3u8") !== -1
                  };
                });
              })
              .catch(function () { return []; });
          }
        }
        return Promise.resolve([]);
      });

      return Promise.all(promises).then(function (results) {
        var flat = [];
        var seen = {};
        results.forEach(function (arr) {
          arr.forEach(function (s) {
            if (s.url && !seen[s.url]) {
              seen[s.url] = true;
              flat.push(s);
            }
          });
        });
        log("Final streams:", flat.length);
        return flat;
      });
    })
    .then(function (streams) {
      return streams.map(function (s) {
        return {
          name: "TopCinema - " + (s.quality || "HD"),
          title: "TopCinema \u2022 " + (s.label || "Server") + " (" + (s.isHls ? "HLS" : "MP4") + ")",
          url: s.url,
          quality: s.quality,
          provider: "topcinema",
          headers: { "User-Agent": USER_AGENT, "Referer": BASE_URL },
          type: s.isHls ? "hls" : "mp4"
        };
      });
    })
    .catch(function (err) {
      log("getStreams error:", err.message);
      return [];
    });
}

module.exports = { getStreams: getStreams };