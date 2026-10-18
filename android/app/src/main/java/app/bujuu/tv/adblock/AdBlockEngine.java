package app.bujuu.tv.adblock;

import android.content.Context;
import android.net.Uri;
import android.util.Base64;
import android.util.Log;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;

import org.json.JSONArray;
import org.json.JSONObject;
import android.content.SharedPreferences;
import java.io.FileOutputStream;
import java.net.HttpURLConnection;
import java.net.URL;


import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

public class AdBlockEngine {
    private static final String TAG = "BUJUU_AdBlockEngine";
    private static volatile AdBlockEngine instance;
    private boolean initialized = false;
    private String ruleStatsJson = null;

    // Neutral 1x1 transparent PNG for suppressed image ads
    private static final byte[] TRANSPARENT_1X1_PNG = Base64.decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            Base64.DEFAULT
    );

    // Clean neutral no-op script stub (no mocked fake APIs or deceptive overrides)
    private static final byte[] NEUTRAL_NOOP_JS = "/* [BUJUU AdBlock] Blocked resource */\n".getBytes(StandardCharsets.UTF_8);

    private static final byte[] EMPTY_BYTES = new byte[0];

    public static class AdBlockDecision {
        public final boolean isBlocked;
        public final String mimeType;
        public final byte[] data;

        public AdBlockDecision(boolean isBlocked, String mimeType, byte[] data) {
            this.isBlocked = isBlocked;
            this.mimeType = mimeType;
            this.data = data;
        }

        public static AdBlockDecision allowed() {
            return new AdBlockDecision(false, "text/plain", EMPTY_BYTES);
        }

        public static AdBlockDecision blocked(String mimeType, byte[] data) {
            return new AdBlockDecision(true, mimeType, data);
        }
    }

    // Narrow allowlist for critical app infrastructure, auth, metadata, and payment providers
    private static final Set<String> ALLOWED_HOST_SUFFIXES = new HashSet<>(Arrays.asList(
            "localhost",
            "127.0.0.1",
            "bujuu.tv",
            "supabase.co",
            "lovable.cloud",
            "lovable.app",
            "themoviedb.org",
            "tmdb.org",
            "google.com",
            "accounts.google.com",
            "googleusercontent.com",
            "gstatic.com",
            "payhero.co.ke",
            "backend.payhero.co.ke",
            "lynnn-phi.vercel.app",
            "bujuu-app.vercel.app"
    ));

    // Fallback domain blocklist if native library is pending or uninitialized
    private static final Set<String> FALLBACK_BLOCKED_HOST_SUFFIXES = new HashSet<>(Arrays.asList(
            "doubleclick.net",
            "googlesyndication.com",
            "googleadservices.com",
            "popads.net",
            "popcash.net",
            "propellerads.com",
            "adsterra.com",
            "exoclick.com",
            "juicyads.com",
            "monetag.com",
            "yllix.com",
            "taboola.com",
            "outbrain.com",
            "trafficjunky.com",
            "clickadu.com",
            "admaven.com",
            "hilltopads.com",
            "richpush.co",
            "evadav.com",
            "zeropark.com",
            "popmyads.com",
            "clicksor.com",
            "adcash.com",
            "mgid.com",
            "bidvertiser.com",
            "revenuehits.com",
            "bidgear.com",
            "ad-maven.com",
            "onclickalgo.com",
            "deloton.com",
            "tsyndicate.com",
            "tubecup.net",
            "rtmark.net",
            "hpyrdr.com",
            "bestcontentfood.top",
            "syndication.realsrv.com",
            "realsrv.com",
            "vdo.ai",
            "aniview.com",
            "connatix.com",
            "playwire.com",
            "primis.tech",
            "adnxs.com",
            "rubiconproject.com",
            "openx.net",
            "pubmatic.com",
            "criteo.com",
            "criteo.net",
            "notix.co",
            "onesignal.com",
            "pushwoosh.com",
    ));

    private AdBlockEngine() {}

    public static AdBlockEngine getInstance() {
        if (instance == null) {
            synchronized (AdBlockEngine.class) {
                if (instance == null) {
                    instance = new AdBlockEngine();
                }
            }
        }
        return instance;
    }

    public synchronized void initialize(Context context) {
        if (initialized) return;

        if (!AdBlockBridge.isLibraryLoaded()) {
            Log.w(TAG, "Native adblock library not loaded; using fallback domain rules");
            initialized = true;
            return;
        }

        try {
            String rules = null;
            // 1. Try loading cached remote updated filter list if available
            File updatedFile = new File(context.getFilesDir(), "adblock-filters-updated.txt");
            if (updatedFile.exists() && updatedFile.length() > 1000) {
                try {
                    InputStream fis = new FileInputStream(updatedFile);
                    rules = readStreamToString(fis);
                    Log.i(TAG, "Loaded updated filter rules from cache (" + updatedFile.length() + " bytes)");
                } catch (Exception e) {
                    Log.w(TAG, "Failed reading cached filter rules, falling back to assets", e);
                }
            }

            // 2. Fall back to bundled filter list from APK assets
            if (rules == null || rules.trim().isEmpty()) {
                InputStream is = context.getAssets().open("adblock-filters.txt");
                rules = readStreamToString(is);
                Log.i(TAG, "Loaded bundled filter rules from assets");
            }

            boolean ok = AdBlockBridge.nativeInit(rules);
            initialized = ok;
            if (ok) {
                ruleStatsJson = AdBlockBridge.nativeGetRulesStats();
                Log.i(TAG, "Native Brave adblock engine initialized. Stats: " + ruleStatsJson);
            } else {
                Log.w(TAG, "Native adblock initialization returned false");
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to initialize adblock filters", e);
        }

        // Check for fresh remote filter rule updates asynchronously (once every 24h)
        checkAndUpdateFiltersAsync(context);
    }

    private static String readStreamToString(InputStream is) throws Exception {
        BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) {
            sb.append(line).append("\n");
        }
        reader.close();
        return sb.toString();
    }

    public String getRuleStats() {
        return ruleStatsJson;
    }

    public AdBlockDecision evaluateRequest(WebResourceRequest request) {
        if (request == null || request.getUrl() == null) {
            return AdBlockDecision.allowed();
        }
        String urlString = request.getUrl().toString();
        String sourceUrl = "https://app.bujuu.tv";
        String reqType = "other";

        // Extract genuine Referer or Origin to provide accurate initiator context to Brave adblock-rust
        Map<String, String> headers = request.getRequestHeaders();
        if (headers != null) {
            String referer = headers.get("Referer");
            if (referer == null) referer = headers.get("referer");
            String origin = headers.get("Origin");
            if (origin == null) origin = headers.get("origin");

            if (referer != null && !referer.isEmpty() && !referer.startsWith("capacitor://") && !referer.startsWith("http://localhost")) {
                sourceUrl = referer;
            } else if (origin != null && !origin.isEmpty() && !origin.startsWith("capacitor://") && !origin.startsWith("http://localhost")) {
                sourceUrl = origin;
            }
        }

        // Granular resource-type classification based on Sec-Fetch-Dest, Sec-Fetch-Mode, and Accept headers
        if (headers != null) {
            String dest = headers.get("Sec-Fetch-Dest");
            if (dest == null) dest = headers.get("sec-fetch-dest");
            if (dest != null) {
                dest = dest.toLowerCase();
                if ("script".equals(dest)) reqType = "script";
                else if ("style".equals(dest)) reqType = "stylesheet";
                else if ("image".equals(dest)) reqType = "image";
                else if ("video".equals(dest) || "audio".equals(dest)) reqType = "media";
                else if ("document".equals(dest) || "iframe".equals(dest)) reqType = "subdocument";
                else if ("empty".equals(dest)) reqType = "xmlhttprequest";
            }

            if ("other".equals(reqType)) {
                String accept = headers.get("Accept");
                if (accept == null) accept = headers.get("accept");
                if (accept != null) {
                    accept = accept.toLowerCase();
                    if (accept.contains("text/css")) reqType = "stylesheet";
                    else if (accept.contains("image/")) reqType = "image";
                    else if (accept.contains("application/javascript") || accept.contains("text/javascript")) reqType = "script";
                    else if (accept.contains("text/html")) reqType = "subdocument";
                    else if (accept.contains("application/json")) reqType = "xmlhttprequest";
                }
            }
        }

        if ("other".equals(reqType)) {
            String lower = urlString.toLowerCase();
            if (lower.contains(".js") || lower.contains("/js/") || lower.contains("script")) {
                reqType = "script";
            } else if (lower.contains(".css")) {
                reqType = "stylesheet";
            } else if (lower.contains(".png") || lower.contains(".jpg") || lower.contains(".jpeg") || lower.contains(".webp") || lower.contains(".gif") || lower.contains(".ico")) {
                reqType = "image";
            } else if (lower.contains(".mp4") || lower.contains(".m4a") || lower.contains(".mp3") || lower.contains(".aac")) {
                reqType = "media";
            }
        }

        return evaluateRequest(urlString, sourceUrl, reqType);
    }

    public AdBlockDecision evaluateRequest(String urlString, String sourceUrl, String reqType) {
        if (urlString == null || urlString.isEmpty()) {
            return AdBlockDecision.allowed();
        }

        Uri uri;
        try {
            uri = Uri.parse(urlString);
        } catch (Exception e) {
            return AdBlockDecision.allowed();
        }

        String host = uri.getHost();
        if (host == null) return AdBlockDecision.allowed();
        host = host.toLowerCase();

        // 1. Never block critical auth, supabase, metadata, payment, or app infrastructure
        for (String allowed : ALLOWED_HOST_SUFFIXES) {
            if (host.equals(allowed) || host.endsWith("." + allowed)) {
                return AdBlockDecision.allowed();
            }
        }

        // 2. Never block actual video stream manifests, media segments, or subtitles
        String lowerUrl = urlString.toLowerCase();
        if (lowerUrl.contains(".m3u8") || lowerUrl.contains(".mpd") || lowerUrl.contains(".mp4")
                || lowerUrl.contains(".vtt") || lowerUrl.contains(".srt")
                || lowerUrl.endsWith(".ts") || lowerUrl.contains(".ts?") || lowerUrl.contains("/seg")) {
            return AdBlockDecision.allowed();
        }

        // 3. Query Genuine Brave adblock-rust engine if native library is loaded
        if (AdBlockBridge.isLibraryLoaded() && initialized) {
            try {
                // Check resource redirection rule first
                String redirect = AdBlockBridge.nativeGetRedirect(urlString, sourceUrl, reqType);
                if (redirect != null && !redirect.isEmpty()) {
                    Log.d(TAG, "Brave adblock redirect rule applied for: " + urlString);
                    byte[] data = redirect.getBytes(StandardCharsets.UTF_8);
                    return AdBlockDecision.blocked(
                            reqType.equals("script") ? "application/javascript" : "text/plain",
                            data
                    );
                }

                boolean blocked = AdBlockBridge.nativeShouldBlock(urlString, sourceUrl, reqType);
                if (blocked) {
                    Log.d(TAG, "Brave adblock blocked: " + urlString + " [type=" + reqType + "]");
                    return createSafeBlockedResponse(reqType, urlString);
                }
            } catch (Throwable t) {
                Log.w(TAG, "Native adblock check failed: " + t.getMessage());
            }
        }

        // 4. Fallback host blocking check
        for (String blockedHost : FALLBACK_BLOCKED_HOST_SUFFIXES) {
            if (host.equals(blockedHost) || host.endsWith("." + blockedHost)) {
                Log.d(TAG, "Fallback blocked ad request: " + urlString);
                return createSafeBlockedResponse(reqType, urlString);
            }
        }

        return AdBlockDecision.allowed();
    }

    private AdBlockDecision createSafeBlockedResponse(String reqType, String urlString) {
        String lower = urlString.toLowerCase();
        if ("script".equals(reqType) || lower.endsWith(".js") || lower.contains("/js/")) {
            return AdBlockDecision.blocked("application/javascript", NEUTRAL_NOOP_JS);
        }
        if ("image".equals(reqType) || lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".gif") || lower.endsWith(".webp")) {
            return AdBlockDecision.blocked("image/png", TRANSPARENT_1X1_PNG);
        }
        if ("media".equals(reqType)) {
            return AdBlockDecision.blocked("audio/mp4", EMPTY_BYTES);
        }
        return AdBlockDecision.blocked("text/plain", EMPTY_BYTES);
    }

    public boolean shouldBlock(WebResourceRequest request) {
        return evaluateRequest(request).isBlocked;
    }

    public boolean shouldBlock(String urlString) {
        return evaluateRequest(urlString, "https://app.bujuu.tv", "other").isBlocked;
    }

    /**
     * Injects safe pop-up / pop-under interception and genuine Brave scriptlets without mocked ad APIs.
     */
    public void injectEarlyScriptlets(WebView webView, String url) {
        if (webView == null || url == null) return;

        try {
            String nativeScriptlet = "";
            if (AdBlockBridge.isLibraryLoaded() && initialized) {
                try {
                    nativeScriptlet = AdBlockBridge.nativeGetScriptlet(url);
                } catch (Throwable ignored) {}
            }

            StringBuilder js = new StringBuilder();
            js.append("(function() {\n");
            js.append("  'use strict';\n");

            // Intercept window.open popups and redirect chains safely without fake ad objects
            js.append("  try {\n");
            js.append("    var _realOpen = window.open;\n");
            js.append("    window.open = function(targetUrl, targetName, targetFeatures) {\n");
            js.append("      if (!targetUrl || targetUrl === 'about:blank') return null;\n");
            js.append("      var lower = String(targetUrl).toLowerCase();\n");
            js.append("      if (lower.indexOf('popads') !== -1 || lower.indexOf('adsterra') !== -1 || lower.indexOf('exoclick') !== -1 || lower.indexOf('propeller') !== -1 || lower.indexOf('monetag') !== -1 || lower.indexOf('clickadu') !== -1) {\n");
            js.append("        console.log('[BUJUU] Suppressed popup navigation to: ' + targetUrl);\n");
            js.append("        return null;\n");
            js.append("      }\n");
            js.append("      return _realOpen ? _realOpen.apply(this, arguments) : null;\n");
            js.append("    };\n");
            js.append("  } catch(e) {}\n");

            if (nativeScriptlet != null && !nativeScriptlet.trim().isEmpty()) {
                js.append("  try {\n").append(nativeScriptlet).append("\n} catch(e) {}\n");
            }

            js.append("})();\n");

            final String script = js.toString();
            webView.post(() -> webView.evaluateJavascript(script, null));
        } catch (Throwable t) {
            Log.w(TAG, "Failed to inject scriptlets: " + t.getMessage());
        }
    }

    /**
     * Injects cosmetic DOM hiding CSS including native Brave cosmetic selectors, guarding legitimate video player controls.
     */
    public void injectCosmeticHiding(WebView webView, String url) {
        if (webView == null || url == null) return;

        try {
            StringBuilder extraSelectors = new StringBuilder();
            if (AdBlockBridge.isLibraryLoaded() && initialized) {
                try {
                    String json = AdBlockBridge.nativeGetCosmeticSelectors(url);
                    if (json != null && !json.isEmpty()) {
                        JSONObject obj = new JSONObject(json);
                        JSONArray selectors = obj.optJSONArray("selectors");
                        if (selectors != null) {
                            for (int i = 0; i < selectors.length(); i++) {
                                String sel = selectors.optString(i);
                                if (sel != null && !sel.isEmpty()) {
                                    extraSelectors.append(", ").append(sel);
                                }
                            }
                        }
                    }
                } catch (Throwable ignored) {}
            }

            String baseSelectors = ".ad-banner, [id^=\"ad_\"], [class*=\"sponsored\"], [class*=\"banner-ad\"], [id*=\"google_ads\"], iframe[src*=\"doubleclick\"], iframe[src*=\"adsterra\"], iframe[src*=\"popads\"], iframe[src*=\"exoclick\"], iframe[src*=\"monetag\"], .video-ad-overlay, .vpaid-ad, .preroll-ad, [class*=\"ad-container\"], [id*=\"ad-container\"], [class*=\"popup-ad\"], .floating-ad";
            String fullSelectors = baseSelectors + extraSelectors.toString();

            String js = "(function() {\n" +
                    "  try {\n" +
                    "    var id = 'bujuu-adblock-cosmetic';\n" +
                    "    var existing = document.getElementById(id);\n" +
                    "    if (!existing) {\n" +
                    "      var st = document.createElement('style');\n" +
                    "      st.id = id;\n" +
                    "      st.type = 'text/css';\n" +
                    "      st.textContent = '" + fullSelectors.replace("'", "\\'") + " { display: none !important; visibility: hidden !important; height: 0 !important; width: 0 !important; opacity: 0 !important; pointer-events: none !important; }';\n" +
                    "      (document.head || document.documentElement).appendChild(st);\n" +
                    "    }\n" +
                    "\n" +
                    "    // Efficient MutationObserver, strictly protecting valid video player controls and overlays\n" +
                    "    var obs = new MutationObserver(function(muts) {\n" +
                    "      for (var i = 0; i < muts.length; i++) {\n" +
                    "        var added = muts[i].addedNodes;\n" +
                    "        for (var j = 0; j < added.length; j++) {\n" +
                    "          var n = added[j];\n" +
                    "          if (n.nodeType === 1) {\n" +
                    "            // Never hide nodes inside legitimate video players or subtitles\n" +
                    "            if (n.closest && n.closest('video, .vjs-control-bar, [class*=\"player\"], [id*=\"player\"], [class*=\"video\"], [id*=\"video\"]')) {\n" +
                    "              continue;\n" +
                    "            }\n" +
                    "            var tag = n.tagName ? n.tagName.toLowerCase() : '';\n" +
                    "            if (tag === 'script' || tag === 'iframe') {\n" +
                    "              var src = n.src ? n.src.toLowerCase() : '';\n" +
                    "              if (src.indexOf('popads') !== -1 || src.indexOf('adsterra') !== -1 || src.indexOf('exoclick') !== -1 || src.indexOf('propeller') !== -1 || src.indexOf('monetag') !== -1) {\n" +
                    "                n.remove();\n" +
                    "                continue;\n" +
                    "              }\n" +
                    "            }\n" +
                    "            if (n.matches && n.matches('.ad-banner, .video-ad-overlay, [class*=\"banner-ad\"], [class*=\"popup-ad\"], .floating-ad')) {\n" +
                    "              n.style.setProperty('display', 'none', 'important');\n" +
                    "            }\n" +
                    "          }\n" +
                    "        }\n" +
                    "      }\n" +
                    "    });\n" +
                    "    obs.observe(document.body || document.documentElement, { childList: true, subtree: true });\n" +
                    "  } catch(e) {}\n" +
                    "})();";

            webView.post(() -> webView.evaluateJavascript(js, null));
        } catch (Throwable t) {
            Log.w(TAG, "Failed to inject cosmetic hiding: " + t.getMessage());
        }
    }

    /**
     * Periodically updates filter rules in the background from remote source without blocking UI or playback.
     * Caches rules locally and re-initializes Brave adblock engine dynamically.
     */
    public void checkAndUpdateFiltersAsync(Context context) {
        if (context == null) return;
        final Context appContext = context.getApplicationContext();

        new Thread(() -> {
            try {
                SharedPreferences prefs = appContext.getSharedPreferences("bujuu_adblock_prefs", Context.MODE_PRIVATE);
                long lastCheck = prefs.getLong("last_filter_check_timestamp", 0);
                long now = System.currentTimeMillis();
                // Check once every 24 hours
                if (now - lastCheck < 24 * 60 * 60 * 1000) {
                    Log.d(TAG, "AdBlock filters are fresh (last checked " + ((now - lastCheck) / 3600000) + "h ago)");
                    return;
                }

                Log.i(TAG, "Checking for remote adblock filter updates...");
                String filterUrl = "https://raw.githubusercontent.com/abelmutinda9-rgb/bujuu-app/main/android/app/src/main/assets/adblock-filters.txt";
                URL url = new URL(filterUrl);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(15000);
                conn.setRequestProperty("User-Agent", "BUJUU-Android-AdBlock/1.6");

                int code = conn.getResponseCode();
                if (code == 200) {
                    InputStream is = conn.getInputStream();
                    String newRules = readStreamToString(is);
                    conn.disconnect();

                    if (newRules != null && newRules.length() > 50000 && (newRules.contains("||") || newRules.startsWith("!"))) {
                        File tempFile = new File(appContext.getFilesDir(), "adblock-filters-updated.tmp");
                        File targetFile = new File(appContext.getFilesDir(), "adblock-filters-updated.txt");

                        FileOutputStream fos = new FileOutputStream(tempFile);
                        fos.write(newRules.getBytes(StandardCharsets.UTF_8));
                        fos.flush();
                        fos.close();

                        if (tempFile.renameTo(targetFile)) {
                            Log.i(TAG, "Successfully downloaded and cached fresh adblock filters (" + targetFile.length() + " bytes)");
                            prefs.edit().putLong("last_filter_check_timestamp", now).apply();

                            // Re-initialize engine with updated rules dynamically
                            if (AdBlockBridge.isLibraryLoaded()) {
                                boolean ok = AdBlockBridge.nativeInit(newRules);
                                if (ok) {
                                    ruleStatsJson = AdBlockBridge.nativeGetRulesStats();
                                    Log.i(TAG, "Dynamically reloaded Brave adblock engine with fresh rules: " + ruleStatsJson);
                                }
                            }
                        }
                    } else {
                        Log.w(TAG, "Remote filter rules did not pass sanity validation (length=" + (newRules != null ? newRules.length() : 0) + ")");
                    }
                } else {
                    Log.w(TAG, "Remote filter check received HTTP " + code);
                    conn.disconnect();
                }
            } catch (Exception e) {
                Log.w(TAG, "Background filter update check failed (offline or network error): " + e.getMessage());
            }
        }, "BujuuAdBlockUpdater").start();
    }

}
