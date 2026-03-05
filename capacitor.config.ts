import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.bevpro.app",
  appName: "BevPro",
  webDir: "dist/public",
  server: {
    androidScheme: "https",
    iosScheme: "https",
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
