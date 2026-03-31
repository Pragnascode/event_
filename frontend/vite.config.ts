import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: {
        enabled: true,
      },
      manifest: {
        name: "Event Alerts",
        short_name: "Event Alerts",
        theme_color: "#0b0b10",
        background_color: "#0b0b10",
        display: "standalone",
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\/*/,
            handler: "NetworkFirst",
          },
        ],
      },
    }),
  ],
});
