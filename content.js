(async () => {
    const video = await waitForElement("video.video-stream.html5-main-video");

    let accumulatedTime = await new Promise(resolve => {
        chrome.storage.local.get("watchTime", (res) => {
            resolve(res.watchTime ?? 0);
        });
    });

    let playStartTime = null;

    video.addEventListener('play', () => {
        playStartTime = Date.now();
    });

    video.addEventListener('pause', () => {
        if (playStartTime) {
            accumulatedTime += (Date.now() - playStartTime) / 1000;
            playStartTime = null;
        }
    });

    window.addEventListener('beforeunload', () => {
        if (playStartTime) {
            accumulatedTime += (Date.now() - playStartTime) / 1000;
        }
        chrome.storage.local.set({ watchTime: accumulatedTime });
    });

      
    setInterval(() => {
        const total = playStartTime
            ? accumulatedTime + (Date.now() - playStartTime) / 1000
            : accumulatedTime;

        chrome.storage.local.set({ watchTime: total }, () => {
            console.log(`Watch time saved: ${Math.round(total)}s`);
        });
    }, 5000);

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
})();