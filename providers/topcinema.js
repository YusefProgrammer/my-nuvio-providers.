/**
 * TopCinema - Nuvio JS Provider (Ported from working CloudStream logic)
 * Handles AJAX servers, VidTube unpacking, and episode extraction.
 */

const BASE_URL = "https://topcinemaa.one";
const TMDB_API_KEY = "6c91e91ec97e117e446a62f4d2ace9b7";
const USER_AGENT = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36";

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

function getBaseUrl(url) {
  try {
    var match = String(url).match(/^(https?:\/\/[^\/]+)/);
    return match ? match[1] : BASE_URL;
  } catch (e) { return BASE_URL; }
}

/* ---------------- HTTP Helpers ---------------- */

function fetchHtml(url, referer) {
  var headers = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ar-EG,ar;q=0.9,en-US;q=0.8,en;q=0.7"
  };
  if (referer) headers["Referer"] = referer;
  return fetch(url, { headers: headers })
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.text();
    })
    .catch(function (e) {
      log("Fetch error:", url, e.message);
      return null;
    });
}

function postForm(url, formData, referer) {
  var body = Object.keys(formData).map(function (k) {
    return encodeURIComponent(k) + "=" + encodeURIComponent(formData[k]);
  }).join("&");
  var headers = {
    "User-Agent": USER_AGENT,
    "Accept": "*/*",
    "X-Requested-With": "XMLHttpRequest",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "Accept-Language": "ar-EG,ar;q=0.9,en-US;q=0.8,en;q=0.7"
  };
  if (referer) headers["Referer"] = referer;
  return fetch(url, {
    method: "POST",
    headers: headers,
    body: body
  })
  .then(function (res) { return res.text(); })
  .catch(function (e) {
    log("POST error:", url, e.message);
    return null;
  });
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

/* ---------------- Search & Episode Finder ---------------- */

function findPageUrl(titles, isMovie) {
  var queries = titles.slice(0, 4);
  var promises = queries.map(function (q) {
    return fetchHtml(BASE_URL + "/search/?query=" + encodeURIComponent(q))
      .then(function (html) { return html ? parseSearch(html, titles, isMovie) : null; });
  });
  return Promise.all(promises).then(function (results) {
    for (var i = 0; i < results.length; i++) if (results[i]) return results[i];
    return null;
  });
}

function parseSearch(html, wantedTitles, isMovie) {
  var re = /<a\b[^>]*?href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  var m, best = null, bestScore = 0;
  var wanted = wantedTitles.map(function (t) { return t.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/g, ""); });
  while ((m = re.exec(html)) !== null) {
    var href = m[1];
    var text = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
    var normText = text.replace(/[^a-z0-9\u0600-\u06FF]+/g, "");
    if (/\/(category|tag|page|search|login|register|contact|wp-content|feed|author)\b/i.test(href)) continue;
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

function findEpisodeUrl(seriesHtml, season, episode) {
  var re = /<a\b[^>]*?href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  var m, wantedEp = parseInt(episode, 10), wantedSeason = parseInt(season, 10) || 1;
  var candidates = [];
  while ((m = re.exec(seriesHtml)) !== null) {
    var href = m[1];
    var text = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!/حلقة|الحلقة|episode|ep\s*\d+/i.test(text) && !/episode|ep[-_]?\d+/i.test(href)) continue;
    var epMatch = text.match(/(?:الحلقة|حلقة|episode|ep)\s*(\d+)/i) || href.match(/(?:episode|ep)[-_]?(\d+)/i);
    if (!epMatch) continue;
    var epNum = parseInt(epMatch[1], 10);
    var seasonMatch = text.match(/(?:الموسم|season)\s*(\d+)/i) || href.match(/(?:season|s)[-_]?(\d+)/i);
    var seasonNum = seasonMatch ? parseInt(seasonMatch[1], 10) : 1;
    if (seasonNum === wantedSeason && epNum === wantedEp) candidates.unshift({ url: fixUrl(href, BASE_URL), score: 100 });
    else if (epNum === wantedEp) candidates.push({ url: fixUrl(href, BASE_URL), score: 50 });
  }
  if (candidates.length > 0) {
    candidates.sort(function (a, b) { return b.score - a.score; });
    return candidates[0].url;
  }
  return null;
}

/* ---------------- Core Extraction Logic (from CloudStream) ---------------- */

// Unpacker for Dean Edwards Packer (critical for VidTube)
function unpackJs(p, a, c, k) {
  var digits = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  function intToBase(num, base) {
    if (num === 0) return "0";
    var n = num, sb = "";
    while (n > 0) { sb = digits[n % base] + sb; n = Math.floor(n / base); }
    return sb;
  }
  var mapping = {};
  for (var i = 0; i < c; i++) {
    var key = intToBase(i, a);
    var value = (k && k.length > i) ? k[i] : null;
    if (value && value.length > 0) mapping[key] = value;
  }
  return p.replace(/\b\w+\b/g, function (w) { return mapping[w] !== undefined ? mapping[w] : w; });
}

// Unwrap play.php?to= URLs (from CloudStream)
function unwrapPlayUrl(url) {
  try {
    if (url.indexOf("play.php?to=") !== -1) {
      var decoded = decodeURIComponent(url.substring(url.indexOf("play.php?to=") + "play.php?to=".length)).trim();
      if (decoded.indexOf("https://") !== -1 && decoded.indexOf("https://") !== decoded.lastIndexOf("https://")) {
        decoded = decoded.substring(decoded.lastIndexOf("https://"));
      }
      return decoded.indexOf("http") === 0 ? decoded : "https:" + decoded.replace(/^:/, "");
    }
    return url;
  } catch (e) { return url; }
}

// Extract streams from a /watch/ page (Movies and Episodes)
function extractFromWatchPage(watchUrl) {
  log("Extracting from watch page:", watchUrl);
  return fetchHtml(watchUrl)
    .then(function (html) {
      if (!html) return [];
      var finalWatchUrl = watchUrl; // Note: fetch redirects, but we'll use original for referer
      var baseUrl = getBaseUrl(finalWatchUrl);
      var promises = [];

      // 1. Check direct iframe in player--iframe
      var directIframeMatch = html.match(/<div class="player--iframe">[\s\S]*?<iframe[^>]+src=["']([^"']+)["']/i);
      if (directIframeMatch) {
        log("Found direct iframe:", directIframeMatch[1]);
        promises.push(resolveEmbed(directIframeMatch[1], finalWatchUrl));
      }

      // 2. Iterate through server list (watch--servers--list)
      var serverRegex = /<li[^>]*class="[^"]*server--item[^"]*"[^>]*data-id=["']([^"']+)["'][^>]*data-server=["']([^"']+)["'][^>]*>([\s\S]*?)<\/li>/gi;
      var match;
      while ((match = serverRegex.exec(html)) !== null) {
        var serverId = match[1];
        var serverNum = match[2];
        var serverName = match[3].replace(/<[^>]+>/g, " ").trim() || ("Server " + serverNum);
        promises.push(fetchServerAjax(baseUrl, serverId, serverNum, finalWatchUrl, serverName));
      }

      if (promises.length === 0) { log("No iframes or servers found on watch page"); return []; }
      return Promise.all(promises).then(function (results) {
        var flat = [];
        results.forEach(function (arr) { if (arr) flat = flat.concat(arr); });
        return flat;
      });
    })
    .catch(function (e) { log("extractFromWatchPage error:", e.message); return []; });
}

// Fetch Server.php via AJAX to get the embed iframe
function fetchServerAjax(baseUrl, serverId, serverNum, referer, serverName) {
  var ajaxUrl = baseUrl + "/wp-content/themes/movies2023/Ajaxat/Single/Server.php";
  log("AJAX Server:", serverName, "id:", serverId);
  return postForm(ajaxUrl, { id: serverId, i: serverNum }, referer)
    .then(function (resHtml) {
      if (!resHtml) return [];
      var iframeMatch = resHtml.match(/<iframe[^>]+src=["']([^"']+)["']/i);
      if (!iframeMatch) { log("No iframe in AJAX response for", serverName); return []; }
      var embedUrl = iframeMatch[1];
      log("AJAX returned embed:", embedUrl);
      return resolveEmbed(embedUrl, referer);
    });
}

// Resolve an embed URL (VidTube or others)
function resolveEmbed(embedUrl, referer) {
  var finalUrl = unwrapPlayUrl(embedUrl);
  log("Resolving embed:", finalUrl);
  if (finalUrl.indexOf("vidtube") !== -1) {
    return resolveVidTube(finalUrl, referer);
  }
  // Fallback: try to find direct links in the embed HTML
  return fetchHtml(finalUrl, referer).then(function (html) {
    if (!html) return [];
    var streams = [];
    var mp4Regex = /https?:\/\/[^\s"'<>\\]+\.mp4[^\s"'<>\\]*/gi;
    var m;
    while ((m = mp4Regex.exec(html)) !== null) {
      streams.push({ url: m[0], quality: "HD", label: "Direct" });
    }
    return streams;
  });
}

// VidTube Resolver (Ported from CloudStream)
function resolveVidTube(url, referer) {
  log("VidTube resolving:", url);
  return fetchHtml(url, referer).then(function (html) {
    if (!html) return [];
    var streams = [];

    // 1. Check for download buttons (a[href*='/d/'])
    var dlRegex = /<a[^>]+href=["']([^"']*\/d\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    var m;
    var dlPromises = [];
    while ((m = dlRegex.exec(html)) !== null) {
      var href = m[1];
      var labelMatch = m[2].match(/<b>([^<]+)<\/b>/i);
      var quality = labelMatch ? labelMatch[1].trim() : "Direct";
      var fullUrl = href.indexOf("http") === 0 ? href : getBaseUrl(url) + href;
      dlPromises.push(fetchHtml(fullUrl, url).then(function (dlHtml) {
        if (!dlHtml) return null;
        var directMatch = dlHtml.match(/<a[^>]+href=["']([^"']+\.(?:mp4|m3u8)[^"']*)["']/i) ||
                          dlHtml.match(/href=["']([^"']*download[^"']*)["']/i);
        var finalUrl = directMatch ? directMatch[1] : null;
        if (finalUrl) {
          return { url: finalUrl, quality: quality, label: "VidTube-DL" };
        }
        return null;
      }));
    }

    if (dlPromises.length > 0) {
      return Promise.all(dlPromises).then(function (results) {
        return results.filter(function (r) { return r !== null; });
      });
    }

    // 2. Fallback: Packer unpacking
    var packerMatch = html.match(/eval\(function\(p,a,c,k,e,d\)\{[\s\S]*?\}\(\s*['"]([\s\S]*?)['"]\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*['"]([\s\S]*?)['"]\.split/);
    if (!packerMatch) {
      log("VidTube: No packer found");
      return [];
    }
    var p = packerMatch[1].replace(/\\'/g, "'");
    var a = parseInt(packerMatch[2], 10) || 62;
    var c = parseInt(packerMatch[3], 10) || 0;
    var kStr = packerMatch[4];
    var k = kStr ? kStr.split("|") : [];

    var unpacked = unpackJs(p, a, c, k);
    var fileRegex = /file\s*:\s*["'](https?:\/\/[^"']+)["']/g;
    var labelRegex = /label\s*:\s*["']([^"']+)["']/g;
    var files = [], labels = [], fm, lm;
    while ((fm = fileRegex.exec(unpacked)) !== null) files.push(fm[1]);
    while ((lm = labelRegex.exec(unpacked)) !== null) labels.push(lm[1]);

    for (var i = 0; i < files.length; i++) {
      streams.push({ url: files[i], quality: labels[i] || "Auto", label: "VidTube-Packed" });
    }
    log("VidTube unpacked links:", streams.length);
    return streams;
  });
}

/* ---------------- Main Entry ---------------- */

function getStreams(tmdbId, mediaType, season, episode) {
  log("START:", tmdbId, mediaType, "S" + season, "E" + episode);
  var isMovie = mediaType === "movie";

  return tmdbTitles(tmdbId, mediaType)
    .then(function (info) {
      if (!info.titles.length) { log("No TMDB titles"); return null; }
      return findPageUrl(info.titles, isMovie);
    })
    .then(function (pageUrl) {
      if (!pageUrl) { log("No page found"); return []; }
      log("Main page:", pageUrl);

      return fetchHtml(pageUrl).then(function (html) {
        if (!html) return [];
        var targetUrl = pageUrl;

        // Series: Find episode URL
        if (!isMovie && season != null && episode != null) {
          var epUrl = findEpisodeUrl(html, season, episode);
          if (!epUrl) {
            log("Episode S" + season + "E" + episode + " not found in series page");
            return [];
          }
          log("Episode URL:", epUrl);
          targetUrl = epUrl;
          // Fetch episode page HTML
          return fetchHtml(epUrl).then(function (epHtml) {
            return epHtml;
          });
        }
        return html;
      })
      .then(function (targetHtml) {
        // Determine the final watch URL. CloudStream uses /watch/ suffix.
        // Usually the page HTML contains a link to the watch page.
        var watchUrl = pageUrl;
        var watchMatch = targetHtml.match(/href=["']([^"']*\/watch\/[^"']*)["']/i);
        if (watchMatch) {
          watchUrl = fixUrl(watchMatch[1], BASE_URL);
        } else {
          // If no explicit watch link, try appending /watch/ (common pattern)
          watchUrl = pageUrl.replace(/\/$/, "") + "/watch/";
        }
        log("Final watch URL:", watchUrl);
        return extractFromWatchPage(watchUrl);
      });
    })
    .then(function (streams) {
      if (!streams || !streams.length) { log("No streams extracted"); return []; }
      log("Raw streams found:", streams.length);

      // Deduplicate and format for Nuvio
      var seen = {}, final = [];
      streams.forEach(function (s) {
        if (!s.url || seen[s.url]) return;
        seen[s.url] = true;
        var isHls = s.url.indexOf(".m3u8") !== -1;
        final.push({
          name: "TopCinema - " + (s.quality || "HD"),
          title: "TopCinema \u2022 " + (s.label || "Server") + " (" + (isHls ? "HLS" : "MP4") + ")",
          url: s.url,
          quality: s.quality || "HD",
          provider: "topcinema",
          headers: { "User-Agent": USER_AGENT, "Referer": BASE_URL },
          type: isHls ? "hls" : "mp4"
        });
      });
      log("Final streams:", final.length);
      return final;
    })
    .catch(function (err) {
      log("FATAL:", err && err.message);
      return [];
    });
}

module.exports = { getStreams: getStreams };