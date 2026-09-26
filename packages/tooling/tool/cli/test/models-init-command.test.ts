import { modelsCommand } from "@beep/repo-cli/commands/Models";
import { A } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import * as NodeCrypto from "@effect/platform-node-shared/NodeCrypto";
import { expect, layer } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";
import { Command } from "effect/cli";
import { FetchHttpClient } from "effect/http";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";

// `init` is the one subcommand that touches no upstream catalog: it seeds the
// routing manifest from the bundled defaults, so the whole command group can be
// driven end to end against a temporary home without a network.
const runModelsCommand = Command.runWith(modelsCommand, { version: "0.0.0" });

const testLayer = Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, FetchHttpClient.layer, TestConsole.layer);

layer(testLayer)("models init command", (it) => {
  it.effect("seeds the routing manifest under the explicit home", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const home = yield* fs.makeTempDirectoryScoped({ prefix: "models-init-" });
      const manifestPath = path.join(home, "config", "models.yaml");

      yield* runModelsCommand(["init", "--home", home, "--repo", home, "--manifest", manifestPath]);

      expect(yield* fs.exists(manifestPath)).toBe(true);
      const lines = A.filter(yield* TestConsole.logLines, P.isString);
      expect(A.some(lines, Str.startsWith("models: seeded"))).toBe(true);
    }).pipe(Effect.scoped)
  );
});
