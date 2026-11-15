const TMDB_KEY = "1c29a5198ee1854bd5eb45dbe8d17d92";
const TMDB = "https://api.themoviedb.org/3";

const API_BASE = "https://gateway.egywatch.live/egywatchapp/public/api/";
const APP_UA = "EasyPlex (Android 14; M2006C3MG; Redmi angelica; en)";
const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

const log = (...a) => console.log("[Egywatch]", ...a);

const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/g, "");
const pad2 = (n) => (n < 10 ? "0" : "") + n;

// جلب العناوين والسنوات من TMDB للمطابقة
async function tmdbTitles(tmdbId, mediaType) {
  const type = mediaType === "tv" ? "tv" : "movie";
  try {
    const res = await fetch(`${TMDB}/${type}/${tmdbId}?api_key=${TMDB_KEY}&append_to_response=alternative_titles,translations`);
    const d = await res.json();
    const main = d.name || d.title || "";
    const alt = ((d.alternative_titles || {}).results || []).map((t) => t.title);
    const tr = ((d.translations || {}).translations || []).map((t) => (t.data || {}).title || (t.data || {}).name || "");
    return {
      titles: [...new Set([main, ...alt, ...tr].map((s) => (s || "").trim()).filter(Boolean))],
      year: (d.first_air_date || d.release_date || "").split("-")[0] || null,
    };
  } catch (e) {
    return { titles: [], year: null };
  }
}

// التحقق من صلاحية وقابلية تشغيل الرابط في Nuvio
async function playable(stream) {
  try {
    const res = await fetch(stream.url, { headers: { ...(stream.headers || {}), Range: "bytes=0-511" } });
    if (res.status !== 200 && res.status !== 206) return false;
    const b = new Uint8Array(await res.arrayBuffer()).slice(0, 512);
    const text = String.fromCharCode.apply(null, Array.from(b.slice(0, 16))).trimStart();
    return text.startsWith("#EXTM3U") ||
      (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) || // MP4 ftyp
      (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) || // WebM / Matroska
      b[0] === 0x47; // MPEG-TS
  } catch (_) {
    return false;
  }
}

// الوظيفة الرئيسية لجلب الروابط والسيرفرات في Nuvio
async function getStreams(tmdbId, mediaType = "movie", seasonNum = null, episodeNum = null) {
  const isMovie = mediaType === "movie";
  const s = seasonNum || 1;
  const e = episodeNum || 1;
  log(`Processing tmdb=${tmdbId} type=${mediaType}${isMovie ? "" : ` S${s}E${e}`}`);

  try {
    const { titles, year } = await tmdbTitles(tmdbId, mediaType);
    if (!titles.length) return [];
    
    log(`Resolved primary title: "${titles[0]}" (${year})`);

    const streams = [];
    
    // يمكنك إضافة استعلامات البحث للـ API الأساسية هنا بناءً على بنية الـ Endpoints المستخرجة من الـ dex
    // مثال على جلب البيانات عبر API الخاصة بـ Egywatch:
    /*
    const searchRes = await fetch(`${API_BASE}search?q=${encodeURIComponent(titles[0])}`, {
      headers: { "User-Agent": APP_UA }
    });
    const searchData = await searchRes.json();
    // مطابقة العناصر واستخراج السيرفرات...
    */

    const seen = new Set();
    const unique = streams.filter(x => {
      if (x.url && !seen.has(x.url)) {
        seen.add(x.url);
        return true;
      }
      return false;
    });

    const ok = await Promise.all(unique.map(playable));
    const validStreams = unique.filter((_, i) => ok[i]);
    
    log(`Found valid streams: ${validStreams.length} of ${unique.length}`);
    return validStreams;

  } catch (err) {
    log(`Error in getStreams: ${err && err.message}`);
    return [];
  }
}

module.exports = { getStreams };
