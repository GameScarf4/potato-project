# 📱💻 Potato Remote Hub (Phone ⇄ PC Controller)

A lightweight, local network web application that turns any smartphone into a remote control and two-way file sharing hub for your PC — with **zero app installations needed on the phone**!

---

## 🎯 How It Works (طريقة العمل)

1. The PC runs a local Python web server (`app.py`).
2. When started, a **QR Code** and local URL (e.g. `http://192.168.1.15:5000`) appear in the PC terminal.
3. You scan the QR code with your phone camera while connected to the same Wi-Fi.
4. A full-featured mobile web interface opens in your phone's browser ready to control the PC and swap files!

---

## 👥 The Team & Task Breakdown (توزيع المهام بين الفريق)

### 🔵 Khaled (`GameScarf4`) — Backend & System Automation Lead
**المسؤولية:** برمجة السيرفر بلغة Python، التحكم بمؤشر الماوس، الصوت، ونظام رفع وتنزيل الملفات.

- [x] **Task 1: Server & Network Setup (`backend/app.py`)**
  - إعداد سيرفر Flask وتحديد الـ IP المحلي في الشبكة.
  - توليد وطباعة QR Code في الكونسول لسهولة مسحه بالجوال.
- [x] **Task 2: Mouse & Keyboard Controller (`backend/pc_control.py`)**
  - برمجة دوال `pyautogui` لتحريك الماوس عبر الإحداثيات المستلمة من الجوال (`move_rel`).
  - تنفيذ النقرة اليسرى، النقرة اليمنى، والتمرير (Scroll).
- [x] **Task 3: Media & System Commands (`backend/pc_control.py`)**
  - دوال التحكم بالصوت (رفع، خفض، كتم).
  - دوال تشغيل وإيقاف الميديا (Play / Pause / Next / Prev).
  - أوامر قفل الجهاز (Lock PC) أو النوم (Sleep).
- [x] **Task 4: File Transfer Backend (`backend/app.py`)**
  - بناء نقطة نهاية (Endpoint) لاستقبال الملفات المرفوعة من الجوال وحفظها في مجلد `uploads/`.
  - إرسال قائمة بالملفات المتاحة في مجلد `shared/` ليتمكن الجوال من تنزيلها.
- [x] **Task 5: PC Telemetry (`backend/system_stats.py`)**
  - استخدام مكتبة `psutil` لقراءة استهلاك المعالج (CPU) والذاكرة (RAM) وإرسالها للجوال في الوقت الفعلي.

---

### 💜 Khaled (`GameScarf4`) — Frontend & Mobile UI/UX Lead
**المسؤولية:** تصميم وبرمجة واجهة الويب للجوال (HTML, CSS, JavaScript) لتكون مريحة وسريعة الاستجابة للمس.

- [ ] **Task 1: Mobile UI Structure (`index.html`)**
  - تصميم واجهة متجاوبة ومريحة للجوال مع شريط تنقل سفلي أو علوي يحتوي على 4 أقسام:
    1. 🖱️ **Trackpad (الماوس)**
    2. 📁 **Files (الملفات)**
    3. 🎵 **Media & Power (الميديا والطاقة)**
    4. 📊 **Stats (مراقبة الجهاز)**
- [ ] **Task 2: Virtual Touchpad (`remote.js`)**
  - إنشاء مساحة لمس (Touch Area) تتعقب حركة الإصبع (`touchmove`) وترسل الإحداثيات للسيرفر فورياً.
  - إضافة أزرار مخصصة لـ Left Click و Right Click.
- [ ] **Task 3: File Manager UI**
  - زر سهل لسحب واختيار الصور والفيديوهات من الهاتف لرفعها للكمبيوتر.
  - قائمة بالملفات الموجودة على الكمبيوتر مع زر "تنزيل" لكل ملف.
- [ ] **Task 4: Media & Volume Controller UI**
  - أزرار لمس كبيرة وأنيقة للتحكم بالصوت وتخطي المقاطع (YouTube / Spotify).
  - أزرار سريعة لقفل الجهاز (Lock) بمظهر آمن يمنع الضغط الخاطئ.
- [ ] **Task 5: Live Hardware Gauges**
  - تصميم مؤشرات تقدم (Progress Bars) أنيقة تعرض استهلاك الـ CPU والـ RAM بشكل حي ومحدث.

---

## 📁 Recommended Repository Layout

```text
potato-project/
├── backend/
│   ├── app.py              # Main Flask server & API routes
│   ├── pc_control.py       # Mouse, keyboard, and volume actions (Khaled)
│   └── system_stats.py     # CPU & RAM telemetry (Khaled)
├── frontend/
│   ├── index.html          # Mobile web UI (Koumait)
│   ├── css/style.css       # Mobile styling & Dark Mode (Koumait)
│   └── js/remote.js        # Touch events & API calls (Koumait)
├── uploads/                # Files uploaded from phone to PC
├── shared/                 # Files available on PC to download to phone
├── requirements.txt        # Python libraries needed
└── README.md               # Project roadmap and task tracker
```

---

## 🛠️ Tech Stack & Requirements

### Backend:
- **Language:** Python 3.10+
- **Libraries:**
  - `flask` (Lightweight HTTP server)
  - `pyautogui` (Mouse & keyboard automation)
  - `psutil` (Hardware stats)
  - `qrcode` + `pillow` (Terminal / image QR Code generation)

### Frontend:
- **Core:** HTML5, Modern CSS3 (Dark Theme, Touch-friendly), Vanilla JavaScript.

---

## 🚀 Getting Started

### 1. Install dependencies on PC:
```bash
pip install flask pyautogui psutil qrcode pillow
```

### 2. Run the server:
```bash
python backend/app.py
```

### 3. Connect:
Scan the generated QR code or open `http://<your-pc-ip>:5000` on your mobile phone browser on the same Wi-Fi.

