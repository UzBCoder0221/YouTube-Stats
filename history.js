let globalStopFlag = false;
let collectedData = null;

function scrapeWatchHistory() {
    const videos = [];
    
    const lockups = document.querySelectorAll('yt-lockup-view-model:not([data-scraped])');
    console.log(`📦 Found ${lockups.length} NEW lockups to scrape`);
    
    lockups.forEach((lockup) => {
        const link = lockup.querySelector('a[href*="/watch?v="]');
        if (!link) return;
        
        const url = new URL(link.href, window.location.origin);
        const videoId = url.searchParams.get('v');
        
        const progressBar = lockup.querySelector('div.ytThumbnailOverlayProgressBarHostWatchedProgressBarSegment');
        const progressPercent = progressBar ? parseFloat(progressBar.style.width) : 0;
        
        const timeBadge = lockup.querySelector('div.ytBadgeShapeText');
        const duration = timeBadge ? timeBadge.textContent?.trim() : null;
        
        if (videoId && duration) {
            const durationSeconds = timeToSeconds(duration);
            const watchedSeconds = Math.round((progressPercent / 100) * durationSeconds);
            
            videos.push({
                id: videoId,
                url: link.href,
                duration: duration,
                durationSeconds: durationSeconds,
                progressPercent: progressPercent,
                trackedSeconds: watchedSeconds
            });
            
            lockup.setAttribute('data-scraped', 'true');
        }
    });
    
    return videos;
}

function timeToSeconds(timeStr) {
    const parts = timeStr.split(':').reverse();
    let seconds = 0;
    seconds += parseInt(parts[0]) || 0;
    seconds += (parseInt(parts[1]) || 0) * 60;
    seconds += (parseInt(parts[2]) || 0) * 3600;
    return seconds;
}

function secondsToTime(secs) {
    const d = Math.floor(secs / 86400);
    const h = Math.floor((secs % 86400) / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${d}d ${h}h ${m}m ${s}s`;
}

async function collectAllWatchHistory() {
    console.log("\n🚀 collectAllWatchHistory() started!");
    
    const seenIds = new Set();
    let allVideos = [];
    let noNewStrikes = 0;
    let scrollPass = 0;
    const batchCounts = [];

    while (noNewStrikes < 5 && !globalStopFlag) {
        scrollPass++;
        
        const videosBefore = scrapeWatchHistory();
        let newVideosThisPass = 0;
        
        videosBefore.forEach(v => {
            if (!seenIds.has(v.id)) {
                seenIds.add(v.id);
                allVideos.push(v);
                newVideosThisPass++;
            }
        });
        
        console.log(`📜 Pass ${scrollPass}: Scraped ${newVideosThisPass} new, Total: ${seenIds.size}`);
        batchCounts.push(newVideosThisPass);
        
        if (batchCounts.length > 4) {
            const oldestBatchCount = batchCounts.shift();
            const scrapedLockups = document.querySelectorAll('yt-lockup-view-model[data-scraped]');
            
            let deleted = 0;
            for (let i = 0; i < scrapedLockups.length && deleted < oldestBatchCount; i++) {
                scrapedLockups[i].remove();
                deleted++;
            }
            console.log(`🧹 Deleted ${deleted} old elements from batch 1, DOM now has ${document.querySelectorAll('yt-lockup-view-model').length} lockups`);
        }
        
        window.scrollTo(0, document.documentElement.scrollHeight);
        await new Promise(r => setTimeout(r, 2000));

        if (newVideosThisPass === 0) {
            noNewStrikes++;
            console.log(`⚠️  Strike ${noNewStrikes}/5`);
        } else {
            noNewStrikes = 0;
        }
    }

    console.log(`\n🎉 Done! ${allVideos.length} videos`);
    const totalSeconds = allVideos.reduce((sum, v) => sum + v.trackedSeconds, 0);
    console.log(`📊 Total tracked time: ${secondsToTime(totalSeconds)}`);
    
    collectedData = allVideos;
    let now = new Date().toDateString();
    let data = {"scrapedData": {
            [now]: {
                videos: allVideos,
                totalSeconds: totalSeconds,
                videoCount: allVideos.length
            }
        }
    }
    chrome.storage.local.set(data, (response) => {
        console.log("✅ Data sent to popup");
    });
    
    return allVideos;
}

collectAllWatchHistory();