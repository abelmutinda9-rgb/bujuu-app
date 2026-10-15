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
      "*.lovable.app",
      "*.supabase.co",
      "*.vercel.app",
      "lynnn-phi.vercel.app",
      "bujuu-app.vercel.app",
      "accounts.google.com",
      "*.google.com",
      "*.googleusercontent.com",
      "*.payhero.co.ke",
      "payhero.co.ke",
      "backend.payhero.co.ke"
    ]
  },
  android: { 
    allowMixedContent: false 
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    GoogleAuth: {
      scopes: ["profile", "email"],
      serverClientId: "857102692656-bqtjjvt1bg70snohfadspgcpdim24v82.apps.googleusercontent.com",
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;
