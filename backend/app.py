"""
app.py
======
Main Flask Server & Remote API Gateway.
Author: Khaled (GameScarf4)
Module: Backend / HTTP & WebSocket Gateway
"""

import os
import io
import socket
import logging
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory, render_template_string
import qrcode

# Local modules
from pc_control import controller
from system_stats import get_system_stats

# Configure Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("PotatoHub")

# Resolve Base Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")
SHARED_DIR = os.path.join(BASE_DIR, "shared")

# Ensure required storage directories exist
os.makedirs(UPLOADS_DIR, exist_ok=True)
os.makedirs(SHARED_DIR, exist_ok=True)

app = Flask(
    __name__,
    static_folder=FRONTEND_DIR,
    static_url_path="",
)
app.config["MAX_CONTENT_LENGTH"] = 500 * 1024 * 1024  # 500 MB max upload limit


def get_local_ip() -> str:
    """Detect the local machine's LAN IPv4 address."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Doesn't need to be reachable, just triggers local interface selection
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip


import sys

# Ensure UTF-8 output encoding on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

def print_terminal_banner(ip: str, port: int):
    """Print ASCII QR Code and connection banner to PC terminal."""
    url = f"http://{ip}:{port}"
    print("\n" + "=" * 60)
    print("  POTATO REMOTE HUB - PHONE <-> PC CONTROLLER")
    print("  Author: Khaled (GameScarf4) & Koumait (koumait)")
    print("=" * 60)
    print(f"\n[+] Local Server URL: {url}")
    print("[+] Scan this QR Code with your phone camera:\n")

    try:
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=1,
            border=2,
        )
        qr.add_data(url)
        qr.make(fit=True)

        # 1. Save crisp image file for easy opening on PC screen
        img = qrcode.make(url)
        img.save(os.path.join(BASE_DIR, "qr_code.png"))

        # 2. Print ASCII QR code directly into console
        f = io.StringIO()
        qr.print_ascii(out=f, invert=True)
        f.seek(0)
        print(f.read())
    except Exception as e:
        logger.warning(f"Could not print ASCII QR: {e}")

    print("=" * 60)
    print(f"[*] Open {url} on your phone while connected to the same Wi-Fi!")
    print(f"[*] QR Code image saved to: qr_code.png")
    print("=" * 60 + "\n")


# -----------------------------------------------------------------------------
# Frontend Routes
# -----------------------------------------------------------------------------

@app.route("/")
def serve_index():
    """Serve the mobile remote web application."""
    index_file = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(index_file):
        return send_from_directory(FRONTEND_DIR, "index.html")
    return jsonify({
        "status": "ready",
        "message": "Potato Remote Hub Backend is active! Frontend index.html loading...",
        "author": "Khaled (GameScarf4)",
    })


@app.route("/<path:path>")
def serve_static(path):
    """Serve frontend static assets (CSS, JS, Icons)."""
    return send_from_directory(FRONTEND_DIR, path)


# -----------------------------------------------------------------------------
# Mouse API Endpoints
# -----------------------------------------------------------------------------

@app.route("/api/mouse/move", methods=["POST"])
def mouse_move():
    data = request.get_json(silent=True) or {}
    dx = float(data.get("dx", 0))
    dy = float(data.get("dy", 0))
    controller.move_mouse(dx, dy)
    return ("", 204)


@app.route("/api/mouse/click", methods=["POST"])
def mouse_click():
    data = request.get_json(silent=True) or {}
    button = data.get("button", "left")
    result = controller.click(button)
    return jsonify(result)


@app.route("/api/mouse/scroll", methods=["POST"])
def mouse_scroll():
    data = request.get_json(silent=True) or {}
    amount = int(data.get("amount", 0))
    result = controller.scroll(amount)
    return jsonify(result)


# -----------------------------------------------------------------------------
# Media & Volume API Endpoints
# -----------------------------------------------------------------------------

@app.route("/api/media", methods=["POST"])
def media_control():
    data = request.get_json(silent=True) or {}
    action = data.get("action", "")
    result = controller.media_action(action)
    return jsonify(result)


# -----------------------------------------------------------------------------
# Keyboard & Shortcuts API Endpoints
# -----------------------------------------------------------------------------

@app.route("/api/keyboard/type", methods=["POST"])
def keyboard_type():
    data = request.get_json(silent=True) or {}
    text = data.get("text", "")
    result = controller.type_text(text)
    return jsonify(result)


@app.route("/api/keyboard/key", methods=["POST"])
def keyboard_key():
    data = request.get_json(silent=True) or {}
    key = data.get("key", "")
    result = controller.press_key(key)
    return jsonify(result)


# -----------------------------------------------------------------------------
# System & Power API Endpoints
# -----------------------------------------------------------------------------

@app.route("/api/system/stats", methods=["GET"])
def system_telemetry():
    """Return real-time hardware telemetry."""
    return jsonify(get_system_stats())


@app.route("/api/system/lock", methods=["POST"])
def system_lock():
    """Lock the Windows workstation."""
    return jsonify(controller.lock_pc())


@app.route("/api/system/desktop", methods=["POST"])
def system_desktop():
    """Toggle Show Desktop (Win + D)."""
    return jsonify(controller.show_desktop())


# -----------------------------------------------------------------------------
# File Sharing API (Two-Way: Phone ⇄ PC)
# -----------------------------------------------------------------------------

@app.route("/api/files/upload", methods=["POST"])
def upload_file():
    """Upload file from phone to PC uploads folder."""
    if "file" not in request.files:
        return jsonify({"status": "error", "message": "No file payload found"}), 400

    uploaded = request.files["file"]
    if uploaded.filename == "":
        return jsonify({"status": "error", "message": "No filename specified"}), 400

    # Clean filename
    safe_filename = os.path.basename(uploaded.filename)
    dest_path = os.path.join(UPLOADS_DIR, safe_filename)

    # Avoid direct overwriting by appending timestamp if file exists
    if os.path.exists(dest_path):
        name, ext = os.path.splitext(safe_filename)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_filename = f"{name}_{timestamp}{ext}"
        dest_path = os.path.join(UPLOADS_DIR, safe_filename)

    uploaded.save(dest_path)
    file_size_mb = round(os.path.getsize(dest_path) / (1024 * 1024), 2)
    logger.info(f"File uploaded successfully: {safe_filename} ({file_size_mb} MB)")

    return jsonify({
        "status": "success",
        "filename": safe_filename,
        "size_mb": file_size_mb,
        "message": "File received and saved on PC!",
    })


@app.route("/api/files/shared", methods=["GET"])
def list_shared_files():
    """List all files in PC shared/ directory available for download on phone."""
    try:
        files = []
        for filename in os.listdir(SHARED_DIR):
            file_path = os.path.join(SHARED_DIR, filename)
            if os.path.isfile(file_path):
                size_bytes = os.path.getsize(file_path)
                size_str = (
                    f"{round(size_bytes / (1024 * 1024), 2)} MB"
                    if size_bytes >= 1024 * 1024
                    else f"{round(size_bytes / 1024, 1)} KB"
                )
                files.append({
                    "name": filename,
                    "size": size_str,
                    "modified": datetime.fromtimestamp(os.path.getmtime(file_path)).strftime("%Y-%m-%d %H:%M"),
                })
        return jsonify({"status": "success", "files": files})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})


@app.route("/api/files/download/<path:filename>", methods=["GET"])
def download_shared_file(filename):
    """Download a file from shared/ to the phone."""
    return send_from_directory(SHARED_DIR, filename, as_attachment=True)


# -----------------------------------------------------------------------------
# Main Execution Entrypoint
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    local_ip = get_local_ip()
    port = 5000
    print_terminal_banner(local_ip, port)
    # Run server binding to all network interfaces on the local LAN
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)
