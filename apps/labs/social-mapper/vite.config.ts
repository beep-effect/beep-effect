import react from "@vitejs/plugin-react";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import { defineConfig } from "vite";
import { appViteConfig } from "../../../vite.shared.ts";

const shared = appViteConfig(import.meta.url);

const library = Effect.runSync(
  Config.all({
    port: Config.Port("SOCIAL_MAPPER_PORT").pipe(Config.withDefault(3941)),
    token: Config.Redacted("SOCIAL_MAPPER_TOKEN").pipe(Config.withDefault(Redacted.make(""))),
  }).pipe(Effect.orDie)
);

export default defineConfig({
  ...shared,
  optimizeDeps: { exclude: ["effect/schema"] },
  plugins: [react()],
  server: {
    ...shared.server,
    proxy: {
      "/rpc": {
        target: `http://127.0.0.1:${library.port}`,
        headers: { authorization: `Bearer ${Redacted.value(library.token)}` },
      },
    },
  },
});
