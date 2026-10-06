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

  it.effect("adopt rewrites an existing manifest and keeps a timestamped backup", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const home = yield* fs.makeTempDirectoryScoped({ prefix: "models-adopt-" });
      const manifestPath = path.join(home, "config", "models.yaml");
      yield* fs.makeDirectory(path.dirname(manifestPath), { recursive: true });
      yield* fs.writeFileString(manifestPath, "version: beep-models/v1\nbindings: []\ntargets: []\nsuperseded: []\n");

      yield* runModelsCommand(["init", "--adopt", "--home", home, "--repo", home, "--manifest", manifestPath]);

      const rewritten = yield* fs.readFileString(manifestPath);
      expect(rewritten).toContain("gpt-6.1-sol");
      const siblings = yield* fs.readDirectory(path.dirname(manifestPath));
      const backups = A.filter(siblings, Str.startsWith("models.yaml.bak-"));
      expect(backups).toHaveLength(1);
      expect(yield* fs.readFileString(path.join(path.dirname(manifestPath), backups[0]!))).toContain("bindings: []");
      const lines = A.filter(yield* TestConsole.logLines, P.isString);
      expect(A.some(lines, Str.startsWith("models: adopted the seed into"))).toBe(true);
    }).pipe(Effect.scoped)
  );

  it.effect("repeated adoptions keep distinct backups and leave no temporary files", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const home = yield* fs.makeTempDirectoryScoped({ prefix: "models-adopt-twice-" });
      const manifestPath = path.join(home, "config", "models.yaml");
      yield* fs.makeDirectory(path.dirname(manifestPath), { recursive: true });
      yield* fs.writeFileString(manifestPath, "version: beep-models/v1\nbindings: []\ntargets: []\nsuperseded: []\n");
      const args = ["init", "--adopt", "--home", home, "--repo", home, "--manifest", manifestPath];

      // Both runs read the same pinned TestClock instant, so the timestamp
      // alone would collide; the random suffix must keep both backups.
      yield* runModelsCommand(args);
      yield* runModelsCommand(args);

      const siblings = yield* fs.readDirectory(path.dirname(manifestPath));
      expect(A.filter(siblings, Str.startsWith("models.yaml.bak-"))).toHaveLength(2);
      expect(A.filter(siblings, Str.startsWith("models.yaml.tmp-"))).toHaveLength(0);
      expect(yield* fs.readFileString(manifestPath)).toContain("gpt-6.1-sol");
    }).pipe(Effect.scoped)
  );

  it.effect("adopt on an empty slot behaves like init", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const home = yield* fs.makeTempDirectoryScoped({ prefix: "models-adopt-fresh-" });
      const manifestPath = path.join(home, "config", "models.yaml");

      yield* runModelsCommand(["init", "--adopt", "--home", home, "--repo", home, "--manifest", manifestPath]);

      expect(yield* fs.exists(manifestPath)).toBe(true);
      const siblings = yield* fs.readDirectory(path.dirname(manifestPath));
      expect(A.filter(siblings, Str.startsWith("models.yaml.bak-"))).toHaveLength(0);
      const lines = A.filter(yield* TestConsole.logLines, P.isString);
      expect(A.some(lines, Str.startsWith("models: seeded"))).toBe(true);
    }).pipe(Effect.scoped)
  );
});
