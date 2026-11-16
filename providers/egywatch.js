/**
 * EgyWatch - Nuvio JS Provider (Merged)
 * - Search + servers: JSON API (gateway.egywatch.live)
 * - Embed resolution: HTML extraction (Dean Edwards + iframes)
 * Compatible with NuvioTV (QuickJS 1.0.5) and NuvioMobile (QuickJS 1.0.15)
 */

var DEFAULT_MAIN_URL = "https://gateway.egywatch.live/egywatchapp/public/api";
var DEFAULT_TMDB_API_KEY = "6c91e91ec97e117e446a62f4d2ace9b7";
var PROVIDER_ID = "egy";
var PROVIDER_NAME = "EgyWatch";
var CUSTOM_PREFIX = "egy_";
var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
var APP_UA = "EasyPlex (Android 14; M2006C3MG; Redmi angelica; en)";

function getSettings() {
  var s = (typeof globalThis !== "undefined" && globalThis.SCRAPER_SETTINGS) ? globalThis.SCRAPER_SETTINGS : {};
  return s || {};
}

function getMainUrl() {
  var s = getSettings();
  var domain = (s.domain && String(s.domain).trim()) ? String(s.domain).trim() : DEFAULT_MAIN_URL;
  return domain.replace(/\/+$/, "");
}

function getTmdbKey() {
  if (typeof globalThis !== "undefined" && globalThis.TMDB_API_KEY && String(globalThis.TMDB_API_KEY).trim()) {
    return String(globalThis.TMDB_API_KEY).trim();
  }
  return DEFAULT_TMDB_API_KEY;
}

/* ---------------- HTTP ---------------- */

async function safeTextFetch(url, options) {
  try {
    var opts = options || {};
    var headers = Object.assign({
      "User-Agent": USER_AGENT,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }, opts.headers || {});
    var res = await fetch(url, { method: opts.method || "GET", headers: headers, body: opts.body });
    if (!res || !res.ok || res.status === 0) return null;
    var text = await res.text();
    return { text: text, url: res.url || url };
  } catch (e) {
    return null;
  }
}

async function safeJsonFetch(url, options) {
  try {
    var opts = options || {};
    var headers = Object.assign({
      "User-Agent": USER_AGENT,
      "Accept": "application/json, text/plain, */*"
    }, opts.headers || {});
    var res = await fetch(url, { method: opts.method || "GET", headers: headers, body: opts.body });
    if (!res || !res.ok || res.status === 0) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

/* ---------------- JSON API (new server fetching) ---------------- */

async function apiSearch(query) {
  var body = "q=" + encodeURIComponent(query);
  return safeJsonFetch(getMainUrl() + "/search", {
    method: "POST",
    headers: {
      "User-Agent": APP_UA,
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json"
    },
    body: body
  });
}

async function apiGet(endpoint) {
  return safeJsonFetch(getMainUrl() + "/" + endpoint, {
    headers: {
      "User-Agent": APP_UA,
      "Accept": "application/json"
    }
  });
}

/* ---------------- utilities ---------------- */

function safeDecodeUri(s) {
  try { return decodeURIComponent(s); } catch (e) { return s; }
}

function decodeIdSlug(slug) {
  return safeDecodeUri(String(slug).replace(/~([0-9a-fA-F]{2})/g, "%$1"));
}

function stripTagsText(s) {
  return String(s || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

function fixUrl(url, baseUrl) {
  if (!url) return "";
  var u = String(url).trim();
  if (u.indexOf("http://") === 0 || u.indexOf("https://") === 0) return u;
  if (u.indexOf("//") === 0) return "https:" + u;
  if (u.indexOf("/") === 0) return baseUrl + u;
  return baseUrl + "/" + u;
}

function normName(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, "");
}

function isDirectMedia(url) {
  return /\.(mp4|m3u8|mpd|mkv|webm)(\?.*)?$/i.test(String(url).split("?")[0]);
}

/* ---------------- Dean Edwards unpacker (embed pages) ---------------- */

function unpackDeanEdwards(evalText) {
  try {
    var m = evalText.match(/}\s*\(\s*(['"])([\s\S]*?)\1\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(['"])([\s\S]*?)\5\.split\(['"]\|['"]\)/);
    if (!m) return null;
    var p = m[2];
    var a = parseInt(m[3], 10);
    var c = parseInt(m[4], 10);
    var k = m[6].split("|");
    var chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    function toBase(num, radix) {
      if (num === 0) return "0";
      var n = num; var out = "";
      while (n > 0) { out = chars[n % radix] + out; n = Math.floor(n / radix); }
      return out;
    }
    var dict = {};
    for (var i = 0; i < c; i++) {
      var key = toBase(i, a);
      dict[key] = (i < k.length && k[i]) ? k[i] : key;
    }
    return p.replace(/\b\w+\b/g, function (w) { return dict[w] !== undefined ? dict[w] : w; });
  } catch (e) {
    return null;
  }
}

/* ---------------- TMDB target resolution (from old code) ---------------- */

async function resolveTargetInfo(rawId, mediaType) {
  var idStr = String(rawId || "").trim();

  if (idStr.indexOf(CUSTOM_PREFIX) === 0) {
    var slug = decodeIdSlug(idStr.slice(CUSTOM_PREFIX.length).split(":")[0].replace(/__/g, "/"));
    return { customSlug: slug, titles: [] };
  }
  if (idStr.indexOf(PROVIDER_ID + "_") === 0) {
    var slug2 = decodeIdSlug(idStr.slice((PROVIDER_ID + "_").length).split(":")[0].replace(/__/g, "/"));
    return { customSlug: slug2, titles: [] };
  }

  var normalizedType = (String(mediaType || "movie").toLowerCase() === "movie") ? "movie" : "tv";

  var malMatch = idStr.match(/^mal:(\d+)(?::(\d+))?$/i);
  if (malMatch) {
    var malId = malMatch[1];
    var aniRes = await safeJsonFetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "query($idMal: Int){Media(idMal: $idMal, type: ANIME){title{romaji english}}}",
        variables: { idMal: parseInt(malId, 10) }
      })
    });
    var media = aniRes && aniRes.data && aniRes.data.Media ? aniRes.data.Media : null;
    var malTitles = [];
    if (media && media.title) {
      if (media.title.english) malTitles.push(media.title.english);
      if (media.title.romaji && malTitles.indexOf(media.title.romaji) === -1) malTitles.push(media.title.romaji);
    }
    return { titles: malTitles };
  }

  var tmdbKey = getTmdbKey();
  var cleanId = idStr.replace(/^(?:tmdb:|movie:|series:|tv:)/i, "").split(":")[0].trim();
  var tmdbId = null;

  if (/^tt\d+$/i.test(cleanId)) {
    var findData = await safeJsonFetch("https://api.themoviedb.org/3/find/" + cleanId + "?api_key=" + tmdbKey + "&external_source=imdb_id");
    if (findData) {
      var list = (normalizedType === "movie")
        ? (findData.movie_results && findData.movie_results.length ? findData.movie_results : findData.tv_results)
        : (findData.tv_results && findData.tv_results.length ? findData.tv_results : findData.movie_results);
      if (list && list.length > 0) tmdbId = String(list[0].id);
    }
  } else if (/^\d+$/.test(cleanId)) {
    tmdbId = cleanId;
  }

  if (!tmdbId) return { titles: [] };

  var details = await safeJsonFetch("https://api.themoviedb.org/3/" + normalizedType + "/" + tmdbId + "?api_key=" + tmdbKey + "&append_to_response=translations");
  if (!details) return { titles: [] };

  var titles = [];
  var en = details.title || details.name;
  var orig = details.original_title || details.original_name;
  if (en && titles.indexOf(en) === -1) titles.push(en);
  if (orig && titles.indexOf(orig) === -1) titles.push(orig);

  if (details.translations && Array.isArray(details.translations.translations)) {
    for (var i = 0; i < details.translations.translations.length; i++) {
      var tr = details.translations.translations[i];
      if (tr && tr.iso_639_1 === "ar" && tr.data) {
        var t = tr.data.title || tr.data.name;
        if (t && String(t).trim() && titles.indexOf(String(t).trim()) === -1) titles.push(String(t).trim());
      }
    }
  }
  return { titles: titles, year: (details.release_date || details.first_air_date || "").split("-")[0] || null };
}

/* ---------------- find item on EgyWatch API ---------------- */

function yearOk(it, year) {
  var y = parseInt(it.year, 10);
  if (!y) y = parseInt(it.release_year, 10);
  if (!y) y = parseInt(it.production_year, 10);
  if (!y) y = parseInt(String(it.release_date || it.date || it.first_air_date || "").slice(0, 4), 10);
  return !year || !y || y <= 1900 || Math.abs(y - year) <= 1;
}

async function findItem(titles, year, isMovie) {
  var seen = {};
  var pool = [];
  var results = await Promise.all(titles.slice(0, 6).map(apiSearch));
  for (var i = 0; i < results.length; i++) {
    var res = results[i];
    var list = res ? (Array.isArray(res) ? res : (res.results || res.data || [])) : [];
    for (var j = 0; j < list.length; j++) {
      var r = list[j];
      var id = r ? String(r.id || r.movie_id || r.series_id) : "";
      if (!id || seen[id]) continue;
      seen[id] = true;
      pool.push(r);
    }
  }
  var cand = pool.filter(function (r) { return yearOk(r, year); });
  var qs = titles.map(normName).filter(function (q) { return q.length >= 3; });

  for (var i2 = 0; i2 < qs.length; i2++) {
    for (var j2 = 0; j2 < cand.length; j2++) {
      if (normName(cand[j2].name || cand[j2].title) === qs[i2]) return cand[j2];
    }
  }
  for (var i3 = 0; i3 < qs.length; i3++) {
    if (qs[i3].length < 4) continue;
    for (var j3 = 0; j3 < cand.length; j3++) {
      var nm = normName(cand[j3].name || cand[j3].title);
      if (nm.length >= 4 && (nm.indexOf(qs[i3]) !== -1 || qs[i3].indexOf(nm) !== -1)) return cand[j3];
    }
  }
  return cand[0] || pool[0] || null;
}

/* ---------------- HTML media extraction (from old code) ---------------- */

async function extractMediaFromHtml(htmlRaw, pageUrl, baseUrl) {
  var results = [];
  if (!htmlRaw) return results;
  var html = htmlRaw.replace(/\\\//g, "/");

  // 1. Direct <source> / <video> tags
  var srcRegex = /<(?:source|video)[^>]*src=["']([^"']+)["'][^>]*>/gi;
  var sm;
  while ((sm = srcRegex.exec(html)) !== null) {
    var src = fixUrl(sm[1], baseUrl);
    if (src && (src.indexOf(".mp4") !== -1 || src.indexOf(".m3u8") !== -1)) {
      var qM = sm[0].match(/size=["']?(\d+)["']?/i) || src.match(/(\d{3,4})p/i);
      results.push({ url: src, quality: qM ? (qM[1] + "p") : "720p", referer: pageUrl, label: "Direct" });
    }
  }

  // 2. Dean Edwards packed JS
  var evalMatches = html.match(/eval\s*\(\s*function\s*\(\s*p\s*,\s*a\s*,\s*c\s*,\s*k\s*,\s*e\s*,\s*d\s*\)[\s\S]{1,15000}/gi) || [];
  for (var eIdx = 0; eIdx < evalMatches.length; eIdx++) {
    var unpacked = unpackDeanEdwards(evalMatches[eIdx]);
    if (unpacked) {
      var packedMedia = unpacked.match(/https?:\/\/[^\s"'<>\\]+\.(?:m3u8|mp4)[^\s"'<>\\]*/gi) || [];
      for (var pIdx = 0; pIdx < packedMedia.length; pIdx++) {
        results.push({ url: packedMedia[pIdx], quality: "1080p", referer: pageUrl, label: "Packed Server" });
      }
    }
  }

  // 3. Direct m3u8 / mp4 links
  var directMatches = html.match(/https?:\/\/[^\s"'<>\\]+\.(?:m3u8|mp4)[^\s"'<>\\]*/gi) || [];
  for (var dIdx = 0; dIdx < directMatches.length; dIdx++) {
    var u = directMatches[dIdx];
    if (u.indexOf(".jpg") === -1 && u.indexOf(".png") === -1) {
      results.push({
        url: u,
        quality: u.indexOf("1080") !== -1 ? "1080p" : (u.indexOf("720") !== -1 ? "720p" : "HD"),
        referer: pageUrl,
        label: "Stream"
      });
    }
  }

  // 4. Iframes / data-embed / data-watch / data-server (up to 3 embeds)
  var embedUrls = [];
  var embedRegex = /(?:<iframe[^>]*src|data-embed|data-watch|data-server|data-src)=["']([^"']+)["']/gi;
  var em;
  while ((em = embedRegex.exec(html)) !== null) {
    var eUrl = fixUrl(em[1], baseUrl);
    if (
      eUrl && eUrl.indexOf("http") === 0 &&
      eUrl.indexOf("facebook.com") === -1 &&
      eUrl.indexOf("google.com") === -1 &&
      eUrl.indexOf("youtube.com/embed") === -1 &&
      !/\.(?:jpg|jpeg|png|webp|svg|gif)(?:\?|$)/i.test(eUrl) &&
      embedUrls.indexOf(eUrl) === -1
    ) {
      embedUrls.push(eUrl);
    }
  }

  for (var i = 0; i < Math.min(embedUrls.length, 3); i++) {
    var emb = embedUrls[i];
    var eRes = await safeTextFetch(emb, { headers: { Referer: pageUrl } });
    if (!eRes || !eRes.text) continue;
    var eHtml = eRes.text.replace(/\\\//g, "/");

    var pbMatch = eHtml.match(/https?:\/\/[^"'\s]+\/api\/videos\/[^"'\s]+\/playback[^"'\s]*/i);
    if (pbMatch) {
      var pbJson = await safeJsonFetch(pbMatch[0], { headers: { Referer: emb } });
      if (pbJson && pbJson.url) {
        results.push({ url: pbJson.url, quality: "1080p", referer: emb, label: "HLS Server" });
      }
    }

    if (eHtml.indexOf("function(p,a,c,k,e,d)") !== -1) {
      var unp = unpackDeanEdwards(eHtml);
      if (unp) {
        var um = unp.match(/https?:\/\/[^\s"'<>\\]+\.(?:m3u8|mp4)[^\s"'<>\\]*/gi) || [];
        for (var k = 0; k < um.length; k++) {
          results.push({ url: um[k], quality: "1080p", referer: emb, label: "Embed Server " + (i + 1) });
        }
      }
    }

    var dm = eHtml.match(/https?:\/\/[^\s"'<>\\]+\.(?:m3u8|mp4)[^\s"'<>\\]*/gi) || [];
    for (var j = 0; j < dm.length; j++) {
      results.push({ url: dm[j], quality: "720p", referer: emb, label: "Embed " + (i + 1) });
    }
  }

  return results;
}

async function resolveEmbedUrl(embedUrl, mainUrl) {
  var res = await safeTextFetch(embedUrl, { headers: { Referer: mainUrl + "/", "User-Agent": USER_AGENT } });
  if (!res || !res.text) return [];
  var html = res.text;
  var finalUrl = res.url || embedUrl;

  // Follow watch button if present
  var watchBtnMatch = html.match(/<a[^>]*href=["']([^"']+)["'][^>]*class=["'][^"']*(?:watch_player|xtgo|link-show)[^"']*["']|<a[^>]*class=["'][^"']*(?:watch_player|xtgo|link-show)[^"']*["'][^>]*href=["']([^"']+)["']/i);
  if (watchBtnMatch && (watchBtnMatch[1] || watchBtnMatch[2])) {
    var wUrl = fixUrl(watchBtnMatch[1] || watchBtnMatch[2], mainUrl);
    var wRes = await safeTextFetch(wUrl, { headers: { Referer: finalUrl } });
    if (wRes && wRes.text) {
      html = wRes.text + "\n" + html;
      finalUrl = wRes.url || wUrl;
    }
  }

  return await extractMediaFromHtml(html, finalUrl, mainUrl);
}

/* ---------------- stream builder ---------------- */

function makeStream(url, quality, label, referer) {
  var isHls = url.indexOf(".m3u8") !== -1;
  return {
    name: PROVIDER_NAME + " - " + (quality || "HD"),
    title: PROVIDER_NAME + " \u2022 " + (label || "Stream") + " (" + (isHls ? "HLS" : "MP4") + ")",
    url: url,
    quality: quality || "1080p",
    language: "ar",
    provider: PROVIDER_ID,
    type: isHls ? "hls" : "mp4",
    headers: { "User-Agent": USER_AGENT, "Referer": referer || "" },
    subtitles: []
  };
}

function toStreams(extracted) {
  var out = [];
  var seen = {};
  for (var i = 0; i < extracted.length; i++) {
    var it = extracted[i];
    if (!it || !it.url || seen[it.url]) continue;
    seen[it.url] = true;
    out.push(makeStream(it.url, it.quality, it.label, it.referer));
  }
  return out;
}

/* ---------------- main flow ---------------- */

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    var mainUrl = getMainUrl();
    var targetInfo = await resolveTargetInfo(tmdbId, mediaType);

    // Custom slug: scrape HTML page directly (old behavior)
    if (targetInfo.customSlug) {
      var url = targetInfo.customSlug.indexOf("http") === 0
        ? targetInfo.customSlug
        : fixUrl(targetInfo.customSlug, mainUrl);
      var res = await safeTextFetch(url, { headers: { Referer: mainUrl + "/" } });
      if (!res || !res.text) return [];
      var extracted = await extractMediaFromHtml(res.text, res.url || url, mainUrl);
      return toStreams(extracted);
    }

    var titles = targetInfo.titles || [];
    var year = targetInfo.year || null;
    if (!titles.length) return [];

    var isMovie = String(mediaType || "movie").toLowerCase() === "movie";
    var item = await findItem(titles, year, isMovie);
    if (!item) return [];

    var itemId = item.id || item.movie_id || item.series_id;
    if (!itemId) return [];

    // Collect server links from JSON API
    var serverLinks = [];

    if (isMovie) {
      var sv = await apiGet("movie/" + itemId + "/servers");
      var arr = (sv && (sv.servers || sv)) || [];
      for (var i = 0; i < arr.length; i++) {
        var l = arr[i];
        var u = (typeof l === "string") ? l : (l.link || l.url);
        if (typeof u === "string" && /^http/.test(u)) serverLinks.push(u);
      }
    } else {
      var seasons = await apiGet("series/" + itemId + "/seasons");
      var seasonList = Array.isArray(seasons) ? seasons : ((seasons && seasons.seasons) || []);
      var wantSeason = parseInt(season, 10) || 1;
      var targetSeason = null;

      for (var si = 0; si < seasonList.length; si++) {
        if (String(seasonList[si].season_number || seasonList[si].number) === String(wantSeason)) {
          targetSeason = seasonList[si];
          break;
        }
      }
      if (!targetSeason) targetSeason = seasonList[0];

      var epList = (targetSeason && (targetSeason.episodes || targetSeason.eps)) || [];
      var wantEp = parseInt(episode, 10) || 1;
      var targetEp = null;

      for (var ei = 0; ei < epList.length; ei++) {
        var epObj = epList[ei];
        var epNum = 0;
        if (epObj.episode_number != null) epNum = parseInt(epObj.episode_number, 10);
        else if (epObj.number != null) epNum = parseInt(epObj.number, 10);
        else if (epObj.title) {
          var mm = String(epObj.title).match(/\d+/);
          epNum = mm ? parseInt(mm[0], 10) : 0;
        }
        if (epNum === wantEp) { targetEp = epObj; break; }
      }
      if (!targetEp) targetEp = epList[wantEp - 1];

      if (targetEp && targetEp.id) {
        var epSv = await apiGet("episode/" + targetEp.id + "/servers");
        var arr2 = (epSv && (epSv.servers || epSv)) || [];
        for (var i2 = 0; i2 < arr2.length; i2++) {
          var l2 = arr2[i2];
          var u2 = (typeof l2 === "string") ? l2 : (l2.link || l2.url);
          if (typeof u2 === "string" && /^http/.test(u2)) serverLinks.push(u2);
        }
      }
    }

    // Resolve each server link
    var streams = [];
    var seen = {};

    for (var k = 0; k < serverLinks.length; k++) {
      var link = serverLinks[k];
      if (seen[link]) continue;

      if (isDirectMedia(link)) {
        seen[link] = true;
        streams.push(makeStream(link, "1080p", "Direct", link));
      } else {
        var ex = await resolveEmbedUrl(link, mainUrl);
        for (var n = 0; n < ex.length; n++) {
          var it = ex[n];
          if (!it || !it.url || seen[it.url]) continue;
          seen[it.url] = true;
          streams.push(makeStream(it.url, it.quality, it.label, it.referer || link));
        }
      }
    }

    return streams;
  } catch (err) {
    console.error("[" + PROVIDER_NAME + "] getStreams error: " + (err && err.message ? err.message : err));
    return [];
  }
}

/* ---------------- settings ---------------- */

function onSettings() {
  return [
    { type: "header", label: PROVIDER_NAME + " Settings" },
    {
      type: "text",
      key: "domain",
      label: "Base URL",
      placeholder: DEFAULT_MAIN_URL,
      defaultValue: DEFAULT_MAIN_URL
    }
  ];
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams: getStreams, onSettings: onSettings };
}
if (typeof globalThis !== "undefined") {
  globalThis.getStreams = getStreams;
  globalThis.onSettings = onSettings;
                  }
