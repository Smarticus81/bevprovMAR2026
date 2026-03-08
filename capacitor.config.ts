import type { CapacitorConfig } from "@capacitor/cli";

// Set your dev server IP here when running locally (e.g. "http://192.168.1.100:5000")
// Set to undefined for production builds that use bundled web assets
const DEV_SERVER_URL: string | undefined = process.env.CAPACITOR_SERVER_URL || undefined;

const config: CapacitorConfig = {
  appId: "com.bevpro.app",
  appName: "BevPro",
  webDir: "dist/public",
  server: {
    androidScheme: "https",
    iosScheme: "https",
    // Point to your live dev server for hot-reload during development
    ...(DEV_SERVER_URL ? { url: DEV_SERVER_URL, cleartext: true } : {}),
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#000000",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#000000",
    },
    Microphone: {
      permissions: {
        microphone: "BevPro needs microphone access for voice agent interactions",
      },
    },
  },
  ios: {
    contentInset: "always",
    allowsLinkPreview: false,
    backgroundColor: "#000000",
    preferredContentMode: "mobile",
  },
};

export default config;
