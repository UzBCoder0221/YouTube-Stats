chrome.storage.local.get(null, (data) => {
    let totalSeconds = 0;
    let videoCount = 0;

    for (const [key, value] of Object.entries(data)) {
        if (typeof value === "number") {
            totalSeconds += value;
            videoCount++;
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
});

document.getElementById("resetBtn").addEventListener("click", () => {
    if (confirm("Reset all watch time data?")) {
        chrome.storage.local.clear(() => window.location.reload());
    }
});