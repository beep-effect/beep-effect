import { fileURLToPath } from "node:url";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Alchemy's `Cloudflare.Website.Vite` appends its own Cloudflare plugin at
// deploy and `alchemy dev` time; never add `@cloudflare/vite-plugin` here.
export default defineConfig({
  clearScreen: false,
  plugins: [
    // Generated route tree lives outside src/ so the JSDoc inventory skips it.
    tanstackStart({ router: { generatedRouteTree: "../generated/routeTree.gen.ts" } }),
    react(),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    // Port and strictPort come from the portless-wrapped `dev` script
    // (`--port "${PORT:-5173}" --strictPort`): portless assigns PORT for the
    // named route, and the 5173 fallback keeps the PORTLESS=0 diagnostic
    // bypass usable.
    host: "127.0.0.1",
  },
});
