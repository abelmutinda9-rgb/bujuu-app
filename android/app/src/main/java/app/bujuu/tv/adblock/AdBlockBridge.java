package app.bujuu.tv.adblock;

import android.util.Log;

public class AdBlockBridge {
    private static final String TAG = "BUJUU_AdBlockBridge";
    private static boolean isLoaded = false;

    static {
        try {
            System.loadLibrary("bujuu_adblock");
            isLoaded = true;
            Log.i(TAG, "Native bujuu_adblock library successfully loaded");
        } catch (Throwable t) {
            Log.w(TAG, "Could not load native bujuu_adblock library: " + t.getMessage());
            isLoaded = false;
        }
    }

    public static boolean isLibraryLoaded() {
        return isLoaded;
    }

    public static native boolean nativeInit(String rules);

    public static native boolean nativeShouldBlock(String url, String sourceUrl, String requestType);
}
