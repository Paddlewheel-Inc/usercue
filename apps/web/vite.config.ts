import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const STUB_ID = "\0usercue-server-stub";

function stubServerPackage(): Plugin {
  return {
    name: "stub-usercue-server",
    enforce: "pre",
    resolveId(id) {
      if (id === "@usercue/server") return STUB_ID;
    },
    load(id) {
      if (id === STUB_ID) return "export {}";
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const publicHost = env.PUBLIC_URL ? new URL(env.PUBLIC_URL).hostname : undefined;
  const apiTarget = env.API_URL ?? "http://localhost:3000";

  const proxy = { target: apiTarget, xfwd: true };

  return {
    plugins: [
      stubServerPackage(),
      react(),
      tailwindcss(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: [
          "apple-touch-icon.png",
          "pwa-192x192.png",
          "pwa-512x512.png",
          "maskable-512x512.png",
        ],
        manifest: {
          name: "UserCue",
          short_name: "UserCue",
          description:
            "Collect feedback, prioritize with your team, and keep customers in the loop from one place.",
          start_url: "/",
          scope: "/",
          display: "standalone",
          background_color: "#f3efe8",
          theme_color: "#080706",
          lang: "en",
          icons: [
            { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
            { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
            {
              src: "/maskable-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,svg,woff2}"],
          navigateFallbackDenylist: [/^\/api\//, /^\/uploads\//],
        },
        devOptions: {
          enabled: true,
          suppressWarnings: true,
        },
      }),
    ],
    cacheDir: "../../node_modules/.vite/web",
    clearScreen: false,
    server: {
      host: true,
      allowedHosts: publicHost ? [publicHost] : [],
      port: 5173,
      strictPort: true,
      watch: {
        usePolling: env.VITE_USE_POLLING === "true",
      },
      proxy: {
        "/api": proxy,
        "/uploads": proxy,
      },
    },
    build: { target: "es2022" },
  };
});
