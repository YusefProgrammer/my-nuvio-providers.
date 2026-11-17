/**
 * EgyWatch - Nuvio JS Provider
 * Ported from CloudStream Kotlin (EgyWatchProvider).
 * Handles: Firebase URL update, multi-server extraction, hosts/config rules.
 * Compatible with Hermes (Promise chains only).
 */

var DEFAULT_MAIN_URL = "https://rn62mwg.com/egywatchapp/public/api";
var API_KEY = "API_KEY_PLACEHOLDER"; // ضع المفتاح الحقيقي هنا إن وُجد
var USER_AGENT = "EasyPlex/5.0.0 (Android)";

// Firebase config (من الكود الأصلي)
var FB_API_KEY = "FB_API_KEY_PLACEHOLDER";
var FB_APP_ID = "FB_APP_ID_PLACEHOLDER";
var FB_PROJECT_ID = "egy-watch-new";
var FB_PROJECT_NUMBER = "1076822460914";
var FB_PACKAGE_NAME = "com.linkletter.app";
var FB_CERT_SHA1 = "26B02D233509F4AECF56980032343456CEAB722A";

function log() {
  var args = Array.prototype.slice.call(arguments);
  try { console.log.apply(console, ["[EgyWatch]"].concat(args)); } catch (e) {}
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

function fetchJson(url, headers) {
  var h = Object.assign({
    "User-Agent": USER_AGENT,
    "Accept": "application/json"
  }, headers || {});
  return fetch(url, { headers: h })
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .catch(function (e) { log("fetchJson error:", url, e.message); return null; });
}

function postJson(url, body, headers) {
  var h = Object.assign({
    "User-Agent": USER_AGENT,
    "Accept": "application/json",
    "Content-Type": "application/json"
  }, headers || {});
  return fetch(url, { method: "POST", headers: h, body: JSON.stringify(body) })
    .then(function (res) { return res.json(); })
    .catch(function (e) { log("postJson error:", url, e.message); return null; });
}

function fetchText(url, headers) {
  var h = Object.assign({ "User-Agent": USER_AGENT }, headers || {});
  return fetch(url, { headers: h })
    .then(function (res) { return res.text(); })
    .catch(function (e) { log("fetchText error:", url, e.message); return null; });
}

/* ---------------- Firebase URL Update (from Kotlin) ---------------- */

var _currentMainUrl = null;
var _cachedHostsConfig = null;

function getMainUrl() {
  if (_currentMainUrl) return _currentMainUrl;
  // محاولة قراءة الرابط المحفوظ من التخزين المحلي (إن وجد)
  try {
    var saved = localStorage.getItem("egywatch_saved_url");
    if (saved) { _currentMainUrl = saved; return saved; }
  } catch (e) {}
  return DEFAULT_MAIN_URL;
}

function setMainUrl(url) {
  _currentMainUrl = url;
  try { localStorage.setItem("egywatch_saved_url", url); } catch (e) {}
}

function generateFid() {
  // توليد FID بسيط (يمكن استبداله بـ crypto.randomUUID إذا توفر)
  var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
  var fid = "";
  for (var i = 0; i < 22; i++) fid += chars.charAt(Math.floor(Math.random() * chars.length));
  return fid;
}

function checkAndUpdateUrlFromFirebase() {
  if (FB_API_KEY.indexOf("PLACEHOLDER") !== -1) {
    log("Firebase API key not set, skipping URL update");
    return Promise.resolve();
  }
  var fid = generateFid();
  var installUrl = "https://firebaseinstallations.googleapis.com/v1/projects/" + FB_PROJECT_ID + "/installations";
  var installHeaders = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "x-goog-api-key": FB_API_KEY,
    "X-Android-Package": FB_PACKAGE_NAME,
    "X-Android-Cert": FB_CERT_SHA1
  };
  var installPayload = { fid: fid, appId: FB_APP_ID, authVersion: "FIS_v2", sdkVersion: "a:17.0.1" };

  return postJson(installUrl, installPayload, installHeaders)
    .then(function (installRes) {
      if (!installRes || !installRes.authToken) return;
      var token = installRes.authToken.token;
      if (!token) return;

      var configUrl = "https://firebaseremoteconfig.googleapis.com/v1/projects/" + FB_PROJECT_NUMBER + "/namespaces/firebase:fetch";
      var configHeaders = {
        "X-Goog-Api-Key": FB_API_KEY,
        "X-Android-Package": FB_PACKAGE_NAME,
        "X-Android-Cert": FB_CERT_SHA1,
        "X-Goog-Firebase-Installations-Auth": token,
        "Content-Type": "application/json",
        "Accept": "application/json"
      };
      var configPayload = {
        appInstanceId: fid,
        appId: FB_APP_ID,
        packageName: FB_PACKAGE_NAME,
        appInstanceIdToken: token,
        appVersion: "5.0.0",
        appBuild: "50"
      };

      return postJson(configUrl, configPayload, configHeaders).then(function (configRes) {
        if (configRes && configRes.state === "UPDATE" && configRes.entries) {
          var newUrl = configRes.entries.EgywatchV5 || configRes.entries.EgywatchV5_fallback;
          if (newUrl && newUrl.trim()) {
            var clean = newUrl.trim().replace(/\/+$/, "");
            setMainUrl(clean);
            log("URL updated from Firebase:", clean);
          }
        }
      });
    })
    .catch(function (e) { log("Firebase update error:", e.message); });
}

/* ---------------- Hosts Config Rules ---------------- */

function getHostsRules() {
  if (_cachedHostsConfig) return Promise.resolve(_cachedHostsConfig);
  var url = getMainUrl() + "/hosts/config";
  return fetchText(url, { "User-Agent": "okhttp/5.0.0-alpha.6" })
    .then(function (text) {
      if (!text) return [];
      try {
        var arr = JSON.parse(text);
        _cachedHostsConfig = arr;
        return arr;
      } catch (e) { return []; }
    })
    .catch(function () { return []; });
}

/* ---------------- TMDB (اختياري: يمكن استخدامه للبحث) ---------------- */

var TMDB_API_KEY = "6c91e91ec97e117e446a62f4d2ace9b7";

function tmdbTitles(tmdbId, mediaType) {
  var type = mediaType === "tv" ? "tv" : "movie";
  var url = "https://api.themoviedb.org/3/" + type + "/" + tmdbId + "?api_key=" + TMDB_API_KEY + "&append_to_response=translations,alternative_titles";
  return fetch(url).then(function (r) { return r.json(); })
    .then(function (d) {
      var titles = [];
      var push = function (t) { if (t && titles.indexOf(t) === -1) titles.push(t); };
      push(d.title); push(d.name); push(d.original_title); push(d.original_name);
      if (d.translations && d.translations.translations) {
        d.translations.translations.forEach(function (tr) {
          if (tr.iso_639_1 === "ar" && tr.data) { push(tr.data.title); push(tr.data.name); }
        });
      }
      return { titles: titles, year: (d.release_date || d.first_air_date || "").split("-")[0] || null };
    })
    .catch(function () { return { titles: [], year: null }; });
}

/* ---------------- Search on EgyWatch ---------------- */

function searchEgyWatch(query) {
  var mainUrl = getMainUrl();
  var encoded = encodeURIComponent(query + "|vide");
  var url = mainUrl + "/search/" + encoded + "/" + API_KEY;
  return fetchJson(url).then(function (json) {
    if (!json || !json.search) return [];
    return json.search.map(function (item) {
      var id = item.id;
      var title = item.title || item.name || "";
      var type = (item.type || "").toLowerCase();
      var poster = item.poster_path || "";
      var directUrl = type === "movie"
        ? mainUrl + "/media/detail/" + id + "/" + API_KEY
        : mainUrl + "/series/show/" + id + "/" + API_KEY;
      return { id: id, title: title, type: type, poster: poster, url: directUrl, raw: item };
    });
  });
}

/* ---------------- Load Detail (Movie/TV) ---------------- */

function loadDetail(url) {
  return fetchJson(url).then(function (data) {
    if (!data) return null;
    return data;
  });
}

/* ---------------- Load Episodes for TV Series ---------------- */

function loadEpisodes(seriesId) {
  var mainUrl = getMainUrl();
  var seriesUrl = mainUrl + "/series/show/" + seriesId + "/" + API_KEY;
  return fetchJson(seriesUrl).then(function (seriesData) {
    if (!seriesData || !seriesData.seasons) return [];
    var seasonPromises = seriesData.seasons.map(function (season) {
      var seasonId = season.id;
      var seasonNum = season.season_number || 1;
      var seasonUrl = mainUrl + "/series/season/" + seasonId + "/" + API_KEY;
      return fetchJson(seasonUrl).then(function (seasonData) {
        if (!seasonData || !seasonData.episodes) return [];
        return seasonData.episodes.map(function (ep) {
          return {
            name: ep.name || ep.episode_name || ("الحلقة " + (ep.episode_number || 0)),
            season: seasonNum,
            episode: ep.episode_number || 0,
            videos: ep.videos || [],
            poster: ep.still_path || ep.poster_path || ""
          };
        });
      });
    });
    return Promise.all(seasonPromises).then(function (arrays) {
      var all = [];
      arrays.forEach(function (arr) { all = all.concat(arr); });
      return all;
    });
  });
}

/* ---------------- Extract Streams from Videos Array ---------------- */

function extractStreamsFromVideos(videos, referer) {
  if (!videos || !videos.length) return [];
  var streams = [];

  return getHostsRules().then(function (rules) {
    var promises = videos.map(function (video) {
      var link = video.link || video.url;
      if (!link) return Promise.resolve([]);
      var serverName = video.server || "سيرفر";
      var customHeader = video.header || "";
      var videoUserAgent = video.useragent || "";

      // 1. روابط مباشرة
      if (link.indexOf(".m3u8") !== -1 || link.indexOf(".mp4") !== -1) {
        return Promise.resolve([{ url: link, quality: serverName, label: serverName, referer: referer }]);
      }

      // 2. البحث عن قاعدة مطابقة في hosts/config
      var matchedRule = null;
      for (var i = 0; i < rules.length; i++) {
        var rule = rules[i];
        if (!rule.regex_pattern) continue;
        try {
          var pattern = rule.regex_pattern.replace(/\\\//g, "/").replace(/googlefasV/g, "googlefas[A-Za-z]");
          var re = new RegExp(pattern, "i");
          if (re.test(link)) { matchedRule = rule; break; }
        } catch (e) {}
      }

      var headers = {};
      if (videoUserAgent) headers["User-Agent"] = videoUserAgent;
      if (customHeader) {
        customHeader.split("|").forEach(function (part) {
          part = part.trim();
          if (part.indexOf("http") === 0) headers["Referer"] = part;
          else if (part.indexOf(":") !== -1) {
            var k = part.split(":")[0].trim().toLowerCase();
            var v = part.split(":").slice(1).join(":").trim();
            if (k && v) headers[k] = v;
          }
        });
      }
      if (matchedRule && matchedRule.referer) headers["Referer"] = matchedRule.referer;

      // 3. إذا كان هناك قاعدة مطابقة، جرب طرق الاستخراج
      if (matchedRule) {
        return resolveWithRule(link, serverName, headers, matchedRule);
      }

      // 4. محاولة استخراج عامة
      return fallbackExtract(link, serverName, headers);
    });

    return Promise.all(promises).then(function (results) {
      var flat = [];
      results.forEach(function (arr) { if (arr) flat = flat.concat(arr); });
      return flat;
    });
  });
}

function resolveWithRule(link, serverName, headers, rule) {
  var promises = [];
  var enabledParts = (rule.enableded || "").split("|");
  var postUrl = enabledParts[1] && enabledParts[1].indexOf("http") === 0 ? enabledParts[1] : null;
  var urlSite = rule.urlsite;

  if (postUrl) {
    promises.push(
      fetchText(link, headers).then(function (html) {
        if (!html) return [];
        var body = "content=" + encodeURIComponent(html) + "&url=" + encodeURIComponent(link);
        return fetch(postUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "okhttp/5.0.0-alpha.6" },
          body: body
        }).then(function (r) { return r.text(); }).then(function (resText) {
          return parseAndEmitLinks(resText, serverName, headers);
        });
      })
    );
  }

  if (urlSite && (urlSite.slice(-1) === "=" || urlSite.slice(-4) === "api=")) {
    promises.push(
      fetchText(urlSite + link, { "User-Agent": "okhttp/5.0.0-alpha.6" }).then(function (res) {
        return parseAndEmitLinks(res, serverName, headers);
      })
    );
  }

  if (rule.site) {
    promises.push(
      fetchText(link, headers).then(function (html) {
        if (!html) return [];
        var match = html.match(/sources.*(https?:[^"']+)"/i) || html.match(/file\s*:\s*["']([^"']+)["']/i);
        if (match && match[1] && match[1].indexOf("http") === 0) {
          return [{ url: match[1], quality: serverName, label: serverName + " (Direct)", referer: headers.Referer || "" }];
        }
        return [];
      })
    );
  }

  return Promise.all(promises).then(function (arrays) {
    var flat = [];
    arrays.forEach(function (arr) { if (arr) flat = flat.concat(arr); });
    return flat;
  });
}

function parseAndEmitLinks(responseBody, serverName, headers) {
  if (!responseBody) return [];
  var clean = responseBody.replace(/\\\//g, "/");
  var streams = [];

  // نمط file: "url", label: "quality"
  var labelRe = /file\s*:\s*["']([^"']+)["']\s*,\s*label\s*:\s*["']([^"']+)["']/gi;
  var m;
  while ((m = labelRe.exec(clean)) !== null) {
    streams.push({ url: m[1], quality: m[2], label: serverName + " (" + m[2] + ")", referer: headers.Referer || "" });
  }
  if (streams.length) return streams;

  // نمط JSON { status: "success", filtered_content: [...], Quality: [...] }
  try {
    var json = JSON.parse(clean);
    if (json.status === "success" && json.filtered_content) {
      var qualities = json.Quality || [];
      for (var i = 0; i < json.filtered_content.length; i++) {
        streams.push({
          url: json.filtered_content[i],
          quality: qualities[i] || "Normal",
          label: serverName + " (" + (qualities[i] || "Normal") + ")",
          referer: headers.Referer || ""
        });
      }
      return streams;
    }
    if (json.file) {
      streams.push({ url: json.file, quality: "Auto", label: serverName + " (Auto)", referer: headers.Referer || "" });
      return streams;
    }
  } catch (e) {}

  // نمط عام: أي رابط .m3u8 أو .mp4
  var universalRe = /https?:\/\/[^\s"'<>\\]+?\.(?:m3u8|mp4|mkv)(?:\?[^\s"'<>\\]*)?/gi;
  var um;
  while ((um = universalRe.exec(clean)) !== null) {
    streams.push({ url: um[0], quality: "Direct", label: serverName + " (Direct)", referer: headers.Referer || "" });
  }
  return streams;
}

function fallbackExtract(link, serverName, headers) {
  return fetchText(link, headers).then(function (html) {
    if (!html) return [];
    var re = /(?:file|src)\s*:\s*["'](https?:\/\/[^"']+\.(?:m3u8|mp4)[^"']*)["']/gi;
    var match;
    var streams = [];
    while ((match = re.exec(html)) !== null) {
      streams.push({ url: match[1], quality: "Auto", label: serverName + " (Auto)", referer: headers.Referer || "" });
    }
    return streams;
  }).catch(function () { return []; });
}

/* ---------------- Main Entry ---------------- */

function getStreams(tmdbId, mediaType, season, episode) {
  log("START:", tmdbId, mediaType, "S" + season, "E" + episode);

  // 1. تحديث الرابط من Firebase (مرة واحدة)
  return checkAndUpdateUrlFromFirebase()
    .then(function () {
      // 2. جلب العناوين من TMDB
      return tmdbTitles(tmdbId, mediaType);
    })
    .then(function (info) {
      if (!info.titles.length) { log("No TMDB titles"); return []; }
      log("Titles:", info.titles.join(" | "));

      // 3. البحث في EgyWatch بالعنوان الأول
      return searchEgyWatch(info.titles[0]).then(function (results) {
        if (!results.length) { log("No search results"); return []; }

        // 4. اختيار النتيجة الأنسب
        var isMovie = mediaType === "movie";
        var best = null;
        for (var i = 0; i < results.length; i++) {
          var r = results[i];
          if (isMovie && r.type === "movie") { best = r; break; }
          if (!isMovie && r.type !== "movie") { best = r; break; }
        }
        if (!best) best = results[0];
        log("Selected:", best.title, best.type);

        // 5. جلب التفاصيل أو الحلقات
        if (isMovie) {
          return loadDetail(best.url).then(function (detail) {
            if (!detail || !detail.videos) return [];
            return extractStreamsFromVideos(detail.videos, best.url);
          });
        } else {
          var seriesId = best.id;
          return loadEpisodes(seriesId).then(function (episodes) {
            if (!episodes.length) { log("No episodes"); return []; }
            // اختيار الحلقة المطلوبة
            var wantS = parseInt(season, 10) || 1;
            var wantE = parseInt(episode, 10) || 1;
            var targetEp = null;
            for (var i = 0; i < episodes.length; i++) {
              if (episodes[i].season === wantS && episodes[i].episode === wantE) { targetEp = episodes[i]; break; }
            }
            if (!targetEp) { log("Episode S" + wantS + "E" + wantE + " not found"); return []; }
            return extractStreamsFromVideos(targetEp.videos, best.url);
          });
        }
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
          name: "EgyWatch - " + (s.quality || "HD"),
          title: "EgyWatch \u2022 " + (s.label || "Server") + " (" + (isHls ? "HLS" : "MP4") + ")",
          url: s.url,
          quality: s.quality || "HD",
          provider: "egywatch",
          headers: { "User-Agent": USER_AGENT, "Referer": s.referer || getMainUrl() },
          type: isHls ? "hls" : "mp4"
        });
      });
      log("Final streams:", final.length);
      return final;
    })
    .catch(function (err) { log("FATAL:", err && err.message); return []; });
}

module.exports = { getStreams: getStreams };