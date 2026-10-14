package app.bujuu.tv.adblock;

import android.content.Context;
import android.net.Uri;
import android.util.Base64;
import android.util.Log;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
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

    // Bundled dummy assets to prevent video players and stream state machines from freezing
    private static final byte[] TRANSPARENT_1X1_PNG = Base64.decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            Base64.DEFAULT
    );

    private static final byte[] MOCK_NOOP_JS = (
            "(function() {\n" +
            "  window.noop = function() {};\n" +
            "  window.canRunAds = true;\n" +
            "  window.isAdBlockActive = false;\n" +
            "  window.adblock = false;\n" +
            "  window.google_ad_client = null;\n" +
            "  window.google_ad_status = 1;\n" +
            "  window.googletag = window.googletag || {\n" +
            "    cmd: [],\n" +
            "    display: function() {},\n" +
            "    defineSlot: function() { return this; },\n" +
            "    addService: function() { return this; },\n" +
            "    enableServices: function() {},\n" +
            "    pubads: function() { return {\n" +
            "      addEventListener: function() {},\n" +
            "      clear: function() {},\n" +
            "      refresh: function() {},\n" +
            "      enableSingleRequest: function() {},\n" +
            "      collapseEmptyDivs: function() {}\n" +
            "    }; }\n" +
            "  };\n" +
            "  window.adsbygoogle = window.adsbygoogle || [];\n" +
            "  window.adsbygoogle.loaded = true;\n" +
            "})();\n"
    ).getBytes(StandardCharsets.UTF_8);

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

    // Hard allowlist for critical app infrastructure, auth, metadata, and payment providers
    private static final Set<String> ALLOWED_HOST_SUFFIXES = new HashSet<>(Arrays.asList(
            "localhost",
            "127.0.0.1",
            "bujuu.tv",
            "supabase.co",
            "lovable.cloud",
            "themoviedb.org",
            "tmdb.org",
            "google.com",
            "accounts.google.com",
            "googleusercontent.com",
            "gstatic.com",
            "payhero.co.ke",
            "backend.payhero.co.ke"
    ));

    // Fallback domain blacklist if native library is pending
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
            "revenuehits.com"
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
            InputStream is = context.getAssets().open("adblock-filters.txt");
            BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line).append("\n");
            }
            reader.close();

            boolean ok = AdBlockBridge.nativeInit(sb.toString());
            initialized = ok;
            if (ok) {
                ruleStatsJson = AdBlockBridge.nativeGetRulesStats();
                Log.i(TAG, "Native Brave adblock engine initialized successfully. Stats: " + ruleStatsJson);
            } else {
                Log.w(TAG, "Native adblock initialization returned false");
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to initialize adblock filters from assets", e);
        }
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

        // Check request headers for standard fetch destinations
        Map<String, String> headers = request.getRequestHeaders();
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
            }
        }

        if ("other".equals(reqType)) {
            String lower = urlString.toLowerCase();
            if (lower.contains(".js") || lower.contains("/js/")) {
                reqType = "script";
            } else if (lower.contains(".css")) {
                reqType = "stylesheet";
            } else if (lower.contains(".png") || lower.contains(".jpg") || lower.contains(".webp") || lower.contains(".gif") || lower.contains(".ico")) {
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

        // 2. Never block actual video streaming media manifests or segments
        if (urlString.contains(".m3u8") || urlString.contains(".mpd") || urlString.contains(".ts")) {
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
            return AdBlockDecision.blocked("application/javascript", MOCK_NOOP_JS);
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
     * Injects anti-adblock bypass scriptlets and mock telemetry objects early before page scripts execute.
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

            String js = "(function() {\n" +
                    "  try {\n" +
                    "    window.canRunAds = true;\n" +
                    "    window.isAdBlockActive = false;\n" +
                    "    window.adblock = false;\n" +
                    "    window.google_ad_client = null;\n" +
                    "    window.google_ad_status = 1;\n" +
                    "    window.adsbygoogle = window.adsbygoogle || [];\n" +
                    "    window.adsbygoogle.loaded = true;\n" +
                    "    // Overwrite popup triggers\n" +
                    "    var _origOpen = window.open;\n" +
                    "    window.open = function(u) {\n" +
                    "      if (u && typeof u === 'string') {\n" +
                    "        var l = u.toLowerCase();\n" +
                    "        if (l.indexOf('popads') !== -1 || l.indexOf('adsterra') !== -1 || l.indexOf('exoclick') !== -1 || l.indexOf('propeller') !== -1 || l.indexOf('clickadu') !== -1) {\n" +
                    "          console.log('[BUJUU AdBlock] Blocked popup: ' + u);\n" +
                    "          return null;\n" +
                    "        }\n" +
                    "      }\n" +
                    "      return _origOpen ? _origOpen.apply(this, arguments) : null;\n" +
                    "    };\n" +
                    (nativeScriptlet != null && !nativeScriptlet.isEmpty() ? nativeScriptlet + "\n" : "") +
                    "  } catch(e) {}\n" +
                    "})();";

            webView.evaluateJavascript(js, null);
        } catch (Throwable t) {
            Log.w(TAG, "Failed to inject early scriptlets: " + t.getMessage());
        }
    }

    /**
     * Injects cosmetic DOM hiding CSS including native Brave cosmetic selectors and starts continuous client MutationObserver.
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

            String baseSelectors = ".ad, .ads, .ad-banner, .advertisement, [id^=\"ad_\"], [class*=\"sponsored\"], [class*=\"banner-ad\"], [id*=\"google_ads\"], iframe[src*=\"doubleclick\"], iframe[src*=\"adsterra\"], iframe[src*=\"popads\"], iframe[src*=\"exoclick\"], iframe[src*=\"monetag\"], .video-ad-overlay, .vpaid-ad, .preroll-ad, [class*=\"ad-container\"], [id*=\"ad-container\"], [class*=\"popup-ad\"], .floating-ad";
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
                    "    // Continuous MutationObserver to eliminate dynamically injected ad tags\n" +
                    "    var obs = new MutationObserver(function(muts) {\n" +
                    "      for (var i = 0; i < muts.length; i++) {\n" +
                    "        var added = muts[i].addedNodes;\n" +
                    "        for (var j = 0; j < added.length; j++) {\n" +
                    "          var n = added[j];\n" +
                    "          if (n.nodeType === 1) {\n" +
                    "            var tag = n.tagName ? n.tagName.toLowerCase() : '';\n" +
                    "            if (tag === 'script' || tag === 'iframe') {\n" +
                    "              var src = n.src ? n.src.toLowerCase() : '';\n" +
                    "              if (src.indexOf('popads') !== -1 || src.indexOf('adsterra') !== -1 || src.indexOf('exoclick') !== -1 || src.indexOf('propeller') !== -1 || src.indexOf('monetag') !== -1) {\n" +
                    "                n.remove();\n" +
                    "                continue;\n" +
                    "              }\n" +
                    "            }\n" +
                    "            if (n.matches && n.matches('.ad, .ads, [class*=\"sponsored\"], [id^=\"ad_\"], .video-ad-overlay, [class*=\"banner-ad\"]')) {\n" +
                    "              n.style.setProperty('display', 'none', 'important');\n" +
                    "            }\n" +
                    "          }\n" +
                    "        }\n" +
                    "      }\n" +
                    "    });\n" +
                    "    obs.observe(document.documentElement, { childList: true, subtree: true });\n" +
                    "  } catch(e) {}\n" +
                    "})();";

            webView.evaluateJavascript(js, null);
        } catch (Throwable t) {
            Log.w(TAG, "Failed to inject cosmetic hiding: " + t.getMessage());
        }
    }
}
