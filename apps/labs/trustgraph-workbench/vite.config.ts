import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
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
