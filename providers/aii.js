/**
 * YO Arabic Unified — Nuvio Multi-Source Provider
 * Generated from CloudStream 3rabi Repository (digest 7)
 * Combines 39 Arabic VOD, Series, Turkish, Asian & Anime sources into ONE provider.
 * Every returned server carries its exact source name (e.g. "Akwam - 1080p", "We Cima - VidTube").
 * Runtime: Hermes / QuickJS / Node compatible (Promise-only, zero external dependencies).
 */

var TMDB_KEY = "1c29a5198ee1854bd5eb45dbe8d17d92";
var TMDB_BASE = "https://api.themoviedb.org/3";
var RELAY_BASE = "";
var SOURCE_TIMEOUT_MS = 9500;
var UA_CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
var UA_ANDROID = "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";

var SOURCES = [
  {
    "id": "akwam",
    "name": "Akwam",
    "url": "https://akwam.ss",
    "cat": "vod",
    "types": [
      "movie",
      "tv",
      "anime"
    ],
    "cf": false,
    "method": "html_direct"
  },
  {
    "id": "wecima",
    "name": "We Cima",
    "url": "https://wecima.lifestyle",
    "cat": "vod",
    "types": [
      "movie",
      "tv"
    ],
    "cf": true,
    "method": "cf_html"
  },
  {
    "id": "mycima",
    "name": "MyCima",
    "url": "https://mycima.living",
    "cat": "vod",
    "types": [
      "movie",
      "tv",
      "anime"
    ],
    "cf": true,
    "method": "cf_html"
  },
  {
    "id": "faselhd",
    "name": "FaselHD",
    "url": "https://web11118x.faselhdx.life",
    "cat": "vod",
    "types": [
      "movie",
      "tv",
      "anime"
    ],
    "cf": true,
    "method": "cf_html"
  },
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
  },
  {
    "id": "shahid4u",
    "name": "Shahid4u",
    "url": "https://shahed4u.im",
    "cat": "vod",
    "types": [
      "movie",
      "tv",
      "anime"
    ],
    "cf": true,
    "method": "cf_html"
  },
  {
    "id": "tuktukcima",
    "name": "TukTukcima",
    "url": "https://tuktukhd.com",
    "cat": "vod",
    "types": [
      "movie",
      "tv",
      "anime"
    ],
    "cf": false,
    "method": "html_ajax"
  },
  {
    "id": "egydead",
    "name": "Egydead",
    "url": "https://tv10.egydead.live",
    "cat": "vod",
    "types": [
      "movie",
      "tv"
    ],
    "cf": true,
    "method": "cf_html"
  },
  {
    "id": "egywatch",
    "name": "EgyWatch",
    "url": "https://rn62mwg.com/egywatchapp/public/api",
    "cat": "vod",
    "types": [
      "movie",
      "tv",
      "anime"
    ],
    "cf": false,
    "method": "json_api"
  },
  {
    "id": "cee",
    "name": "Cee",
    "url": "https://cee.buzz",
    "cat": "vod",
    "types": [
      "movie",
      "tv"
    ],
    "cf": false,
    "method": "json_api"
  },
  {
    "id": "cinemana",
    "name": "Cinemana",
    "url": "https://cinemana.shabakaty.cc",
    "cat": "vod",
    "types": [
      "movie",
      "tv"
    ],
    "cf": false,
    "method": "json_api"
  },
  {
    "id": "vodu",
    "name": "Vodu",
    "url": "https://movie.vodu.me",
    "cat": "vod",
    "types": [
      "movie",
      "tv",
      "anime"
    ],
    "cf": false,
    "method": "html_direct"
  },
  {
    "id": "cimaclub",
    "name": "CimaClub",
    "url": "https://cimacub.com",
    "cat": "vod",
    "types": [
      "movie",
      "tv"
    ],
    "cf": false,
    "method": "html_ajax"
  },
  {
    "id": "cimalight",
    "name": "CimaLight",
    "url": "https://r.cimalight.co",
    "cat": "vod",
    "types": [
      "movie",
      "tv"
    ],
    "cf": true,
    "method": "cf_html"
  },
  {
    "id": "cimatn",
    "name": "CimaTn",
    "url": "https://www.cimatn.com",
    "cat": "vod",
    "types": [
      "movie",
      "tv"
    ],
    "cf": false,
    "method": "html_direct"
  },
  {
    "id": "5tv",
    "name": "5TV",
    "url": "https://new61.5tv.lol",
    "cat": "vod",
    "types": [
      "movie",
      "tv",
      "anime"
    ],
    "cf": false,
    "method": "html_direct"
  },
  {
    "id": "aflaam",
    "name": "Aflaam",
    "url": "https://aflaam.com",
    "cat": "vod",
    "types": [
      "movie",
      "tv"
    ],
    "cf": false,
    "method": "html_direct"
  },
  {
    "id": "alooytv",
    "name": "AlooyTv",
    "url": "https://fitnur.com/alooytv",
    "cat": "vod",
    "types": [
      "movie",
      "tv",
      "anime"
    ],
    "cf": false,
    "method": "html_direct"
  },
  {
    "id": "bristege",
    "name": "Bristege",
    "url": "https://amd.brstej.com",
    "cat": "vod",
    "types": [
      "movie",
      "tv"
    ],
    "cf": false,
    "method": "html_direct"
  },
  {
    "id": "elif",
    "name": "Elif",
    "url": "https://n.elif.news",
    "cat": "vod",
    "types": [
      "movie",
      "tv",
      "anime"
    ],
    "cf": true,
    "method": "cf_html"
  },
  {
    "id": "oscartv",
    "name": "Oscar TV",
    "url": "https://ostv-11-11.xyz",
    "cat": "vod",
    "types": [
      "movie",
      "tv",
      "anime"
    ],
    "cf": false,
    "method": "json_api"
  },
  {
    "id": "shahidwbas",
    "name": "ShahidWBas",
    "url": "https://w30.shahidwbas.tv",
    "cat": "vod",
    "types": [
      "movie",
      "tv"
    ],
    "cf": false,
    "method": "html_ajax"
  },
  {
    "id": "tuniflix",
    "name": "TuniFlix",
    "url": "https://tuniflix.site",
    "cat": "vod",
    "types": [
      "movie",
      "tv"
    ],
    "cf": false,
    "method": "html_direct"
  },
  {
    "id": "tuniflexblog",
    "name": "Tunflix Blog",
    "url": "https://ttunflix.blogspot.com",
    "cat": "vod",
    "types": [
      "movie",
      "tv"
    ],
    "cf": false,
    "method": "json_api"
  },
  {
    "id": "3isk",
    "name": "3isk قصة عشق",
    "url": "https://3esk.onl",
    "cat": "asian_turkish",
    "types": [
      "tv",
      "movie"
    ],
    "cf": false,
    "method": "html_direct"
  },
  {
    "id": "eseek",
    "name": "Eseek عشق 2",
    "url": "https://qeseh.net",
    "cat": "asian_turkish",
    "types": [
      "tv",
      "movie"
    ],
    "cf": false,
    "method": "html_direct"
  },
  {
    "id": "krmzy",
    "name": "Krmzy قرمزي",
    "url": "https://krmzi.org",
    "cat": "asian_turkish",
    "types": [
      "tv"
    ],
    "cf": true,
    "method": "cf_html"
  },
  {
    "id": "asia2tv",
    "name": "Asia2TV",
    "url": "https://ww1.asia2tv.pw",
    "cat": "asian_turkish",
    "types": [
      "tv",
      "movie"
    ],
    "cf": false,
    "method": "html_direct"
  },
  {
    "id": "lodynet",
    "name": "LodyNet",
    "url": "https://lodynet.watch",
    "cat": "asian_turkish",
    "types": [
      "movie",
      "tv"
    ],
    "cf": false,
    "method": "json_api"
  },
  {
    "id": "viu",
    "name": "Viu",
    "url": "https://www.viu.com",
    "cat": "asian_turkish",
    "types": [
      "movie",
      "tv"
    ],
    "cf": false,
    "method": "json_api"
  },
  {
    "id": "animewitcher",
    "name": "AnimeWitcher",
    "url": "https://animewitcher.com",
    "cat": "anime",
    "types": [
      "anime",
      "movie",
      "tv"
    ],
    "cf": false,
    "method": "json_api"
  },
  {
    "id": "animerift",
    "name": "AnimeRift",
    "url": "https://gateway.embrassme.top/api/v4",
    "cat": "anime",
    "types": [
      "anime",
      "tv"
    ],
    "cf": false,
    "method": "json_api"
  },
  {
    "id": "anim3rb",
    "name": "Anime3rb",
    "url": "https://anime3rb.com",
    "cat": "anime",
    "types": [
      "anime",
      "movie",
      "tv"
    ],
    "cf": false,
    "method": "html_direct"
  },
  {
    "id": "anime4up",
    "name": "Anime4Up",
    "url": "https://w1.anime4up.rest",
    "cat": "anime",
    "types": [
      "anime",
      "movie",
      "tv"
    ],
    "cf": true,
    "method": "cf_html"
  },
  {
    "id": "animerco",
    "name": "Animerco",
    "url": "https://gat.animerco.org",
    "cat": "anime",
    "types": [
      "anime",
      "movie",
      "tv"
    ],
    "cf": true,
    "method": "html_ajax"
  },
  {
    "id": "animephoenix",
    "name": "Anime-Phoenix",
    "url": "https://anime-phoenix.com",
    "cat": "anime",
    "types": [
      "anime",
      "movie",
      "tv"
    ],
    "cf": true,
    "method": "cf_html"
  },
  {
    "id": "witanime",
    "name": "WitAnime",
    "url": "https://witanime.site",
    "cat": "anime",
    "types": [
      "anime",
      "movie",
      "tv"
    ],
    "cf": false,
    "method": "html_direct"
  },
  {
    "id": "carateen",
    "name": "Carateen",
    "url": "https://carateen.tv",
    "cat": "cartoon",
    "types": [
      "movie",
      "tv",
      "anime"
    ],
    "cf": false,
    "method": "json_api"
  },
  {
    "id": "dimatoon",
    "name": "Dima Toon",
    "url": "https://www.dima-toon.com",
    "cat": "cartoon",
    "types": [
      "tv",
      "anime"
    ],
    "cf": false,
    "method": "html_direct"
  }
];

function log() {
  var args = Array.prototype.slice.call(arguments);
  try { console.log.apply(console, ["[YO-Unified]"].concat(args)); } catch (e) {}
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

function postForm(url, dataObj, headers, timeoutMs) {
  var pairs = [];
  for (var k in dataObj) {
    if (Object.prototype.hasOwnProperty.call(dataObj, k)) {
      pairs.push(encodeURIComponent(k) + "=" + encodeURIComponent(dataObj[k]));
    }
  }
  var h = Object.assign({
    "Content-Type": "application/x-www-form-urlencoded",
    "X-Requested-With": "XMLHttpRequest"
  }, headers || {});
  return safeFetch(url, { method: "POST", headers: h, body: pairs.join("&") }, timeoutMs)
    .then(function (r) { return r.text(); })
    .catch(function () { return ""; });
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
  // JWPlayer / Clappr / JSON file keys
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
  // Direct media already
  if (/\.(?:m3u8|mp4)(?:\?|$)/i.test(embedUrl)) {
    return Promise.resolve([{
      url: embedUrl,
      quality: extractQuality(embedUrl),
      server: serverHint || "Direct",
      referer: referer || embedUrl
    }]);
  }
  // Host-specific fast extractors ported from digest
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

  if (host.indexOf("dailymotion") !== -1 || host.indexOf("dai.ly") !== -1) {
    var dmId = (embedUrl.match(/video\/([a-zA-Z0-9]+)/) || [])[1];
    if (dmId) {
      return fetchJson("https://www.dailymotion.com/player/metadata/video/" + dmId).then(function (meta) {
        if (!meta || !meta.qualities || !meta.qualities.auto) return [];
        return meta.qualities.auto.map(function (q) {
          return { url: q.url, quality: "HD", server: "Dailymotion", referer: "https://www.dailymotion.com/" };
        });
      });
    }
  }

  if (host.indexOf("mail.ru") !== -1 || host.indexOf("my.mail.ru") !== -1) {
    return fetchText(embedUrl, { "Referer": referer || embedUrl }).then(function (html) {
      var metaUrl = (html.match(/"metadataUrl"\s*:\s*"([^"]+)"/) || [])[1];
      if (!metaUrl) return extractDirectMediaFromText(html, embedUrl, "Mail.ru");
      return fetchJson(absUrl(metaUrl, embedUrl)).then(function (json) {
        if (!json || !json.videos) return [];
        return json.videos.map(function (v) {
          return { url: absUrl(v.url, embedUrl), quality: v.key || "HD", server: "Mail.ru", referer: embedUrl };
        });
      });
    });
  }

  // Generic embed resolver: VidTube, StreamWish, FileMoon, EarnVids, Uqload, Mixdrop, Videoland, Fasel, etc.
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
    var genres = (en.genres || []).map(function (g) { return g.id; });
    var countries = en.origin_country || [];
    var isAnime = genres.indexOf(16) !== -1 && (
      en.original_language === "ja" || countries.indexOf("JP") !== -1 || countries.indexOf("CN") !== -1
    );
    var isAsian = ["ko", "ja", "zh", "th"].indexOf(en.original_language) !== -1;
    var isTurkish = en.original_language === "tr" || countries.indexOf("TR") !== -1;
    return {
      tmdbId: tmdbId,
      mediaType: type,
      titles: titles,
      primaryTitle: en.title || en.name || ar.title || ar.name || "",
      arTitle: ar.title || ar.name || "",
      year: year,
      isAnime: isAnime,
      isAsian: isAsian,
      isTurkish: isTurkish
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
  // Base64 encoded data-url / data-crypt attributes (WeCima / TukTuk / MyCima)
  var dataRe = /(?:data-url|data-crypt|data-watch|data-embed-url)\s*=\s*["']([^"']+)["']/gi;
  while ((m = dataRe.exec(html)) !== null) {
    var val = m[1].trim();
    if (val.indexOf("http") !== 0) {
      var decoded = b64Decode(val);
      if (decoded.indexOf("http") === 0) val = decoded;
    }
    if (val.indexOf("http") === 0 && urls.indexOf(val) === -1) urls.push(val);
  }
  return urls;
}

/* ---------------- Ported Source Runners ---------------- */
function runCeeOrCinemana(src, tmdbInfo, mediaType, season, episode) {
  var apiV2 = src.url.replace(/\/$/, "") + "/api/v2";
  var query = encodeURIComponent(tmdbInfo.primaryTitle);
  var searchUrl = src.id === "cee"
    ? apiV2 + "/search?q=" + query
    : src.url.replace(/\/$/, "") + "/api/android/allVideoSearch?videoTitle=" + query;
  return fetchJson(searchUrl).then(function (data) {
    var items = Array.isArray(data) ? data : (data && (data.data || data.results || data.items)) || [];
    if (!items.length) return [];
    var best = items[0], bestSc = 0;
    for (var i = 0; i < items.length; i++) {
      var sc = scoreMatch(items[i].en_title || items[i].ar_title || items[i].title || "", tmdbInfo);
      if (sc > bestSc) { bestSc = sc; best = items[i]; }
    }
    var itemId = best.nb || best.id || best._id;
    if (!itemId) return [];
    var targetIdPromise = Promise.resolve(itemId);
    if (mediaType === "tv" && src.id === "cinemana") {
      var epApi = src.url.replace(/\/$/, "") + "/api/android/videoSeason/id/" + itemId;
      targetIdPromise = fetchJson(epApi).then(function (eps) {
        var list = Array.isArray(eps) ? eps : [];
        var wantS = parseInt(season, 10) || 1;
        var wantE = parseInt(episode, 10) || 1;
        for (var j = 0; j < list.length; j++) {
          if (parseInt(list[j].season, 10) === wantS && parseInt(list[j].episodeNummer || list[j].episode, 10) === wantE) {
            return list[j].nb || list[j].id;
          }
        }
        return itemId;
      });
    }
    return targetIdPromise.then(function (vidId) {
      var filesUrl = src.id === "cee"
        ? apiV2 + "/transcoddedFiles/id/" + vidId
        : src.url.replace(/\/$/, "") + "/api/android/transcoddedFiles/id/" + vidId;
      return fetchJson(filesUrl).then(function (files) {
        if (!Array.isArray(files)) return [];
        return files.filter(function (f) { return f.videoUrl; }).map(function (f) {
          return {
            url: f.videoUrl,
            quality: extractQuality(f.resolution || f.name || "HD"),
            server: f.resolution || "Direct",
            referer: src.url
          };
        });
      });
    });
  });
}

function runVodu(src, tmdbInfo, mediaType, season, episode) {
  var q = encodeURIComponent(tmdbInfo.primaryTitle);
  var url = src.url + "/search?q=" + q + "&sort=newest&sortBy=adddate&sortType=desc&p=1";
  return fetchText(url).then(function (html) {
    var match = findBestAnchor(html, src.url, tmdbInfo, mediaType);
    if (!match) return [];
    return fetchText(match.href).then(function (detailHtml) {
      var targetPromise = Promise.resolve(detailHtml);
      if (mediaType === "tv") {
        var epHref = findEpisodeLink(detailHtml, src.url, season, episode);
        if (epHref) targetPromise = fetchText(epHref);
      }
      return targetPromise.then(function (pageHtml) {
        var out = [];
        var qMatch = pageHtml.match(/const\s+qualitiesRaw\s*=\s*(\{[\s\S]*?\});/);
        if (qMatch) {
          try {
            var qJson = JSON.parse(qMatch[1]);
            for (var label in qJson) {
              if (qJson[label] && qJson[label].url) {
                out.push({
                  url: qJson[label].url.replace(/\\\//g, "/"),
                  quality: extractQuality(label),
                  server: "Vodu " + label,
                  referer: src.url + "/"
                });
              }
            }
          } catch (e) {}
        }
        var fbMatch = pageHtml.match(/const\s+fallbackUrl\s*=\s*"([^"]+)"/);
        if (fbMatch) {
          out.push({ url: fbMatch[1].replace(/\\\//g, "/"), quality: "720p", server: "Standard", referer: src.url + "/" });
        }
        return out;
      });
    });
  });
}

function runAnimeRift(src, tmdbInfo, season, episode) {
  var q = encodeURIComponent(tmdbInfo.primaryTitle);
  return fetchJson(src.url + "/library/search?page=0&limit=10&query=" + q).then(function (res) {
    var items = (res && (res.data || res.results || res.items)) || (Array.isArray(res) ? res : []);
    if (!items.length) return [];
    var anime = items[0];
    var animeId = anime.id || anime._id;
    if (!animeId) return [];
    return fetchJson(src.url + "/anime/" + animeId + "/episodes").then(function (epRes) {
      var eps = (epRes && (epRes.data || epRes.episodes)) || (Array.isArray(epRes) ? epRes : []);
      var wantE = parseInt(episode, 10) || 1;
      var epObj = eps.filter(function (x) { return parseInt(x.number || x.episode_number, 10) === wantE; })[0] || eps[0];
      if (!epObj) return [];
      var epId = epObj.id || epObj._id;
      return fetchJson(src.url + "/episode/" + epId + "/servers").then(function (srvRes) {
        var servers = (srvRes && (srvRes.data || srvRes.servers)) || (Array.isArray(srvRes) ? srvRes : []);
        return allSettled(servers.slice(0, 6).map(function (sv) {
          return resolveEmbedUrl(sv.url || sv.link, src.url, sv.name || "Server");
        })).then(function (settled) {
          var out = [];
          settled.forEach(function (r) { if (r.status === "fulfilled") out = out.concat(r.value); });
          return out;
        });
      });
    });
  });
}

function runOscarTv(src, tmdbInfo, mediaType, season, episode) {
  var q = encodeURIComponent(tmdbInfo.primaryTitle);
  var endpoint = mediaType === "movie" ? "api/movies" : "api/series";
  return fetchJson(src.url + "/" + endpoint + "?search=" + q).then(function (res) {
    var items = (res && (res.data || res.results)) || (Array.isArray(res) ? res : []);
    if (!items.length) return [];
    var item = items[0];
    return extractDirectMediaFromText(JSON.stringify(item), src.url, "OscarAPI");
  });
}

function runTuniflixBlog(src, tmdbInfo, mediaType, season, episode) {
  var q = encodeURIComponent(tmdbInfo.primaryTitle);
  return fetchJson(src.url + "/feeds/posts/default?alt=json&q=" + q + "&max-results=10").then(function (feed) {
    var entries = (feed && feed.feed && feed.feed.entry) || [];
    if (!entries.length) return [];
    var html = (entries[0].content && entries[0].content.$t) || "";
    var iframes = extractIframesFromHtml(html, src.url);
    return allSettled(iframes.slice(0, 5).map(function (u) {
      return resolveEmbedUrl(u, src.url, "Blogger");
    })).then(function (settled) {
      var out = [];
      settled.forEach(function (r) { if (r.status === "fulfilled") out = out.concat(r.value); });
      return out;
    });
  });
}

function buildSearchUrl(src, query) {
  var q = encodeURIComponent(query);
  switch (src.id) {
    case "wecima":
    case "mycima":
      return src.url + "/filtering/?keywords=" + q;
    case "topcinema":
      return src.url + "/search/?query=" + q + "&type=all";
    case "shahid4u":
    case "akwam":
    case "aflaam":
    case "alooytv":
    case "cimatn":
    case "witanime":
      return src.url + "/search?q=" + q;
    case "5tv":
    case "animephoenix":
      return src.url + "/search/?q=" + q;
    case "3isk":
      return src.url + "/search/" + q + "/";
    case "cimalight":
    case "bristege":
    case "elif":
      return src.url + "/search.php?keywords=" + q;
    default:
      return src.url + "/?s=" + q;
  }
}

function runHtmlSource(src, tmdbInfo, mediaType, season, episode) {
  var searchQuery = (src.cat === "asian_turkish" && tmdbInfo.arTitle)
    ? tmdbInfo.arTitle
    : tmdbInfo.primaryTitle;

  var fetchSearch = src.id === "shahidwbas"
    ? postForm(src.url + "/ajax-search.php", { queryString: searchQuery }, { "Referer": src.url + "/" })
    : fetchText(buildSearchUrl(src, searchQuery), { "Referer": src.url + "/" });

  return fetchSearch.then(function (searchHtml) {
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

        // TopCinema / CimaClub / Shahid4u / Egydead watch path patterns
        if (src.id === "shahid4u" && targetUrl.indexOf("/watch/") === -1) {
          var sWatch = targetUrl.replace(/\/(?:film|episode|download|season)\//, "/watch/");
          extraPromises.push(fetchText(sWatch, { "Referer": targetUrl }));
        } else if (src.id === "topcinema" && targetUrl.indexOf("/watch/") === -1) {
          extraPromises.push(fetchText(targetUrl.replace(/\/+$/, "") + "/watch/", { "Referer": targetUrl }));
        } else if (src.id === "egydead" && targetUrl.indexOf("view=watch") === -1) {
          extraPromises.push(fetchText(targetUrl + (targetUrl.indexOf("?") === -1 ? "?view=watch" : "&view=watch"), { "Referer": targetUrl }));
        } else if (src.id === "cimaclub") {
          extraPromises.push(postForm(targetUrl, { watch: "1" }, { "Referer": targetUrl }));
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
  if (mediaType === "movie" && src.types.indexOf("movie") === -1 && src.types.indexOf("anime") === -1) {
    return Promise.resolve([]);
  }
  if (mediaType !== "movie" && src.types.indexOf("tv") === -1 && src.types.indexOf("anime") === -1) {
    return Promise.resolve([]);
  }

  var runner;
  if (src.id === "cee" || src.id === "cinemana") {
    runner = runCeeOrCinemana(src, tmdbInfo, mediaType, season, episode);
  } else if (src.id === "vodu") {
    runner = runVodu(src, tmdbInfo, mediaType, season, episode);
  } else if (src.id === "animerift") {
    runner = runAnimeRift(src, tmdbInfo, season, episode);
  } else if (src.id === "oscartv") {
    runner = runOscarTv(src, tmdbInfo, mediaType, season, episode);
  } else if (src.id === "tuniflexblog") {
    runner = runTuniflixBlog(src, tmdbInfo, mediaType, season, episode);
  } else {
    runner = runHtmlSource(src, tmdbInfo, mediaType, season, episode);
  }

  return withTimeout(runner, SOURCE_TIMEOUT_MS, []).then(function (streams) {
    if ((!streams || !streams.length) && RELAY_BASE) {
      var idStr = mediaType === "movie"
        ? String(tmdbInfo.tmdbId)
        : String(tmdbInfo.tmdbId) + ":" + String(season || 1) + ":" + String(episode || 1);
      var relayType = mediaType === "movie" ? "movie" : "series";
      return fetchJson(RELAY_BASE + "/api/resolve/" + relayType + "/" + idStr + "?provider=" + encodeURIComponent(src.id))
        .then(function (data) { return (data && data.streams) || []; });
    }
    return streams || [];
  }).then(function (streams) {
    return (streams || []).map(function (s) {
      var isHls = s.url.indexOf(".m3u8") !== -1 || s.type === "hls";
      var q = s.quality || extractQuality(s.url);
      // CRITICAL: Server name IS the Source Name
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

    // Filter out anime-only sources for live-action unless it is anime
    var eligible = SOURCES.filter(function (src) {
      if (src.cat === "anime" && !tmdbInfo.isAnime) return false;
      if (src.cat === "asian_turkish" && !tmdbInfo.isAsian && !tmdbInfo.isTurkish && !tmdbInfo.arTitle) return false;
      return true;
    });

    return allSettled(eligible.map(function (src) {
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
      log("DONE:", final.length, "streams from", eligible.length, "sources in", (Date.now() - t0) + "ms");
      return final;
    });
  }).catch(function (err) {
    log("FATAL:", err && err.message);
    return [];
  });
}

module.exports = { getStreams: getStreams };