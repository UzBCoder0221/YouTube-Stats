var interval_id;
var timer = 0;

video = document.querySelector("video.video-stream.html5-main-video");

// const isPlaying = !!(video.currentTime > 0 && !video.paused && !video.ended && video.readyState > 2); 
video.addEventListener('play', () => {
    interval_id = setInterval(() => timer++, 1000);
});

video.addEventListener('pause', () => clearInterval(interval_id));