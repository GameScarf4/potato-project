"""
system_stats.py
===============
Hardware telemetry and real-time PC performance metrics.
Author: Khaled (GameScarf4)
Module: Backend / System Telemetry
"""

import time
import platform
import psutil


def get_system_stats() -> dict:
    """
    Fetch comprehensive hardware and operating system metrics.
    Returns:
        dict: Real-time telemetry payload for mobile UI dashboard.
    """
    try:
        # CPU Metrics
        cpu_percent = psutil.cpu_percent(interval=None)
        cpu_count = psutil.cpu_count(logical=True)
        cpu_freq = psutil.cpu_freq()
        cpu_freq_current = round(cpu_freq.current, 0) if cpu_freq else 0

        # Memory Metrics
        mem = psutil.virtual_memory()
        mem_total_gb = round(mem.total / (1024 ** 3), 2)
        mem_used_gb = round(mem.used / (1024 ** 3), 2)
        mem_percent = mem.percent

        # Disk Metrics (Primary Drive C:\ or /)
        root_path = "C:\\" if platform.system() == "Windows" else "/"
        disk = psutil.disk_usage(root_path)
        disk_total_gb = round(disk.total / (1024 ** 3), 1)
        disk_used_gb = round(disk.used / (1024 ** 3), 1)
        disk_percent = disk.percent

        # Battery Metrics
        battery = psutil.sensors_battery()
        battery_data = {
            "percent": battery.percent if battery else 100,
            "power_plugged": battery.power_plugged if battery else True,
            "has_battery": battery is not None,
        }

        # Uptime
        boot_time = psutil.boot_time()
        uptime_seconds = int(time.time() - boot_time)
        uptime_hours = uptime_seconds // 3600
        uptime_minutes = (uptime_seconds % 3600) // 60
        uptime_str = f"{uptime_hours}h {uptime_minutes}m"

        return {
            "status": "success",
            "hostname": platform.node(),
            "os": f"{platform.system()} {platform.release()}",
            "uptime": uptime_str,
            "cpu": {
                "percent": cpu_percent,
                "cores": cpu_count,
                "freq_mhz": cpu_freq_current,
            },
            "memory": {
                "percent": mem_percent,
                "used_gb": mem_used_gb,
                "total_gb": mem_total_gb,
            },
            "disk": {
                "percent": disk_percent,
                "used_gb": disk_used_gb,
                "total_gb": disk_total_gb,
            },
            "battery": battery_data,
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}
