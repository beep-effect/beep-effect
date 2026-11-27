import * as NodeURL from "node:url";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const generatedRouteTreeOutsideSrc = "../generated/routeTree.gen.ts";

/**
 * Vite configuration for the TanStack Start site.
 *
 * **Gotchas**
 *
 * Never add `@cloudflare/vite-plugin` here: Alchemy's `Cloudflare.Website.Vite`
 * appends its own Cloudflare plugin at deploy and `alchemy dev` time. Leave
 * `server.port` and `strictPort` unset; the portless-wrapped `dev` script
 * passes them.
 */
export default defineConfig({
  clearScreen: false,
  plugins: [tanstackStart({ router: { generatedRouteTree: generatedRouteTreeOutsideSrc } }), react()],
  resolve: {
    alias: {
      "@": NodeURL.fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: "127.0.0.1",
  },
});
