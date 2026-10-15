import { modelsCommand } from "@beep/repo-cli/commands/Models";
import { A } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import * as NodeCrypto from "@effect/platform-node-shared/NodeCrypto";
import { expect, layer } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";

// `init` is the one subcommand that touches no upstream catalog: it seeds the
// routing manifest from the bundled defaults, so the whole command group can be
// driven end to end against a temporary home without a network.
const runModelsCommand = Command.runWith(modelsCommand, { version: "0.0.0" });

const testLayer = Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, FetchHttpClient.layer);

// Each test gets its own TestConsole: a layer-wide one would carry log lines
// from earlier tests and let a console assertion pass by accident.
const withFreshConsole = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make));

layer(testLayer, { timeout: "30 seconds" })("models init command", (it) => {
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
    }).pipe(withFreshConsole)
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
      expect(yield* fs.readFileString(path.join(path.dirname(manifestPath), O.getOrThrow(A.head(backups))))).toContain(
        "bindings: []"
      );
      const lines = A.filter(yield* TestConsole.logLines, P.isString);
      expect(A.some(lines, Str.startsWith("models: adopted the seed into"))).toBe(true);
    }).pipe(withFreshConsole)
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
    }).pipe(withFreshConsole)
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
    }).pipe(withFreshConsole)
  );

  it.effect("does not overwrite a file through a symlinked report name", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const home = yield* fs.makeTempDirectoryScoped({ prefix: "models-report-" });
      const manifestPath = path.join(home, "config", "models.yaml");
      const reportDir = path.join(home, "reports");
      const sentinel = path.join(home, "sentinel.yaml");
      yield* runModelsCommand(["init", "--home", home, "--repo", home, "--manifest", manifestPath]);
      yield* fs.makeDirectory(reportDir);
      yield* fs.writeFileString(sentinel, "operator routing stays intact\n");
      yield* fs.symlink(sentinel, path.join(reportDir, "models-report.json"));

      const exit = yield* Effect.exit(
        runModelsCommand([
          "check",
          "--offline",
          "--home",
          home,
          "--repo",
          home,
          "--manifest",
          manifestPath,
          "--report-dir",
          reportDir,
        ])
      );
      exit.pipe(Exit.isFailure, assertTrue);
      expect(yield* fs.readFileString(sentinel)).toBe("operator routing stays intact\n");
    }).pipe(withFreshConsole)
  );
});
