const PLAY =
  '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M5.2 3.4v9.2L13 8z"/></svg>';
const SOUND =
  '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M3 6.5h2.2L8.5 4v8L5.2 9.5H3z"/><path d="M11 6.2a3 3 0 0 1 0 3.6M12.6 4.6a5 5 0 0 1 0 6.8"/></svg>';
const MUTED =
  '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M3 6.5h2.2L8.5 4v8L5.2 9.5H3z"/><path d="m11 6.5 3 3M14 6.5l-3 3"/></svg>';

function clock(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function button(className: string, label: string, html: string) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = className;
  el.setAttribute("aria-label", label);
  el.innerHTML = html;
  return el;
}

function mount(video: HTMLVideoElement) {
  const frame = document.createElement("div");
  frame.className = "player";
  frame.contentEditable = "false";
  if (video.hasAttribute("data-lead")) frame.setAttribute("data-lead", "");
  video.removeAttribute("controls");
  video.setAttribute("playsinline", "");
  video.preload = "metadata";
  video.parentNode?.insertBefore(frame, video);
  frame.appendChild(video);

  const play = button("player-play", "Play", PLAY);
  const bar = document.createElement("div");
  bar.className = "player-bar";
  const track = button("player-track", "Seek", "");
  const fill = document.createElement("span");
  fill.className = "player-fill";
  track.appendChild(fill);
  const time = document.createElement("span");
  time.className = "player-time";
  time.textContent = "0:00";
  const mute = button("player-mute", "Mute", SOUND);
  bar.append(track, time, mute);
  frame.append(play, bar);

  const paint = () => {
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const ratio = duration ? video.currentTime / duration : 0;
    fill.style.width = `${Math.min(1, Math.max(0, ratio)) * 100}%`;
    time.textContent = duration ? `${clock(video.currentTime)} / ${clock(duration)}` : "0:00";
    play.hidden = !video.paused;
    mute.setAttribute("aria-label", video.muted ? "Unmute" : "Mute");
    mute.innerHTML = video.muted ? MUTED : SOUND;
  };

  const toggle = () => {
    if (video.paused) void video.play();
    else video.pause();
  };

  const stop = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  video.addEventListener("click", (event) => {
    stop(event);
    toggle();
  });
  play.addEventListener("click", (event) => {
    stop(event);
    toggle();
  });
  track.addEventListener("click", (event) => {
    stop(event);
    const rect = track.getBoundingClientRect();
    if (!video.duration || rect.width === 0) return;
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    video.currentTime = ratio * video.duration;
    paint();
  });
  mute.addEventListener("click", (event) => {
    stop(event);
    video.muted = !video.muted;
    paint();
  });
  video.addEventListener("timeupdate", paint);
  video.addEventListener("loadedmetadata", paint);
  video.addEventListener("play", paint);
  video.addEventListener("pause", paint);
  paint();
}

export function enhanceVideos(root: HTMLElement) {
  for (const video of root.querySelectorAll("video")) {
    if (!(video instanceof HTMLVideoElement)) continue;
    const frame = video.closest(".player");
    if (frame instanceof HTMLElement) {
      if (video.hasAttribute("data-lead")) frame.setAttribute("data-lead", "");
      else frame.removeAttribute("data-lead");
      continue;
    }
    mount(video);
  }
}

export function plainVideoHtml(root: HTMLElement) {
  const clone = root.cloneNode(true) as HTMLElement;
  for (const frame of clone.querySelectorAll(".player")) {
    const video = frame.querySelector("video");
    if (video) frame.replaceWith(video);
    else frame.remove();
  }
  return clone.innerHTML;
}
