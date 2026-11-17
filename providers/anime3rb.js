/**
 * Anime3rb - Nuvio JS Provider
 * Ported from CloudStream Kotlin (Anime3rb).
 * Handles Livewire CSRF/snapshot search, episode extraction, vid3rb streams.
 * Note: Cloudflare may block programmatic access; use a valid session if possible.
 */

var BASE_URL = "https://anime3rb.com";
var USER_AGENT = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";

function log() {
  var args = Array.prototype.slice.call(arguments);
  try { console.log.apply(console, ["[Anime3rb]"].concat(args)); } catch (e) {}
}

function fixUrl(url, base) {
  if (!url) return "";
  var u = String(url).trim();
  if (u.indexOf("http") === 0) return u;
  if (u.indexOf("//") === 0) return "https:" + u;
  if (u.indexOf("/") === 0) return base + u;
  return base + "/" + u;
}

/* ---------------- HTTP Helpers ---------------- */

var _cookies = "";

function fetchText(url, headers, credentials) {
  var h = Object.assign({ "User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml" }, headers || {});
  var opts = { headers: h };
  if (credentials) opts.credentials = "include";
  return fetch(url, opts)
    .then(function (res) {
      // Capture set-cookie (may be restricted in Nuvio; best-effort)
      try {
        var sc = res.headers.get("set-cookie");
        if (sc) _cookies = sc;
      } catch (e) {}
      return res.text();
    })
    .catch(function (e) { log("fetch error:", url, e.message); return null; });
}

function fetchJson(url, headers) {
  var h = Object.assign({ "User-Agent": USER_AGENT, "Accept": "application/json" }, headers || {});
  return fetch(url, { headers: h, credentials: "include" })
    .then(function (res) { return res.json(); })
    .catch(function (e) { log("json error:", url, e.message); return null; });
}

function postJson(url, body, headers) {
  var h = Object.assign({
    "User-Agent": USER_AGENT,
    "Content-Type": "application/json",
    "Accept": "application/json"
  }, headers || {});
  return fetch(url, { method: "POST", headers: h, body: JSON.stringify(body), credentials: "include" })
    .then(function (res) { return res.json(); })
    .catch(function (e) { log("post error:", url, e.message); return null; });
}

/* ---------------- HTML Parsing Helpers ---------------- */

function extractText(html, regex) {
  var m = html.match(regex);
  return m ? m[1].trim() : "";
}

function cleanTitle(text) {
  return text
    .replace(/\\n/g, " ")
    .replace(/\n/g, " ")
    .replace(/بترجمة.*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/* ---------------- Search (Livewire) ---------------- */

function searchAnime3rb(query) {
  return fetchText(BASE_URL + "/", null, true).then(function (homeHtml) {
    if (!homeHtml) { log("No home page"); return []; }

    // 1. Extract CSRF token and update URI
    var csrfMatch = homeHtml.match(/data-csrf=["']([^"']+)["']/);
    var updateUriMatch = homeHtml.match(/data-update-uri=["']([^"']+)["']/);
    var csrf = csrfMatch ? csrfMatch[1] : null;
    var updateUrl = updateUriMatch ? fixUrl(updateUriMatch[1], BASE_URL) : BASE_URL + "/livewire/update";

    if (!csrf) { log("No CSRF token found"); return []; }

    // 2. Extract wire:snapshot from form
    var snapshotMatch = homeHtml.match(/wire:snapshot=["']([^"']+)["']/);
    if (!snapshotMatch) { log("No wire:snapshot found"); return []; }
    var snapshotRaw = snapshotMatch[1]
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&")
      .replace(/&#039;/g, "'");

    // 3. Build Livewire payload
    var payload = {
      _token: csrf,
      components: [{
        snapshot: snapshotRaw,
        updates: { query: query },
        calls: []
      }]
    };

    var headers = {
      "X-Livewire": "1",
      "X-Requested-With": "XMLHttpRequest",
      "Origin": BASE_URL,
      "Referer": BASE_URL + "/"
    };
    if (_cookies) headers["Cookie"] = _cookies;

    return postJson(updateUrl, payload, headers).then(function (json) {
      if (!json || !json.components || !json.components.length) {
        log("Invalid Livewire response");
        return [];
      }
      var effects = json.components[0].effects || {};
      var html = effects.html || "";
      if (!html) { log("No HTML in response"); return []; }

      // 4. Parse search results from returned HTML
      var results = [];
      var re = /<a[^>]+href=["']([^"']+)["'][^>]*>[\s\S]*?<h4[^>]*>([\s\S]*?)<\/h4>/gi;
      var m;
      while ((m = re.exec(html)) !== null) {
        var href = fixUrl(m[1], BASE_URL);
        var title = cleanTitle(m[2].replace(/<[^>]+>/g, "").trim());
        if (title) results.push({ url: href, title: title });
      }
      log("Search results:", results.length);
      return results;
    });
  });
}

/* ---------------- Episode Extraction ---------------- */

function extractEpisodes(seriesUrl) {
  return fetchText(seriesUrl, null, true).then(function (html) {
    if (!html) return [];
    var episodes = [];
    // Episode links are typically in .video-list a
    var re = /<a[^>]+href=["']([^"']+)["'][^>]*>[\s\S]*?<div[^>]*class=["'][^"']*video-data[^"']*["'][^>]*>[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>/gi;
    var m;
    while ((m = re.exec(html)) !== null) {
      var href = fixUrl(m[1], BASE_URL);
      var epText = m[2].replace(/<[^>]+>/g, "").trim();
      var epName = m[3].replace(/<[^>]+>/g, "").trim();
      var epNum = parseInt(epText.replace(/[^0-9]/g, ""), 10);
      if (href && !isNaN(epNum)) {
        episodes.push({ url: href, episode: epNum, name: epName || epText });
      }
    }
    // Fallback: simpler regex if the above fails
    if (episodes.length === 0) {
      var re2 = /<a[^>]+href=["']([^"']+)["'][^>]*>[\s\S]*?الحلقة\s*(\d+)/gi;
      while ((m = re2.exec(html)) !== null) {
        episodes.push({ url: fixUrl(m[1], BASE_URL), episode: parseInt(m[2], 10), name: "الحلقة " + m[2] });
      }
    }
    log("Episodes found:", episodes.length);
    return episodes;
  });
}

/* ---------------- Stream Extraction from Episode Page ---------------- */

function extractStreamsFromEpisode(episodeUrl) {
  return fetchText(episodeUrl, null, true).then(function (html) {
    if (!html) return [];
    // Find player URL (vid3rb)
    var playerMatch = html.match(/https:(?:\\\/|\/){2}video\.vid3rb\.com(?:\\\/|\/)player(?:\\\/|\/)[^"']+/i);
    if (!playerMatch) { log("No vid3rb player found"); return []; }
    var playerUrl = playerMatch[0].replace(/\\/g, "").replace(/&amp;/g, "&").replace(/\\u0026/g, "&");
    log("Player URL:", playerUrl);

    var videoHeaders = {
      "User-Agent": USER_AGENT,
      "Referer": BASE_URL + "/",
      "Sec-Fetch-Dest": "iframe",
      "Sec-Fetch-Site": "cross-site"
    };
    return fetchText(playerUrl, videoHeaders, true).then(function (playerHtml) {
      if (!playerHtml) return [];
      // Extract video_sources JSON array
      var srcMatch = playerHtml.match(/var\s+video_sources\s*=\s*(\[[\s\S]*?\]);/);
      if (!srcMatch) { log("No video_sources"); return []; }
      var sourcesStr = srcMatch[1].replace(/\\/g, "").replace(/&amp;/g, "&").replace(/\\u0026/g, "&");
      var sources;
      try { sources = JSON.parse(sourcesStr); } catch (e) { log("JSON parse error"); return []; }

      var streams = [];
      sources.forEach(function (item) {
        if (item.premium === "true" || item.premium === true) return;
        var src = item.src;
        if (!src) return;
        var label = item.label || "Auto";
        var quality = parseInt(label.replace(/[^0-9]/g, ""), 10) || 480;
        streams.push({
          url: src,
          quality: quality,
          label: "Anime3rb " + label,
          referer: "https://video.vid3rb.com/"
        });
      });
      log("Streams extracted:", streams.length);
      return streams;
    });
  });
}

/* ---------------- Main Entry ---------------- */

function getStreams(tmdbId, mediaType, season, episode) {
  log("START:", tmdbId, mediaType, "S" + season, "E" + episode);

  // We need a title to search. Use TMDB (same key as before) or fallback.
  // For simplicity, if tmdbId is numeric, fetch TMDB title.
  var TMDB_KEY = "6c91e91ec97e117e446a62f4d2ace9b7";
  var isMovie = mediaType === "movie";
  var tmdbUrl = "https://api.themoviedb.org/3/" + (isMovie ? "movie" : "tv") + "/" + tmdbId + "?api_key=" + TMDB_KEY + "&append_to_response=translations,alternative_titles";

  return fetch(tmdbUrl).then(function (r) { return r.json(); }).then(function (d) {
    var titles = [];
    var push = function (t) { if (t && titles.indexOf(t) === -1) titles.push(t); };
    push(d.title); push(d.name); push(d.original_title); push(d.original_name);
    if (d.translations && d.translations.translations) {
      d.translations.translations.forEach(function (tr) {
        if (tr.iso_639_1 === "ar" && tr.data) { push(tr.data.title); push(tr.data.name); }
      });
    }
    if (!titles.length) { log("No titles"); return []; }
    log("Titles:", titles.join(" | "));

    // Search first title
    return searchAnime3rb(titles[0]).then(function (results) {
      if (!results.length) { log("No search results"); return []; }
      var best = results[0];
      log("Selected series:", best.title, best.url);

      if (isMovie) {
        // Anime movie might be a single episode page; treat as episode
        return extractStreamsFromEpisode(best.url);
      } else {
        // TV series: extract episodes, find matching episode
        return extractEpisodes(best.url).then(function (episodes) {
          if (!episodes.length) { log("No episodes"); return []; }
          var wantEp = parseInt(episode, 10) || 1;
          var target = null;
          for (var i = 0; i < episodes.length; i++) {
            if (episodes[i].episode === wantEp) { target = episodes[i]; break; }
          }
          if (!target) { log("Episode " + wantEp + " not found"); return []; }
          log("Playing episode:", target.name);
          return extractStreamsFromEpisode(target.url);
        });
      }
    });
  }).then(function (streams) {
    if (!streams || !streams.length) { log("No streams"); return []; }
    var final = [], seen = {};
    streams.forEach(function (s) {
      if (!s.url || seen[s.url]) return;
      seen[s.url] = true;
      var isHls = s.url.indexOf(".m3u8") !== -1;
      final.push({
        name: "Anime3rb - " + (s.quality || "HD"),
        title: "Anime3rb \u2022 " + (s.label || "Server") + " (" + (isHls ? "HLS" : "MP4") + ")",
        url: s.url,
        quality: s.quality || "HD",
        provider: "anime3rb",
        headers: { "User-Agent": USER_AGENT, "Referer": s.referer || BASE_URL },
        type: isHls ? "hls" : "mp4"
      });
    });
    log("Final streams:", final.length);
    return final;
  }).catch(function (err) { log("FATAL:", err && err.message); return []; });
}

module.exports = { getStreams: getStreams };