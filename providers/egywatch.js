// egywatch.js — Nuvio provider (Promise-based, no async/await)

const TMDB_KEY = "6c91e91ec97e117e446a62f4d2ace9b7";
const TMDB = "https://api.themoviedb.org/3";

const API_BASE = "https://gateway.egywatch.live/egywatchapp/public/api/";
const APP_UA = "EasyPlex (Android 14; M2006C3MG; Redmi angelica; en)";
const UA_CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

const EXTRACTOR_DOMAINS = [
  "fasel-hd", "uqload", "streamwish", "vidspeed", "vidspeeds", "mp4plus", "ostvapp.cam", "lulu"
];

const log = (...a) => console.log("[Egywatch]", ...a);

const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/g, "");
const num = (s) => parseInt((s || "").match(/\d+/)?.[0] || "0", 10);
const pad2 = (n) => (n < 10 ? "0" : "") + n;

/* ---------------- HTTP helpers (Promise-based) ---------------- */

function apiGet(endpoint) {
  return fetch(`${API_BASE}${endpoint}`, {
    headers: { "User-Agent": APP_UA, "Accept": "application/json" }
  })
    .then((res) => res.json())
    .catch(() => null);
}

function apiPostForm(endpoint, form) {
  const body = Object.keys(form)
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(form[k])}`)
    .join("&");
  return fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      "User-Agent": APP_UA,
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json"
    },
    body: body
  })
    .then((res) => res.json())
    .catch(() => null);
}

/* ---------------- TMDB ---------------- */

function tmdbTitles(tmdbId, mediaType) {
  const type = mediaType === "tv" ? "tv" : "movie";
  return fetch(
    `${TMDB}/${type}/${tmdbId}?api_key=${TMDB_KEY}&append_to_response=alternative_titles,translations`
  )
    .then((res) => res.json())
    .then((d) => {
      const main = d.name || d.title || "";
      const alt = ((d.alternative_titles || {}).results || []).map((t) => t.title);
      const tr = ((d.translations || {}).translations || []).map(
        (t) => (t.data || {}).title || (t.data || {}).name || ""
      );
      return {
        titles: [...new Set([main, ...alt, ...tr].map((s) => (s || "").trim()).filter(Boolean))],
        year: (d.first_air_date || d.release_date || "").split("-")[0] || null
      };
    })
    .catch(() => ({ titles: [], year: null }));
}

/* ---------------- Matching helpers ---------------- */

const itemYear = (it) => {
  const y = parseInt(it.year, 10);
  if (y) return y;
  return parseInt(String(it.release_date || it.date || "").slice(0, 4), 10) || null;
};

function yearOk(it, year) {
  const y = itemYear(it);
  return !year || !y || y <= 1900 || Math.abs(y - year) <= 1;
}

const typeOk = (it, isMovie) => {
  if (!it) return false;
  const t = String(it.type || it.category || "").toLowerCase();
  return isMovie ? t.includes("movie") || t.includes("film") : t.includes("serie") || t.includes("tv");
};

function findItem(titles, year, isMovie) {
  const seen = new Set();
  const slice = titles.slice(0, 6);

  return Promise.all(slice.map((t) => apiPostForm("search", { q: String(t) }))).then((responses) => {
    const pool = [];
    responses.forEach((res) => {
      const results = res && (Array.isArray(res) ? res : res.results || res.data || []);
      for (const r of results) {
        const id = r && String(r.id || r.movie_id || r.series_id);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        pool.push(r);
      }
    });

    const cand = pool.filter((r) => yearOk(r, year));
    const name = (r) => norm(r.name || r.title || "");
    const qs = titles.map(norm).filter((q) => q.length >= 3);

    for (const q of qs) {
      const hit = cand.find((r) => name(r) === q);
      if (hit) return hit;
    }
    for (const q of qs) {
      if (q.length < 4) continue;
      const hit = cand.find(
        (r) => name(r).length >= 4 && (name(r).includes(q) || q.includes(name(r)))
      );
      if (hit) return hit;
    }
    return cand[0] || pool[0] || null;
  });
}

/* ---------------- Stream helpers ---------------- */

const hostOf = (url) => {
  const m = String(url).match(/^https?:\/\/([^/:?#]+)/i);
  return m ? m[1].toLowerCase() : null;
};

function serverLabel(url) {
  const host = hostOf(url);
  if (!host) return "سيرفر";
  return "سيرفر " + host.replace(/^www\./, "").split(".")[0];
}

function mkStream(label, url, streamTitle, headers, quality) {
  return {
    name: `Egywatch - ${label}`,
    title: streamTitle,
    url: url,
    quality: quality || "Auto",
    size: "Unknown",
    headers: headers,
    provider: "egywatch"
  };
}

const isDirect = (url) => /\.(mp4|m3u8|mpd|mkv|webm)(\?.*)?$/i.test(String(url).split("?")[0]);

function resolveServer(link, streamTitle, out) {
  const label = serverLabel(link);

  if (isDirect(link)) {
    out.push(mkStream(label, link, streamTitle, { "User-Agent": UA_CHROME }));
    return Promise.resolve();
  }

  return fetch(link, {
    headers: { "User-Agent": UA_CHROME, "Referer": "https://egywatch.live/" }
  })
    .then((res) => res.text())
    .then((html) => {
      const match = html.match(/https?:\/\/[^\s"'+\n]+\.(mp4|m3u8)/i);
      if (match) {
        out.push(
          mkStream(label, match[0], streamTitle, { "User-Agent": UA_CHROME, "Referer": link })
        );
      } else {
        out.push(mkStream(label, link, streamTitle, { "User-Agent": UA_CHROME }));
      }
    })
    .catch(() => {
      out.push(mkStream(label, link, streamTitle, { "User-Agent": UA_CHROME }));
    });
}

function playable(stream) {
  return fetch(stream.url, {
    headers: { ...(stream.headers || {}), Range: "bytes=0-511" }
  })
    .then((res) => {
      if (res.status !== 200 && res.status !== 206) return false;
      return res.arrayBuffer().then((buf) => {
        const b = new Uint8Array(buf).slice(0, 512);
        const text = String.fromCharCode.apply(null, Array.from(b.slice(0, 16))).trimStart();
        return (
          text.startsWith("#EXTM3U") ||
          (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) ||
          (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) ||
          b[0] === 0x47
        );
      });
    })
    .catch(() => false);
}

/* ---------------- Main entry ---------------- */

function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
  mediaType = mediaType || "movie";
  const isMovie = mediaType === "movie";
  const s = seasonNum || 1;
  const e = episodeNum || 1;
  log(`tmdb=${tmdbId} type=${mediaType}${isMovie ? "" : ` S${s}E${e}`}`);

  return tmdbTitles(tmdbId, mediaType)
    .then(({ titles, year }) => {
      if (!titles.length) return [];
      const title = titles[0];
      log(`tmdb: "${title}" (${year})`);

      return findItem(titles, parseInt(year || "0", 10) || null, isMovie).then((item) => {
        if (!item) {
          log("not found on Egywatch");
          return [];
        }
        const itemId = item.id || item.movie_id || item.series_id;
        log(`matched: "${item.name || item.title}" (id=${itemId})`);

        const serversPath = isMovie
          ? `movie/${itemId}/servers`
          : `series/${itemId}/seasons`;

        return apiGet(serversPath).then((rawServers) => {
          let linksPromise;

          if (isMovie) {
            const links = (rawServers && (rawServers.servers || rawServers)) || [];
            linksPromise = Promise.resolve(links);
          } else {
            const seasons = Array.isArray(rawServers)
              ? rawServers
              : (rawServers && rawServers.seasons) || [];
            const season =
              seasons.find((x) => String(x.season_number || x.number) === String(s)) ||
              seasons[0];
            const epList = (season && (season.episodes || season.eps)) || [];
            const ep =
              epList.find((x) => num(x.title || x.episode_number) === e) ||
              epList[e - 1];

            if (ep && ep.id) {
              linksPromise = apiGet(`episode/${ep.id}/servers`).then((epServers) => {
                return (epServers && epServers.servers) || epServers || [];
              });
            } else {
              linksPromise = Promise.resolve([]);
            }
          }

          return linksPromise.then((links) => {
            const serverLinks = links
              .map((x) => (typeof x === "string" ? x : x.link || x.url))
              .filter((u) => typeof u === "string" && /^http/.test(u));

            if (!serverLinks.length) {
              log("no servers found");
              return [];
            }
            log(`servers found: ${serverLinks.length}`);

            const streamTitle = isMovie
              ? `${title}${year ? ` (${year})` : ""}`
              : `${title} S${pad2(s)}E${pad2(e)}`;

            const out = [];
            return Promise.all(
              serverLinks.map((link) =>
                resolveServer(link, streamTitle, out).catch(() => false)
              )
            ).then(() => {
              const seen = new Set();
              const unique = [];
              for (const x of out) {
                if (x.url && !seen.has(x.url)) {
                  seen.add(x.url);
                  unique.push(x);
                }
              }

              return Promise.all(unique.map(playable)).then((ok) => {
                const streams = unique.filter((_, i) => ok[i]);
                log(`streams: ${streams.length} of ${unique.length} play`);
                return streams;
              });
            });
          });
        });
      });
    })
    .catch((err) => {
      log(`error: ${err && err.message}`);
      return [];
    });
}

module.exports = { getStreams };
