import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.bujuu.tv",
  appName: "BUJUU",
  webDir: "dist/client",
  backgroundColor: "#000000",
  server: {
    androidScheme: "https",
    hostname: "localhost",
    cleartext: false,
    allowNavigation: [
      "*.lovable.cloud",
      "*.supabase.co",
      "accounts.google.com",
      "*.google.com",
      "*.googleusercontent.com"
    ]
  },
  android: { 
    allowMixedContent: false 
  },
  plugins: {
    GoogleAuth: {
      scopes: ["profile", "email"],
      serverClientId: "857102692656-bqtjjvt1bg70snohfadspgcpdim24v82.apps.googleusercontent.com",
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;
