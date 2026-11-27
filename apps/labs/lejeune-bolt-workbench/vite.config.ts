import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { appViteConfig } from "../../../vite.shared.ts";

const caseCollidingSchemaBarrel = "effect/schema";

export default defineConfig({
  ...appViteConfig(import.meta.url),
  optimizeDeps: { exclude: [caseCollidingSchemaBarrel] },
  plugins: [react()],
});
