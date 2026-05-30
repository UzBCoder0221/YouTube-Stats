let cleanup = null; 
let lastVideoId = null;
function init() {
    console.log("YouTube stats initialized.");
    const videoId = new URLSearchParams(window.location.search).get("v");
    if (!videoId || videoId === lastVideoId) return;
    lastVideoId = videoId;

    // Clean up previous video's listeners before starting new one
    if (cleanup) cleanup();

    let accumulatedTime = 0;
    let playStartTime = null;
    let intervalId = null;
    let video = null;

    chrome.storage.local.get(videoId, (res) => {
        accumulatedTime = res[videoId] ?? 0;
    });

    function flush() {
        if (playStartTime) {
            accumulatedTime += (Date.now() - playStartTime) / 1000;
            playStartTime = Date.now();
        }
        chrome.storage.local.set({ [videoId]: accumulatedTime }, () => {
            console.log(`[${videoId}] Watch time saved: ${Math.round(accumulatedTime)}s`);
        });
    }

    function onPlay() { playStartTime = Date.now(); }
    function onPause() {
        if (playStartTime) {
            accumulatedTime += (Date.now() - playStartTime) / 1000;
            playStartTime = null;
        }
    }

    waitForElement("video.video-stream.html5-main-video").then(v => {
        video = v;
        if (!video.paused) playStartTime = Date.now();
        video.addEventListener('play', onPlay);
        video.addEventListener('pause', onPause);
        intervalId = setInterval(flush, 5000);
    });

    // Return cleanup function for when next video starts
    cleanup = () => {
        flush(); // save before leaving
        if (video) {
            video.removeEventListener('play', onPlay);
            video.removeEventListener('pause', onPause);
        }
        clearInterval(intervalId);
    };
}

// Watch for YouTube SPA navigation
let lastUrl = location.href;
new MutationObserver(() => {
    if (location.href !== lastUrl) {
        lastUrl = location.href;
        init(); // reinitialize for new video
    }
    a=document.querySelectorAll("#items").children;
    a.forEach((i)=>{if (i.selected) i.children[0].href}); // playlist items
    // id="microformat"
}).observe(document.body, { childList: true, attributes: true, characterData: true, subtree: true });

setInterval(() => {
    if (location.href !== lastUrl) {
        lastUrl = location.href;
        init();
        return;
    }

    // Mini player / playlist next button — has the upcoming video's href
    const nextBtn = document.querySelector(".ytp-next-button.ytp-button.ytp-playlist-ui");
    if (nextBtn && nextBtn.href) {
        const nextVideoId = new URL(nextBtn.href).searchParams.get("v");
        if (nextVideoId && nextVideoId !== lastVideoId) {
            lastVideoId = nextVideoId;
            init(nextVideoId);
        }
    }
}, 1000);

window.addEventListener('beforeunload', () => {
    if (cleanup) cleanup();
});

// Run on initial load
init();

function waitForElement(selector, timeout = 7000) {
    return new Promise((resolve, reject) => {
        const el = document.querySelector(selector);
        if (el) return resolve(el);
        const observer = new MutationObserver(() => {
            const el = document.querySelector(selector);
            if (el) { observer.disconnect(); resolve(el); }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => { observer.disconnect(); reject("Timeout"); }, timeout);
    });
}













// Find the element currently in focus, or default to the body
const targetElement = document.activeElement || document.body;

// Create the keyboard event sequence
const keydownEvent = new KeyboardEvent('keydown', {
    key: 'i',
    code: 'KeyI',
    keyCode: 73,
    which: 73,
    bubbles: true,
    cancelable: true
});

const keyupEvent = new KeyboardEvent('keyup', {
    key: 'i',
    code: 'KeyI',
    keyCode: 73,
    which: 73,
    bubbles: true,
    cancelable: true
});

// Dispatch the events to simulate the press and release
targetElement.dispatchEvent(keydownEvent);
targetElement.dispatchEvent(keyupEvent);
