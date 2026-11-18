/**
 * YO Top Cinema Provider — Nuvio Single-Source Provider
 * Restricted exclusively to Top Cinema source.
 * Runtime: Hermes / QuickJS / Node compatible (Promise-only, zero external dependencies).
 */

var TMDB_KEY = "1c29a5198ee1854bd5eb45dbe8d17d92";
var TMDB_BASE = "https://api.themoviedb.org/3";
var RELAY_BASE = "";
var SOURCE_TIMEOUT_MS = 9500;
var UA_CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

var SOURCES = [
  {
    "id": "topcinema",
    "name": "Top Cinema",
    "url": "https://web8.topcinema.cam",
    "cat": "vod",
    "types": [
      "movie",
      "tv"
    ],
    "cf": true,
    "method": "html_ajax"
  }
];

function log() {
  var args = Array.prototype.slice.call(arguments);
  try { console.log.apply(console, ["[YO-TopCinema]"].concat(args)); } catch (e) {}
}

/* ---------------- Pure-JS Polyfills & Helpers ---------------- */
var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function b64Decode(str) {
  var clean = String(str || "").replace(/[^A-Za-z0-9+/=]/g, "");
  var out = "", acc = 0, bits = 0;
  for (var i = 0; i < clean.length; i++) {
    var c = clean.charAt(i);
    if (c === "=") break;
    var v = B64.indexOf(c);
    if (v < 0) continue;
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out += String.fromCharCode((acc >> bits) & 255);
      acc &= (1 << bits) - 1;
    }
  }
  try { return decodeURIComponent(escape(out)); } catch (e) { return out; }
}

function allSettled(promises) {
  return Promise.all(promises.map(function (p) {
    return Promise.resolve(p).then(
      function (value) { return { status: "fulfilled", value: value }; },
      function (reason) { return { status: "rejected", reason: reason }; }
    );
  }));
}

function withTimeout(promise, ms, fallback) {
  return new Promise(function (resolve) {
    var done = false;
    var tid = setTimeout(function () {
      if (!done) { done = true; resolve(fallback); }
    }, ms);
    Promise.resolve(promise).then(function (val) {
      if (!done) { done = true; clearTimeout(tid); resolve(val); }
    }, function () {
      if (!done) { done = true; clearTimeout(tid); resolve(fallback); }
    });
  });
}

function safeFetch(url, opts, timeoutMs) {
  var ms = timeoutMs || SOURCE_TIMEOUT_MS;
  var options = Object.assign({}, opts || {});
  options.headers = Object.assign({
    "User-Agent": UA_CHROME,
    "Accept": "text/html,application/xhtml+xml,application/json,*/*;q=0.8",
    "Accept-Language": "ar,en-US;q=0.9,en;q=0.8"
  }, options.headers || {});
  var controller = null, tid = null;
  try {
    if (typeof AbortController !== "undefined") {
      controller = new AbortController();
      options.signal = controller.signal;
      tid = setTimeout(function () { try { controller.abort(); } catch (e) {} }, ms);
    }
  } catch (e) {}
  return fetch(url, options).then(function (res) {
    if (tid) clearTimeout(tid);
    return res;
  }, function (err) {
    if (tid) clearTimeout(tid);
    throw err;
  });
}

function fetchText(url, headers, timeoutMs) {
  return safeFetch(url, { headers: headers || {} }, timeoutMs).then(function (r) {
    if (!r.ok) return "";
    return r.text();
  }).catch(function () { return ""; });
}

function fetchJson(url, headers, timeoutMs) {
  return safeFetch(url, { headers: headers || {} }, timeoutMs).then(function (r) {
    if (!r.ok) return null;
    return r.json();
  }).catch(function () { return null; });
}

function absUrl(raw, base) {
  if (!raw) return "";
  var u = String(raw).trim();
  if (u.indexOf("http://") === 0 || u.indexOf("https://") === 0) return u;
  if (u.indexOf("//") === 0) return "https:" + u;
  var origin = String(base || "").replace(/^(https?:\/\/[^\/]+).*$/, "$1");
  if (u.charAt(0) === "/") return origin + u;
  return origin + "/" + u;
}

function decodeHtml(str) {
  return String(str || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(parseInt(n, 10)); });
}

function stripTags(html) {
  return decodeHtml(String(html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function normalizeTitle(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[\u064B-\u065F]/g, "")
    .replace(/(?:فيلم|مسلسل|انمي|مترجم|مدبلج|اون لاين|كامل|مشاهدة|الحلقة|الموسم|season|episode|watch|online|full|hd|4k|1080p|720p)/gi, " ")
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreMatch(candidateTitle, tmdbInfo) {
  var c = normalizeTitle(candidateTitle);
  if (!c) return 0;
  var best = 0;
  for (var i = 0; i < tmdbInfo.titles.length; i++) {
    var t = normalizeTitle(tmdbInfo.titles[i]);
    if (!t) continue;
    if (c === t) return 100;
    if (c.indexOf(t) !== -1 || t.indexOf(c) !== -1) {
      var ratio = Math.min(c.length, t.length) / Math.max(c.length, t.length);
      best = Math.max(best, Math.round(60 + ratio * 35));
    } else {
      var cw = c.split(" ");
      var tw = t.split(" ");
      var overlap = 0;
      for (var j = 0; j < tw.length; j++) {
        if (tw[j].length > 1 && cw.indexOf(tw[j]) !== -1) overlap++;
      }
      if (overlap > 0) {
        best = Math.max(best, Math.round((overlap / Math.max(cw.length, tw.length)) * 75));
      }
    }
  }
  if (tmdbInfo.year && String(candidateTitle).indexOf(String(tmdbInfo.year)) !== -1) {
    best += 10;
  }
  return best;
}

function extractQuality(text) {
  var m = String(text || "").match(/(2160|4K|1080|720|480|360|240)p?/i);
  if (!m) return "HD";
  var q = m[1].toUpperCase();
  return q === "4K" || q === "2160" ? "4K" : q + "p";
}

/* ---------------- Dean Edwards (p,a,c,k,e,d) Unpacker ---------------- */
function unpackDE(html) {
  var out = [];
  var re = /eval\(function\(p,a,c,k,e,[rd]\)[\s\S]*?return p\}\('([\s\S]*?)',\s*(\d+),\s*(\d+),\s*'([^']*)'\.split\('\|'\)/g;
  var m;
  while ((m = re.exec(html)) !== null) {
    try {
      var p = m[1];
      var a = parseInt(m[2], 10);
      var c = parseInt(m[3], 10);
      var k = m[4].split("|");
      var eFn = function (n) {
        return (n < a ? "" : eFn(parseInt(n / a, 10))) +
          ((n = n % a) > 35 ? String.fromCharCode(n + 29) : n.toString(36));
      };
      var d = {};
      while (c--) { d[eFn(c)] = k[c] || eFn(c); }
      var unpacked = p.replace(/\b\w+\b/g, function (w) { return d[w] || w; });
      out.push(unpacked);
    } catch (err) {}
  }
  return out.join("\n");
}

/* ---------------- Universal Embed & Stream Extractor ---------------- */
function extractDirectMediaFromText(text, referer, serverHint) {
  var results = [];
  var seen = {};
  var combined = String(text || "") + "\n" + unpackDE(String(text || ""));
  var re = /(https?:\\?\/\\?\/[^"'\s<>\\]+\.(?:m3u8|mp4|mkv|txt)(?:\?[^"'\s<>\\]*)?)/gi;
  var m;
  while ((m = re.exec(combined)) !== null) {
    var raw = m[1].replace(/\\\//g, "/");
    if (seen[raw] || raw.indexOf("blank.mp4") !== -1) continue;
    seen[raw] = true;
    results.push({
      url: raw,
      quality: extractQuality(raw + " " + (serverHint || "")),
      server: serverHint || "Direct",
      referer: referer
    });
  }
  var fileRe = /(?:file|src|source|url)\s*[:=]\s*["'](https?:[^"']+)["']/gi;
  while ((m = fileRe.exec(combined)) !== null) {
    var u = m[1].replace(/\\\//g, "/");
    if (seen[u]) continue;
    if (/\.(?:m3u8|mp4|txt)|master\.|playlist|manifest/i.test(u)) {
      seen[u] = true;
      results.push({
        url: u,
        quality: extractQuality(u + " " + (serverHint || "")),
        server: serverHint || "Player",
        referer: referer
      });
    }
  }
  return results;
}

function resolveEmbedUrl(embedUrl, referer, serverHint) {
  if (!embedUrl || embedUrl.indexOf("http") !== 0) return Promise.resolve([]);
  if (/\.(?:m3u8|mp4)(?:\?|$)/i.test(embedUrl)) {
    return Promise.resolve([{
      url: embedUrl,
      quality: extractQuality(embedUrl),
      server: serverHint || "Direct",
      referer: referer || embedUrl
    }]);
  }
  var hostMatch = embedUrl.match(/^https?:\/\/([^\/]+)/i);
  var host = hostMatch ? hostMatch[1].toLowerCase() : "";

  if (host.indexOf("ok.ru") !== -1) {
    return fetchText(embedUrl, { "Referer": referer || embedUrl }).then(function (html) {
      var found = extractDirectMediaFromText(html.replace(/\\u0026/g, "&"), embedUrl, serverHint || "Ok.ru");
      var vRe = /"name":"(mobile|lowest|low|sd|hd|full|ultra)"[^}]*"url":"(https?:[^"]+)"/gi;
      var m;
      while ((m = vRe.exec(html)) !== null) {
        found.push({ url: m[2].replace(/\\u0026/g, "&"), quality: m[1].toUpperCase(), server: "Ok.ru", referer: embedUrl });
      }
      return found;
    });
  }

  return fetchText(embedUrl, { "Referer": referer || embedUrl }).then(function (html) {
    if (!html) return [];
    return extractDirectMediaFromText(html, embedUrl, serverHint || host.split(".")[0]);
  });
}

/* ---------------- TMDB Metadata Lookup ---------------- */
function tmdbResolve(tmdbId, mediaType) {
  var type = mediaType === "movie" ? "movie" : "tv";
  var urlEn = TMDB_BASE + "/" + type + "/" + tmdbId + "?api_key=" + TMDB_KEY + "&language=en-US&append_to_response=alternative_titles";
  var urlAr = TMDB_BASE + "/" + type + "/" + tmdbId + "?api_key=" + TMDB_KEY + "&language=ar";
  return Promise.all([fetchJson(urlEn), fetchJson(urlAr)]).then(function (res) {
    var en = res[0] || {};
    var ar = res[1] || {};
    var titles = [];
    function pushTitle(t) {
      if (t && typeof t === "string" && t.trim() && titles.indexOf(t.trim()) === -1) {
        titles.push(t.trim());
      }
    }
    pushTitle(en.title || en.name);
    pushTitle(en.original_title || en.original_name);
    pushTitle(ar.title || ar.name);
    var alts = (en.alternative_titles && (en.alternative_titles.titles || en.alternative_titles.results)) || [];
    for (var i = 0; i < Math.min(alts.length, 6); i++) {
      pushTitle(alts[i].title);
    }
    var date = en.release_date || en.first_air_date || "";
    var year = date ? date.slice(0, 4) : "";
    return {
      tmdbId: tmdbId,
      mediaType: type,
      titles: titles,
      primaryTitle: en.title || en.name || ar.title || ar.name || "",
      year: year
    };
  });
}

/* ---------------- HTML Search & Episode Helpers ---------------- */
function extractAnchors(html, baseUrl) {
  var list = [];
  var re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  var m;
  while ((m = re.exec(html)) !== null) {
    var attrs = m[1];
    var hrefM = attrs.match(/href\s*=\s*["']([^"']+)["']/i);
    if (!hrefM) continue;
    var titleM = attrs.match(/title\s*=\s*["']([^"']+)["']/i);
    var text = stripTags(m[2]);
    var label = (titleM ? decodeHtml(titleM[1]) : "") || text;
    if (!label) continue;
    list.push({ href: absUrl(hrefM[1], baseUrl), title: label, text: text });
  }
  return list;
}

function findBestAnchor(html, baseUrl, tmdbInfo, mediaType) {
  var anchors = extractAnchors(html, baseUrl);
  var best = null, bestScore = 0;
  for (var i = 0; i < anchors.length; i++) {
    var a = anchors[i];
    if (/#|javascript:|wp-login|category\/|tag\/|genre\//i.test(a.href)) continue;
    var sc = scoreMatch(a.title, tmdbInfo);
    if (mediaType === "tv" && /مسلسل|series|season|موسم|episode|حلقة/i.test(a.href + " " + a.title)) sc += 6;
    if (mediaType === "movie" && /فيلم|film|movie/i.test(a.href + " " + a.title)) sc += 6;
    if (sc > bestScore) { bestScore = sc; best = a; }
  }
  return bestScore >= 45 ? best : null;
}

function findEpisodeLink(html, baseUrl, season, episode) {
  var anchors = extractAnchors(html, baseUrl);
  var s = parseInt(season, 10) || 1;
  var e = parseInt(episode, 10) || 1;
  var epPatterns = [
    new RegExp("(?:الحلقة|حلقة|ep|episode|e)[\\s\\-_:]*" + e + "(?:\\b|[^0-9])", "i"),
    new RegExp("S0*" + s + "E0*" + e + "(?:\\b|[^0-9])", "i"),
    new RegExp("/" + e + "/?$")
  ];
  for (var i = 0; i < anchors.length; i++) {
    var target = anchors[i].title + " " + anchors[i].href;
    for (var j = 0; j < epPatterns.length; j++) {
      if (epPatterns[j].test(target)) return anchors[i].href;
    }
  }
  return null;
}

function extractIframesFromHtml(html, baseUrl) {
  var urls = [];
  var re = /<iframe\b[^>]+(?:src|data-src|data-lazy-src)\s*=\s*["']([^"']+)["']/gi;
  var m;
  while ((m = re.exec(html)) !== null) {
    var u = absUrl(m[1], baseUrl);
    if (u && urls.indexOf(u) === -1 && u.indexOf("about:blank") === -1) urls.push(u);
  }
  return urls;
}

function buildSearchUrl(src, query) {
  var q = encodeURIComponent(query);
  return src.url + "/search/?query=" + q + "&type=all";
}

function runHtmlSource(src, tmdbInfo, mediaType, season, episode) {
  var searchQuery = tmdbInfo.primaryTitle;
  var searchUrl = buildSearchUrl(src, searchQuery);

  return fetchText(searchUrl, { "Referer": src.url + "/" }).then(function (searchHtml) {
    if (!searchHtml) return [];
    var match = findBestAnchor(searchHtml, src.url, tmdbInfo, mediaType);
    if (!match) return [];

    return fetchText(match.href, { "Referer": src.url + "/" }).then(function (detailHtml) {
      if (!detailHtml) return [];
      var targetUrl = match.href;
      var pagePromise = Promise.resolve(detailHtml);

      if (mediaType === "tv") {
        var epUrl = findEpisodeLink(detailHtml, src.url, season, episode);
        if (epUrl) {
          targetUrl = epUrl;
          pagePromise = fetchText(epUrl, { "Referer": match.href });
        }
      }

      return pagePromise.then(function (watchHtml) {
        if (!watchHtml) return [];
        var extraPromises = [];

        if (src.id === "topcinema" && targetUrl.indexOf("/watch/") === -1) {
          extraPromises.push(fetchText(targetUrl.replace(/\/+$/, "") + "/watch/", { "Referer": targetUrl }));
        }

        return Promise.all(extraPromises).then(function (extraHtmls) {
          var fullHtml = watchHtml + "\n" + extraHtmls.join("\n");
          var direct = extractDirectMediaFromText(fullHtml, targetUrl, src.name);
          var iframes = extractIframesFromHtml(fullHtml, src.url);

          return allSettled(iframes.slice(0, 6).map(function (iframeUrl) {
            return resolveEmbedUrl(iframeUrl, targetUrl, src.name);
          })).then(function (settled) {
            var all = direct.slice();
            settled.forEach(function (r) { if (r.status === "fulfilled") all = all.concat(r.value); });
            return all;
          });
        });
      });
    });
  });
}

function runSource(src, tmdbInfo, mediaType, season, episode) {
  return withTimeout(runHtmlSource(src, tmdbInfo, mediaType, season, episode), SOURCE_TIMEOUT_MS, []).then(function (streams) {
    return (streams || []).map(function (s) {
      var isHls = s.url.indexOf(".m3u8") !== -1 || s.type === "hls";
      var q = s.quality || extractQuality(s.url);
      return {
        name: src.name + (q ? " - " + q : ""),
        title: src.name + (s.server && s.server !== src.name ? " • " + s.server : ""),
        url: s.url,
        quality: q,
        provider: src.id,
        headers: s.headers || {
          "User-Agent": UA_CHROME,
          "Referer": s.referer || src.url + "/"
        },
        type: isHls ? "hls" : "mp4"
      };
    });
  }).catch(function () { return []; });
}

/* ---------------- Main Nuvio Entry Point ---------------- */
function getStreams(tmdbId, mediaType, season, episode) {
  var t0 = Date.now();
  var type = mediaType === "movie" ? "movie" : "tv";
  log("START", type, tmdbId, "S" + (season || 1), "E" + (episode || 1));

  return tmdbResolve(tmdbId, type).then(function (tmdbInfo) {
    if (!tmdbInfo || !tmdbInfo.primaryTitle) {
      log("TMDB resolution returned no title");
      return [];
    }
    log("Resolved TMDB:", tmdbInfo.primaryTitle, "(" + tmdbInfo.year + ")");

    return allSettled(SOURCES.map(function (src) {
      return runSource(src, tmdbInfo, type, season, episode);
    })).then(function (settled) {
      var final = [];
      var seen = {};
      for (var i = 0; i < settled.length; i++) {
        if (settled[i].status !== "fulfilled") continue;
        var list = settled[i].value || [];
        for (var j = 0; j < list.length; j++) {
          var item = list[j];
          if (!item || !item.url || seen[item.url]) continue;
          seen[item.url] = true;
          final.push(item);
        }
      }
      log("DONE:", final.length, "streams from Top Cinema in", (Date.now() - t0) + "ms");
      return final;
    });
  }).catch(function (err) {
    log("FATAL:", err && err.message);
    return [];
  });
}

module.exports = { getStreams: getStreams };
