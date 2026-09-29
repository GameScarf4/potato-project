/**
 * remote.js
 * =========
 * Frontend client logic for Potato Remote Hub
 * Handles touch gestures, media controls, file transfer, and telemetry polling.
 */

// -----------------------------------------------------------------------------
// State & Navigation
// -----------------------------------------------------------------------------
let statsInterval = null;
let lastTouchX = 0;
let lastTouchY = 0;
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;
let isMoving = false;

// Initialize on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initTrackpad();
  initMedia();
  initFiles();
  initKeyboard();
  checkConnection();
});

// Toast notification helper
function showToast(message, duration = 2000) {
  const toast = document.getElementById("app-toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), duration);
}

// Gentle haptic feedback on supported mobile devices
function haptic(ms = 15) {
  if (navigator.vibrate) {
    navigator.vibrate(ms);
  }
}

// -----------------------------------------------------------------------------
// Tab Switching
// -----------------------------------------------------------------------------
function initTabs() {
  const navItems = document.querySelectorAll(".nav-item");
  const tabViews = document.querySelectorAll(".tab-view");

  navItems.forEach((btn) => {
    btn.addEventListener("click", () => {
      haptic(10);
      const targetTab = btn.getAttribute("data-tab");

      navItems.forEach((b) => b.classList.remove("active"));
      tabViews.forEach((v) => v.classList.remove("active"));

      btn.classList.add("active");
      const activeView = document.getElementById(`tab-${targetTab}`);
      if (activeView) activeView.classList.add("active");

      // Auto-start stats polling only when stats tab is visible
      if (targetTab === "stats") {
        fetchSystemStats();
        if (!statsInterval) statsInterval = setInterval(fetchSystemStats, 2000);
      } else {
        if (statsInterval) {
          clearInterval(statsInterval);
          statsInterval = null;
        }
      }

      // Auto-refresh file list when switching to files tab
      if (targetTab === "files") {
        loadSharedFiles();
      }
    });
  });
}

// -----------------------------------------------------------------------------
// Connection Check
// -----------------------------------------------------------------------------
async function checkConnection() {
  try {
    const res = await fetch("/api/system/stats");
    const dot = document.getElementById("status-dot");
    const text = document.getElementById("status-text");
    if (res.ok) {
      dot.classList.remove("offline");
      text.textContent = "Connected";
    } else {
      dot.classList.add("offline");
      text.textContent = "Offline";
    }
  } catch (err) {
    const dot = document.getElementById("status-dot");
    const text = document.getElementById("status-text");
    dot.classList.add("offline");
    text.textContent = "Offline";
  }
}

// -----------------------------------------------------------------------------
// Tab 1: Virtual Trackpad (High Performance Gesture Engine)
// -----------------------------------------------------------------------------
let pendingDx = 0;
let pendingDy = 0;
let isSendingMove = false;

let pendingScroll = 0;
let isSendingScroll = false;

function initTrackpad() {
  const surface = document.getElementById("trackpad-surface");
  if (!surface) return;

  let maxTouches = 0;
  let touchStartTime = 0;
  let lastX = 0;
  let lastY = 0;
  let totalMoved = 0;

  // Visual touch pointer dot
  const touchDot = document.createElement("div");
  touchDot.style.cssText = "position:absolute; width:32px; height:32px; border-radius:50%; background:rgba(0,242,254,0.25); border:2px solid #00f2fe; pointer-events:none; display:none; transform:translate(-50%,-50%); box-shadow:0 0 12px rgba(0,242,254,0.5); z-index:10;";
  surface.appendChild(touchDot);

  surface.addEventListener("touchstart", (e) => {
    e.preventDefault();
    const count = e.touches.length;
    maxTouches = count;
    touchStartTime = Date.now();
    totalMoved = 0;

    if (count === 1) {
      const t = e.touches[0];
      const rect = surface.getBoundingClientRect();
      lastX = t.clientX;
      lastY = t.clientY;

      touchDot.style.left = `${t.clientX - rect.left}px`;
      touchDot.style.top = `${t.clientY - rect.top}px`;
      touchDot.style.display = "block";
    } else if (count === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      lastX = (t1.clientX + t2.clientX) / 2;
      lastY = (t1.clientY + t2.clientY) / 2;
      touchDot.style.display = "none";
    }
  }, { passive: false });

  surface.addEventListener("touchmove", (e) => {
    e.preventDefault();
    const count = e.touches.length;
    maxTouches = Math.max(maxTouches, count);

    if (count === 1) {
      const t = e.touches[0];
      const dx = t.clientX - lastX;
      const dy = t.clientY - lastY;
      lastX = t.clientX;
      lastY = t.clientY;

      const rect = surface.getBoundingClientRect();
      touchDot.style.left = `${t.clientX - rect.left}px`;
      touchDot.style.top = `${t.clientY - rect.top}px`;

      const dist = Math.hypot(dx, dy);
      totalMoved += dist;

      if (dist > 0.3) {
        queueMouseMove(dx, dy);
      }
    } else if (count === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const currentY = (t1.clientY + t2.clientY) / 2;
      const dy = currentY - lastY;
      lastY = currentY;

      totalMoved += Math.abs(dy);
      if (Math.abs(dy) > 1.5) {
        queueMouseScroll(dy > 0 ? -90 : 90);
      }
    }
  }, { passive: false });

  surface.addEventListener("touchend", (e) => {
    touchDot.style.display = "none";
    const duration = Date.now() - touchStartTime;

    // When all fingers leave the surface
    if (e.touches.length === 0) {
      // Tap detection (brief touch with minimal movement)
      if (duration < 350 && totalMoved < 18) {
        if (maxTouches === 1) {
          // 1 Finger Tap -> Left Click
          haptic(20);
          showToast("🖱️ Left Click", 800);
          sendMouseClick("left");
        } else if (maxTouches >= 2) {
          // 2 Fingers Tap -> Right Click
          haptic(45);
          showToast("🖱️ Right Click", 800);
          sendMouseClick("right");
        }
      }
      maxTouches = 0;
      totalMoved = 0;
    }
  });

  surface.addEventListener("touchcancel", () => {
    touchDot.style.display = "none";
    maxTouches = 0;
    totalMoved = 0;
  });

  // Dedicated mouse buttons
  document.getElementById("btn-left-click")?.addEventListener("click", () => {
    haptic(20);
    showToast("🖱️ Left Click", 600);
    sendMouseClick("left");
  });

  document.getElementById("btn-right-click")?.addEventListener("click", () => {
    haptic(35);
    showToast("🖱️ Right Click", 600);
    sendMouseClick("right");
  });

  document.getElementById("btn-scroll-up")?.addEventListener("click", () => {
    haptic(10);
    queueMouseScroll(140);
  });

  document.getElementById("btn-scroll-down")?.addEventListener("click", () => {
    haptic(10);
    queueMouseScroll(-140);
  });
}

function queueMouseMove(dx, dy) {
  // Velocity-sensitive acceleration
  const speed = Math.hypot(dx, dy);
  const factor = speed > 14 ? 2.5 : (speed > 5 ? 1.8 : 1.3);
  pendingDx += dx * factor;
  pendingDy += dy * factor;

  if (!isSendingMove) {
    sendBufferedMove();
  }
}

function sendBufferedMove() {
  if (Math.abs(pendingDx) < 0.2 && Math.abs(pendingDy) < 0.2) {
    isSendingMove = false;
    return;
  }
  isSendingMove = true;
  const dx = pendingDx;
  const dy = pendingDy;
  pendingDx = 0;
  pendingDy = 0;

  fetch("/api/mouse/move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dx, dy }),
  })
    .catch(() => {})
    .finally(() => {
      if (Math.abs(pendingDx) >= 0.2 || Math.abs(pendingDy) >= 0.2) {
        requestAnimationFrame(sendBufferedMove);
      } else {
        isSendingMove = false;
      }
    });
}

function queueMouseScroll(amount) {
  pendingScroll += amount;
  if (!isSendingScroll) {
    sendBufferedScroll();
  }
}

function sendBufferedScroll() {
  if (pendingScroll === 0) {
    isSendingScroll = false;
    return;
  }
  isSendingScroll = true;
  const amount = pendingScroll;
  pendingScroll = 0;

  fetch("/api/mouse/scroll", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount }),
  })
    .catch(() => {})
    .finally(() => {
      if (pendingScroll !== 0) {
        setTimeout(sendBufferedScroll, 40);
      } else {
        isSendingScroll = false;
      }
    });
}

async function sendMouseClick(button) {
  try {
    await fetch("/api/mouse/click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ button }),
    });
  } catch (err) {
    console.error("Click error:", err);
  }
}

async function sendMouseScroll(amount) {
  try {
    fetch("/api/mouse/scroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    });
  } catch (err) {}
}

// -----------------------------------------------------------------------------
// Tab 2: Media & System Controls
// -----------------------------------------------------------------------------
function initMedia() {
  const mediaButtons = document.querySelectorAll("[data-media]");
  mediaButtons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      haptic(20);
      const action = btn.getAttribute("data-media");
      try {
        await fetch("/api/media", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
      } catch (err) {
        showToast("Action failed");
      }
    });
  });

  // Lock Workstation Button
  document.getElementById("btn-lock-pc")?.addEventListener("click", async () => {
    if (confirm("Lock your PC now?")) {
      haptic(50);
      try {
        await fetch("/api/system/lock", { method: "POST" });
        showToast("🔒 PC Locked!");
      } catch (e) {
        showToast("Could not lock PC");
      }
    }
  });

  // Show Desktop
  document.getElementById("btn-show-desktop")?.addEventListener("click", async () => {
    haptic(20);
    await fetch("/api/system/desktop", { method: "POST" });
    showToast("🖥️ Desktop Toggled");
  });
}

// -----------------------------------------------------------------------------
// Tab 3: File Sharing
// -----------------------------------------------------------------------------
function initFiles() {
  const fileInput = document.getElementById("file-upload-input");
  const uploadTrigger = document.getElementById("upload-trigger-box");

  uploadTrigger?.addEventListener("click", () => {
    fileInput.click();
  });

  fileInput?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    showToast(`Uploading ${file.name}...`, 4000);

    try {
      const res = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        haptic([30, 50, 30]);
        showToast(`✅ Saved on PC: ${data.filename}`, 3000);
      } else {
        showToast(`❌ Error: ${data.message}`);
      }
    } catch (err) {
      showToast("Upload failed");
    } finally {
      fileInput.value = "";
    }
  });

  document.getElementById("btn-refresh-files")?.addEventListener("click", () => {
    haptic(15);
    loadSharedFiles();
  });
}

async function loadSharedFiles() {
  const container = document.getElementById("shared-files-list");
  if (!container) return;

  container.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 13px;">Loading files...</div>`;

  try {
    const res = await fetch("/api/files/shared");
    const data = await res.json();

    if (data.status === "success" && data.files && data.files.length > 0) {
      container.innerHTML = "";
      data.files.forEach((file) => {
        const item = document.createElement("div");
        item.className = "file-item";
        item.innerHTML = `
          <div class="file-info">
            <span style="font-size: 20px;">📄</span>
            <div>
              <div class="file-name" title="${file.name}">${file.name}</div>
              <div class="file-meta">${file.size} • ${file.modified}</div>
            </div>
          </div>
          <a class="download-btn" href="/api/files/download/${encodeURIComponent(file.name)}" download>
            Download
          </a>
        `;
        container.appendChild(item);
      });
    } else {
      container.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); font-size: 13px; padding: 20px 0;">
          No files in shared/ folder yet.<br>Put files in the PC's <code>shared/</code> folder to download them here!
        </div>
      `;
    }
  } catch (err) {
    container.innerHTML = `<div style="text-align: center; color: #ef4444; font-size: 13px;">Failed to load files</div>`;
  }
}

// -----------------------------------------------------------------------------
// Tab 4: System Stats Telemetry
// -----------------------------------------------------------------------------
async function fetchSystemStats() {
  try {
    const res = await fetch("/api/system/stats");
    if (!res.ok) return;
    const data = await res.json();

    if (data.status === "success") {
      // CPU
      const cpuVal = document.getElementById("stat-cpu-val");
      const cpuBar = document.getElementById("stat-cpu-bar");
      if (cpuVal) cpuVal.textContent = `${data.cpu.percent}%`;
      if (cpuBar) cpuBar.style.width = `${data.cpu.percent}%`;

      // RAM
      const ramVal = document.getElementById("stat-ram-val");
      const ramBar = document.getElementById("stat-ram-bar");
      if (ramVal) ramVal.textContent = `${data.memory.percent}%`;
      if (ramBar) ramBar.style.width = `${data.memory.percent}%`;

      // Disk
      const diskVal = document.getElementById("stat-disk-val");
      const diskBar = document.getElementById("stat-disk-bar");
      if (diskVal) diskVal.textContent = `${data.disk.percent}%`;
      if (diskBar) diskBar.style.width = `${data.disk.percent}%`;

      // Battery
      const batVal = document.getElementById("stat-bat-val");
      const batBar = document.getElementById("stat-bat-bar");
      if (batVal) batVal.textContent = `${data.battery.percent}%`;
      if (batBar) batBar.style.width = `${data.battery.percent}%`;

      // Meta info
      document.getElementById("meta-hostname").textContent = data.hostname || "PC";
      document.getElementById("meta-os").textContent = data.os || "Windows";
      document.getElementById("meta-uptime").textContent = data.uptime || "--";
      document.getElementById("meta-ram-detail").textContent = `${data.memory.used_gb} GB / ${data.memory.total_gb} GB`;
    }
  } catch (e) {
    // Ignore transient poll errors
  }
}

// -----------------------------------------------------------------------------
// Remote Keyboard Input Helper
// -----------------------------------------------------------------------------
function initKeyboard() {
  document.getElementById("btn-type-prompt")?.addEventListener("click", async () => {
    const text = prompt("Type text to send directly to PC:");
    if (text) {
      haptic(20);
      try {
        await fetch("/api/keyboard/type", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        showToast("⌨️ Text sent to PC!");
      } catch (err) {
        showToast("Typing error");
      }
    }
  });
}
