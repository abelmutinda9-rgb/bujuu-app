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

import android.content.pm.ActivityInfo;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

import android.content.Intent;
import android.os.Build;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import androidx.core.content.FileProvider;
import java.io.File;
import java.security.MessageDigest;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "BUJUU_MainActivity";
    private View customView;
    private WebChromeClient.CustomViewCallback customViewCallback;
    private FrameLayout fullscreenContainer;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Enable edge-to-edge immersive full-screen display
        applyEdgeToEdgeImmersive();

        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            webView.addJavascriptInterface(new BujuuNativeInterface(), "BujuuNative");

            // Native download listener for Android WebView
            webView.setDownloadListener(new DownloadListener() {
                @Override
                public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimetype, long contentLength) {
                    Log.i(TAG, "WebView onDownloadStart triggered for: " + url);
                    startNativeDownload(url, userAgent, contentDisposition, mimetype, webView.getUrl());
                }
            });

            // WebChromeClient with native HTML5 custom view fullscreen
            webView.setWebChromeClient(new WebChromeClient() {
                @Override
                public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                    return false; // Suppress popup windows
                }

                @Override
                public void onShowCustomView(View view, CustomViewCallback callback) {
                    Log.i(TAG, "WebChromeClient: onShowCustomView triggered");
                    if (customView != null) {
                        callback.onCustomViewHidden();
                        return;
                    }

                    customView = view;
                    customViewCallback = callback;

                    runOnUiThread(() -> {
                        try {
                            webView.setVisibility(View.GONE);

                            if (fullscreenContainer == null) {
                                fullscreenContainer = new FrameLayout(MainActivity.this);
                                fullscreenContainer.setBackgroundColor(0xFF000000);
                                ViewGroup decor = (ViewGroup) getWindow().getDecorView();
                                decor.addView(fullscreenContainer, new ViewGroup.LayoutParams(
                                        ViewGroup.LayoutParams.MATCH_PARENT,
                                        ViewGroup.LayoutParams.MATCH_PARENT
                                ));
                            }

                            fullscreenContainer.removeAllViews();
                            fullscreenContainer.addView(view, new FrameLayout.LayoutParams(
                                    FrameLayout.LayoutParams.MATCH_PARENT,
                                    FrameLayout.LayoutParams.MATCH_PARENT
                            ));
                            fullscreenContainer.setVisibility(View.VISIBLE);

                            // Lock to sensor landscape for full cinematic experience
                            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);

                            applyEdgeToEdgeImmersive();
                        } catch (Exception e) {
                            Log.e(TAG, "Error in onShowCustomView", e);
                        }
                    });
                }

                @Override
                public void onHideCustomView() {
                    Log.i(TAG, "WebChromeClient: onHideCustomView triggered");
                    hideCustomFullscreenView();
                }
            });

            // Clean WebView Client
            getBridge().setWebViewClient(new BridgeWebViewClient(getBridge()) {
                @Override
                public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    if (request == null || request.getUrl() == null) {
                        return super.shouldOverrideUrlLoading(view, request);
                    }
                    Uri uri = request.getUrl();
                    String url = uri.toString();
                    String scheme = uri.getScheme();
                    String host = uri.getHost();

                    // Block external non-web schemes (e.g. market://, intent://)
                    if (scheme != null && !scheme.equalsIgnoreCase("http") && !scheme.equalsIgnoreCase("https") && !scheme.equalsIgnoreCase("capacitor")) {
                        Log.w(TAG, "Blocked external scheme: " + url);
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

                    // Top-level app navigation guard
                    if (request.isForMainFrame()) {
                        if (host != null) {
                            String lowerHost = host.toLowerCase();
                            boolean isTrustedMainHost = lowerHost.equals("localhost")
                                    || lowerHost.equals("127.0.0.1")
                                    || lowerHost.equals("app.bujuu.tv")
                                    || lowerHost.endsWith(".bujuu.tv")
                                    || lowerHost.endsWith(".lovable.app")
                                    || lowerHost.endsWith(".lovable.cloud");

                            if (!isTrustedMainHost) {
                                Log.w(TAG, "Prevented unauthorized main frame navigation to: " + url);
                                return true;
                            }
                        }
                    }

                    return super.shouldOverrideUrlLoading(view, request);
                }
            });
        }
    }

    /**
     * TV Remote Control and D-pad Interception:
     * Forwards Android TV Back, OK/Center, and Directional buttons cleanly into the WebView.
     */
    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (event.getAction() == KeyEvent.ACTION_DOWN) {
            int keyCode = event.getKeyCode();

            // Intercept Back / Escape while in custom fullscreen view
            if (customView != null) {
                if (keyCode == KeyEvent.KEYCODE_BACK 
                    || keyCode == KeyEvent.KEYCODE_ESCAPE 
                    || keyCode == KeyEvent.KEYCODE_BUTTON_B
                    || keyCode == 111
                    || keyCode == 4) {
                    hideCustomFullscreenView();
                    return true;
                }
            }

            // Handle Back / Exit / Escape keys on Android TV / Fire TV
            if (keyCode == KeyEvent.KEYCODE_BACK 
                || keyCode == KeyEvent.KEYCODE_ESCAPE 
                || keyCode == KeyEvent.KEYCODE_BUTTON_B
                || keyCode == KeyEvent.KEYCODE_MEDIA_STOP
                || keyCode == KeyEvent.KEYCODE_CLEAR
                || keyCode == 111
                || keyCode == 4
                || keyCode == 86
                || keyCode == 28
            ) {
                if (getBridge() != null && getBridge().getWebView() != null) {
                    WebView webView = getBridge().getWebView();
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

    public void hideCustomFullscreenView() {
        runOnUiThread(() -> {
            try {
                if (customView == null) return;

                if (fullscreenContainer != null) {
                    fullscreenContainer.removeView(customView);
                    fullscreenContainer.setVisibility(View.GONE);
                }

                if (customViewCallback != null) {
                    customViewCallback.onCustomViewHidden();
                }

                customView = null;
                customViewCallback = null;

                if (getBridge() != null && getBridge().getWebView() != null) {
                    getBridge().getWebView().setVisibility(View.VISIBLE);
                }

                setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
                applyEdgeToEdgeImmersive();
            } catch (Exception e) {
                Log.e(TAG, "Error in hideCustomFullscreenView", e);
            }
        });
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

                String effectiveUa = userAgent;
                if (effectiveUa == null || effectiveUa.isEmpty()) {
                    effectiveUa = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
                }
                request.addRequestHeader("User-Agent", effectiveUa);

                if (referer != null && !referer.isEmpty() && !referer.contains("localhost")) {
                    request.addRequestHeader("Referer", referer);
                }

                String cookies = CookieManager.getInstance().getCookie(url);
                if (cookies != null && !cookies.isEmpty()) {
                    request.addRequestHeader("Cookie", cookies);
                }

                request.setTitle(filename);
                request.setDescription("Downloading title from BUJUU");
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename);

                DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                if (dm != null) {
                    dm.enqueue(request);
                    Toast.makeText(MainActivity.this, "Download started: " + filename, Toast.LENGTH_LONG).show();
                    Log.i(TAG, "Successfully enqueued native download: " + filename);
                } else {
                    Toast.makeText(MainActivity.this, "Download Manager unavailable", Toast.LENGTH_SHORT).show();
                }
            } catch (Exception e) {
                Log.e(TAG, "Failed to start native download for " + url, e);
                Toast.makeText(MainActivity.this, "Download failed: " + e.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    public class BujuuNativeInterface {
        @JavascriptInterface
        public void setOrientationLandscape() {
            runOnUiThread(() -> setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE));
        }

        @JavascriptInterface
        public void setOrientationPortrait() {
            runOnUiThread(() -> setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED));
        }

        @JavascriptInterface
        public void exitFullscreen() {
            hideCustomFullscreenView();
        }

        @JavascriptInterface
        public boolean isCustomFullscreenActive() {
            return customView != null;
        }

        @JavascriptInterface
        public String getDeviceId() {
            try {
                String androidId = Settings.Secure.getString(getContentResolver(), Settings.Secure.ANDROID_ID);
                if (androidId == null) androidId = "";
                String hardware = Build.HARDWARE != null ? Build.HARDWARE : "";
                String fingerprint = Build.FINGERPRINT != null ? Build.FINGERPRINT : "";
                String manufacturer = Build.MANUFACTURER != null ? Build.MANUFACTURER : "";
                String model = Build.MODEL != null ? Build.MODEL : "";
                
                String rawId = "bujuu_" + androidId + "_" + hardware + "_" + manufacturer + "_" + model + "_" + fingerprint;
                MessageDigest digest = MessageDigest.getInstance("SHA-256");
                byte[] hash = digest.digest(rawId.getBytes("UTF-8"));
                StringBuilder hex = new StringBuilder();
                for (byte b : hash) {
                    hex.append(String.format("%02x", b));
                }
                return hex.toString();
            } catch (Exception e) {
                Log.e(TAG, "Failed to get native device ID", e);
                return "";
            }
        }

        @JavascriptInterface
        public int getAppVersionCode() {
            return 14; // v2.5
        }

        @JavascriptInterface
        public String getAppVersionName() {
            return "2.5";
        }

        @JavascriptInterface
        public boolean installApk(String filePath) {
            try {
                File file = new File(filePath);
                if (!file.exists()) {
                    Log.e(TAG, "APK file does not exist: " + filePath);
                    return false;
                }
                Uri apkUri = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".fileprovider", file);
                Intent intent = new Intent(Intent.ACTION_VIEW);
                intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
                intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                startActivity(intent);
                return true;
            } catch (Exception e) {
                Log.e(TAG, "Failed to launch APK installer", e);
                return false;
            }
        }
    }

    private void applyEdgeToEdgeImmersive() {
        runOnUiThread(() -> {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    getWindow().setDecorFitsSystemWindows(false);
                    android.view.WindowInsetsController controller = getWindow().getInsetsController();
                    if (controller != null) {
                        controller.hide(android.view.WindowInsets.Type.statusBars() | android.view.WindowInsets.Type.navigationBars());
                        controller.setSystemBarsBehavior(android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                    }
                } else {
                    getWindow().getDecorView().setSystemUiVisibility(
                        android.view.View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | android.view.View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | android.view.View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | android.view.View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | android.view.View.SYSTEM_UI_FLAG_FULLSCREEN
                        | android.view.View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    );
                }
            } catch (Exception e) {
                Log.w(TAG, "Failed to apply edge-to-edge immersive mode", e);
            }
        });
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            applyEdgeToEdgeImmersive();
        }
    }
}
