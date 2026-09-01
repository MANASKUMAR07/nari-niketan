# Nari Niketan — Android APK & Mobile App Generation Guide

This guide explains how to package the **Nari Niketan** PWA into a standalone **Android `.apk`** (for direct phone installation/sharing on WhatsApp) and a **Google Play Store `.aab`** package.

---

## Method 1: Instant APK Generation via PWABuilder (Fastest & Easiest)

**PWABuilder** (powered by Microsoft & Google) analyzes your live PWA manifest and packages it into a ready-to-install Android APK without requiring Android Studio on your PC.

### Steps:
1. Deploy your latest website to Firebase Hosting (or any live HTTPS domain):
   ```bash
   firebase deploy --only hosting
   ```
2. Open your browser and go to: **[https://www.pwabuilder.com](https://www.pwabuilder.com)**
3. Enter your live store URL (e.g., `https://nari-niketan-6c243.web.app`) and click **Start**.
4. PWABuilder will scan and verify:
   - Manifest (`manifest.webmanifest`) ✅
   - Service Worker (`sw.js`) ✅
   - High-Res Icons (192x192, 512x512, maskable) ✅
   - HTTPS Security ✅
5. Click **Package for Stores** and select **Android**.
6. Customize options:
   - **App Name**: `Nari Niketan`
   - **Package ID**: `com.nariniketan.app`
   - **Status Bar Color**: `#8B1A4A`
   - **Nav Bar Color**: `#1A0A0F`
   - **Splash Screen**: Enabled
7. Click **Generate**:
   - Download **`nari-niketan-unsigned.apk`** or **`signed-apk.zip`** for direct phone installation.
   - Download **`nari-niketan.aab`** if uploading to Google Play Console.

---

## Method 2: Google Bubblewrap CLI (Official Google TWA Tool)

Google's official command line tool creates a native Android wrapper called a **Trusted Web Activity (TWA)**.

### Prerequisites:
- Node.js (v18+)
- Java JDK 17+ and Android SDK

### Steps:
1. Install Bubblewrap globally:
   ```bash
   npm install -g @bubblewrap/cli
   ```
2. Initialize the project:
   ```bash
   bubblewrap init --manifest=https://nari-niketan-6c243.web.app/manifest.webmanifest
   ```
3. Follow the CLI prompts (Enter keystore password, package name `com.nariniketan.app`).
4. Build the release APK and AAB:
   ```bash
   bubblewrap build
   ```
5. You will get:
   - `app-release-signed.apk` (Install directly on any Android phone)
   - `app-release-bundle.aab` (Upload to Google Play Console)
   - `assetlinks.json` (Place inside `public/.well-known/assetlinks.json` for full-screen verification)

---

## Method 3: Capacitor (Offline Native Shell)

If you want native device plugins (camera, Bluetooth printers, biometric login):
1. Initialize Capacitor:
   ```bash
   npm init -y
   npm install @capacitor/core @capacitor/cli @capacitor/android
   npx cap init "Nari Niketan" "com.nariniketan.app" --web-dir "."
   ```
2. Add the Android platform:
   ```bash
   npx cap add android
   npx cap copy
   ```
3. Open in Android Studio:
   ```bash
   npx cap open android
   ```
4. In Android Studio, go to **Build > Build Bundle(s) / APK(s) > Build APK(s)** to generate your `.apk`.

---

## Digital Asset Links Verification (Removes URL Bar in Android TWA)

To make Google Android run the app in **100% full-screen mode** without any browser address bar:
1. Place your SHA-256 fingerprint in a file at:
   `/.well-known/assetlinks.json`
   ```json
   [
     {
       "relation": ["delegate_permission/common.handle_all_urls"],
       "target": {
         "namespace": "android_app",
         "package_name": "com.nariniketan.app",
         "sha256_cert_fingerprints": [
           "YOUR_SHA256_FINGERPRINT_HERE"
         ]
       }
     }
   ]
   ```
2. Ensure Firebase Hosting serves this file with `Content-Type: application/json`.
