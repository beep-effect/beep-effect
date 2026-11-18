import * as Effect from "effect/Effect";

// Deliberate: an Effect built and never run. Plain TypeScript accepts it; the Effect build reports
// `floatingEffect`, at error severity in the monorepo's rule map.
Effect.log("built, never run");
