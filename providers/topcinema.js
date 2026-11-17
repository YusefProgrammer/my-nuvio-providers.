/**
 * Top Cinema Plugin for Nuvio
 * Developed by: Yousef Messood (Yo)
 */

const BASE_URL = "https://topcinemaa.one";

// 1. وظيفة البحث عن الأفلام والمسلسلات
function search(query) {
    const searchUrl = `${BASE_URL}/search/?query=${encodeURIComponent(query)}`;
    
    return fetch(searchUrl)
        .then(response => response.text())
        .then(html => {
            // ملاحظة: في بيئة Nuvio أو باستخدام مكتبات تحليل الـ HTML البسيطة أو Regex للتوافق
            // سنقوم باستخراج عناصر النتائج من هيكل الـ Small--Box الموجود في الصفحة
            const results = [];
            
            // مثال تقريبي للاستخراج عبر Regex أو باختيار العناصر المطابقة لهيكل توب سينما
            const itemRegex = /<div class="Small--Box">\s*<a href="([^"]+)" title="([^"]+)">[\s\S]*?<img[^>]+data-src="([^"]+)"|<img[^>]+src="([^"]+)"/g;
            let match;
            
            while ((match = itemRegex.exec(html)) !== null) {
                const url = match[1];
                const title = match[2];
                const poster = match[3] || match[4];
                
                // تحديد ما إذا كان فيلم أو مسلسل بناءً على الرابط أو العنوان
                const type = title.includes("مسلسل") || title.includes("انمي") ? "tv" : "movie";
                
                results.push({
                    id: url,
                    title: title,
                    type: type,
                    poster: poster,
                    background: poster
                });
            }
            return results;
        })
        .catch(error => {
            console.error("[TopCinema] Search Error:", error);
            return [];
        });
}

// 2. جلب تفاصيل العمل (أقسام، قصة، حلقات للمسلسلات)
function getMeta(id, type) {
    // الـ id هنا سيكون هو رابط الصفحة الخاصة بالعمل (مثلاً صفحة مسلسل Maigret)
    const url = id.startsWith("http") ? id : `${BASE_URL}/${id}`;

    return fetch(url)
        .then(response => response.text())
        .then(html => {
            // استخراج عنوان القصة
            const titleMatch = html.match(/<h1 class="post-title">([\s\S]*?)<\/h1>/);
            const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : "Top Cinema Video";
            
            // استخراج الوصف / القصة
            const storyMatch = html.match(/<div class="story">\s*<p>([\s\S]*?)<\/p>/);
            const description = storyMatch ? storyMatch[1].replace(/<[^>]*>/g, '').trim() : "";
            
            // استخراج البوستر
            const posterMatch = html.match(/<div class="image">\s*<img src="([^"]+)"/);
            const poster = posterMatch ? posterMatch[1] : "";

            let videos = [];

            if (type === "tv") {
                // استخراج الحلقات من قائمة الحلقات الجانبية كما في هيكل توب سينما
                // مثل: <div class="episodes--list--side"> <a href="...">الحلقة 5<em>...</em></a>
                const epRegex = /<a href="([^"]+)"[^>]*>([\s\S]*?)<em>([\s\S]*?)<\/em>/g;
                let epMatch;
                let epIndex = 1;

                while ((epMatch = epRegex.exec(html)) !== null) {
                    const epUrl = epMatch[1];
                    const epText = epMatch[2].replace(/<[^>]*>/g, '').trim();
                    
                    videos.push({
                        id: epUrl,
                        title: epText,
                        season: 1, // يمكن تخصيصه حسب الموسم إذا توفر بالصفحة
                        episode: epIndex++,
                        thumbnail: poster
                    });
                }
            } else {
                // إذا كان فيلمًا، نعتبره فيديو واحد أساسي برابط الصفحة نفسها
                videos.push({
                    id: url,
                    title: title,
                    season: 1,
                    episode: 1,
                    thumbnail: poster
                });
            }

            return {
                id: id,
                name: title,
                type: type,
                description: description,
                poster: poster,
                background: poster,
                videos: videos
            };
        })
        .catch(error => {
            console.error("[TopCinema] Meta Error:", error);
            return null;
        });
}

// 3. جلب الروابط وسيرفرات المشاهدة (Streams)
function getStreams(id, type, season, episode) {
    const url = id.startsWith("http") ? id : `${BASE_URL}/${id}`;

    return fetch(url)
        .then(response => response.text())
        .then(html => {
            const streams = [];
            
            // استخراج سيرفرات المشاهدة من صفحة العرض (مثال: عناصر watch--servers--list أو iframe)
            // موقع توب سينما يعتمد غالباً على iframe أو روابط مضمنة داخل صفحات الحلقات/الأفلام
            const iframeMatch = html.match(/<iframe[^>]+src="([^"]+)"/g);
            
            if (iframeMatch) {
                iframeMatch.forEach((iframeTag, index) => {
                    const srcMatch = iframeTag.match(/src="([^"]+)"/);
                    if (srcMatch && srcMatch[1]) {
                        let streamUrl = srcMatch[1];
                        
                        // تجاهل روابط إعلانية أو تحليلات خارجية
                        if (!streamUrl.includes("googletagmanager") && !streamUrl.includes("google-analytics")) {
                            streams.push({
                                name: `TopCinema Server ${index + 1}`,
                                title: `جودة عالية (HD) - سيرفر ${index + 1}`,
                                url: streamUrl,
                                quality: "1080p"
                            });
                        }
                    }
                });
            }

            // إذا لم يتم العثور على روابط مباشرة، نبحث عن روابط التحميل المباشر أو السيرفرات الخاصة
            const downloadLinkMatch = html.match(/href="([^"]+)"[^>]*class="[^"]*download[^"]*"/g);
            // (يمكنك تخصيص الاستخراج أكثر حسب الحاجة)

            return streams;
        })
        .catch(error => {
            console.error("[TopCinema] Streams Error:", error);
            return [];
        });
}

module.exports = {
    search,
    getMeta,
    getStreams
};
