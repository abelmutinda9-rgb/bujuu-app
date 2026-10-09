import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.bujuu.tv",
  appName: "BUJUU",
  webDir: "native-web",
  backgroundColor: "#000000",
  server: {
    url: "https://lynnn.lovable.app",
    androidScheme: "https",
    cleartext: false,
    allowNavigation: [
      "lynnn.lovable.app",
      "*.lovable.app",
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
