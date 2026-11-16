// egywatch.js — Nuvio provider (Promise-based, Hermes-compatible)
// Fixed: removed playable() filter, improved extraction, no ?. or ...

const TMDB_KEY = "1c29a5198ee1854bd5eb45dbe8d17d92";
const TMDB = "https://api.themoviedb.org/3";

const API_BASE = "https://gateway.egywatch.live/egywatchapp/public/api/";
const APP_UA = "EasyPlex (Android 14; M2006C3MG; Redmi angelica; en)";
const UA_CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

function log() {
  try {
    var args = Array.prototype.slice.call(arguments);
    console.log.apply(console, ["[Egywatch]"].concat(args));
  } catch (e) {}
}

function norm(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/g, "");
}

function num(s) {
  var m = (s || "").match(/\d+/);
  return parseInt((m && m[0]) || "0", 10);
}

function pad2(n) {
  return (n < 10 ? "0" : "") + n;
}

function hasOwn(o, k) {
  return Object.prototype.hasOwnProperty.call(o, k);
}

function mergeHeaders(a, b) {
  var out = {};
  var k;
  if (a) for (k in a) if (hasOwn(a, k)) out[k] = a[k];
  if (b) for (k in b) if (hasOwn(b, k)) out[k] = b[k];
  return out;
}

/* ---------------- HTTP ---------------- */

function apiGet(endpoint) {
  return fetch(API_BASE + endpoint, {
    headers: { "User-Agent": APP_UA, "Accept": "application/json" }
  })
    .then(function (res) { return res.json(); })
    .catch(function (e) { log("apiGet error", endpoint, e && e.message); return null; });
}

function apiPostForm(endpoint, form) {
  var body = Object.keys(form).map(function (k) {
    return encodeURIComponent(k) + "=" + encodeURIComponent(form[k]);
  }).join("&");
  return fetch(API_BASE + endpoint, {
    method: "POST",
    headers: {
      "User-Agent": APP_UA,
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json"
    },
    body: body
  })
    .then(function (res) { return res.json(); })
    .catch(function (e) { log("apiPostForm error", endpoint, e && e.message); return null; });
}

/* ---------------- TMDB ---------------- */

function tmdbTitles(tmdbId, mediaType) {
  var type = mediaType === "tv" ? "tv" : "movie";
  var url = TMDB + "/" + type + "/" + tmdbId + "?api_key=" + TMDB_KEY + "&append_to_response=alternative_titles,translations";
  return fetch(url)
    .then(function (res) { return res.json(); })
    .then(function (d) {
      var main = d.name || d.title || "";
      var alt = ((d.alternative_titles || {}).results || []).map(function (t) { return t.title; });
      var tr = ((d.translations || {}).translations || []).map(function (t) {
        var dd = t.data || {};
        return dd.title || dd.name || "";
      });
      var all = [main].concat(alt).concat(tr);
      var seen = {};
      var out = [];
      for (var i = 0; i < all.length; i++) {
        var s = (all[i] || "").trim();
        if (s && !seen[s]) { seen[s] = 1; out.push(s); }
      }
      return {
        titles: out,
        year: (d.first_air_date || d.release_date || "").split("-")[0] || null
      };
    })
    .catch(function (e) { log("tmdb error", e && e.message); return { titles: [], year: null }; });
}

/* ---------------- matching ---------------- */

function itemYear(it) {
  var y = parseInt(it.year, 10);
  if (y) return y;
  return parseInt(String(it.release_date || it.date || "").slice(0, 4), 10) || null;
}

function yearOk(it, year) {
  var y = itemYear(it);
  return !year || !y || y <= 1900 || Math.abs(y - year) <= 1;
}

function findItem(titles, year, isMovie) {
  var seen = {};
  var slice = titles.slice(0, 6);

  return Promise.all(slice.map(function (t) {
    return apiPostForm("search", { q: String(t) });
  })).then(function (responses) {
    var pool = [];
    responses.forEach(function (res) {
      var results = res ? (Array.isArray(res) ? res : (res.results || res.data || [])) : [];
      for (var i = 0; i < results.length; i++) {
        var r = results[i];
        var id = r ? String(r.id || r.movie_id || r.series_id) : "";
        if (!id || seen[id]) continue;
        seen[id] = 1;
        pool.push(r);
      }
    });

    log("pool size: " + pool.length);

    var cand = pool.filter(function (r) { return yearOk(r, year); });
    var nameOf = function (r) { return norm(r.name || r.title || ""); };
    var qs = titles.map(norm).filter(function (q) { return q.length >= 3; });

    for (var i = 0; i < qs.length; i++) {
      for (var j = 0; j < cand.length; j++) {
        if (nameOf(cand[j]) === qs[i]) return cand[j];
      }
    }
    for (var i2 = 0; i2 < qs.length; i2++) {
      if (qs[i2].length < 4) continue;
      for (var j2 = 0; j2 < cand.length; j2++) {
        var nm = nameOf(cand[j2]);
        if (nm.length >= 4 && (nm.indexOf(qs[i2]) !== -1 || qs[i2].indexOf(nm) !== -1)) return cand[j2];
      }
    }
    return cand[0] || pool[0] || null;
  });
}

/* ---------------- stream helpers ---------------- */

function hostOf(url) {
  var m = String(url).match(/^https?:\/\/([^/:?#]+)/i);
  return m ? m[1].toLowerCase() : null;
}

function serverLabel(url) {
  var host = hostOf(url);
  if (!host) return "سيرفر";
  return "سيرفر " + host.replace(/^www\./, "").split(".")[0];
}

function mkStream(label, url, streamTitle, headers, quality) {
  return {
    name: "Egywatch - " + label,
    title: streamTitle,
    url: url,
    quality: quality || "Auto",
    size: "Unknown",
    headers: headers || {},
    provider: "egywatch"
  };
}

function isDirect(url) {
  var u = String(url).split("?")[0];
  return /\.(mp4|m3u8|mpd|mkv|webm)$/i.test(u);
}

function extractFromHtml(html) {
  var patterns = [
    /"(https?:\/\/[^"]+\.m3u8[^"]*)"/i,
    /"(https?:\/\/[^"]+\.mp4[^"]*)"/i,
    /'(https?:\/\/[^']+\.m3u8[^']*)'/i,
    /'(https?:\/\/[^']+\.mp4[^']*)'/i,
    /(https?:\/\/[^\s"'<>\\]+\.m3u8[^\s"'<>\\]*)/i,
    /(https?:\/\/[^\s"'<>\\]+\.mp4[^\s"'<>\\]*)/i
  ];
  for (var i = 0; i < patterns.length; i++) {
    var m = html.match(patterns[i]);
    if (m && m[1] && m[1].length > 10) return m[1].replace(/\\\//g, "/");
  }
  return null;
}

function resolveServer(link, streamTitle, out) {
  var label = serverLabel(link);

  if (isDirect(link)) {
    out.push(mkStream(label, link, streamTitle, { "User-Agent": UA_CHROME }));
    return Promise.resolve();
  }

  return fetch(link, {
    headers: { "User-Agent": UA_CHROME, "Referer": "https://egywatch.live/" }
  })
    .then(function (res) { return res.text(); })
    .then(function (html) {
      var direct = extractFromHtml(html);
      if (direct) {
        log("extracted:", direct.substring(0, 70));
        out.push(mkStream(label, direct, streamTitle, { "User-Agent": UA_CHROME, "Referer": link }));
      } else {
        log("using embed url:", link);
        out.push(mkStream(label, link, streamTitle, { "User-Agent": UA_CHROME, "Referer": "https://egywatch.live/" }));
      }
    })
    .catch(function (e) {
      log("resolve error", link, e && e.message);
      out.push(mkStream(label, link, streamTitle, { "User-Agent": UA_CHROME }));
    });
}

/* ---------------- main ---------------- */

function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
  mediaType = mediaType || "movie";
  var isMovie = mediaType === "movie";
  var s = seasonNum || 1;
  var e = episodeNum || 1;
  log("tmdb=" + tmdbId + " type=" + mediaType + (isMovie ? "" : " S" + s + "E" + e));

  return tmdbTitles(tmdbId, mediaType)
    .then(function (result) {
      var titles = result.titles;
      var year = result.year;
      if (!titles.length) { log("no tmdb titles"); return []; }
      var title = titles[0];
      log("tmdb: " + title + " (" + year + ")");

      return findItem(titles, parseInt(year || "0", 10) || null, isMovie).then(function (item) {
        if (!item) { log("not found on Egywatch"); return []; }
        var itemId = item.id || item.movie_id || item.series_id;
        log("matched: " + (item.name || item.title) + " (id=" + itemId + ")");

        var serversPath = isMovie
          ? "movie/" + itemId + "/servers"
          : "series/" + itemId + "/seasons";

        return apiGet(serversPath).then(function (rawServers) {
          var linksPromise;

          if (isMovie) {
            var links = (rawServers && (rawServers.servers || rawServers)) || [];
            linksPromise = Promise.resolve(links);
          } else {
            var seasons = Array.isArray(rawServers) ? rawServers : ((rawServers && rawServers.seasons) || []);
            var season = null;
            for (var i = 0; i < seasons.length; i++) {
              if (String(seasons[i].season_number || seasons[i].number) === String(s)) {
                season = seasons[i]; break;
              }
            }
            if (!season) season = seasons[0];
            var epList = (season && (season.episodes || season.eps)) || [];
            var ep = null;
            for (var i2 = 0; i2 < epList.length; i2++) {
              if (num(epList[i2].title || epList[i2].episode_number) === e) {
                ep = epList[i2]; break;
              }
            }
            if (!ep) ep = epList[e - 1];

            if (ep && ep.id) {
              linksPromise = apiGet("episode/" + ep.id + "/servers").then(function (epServers) {
                return (epServers && epServers.servers) || epServers || [];
              });
            } else {
              linksPromise = Promise.resolve([]);
            }
          }

          return linksPromise.then(function (links) {
            var serverLinks = [];
            for (var i = 0; i < links.length; i++) {
              var l = links[i];
              var u = (typeof l === "string") ? l : (l.link || l.url);
              if (typeof u === "string" && /^http/.test(u)) serverLinks.push(u);
            }

            if (!serverLinks.length) { log("no server links"); return []; }
            log("servers: " + serverLinks.length);

            var streamTitle = isMovie
              ? title + (year ? " (" + year + ")" : "")
              : title + " S" + pad2(s) + "E" + pad2(e);

            var out = [];
            return Promise.all(serverLinks.map(function (link) {
              return resolveServer(link, streamTitle, out).catch(function () {});
            })).then(function () {
              var seen = {};
              var unique = [];
              for (var i = 0; i < out.length; i++) {
                if (out[i].url && !seen[out[i].url]) {
                  seen[out[i].url] = 1;
                  unique.push(out[i]);
                }
              }
              log("final streams: " + unique.length);
              return unique;
            });
          });
        });
      });
    })
    .catch(function (err) {
      log("fatal error: " + (err && err.message));
      return [];
    });
}

module.exports = { getStreams: getStreams };
