package app.bujuu.tv;

import android.app.DownloadManager;
import android.content.Context;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.util.Log;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.URLUtil;
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
                    startNativeDownload(url, userAgent, contentDisposition, mimetype);
                }
            });

            // Intercept WebView network requests and redirects to block ads & popups natively
            getBridge().setWebViewClient(new BridgeWebViewClient(getBridge()) {
                @Override
                public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                    if (AdBlockEngine.getInstance().shouldBlock(request)) {
                        Log.d(TAG, "Suppressed ad resource request: " + request.getUrl());
                        return new WebResourceResponse("text/plain", "UTF-8", new ByteArrayInputStream(new byte[0]));
                    }
                    return super.shouldInterceptRequest(view, request);
                }

                @Override
                public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    if (request == null || request.getUrl() == null) {
                        return super.shouldOverrideUrlLoading(view, request);
                    }
                    String url = request.getUrl().toString();

                    // Check for ad/popup redirects
                    if (AdBlockEngine.getInstance().shouldBlock(url)) {
                        Log.i(TAG, "Blocked unwanted ad/popup redirect navigation: " + url);
                        return true; // Consume and block navigation
                    }

                    // Check for direct media downloads (.mkv, .mp4, etc.)
                    String lower = url.toLowerCase();
                    if (lower.endsWith(".mkv") || lower.endsWith(".mp4") || lower.contains("/direct/movie/") || lower.contains("/download-link/")) {
                        Log.i(TAG, "Intercepted direct media download URL: " + url);
                        startNativeDownload(url, null, null, lower.endsWith(".mp4") ? "video/mp4" : "video/x-matroska");
                        return true;
                    }

                    return super.shouldOverrideUrlLoading(view, request);
                }
            });
        }
    }

    private void startNativeDownload(String url, String userAgent, String contentDisposition, String mimetype) {
        if (url == null || url.isEmpty()) return;

        runOnUiThread(() -> {
            try {
                Uri uri = Uri.parse(url);
                DownloadManager.Request request = new DownloadManager.Request(uri);

                String filename = URLUtil.guessFileName(url, contentDisposition, mimetype);
                if (filename == null || filename.isEmpty() || filename.equals("downloadfile.bin")) {
                    filename = "bujuu-video.mkv";
                }

                // Preserve session cookies if any
                String cookies = CookieManager.getInstance().getCookie(url);
                if (cookies != null && !cookies.isEmpty()) {
                    request.addRequestHeader("Cookie", cookies);
                }
                if (userAgent != null && !userAgent.isEmpty()) {
                    request.addRequestHeader("User-Agent", userAgent);
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
