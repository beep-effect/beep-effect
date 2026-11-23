#!/usr/bin/env bun
/**
 * Writes or checks repo-cli's generated pool caps
 * (`packages/tooling/tool/cli/src/commands/Ci/FleetPoolCaps.generated.ts`)
 * from the production configuration in `src/Config.ts`.
 *
 * - `--write` renders the module and writes it.
 * - With no flag it checks, and exits non-zero when the committed module differs.
 *
 * Run it from the repository root after changing a pool's cap or label.
 *
 * @internal
 * @since 0.0.0
 */
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as BunServices from "@effect/platform-bun/BunServices";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { fleetPoolCapsGeneratedPath, productionFleetPoolCapsModule } from "./src/FleetPoolCaps.ts";

const sync = Command.make(
  "fleet-pool-caps",
  {
    write: Flag.Boolean("write").pipe(Flag.withDefault(false), Flag.withDescription("Write the generated module")),
  },
  Effect.fn("CiRunners.fleetPoolCapsCli")(function* ({ write }) {
    const fs = yield* FileSystem.FileSystem;
    const rendered = productionFleetPoolCapsModule();
    if (write) {
      yield* fs.writeFileString(fleetPoolCapsGeneratedPath, rendered);
      return yield* Console.log(`wrote ${fleetPoolCapsGeneratedPath}`);
    }
    const committed = yield* fs.readFileString(fleetPoolCapsGeneratedPath);
    if (committed !== rendered) {
      return yield* Effect.fail(
        `${fleetPoolCapsGeneratedPath} is stale; run bun packages/tooling/infra/ci-runners/fleet-pool-caps.ts --write`
      );
    }
    return yield* Console.log(`${fleetPoolCapsGeneratedPath} is current`);
  })
).pipe(Command.withDescription("Write or check repo-cli's generated runner pool caps."));

Command.run(sync, { version: "0.0.0" }).pipe(Effect.provide(BunServices.layer), BunRuntime.runMain);
