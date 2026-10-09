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
};

export default config;
