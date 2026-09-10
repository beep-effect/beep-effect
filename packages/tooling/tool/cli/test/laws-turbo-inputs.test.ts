import { $RepoCliId } from "@beep/identity/packages";
import { policyToolsFingerprint, StepExec } from "@beep/repo-cli/test/PackageScripts";
import { FsUtilsLive, findRepoRoot, jsonStringifyPretty } from "@beep/repo-utils";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const $I = $RepoCliId.create("test/laws-turbo-inputs");

class LawsTaskDefinition extends S.Class<LawsTaskDefinition>($I`LawsTaskDefinition`)(
  { cache: S.Boolean, outputs: S.Array(S.String), inputs: S.Array(S.String), dependsOn: S.Array(S.String) },
  $I.annote("LawsTaskDefinition", { description: "Production law task declarations exercised by the hash fixture." })
) {}

class LawsTaskSummary extends S.Class<LawsTaskSummary>($I`LawsTaskSummary`)(
  { taskId: S.String, hash: S.String, dependencies: S.Array(S.String) },
  $I.annote("LawsTaskSummary", { description: "Task identity, hash, and edges from a real Turbo dry run." })
) {}

class LawsRunSummary extends S.Class<LawsRunSummary>($I`LawsRunSummary`)(
  { tasks: S.Array(LawsTaskSummary) },
  $I.annote("LawsRunSummary", { description: "Turbo dry-run boundary for package and root law tasks." })
) {}

const LawsConfiguration = S.Struct({
  tasks: S.Struct({ "lint:laws": LawsTaskDefinition, "//#lint:native-runtime:roots": LawsTaskDefinition }),
});
const RootScripts = S.Struct({ scripts: S.Record(S.String, S.String) });
const decodeConfiguration = S.decodeEffect(S.fromJsonString(LawsConfiguration));
const decodeScripts = S.decodeEffect(S.fromJsonString(RootScripts));
const decodeSummary = S.decodeEffect(S.fromJsonString(LawsRunSummary));
const encodeSummary = S.encodeEffect(S.fromJsonString(LawsRunSummary));
const summaryEquivalent = S.toEquivalence(LawsRunSummary);
const summaryArbitrary = S.toArbitrary(LawsRunSummary)(fc);
const providePlatform = provideScopedLayer(FsUtilsLive.pipe(Layer.provideMerge(NodeServices.layer)));

const expectedTasks = {
  "lint:laws": {
    cache: true,
    outputs: [],
    dependsOn: ["//#lint:policy-fingerprint"],
    inputs: [
      "**/*.{ts,tsx}",
      "package.json",
      "tsconfig*.json",
      "$TURBO_ROOT$/tsconfig*.json",
      "$TURBO_ROOT$/packages/**/package.json",
      "$TURBO_ROOT$/packages/tooling/policy-pack/repo-configs/src/eslint/EffectLawsAllowlist.ts",
      "$TURBO_ROOT$/packages/tooling/policy-pack/repo-configs/src/eslint/NoNativeRuntimeHotspots.ts",
      "$TURBO_ROOT$/packages/tooling/policy-pack/repo-configs/src/internal/eslint/generated/EffectLawsAllowlistSnapshot.ts",
      "$TURBO_ROOT$/standards/effect-laws.allowlist.jsonc",
      "!node_modules/**",
    ],
  },
  "//#lint:native-runtime:roots": {
    cache: true,
    outputs: [],
    dependsOn: ["//#lint:policy-fingerprint"],
    inputs: [
      "scratchpad/**/*.{ts,tsx}",
      "packages/_internal/db-admin/effect-ontology/**/*.{ts,tsx}",
      "packages/tooling/policy-pack/repo-configs/src/eslint/EffectLawsAllowlist.ts",
      "packages/tooling/policy-pack/repo-configs/src/eslint/NoNativeRuntimeHotspots.ts",
      "packages/tooling/policy-pack/repo-configs/src/internal/eslint/generated/EffectLawsAllowlistSnapshot.ts",
      "standards/effect-laws.allowlist.jsonc",
    ],
  },
};

const writeFile = Effect.fn("LawsTurboTest.writeFile")(function* (root: string, file: string, content: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const target = path.join(root, file);
  yield* fs.makeDirectory(path.dirname(target), { recursive: true });
  yield* fs.writeFileString(target, content);
});
const writeJson = Effect.fn("LawsTurboTest.writeJson")(function* (root: string, file: string, value: unknown) {
  yield* writeFile(root, file, `${yield* jsonStringifyPretty(value)}\n`);
});
const lawHashes = Effect.fn("LawsTurboTest.lawHashes")(function* (root: string, binary: string) {
  const run = yield* StepExec.runCaptured({
    command: binary,
    args: [
      "run",
      "lint:laws",
      "//#lint:native-runtime:roots",
      "--filter=@fixture/consumer",
      "--dry-run=json",
      "--cache=local:rw",
    ],
    cwd: root,
    source: "stdout",
    timeout: "20 seconds",
    env: { TURBO_TELEMETRY_DISABLED: "1", TURBO_UI: "stream" },
    extendEnv: true,
  });
  expect(run.exitCode, run.output).toBe(0);
  expect(run.truncated).toBe(false);
  const summary = yield* decodeSummary(run.output);
  return A.map(["@fixture/consumer#lint:laws", "//#lint:native-runtime:roots", "//#lint:policy-fingerprint"], (id) => {
    const task = O.getOrThrow(A.findFirst(summary.tasks, (row) => row.taskId === id));
    if (id !== "//#lint:policy-fingerprint") expect(task.dependencies).toEqual(["//#lint:policy-fingerprint"]);
    return task;
  });
});

describe("Stage B laws Turbo inputs", { concurrent: false }, () => {
  it("round-trips schema-derived Turbo summaries through JSON", () =>
    fc.assert(
      fc.property(summaryArbitrary, (summary) => {
        const encoded = Effect.runSync(encodeSummary(summary));
        const decoded = Effect.runSync(decodeSummary(encoded));
        expect(summaryEquivalent(decoded, summary)).toBe(true);
        expect(Effect.runSync(encodeSummary(decoded))).toBe(encoded);
      })
    ));

  it.effect(
    "pins the verbatim table inputs and the prescribed nonrecursive root script",
    Effect.fnUntraced(function* () {
      const root = yield* findRepoRoot();
      const fs = yield* FileSystem.FileSystem;
      const config = yield* decodeConfiguration(yield* fs.readFileString(`${root}/turbo.json`));
      expect(config.tasks).toEqual(expectedTasks);
      const manifest = yield* decodeScripts(yield* fs.readFileString(`${root}/package.json`));
      expect(manifest.scripts["lint:native-runtime:roots"]).toBe(
        "beep-cli laws native-runtime --check --include-prefix scratchpad,packages/_internal/db-admin/effect-ontology"
      );
    }, providePlatform)
  );

  it.effect(
    "isolates each direct input and the fingerprint edge from unrelated package sources",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const config = yield* decodeConfiguration(yield* fs.readFileString(`${repoRoot}/turbo.json`));
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "laws-turbo-" });
      const binary = path.join(repoRoot, "node_modules", ".bin", "turbo");
      yield* writeJson(root, "package.json", {
        name: "laws-fixture",
        private: true,
        packageManager: "bun@1.4.2",
        workspaces: ["packages/*", "packages/tooling/policy-pack/*"],
        scripts: { "lint:policy-fingerprint": "echo fingerprint", "lint:native-runtime:roots": "echo roots" },
      });
      yield* writeJson(root, "packages/cli/package.json", {
        name: "@beep/repo-cli",
        dependencies: { "@fixture/helper": "workspace:*" },
      });
      yield* writeJson(root, "packages/helper/package.json", { name: "@fixture/helper" });
      yield* writeJson(root, "packages/consumer/package.json", {
        name: "@fixture/consumer",
        dependencies: { "@fixture/upstream": "workspace:*" },
        scripts: { "lint:laws": "echo laws" },
      });
      yield* writeJson(root, "packages/upstream/package.json", { name: "@fixture/upstream" });
      yield* writeJson(root, "packages/unrelated/package.json", { name: "@fixture/unrelated" });
      // Deliberately outside the fixture CLI closure: rule mutations must exercise the direct input edges.
      yield* writeJson(root, "packages/tooling/policy-pack/repo-configs/package.json", {
        name: "@fixture/repo-configs",
      });
      yield* writeFile(root, ".gitignore", "node_modules\n.turbo\n");
      const sourceFiles = [
        "packages/cli/src/index.ts",
        "packages/helper/src/index.ts",
        "packages/consumer/src/index.ts",
        "packages/consumer/test/example.tsx",
        "packages/upstream/src/index.ts",
        "packages/unrelated/src/index.ts",
        "scratchpad/example.tsx",
        "packages/_internal/db-admin/effect-ontology/example.ts",
        "scripts/unrelated.ts",
        "packages/tooling/policy-pack/repo-configs/src/eslint/EffectLawsAllowlist.ts",
        "packages/tooling/policy-pack/repo-configs/src/eslint/NoNativeRuntimeHotspots.ts",
        "packages/tooling/policy-pack/repo-configs/src/internal/eslint/generated/EffectLawsAllowlistSnapshot.ts",
      ];
      yield* Effect.forEach(sourceFiles, (file) => writeFile(root, file, "export const value = 1;\n"));
      yield* Effect.forEach(
        ["standards/effect-laws.allowlist.jsonc", "tsconfig.proof.json", "packages/consumer/tsconfig.test.json"],
        (file) => writeFile(root, file, "{}\n")
      );
      const fingerprint = yield* policyToolsFingerprint(root);
      yield* writeJson(root, "standards/policy-tools.fingerprint.json", fingerprint);
      yield* writeJson(root, "turbo.json", {
        futureFlags: { affectedUsingTaskInputs: true, filterUsingTasks: true, globalConfiguration: true },
        tasks: {
          ...config.tasks,
          "//#lint:policy-fingerprint": { cache: true, outputs: [], inputs: fingerprint.inputs },
        },
      });
      const baseline = yield* lawHashes(root, binary);
      const assertMutation = Effect.fnUntraced(function* (file: string, changed: ReadonlyArray<boolean>) {
        const original = yield* fs.readFileString(path.join(root, file));
        yield* writeFile(root, file, `${original}\n`);
        const mutated = yield* lawHashes(root, binary);
        A.forEach(mutated, (task, index) => {
          expect(task.hash === baseline[index]?.hash, `${file}: ${task.taskId}`).toBe(!changed[index]);
        });
        yield* writeFile(root, file, original);
        expect(yield* lawHashes(root, binary)).toEqual(baseline);
      });
      yield* Effect.forEach(
        [
          "packages/consumer/src/index.ts",
          "packages/consumer/test/example.tsx",
          "packages/consumer/package.json",
          "packages/consumer/tsconfig.test.json",
          "tsconfig.proof.json",
          "packages/upstream/package.json",
          "packages/unrelated/package.json",
        ],
        (file) => assertMutation(file, [true, false, false])
      );
      yield* Effect.forEach(
        ["scratchpad/example.tsx", "packages/_internal/db-admin/effect-ontology/example.ts"],
        (file) => assertMutation(file, [false, true, false])
      );
      yield* Effect.forEach(
        [
          "standards/effect-laws.allowlist.jsonc",
          "packages/tooling/policy-pack/repo-configs/src/eslint/EffectLawsAllowlist.ts",
          "packages/tooling/policy-pack/repo-configs/src/eslint/NoNativeRuntimeHotspots.ts",
          "packages/tooling/policy-pack/repo-configs/src/internal/eslint/generated/EffectLawsAllowlistSnapshot.ts",
        ],
        (file) => assertMutation(file, [true, true, false])
      );
      yield* assertMutation("packages/helper/src/index.ts", [true, true, true]);
      yield* Effect.forEach(
        ["packages/upstream/src/index.ts", "packages/unrelated/src/index.ts", "scripts/unrelated.ts"],
        (file) => assertMutation(file, [false, false, false])
      );
    }, providePlatform),
    { timeout: 180_000 }
  );
});
