import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Migrations from "@proto/tooling/Migrations";
import * as Effect from "effect/Effect";
import * as Path from "effect/Path";

// `bun scripts/migrations.ts [--name=<name>]` generates the next migration from src/Party.schema.ts
// into migrations/ and rewrites src/Party.migrations.ts; `--check` fails when they disagree.
Effect.gen(function* () {
  const path = yield* Path.Path;
  const at = (file: string) => path.fromFileUrl(new URL(file, import.meta.url));
  return yield* Migrations.main(process.argv.slice(2), {
    schema: yield* at("../src/Party.schema.ts"),
    out: yield* at("../migrations"),
    module: yield* at("../src/Party.migrations.ts"),
    exportName: "PartyMigrations",
    command: "bun run --cwd party/host migrations",
  });
}).pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
