/**
 * Anime3rb - Nuvio Provider (Best-effort, high failure risk due to Cloudflare/Livewire)
 * This provider attempts to replicate the Livewire search flow, but Nuvio's lack of
 * WebView makes Cloudflare bypass impossible. Use only if the site is accessible.
 */

var BASE_URL = "https://anime3rb.com";
var USER_AGENT = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";

function log() {
  var args = Array.prototype.slice.call(arguments);
  try { console.log.apply(console, ["[Anime3rb]"].concat(args)); } catch (e) {}
}

function fixUrl(url, base) {
  if (!url) return "";
  var u = String(url).trim();
  if (u.indexOf("http") === 0) return u;
  if (u.indexOf("//") === 0) return "https:" + u;
  if (u.indexOf("/") === 0) return base + u;
  return base + "/" + u;
}

// محاولة جلب الصفحة الرئيسية مع محاولة قراءة الكوكيز
function fetchHome() {
  return fetch(BASE_URL + "/", {
    headers: { "User-Agent": USER_AGENT, "Accept": "text/html" }
  })
  .then(function (res) {
    return res.text().then(function (html) {
      // محاولة استخراج الكوكيز من الرؤوس (قد لا تعمل في Nuvio)
      var cookies = "";
      try {
        var sc = res.headers.get("set-cookie");
        if (sc) cookies = sc;
      } catch (e) {}
      return { html: html, cookies: cookies };
    });
  })
  .catch(function (e) { log("fetchHome error:", e.message); return null; });
}

function searchAnime3rb(query) {
  return fetchHome().then(function (home) {
    if (!home || !home.html) { log("No home page (possibly Cloudflare challenge)"); return []; }
    var html = home.html;

    // إذا كانت الصفحة هي تحدي Cloudflare، لا يمكننا المتابعة
    if (html.toLowerCase().indexOf("cloudflare") !== -1 || html.toLowerCase().indexOf("checking your browser") !== -1) {
      log("Cloudflare challenge detected. Cannot proceed without WebView.");
      return [];
    }

    // استخراج CSRF و snapshot (قد تفشل إذا كانت الصفحة ليست الرئيسية الفعلية)
    var csrfMatch = html.match(/data-csrf=["']([^"']+)["']/);
    var updateUriMatch = html.match(/data-update-uri=["']([^"']+)["']/);
    var snapshotMatch = html.match(/wire:snapshot=["']([^"']+)["']/);

    if (!csrfMatch || !snapshotMatch) {
      log("Required Livewire attributes not found. Page may be incomplete or challenge page.");
      return [];
    }

    var csrf = csrfMatch[1];
    var updateUrl = updateUriMatch ? fixUrl(updateUriMatch[1], BASE_URL) : BASE_URL + "/livewire/update";
    var snapshotRaw = snapshotMatch[1]
      .replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#039;/g, "'");

    var payload = {
      _token: csrf,
      components: [{ snapshot: snapshotRaw, updates: { query: query }, calls: [] }]
    };

    var headers = {
      "User-Agent": USER_AGENT,
      "Content-Type": "application/json",
      "Accept": "application/json",
      "X-Livewire": "1",
      "X-Requested-With": "XMLHttpRequest",
      "Origin": BASE_URL,
      "Referer": BASE_URL + "/"
    };
    if (home.cookies) headers["Cookie"] = home.cookies;

    return fetch(updateUrl, { method: "POST", headers: headers, body: JSON.stringify(payload) })
      .then(function (res) { return res.json(); })
      .then(function (json) {
        if (!json || !json.components) { log("Invalid Livewire response"); return []; }
        var effects = json.components[0].effects || {};
        var resultHtml = effects.html || "";
        if (!resultHtml) return [];

        // تحليل النتائج (نفس المنطق السابق)
        var results = [];
        var re = /<a[^>]+href=["']([^"']+)["'][^>]*>[\s\S]*?<h4[^>]*>([\s\S]*?)<\/h4>/gi;
        var m;
        while ((m = re.exec(resultHtml)) !== null) {
          var href = fixUrl(m[1], BASE_URL);
          var title = m[2].replace(/<[^>]+>/g, "").trim();
          if (title) results.push({ url: href, title: title });
        }
        log("Search results:", results.length);
        return results;
      })
      .catch(function (e) { log("Livewire POST error:", e.message); return []; });
  });
}

// ... (بقية دوال استخراج الحلقات والروابط من الكود السابق، دون تغيير)

function getStreams(tmdbId, mediaType, season, episode) {
  log("START:", tmdbId, mediaType, "S" + season, "E" + episode);
  // ... (استخدام TMDB لجلب العنوان، ثم searchAnime3rb، ثم معالجة الحلقات/الروابط)
  // هذا الجزء يعتمد على نجاح searchAnime3rb، والذي قد يفشل بسبب Cloudflare.
}