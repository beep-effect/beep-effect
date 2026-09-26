import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // effect ships both effect/Schema and the promoted effect/schema barrel; their
  // pre-bundle entry names differ only by case and rolldown dedupes one, which
  // breaks Vite's optimizer. Serve the barrel unbundled (plain ESM).
  optimizeDeps: { exclude: ["effect/schema"] },
  clearScreen: false,
  plugins: [react()],
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
