chrome.storage.local.get(null, (data) => {
    let totalSeconds = 0;
    let videoCount = 0;
    let totalSecondsScraped = 0;

    for (const [key, value] of Object.entries(data)) {
        if (typeof value === "number") {
            totalSeconds += value;
            videoCount++;
        }
        if (key === "scrapedData" && value) {
            const entries = Object.entries(value);

            if (entries.length > 0) {
                const [dateKey, latest] = entries[0];

                totalSecondsScraped = latest.totalSeconds || 0;
                scrapedVideoCount = latest.videoCount || 0;
                scrapedVideos = latest.videos || [];

                delete value[dateKey];

                chrome.storage.local.set({
                    scrapedData: value
                });
            }


        }

        if (key === "scraped_history" && typeof value === "number") {
            totalSeconds += value;
        }
    }

    const days    = Math.floor(totalSeconds / 86400);
    const hours   = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    document.getElementById("days").textContent    = days;
    document.getElementById("hours").textContent   = hours;
    document.getElementById("minutes").textContent = minutes;
    document.getElementById("seconds").textContent = seconds;
    document.getElementById("totalHours").textContent = (totalSeconds / 3600).toFixed(1) + " hrs";
    document.getElementById("videoCount").textContent = `Videos tracked: ${videoCount}`;

    // SCRAPED
    if (totalSecondsScraped > 0) {
        document.getElementById("scrapedSection")
            .classList.remove("hidden");

        document.getElementById("scrapedTotal").textContent =
            (totalSecondsScraped / 3600).toFixed(1) + " hrs";

        document.getElementById("scrapedDesc").textContent =
            `${scrapedVideoCount} videos found`;

        window.scrapedData = {
            videos: scrapedVideos,
            totalSeconds: totalSecondsScraped,
            videoCount: scrapedVideoCount
        };
        updateAdjustedTotal(80);
        
    }

});

document.getElementById("resetBtn").addEventListener("click", () => {
    if (confirm("Reset all watch time data?")) {
        chrome.storage.local.clear(() => window.location.reload());
    }
});


document.getElementById("confidenceSlider").addEventListener("input", (e) => {
    const confidence = parseInt(e.target.value);
    document.getElementById("confidenceValue").textContent = confidence;
    updateAdjustedTotal(confidence);
});

function updateAdjustedTotal(confidence) {
    if (window.scrapedData) {
        const adjusted = Math.round(window.scrapedData.totalSeconds * (confidence / 100));
        const hours = (adjusted / 3600).toFixed(1);
        document.getElementById("adjustedTotal").textContent = hours + " hrs";
    }
}

document.getElementById("approveBtn").addEventListener("click", () => {
    if (!window.scrapedData) return;

    const confidence =
        parseInt(document.getElementById("confidenceSlider").value);
    
    chrome.storage.local.get(null, (storage) => {
        const updates = {};

        for (const video of window.scrapedData.videos) {
            const existingTime = storage[video.id] ?? 0;

            updates[video.id] =
                existingTime +
                Math.round(video.trackedSeconds * (confidence / 100));
        }

        chrome.storage.local.set(updates, () => {
            console.log(`✅ Saved ${window.scrapedData.videoCount} videos`);

            document.getElementById("scrapedSection").classList.add("hidden");

            window.scrapedData = null;

            setTimeout(() => window.location.reload(), 500);
        });
    });
});


document.getElementById("rejectBtn").addEventListener("click", () => {
    if (confirm("Discard scraped history data?")) {
        document.getElementById("scrapedSection").classList.add("hidden");
        window.scrapedData = null;
        console.log("❌ Scraped data discarded");
    }
});