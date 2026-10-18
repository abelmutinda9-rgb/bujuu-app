# BUJUU Obfuscation, Shrinking, and Anti-Reverse Engineering Rules

# Optimization passes and aggressive optimizations
-optimizationpasses 5
-allowaccessmodification
-repackageclasses 'app.bujuu.tv.obf'

# Obfuscate source file names and strip debugging line numbers
-renamesourcefileattribute ""
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod

# Keep native AdBlock Rust bridge and native methods
-keep class app.bujuu.tv.adblock.AdBlockBridge {
    native <methods>;
    public static boolean isLibraryLoaded();
    public static native boolean nativeInit(java.lang.String);
    public static native java.lang.String nativeGetRulesStats();
    public static native boolean nativeShouldBlock(java.lang.String, java.lang.String, java.lang.String);
    public static native java.lang.String nativeGetRedirect(java.lang.String, java.lang.String, java.lang.String);
    public static native java.lang.String nativeGetCosmeticSelectors(java.lang.String);
    public static native java.lang.String nativeGetScriptlet(java.lang.String);
}
-keep class app.bujuu.tv.adblock.AdBlockEngine { *; }
-keep class app.bujuu.tv.adblock.AdBlockEngine$* { *; }
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep Capacitor Core, Bridge, and Plugins
-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }
-keep class * extends com.getcapacitor.Plugin { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.PluginMethod public *;
}
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep Cordova plugin compatibility
-keep class org.apache.cordova.** { *; }

# Keep Android components & MainActivity
-keep public class app.bujuu.tv.MainActivity { *; }
-keep public class * extends android.app.Activity
-keep public class * extends android.app.Application
-keep public class * extends android.app.Service
-keep public class * extends android.content.BroadcastReceiver
-keep public class * extends android.content.ContentProvider

# Keep AndroidX core & splash screen
-keep class androidx.core.splashscreen.** { *; }
-dontwarn androidx.**

# Keep Google Sign-In Plugin
-keep class com.codetrixstudio.capacitor.GoogleAuth.** { *; }
-keep class com.google.android.gms.auth.api.signin.** { *; }
-keep class com.google.android.gms.common.** { *; }
-dontwarn com.google.android.gms.**

# WebView & Apache
-keepattributes JavascriptInterface
-dontwarn android.webkit.**
-dontwarn org.apache.http.**
