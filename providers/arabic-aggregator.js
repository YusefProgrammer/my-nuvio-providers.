/**
 * Arabic Aggregator - Nuvio JS Provider
 * Combines Topcinema, CimaClub, Aflaam, Shahid4u, TVgarden into one source.
 * Each stream is labeled with its origin source name.
 * Hermes-compatible (Promise chains only).
 */

var TMDB_KEY = "6c91e91ec97e117e446a62f4d2ace9b7";
var UA = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36";

function log() { var a = Array.prototype.slice.call(arguments); try { console.log.apply(console, ["[Aggregator]"].concat(a)); } catch(e){} }
function fixUrl(u, b) { if (!u) return ""; var s = String(u).trim(); if (s.indexOf("http")===0) return s; if (s.indexOf("//")===0) return "https:"+s; if (s.indexOf("/")===0) return b+s; return b+"/"+s; }
function getBaseUrl(u) { var m = String(u).match(/^(https?:\/\/[^\/]+)/); return m?m[1]:""; }
function safeDecode(s) { try { return decodeURIComponent(s); } catch(e) { return String(s); } }

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

/* ---------------- Unpacker (Dean Edwards) ---------------- */

function unpackJs(p, a, c, k) {
  var digits = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  function intToBase(n, b) { if (n === 0) return "0"; var o = ""; while (n > 0) { o = digits[n % b] + o; n = Math.floor(n / b); } return o; }
  var map = {};
  for (var i = 0; i < c; i++) { var key = intToBase(i, a); if (k && k[i] && k[i].length > 0) map[key] = k[i]; }
  return p.replace(/\b\w+\b/g, function(w){ return map[w] !== undefined ? map[w] : w; });
}
function unpackHtml(html) {
  var re = /eval\(function\(p,a,c,k,e,d\)\{[\s\S]*?\}\(\s*['"]([\s\S]*?)['"]\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*['"]([\s\S]*?)['"]\.split/;
  var m = html.match(re); if (!m) return null;
  return unpackJs(m[1].replace(/\\'/g, "'"), parseInt(m[2],10)||62, parseInt(m[3],10)||0, m[4] ? m[4].split("|") : []);
}

/* ---------------- HTTP ---------------- */

function fetchHtml(url, referer) {
  var h = { "User-Agent": UA, "Accept": "text/html,application/xhtml+xml", "Accept-Language": "ar-EG,ar;q=0.9" };
  if (referer) h["Referer"] = referer;
  return fetch(url, { headers: h }).then(function(r){ if (!r.ok) throw new Error("HTTP "+r.status); return r.text(); })
    .catch(function(e){ log("fetch error:", url, e.message); return null; });
}
function postForm(url, data, referer) {
  var body = Object.keys(data).map(function(k){ return encodeURIComponent(k)+"="+encodeURIComponent(data[k]); }).join("&");
  var h = { "User-Agent": UA, "Accept": "*/*", "X-Requested-With": "XMLHttpRequest", "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" };
  if (referer) h["Referer"] = referer;
  return fetch(url, { method: "POST", headers: h, body: body }).then(function(r){ return r.text(); })
    .catch(function(e){ log("post error:", url, e.message); return null; });
}

/* ============================================================
   SOURCE 1: Topcinema
   ============================================================ */

var TC_BASE = "https://topcinemaa.one";

function tcSearch(query) {
  var url = TC_BASE + "/search/?query=" + encodeURIComponent(query) + "&type=all";
  return fetchHtml(url).then(function(html){
    if (!html) return [];
    var results = [], seen = {};
    var re = /<a\b[^>]*?href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi; var m;
    while ((m = re.exec(html)) !== null) {
      var href = m[1]; if (/\/(category|tag|page|search|login|wp-content)\b/i.test(href)) continue;
      var full = fixUrl(href, TC_BASE); if (seen[full]) continue; seen[full] = true;
      results.push({ url: full, text: m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() });
    } return results;
  });
}

function tcPickMovie(results, titles) {
  var wanted = titles.map(function(t){ return t.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/g, ""); });
  var best = null, bestScore = 0;
  results.forEach(function(r){
    if (safeDecode(r.url).indexOf("الحلقة") !== -1) return;
    var norm = r.text.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/g, ""); var score = 0;
    for (var i = 0; i < wanted.length; i++) { if (norm === wanted[i]) { score = 3000; break; } if (norm.indexOf(wanted[i]) !== -1) score = Math.max(score, 2000); }
    if (score > bestScore) { bestScore = score; best = r.url; }
  }); return bestScore > 0 ? best : null;
}

function tcExtractServers(watchUrl) {
  return fetchHtml(watchUrl).then(function(html){
    if (!html) return [];
    var base = getBaseUrl(watchUrl); var tasks = [];
    var pi = html.match(/class=["'][^"']*player--iframe[^"']*["'][\s\S]{0,1500}?<iframe[^>]+src=["']([^"']+)["']/i);
    if (pi && pi[1]) tasks.push({ type: "iframe", url: pi[1] });
    var liRe = /<li\b[^>]*>/gi; var liM;
    while ((liM = liRe.exec(html)) !== null) {
      if (liM[0].indexOf("server--item") === -1) continue;
      var idM = liM[0].match(/data-id=["']([^"']+)["']/); var numM = liM[0].match(/data-server=["']([^"']+)["']/);
      if (idM && numM) tasks.push({ type: "ajax", id: idM[1], num: numM[1] });
    }
    if (tasks.length === 0) return [];
    var promises = tasks.map(function(t){
      if (t.type === "iframe") return tcResolveEmbed(t.url, watchUrl);
      var ajaxUrl = base + "/wp-content/themes/movies2023/Ajaxat/Single/Server.php";
      return postForm(ajaxUrl, { id: t.id, i: t.num }, watchUrl).then(function(res){
        if (!res) return []; var ifr = res.match(/<iframe[^>]+src=["']([^"']+)["']/i);
        if (!ifr) return []; return tcResolveEmbed(ifr[1], watchUrl);
      });
    });
    return Promise.all(promises).then(function(arrays){
      var flat = [], seen = {};
      arrays.forEach(function(arr){ (arr||[]).forEach(function(s){ if (s.url && !seen[s.url]) { seen[s.url]=true; flat.push(s); } }); });
      return flat;
    });
  });
}

function tcResolveEmbed(embedUrl, referer) {
  var u = embedUrl;
  if (u.indexOf("play.php?to=") !== -1) {
    try { var part = u.substring(u.indexOf("play.php?to=")+12); var dec = decodeURIComponent(part); if (dec.indexOf("https://") !== dec.lastIndexOf("https://")) dec = dec.substring(dec.lastIndexOf("https://")); u = dec.indexOf("http")===0?dec:"https:"+dec; } catch(e){}
  }
  if (/vidtube/i.test(u)) {
    return fetchHtml(u, referer).then(function(html){
      if (!html) return []; var streams = [], seen = {}; var hostBase = getBaseUrl(u);
      var dlRe = /<a\b[^>]*?href=["']([^"']*\/d\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi; var dlM;
      var dls = [];
      while ((dlM = dlRe.exec(html)) !== null) {
        var href = dlM[1]; var qual = dlM[2].match(/<b>([^<]+)<\/b>/i); var q = qual?qual[1].trim():"Direct";
        var full = href.indexOf("http")===0?href:hostBase+href;
        dls.push((function(uu, qq){ return fetchHtml(uu, u).then(function(dh){ if (!dh) return null; var dm = dh.match(/href=["']([^"']+\.(?:mp4|m3u8)[^"']*)["']/i); return dm ? { url: dm[1], quality: qq, label: "Topcinema-VidTube-DL" } : null; }); })(full, q));
      }
      if (dls.length > 0) return Promise.all(dls).then(function(rs){ return rs.filter(function(r){ return r!==null; }); });
      var unpacked = unpackHtml(html); if (!unpacked) return [];
      var fileRe = /file\s*:\s*["'](https?:\/\/[^"']+)["']/g; var labelRe = /label\s*:\s*["']([^"']+)["']/g;
      var files = [], labels = [], fm, lm;
      while ((fm = fileRe.exec(unpacked)) !== null) files.push(fm[1]);
      while ((lm = labelRe.exec(unpacked)) !== null) labels.push(lm[1]);
      for (var i = 0; i < files.length; i++) { if (seen[files[i]]) continue; seen[files[i]] = true; streams.push({ url: files[i], quality: labels[i]||"Auto", label: "Topcinema-VidTube" }); }
      return streams;
    });
  }
  return fetchHtml(u, referer).then(function(html){ if (!html) return []; var m = html.match(/https?:\/\/[^\s"'<>\\]+\.(?:m3u8|mp4)[^\s"'<>\\]*/i); return m ? [{ url: m[0], quality: "HD", label: "Topcinema-Direct" }] : []; });
}

function getTopcinema(tmdbId, mediaType, season, episode) {
  var isMovie = mediaType === "movie";
  return tmdbTitles(tmdbId, mediaType).then(function(info){
    if (!info.titles.length) return [];
    return Promise.all(info.titles.slice(0,2).map(tcSearch)).then(function(arrs){
      var results = [], seen = {};
      arrs.forEach(function(arr){ (arr||[]).forEach(function(r){ if (!seen[r.url]) { seen[r.url]=true; results.push(r); } }); });
      if (!results.length) return [];
      var page = isMovie ? tcPickMovie(results, info.titles) : (results.find(function(r){ return safeDecode(r.url).indexOf("الحلقة") !== -1; }) || results[0]).url;
      if (!page) return [];
      var clean = page.split("?")[0].replace(/\/+$/, "");
      return tcExtractServers(clean + "/watch/");
    });
  });
}

/* ============================================================
   SOURCE 2: CimaClub
   ============================================================ */

var CC_BASE = "https://cimaclub.cam";

function ccSearch(query) {
  var url = CC_BASE + "/?s=" + encodeURIComponent(query);
  return fetchHtml(url).then(function(html){
    if (!html) return [];
    var results = [], seen = {};
    var re = /<a\b[^>]*?href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi; var m;
    while ((m = re.exec(html)) !== null) {
      var href = m[1]; if (/\/(category|tag|page|search|wp-content)\b/i.test(href)) continue;
      var full = fixUrl(href, CC_BASE); if (seen[full]) continue; seen[full] = true;
      results.push({ url: full, text: m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() });
    } return results;
  });
}

function getCimaClub(tmdbId, mediaType, season, episode) {
  var isMovie = mediaType === "movie";
  return tmdbTitles(tmdbId, mediaType).then(function(info){
    if (!info.titles.length) return [];
    return ccSearch(info.titles[0]).then(function(results){
      if (!results.length) return [];
      var page = results[0].url;
      return fetchHtml(page).then(function(html){
        if (!html) return [];
        var streams = [], seen = {};
        var iframeRe = /<iframe\b[^>]*?src=["']([^"']+)["'][^>]*>/gi; var im;
        while ((im = iframeRe.exec(html)) !== null) {
          var u = fixUrl(im[1], CC_BASE); if (/facebook|google|youtube/i.test(u) || seen[u]) continue; seen[u] = true;
          streams.push({ url: u, quality: "HD", label: "CimaClub-Embed" });
        }
        var directRe = /https?:\/\/[^\s"'<>\\]+\.(?:m3u8|mp4)[^\s"'<>\\]*/gi; var dm;
        while ((dm = directRe.exec(html)) !== null) { if (seen[dm[0]]) continue; seen[dm[0]] = true; streams.push({ url: dm[0], quality: "HD", label: "CimaClub-Direct" }); }
        return streams;
      });
    });
  });
}

/* ============================================================
   SOURCE 3: Aflaam
   ============================================================ */

var AF_BASE = "https://aflaam.cc";

function afSearch(query) {
  var url = AF_BASE + "/?s=" + encodeURIComponent(query);
  return fetchHtml(url).then(function(html){
    if (!html) return [];
    var results = [], seen = {};
    var re = /<a\b[^>]*?href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi; var m;
    while ((m = re.exec(html)) !== null) {
      var href = m[1]; if (/\/(category|tag|page|search|wp-content)\b/i.test(href)) continue;
      var full = fixUrl(href, AF_BASE); if (seen[full]) continue; seen[full] = true;
      results.push({ url: full, text: m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() });
    } return results;
  });
}

function getAflaam(tmdbId, mediaType, season, episode) {
  var isMovie = mediaType === "movie";
  return tmdbTitles(tmdbId, mediaType).then(function(info){
    if (!info.titles.length) return [];
    return afSearch(info.titles[0]).then(function(results){
      if (!results.length) return [];
      var page = results[0].url;
      return fetchHtml(page).then(function(html){
        if (!html) return [];
        var streams = [], seen = {};
        var iframeRe = /<iframe\b[^>]*?src=["']([^"']+)["'][^>]*>/gi; var im;
        while ((im = iframeRe.exec(html)) !== null) {
          var u = fixUrl(im[1], AF_BASE); if (/facebook|google|youtube/i.test(u) || seen[u]) continue; seen[u] = true;
          streams.push({ url: u, quality: "HD", label: "Aflaam-Embed" });
        }
        var directRe = /https?:\/\/[^\s"'<>\\]+\.(?:m3u8|mp4)[^\s"'<>\\]*/gi; var dm;
        while ((dm = directRe.exec(html)) !== null) { if (seen[dm[0]]) continue; seen[dm[0]] = true; streams.push({ url: dm[0], quality: "HD", label: "Aflaam-Direct" }); }
        return streams;
      });
    });
  });
}

/* ============================================================
   SOURCE 4: Shahid4u
   ============================================================ */

var SH_BASE = "https://shahid4u.onl";

function shSearch(query) {
  var url = SH_BASE + "/?s=" + encodeURIComponent(query);
  return fetchHtml(url).then(function(html){
    if (!html) return [];
    var results = [], seen = {};
    var re = /<a\b[^>]*?href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi; var m;
    while ((m = re.exec(html)) !== null) {
      var href = m[1]; if (/\/(category|tag|page|search|wp-content)\b/i.test(href)) continue;
      var full = fixUrl(href, SH_BASE); if (seen[full]) continue; seen[full] = true;
      results.push({ url: full, text: m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() });
    } return results;
  });
}

function getShahid4u(tmdbId, mediaType, season, episode) {
  return tmdbTitles(tmdbId, mediaType).then(function(info){
    if (!info.titles.length) return [];
    return shSearch(info.titles[0]).then(function(results){
      if (!results.length) return [];
      var page = results[0].url;
      return fetchHtml(page).then(function(html){
        if (!html) return [];
        var streams = [], seen = {};
        var iframeRe = /<iframe\b[^>]*?src=["']([^"']+)["'][^>]*>/gi; var im;
        while ((im = iframeRe.exec(html)) !== null) {
          var u = fixUrl(im[1], SH_BASE); if (/facebook|google|youtube/i.test(u) || seen[u]) continue; seen[u] = true;
          streams.push({ url: u, quality: "HD", label: "Shahid4u-Embed" });
        }
        return streams;
      });
    });
  });
}

/* ============================================================
   MAIN AGGREGATOR
   ============================================================ */

function getStreams(tmdbId, mediaType, season, episode) {
  log("=== AGGREGATOR START:", tmdbId, mediaType, "S"+season, "E"+episode);
  var sources = [
    { name: "Topcinema", fn: getTopcinema },
    { name: "CimaClub", fn: getCimaClub },
    { name: "Aflaam", fn: getAflaam },
    { name: "Shahid4u", fn: getShahid4u }
  ];
  var promises = sources.map(function(src){
    return src.fn(tmdbId, mediaType, season, episode)
      .then(function(streams){
        return (streams||[]).map(function(s){ s._source = src.name; return s; });
      })
      .catch(function(e){ log(src.name, "failed:", e.message); return []; });
  });
  return Promise.all(promises).then(function(arrays){
    var all = [], seen = {};
    arrays.forEach(function(arr){
      arr.forEach(function(s){
        if (s.url && !seen[s.url]) { seen[s.url] = true; all.push(s); }
      });
    });
    log("Total raw streams:", all.length);
    var final = [];
    all.forEach(function(s){
      var isHls = s.url.indexOf(".m3u8") !== -1;
      final.push({
        name: s._source + " - " + (s.quality || "HD"),
        title: "[" + s._source + "] \u2022 " + (s.label || "Server") + " (" + (isHls?"HLS":"MP4") + ")",
        url: s.url,
        quality: s.quality || "HD",
        provider: "arabic-aggregator",
        headers: { "User-Agent": UA, "Referer": s.referer || "" },
        type: isHls ? "hls" : "mp4"
      });
    });
    log("=== FINAL STREAMS:", final.length);
    return final;
  }).catch(function(err){ log("FATAL:", err && err.message); return []; });
}

module.exports = { getStreams: getStreams };