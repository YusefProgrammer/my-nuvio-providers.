/**
 * Top Cinema Plugin for Nuvio & YO+
 * Developed by: Yousef Messood (Yo)
 */

const BASE_URL = "https://topcinemaa.one";

// 1. وظيفة البحث عن الأفلام والمسلسلات
function search(query) {
    const searchUrl = `${BASE_URL}/search/?query=${encodeURIComponent(query)}`;
    
    return fetch(searchUrl, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
            "Referer": BASE_URL
        }
    })
    .then(response => response.text())
    .then(html => {
        const results = [];
        // تحديث التعبير المنتظم (Regex) ليتوافق مع هيكل النتائج الحالي في توب سينما
        const itemRegex = /<div class="Small--Box">\s*<a href="([^"]+)" title="([^"]+)">[\s\S]*?(?:data-src|src)="([^"]+)"/g;
        let match;
        
        while ((match = itemRegex.exec(html)) !== null) {
            const url = match[1];
            const title = match[2];
            const poster = match[3];
            
            // تحديد نوع العمل (فيلم أو مسلسل/انمي) بناءً على العنوان
            const type = title.includes("مسلسل") || title.includes("انمي") || title.includes("الحلقة") ? "tv" : "movie";
            
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

// 2. جلب تفاصيل العمل (القصة، الحلقات للمسلسلات)
function getMeta(id, type) {
    const url = id.startsWith("http") ? id : `${BASE_URL}/${id}`;

    return fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
            "Referer": BASE_URL
        }
    })
    .then(response => response.text())
    .then(html => {
        // استخراج العنوان
        const titleMatch = html.match(/<h1 class="post-title">([\s\S]*?)<\/h1>/);
        const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : "Top Cinema Video";
        
        // استخراج الوصف / القصة
        const storyMatch = html.match(/<div class="story">\s*<p>([\s\S]*?)<\/p>/) || html.match(/<div class="story">([\s\S]*?)<\/div>/);
        const description = storyMatch ? storyMatch[1].replace(/<[^>]*>/g, '').trim() : "";
        
        // استخراج البوستر
        const posterMatch = html.match(/<div class="image">\s*<img[^>]+src="([^"]+)"/) || html.match(/<div class="post-thumb">\s*<img[^>]+src="([^"]+)"/);
        const poster = posterMatch ? posterMatch[1] : "";

        let videos = [];

        if (type === "tv") {
            // استخراج الحلقات بدقة من قائمة الحلقات داخل صفحة المسلسل
            const epRegex = /<a href="([^"]+)"[^>]*>([\s\S]*?)(?:<em>|<\/em>)([\s\S]*?)<\/a>/g;
            let epMatch;
            let epIndex = 1;
            
            // محاولة مطابقة روابط الحلقات الشائعة في الموقع
            const episodesLinksRegex = /<li>\s*<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/li>/g;
            
            // استخدام البحث المتقدم للحلقات
            const episodesContainer = html.match(/<ul class="episodes--list[^>]*>([\s\S]*?)<\/ul>/) || html.match(/<div class="episodes--list--side">([\s\S]*?)<\/div>/);
            
            if (episodesContainer) {
                const epHtml = episodesContainer[1];
                let singleEpMatch;
                const simpleA = /<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
                
                while ((singleEpMatch = simpleA.exec(epHtml)) !== null) {
                    const epUrl = singleEpMatch[1];
                    const epText = singleEpMatch[2].replace(/<[^>]*>/g, '').trim();
                    
                    videos.push({
                        id: epUrl,
                        title: epText,
                        season: 1,
                        episode: epIndex++,
                        thumbnail: poster
                    });
                }
            }
            
            // في حال لم يتم العثور على حلقات بالطريقة السابقة، يتم اعتماد الحلقات الموجودة في الصفحة مباشرة
            if (videos.length === 0) {
                videos.push({
                    id: url,
                    title: title,
                    season: 1,
                    episode: 1,
                    thumbnail: poster
                });
            }

        } else {
            // إذا كان فيلمًا
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

    return fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
            "Referer": BASE_URL
        }
    })
    .then(response => response.text())
    .then(html => {
        const streams = [];
        
        // استخراج الـ iframe الخاصة بالسيرفرات المشاهدة
        const iframeMatch = html.match(/<iframe[^>]+src="([^"]+)"/g);
        
        if (iframeMatch) {
            iframeMatch.forEach((iframeTag, index) => {
                const srcMatch = iframeTag.match(/src="([^"]+)"/);
                if (srcMatch && srcMatch[1]) {
                    let streamUrl = srcMatch[1];
                    
                    // إصلاح الروابط النسبية لو وجدت
                    if (streamUrl.startsWith("//")) {
                        streamUrl = "https:" + streamUrl;
                    }
                    
                    // استبعاد إعلانات جوجل والتحليلات
                    if (!streamUrl.includes("googletagmanager") && !streamUrl.includes("google-analytics") && !streamUrl.includes("ads")) {
                        streams.push({
                            name: `TopCinema Server ${index + 1}`,
                            title: `سيرفر مشاهدة مباشر ${index + 1} (HD)`,
                            url: streamUrl,
                            quality: "1080p"
                        });
                    }
                }
            });
        }

        // البحث عن روابط التحميل أو السيرفرات البديلة داخل الصفحة
        const serverBtnRegex = /data-watch="([^"]+)"|data-link="([^"]+)"/g;
        let sMatch;
        let altIndex = 1;
        while ((sMatch = serverBtnRegex.exec(html)) !== null) {
            const sUrl = sMatch[1] || sMatch[2];
            if (sUrl && !streams.some(st => st.url === sUrl)) {
                streams.push({
                    name: `TopCinema Alt Server ${altIndex++}`,
                    title: `سيرفر إضافي`,
                    url: sUrl,
                    quality: "720p"
                });
            }
        }

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
