package app.bujuu.tv.adblock;

import android.content.Context;
import android.net.Uri;
import android.util.Log;
import android.webkit.WebResourceRequest;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

public class AdBlockEngine {
    private static final String TAG = "BUJUU_AdBlockEngine";
    private static volatile AdBlockEngine instance;
    private boolean initialized = false;

    // Hard allowlist for critical video streaming, auth and metadata providers
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
            "gstatic.com"
    ));

    // Fallback domain blacklist if native library is pending or running in basic emulator
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
            "outbrain.com"
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
            Log.w(TAG, "Native library not loaded; using fallback domain rules");
            initialized = true;
            return;
        }

        try {
            InputStream is = context.getAssets().open("adblock-filters.txt");
            BufferedReader reader = new BufferedReader(new InputStreamReader(is));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line).append("\n");
            }
            reader.close();

            boolean ok = AdBlockBridge.nativeInit(sb.toString());
            Log.i(TAG, "Native Brave adblock engine initialized: " + ok);
            initialized = true;
        } catch (Exception e) {
            Log.e(TAG, "Failed to initialize adblock filters from assets", e);
        }
    }

    public boolean shouldBlock(WebResourceRequest request) {
        if (request == null) return false;
        Uri uri = request.getUrl();
        if (uri == null) return false;

        String host = uri.getHost();
        if (host == null) return false;
        host = host.toLowerCase();

        // 1. Check Allowlist: never block critical playback/auth/metadata
        for (String allowed : ALLOWED_HOST_SUFFIXES) {
            if (host.equals(allowed) || host.endsWith("." + allowed)) {
                return false;
            }
        }

        String urlString = uri.toString();
        // Allow video streaming media manifests and segments
        if (urlString.contains(".m3u8") || urlString.contains(".mpd") || urlString.contains(".ts")) {
            return false;
        }

        // 2. Query Genuine Brave adblock-rust engine if native library is loaded
        if (AdBlockBridge.isLibraryLoaded() && initialized) {
            try {
                String sourceUrl = "https://app.bujuu.tv";
                String reqType = "other";
                boolean blocked = AdBlockBridge.nativeShouldBlock(urlString, sourceUrl, reqType);
                if (blocked) {
                    Log.d(TAG, "Blocked ad request: " + urlString);
                    return true;
                }
            } catch (Throwable t) {
                Log.w(TAG, "Native adblock check failed: " + t.getMessage());
            }
        }

        // 3. Fallback host blocking check
        for (String blockedHost : FALLBACK_BLOCKED_HOST_SUFFIXES) {
            if (host.equals(blockedHost) || host.endsWith("." + blockedHost)) {
                Log.d(TAG, "Fallback blocked ad request: " + urlString);
                return true;
            }
        }

        return false;
    }
}
