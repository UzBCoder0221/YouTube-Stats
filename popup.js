// Theme
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
const body = document.body;

function setTheme(theme) {
  body.className = theme;
  localStorage.setItem('yt-stats-theme', theme);
  themeIcon.innerHTML = theme === 'dark'
    ? '<path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0a.996.996 0 0 0 0-1.41l-1.06-1.06zm1.06-10.96a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/>'
    : '<path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/>';
}

const savedTheme = localStorage.getItem('yt-stats-theme') || 'light';
setTheme(savedTheme);

themeToggle.addEventListener('click', () => {
  setTheme(body.className === 'dark' ? 'light' : 'dark');
});

// YouTube link
document.getElementById('ytLink').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: 'https://www.youtube.com' });
});

// Video list modal
const videoModal = document.getElementById('videoModal');
const videoListBtn = document.getElementById('videoListBtn');
const closeModal = document.getElementById('closeModal');
const videoList = document.getElementById('videoList');
const emptyState = document.getElementById('emptyState');

videoListBtn.addEventListener('click', () => {
  videoModal.classList.add('active');
  renderVideoList();
});

closeModal.addEventListener('click', () => {
  videoModal.classList.remove('active');
});

videoModal.addEventListener('click', (e) => {
  if (e.target === videoModal) videoModal.classList.remove('active');
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') videoModal.classList.remove('active');
});

function renderVideoList() {
  YTStorage.getAll((data) => {
    const videos = Object.entries(data)
      .filter(([key, val]) => typeof val === 'number' && key !== 'scraped_history')
      .sort((a, b) => b[1] - a[1]);

    if (videos.length === 0) {
      videoList.innerHTML = '';
      videoList.appendChild(emptyState);
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';
    videoList.innerHTML = '';

    const maxSeconds = videos[0][1] || 1;

    videos.forEach(([id, seconds], i) => {
      const item = document.createElement('div');
      item.className = 'video-item';

      const hrs = (seconds / 3600).toFixed(1);
      const progress = Math.min((seconds / maxSeconds) * 100, 100);

      item.innerHTML = `
        <span class="video-index">${i + 1}</span>
        <div class="video-info">
          <div class="video-id">${id}</div>
          <div class="video-meta">
            <span class="video-tracked">${hrs}h</span>
            <div class="video-progress">
              <div class="video-progress-bar" style="width: ${progress}%"></div>
            </div>
          </div>
        </div>
      `;
      item.addEventListener('click', () => {
        chrome.tabs.create({ url: `https://www.youtube.com/watch?v=${id}` });
      });
      videoList.appendChild(item);
    });
  });
}

// Data display
YTStorage.getAll((data) => {
  let totalSeconds = 0;
  let videoCount = 0;

  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'number') {
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
    YTStorage.clear(() => window.location.reload());
  }
});

// Listen for scraped history data
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "scrapedHistoryReady") {
    const { videos, totalSeconds, videoCount } = request.data;
    
    document.getElementById("scrapedSection").classList.remove("hidden");
    document.getElementById("scrapedTotal").textContent = (totalSeconds / 3600).toFixed(1) + " hrs";
    document.getElementById("scrapedDesc").textContent = `${videoCount} videos found`;
    
    window.scrapedData = { videos, totalSeconds, videoCount };
    updateAdjustedTotal(80);
    
    sendResponse({ status: "received" });
  }
});

// Confidence slider
document.getElementById("confidenceSlider").addEventListener("input", (e) => {
  const confidence = parseInt(e.target.value);
  document.getElementById("confidenceValue").textContent = confidence;
  updateAdjustedTotal(confidence);
});

function updateAdjustedTotal(confidence) {
  if (window.scrapedData) {
    const adjusted = Math.round(window.scrapedData.totalSeconds * (confidence / 100));
    document.getElementById("adjustedTotal").textContent = (adjusted / 3600).toFixed(1) + " hrs";
  }
}

// Approve
document.getElementById("approveBtn").addEventListener("click", () => {
  if (!window.scrapedData) return;
  
  const confidence = parseInt(document.getElementById("confidenceSlider").value);
  const adjustedSeconds = Math.round(window.scrapedData.totalSeconds * (confidence / 100));
  
  YTStorage.set({ "scraped_history": adjustedSeconds }, () => {
    document.getElementById("scrapedSection").classList.add("hidden");
    window.scrapedData = null;
    setTimeout(() => window.location.reload(), 500);
  });
});

// Discard
document.getElementById("rejectBtn").addEventListener("click", () => {
  if (confirm("Discard scraped history data?")) {
    document.getElementById("scrapedSection").classList.add("hidden");
    window.scrapedData = null;
  }
});
