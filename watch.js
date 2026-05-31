let cleanup = null; 
let lastVideoId = null;

function getStorageKey() {
    const miniplayer = document.querySelector('ytd-miniplayer');
    const isActive = miniplayer && miniplayer.hasAttribute('active');
    const isVisible = miniplayer && window.getComputedStyle(miniplayer).display !== 'none';
    
    console.log("🔍 getStorageKey check - miniplayer visible:", isVisible, "active:", isActive);
    
    const shortsMatch = location.pathname.match(/\/shorts\/([a-zA-Z0-9_-]+)/);
    if (shortsMatch) {
        console.log("📺 Shorts detected:", shortsMatch[1]);
        return shortsMatch[1];
    }

    if (isVisible || isActive) {
        const miniplayerVideo = miniplayer?.querySelector('video');
        console.log("🎬 Mini player video found:", !!miniplayerVideo, "is_active:", miniplayerVideo ? is_active_player(miniplayerVideo) : false);
        if (miniplayerVideo && is_active_player(miniplayerVideo)) {
            console.log("✅ Using miniplayer as storage key");
            return "miniplayer";
        }
    }

    const videoId = new URLSearchParams(window.location.search).get("v");
    console.log("🎥 Using watch video ID:", videoId);
    return videoId;
}

function init() {
    console.log("YouTube stats initialized.");
    const key = getStorageKey();
    console.log("📝 Init with key:", key, "last was:", lastVideoId);
    
    if (!key || key === lastVideoId) {
        console.log("⏭️  Skipping init - same key or no key");
        return;
    }
    lastVideoId = key;

    if (cleanup) {
        console.log("🧹 Running cleanup for previous video");
        cleanup();
    }

    let accumulatedTime = 0;
    let playStartTime = null;
    let intervalId = null;
    let video = null;
    let storageReady = false;

    // Load saved time first, THEN set up listeners
    chrome.storage.local.get(key, (res) => {
        accumulatedTime = res[key] ?? 0;
        storageReady = true;
        console.log(`💾 [${key}] Loaded: ${Math.round(accumulatedTime)}s`);
    });

    function flush() {
        if (!storageReady) {
            console.log(`⏳ [${key}] Storage not ready yet, skipping flush`);
            return;
        }
        
        if (playStartTime) {
            accumulatedTime += (Date.now() - playStartTime) / 1000;
            playStartTime = Date.now();
        }
        try {
            chrome.storage.local.set({ [key]: accumulatedTime }, () => {
                if (chrome.runtime.lastError) {
                    console.log(`❌ [${key}] Storage error:`, chrome.runtime.lastError);
                    return;
                }
                console.log(`💾 [${key}] Watch time saved: ${Math.round(accumulatedTime)}s`);
            });
        } catch (e) {
            console.log(`❌ [${key}] Exception during flush:`, e);
            clearInterval(intervalId);
        }
    }

    function onPlay() { 
        console.log(`▶️  [${key}] Play event`);
        playStartTime = Date.now(); 
    }
    
    function onPause() {
        console.log(`⏸️  [${key}] Pause event`);
        if (playStartTime) {
            accumulatedTime += (Date.now() - playStartTime) / 1000;
            playStartTime = null;
        }
    }

    console.log(`🎬 Waiting for video element for [${key}]...`);
    waitForElement("video").then(v => {
        console.log(`✅ [${key}] Video element found`, v);
        video = v;
        if (!video.paused) {
            console.log(`▶️  [${key}] Video already playing on init`);
            playStartTime = Date.now();
        }
        video.addEventListener('play', onPlay);
        video.addEventListener('pause', onPause);
        intervalId = setInterval(flush, 5000);
        console.log(`⏰ [${key}] Flush interval started (ID: ${intervalId})`);
    }).catch(() => {
        console.log(`❌ [${key}] Video element not found after timeout`);
    });

    cleanup = () => {
        console.log(`🧹 Cleanup for [${key}]`);
        flush();
        if (video) {
            video.removeEventListener('play', onPlay);
            video.removeEventListener('pause', onPause);
            console.log(`📌 [${key}] Listeners removed`);
        }
        clearInterval(intervalId);
    };
}

let lastUrl = location.href;
new MutationObserver(() => {
    if (location.href !== lastUrl) {
        console.log("🔗 URL changed from", lastUrl, "to", location.href);
        lastUrl = location.href;
        init();
    }

    const currentKey = getStorageKey();
    if (currentKey && currentKey !== lastVideoId) {
        console.log("🔄 Storage key changed in MutationObserver:", currentKey);
        init();
    }
}).observe(document.body, { childList: true, subtree: true });

setInterval(() => {
    if (location.href !== lastUrl) {
        console.log("🔗 URL changed (interval) from", lastUrl, "to", location.href);
        lastUrl = location.href;
        init();
        return;
    }

    // Check if mini player status changed
    const currentKey = getStorageKey();
    if (currentKey && currentKey !== lastVideoId) {
        console.log("🔄 Storage key changed (interval):", currentKey);
        init();
    }
}, 1000);

window.addEventListener('beforeunload', () => {
    console.log("👋 Page unloading, final cleanup");
    if (cleanup) cleanup();
});

init();

function is_active_player(video_player) {
    const active = !!(video_player.currentTime > 0 && !video_player.paused 
        && !video_player.ended && video_player.readyState > 2);
    console.log("📊 is_active_player check - currentTime:", video_player.currentTime, "paused:", video_player.paused, "ended:", video_player.ended, "readyState:", video_player.readyState, "result:", active);
    return active;
}

function waitForElement(selector, timeout = 7000) {
    return new Promise((resolve, reject) => {
        console.log(`🔎 waitForElement searching for "${selector}"`);
        const els = document.querySelectorAll(selector);
        console.log(`🔎 Found ${els.length} video elements`);
        
        let el = els[0];
        els.forEach((i, idx) => {
            const active = is_active_player(i);
            console.log(`  Video ${idx}: active=${active}`);
            if (active) el = i;
        });
        
        if (el) {
            console.log(`✅ Using video element (active or first)`);
            return resolve(el);
        }
        
        console.log(`⏳ No video found, waiting...`);
        const observer = new MutationObserver(() => {
            const els = document.querySelectorAll(selector);
            let el = els[0];
            els.forEach((i) => {is_active_player(i) && (el=i)});
            if (el) { 
                console.log(`✅ Video found in MutationObserver`);
                observer.disconnect(); 
                resolve(el); 
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => { 
            console.log(`⏱️  Timeout waiting for video`);
            observer.disconnect(); 
            reject("Timeout"); 
        }, timeout);
    });
}

















/*let cleanup = null; 
let lastVideoId = null;

function getStorageKey() {
    const miniplayer = document.querySelector('ytd-miniplayer');
    const isActive = miniplayer && miniplayer.hasAttribute('active');
    const isVisible = miniplayer && window.getComputedStyle(miniplayer).display !== 'none';
    
    const shortsMatch = location.pathname.match(/\/shorts\/([a-zA-Z0-9_-]+)/);
    if (shortsMatch) {
        return shortsMatch[1];
    }

    if (isVisible || isActive) {
        const miniplayerVideo = miniplayer?.querySelector('video');
        if (miniplayerVideo && is_active_player(miniplayerVideo)) {
            return "miniplayer";
        }
    }

    
    const videoId = new URLSearchParams(window.location.search).get("v");
    return videoId;
}

function init() {
    console.log("YouTube stats initialized.");
    const key = getStorageKey();
    if (!key || key === lastVideoId) return;
    lastVideoId = key;

    if (cleanup) cleanup();

    let accumulatedTime = 0;
    let playStartTime = null;
    let intervalId = null;
    let video = null;
    let storageReady = false;

    // Load saved time first, THEN set up listeners
    chrome.storage.local.get(key, (res) => {
        accumulatedTime = res[key] ?? 0;
        storageReady = true;
        console.log(`[${key}] Loaded: ${Math.round(accumulatedTime)}s`);
    });

    function flush() {
        if (!storageReady) return; // don't flush until storage is loaded
        
        if (playStartTime) {
            accumulatedTime += (Date.now() - playStartTime) / 1000;
            playStartTime = Date.now();
        }
        try {
            chrome.storage.local.set({ [key]: accumulatedTime }, () => {
                if (chrome.runtime.lastError) return;
                console.log(`[${key}] Watch time saved: ${Math.round(accumulatedTime)}s`);
            });
        } catch (e) {
            clearInterval(intervalId);
        }
    }

    function onPlay() { playStartTime = Date.now(); }
    function onPause() {
        if (playStartTime) {
            accumulatedTime += (Date.now() - playStartTime) / 1000;
            playStartTime = null;
        }
    }

    waitForElement("video").then(v => { // video.video-stream.html5-main-video
        video = v;
        if (!video.paused) playStartTime = Date.now();
        video.addEventListener('play', onPlay);
        video.addEventListener('pause', onPause);
        intervalId = setInterval(flush, 5000);
    }).catch(() => {
        console.log("Video not found");
    });

    cleanup = () => {
        flush();
        if (video) {
            video.removeEventListener('play', onPlay);
            video.removeEventListener('pause', onPause);
        }
        clearInterval(intervalId);
    };
}

let lastUrl = location.href;
new MutationObserver(() => {
    if (location.href !== lastUrl) {
        lastUrl = location.href;
        init();
    }

    const currentKey = getStorageKey();
    if (currentKey && currentKey !== lastVideoId) {
        init();
    }
}).observe(document.body, { childList: true, subtree: true });

setInterval(() => {
    if (location.href !== lastUrl) {
        lastUrl = location.href;
        init();
        return;
    }

    // Check if mini player status changed
    const currentKey = getStorageKey();
    if (currentKey && currentKey !== lastVideoId) {
        init();
    }
}, 1000);

window.addEventListener('beforeunload', () => {
    if (cleanup) cleanup();
});

init();

function is_active_player(video_player) {
    return !!(video_player.currentTime > 0 && !video_player.paused 
        && !video_player.ended && video_player.readyState > 2);
}

function waitForElement(selector, timeout = 7000) {
    return new Promise((resolve, reject) => {
        const els = document.querySelectorAll(selector);
        let el = els[0];
        els.forEach((i) => {is_active_player(i) && (el=i)})
        if (el) return resolve(el);
        const observer = new MutationObserver(() => {
            const els = document.querySelectorAll(selector);
            let el = els[0];
            els.forEach((i) => {is_active_player(i) && (el=i)})
            if (el) { observer.disconnect(); resolve(el); }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => { observer.disconnect(); reject("Timeout"); }, timeout);
    });
}*/