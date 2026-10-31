import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Alchemy from "alchemy";
import * as Effect from "effect/Effect";
import { apexHost, wwwHost } from "./src/PublicHosts.ts";

/**
 * Stage that owns the public apex. Every other stage (`live_$USER`,
 * `dev_$USER`) serves from workers.dev only.
 */
const productionStage = "prod";

/**
 * The TanStack Start site. `rootDir` is anchored to this file because the
 * Alchemy CLI resolves relative paths from where it is invoked.
 */
export const Website = Cloudflare.Website.Vite(
  "Website",
  Alchemy.Stack.useSync((stack) => ({
    rootDir: import.meta.dirname,
    ...(stack.stage === productionStage ? { domain: { name: apexHost, redirects: [wwwHost] }, workersDev: false } : {}),
  }))
);

export default Alchemy.Stack(
  "BeepEffectWeb",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const website = yield* Website;

    return {
      url: website.url.as<string>(),
    };
  })
);
