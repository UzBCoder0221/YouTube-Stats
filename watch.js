let cleanup = null; 
let lastVideoId = null;

function getStorageKey() {
    const miniplayer = document.querySelector('ytd-miniplayer');
    const isVisible = miniplayer && window.getComputedStyle(miniplayer).display !== 'none';
    

    if (isVisible) {
        const miniplayerVideo = miniplayer?.querySelector('video');
        if (miniplayerVideo && is_active_player(miniplayerVideo)) {
            return "miniplayer";
        }
    }


    const shortsMatch = location.pathname.match(/\/shorts\/([a-zA-Z0-9_-]+)/);
    if (shortsMatch) {
        return shortsMatch[1];
    }

    const videoId = new URLSearchParams(window.location.search).get("v");
    return videoId;
}

function init() {
    const key = getStorageKey();
    
    if (!key || key === lastVideoId) {
        return;
    }
    lastVideoId = key;

    if (cleanup) cleanup();

    let accumulatedTime = 0;
    let playStartTime = null;
    let intervalId = null;
    let video = null;
    let storageReady = false;

    chrome.storage.local.get(key, (res) => {
        accumulatedTime = res[key] ?? 0;
        storageReady = true;
        console.log(`✅ [${key}] Loaded: ${Math.round(accumulatedTime)}s`);
    });

    function flush() {
        if (!storageReady) return;
        
        if (playStartTime) {
            accumulatedTime += (Date.now() - playStartTime) / 1000;
            playStartTime = Date.now();
        }
        try {
            chrome.storage.local.set({ [key]: accumulatedTime }, () => {
                if (chrome.runtime.lastError) return;
                console.log(`💾 [${key}] Saved: ${Math.round(accumulatedTime)}s`);
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

    waitForElement("video").then(v => {
        video = v;
        if (!video.paused) playStartTime = Date.now();
        video.addEventListener('play', onPlay);
        video.addEventListener('pause', onPause);
        intervalId = setInterval(flush, 5000);
        console.log(`⏰ [${key}] Tracking started`);
    }).catch(() => {
        console.log(`❌ [${key}] No video found`);
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

function isInViewport(el) {
    const rect = el.getBoundingClientRect();
    return rect.top < window.innerHeight && rect.bottom > 0;
}

function waitForElement(selector, timeout = 7000) {
    return new Promise((resolve, reject) => {
        const els = document.querySelectorAll(selector);
        
        let el = null;
        els.forEach((i) => {
            if (is_active_player(i) && isInViewport(i)) {
                el = i;
            }
        });
    
        if (!el) {
            els.forEach((i) => {
                if (!el && isInViewport(i)) {
                    el = i;
                }
            });
        }
        
        if (el) return resolve(el);
        
        const observer = new MutationObserver(() => {
            const els = document.querySelectorAll(selector);
            let el = null;
            els.forEach((i) => {
                if (is_active_player(i) && isInViewport(i)) {
                    el = i;
                }
            });
            
            if (!el) {
                els.forEach((i) => {
                    if (!el && isInViewport(i)) {
                        el = i;
                    }
                });
            }
            
            if (el) { 
                observer.disconnect(); 
                resolve(el); 
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => { 
            observer.disconnect(); 
            reject("Timeout"); 
        }, timeout);
    });
}