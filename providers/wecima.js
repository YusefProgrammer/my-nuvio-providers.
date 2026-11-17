/**
 * WeCima - Nuvio JS Provider (Best-Effort Port)
 * Ported from CloudStream Kotlin (WecimaProvider).
 * NOTE: Site is Cloudflare-protected. Works only if cookie is valid or CF is not challenging.
 */

var BASE_URL = "https://wecima.lifestyle";
var CF_COOKIE = "cf_clearance=ED0NVzmNRSWM57kanLn3lwlIaUBtZI2vPk1ZAP6zyfA-1763125072-1.2.1.1-eWAxOeBZN.zpvnXMgT46AJocpEalzqZ3WXlNZzjhIhJEvbNkRhY1Mz84sv6onyU7zfGBygnr3XbAw955PxJHjnRFUMqcp6o0rbp5wT4hJMMFiUaOSABpAAx.9G7sYlmslO5bpns2BZxvxUlV3onCRMAQY7lUHW.MCZCH10MtRNaPKsDmxvtZo14sQDLEXyu8tEDOAkjElHCHAW3iyseTRNN2j0Zd7ceblYh28.E7PwA;";
var UA = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36";
var TMDB_KEY = "6c91e91ec97e117e446a62f4d2ace9b7";

var STREAMWISH_DOMAINS = ["vibuxer.com","hanerix.com","niramirus.com","hglamioz.com","playnixes.com","medixiru.com"];

function log() { var a = Array.prototype.slice.call(arguments); try { console.log.apply(console, ["[WeCima]"].concat(a)); } catch(e){} }
function fixUrl(u, b) { if (!u) return ""; var s = String(u).trim(); if (s.indexOf("http")===0) return s; if (s.indexOf("//")===0) return "https:"+s; if (s.indexOf("/")===0) return b+s; return b+"/"+s; }
function getBaseUrl(u) { var m = String(u).match(/^(https?:\/\/[^\/]+)/); return m?m[1]:BASE_URL; }

/* ---------------- HTTP ---------------- */

function fetchHtml(url, referer) {
  var h = { "User-Agent": UA, "Accept": "text/html", "Accept-Language": "ar-EG,ar;q=0.9", "Referer": referer || BASE_URL + "/" };
  if (CF_COOKIE) h["Cookie"] = CF_COOKIE;
  return fetch(url, { headers: h })
    .then(function(r){ if (!r.ok) throw new Error("HTTP "+r.status); return r.text(); })
    .catch(function(e){ log("fetch error:", url, e.message); return null; });
}

function postForm(url, data, referer) {
  var body = Object.keys(data).map(function(k){ return encodeURIComponent(k)+"="+encodeURIComponent(data[k]); }).join("&");
  var h = { "User-Agent": UA, "Accept": "application/json, text/javascript, */*; q=0.01", "X-Requested-With": "XMLHttpRequest", "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "Referer": referer || BASE_URL + "/" };
  if (CF_COOKIE) h["Cookie"] = CF_COOKIE;
  return fetch(url, { method: "POST", headers: h, body: body })
    .then(function(r){ return r.text(); })
    .catch(function(e){ log("post error:", url, e.message); return null; });
}

/* ---------------- Base64 Decode (for WeCima URLs) ---------------- */

function b64Decode(str) {
  try {
    var clean = str.replace(/\+/g, "").trim();
    var final = (clean.indexOf("aHR0c") !== 0) ? "aHR0c" + clean : clean;
    // Pad
    while (final.length % 4) final += "=";
    var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    var output = "", bc = 0, bs, buffer, idx = 0;
    while ((buffer = final.charAt(idx++))) {
      buffer = chars.indexOf(buffer);
      if (buffer === -1) continue;
      bs = bc % 4 ? bs * 64 + buffer : buffer;
      if (bc++ % 4) output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
    }
    return decodeURIComponent(escape(output));
  } catch (e) { return null; }
}

/* ---------------- TMDB ---------------- */

function tmdbTitles(tmdbId, mediaType) {
  var type = mediaType === "tv" ? "tv" : "movie";
  var url = "https://api.themoviedb.org/3/" + type + "/" + tmdbId + "?api_key=" + TMDB_KEY + "&append_to_response=translations,alternative_titles";
  return fetch(url).then(function(r){ return r.json(); })
    .then(function(d){
      var titles = [];
      var push = function(t){ if (t && titles.indexOf(t) === -1 && t.trim()) titles.push(t.trim()); };
      push(d.title); push(d.name); push(d.original_title); push(d.original_name);
      if (d.translations && d.translations.translations) {
        d.translations.translations.forEach(function(tr){ if (tr.iso_639_1 === "ar" && tr.data) { push(tr.data.title); push(tr.data.name); } });
      }
      return { titles: titles, year: (d.release_date || d.first_air_date || "").split("-")[0] || null };
    })
    .catch(function(){ return { titles: [], year: null }; });
}

/* ---------------- Search WeCima ---------------- */

function searchWecima(query) {
  var encoded = encodeURIComponent(query);
  var url = BASE_URL + "/filtering/?keywords=" + encoded + "&Rated=&genre=&release-years=&category=&quality=&country=&language=";
  log("Search URL:", url);
  return fetchHtml(url).then(function(html){
    if (!html) return [];
    // Check for Cloudflare challenge
    if (html.toLowerCase().indexOf("checking your browser") !== -1 || html.toLowerCase().indexOf("cf-browser-verification") !== -1) {
      log("⚠️ Cloudflare challenge detected");
      return [];
    }
    var results = [], seen = {};
    // Parse GridItem blocks
    var re = /<div[^>]*class=["'][^"']*GridItem[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
    var m;
    while ((m = re.exec(html)) !== null) {
      var block = m[1];
      var a = block.match(/<a[^>]+href=["']([^"']+)["'][^>]*title=["']([^"']+)["']/i) || block.match(/<a[^>]+title=["']([^"']+)["'][^>]*href=["']([^"']+)["']/i);
      if (!a) continue;
      var href = fixUrl(a[1], BASE_URL);
      var title = a[2] || "";
      if (seen[href]) continue;
      seen[href] = true;
      var poster = block.match(/data-src=["']([^"']+)["']/i);
      results.push({ url: href, title: title, poster: poster ? poster[1] : "" });
    }
    log("Search results:", results.length);
    return results;
  });
}

/* ---------------- Detail Extraction ---------------- */

function extractDetail(html, pageUrl) {
  var isSeries = /\/series\//.test(pageUrl) || /class=["'][^"']*Series--Section/.test(html);
  var title = "";
  var tm = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (tm) title = tm[1].replace(/<[^>]+>/g, "").trim();
  var poster = "";
  var pm = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  if (pm) poster = pm[1];
  return { title: title, poster: poster, isSeries: isSeries, html: html };
}

/* ---------------- Episodes AJAX ---------------- */

function extractEpisodes(html, pageUrl) {
  // Extract AJAX base URL and post_id
  var ajaxBase = "";
  var abm = html.match(/var\s+AjaxtURL\s*=\s*["']([^"']+)["']/);
  if (abm) ajaxBase = abm[1];
  if (!ajaxBase) ajaxBase = BASE_URL + "/wp-content/themes/mycima/Ajaxt/";

  var postId = "";
  var pim = html.match(/Single\/Episodes\.php[\s\S]{0,200}?post_id:\s*['"](\d+)['"]/);
  if (pim) postId = pim[1];
  if (!postId) {
    var slm = html.match(/<link[^>]+rel=["']shortlink["'][^>]+href=["'][^"']*p=(\d+)/);
    if (slm) postId = slm[1];
  }
  log("Episodes AJAX - Base:", ajaxBase, "PostId:", postId);

  // Extract season elements
  var seasonRe = /<div[^>]*class=["'][^"']*SeasonsList[^"']*["'][\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i;
  var seasonMatch = html.match(seasonRe);
  var seasons = [];
  if (seasonMatch) {
    var seasonUl = seasonMatch[1];
    var liRe = /<li[^>]*>[\s\S]*?<a[^>]+data-season=["'](\d+)["'][^>]*>([^<]+)<\/a>/gi;
    var lm;
    while ((lm = liRe.exec(seasonUl)) !== null) {
      seasons.push({ dataSeason: lm[1], title: lm[2].trim() });
    }
  }

  if (seasons.length === 0) {
    // Try single season from .EpisodesList
    var epListMatch = html.match(/<div[^>]*class=["'][^"']*EpisodesList[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    if (epListMatch) {
      return parseEpisodesHtml(epListMatch[1], "الموسم الأول", 1, pageUrl);
    }
    return Promise.resolve([]);
  }

  // Fetch each season via AJAX
  var promises = seasons.map(function(season, idx) {
    var seasonNum = idx + 1;
    var ajaxUrl = ajaxBase.replace(/\/$/, "") + "/Single/Episodes.php";
    return postForm(ajaxUrl, { season: season.dataSeason, post_id: postId }, pageUrl)
      .then(function(resHtml){
        if (!resHtml) return [];
        return parseEpisodesHtml(resHtml, season.title, seasonNum, pageUrl);
      });
  });

  return Promise.all(promises).then(function(arrays){
    var all = [];
    arrays.forEach(function(arr){ all = all.concat(arr || []); });
    // Dedupe and sort
    var seen = {}, final = [];
    all.forEach(function(ep){ if (!seen[ep.url]) { seen[ep.url] = true; final.push(ep); } });
    final.sort(function(a,b){ return (a.season - b.season) || (a.episode - b.episode); });
    return final;
  });
}

function parseEpisodesHtml(html, seasonTitle, seasonNum, referer) {
  var episodes = [];
  var re = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  var m;
  while ((m = re.exec(html)) !== null) {
    var href = fixUrl(m[1], BASE_URL);
    var text = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    var epNum = null;
    var em = text.match(/(?:الحلقة|episode)\s*(\d+)/i) || href.match(/(\d+)\/?$/);
    if (em) epNum = parseInt(em[1], 10);
    if (epNum !== null) {
      episodes.push({ url: href, name: seasonTitle + " الحلقة " + epNum, season: seasonNum, episode: epNum });
    }
  }
  log("Episodes in season " + seasonNum + ":", episodes.length);
  return episodes;
}

/* ---------------- Extractor: StreamWish / VidHide ---------------- */

function unpackJsPacker(html) {
  var re = /eval\(function\(p,a,c,k,e,d\)\{[\s\S]*?\}\(\s*['"]([\s\S]*?)['"]\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*['"]([\s\S]*?)['"]\.split/;
  var pm = html.match(re);
  if (!pm) return null;
  var p = pm[1].replace(/\\'/g, "'");
  var a = parseInt(pm[2], 10) || 62;
  var c = parseInt(pm[3], 10) || 0;
  var k = pm[4] ? pm[4].split("|") : [];
  var digits = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  function intToBase(n, b) {
    if (n === 0) return "0";
    var o = "";
    while (n > 0) { o = digits[n % b] + o; n = Math.floor(n / b); }
    return o;
  }
  var map = {};
  for (var i = 0; i < c; i++) {
    var key = intToBase(i, a);
    if (k[i] && k[i].length > 0) map[key] = k[i];
  }
  return p.replace(/\b\w+\b/g, function(w){ return map[w] !== undefined ? map[w] : w; });
}

function resolveStreamWish(url, referer) {
  log("StreamWish:", url);
  var origin = getBaseUrl(url);
  return fetchHtml(url, referer || origin + "/").then(function(html){
    if (!html) return [];
    var unpacked = unpackJsPacker(html) || html;
    var streams = [], seen = {};
    // Links JSON
    var lj = unpacked.match(/var\s+links\s*=\s*(\{[^;]+\})/);
    if (lj) {
      try {
        var obj = JSON.parse(lj[1].replace(/\\\//g, "/"));
        ["hls4","hls3","hls2","hls","file"].forEach(function(k){
          if (obj[k] && /^https?:\/\//.test(obj[k]) && !seen[obj[k]]) {
            seen[obj[k]] = true;
            streams.push({ url: obj[k].replace(/\\\//g, "/"), quality: k === "hls4" ? "1080p" : (k === "hls3" ? "720p" : "HD"), label: "StreamWish" });
          }
        });
      } catch (e) {}
    }
    // Fallback: find any m3u8 in unpacked
    if (!streams.length) {
      var m = unpacked.replace(/\\\//g, "/").match(/https?:\/\/[^\s"'<>\\]+\.m3u8[^\s"'<>\\]*/);
      if (m) streams.push({ url: m[0], quality: "HD", label: "StreamWish" });
    }
    log("StreamWish streams:", streams.length);
    return streams;
  });
}

/* ---------------- Extractor: DoodStream ---------------- */

function resolveDoodStream(url, referer) {
  log("DoodStream:", url);
  var origin = getBaseUrl(url);
  return fetchHtml(url, referer || origin + "/").then(function(html){
    if (!html) return [];
    var passMatch = html.match(/\/pass_md5\/[^'"]+/);
    if (!passMatch) return [];
    var passUrl = origin + passMatch[0];
    return fetchHtml(passUrl, url).then(function(md5Base){
      if (!md5Base) return [];
      var token = passMatch[0].split("/").pop();
      var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      var rand = "";
      for (var i = 0; i < 10; i++) rand += chars.charAt(Math.floor(Math.random() * chars.length));
      var finalUrl = md5Base.trim() + rand + "?token=" + token + "&expiry=" + Date.now();
      return [{ url: finalUrl, quality: "720p", label: "DoodStream" }];
    });
  });
}

/* ---------------- Extractor: StreamTape ---------------- */

function resolveStreamTape(url, referer) {
  log("StreamTape:", url);
  var origin = getBaseUrl(url);
  return fetchHtml(url, referer || origin + "/").then(function(html){
    if (!html) return [];
    var m = html.match(/getElementById\(['"](?:robot|ideoo)link['"]\)\.innerHTML\s*=\s*['"]([^'"]+)['"]\s*\+\s*\(?['"]([^'"]+)['"]\)?(?:\.substring\((\d+)\))?/);
    if (!m) return [];
    var prefix = m[1];
    var tail = m[2];
    var skip = parseInt(m[3] || "0", 10);
    if (skip > 0) tail = tail.substring(skip);
    var built = prefix + tail;
    if (built.indexOf("//") === 0) built = "https:" + built;
    var finalUrl = built.indexOf("&stream=") !== -1 ? built : built + "&stream=1";
    return [{ url: finalUrl, quality: "720p", label: "StreamTape" }];
  });
}

/* ---------------- Extractor: MixDrop ---------------- */

function resolveMixDrop(url, referer) {
  log("MixDrop:", url);
  var origin = getBaseUrl(url);
  return fetchHtml(url, referer || origin + "/").then(function(html){
    if (!html) return [];
    var unpacked = unpackJsPacker(html) || html;
    var m = unpacked.match(/MDCore\.wurl\s*=\s*["']([^"']+)["']/);
    if (!m) return [];
    var wurl = m[1];
    var videoUrl = wurl.indexOf("//") === 0 ? "https:" + wurl : (wurl.indexOf("http") === 0 ? wurl : origin + wurl);
    return [{ url: videoUrl, quality: "720p", label: "MixDrop" }];
  });
}

/* ---------------- Extractor: Mp4Upload ---------------- */

function resolveMp4Upload(url, referer) {
  log("Mp4Upload:", url);
  var origin = getBaseUrl(url);
  var id = url.match(/(?:embed-)?([A-Za-z0-9]{10,})/);
  var embedUrl = id ? origin + "/embed-" + id[1] + ".html" : url;
  return fetchHtml(embedUrl, referer || origin + "/").then(function(html){
    if (!html) return [];
    var unpacked = unpackJsPacker(html) || html;
    var m = unpacked.match(/player\.src\(\s*\{\s*type\s*:\s*["']video\/mp4["']\s*,\s*src\s*:\s*["']([^"']+)["']/) ||
            unpacked.match(/https?:\/\/[^"'\s]+\.mp4/);
    if (!m) return [];
    var src = m[1] || m[0];
    return [{ url: src, quality: "720p", label: "Mp4Upload" }];
  });
}

/* ---------------- Extractor: VOE ---------------- */

function resolveVOE(url, referer) {
  log("VOE:", url);
  var origin = getBaseUrl(url);
  var eUrl = url.indexOf("/e/") !== -1 ? url : origin + "/e/" + (url.match(/([A-Za-z0-9]+)$/) || [])[1];
  return fetchHtml(eUrl, referer || origin + "/").then(function(html){
    if (!html) return [];
    var m = html.match(/<script[^>]*type=["']application\/json["'][^>]*>\s*\[\s*"([^"]+)"\s*\]\s*<\/script>/);
    if (!m) return [];
    // VOE rot13 decode
    var input = m[1];
    var rot = "";
    for (var i = 0; i < input.length; i++) {
      var c = input.charCodeAt(i);
      if (c >= 97 && c <= 122) rot += String.fromCharCode(97 + (c - 97 + 13) % 26);
      else if (c >= 65 && c <= 90) rot += String.fromCharCode(65 + (c - 65 + 13) % 26);
      else rot += input[i];
    }
    ["@$","^^","~@","%?","*~","!!","#&"].forEach(function(tok){ rot = rot.split(tok).join(""); });
    var s1 = "";
    try { s1 = atob(rot); } catch (e) { return []; }
    var shifted = "";
    for (var j = 0; j < s1.length; j++) shifted += String.fromCharCode(s1.charCodeAt(j) - 3);
    var reversed = shifted.split("").reverse().join("");
    var jsonStr = "";
    try { jsonStr = atob(reversed); } catch (e) { return []; }
    var parsed;
    try { parsed = JSON.parse(jsonStr); } catch (e) { return []; }
    var hls = parsed.source;
    var mp4 = parsed.direct_access_url;
    var streams = [];
    if (hls && hls.indexOf("http") === 0) streams.push({ url: hls, quality: "1080p", label: "VOE-HLS" });
    if (mp4 && mp4.indexOf("http") === 0) streams.push({ url: mp4, quality: "720p", label: "VOE-MP4" });
    return streams;
  });
}

/* ---------------- Extractor: VidHide / LuluStream ---------------- */

function resolveVidHide(url, referer) {
  return resolveStreamWish(url, referer);
}

function resolveLuluStream(url, referer) {
  log("LuluStream:", url);
  var origin = getBaseUrl(url);
  return fetchHtml(url, referer || origin + "/").then(function(html){
    if (!html) return [];
    var unpacked = (unpackJsPacker(html) || html).replace(/\\\//g, "/").replace(/\\u0026/g, "&");
    var m = unpacked.match(/https?:\/\/[^\s"'<>\\]+\.(?:m3u8|mp4)[^\s"'<>\\]*/);
    if (!m) return [];
    var isHls = m[0].indexOf(".m3u8") !== -1;
    return [{ url: m[0], quality: isHls ? "1080p" : "720p", label: "LuluStream" }];
  });
}

/* ---------------- Resolver dispatcher ---------------- */

function resolveExtractor(url, referer) {
  var u = url.toLowerCase();
  if (u.indexOf("streamwish") !== -1 || u.indexOf("vibuxer") !== -1 || u.indexOf("hanerix") !== -1 ||
      u.indexOf("niramirus") !== -1 || u.indexOf("hglamioz") !== -1 || u.indexOf("playnixes") !== -1 || u.indexOf("medixiru") !== -1) {
    return resolveStreamWish(url, referer);
  }
  if (u.indexOf("vidhide") !== -1) return resolveVidHide(url, referer);
  if (u.indexOf("dood") !== -1 || u.indexOf("dsvplay") !== -1) return resolveDoodStream(url, referer);
  if (u.indexOf("streamtape") !== -1) return resolveStreamTape(url, referer);
  if (u.indexOf("mixdrop") !== -1) return resolveMixDrop(url, referer);
  if (u.indexOf("mp4upload") !== -1) return resolveMp4Upload(url, referer);
  if (u.indexOf("voe.sx") !== -1 || u.indexOf("voe.") !== -1) return resolveVOE(url, referer);
  if (u.indexOf("lulu") !== -1 || u.indexOf("luluvdo") !== -1) return resolveLuluStream(url, referer);
  // Direct video
  if (u.indexOf(".m3u8") !== -1 || u.indexOf(".mp4") !== -1) {
    var isHls = u.indexOf(".m3u8") !== -1;
    return Promise.resolve([{ url: url, quality: isHls ? "1080p" : "720p", label: "Direct" }]);
  }
  // Unknown embed — try to fetch and extract direct links
  return fetchHtml(url, referer).then(function(html){
    if (!html) return [];
    var unpacked = unpackJsPacker(html) || html;
    var m = unpacked.replace(/\\\//g, "/").match(/https?:\/\/[^\s"'<>\\]+\.(?:m3u8|mp4)[^\s"'<>\\]*/);
    if (!m) return [];
    return [{ url: m[0], quality: "HD", label: "Embed" }];
  });
}

/* ---------------- Extract servers from page ---------------- */

function extractServers(pageUrl) {
  log("Extract servers from:", pageUrl);
  return fetchHtml(pageUrl).then(function(html){
    if (!html) return [];
    if (html.toLowerCase().indexOf("checking your browser") !== -1) {
      log("⚠️ Cloudflare challenge on page");
      return [];
    }
    var links = [];
    var seen = {};

    // 1. <li data-watch="...">
    var dwRe = /<li[^>]*data-watch=["']([^"']+)["'][^>]*>([\s\S]*?)<\/li>/gi;
    var m;
    while ((m = dwRe.exec(html)) !== null) {
      var wUrl = m[1];
      if (wUrl.indexOf("http") === 0 && !seen[wUrl]) { seen[wUrl] = true; links.push(wUrl); }
    }

    // 2. <btn data-url="..."> (Base64)
    var duRe = /<btn[^>]*data-url=["']([^"']+)["']/gi;
    while ((m = duRe.exec(html)) !== null) {
      var decoded = b64Decode(m[1]);
      if (decoded && decoded.indexOf("http") === 0 && !seen[decoded]) { seen[decoded] = true; links.push(decoded); }
    }

    // 3. .openLinkDown[data-href="..."] (Base64)
    var dhRe = /data-href=["']([^"']+)["']/gi;
    while ((m = dhRe.exec(html)) !== null) {
      var dec2 = b64Decode(m[1]);
      if (dec2 && dec2.indexOf("http") === 0 && !seen[dec2]) { seen[dec2] = true; links.push(dec2); }
    }

    // 4. Download links
    var dlRe = /<a[^>]+href=["']([^"']+)["'][^>]*>[\s\S]*?(?:quality|تحميل)/gi;
    while ((m = dlRe.exec(html)) !== null) {
      var dlUrl = m[1];
      if (dlUrl.indexOf("http") === 0 && !seen[dlUrl]) { seen[dlUrl] = true; links.push(dlUrl); }
    }

    log("Collected server links:", links.length);
    if (links.length === 0) return [];

    // Resolve each link
    var promises = links.map(function(link){
      return resolveExtractor(link, pageUrl).catch(function(){ return []; });
    });
    return Promise.all(promises).then(function(arrays){
      var flat = [], finalSeen = {};
      arrays.forEach(function(arr){
        (arr || []).forEach(function(s){
          if (s.url && !finalSeen[s.url]) { finalSeen[s.url] = true; flat.push(s); }
        });
      });
      return flat;
    });
  });
}

/* ---------------- Main ---------------- */

function getStreams(tmdbId, mediaType, season, episode) {
  log("=== START:", tmdbId, mediaType, "S" + season, "E" + episode);
  var isMovie = mediaType === "movie";

  return tmdbTitles(tmdbId, mediaType).then(function(info){
    if (!info.titles.length) { log("No TMDB titles"); return []; }
    log("Titles:", info.titles.join(" | "));
    // Try each title
    var searchPromises = info.titles.slice(0, 3).map(function(t){ return searchWecima(t); });
    return Promise.all(searchPromises).then(function(arrs){
      var results = [], seen = {};
      arrs.forEach(function(arr){ (arr || []).forEach(function(r){ if (!seen[r.url]) { seen[r.url] = true; results.push(r); } }); });
      if (!results.length) { log("No search results"); return []; }
      var best = results[0];
      log("Selected:", best.title, best.url);

      return fetchHtml(best.url).then(function(pageHtml){
        if (!pageHtml) return [];
        var detail = extractDetail(pageHtml, best.url);
        log("Type:", detail.isSeries ? "series" : "movie");

        if (!detail.isSeries) {
          // Movie: extract servers from page directly
          return extractServers(best.url);
        }

        // TV: extract episodes
        return extractEpisodes(pageHtml, best.url).then(function(eps){
          if (!eps.length) { log("No episodes"); return []; }
          var wantS = parseInt(season, 10) || 1;
          var wantE = parseInt(episode, 10) || 1;
          var target = null;
          for (var i = 0; i < eps.length; i++) {
            if (eps[i].season === wantS && eps[i].episode === wantE) { target = eps[i]; break; }
          }
          if (!target) target = eps[0];
          log("Selected episode:", target.name, target.url);
          return extractServers(target.url);
        });
      });
    });
  }).then(function(streams){
    if (!streams || !streams.length) { log("No streams"); return []; }
    var final = [], seen = {};
    streams.forEach(function(s){
      if (!s.url || seen[s.url]) return;
      seen[s.url] = true;
      var isHls = s.url.indexOf(".m3u8") !== -1;
      final.push({
        name: "WeCima - " + (s.quality || "HD"),
        title: "WeCima \u2022 " + (s.label || "Server") + " (" + (isHls ? "HLS" : "MP4") + ")",
        url: s.url,
        quality: s.quality || "HD",
        provider: "wecima",
        headers: { "User-Agent": UA, "Referer": BASE_URL + "/" },
        type: isHls ? "hls" : "mp4"
      });
    });
    log("=== Final streams:", final.length);
    return final;
  }).catch(function(err){ log("FATAL:", err && err.message); return []; });
}

module.exports = { getStreams: getStreams };