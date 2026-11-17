/**
 * TopCinema - Nuvio JS Provider v3
 * Full support: Arabic ordinals, episode matching, multi-server extraction.
 * Ported from CloudStream Kotlin logic.
 */

var BASE_URL = "https://topcinemaa.one";
var TMDB_API_KEY = "6c91e91ec97e117e446a62f4d2ace9b7";
var USER_AGENT = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36";

function log() {
  var args = Array.prototype.slice.call(arguments);
  try { console.log.apply(console, ["[TopCinema]"].concat(args)); } catch (e) {}
}

function fixUrl(url, base) {
  if (!url) return "";
  var u = String(url).trim();
  if (u.indexOf("http") === 0) return u;
  if (u.indexOf("//") === 0) return "https:" + u;
  if (u.indexOf("/") === 0) return base + u;
  return base + "/" + u;
}

function safeDecode(s) { try { return decodeURIComponent(s); } catch (e) { return String(s); } }

function getBaseUrl(url) {
  var m = String(url).match(/^(https?:\/\/[^\/]+)/);
  return m ? m[1] : BASE_URL;
}

/* ---------- Arabic ordinals ---------- */

var ARABIC_ORDINALS = {
  "الأول": 1, "الاول": 1, "الأولى": 1, "الاولى": 1,
  "الثاني": 2, "الثانية": 2, "الثانى": 2, "الثانيه": 2,
  "الثالث": 3, "الثالثة": 3, "الثالثه": 3,
  "الرابع": 4, "الرابعة": 4, "الرابعه": 4,
  "الخامس": 5, "الخامسة": 5, "الخامسه": 5,
  "السادس": 6, "السادسة": 6, "السادسه": 6,
  "السابع": 7, "السابعة": 7, "السابعه": 7,
  "الثامن": 8, "الثامنة": 8, "الثامنه": 8,
  "التاسع": 9, "التاسعة": 9, "التاسعه": 9,
  "العاشر": 10, "العاشرة": 10, "العاشره": 10
};

function arabicToNum(word) {
  if (!word) return null;
  word = String(word).trim();
  if (ARABIC_ORDINALS[word]) return ARABIC_ORDINALS[word];
  var n = parseInt(word, 10);
  return isNaN(n) ? null : n;
}

function parseSE(text) {
  var out = { season: null, episode: null };
  if (!text) return out;
  var t = safeDecode(text);

  var sm = t.match(/الموسم[\s\-_]*(?!الحلقة)([^\s\-_\/]+)/);
  if (sm) out.season = arabicToNum(sm[1]);

  var em = t.match(/الحلقة[\s\-_]*([^\s\-_\/]+)/);
  if (em) out.episode = arabicToNum(em[1]);

  var sxm = t.match(/[Ss](\d{1,2})[\s\-._]*[Ee](\d{1,4})/);
  if (sxm) {
    if (!out.season) out.season = parseInt(sxm[1], 10);
    if (!out.episode) out.episode = parseInt(sxm[2], 10);
  }
  return out;
}

function normalizeTitle(s) {
  return String(s || "")
    .replace(/^مسلسل\s+/i, "")
    .replace(/^فيلم\s+/i, "")
    .replace(/\s+الموسم\s+\S+/gi, "")
    .replace(/\s+الحلقة\s+\S+/gi, "")
    .replace(/\s+مترجم[ةه]?\s*$/i, "")
    .replace(/\s+اون\s*لاين\s*$/i, "")
    .replace(/\s+كامل[ةه]?\s*$/i, "")
    .replace(/\s+بجودة\s+\S+/i, "")
    .replace(/\s+(HD|WEB-DL|BluRay|1080p?|720p?|480p?|SD)\s*$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, "");
}

/* ---------- HTTP ---------- */

function fetchHtml(url, referer) {
  var h = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ar-EG,ar;q=0.9,en;q=0.8"
  };
  if (referer) h["Referer"] = referer;
  return fetch(url, { headers: h })
    .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); })
    .catch(function (e) { log("fetch error:", url, e.message); return null; });
}

function postForm(url, data, referer) {
  var body = Object.keys(data).map(function (k) {
    return encodeURIComponent(k) + "=" + encodeURIComponent(data[k]);
  }).join("&");
  var h = {
    "User-Agent": USER_AGENT,
    "Accept": "*/*",
    "X-Requested-With": "XMLHttpRequest",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "Accept-Language": "ar-EG,ar;q=0.9,en;q=0.8"
  };
  if (referer) h["Referer"] = referer;
  return fetch(url, { method: "POST", headers: h, body: body })
    .then(function (r) { return r.text(); })
    .catch(function (e) { log("post error:", url, e.message); return null; });
}

/* ---------- TMDB ---------- */

function tmdbInfo(tmdbId, mediaType) {
  var type = mediaType === "tv" ? "tv" : "movie";
  var url = "https://api.themoviedb.org/3/" + type + "/" + tmdbId +
            "?api_key=" + TMDB_API_KEY + "&append_to_response=translations,alternative_titles";
  return fetch(url).then(function (r) { return r.json(); })
    .then(function (d) {
      var titles = [];
      var push = function (t) {
        if (t && typeof t === "string" && titles.indexOf(t) === -1 && t.trim()) titles.push(t.trim());
      };
      push(d.title); push(d.name);
      push(d.original_title); push(d.original_name);
      if (d.translations && d.translations.translations) {
        d.translations.translations.forEach(function (tr) {
          if (tr.iso_639_1 === "ar" && tr.data) { push(tr.data.title); push(tr.data.name); }
        });
      }
      if (d.alternative_titles && d.alternative_titles.results) {
        d.alternative_titles.results.forEach(function (a) { push(a.title); });
      }
      return { titles: titles, year: (d.release_date || d.first_air_date || "").split("-")[0] || null };
    })
    .catch(function (e) { log("TMDB error:", e.message); return { titles: [], year: null }; });
}

/* ---------- Search ---------- */

function searchTopCinema(query) {
  var url = BASE_URL + "/search/?query=" + encodeURIComponent(query) + "&type=all";
  return fetchHtml(url).then(function (html) {
    if (!html) return [];
    var results = [], seen = {};
    var re = /<a\b[^>]*?href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    var m;
    while ((m = re.exec(html)) !== null) {
      var href = m[1];
      if (/\/(category|tag|page|search|login|register|contact|wp-content|feed|author)\b/i.test(href)) continue;
      if (href.indexOf(BASE_URL) !== 0 && href.indexOf("/") !== 0) continue;
      var full = fixUrl(href, BASE_URL);
      if (seen[full]) continue;
      seen[full] = true;
      results.push({ url: full, text: m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() });
    }
    return results;
  });
}

function scoreBase(titleText, wanted) {
  var score = 0;
  for (var i = 0; i < wanted.length; i++) {
    if (titleText === wanted[i]) { return 3000; }
    if (titleText.indexOf(wanted[i]) !== -1) score = Math.max(score, 2000);
    if (wanted[i].indexOf(titleText) !== -1 && titleText.length > 3) score = Math.max(score, 1000);
  }
  return score;
}

function pickMovieResult(results, titles) {
  var wanted = titles.map(normalizeTitle).filter(function (t) { return t.length >= 2; });
  var best = null, bestScore = 0;
  results.forEach(function (r) {
    if (safeDecode(r.url).indexOf("الحلقة") !== -1) return;
    var s = scoreBase(normalizeTitle(r.text), wanted);
    if (s > bestScore) { bestScore = s; best = r.url; }
  });
  return bestScore > 0 ? best : null;
}

function pickTVResult(results, titles, season, episode) {
  var wanted = titles.map(normalizeTitle).filter(function (t) { return t.length >= 2; });
  var wantS = season != null ? parseInt(season, 10) : 1;
  var wantE = episode != null ? parseInt(episode, 10) : 1;

  var epUrl = null, epScore = 0;
  var seUrl = null, seScore = 0;

  results.forEach(function (r) {
    var dec = safeDecode(r.url);
    var base = scoreBase(normalizeTitle(r.text), wanted);
    if (base === 0) return;

    if (dec.indexOf("الحلقة") !== -1) {
      var se = parseSE(dec);
      var ep = base;
      if (se.season !== null) ep += (se.season === wantS) ? 500 : -800;
      if (se.episode !== null) ep += (se.episode === wantE) ? 1500 : -1500;
      if (ep > epScore) { epScore = ep; epUrl = r.url; }
    } else if (dec.indexOf("/series/") !== -1 || dec.indexOf("الموسم") !== -1) {
      if (base > seScore) { seScore = base; seUrl = r.url; }
    }
  });

  // Prefer exact episode match
  if (epUrl && epScore >= 3000) return { type: "episode", url: epUrl };
  if (seUrl && seScore > 0) return { type: "series", url: seUrl };
  if (epUrl) return { type: "episode", url: epUrl };
  return null;
}

/* ---------- Episode finder inside series/season page ---------- */

function findEpisodeInPage(html, season, episode) {
  var wantS = season != null ? parseInt(season, 10) : 1;
  var wantE = episode != null ? parseInt(episode, 10) : 1;
  var re = /<a\b[^>]*?href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  var m;
  var bestEp = null;
  var bestSeasonPage = null;

  while ((m = re.exec(html)) !== null) {
    var href = fixUrl(m[1], BASE_URL);
    var text = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    var dec = safeDecode(href + " " + text);

    if (dec.indexOf("الحلقة") !== -1) {
      var se = parseSE(dec);
      if (se.episode === wantE && (se.season === null || se.season === wantS)) {
        if (!bestEp) bestEp = href;
      }
    } else if (dec.indexOf("الموسم") !== -1 && !bestSeasonPage) {
      var se2 = parseSE(dec);
      if (se2.season === wantS) bestSeasonPage = href;
    }
  }

  if (bestEp) return { type: "episode", url: bestEp };
  if (bestSeasonPage) return { type: "season", url: bestSeasonPage };
  return null;
}

/* ---------- Server extraction (all servers) ---------- */

function extractServersFromWatch(html, watchUrl) {
  var baseUrl = getBaseUrl(watchUrl);
  var tasks = [];

  // Direct player iframe
  var piMatch = html.match(/class=["'][^"']*player--iframe[^"']*["'][\s\S]{0,1500}?<iframe[^>]+src=["']([^"']+)["']/i);
  if (piMatch && piMatch[1]) {
    log("Direct player iframe:", piMatch[1]);
    tasks.push({ type: "iframe", url: piMatch[1], referer: watchUrl });
  }

  // All <li server--item>
  var liRe = /<li\b[^>]*>/gi;
  var liM;
  while ((liM = liRe.exec(html)) !== null) {
    if (liM[0].indexOf("server--item") === -1) continue;
    var idM = liM[0].match(/data-id=["']([^"']+)["']/);
    var numM = liM[0].match(/data-server=["']([^"']+)["']/);
    if (idM && numM) {
      tasks.push({
        type: "ajax",
        baseUrl: baseUrl,
        id: idM[1],
        num: numM[1],
        referer: watchUrl
      });
    }
  }

  log("Server tasks:", tasks.length);
  if (tasks.length === 0) return Promise.resolve([]);

  var promises = tasks.map(function (t) {
    if (t.type === "iframe") return resolveEmbedToDirects(t.url, t.referer);
    var ajaxUrl = t.baseUrl + "/wp-content/themes/movies2023/Ajaxat/Single/Server.php";
    return postForm(ajaxUrl, { id: t.id, i: t.num }, t.referer)
      .then(function (resHtml) {
        if (!resHtml) return [];
        var ifr = resHtml.match(/<iframe[^>]+src=["']([^"']+)["']/i);
        if (!ifr) return [];
        log("Server", t.num, "-> embed:", ifr[1]);
        return resolveEmbedToDirects(ifr[1], t.referer);
      });
  });

  return Promise.all(promises).then(function (arrays) {
    var flat = [], seen = {};
    arrays.forEach(function (arr) {
      (arr || []).forEach(function (s) {
        if (s.url && !seen[s.url]) { seen[s.url] = true; flat.push(s); }
      });
    });
    return flat;
  });
}

/* ---------- Embed resolver ---------- */

function unwrapPlayUrl(url) {
  try {
    if (url.indexOf("play.php?to=") === -1) return url;
    var part = url.substring(url.indexOf("play.php?to=") + "play.php?to=".length);
    var decoded = decodeURIComponent(part).trim();
    if (decoded.indexOf("https://") !== decoded.lastIndexOf("https://")) {
      decoded = decoded.substring(decoded.lastIndexOf("https://"));
    }
    return decoded.indexOf("http") === 0 ? decoded : "https:" + decoded.replace(/^:/, "");
  } catch (e) { return url; }
}

function resolveEmbedToDirects(embedUrl, referer) {
  var url = unwrapPlayUrl(embedUrl);
  log("Resolving:", url);
  if (/vidtube\./i.test(url)) return resolveVidTube(url, referer);
  return fetchHtml(url, referer).then(function (html) {
    if (!html) return [];
    var streams = [], seen = {};
    var re = /https?:\/\/[^\s"'<>\\]+\.(?:mp4|m3u8)[^\s"'<>\\]*/gi;
    var m;
    while ((m = re.exec(html)) !== null) {
      if (/\.(jpg|png|gif|webp)/i.test(m[0]) || seen[m[0]]) continue;
      seen[m[0]] = true;
      streams.push({ url: m[0], quality: "HD", label: "Embed" });
    }
    return streams;
  });
}

/* ---------- VidTube ---------- */

function unpackJs(p, a, c, k) {
  var digits = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  function intToBase(num, base) {
    if (num === 0) return "0";
    var n = num, out = "";
    while (n > 0) { out = digits[n % base] + out; n = Math.floor(n / base); }
    return out;
  }
  var map = {};
  for (var i = 0; i < c; i++) {
    var key = intToBase(i, a);
    var val = (k && k.length > i) ? k[i] : null;
    if (val && val.length > 0) map[key] = val;
  }
  return p.replace(/\b\w+\b/g, function (w) { return map[w] !== undefined ? map[w] : w; });
}

function resolveVidTube(vUrl, referer) {
  log("VidTube:", vUrl);
  return fetchHtml(vUrl, referer).then(function (html) {
    if (!html) return [];
    var streams = [], seen = {};
    var hostBase = getBaseUrl(vUrl);

    // 1) download buttons
    var dlRe = /<a\b[^>]*?href=["']([^"']*\/d\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    var dlM;
    var dls = [];
    while ((dlM = dlRe.exec(html)) !== null) {
      var href = dlM[1];
      var qual = dlM[2].match(/<b>([^<]+)<\/b>/i);
      var q = qual ? qual[1].trim() : "Direct";
      var full = href.indexOf("http") === 0 ? href : hostBase + href;
      dls.push((function (u, quality) {
        return fetchHtml(u, vUrl).then(function (dHtml) {
          if (!dHtml) return null;
          var dm = dHtml.match(/href=["']([^"']+\.(?:mp4|m3u8)[^"']*)["']/i) ||
                   dHtml.match(/href=["']([^"']*(?:download|\.mp4)[^"']*)["']/i);
          if (dm && dm[1]) return { url: dm[1], quality: quality, label: "VidTube-DL" };
          return null;
        });
      })(full, q));
    }
    if (dls.length > 0) {
      return Promise.all(dls).then(function (rs) { return rs.filter(function (r) { return r !== null; }); });
    }

    // 2) Packer
    var packerRe = /eval\(function\(p,a,c,k,e,d\)\{[\s\S]*?\}\(\s*['"]([\s\S]*?)['"]\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*['"]([\s\S]*?)['"]\.split/;
    var pm = html.match(packerRe);
    if (!pm) { log("VidTube: no packer"); return []; }
    var p = pm[1].replace(/\\'/g, "'");
    var a = parseInt(pm[2], 10) || 62;
    var c = parseInt(pm[3], 10) || 0;
    var k = pm[4] ? pm[4].split("|") : [];

    var unpacked = unpackJs(p, a, c, k);
    var fileRe = /file\s*:\s*["'](https?:\/\/[^"']+)["']/g;
    var labelRe = /label\s*:\s*["']([^"']+)["']/g;
    var files = [], labels = [], fm, lm;
    while ((fm = fileRe.exec(unpacked)) !== null) files.push(fm[1]);
    while ((lm = labelRe.exec(unpacked)) !== null) labels.push(lm[1]);

    for (var i = 0; i < files.length; i++) {
      if (seen[files[i]]) continue;
      seen[files[i]] = true;
      streams.push({ url: files[i], quality: labels[i] || "Auto", label: "VidTube" });
    }
    log("VidTube unpacked:", streams.length);
    return streams;
  });
}

/* ---------- Page processing ---------- */

function hasServerContent(html) {
  return html && (html.indexOf("server--item") !== -1 ||
                  html.indexOf("player--iframe") !== -1 ||
                  html.indexOf("watch--servers--list") !== -1);
}

function processPage(pageUrl) {
  var clean = pageUrl.split("?")[0].replace(/\/+$/, "");
  var watchUrl = clean + "/watch/";
  log("Watch URL:", watchUrl);

  return fetchHtml(watchUrl, pageUrl).then(function (html) {
    if (hasServerContent(html)) return extractServersFromWatch(html, watchUrl);
    // Fallback: ?embedScreen=true
    var altUrl = clean + "/?embedScreen=true";
    log("Fallback:", altUrl);
    return fetchHtml(altUrl, pageUrl).then(function (alt) {
      if (!alt) return [];
      return extractServersFromWatch(alt, altUrl);
    });
  });
}

/* ---------- Main ---------- */

function getStreams(tmdbId, mediaType, season, episode) {
  log("=== START:", tmdbId, mediaType, "S" + season, "E" + episode);
  var isMovie = mediaType === "movie";

  return tmdbInfo(tmdbId, mediaType)
    .then(function (info) {
      if (!info.titles.length) { log("No TMDB titles"); return null; }
      log("Titles:", info.titles.join(" | "));
      var qs = info.titles.slice(0, 2);
      return Promise.all(qs.map(searchTopCinema)).then(function (arrs) {
        var merged = [], seen = {};
        arrs.forEach(function (arr) {
          (arr || []).forEach(function (r) {
            if (!seen[r.url]) { seen[r.url] = true; merged.push(r); }
          });
        });
        log("Search results:", merged.length);
        return { info: info, results: merged };
      });
    })
    .then(function (ctx) {
      if (!ctx) return null;
      if (isMovie) {
        var mv = pickMovieResult(ctx.results, ctx.info.titles);
        if (!mv) { log("No movie page"); return null; }
        log("Movie page:", mv);
        return { type: "page", url: mv };
      }
      var tv = pickTVResult(ctx.results, ctx.info.titles, season, episode);
      if (!tv) { log("No TV page"); return null; }
      log("TV pick:", tv.type, tv.url);
      return tv;
    })
    .then(function (found) {
      if (!found) return [];

      if (found.type === "page" || found.type === "episode") {
        return processPage(found.url);
      }

      // Series page -> navigate
      return fetchHtml(found.url).then(function (html) {
        if (!html) return [];
        var next = findEpisodeInPage(html, season, episode);
        if (!next) { log("Episode not in series page"); return []; }
        if (next.type === "episode") return processPage(next.url);
        // Season page
        return fetchHtml(next.url).then(function (seasonHtml) {
          if (!seasonHtml) return [];
          var ep = findEpisodeInPage(seasonHtml, season, episode);
          if (!ep || ep.type !== "episode") return [];
          return processPage(ep.url);
        });
      });
    })
    .then(function (streams) {
      if (!streams || !streams.length) { log("No streams"); return []; }
      var final = [], seen = {};
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
      log("=== Final streams:", final.length);
      return final;
    })
    .catch(function (err) { log("FATAL:", err && err.message); return []; });
}

module.exports = { getStreams: getStreams };