import { AlchemyPostgresConfig, AlchemyPostgresPlatform } from "@beep/alchemy-postgres";
import { PgliteTestLayer } from "@beep/pglite/Pglite.test-layer";
import * as Layer from "effect/Layer";
import { scenarios } from "./scenarios.ts";

scenarios({
  name: "Postgres Platform / PGlite",
  platform: AlchemyPostgresPlatform.layer(AlchemyPostgresConfig.make({ pollMillis: 10 })).pipe(
    Layer.provide(PgliteTestLayer)
  ),
});
