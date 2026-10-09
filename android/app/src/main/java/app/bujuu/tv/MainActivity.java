package app.bujuu.tv;

import android.os.Bundle;
import android.util.Log;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import java.io.ByteArrayInputStream;
import app.bujuu.tv.adblock.AdBlockEngine;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "BUJUU_MainActivity";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Initialize Native Brave AdBlock Engine
        AdBlockEngine.getInstance().initialize(getApplicationContext());

        // Intercept WebView network requests to block ads & popups natively
        if (getBridge() != null) {
            getBridge().setWebViewClient(new BridgeWebViewClient(getBridge()) {
                @Override
                public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                    if (AdBlockEngine.getInstance().shouldBlock(request)) {
                        Log.d(TAG, "Suppressed ad request in WebView: " + request.getUrl());
                        return new WebResourceResponse("text/plain", "UTF-8", new ByteArrayInputStream(new byte[0]));
                    }
                    return super.shouldInterceptRequest(view, request);
                }
            });
        }
    }
}
