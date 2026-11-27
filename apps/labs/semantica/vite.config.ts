import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { appViteConfig } from "../../../vite.shared.ts";

export default defineConfig({
  ...appViteConfig(import.meta.url),

  // Keep the case-colliding Effect schema barrel out of dependency pre-bundling.
  optimizeDeps: { exclude: ["effect/schema"] },
  plugins: [react()],
});
