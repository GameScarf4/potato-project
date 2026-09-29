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
// Tab 1: Virtual Trackpad
// -----------------------------------------------------------------------------
function initTrackpad() {
  const surface = document.getElementById("trackpad-surface");
  if (!surface) return;

  surface.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      lastTouchX = touch.clientX;
      lastTouchY = touch.clientY;
      touchStartTime = Date.now();
      isMoving = false;
    }
  }, { passive: false });

  surface.addEventListener("touchmove", (e) => {
    e.preventDefault(); // Stop mobile scroll pull-to-refresh
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const dx = touch.clientX - lastTouchX;
      const dy = touch.clientY - lastTouchY;

      lastTouchX = touch.clientX;
      lastTouchY = touch.clientY;

      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        isMoving = true;
        sendMouseMove(dx, dy);
      }
    } else if (e.touches.length === 2) {
      // Two finger scroll
      const touch = e.touches[0];
      const dy = touch.clientY - lastTouchY;
      lastTouchY = touch.clientY;
      if (Math.abs(dy) > 2) {
        sendMouseScroll(dy > 0 ? -60 : 60);
      }
    }
  }, { passive: false });

  surface.addEventListener("touchend", (e) => {
    const elapsed = Date.now() - touchStartTime;
    const totalDist = Math.hypot(lastTouchX - touchStartX, lastTouchY - touchStartY);

    // If tap was quick and finger didn't move much -> Trigger Left Click!
    if (elapsed < 250 && totalDist < 8 && !isMoving) {
      haptic(20);
      sendMouseClick("left");
    }
  });

  // Dedicated mouse buttons
  document.getElementById("btn-left-click")?.addEventListener("click", () => {
    haptic(20);
    sendMouseClick("left");
  });

  document.getElementById("btn-right-click")?.addEventListener("click", () => {
    haptic(30);
    sendMouseClick("right");
  });

  document.getElementById("btn-scroll-up")?.addEventListener("click", () => {
    haptic(10);
    sendMouseScroll(120);
  });

  document.getElementById("btn-scroll-down")?.addEventListener("click", () => {
    haptic(10);
    sendMouseScroll(-120);
  });
}

async function sendMouseMove(dx, dy) {
  try {
    fetch("/api/mouse/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dx, dy }),
    });
  } catch (err) {
    // Ignore network lag drops during rapid motion
  }
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
