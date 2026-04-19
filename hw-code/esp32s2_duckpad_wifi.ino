/*
 * DuckPad ESP32-S2 Firmware — WiFi + HTTP Polling Edition
 * =========================================================
 * The ESP32-S2 connects to WiFi, then polls your Vercel deployment
 * every 2 seconds for a pending payload. When a payload is found,
 * it executes it as USB HID keystrokes and mouse actions.
 *
 * ── BOARD SETUP (Arduino IDE) ──────────────────────────────
 *   Board:    ESP32S2 Dev Module  (or your specific S2 variant)
 *   USB Mode: USB-OTG (TinyUSB)   ← CRITICAL — set in Tools menu
 *   Upload Speed: 921600
 *   Board Manager URL:
 *     https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
 *
 * ── REQUIRED LIBRARIES ─────────────────────────────────────
 *   ESP32 Arduino Core >= 2.0.0 (includes TinyUSB + WiFi + HTTPClient)
 *   No additional libraries needed.
 *
 * ── CONFIGURATION ──────────────────────────────────────────
 *   1. Set WIFI_SSID and WIFI_PASSWORD below
 *   2. Set SERVER_URL to your Vercel deployment URL
 *   3. Set DEVICE_ID to match what you set in the web interface
 *      (or generate one there and copy it here)
 *
 * ── HOW IT WORKS ───────────────────────────────────────────
 *   1. Boot: connect WiFi → register as USB HID device
 *   2. Every 2s: GET https://your-app.vercel.app/api/payload?deviceId=ID
 *   3. If server returns a script, execute it line by line
 *   4. LED blinks during execution
 *
 * ── SCRIPT LANGUAGE ────────────────────────────────────────
 *   DELAY <ms>              Wait milliseconds
 *   TYPE <text>             Type text as keystrokes
 *   STRING_LN <text>        Type text then press ENTER
 *   KEY <name>              Single key press
 *   COMBO <MOD+key>         Key combination (e.g. CTRL+ALT+T)
 *   MOUSE_MOVE <x> <y>      Relative mouse move
 *   MOUSE_CLICK <btn>       LEFT, RIGHT, or MIDDLE
 *   MOUSE_DCLICK <btn>      Double click
 *   MOUSE_SCROLL <n>        Scroll wheel (+up, -down)
 *   WAIT_FOR_BOOT           3000ms delay
 *   REM / # / //            Comment (ignored)
 */

#include "USB.h"
#include "USBHIDKeyboard.h"
#include "USBHIDMouse.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ════════════════════════════════════════════════════════════
//  ⚙️  CONFIGURATION — edit these values
// ════════════════════════════════════════════════════════════

const char* WIFI_SSID     = "vivo Y400 5G";
const char* WIFI_PASSWORD = "aayushgid";

// Your Vercel deployment URL (no trailing slash)
const char* SERVER_URL    = "https://hid-device.vercel.app";

// Must match the Device ID set on the web interface
const char* DEVICE_ID     = "A3F2B1C0";

// How often to poll for new payloads (milliseconds)
const unsigned long POLL_INTERVAL = 2000;

// ════════════════════════════════════════════════════════════
//  Hardware
// ════════════════════════════════════════════════════════════

#define LED_PIN 18   // Built-in LED on most ESP32-S2 boards

USBHIDKeyboard Keyboard;
USBHIDMouse    Mouse;

// ════════════════════════════════════════════════════════════
//  Key name resolver
// ════════════════════════════════════════════════════════════

uint8_t resolveKey(const String& name) {
  String n = name;
  n.toUpperCase();
  n.trim();

  // Navigation / control
  if (n == "ENTER" || n == "RETURN")  return KEY_RETURN;
  if (n == "ESC"   || n == "ESCAPE")  return KEY_ESC;
  if (n == "BACKSPACE")               return KEY_BACKSPACE;
  if (n == "TAB")                     return KEY_TAB;
  if (n == "SPACE")                   return ' ';
  if (n == "DELETE" || n == "DEL")    return KEY_DELETE;
  if (n == "HOME")                    return KEY_HOME;
  if (n == "END")                     return KEY_END;
  if (n == "PAGEUP"   || n == "PGUP") return KEY_PAGE_UP;
  if (n == "PAGEDOWN" || n == "PGDN") return KEY_PAGE_DOWN;
  if (n == "UP")                      return KEY_UP_ARROW;
  if (n == "DOWN")                    return KEY_DOWN_ARROW;
  if (n == "LEFT")                    return KEY_LEFT_ARROW;
  if (n == "RIGHT")                   return KEY_RIGHT_ARROW;
  if (n == "INSERT")                  return KEY_INSERT;
  if (n == "PAUSE")                   return KEY_PAUSE;
  if (n == "PRINTSCREEN")             return KEY_PRINT_SCREEN;
  if (n == "CAPS" || n == "CAPSLOCK") return KEY_CAPS_LOCK;
  if (n == "NUMLOCK")                 return KEY_NUM_LOCK;

  // Function keys
  if (n == "F1")  return KEY_F1;
  if (n == "F2")  return KEY_F2;
  if (n == "F3")  return KEY_F3;
  if (n == "F4")  return KEY_F4;
  if (n == "F5")  return KEY_F5;
  if (n == "F6")  return KEY_F6;
  if (n == "F7")  return KEY_F7;
  if (n == "F8")  return KEY_F8;
  if (n == "F9")  return KEY_F9;
  if (n == "F10") return KEY_F10;
  if (n == "F11") return KEY_F11;
  if (n == "F12") return KEY_F12;

  // Modifiers
  if (n == "CTRL"  || n == "CONTROL") return KEY_LEFT_CTRL;
  if (n == "SHIFT")                   return KEY_LEFT_SHIFT;
  if (n == "ALT")                     return KEY_LEFT_ALT;
  if (n == "GUI"   || n == "WIN" || n == "CMD") return KEY_LEFT_GUI;
  if (n == "RCTRL")                   return KEY_RIGHT_CTRL;
  if (n == "RSHIFT")                  return KEY_RIGHT_SHIFT;
  if (n == "RALT"  || n == "ALTGR")  return KEY_RIGHT_ALT;
  if (n == "RGUI")                    return KEY_RIGHT_GUI;

  // Single char fallback
  if (n.length() == 1) {
  char c = n[0];

  // A-Z
  if (c >= 'A' && c <= 'Z') {
    return (c - 'A') + 0x04;  // HID A starts at 0x04
  }

  // 0-9
  if (c >= '0' && c <= '9') {
    return (c == '0') ? 0x27 : (c - '1') + 0x1E;
  }
}

  return 0; // unknown
}

// ════════════════════════════════════════════════════════════
//  Script executor — single line
// ════════════════════════════════════════════════════════════

void executeLine(const String& rawLine) {
  String line = rawLine;
  line.trim();
  if (line.length() == 0) return;

  // Comments
  if (line.startsWith("REM") || line.startsWith("#") || line.startsWith("//")) return;

  // ── DELAY ──────────────────────────────────────────────
  if (line.startsWith("DELAY ")) {
    int ms = line.substring(6).toInt();
    if (ms > 0 && ms < 60000) delay(ms);
    return;
  }

  // ── WAIT_FOR_BOOT ──────────────────────────────────────
  if (line == "WAIT_FOR_BOOT") {
    delay(3000);
    return;
  }

  // ── TYPE ───────────────────────────────────────────────
  if (line.startsWith("TYPE ")) {
    String text = line.substring(5);
    Keyboard.print(text);
    delay(20);
    return;
  }

  // ── STRING_LN ──────────────────────────────────────────
  if (line.startsWith("STRING_LN ")) {
    String text = line.substring(10);
    Keyboard.println(text);
    delay(20);
    return;
  }

  // ── KEY ────────────────────────────────────────────────
  if (line.startsWith("KEY ")) {
    String keyName = line.substring(4);
    keyName.trim();
    uint8_t k = resolveKey(keyName);
    if (k) {
      Keyboard.press(k);
      delay(50);
      Keyboard.release(k);
      delay(30);
    }
    return;
  }

  // ── COMBO ──────────────────────────────────────────────
  // Format: COMBO MOD+MOD+KEY  e.g. COMBO CTRL+ALT+T
  if (line.startsWith("COMBO ")) {
    String combo = line.substring(6);
    combo.trim();
    combo.toUpperCase();

    char key;
    bool ctrl = false, alt = false, shift = false, gui = false;

    int start = 0;

    for (int i = 0; i <= (int)combo.length(); i++) {
      if (i == combo.length() || combo[i] == '+') {
        String part = combo.substring(start, i);
        part.trim();

        if (part == "CTRL" || part == "CONTROL") ctrl = true;
        else if (part == "ALT")                  alt = true;
        else if (part == "SHIFT")                shift = true;
        else if (part == "GUI" || part == "WIN") gui = true;
        else {
          key = part[0];
          if (key >= 'A' && key <= 'Z') {
            key = key + 0x20;  // convert 'A'–'Z' to 'a'–'z'
          }
        }
        start = i + 1;
      }
    }

    // Press modifiers first
    if (ctrl)  Keyboard.press(KEY_LEFT_CTRL);
    if (alt)   Keyboard.press(KEY_LEFT_ALT);
    if (shift) Keyboard.press(KEY_LEFT_SHIFT);
    if (gui)   Keyboard.press(KEY_LEFT_GUI);

    // Then press main key
    if (key) {
      Keyboard.press(key);
      delay(20);          // let the key register
      Keyboard.release(key);
      delay(10);
    }
    Serial.println(key);

    delay(120);

    if (ctrl)  Keyboard.release(KEY_LEFT_CTRL);
    if (alt)   Keyboard.release(KEY_LEFT_ALT);
    if (shift) Keyboard.release(KEY_LEFT_SHIFT);
    if (gui)   Keyboard.release(KEY_LEFT_GUI);
    delay(100);

    return;
  }

  // ── MOUSE_MOVE ─────────────────────────────────────────
  if (line.startsWith("MOUSE_MOVE ")) {
    String args = line.substring(11);
    args.trim();
    int spIdx = args.indexOf(' ');
    if (spIdx > 0) {
      int x = args.substring(0, spIdx).toInt();
      int y = args.substring(spIdx + 1).toInt();
      // Clamp to int8_t range per call, move in steps if large
      while (abs(x) > 127 || abs(y) > 127) {
        int8_t dx = (int8_t)constrain(x, -127, 127);
        int8_t dy = (int8_t)constrain(y, -127, 127);
        Mouse.move(dx, dy, 0);
        x -= dx; y -= dy;
        delay(10);
      }
      Mouse.move((int8_t)x, (int8_t)y, 0);
      delay(20);
    }
    return;
  }

  // ── MOUSE_CLICK ────────────────────────────────────────
  if (line.startsWith("MOUSE_CLICK ")) {
    String btn = line.substring(12);
    btn.trim();
    btn.toUpperCase();
    uint8_t b = MOUSE_LEFT;
    if (btn == "RIGHT")  b = MOUSE_RIGHT;
    if (btn == "MIDDLE") b = MOUSE_MIDDLE;
    Mouse.click(b);
    delay(50);
    return;
  }

  // ── MOUSE_DCLICK ───────────────────────────────────────
  if (line.startsWith("MOUSE_DCLICK ")) {
    String btn = line.substring(13);
    btn.trim();
    btn.toUpperCase();
    uint8_t b = MOUSE_LEFT;
    if (btn == "RIGHT")  b = MOUSE_RIGHT;
    if (btn == "MIDDLE") b = MOUSE_MIDDLE;
    Mouse.click(b);
    delay(80);
    Mouse.click(b);
    delay(50);
    return;
  }

  // ── MOUSE_SCROLL ───────────────────────────────────────
  if (line.startsWith("MOUSE_SCROLL ")) {
    int amount = line.substring(13).toInt();
    amount = constrain(amount, -127, 127);
    Mouse.move(0, 0, (int8_t)amount);
    delay(30);
    return;
  }
}

// ════════════════════════════════════════════════════════════
//  Run a complete multi-line script
// ════════════════════════════════════════════════════════════

void runScript(const String& script) {
  Serial.println("[DuckPad] Executing script...");
  digitalWrite(LED_PIN, HIGH);

  int start = 0;
  int len = script.length();

  while (start < len) {
    int nl = script.indexOf('\n', start);
    String line;
    if (nl == -1) {
      line = script.substring(start);
      start = len;
    } else {
      line = script.substring(start, nl);
      start = nl + 1;
    }
    line.trim();
    if (line.length() > 0) {
      Serial.print("[DuckPad] > ");
      Serial.println(line);
      executeLine(line);
    }
  }

  digitalWrite(LED_PIN, LOW);
  Serial.println("[DuckPad] Script done.");
}

// ════════════════════════════════════════════════════════════
//  WiFi connect
// ════════════════════════════════════════════════════════════

void connectWiFi() {
  Serial.print("[WiFi] Connecting to ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries < 40) {
    delay(500);
    Serial.print(".");
    tries++;
    // Blink LED while connecting
    digitalWrite(LED_PIN, tries % 2);
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.print("[WiFi] Connected! IP: ");
    Serial.println(WiFi.localIP());
    // 3 quick blinks = WiFi connected
    for (int i = 0; i < 3; i++) {
      digitalWrite(LED_PIN, HIGH); delay(80);
      digitalWrite(LED_PIN, LOW);  delay(80);
    }
  } else {
    Serial.println("\n[WiFi] Failed to connect! Will retry in loop.");
    digitalWrite(LED_PIN, LOW);
  }
}

// ════════════════════════════════════════════════════════════
//  Poll server for pending payload
// ════════════════════════════════════════════════════════════

void pollServer() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[Poll] WiFi not connected, reconnecting...");
    connectWiFi();
    return;
  }

  String url = String(SERVER_URL) + "/api/payload?deviceId=" + String(DEVICE_ID);

  HTTPClient http;
  http.begin(url);
  http.setTimeout(5000); // 5s timeout

  int httpCode = http.GET();

  if (httpCode == HTTP_CODE_OK) {
    String payload = http.getString();

    // Parse JSON: { "script": "..." } or { "script": null }
    // Simple manual parse to avoid heavy JSON library requirement
    // But using ArduinoJson if available is cleaner:
    DynamicJsonDocument doc(32768); // 32KB for large scripts
    DeserializationError err = deserializeJson(doc, payload);

    if (!err) {
      const char* script = doc["script"];
      if (script && strlen(script) > 0) {
        Serial.println("[Poll] Got payload, running...");
        runScript(String(script));
      }
      // else: script is null — nothing queued
    } else {
      Serial.print("[Poll] JSON parse error: ");
      Serial.println(err.c_str());
    }
  } else if (httpCode > 0) {
    Serial.print("[Poll] HTTP error: ");
    Serial.println(httpCode);
  } else {
    Serial.print("[Poll] Connection failed: ");
    Serial.println(http.errorToString(httpCode));
  }

  http.end();
}

// ════════════════════════════════════════════════════════════
//  Setup
// ════════════════════════════════════════════════════════════

void setup() {
  Serial.begin(115200);
  delay(500);

  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  Serial.println("\n[DuckPad] Booting...");
  Serial.print("[DuckPad] Device ID: ");
  Serial.println(DEVICE_ID);
  Serial.print("[DuckPad] Server: ");
  Serial.println(SERVER_URL);

  // Init USB HID (keyboard + mouse)
  USB.begin();
  delay(500);          // allow USB stack to initialize
  Keyboard.begin();
  Mouse.begin();

  // Let USB HID enumerate before connecting WiFi
  delay(4000);

  // Test: send a single 'R' after a few seconds
  uint8_t rKey = resolveKey("R");   // returns 0x15
if (rKey) {
  Keyboard.press(rKey);
  delay(50);
  Keyboard.release(rKey);
  delay(50);
}

  // Connect to WiFi
  connectWiFi();

  Serial.println("[DuckPad] Ready. Polling for payloads...");
}

// ════════════════════════════════════════════════════════════
//  Main loop
// ════════════════════════════════════════════════════════════

unsigned long lastPoll = 0;

void loop() {
  unsigned long now = millis();

  if (now - lastPoll >= POLL_INTERVAL) {
    lastPoll = now;
    pollServer();
  }

  // Small delay to prevent watchdog issues
  delay(50);
}