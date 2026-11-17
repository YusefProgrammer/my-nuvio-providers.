/**
 * TukTukcima - Nuvio JS Provider
 * Ported from CloudStream Kotlin (TukTukHd).
 * Handles Inertia AJAX, TukTukVIP extraction, SmartPlayer (AES-CBC) decryption.
 * Compatible with Hermes (Promise chains only).
 */

var BASE_URL = "https://tuktukhd.com";
var USER_AGENT = "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36";

function log() {
  var args = Array.prototype.slice.call(arguments);
  try { console.log.apply(console, ["[TukTuk]"].concat(args)); } catch (e) {}
}

function fixUrl(url, base) {
  if (!url) return "";
  var u = String(url).trim();
  if (u.indexOf("http") === 0) return u;
  if (u.indexOf("//") === 0) return "https:" + u;
  if (u.indexOf("/") === 0) return base + u;
  return base + "/" + u;
}

/* ---------------- JsUnpacker (Dean Edwards Packer) ---------------- */

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

function jsUnpack(html) {
  var packerRe = /eval\(function\(p,a,c,k,e,d\)\{[\s\S]*?\}\(\s*['"]([\s\S]*?)['"]\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*['"]([\s\S]*?)['"]\.split/;
  var pm = html.match(packerRe);
  if (!pm) return null;
  var p = pm[1].replace(/\\'/g, "'");
  var a = parseInt(pm[2], 10) || 62;
  var c = parseInt(pm[3], 10) || 0;
  var k = pm[4] ? pm[4].split("|") : [];
  return unpackJs(p, a, c, k);
}

/* ---------------- AES-CBC Decrypt (Pure JS) ---------------- */
/* Mini AES implementation (128-bit key, CBC mode) for SmartPlayer.
   Adapted from public domain aes-js (https://github.com/ricmoo/aes-js) */

var AES = (function () {
  var SBOX = [], INV_SBOX = [];
  var RCON = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];
  (function () {
    var p = 1, q = 1;
    do {
      p = p ^ (p << 1) ^ (p & 0x80 ? 0x1b : 0);
      p &= 0xff;
      q ^= q << 1; q ^= q << 2; q ^= q << 4; q &= 0xff;
      if (q & 0x80) q ^= 0x09;
      var x = q ^ ((q << 1) | (q >> 7)) ^ ((q << 2) | (q >> 6)) ^ ((q << 3) | (q >> 5)) ^ ((q << 4) | (q >> 4));
      x &= 0xff;
      SBOX[p] = x ^ 0x63;
    } while (p !== 1);
    SBOX[0] = 0x63;
    for (var i = 0; i < 256; i++) INV_SBOX[SBOX[i]] = i;
  })();

  function xtime(x) { return ((x << 1) ^ ((x >> 7) * 0x1b)) & 0xff; }
  function mul(x, y) {
    var r = 0;
    while (y) {
      if (y & 1) r ^= x;
      x = xtime(x);
      y >>= 1;
    }
    return r;
  }

  function expandKey(key) {
    var w = [], i;
    for (i = 0; i < 4; i++) w[i] = (key[4 * i] << 24) | (key[4 * i + 1] << 16) | (key[4 * i + 2] << 8) | key[4 * i + 3];
    for (i = 4; i < 44; i++) {
      var temp = w[i - 1];
      if (i % 4 === 0) {
        temp = ((temp << 8) | (temp >>> 24)) >>> 0;
        temp = ((SBOX[(temp >>> 24) & 0xff] << 24) | (SBOX[(temp >>> 16) & 0xff] << 16) |
                (SBOX[(temp >>> 8) & 0xff] << 8) | (SBOX[temp & 0xff])) >>> 0;
        temp ^= (RCON[(i / 4) - 1] << 24) >>> 0;
      }
      w[i] = (w[i - 4] ^ temp) >>> 0;
    }
    return w;
  }

  function decryptBlock(block, w) {
    var s = [], i;
    for (i = 0; i < 16; i++) s[i] = block[i] ^ ((w[40 + (i >> 2)] >>> (24 - (i % 4) * 8)) & 0xff);
    for (var round = 9; round >= 0; round--) {
      // InvShiftRows + InvSubBytes + AddRoundKey + InvMixColumns
      var t = [];
      for (i = 0; i < 16; i++) t[i] = INV_SBOX[s[i]];
      // InvShiftRows
      var r = [t[0], t[13], t[10], t[7], t[4], t[1], t[14], t[11], t[8], t[5], t[2], t[15], t[12], t[9], t[6], t[3]];
      // AddRoundKey
      for (i = 0; i < 16; i++) r[i] ^= ((w[round * 4 + (i >> 2)] >>> (24 - (i % 4) * 8)) & 0xff);
      if (round > 0) {
        // InvMixColumns
        for (i = 0; i < 4; i++) {
          var a0 = r[4 * i], a1 = r[4 * i + 1], a2 = r[4 * i + 2], a3 = r[4 * i + 3];
          r[4 * i] = mul(a0, 14) ^ mul(a1, 11) ^ mul(a2, 13) ^ mul(a3, 9);
          r[4 * i + 1] = mul(a0, 9) ^ mul(a1, 14) ^ mul(a2, 11) ^ mul(a3, 13);
          r[4 * i + 2] = mul(a0, 13) ^ mul(a1, 9) ^ mul(a2, 14) ^ mul(a3, 11);
          r[4 * i + 3] = mul(a0, 11) ^ mul(a1, 13) ^ mul(a2, 9) ^ mul(a3, 14);
        }
      }
      s = r;
    }
    return s;
  }

  function decryptCBC(encrypted, key, iv) {
    var w = expandKey(key);
    var out = [];
    var prev = iv;
    for (var off = 0; off < encrypted.length; off += 16) {
      var block = encrypted.slice(off, off + 16);
      var dec = decryptBlock(block, w);
      for (var i = 0; i < 16; i++) dec[i] ^= prev[i];
      out = out.concat(dec);
      prev = block;
    }
    // Remove PKCS#7 padding
    var pad = out[out.length - 1];
    if (pad > 0 && pad <= 16) out = out.slice(0, -pad);
    return out;
  }

  return { decryptCBC: decryptCBC };
})();

/* ---------------- SmartPlayer Decryption (Ported from Kotlin) ---------------- */

var SMART_KEY = "kiemtienmua911ca";

function hexToBytes(hex) {
  hex = hex.trim().replace(/"/g, "");
  if (hex.length % 2 !== 0) hex = hex.slice(0, -1);
  var bytes = [];
  for (var i = 0; i < hex.length; i += 2) bytes.push(parseInt(hex.substr(i, 2), 16));
  return bytes;
}

function generateIvCandidates(domain, videoId) {
  var dOpts = [48, 323];
  if (domain) {
    dOpts.push(domain.length * (domain.length + 2));
    var parts = domain.split(".");
    if (parts.length >= 2) {
      var shortDomain = parts[parts.length - 2] + "." + parts[parts.length - 1];
      dOpts.push(shortDomain.length * (shortDomain.length + 2));
    }
  }
  var wOpts = [0, 105, 141, 189, 63];
  if (videoId) wOpts.push(3 * videoId.charCodeAt(0));

  var candidates = [];
  for (var di = 0; di < dOpts.length; di++) {
    for (var wi = 0; wi < wOpts.length; wi++) {
      var d = dOpts[di], w = wOpts[wi];
      var part1 = "";
      for (var k = 1; k <= 9; k++) part1 += String.fromCharCode(k + d);
      var part2 = String.fromCharCode(d, 111, w, 128, 132, 97, 95);
      var ivStr = part1 + part2;
      var ivBytes = [];
      for (var c = 0; c < 16; c++) ivBytes.push(ivStr.charCodeAt(c) & 0xff);
      candidates.push(ivBytes);
    }
  }
  return candidates;
}

function smartDecrypt(encryptedHex, domain, videoId) {
  var enc = hexToBytes(encryptedHex);
  var key = [];
  for (var i = 0; i < SMART_KEY.length; i++) key.push(SMART_KEY.charCodeAt(i));
  // Use only first 16 bytes for AES-128
  key = key.slice(0, 16);

  var ivs = generateIvCandidates(domain, videoId);
  for (var i = 0; i < ivs.length; i++) {
    try {
      var dec = AES.decryptCBC(enc, key, ivs[i]);
      var text = "";
      for (var j = 0; j < dec.length; j++) text += String.fromCharCode(dec[j]);
      if (text.trim().indexOf("{") === 0) {
        try {
          var json = JSON.parse(text);
          if (json.source) {
            var src = json.source;
            if (src.indexOf("://") !== -1 && !src.startsWith("http")) {
              src = "https" + src.substring(src.indexOf("://"));
            }
            return src;
          }
        } catch (e) {}
      }
    } catch (e) {}
  }
  // Fallback: zero IV
  try {
    var dec = AES.decryptCBC(enc, key, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    var text = "";
    for (var j = 0; j < dec.length; j++) text += String.fromCharCode(dec[j]);
    var m = text.match(/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,10}\/[^\s",\\]+\.m3u8)/) ||
            text.match(/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,10}\/[^\s",\\]+)/);
    if (m) return "https://" + m[1];
  } catch (e) {}
  return null;
}

/* ---------------- HTTP Helpers ---------------- */

function fetchText(url, referer) {
  var headers = { "User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml" };
  if (referer) headers["Referer"] = referer;
  return fetch(url, { headers: headers })
    .then(function (res) { return res.text(); })
    .catch(function (e) { log("fetch error:", url, e.message); return null; });
}

function fetchJson(url, headers) {
  var h = Object.assign({ "User-Agent": USER_AGENT, "Accept": "application/json" }, headers || {});
  return fetch(url, { headers: h })
    .then(function (res) { return res.json(); })
    .catch(function (e) { log("json error:", url, e.message); return null; });
}

/* ---------------- Search ---------------- */

function searchTukTuk(query) {
  var encoded = encodeURIComponent(query);
  var url = BASE_URL + "/?s=" + encoded;
  return fetchText(url).then(function (html) {
    if (!html) return [];
    var results = [];
    var re = /<div class="Block--Item">[\s\S]*?<a[^>]+href=["']([^"']+)["'][^>]*>[\s\S]*?<h3[^>]*>([^<]*)<\/h3>/gi;
    var m;
    while ((m = re.exec(html)) !== null) {
      var href = fixUrl(m[1], BASE_URL);
      var title = m[2].trim();
      if (title) results.push({ url: href, title: title });
    }
    return results;
  });
}

/* ---------------- Detail Extraction ---------------- */

function extractDetail(html) {
  var title = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || "";
  title = title.replace(/<[^>]+>/g, "").trim();
  var poster = (html.match(/<div class="MainSingle[^"]*"[\s\S]*?<img[^>]+src=["']([^"']+)["']/i) || [])[1] || "";
  var isSeries = html.indexOf("allepcont") !== -1 || html.indexOf("allseasonss") !== -1 || html.indexOf("SeriesEpisodes") !== -1;
  return { title: title, poster: poster, isSeries: isSeries, html: html };
}

/* ---------------- Extract Streams from Watch Page ---------------- */

function extractStreamsFromWatch(pageUrl) {
  return fetchText(pageUrl).then(function (html) {
    if (!html) return [];
    var cryptMatch = html.match(/<iframe[^>]+id=["']main-video-frame["'][^>]+data-crypt=["']([^"']+)["']/i);
    if (!cryptMatch) { log("No main-video-frame"); return []; }
    var crypt = cryptMatch[1];
    var playerUrl;
    try { playerUrl = atob(crypt); } catch (e) { return []; }
    log("Player URL:", playerUrl);

    return fetchText(playerUrl, BASE_URL).then(function (playerHtml) {
      if (!playerHtml) return [];
      // Extract cookies and XSRF token from Set-Cookie header (simplified)
      // In Nuvio, fetch may not expose cookies; we'll try to proceed without them.
      // Inertia version
      var verMatch = playerHtml.match(/"version":"([^"]+)"/);
      var version = verMatch ? verMatch[1] : null;

      // Try Inertia request with credentials: 'include' to send cookies automatically
      var headers = {
        "X-Requested-With": "XMLHttpRequest",
        "X-Inertia": "true",
        "X-Inertia-Version": version || "",
        "X-Inertia-Partial-Component": "files/mirror/video",
        "X-Inertia-Partial-Data": "streams",
        "Referer": playerUrl,
        "Accept": "application/json"
      };
      return fetch(playerUrl, { headers: headers, credentials: "include" })
        .then(function (res) { return res.json(); })
        .then(function (inertia) {
          if (!inertia || !inertia.props || !inertia.props.streams) return [];
          var streamsData = inertia.props.streams.data || [];
          var promises = [];
          streamsData.forEach(function (streamItem) {
            var quality = extractQuality(streamItem.resolution || streamItem.label);
            (streamItem.mirrors || []).forEach(function (mirror) {
              var link = mirror.link;
              if (!link) return;
              if (link.indexOf("//") === 0) link = "https:" + link;
              var displayName = mirror.symbol || mirror.driver || "Server";

              if ((mirror.symbol || "").toLowerCase() === "tuktukvip") {
                promises.push(extractTukTukVip(link, quality, displayName));
              } else if ((mirror.driver || "").toLowerCase() === "rpmshare") {
                promises.push(smartPlayerExtract(link, quality, displayName));
              } else {
                promises.push(fallbackExtract(link, quality, displayName));
              }
            });
          });
          return Promise.all(promises).then(function (arrays) {
            var flat = [];
            arrays.forEach(function (arr) { if (arr) flat = flat.concat(arr); });
            return flat;
          });
        })
        .catch(function (e) { log("Inertia error:", e.message); return []; });
    });
  });
}

function extractQuality(res) {
  if (!res) return 480;
  var s = String(res).toLowerCase();
  if (s.indexOf("4k") !== -1 || s.indexOf("2160") !== -1) return 2160;
  if (s.indexOf("1440") !== -1) return 1440;
  if (s.indexOf("1080") !== -1) return 1080;
  if (s.indexOf("720") !== -1) return 720;
  if (s.indexOf("480") !== -1) return 480;
  var n = parseInt(s, 10);
  return isNaN(n) ? 480 : n;
}

/* ---------------- Extractors ---------------- */

function extractTukTukVip(url, quality, displayName) {
  return fetchText(url, BASE_URL).then(function (html) {
    if (!html) return [];
    var unpacked = jsUnpack(html) || html;
    var re = /https:\/\/[^"']+?\/hls\d+\/[^"']+?\/master\.(?:txt|m3u8)(?:\?[^"']*)?/g;
    var matches = unpacked.match(re) || [];
    var streams = [];
    matches.forEach(function (link) {
      streams.push({ url: link, quality: quality, label: displayName, referer: BASE_URL });
    });
    return streams;
  });
}

function smartPlayerExtract(playerUrl, quality, displayName) {
  if (playerUrl.indexOf("//") === 0) playerUrl = "https:" + playerUrl;
  var domainMatch = playerUrl.match(/https?:\/\/([^\/]+)/);
  if (!domainMatch) return Promise.resolve([]);
  var domain = domainMatch[1];
  var videoId = "";
  if (playerUrl.indexOf("#") !== -1) videoId = playerUrl.substring(playerUrl.indexOf("#") + 1).split("&")[0];
  else if (playerUrl.indexOf("id=") !== -1) videoId = playerUrl.substring(playerUrl.indexOf("id=") + 3).split("&")[0];
  if (!videoId) return Promise.resolve([]);

  var apiUrl = "https://" + domain + "/api/v1/video?id=" + videoId;
  var headers = {
    "Referer": "https://" + domain + "/",
    "Origin": "https://" + domain,
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
  };
  return fetchText(apiUrl, headers).then(function (encHex) {
    if (!encHex) return [];
    var dec = smartDecrypt(encHex, domain, videoId);
    if (!dec) { log("SmartPlayer decrypt failed"); return []; }
    var m3u8 = dec.match(/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,10}\/.*)/);
    if (m3u8) dec = "https://" + m3u8[1];
    return [{ url: dec, quality: quality, label: displayName, referer: "https://" + domain + "/" }];
  });
}

function fallbackExtract(link, quality, displayName) {
  return fetchText(link, BASE_URL).then(function (html) {
    if (!html) return [];
    var re = /https?:\/\/[^\s"'<>\\]+\.(?:m3u8|mp4)[^\s"'<>\\]*/gi;
    var m;
    var streams = [];
    while ((m = re.exec(html)) !== null) {
      streams.push({ url: m[0], quality: quality, label: displayName, referer: BASE_URL });
    }
    return streams;
  });
}

/* ---------------- Main ---------------- */

function getStreams(tmdbId, mediaType, season, episode) {
  log("START:", tmdbId, mediaType, "S" + season, "E" + episode);
  var isMovie = mediaType === "movie";

  // For simplicity, search by a hardcoded title? We need TMDB titles.
  // Use TMDB API (same key as before).
  var TMDB_KEY = "6c91e91ec97e117e446a62f4d2ace9b7";
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
    return searchTukTuk(titles[0]).then(function (results) {
      if (!results.length) { log("No search results"); return []; }
      var best = results[0];
      log("Selected:", best.title, best.url);

      if (isMovie) {
        return extractStreamsFromWatch(best.url);
      } else {
        // For TV, need to find episode page. This is complex; simplified:
        // Assume the search result is the series page. Fetch it, find episode link.
        return fetchText(best.url).then(function (seriesHtml) {
          if (!seriesHtml) return [];
          // Find episode links (simplified regex)
          var epRe = /<a[^>]+href=["']([^"']+)["'][^>]*>[\s\S]*?(?:الحلقة|episode)\s*(\d+)/gi;
          var epUrl = null;
          var m;
          while ((m = epRe.exec(seriesHtml)) !== null) {
            if (parseInt(m[2], 10) === parseInt(episode, 10)) { epUrl = fixUrl(m[1], BASE_URL); break; }
          }
          if (!epUrl) { log("Episode not found"); return []; }
          return extractStreamsFromWatch(epUrl);
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
        name: "TukTuk - " + (s.quality || "HD"),
        title: "TukTuk \u2022 " + (s.label || "Server") + " (" + (isHls ? "HLS" : "MP4") + ")",
        url: s.url,
        quality: s.quality || "HD",
        provider: "tuktukcima",
        headers: { "User-Agent": USER_AGENT, "Referer": s.referer || BASE_URL },
        type: isHls ? "hls" : "mp4"
      });
    });
    log("Final streams:", final.length);
    return final;
  }).catch(function (err) { log("FATAL:", err && err.message); return []; });
}

module.exports = { getStreams: getStreams };