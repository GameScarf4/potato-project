"""
pc_control.py
=============
System automation and remote input controller for PC.
Author: Khaled (GameScarf4)
Module: Backend / PC Automation
"""

import sys
import ctypes
import pyautogui

# Disable PyAutoGUI fail-safe to avoid triggering emergency stop at screen corners
pyautogui.FAILSAFE = False
pyautogui.PAUSE = 0.001  # Ultra-low latency for smooth trackpad movement


class PCController:
    """
    Handles all mouse, keyboard, media, and system-level actions on the PC.
    """

    def __init__(self, sensitivity: float = 1.3):
        self.sensitivity = sensitivity

    # -------------------------------------------------------------------------
    # Mouse Controls
    # -------------------------------------------------------------------------

    def move_mouse(self, dx: float, dy: float):
        """
        Move the mouse relative to its current position.
        """
        try:
            scaled_dx = int(dx * self.sensitivity)
            scaled_dy = int(dy * self.sensitivity)
            pyautogui.moveRel(scaled_dx, scaled_dy, _pause=False)
            return {"status": "success", "action": "move_mouse", "dx": scaled_dx, "dy": scaled_dy}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def click(self, button: str = "left"):
        """
        Perform a mouse click ('left', 'right', 'middle', 'double').
        """
        try:
            if button == "double":
                pyautogui.doubleClick(_pause=False)
            elif button in ("left", "right", "middle"):
                pyautogui.click(button=button, _pause=False)
            else:
                pyautogui.click(button="left", _pause=False)
            return {"status": "success", "action": f"click_{button}"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def scroll(self, amount: int):
        """
        Scroll mouse wheel. Positive = Up, Negative = Down.
        """
        try:
            pyautogui.scroll(int(amount), _pause=False)
            return {"status": "success", "action": "scroll", "amount": amount}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def mouse_down(self, button: str = "left"):
        """Hold down mouse button (for drag and drop)."""
        try:
            pyautogui.mouseDown(button=button, _pause=False)
            return {"status": "success", "action": f"mouse_down_{button}"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def mouse_up(self, button: str = "left"):
        """Release mouse button."""
        try:
            pyautogui.mouseUp(button=button, _pause=False)
            return {"status": "success", "action": f"mouse_up_{button}"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    # -------------------------------------------------------------------------
    # Media & Volume Controls
    # -------------------------------------------------------------------------

    def media_action(self, action: str):
        """
        Perform media control action:
        'play_pause', 'next', 'prev', 'volume_up', 'volume_down', 'mute'
        """
        action_map = {
            "play_pause": "playpause",
            "next": "nexttrack",
            "prev": "prevtrack",
            "volume_up": "volumeup",
            "volume_down": "volumedown",
            "mute": "volumemute",
            "stop": "stop",
        }
        key = action_map.get(action.lower())
        if not key:
            return {"status": "error", "message": f"Unknown media action: {action}"}

        try:
            pyautogui.press(key, _pause=False)
            return {"status": "success", "action": action}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    # -------------------------------------------------------------------------
    # Keyboard & Shortcuts
    # -------------------------------------------------------------------------

    def type_text(self, text: str):
        """Type arbitrary string of text."""
        try:
            pyautogui.write(text, interval=0.01)
            return {"status": "success", "action": "type_text", "chars": len(text)}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def press_key(self, key: str):
        """Press a specific key (enter, backspace, esc, tab, space, etc.)."""
        try:
            pyautogui.press(key.lower(), _pause=False)
            return {"status": "success", "action": "press_key", "key": key}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def hotkey(self, *keys):
        """Trigger key combinations (e.g. ['alt', 'tab'] or ['ctrl', 'c'])."""
        try:
            pyautogui.hotkey(*keys, _pause=False)
            return {"status": "success", "action": "hotkey", "keys": keys}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    # -------------------------------------------------------------------------
    # Power & System Controls
    # -------------------------------------------------------------------------

    def lock_pc(self):
        """Instantly lock the Windows workstation."""
        try:
            if sys.platform == "win32":
                ctypes.windll.user32.LockWorkStation()
                return {"status": "success", "action": "lock_pc"}
            else:
                return {"status": "error", "message": "LockWorkStation is only supported on Windows"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def show_desktop(self):
        """Toggle Show Desktop (Win + D)."""
        return self.hotkey("win", "d")


# Singleton instance ready for import in app.py
controller = PCController()
