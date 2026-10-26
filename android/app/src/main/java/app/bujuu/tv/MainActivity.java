package app.bujuu.tv;

import android.app.DownloadManager;
import android.content.Context;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.os.Message;
import android.util.Log;
import android.view.KeyEvent;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.URLUtil;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.widget.Toast;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

import java.io.ByteArrayInputStream;

import app.bujuu.tv.adblock.AdBlockEngine;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "BUJUU_MainActivity";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Initialize Native Brave AdBlock Engine with official filter rules
        AdBlockEngine.getInstance().initialize(getApplicationContext());

        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();

            // Set native download listener for Android WebView to capture Server 4 and provider downloads
            webView.setDownloadListener(new DownloadListener() {
                @Override
                public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimetype, long contentLength) {
                    Log.i(TAG, "WebView onDownloadStart triggered for: " + url);
                    startNativeDownload(url, userAgent, contentDisposition, mimetype, webView.getUrl());
                }
            });

            // Suppress unwanted ad popup windows
            webView.setWebChromeClient(new WebChromeClient() {
                @Override
                public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                    Log.i(TAG, "Suppressed popup window creation (isUserGesture=" + isUserGesture + ")");
                    return false; // Do not open popup windows
                }
            });

            // Intercept WebView network requests, redirects, and dom lifecycle to block ads natively
            getBridge().setWebViewClient(new BridgeWebViewClient(getBridge()) {
                @Override
                public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                    AdBlockEngine.AdBlockDecision decision = AdBlockEngine.getInstance().evaluateRequest(request);
                    if (decision.isBlocked) {
                        Log.d(TAG, "Suppressed ad resource: " + request.getUrl() + " [" + decision.mimeType + "]");
                        return new WebResourceResponse(decision.mimeType, "UTF-8", new ByteArrayInputStream(decision.data));
                    }
                    return super.shouldInterceptRequest(view, request);
                }

                @Override
                public void onPageStarted(WebView view, String url, Bitmap favicon) {
                    super.onPageStarted(view, url, favicon);
                    AdBlockEngine.getInstance().injectEarlyScriptlets(view, url);
                }

                @Override
                public void onPageFinished(WebView view, String url) {
                    super.onPageFinished(view, url);
                    AdBlockEngine.getInstance().injectCosmeticHiding(view, url);
                }

                @Override
                public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    if (request == null || request.getUrl() == null) {
                        return super.shouldOverrideUrlLoading(view, request);
                    }
                    Uri uri = request.getUrl();
                    String url = uri.toString();
                    String scheme = uri.getScheme();
                    String host = uri.getHost();

                    // Block external non-web schemes triggered by ad networks (e.g. market://, intent://)
                    if (scheme != null && !scheme.equalsIgnoreCase("http") && !scheme.equalsIgnoreCase("https") && !scheme.equalsIgnoreCase("capacitor")) {
                        Log.w(TAG, "Blocked external non-web scheme attempt from ad: " + url);
                        return true;
                    }

                    // Check for direct media downloads (.mkv, .mp4, etc.)
                    String lower = url.toLowerCase();
                    if (lower.endsWith(".mkv") || lower.endsWith(".mp4") || lower.contains("/direct/movie/") || lower.contains("/download-link/")) {
                        Log.i(TAG, "Intercepted direct media download URL: " + url);
                        String currentWebUrl = view != null ? view.getUrl() : null;
                        startNativeDownload(url, null, null, lower.contains(".mp4") ? "video/mp4" : "video/x-matroska", currentWebUrl);
                        return true;
                    }

                    // Check for ad/popup redirects
                    if (AdBlockEngine.getInstance().shouldBlock(url)) {
                        Log.i(TAG, "Blocked unwanted ad/popup redirect navigation: " + url);
                        return true; // Consume and suppress navigation
                    }

                    // STRICT TOP-LEVEL APP NAVIGATION LOCK:
                    // If a subframe or script attempts to navigate the top-level window (isForMainFrame),
                    // only allow navigations to trusted internal app endpoints or legitimate auth/payment flows.
                    if (request.isForMainFrame()) {
                        if (host != null) {
                            String lowerHost = host.toLowerCase();
                            boolean isTrustedMainHost = lowerHost.equals("localhost")
                                    || lowerHost.equals("127.0.0.1")
                                    || lowerHost.equals("app.bujuu.tv")
                                    || lowerHost.endsWith(".bujuu.tv")
                                    || lowerHost.equals("accounts.google.com")
                                    || lowerHost.endsWith(".google.com")
                                    || lowerHost.endsWith(".lovable.app")
                                    || lowerHost.endsWith(".lovable.cloud")
                                    || lowerHost.endsWith(".vercel.app")
                                    || lowerHost.endsWith(".payhero.co.ke");

                            if (!isTrustedMainHost) {
                                Log.w(TAG, "Blocked unauthorized top-level window hijack to: " + url);
                                return true; // Suppress top-level hijack
                            }
                        }
                    }

                    return super.shouldOverrideUrlLoading(view, request);
                }
            });
        }
    }

    /**
     * Enhanced TV Remote Control and D-pad Interception:
     * Forwards Android TV Back, OK/Center, and Directional buttons cleanly into the WebView.
     */
    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (event.getAction() == KeyEvent.ACTION_DOWN) {
            int keyCode = event.getKeyCode();
            Log.d(TAG, "TV Remote KeyEvent: " + keyCode);

            // Handle Back key on Android TV / Fire TV
            if (keyCode == KeyEvent.KEYCODE_BACK || keyCode == KeyEvent.KEYCODE_ESCAPE || keyCode == KeyEvent.KEYCODE_BUTTON_B) {
                if (getBridge() != null && getBridge().getWebView() != null) {
                    WebView webView = getBridge().getWebView();
                    // Dispatch a custom synthetic TV back event to the web app
                    String js = "window.dispatchEvent(new CustomEvent('bujuu-tv-back'));";
                    webView.evaluateJavascript(js, null);
                }
            }

            // Handle OK / Center click on Android TV remote
            if (keyCode == KeyEvent.KEYCODE_DPAD_CENTER || keyCode == KeyEvent.KEYCODE_ENTER || keyCode == KeyEvent.KEYCODE_NUMPAD_ENTER) {
                if (getBridge() != null && getBridge().getWebView() != null) {
                    WebView webView = getBridge().getWebView();
                    String js = "(function(){"
                            + "var active = document.activeElement;"
                            + "if (active && typeof active.click === 'function') {"
                            + "  active.click();"
                            + "}"
                            + "})();";
                    webView.evaluateJavascript(js, null);
                }
            }
        }
        return super.dispatchKeyEvent(event);
    }

    private void startNativeDownload(String url, String userAgent, String contentDisposition, String mimetype, String referer) {
        if (url == null || url.isEmpty()) return;

        runOnUiThread(() -> {
            try {
                Uri uri = Uri.parse(url);
                DownloadManager.Request request = new DownloadManager.Request(uri);

                String filename = URLUtil.guessFileName(url, contentDisposition, mimetype);
                if (filename == null || filename.isEmpty() || filename.equals("downloadfile.bin")) {
                    filename = "bujuu-video.mkv";
                }

                // Set standard Android mobile User-Agent if none provided
                String effectiveUa = userAgent;
                if (effectiveUa == null || effectiveUa.isEmpty()) {
                    effectiveUa = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
                }
                request.addRequestHeader("User-Agent", effectiveUa);

                // Pass provider Referer header to prevent HTTP 403 Forbidden on stream CDNs/Cloudflare workers
                String effectiveReferer = referer;
                if (effectiveReferer == null || effectiveReferer.isEmpty() || effectiveReferer.contains("localhost")) {
                    if (url.contains("workers.dev") || url.contains("vidvault")) {
                        effectiveReferer = "https://vidvault.ru/";
                    } else if (url.contains("vidfast")) {
                        effectiveReferer = "https://vidfast.pro/";
                    } else if (url.contains("vidy")) {
                        effectiveReferer = "https://vidy.st/";
                    }
                }
                if (effectiveReferer != null && !effectiveReferer.isEmpty()) {
                    request.addRequestHeader("Referer", effectiveReferer);
                    Log.i(TAG, "Added Referer header to native download: " + effectiveReferer);
                }

                // Preserve session cookies if any
                String cookies = CookieManager.getInstance().getCookie(url);
                if (cookies != null && !cookies.isEmpty()) {
                    request.addRequestHeader("Cookie", cookies);
                }

                request.setTitle(filename);
                request.setDescription("Downloading movie from BUJUU");
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename);

                DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                if (dm != null) {
                    dm.enqueue(request);
                    Toast.makeText(MainActivity.this, "Download started: " + filename, Toast.LENGTH_LONG).show();
                    Log.i(TAG, "Successfully enqueued native download: " + filename);
                } else {
                    Toast.makeText(MainActivity.this, "Android Download Manager unavailable", Toast.LENGTH_SHORT).show();
                }
            } catch (Exception e) {
                Log.e(TAG, "Failed to start native download for " + url, e);
                Toast.makeText(MainActivity.this, "Download failed: " + e.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }
}
