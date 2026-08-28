let globalStopFlag = false;
let collectedData = null;

function scrapeWatchHistory() {
    const videos = [];
    
    // const lockups = document.querySelectorAll('yt-lockup-view-model:not([data-scraped])');
    const lockups = document.querySelectorAll('yt-lockup-view-model');
    
    console.log(`📦 Found ${lockups.length} NEW lockups to scrape`);
    var all = lockups.length, deleted = 0;
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
                duration: duration,
                durationSeconds: durationSeconds,
                progressPercent: progressPercent,
                trackedSeconds: watchedSeconds
            });
            lockup.remove();
            deleted++;
        }
    });
    const reels = document.querySelectorAll("ytd-reel-shelf-renderer");
    reels.forEach((e) => { e.remove() });
    const dates = document.querySelectorAll("ytd-item-section-header-renderer");
    dates.forEach((e) => { e.remove() });
    const big_reels = document.querySelectorAll("ytd-video-renderer");
    big_reels.forEach((e) => { e.remove() });
    while (!!reels || !!dates || !!big_reels) {
        if (reels.length > 0) reels[0]?.remove();
        if (dates.length > 0) dates[0]?.remove();
        if (big_reels.length > 0) big_reels[0]?.remove();
    }
    console.log("All was: ", all, "; Deleted: ", (deleted) && (deleted + 1));
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

    while (noNewStrikes < 10 && !globalStopFlag) {
        scrollPass++;
        
        const videosBefore = scrapeWatchHistory();
        let newVideosThisPass = 0;
        
        // sum time
        videosBefore.forEach(v => {
            if (!seenIds.has(v.id)) {
                seenIds.add(v.id);
                allVideos.push(v);
                newVideosThisPass++;
            }
        });
        
        console.log(`📜 Pass ${scrollPass}: Scraped ${newVideosThisPass} new, Total: ${seenIds.size}`);
        
        window.scrollTo(0, document.documentElement.scrollHeight);
        await new Promise(r => setTimeout(r, 3000 + noNewStrikes * 1000));

        if (newVideosThisPass === 0) {
            noNewStrikes++;
            console.log(`⚠️  Strike ${noNewStrikes}/10`);
        } else {
            noNewStrikes = 0;
        }
    }

    console.log(`\n🎉 Done! ${allVideos.length} videos`);
    const totalSeconds = allVideos.reduce((sum, v) => sum + v.trackedSeconds, 0);
    console.log(`📊 Total tracked time: ${secondsToTime(totalSeconds)}`);
    
    // read then update
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
    YTStorage.set(data, () => {
        console.log("✅ Data sent to popup");
    });
    return;
}

collectAllWatchHistory();