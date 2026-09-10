import { fcRuns } from "@beep/fc-runs";
import { $RepoCliId } from "@beep/identity/packages";
import {
  PolicyFingerprintTurboConfiguration,
  policyToolsFingerprint,
  StepExec,
} from "@beep/repo-cli/test/PackageScripts";
import { FsUtilsLive, findRepoRoot, jsonStringifyPretty } from "@beep/repo-utils";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const $I = $RepoCliId.create("test/policy-fingerprint-turbo-inputs");

class FingerprintTaskSummary extends S.Class<FingerprintTaskSummary>($I`FingerprintTaskSummary`)(
  { taskId: S.String, hash: S.String, dependencies: S.Array(S.String) },
  $I.annote("FingerprintTaskSummary", {
    description: "Task hashes and dependency identities from a real Turbo dry run.",
  })
) {}

class FingerprintRunSummary extends S.Class<FingerprintRunSummary>($I`FingerprintRunSummary`)(
  { tasks: S.Array(FingerprintTaskSummary) },
  $I.annote("FingerprintRunSummary", {
    description: "Turbo dry-run tasks used to prove the root dependency hash edge.",
  })
) {}

class PolicyTaskDefinition extends S.Class<PolicyTaskDefinition>($I`PolicyTaskDefinition`)(
  { cache: S.Boolean, outputs: S.Array(S.String), inputs: S.Array(S.String), dependsOn: S.Array(S.String) },
  $I.annote("PolicyTaskDefinition", {
    description: "Cached policy task declaration copied into the real hash fixture.",
  })
) {}

const PolicyTaskConfiguration = S.Struct({
  tasks: S.Struct({
    "lint:deprecated-apis": S.Struct({ ...PolicyTaskDefinition.fields, env: S.Array(S.String) }),
    "lint:jsdoc": PolicyTaskDefinition,
    "//#lint:jsdoc:root": PolicyTaskDefinition,
    transit: S.Struct({ dependsOn: S.Array(S.String) }),
  }),
});
const decodePolicyTasks = S.decodeEffect(S.fromJsonString(PolicyTaskConfiguration));

const expectedPolicyTasks = {
  "lint:deprecated-apis": {
    cache: true,
    outputs: [],
    dependsOn: ["^transit", "//#lint:policy-fingerprint"],
    env: ["NODE_OPTIONS"],
    inputs: [
      "**/*.{ts,tsx,js,jsx,mjs,cjs}",
      "package.json",
      "tsconfig*.json",
      "$TURBO_ROOT$/eslint.config.mjs",
      "$TURBO_ROOT$/tsconfig*.json",
      "$TURBO_ROOT$/packages/tooling/policy-pack/repo-configs/package.json",
      "$TURBO_ROOT$/packages/tooling/policy-pack/repo-configs/src/eslint/**",
      "$TURBO_ROOT$/packages/tooling/policy-pack/repo-configs/src/internal/eslint/**",
      "$TURBO_ROOT$/packages/**/tsconfig*.json",
      "$TURBO_ROOT$/apps/**/tsconfig*.json",
      "$TURBO_ROOT$/infra/**/tsconfig*.json",
      "$TURBO_ROOT$/packages/**/package.json",
      "$TURBO_ROOT$/apps/**/package.json",
      "$TURBO_ROOT$/infra/package.json",
      "!node_modules/**",
      "!.beep/**",
    ],
  },
  "lint:jsdoc": {
    cache: true,
    outputs: [],
    dependsOn: ["//#lint:policy-fingerprint"],
    inputs: [
      "**/*.{ts,tsx,js,jsx,mjs,cjs}",
      "package.json",
      "$TURBO_ROOT$/eslint.config.mjs",
      "$TURBO_ROOT$/tsdoc.json",
      "$TURBO_ROOT$/packages/tooling/policy-pack/repo-configs/package.json",
      "$TURBO_ROOT$/packages/tooling/policy-pack/repo-configs/src/eslint/**",
      "$TURBO_ROOT$/packages/tooling/policy-pack/repo-configs/src/internal/eslint/**",
      "!node_modules/**",
    ],
  },
  "//#lint:jsdoc:root": {
    cache: true,
    outputs: [],
    dependsOn: ["//#lint:policy-fingerprint"],
    inputs: [
      "**/*.{ts,tsx,js,jsx,mjs,cjs}",
      "!packages/**",
      "!apps/**",
      "!infra/**",
      "!**/node_modules/**",
      "eslint.config.mjs",
      "tsdoc.json",
      "packages/tooling/policy-pack/repo-configs/src/eslint/**",
      "packages/tooling/policy-pack/repo-configs/src/internal/eslint/**",
    ],
  },
};

const RootTaskContract = S.Struct({
  tasks: S.Struct({
    "//#lint:policy-fingerprint": S.Struct({ cache: S.Boolean, outputs: S.Array(S.String) }),
  }),
});
const RootScripts = S.Struct({ scripts: S.Record(S.String, S.String) });
const decodeConfiguration = S.decodeEffect(S.fromJsonString(PolicyFingerprintTurboConfiguration));
const decodeContract = S.decodeEffect(S.fromJsonString(RootTaskContract));
const decodeScripts = S.decodeEffect(S.fromJsonString(RootScripts));
const decodeSummary = S.decodeEffect(S.fromJsonString(FingerprintRunSummary));
const encodeSummary = S.encodeEffect(S.fromJsonString(FingerprintRunSummary));
const summaryEquivalent = S.toEquivalence(FingerprintRunSummary);
const FingerprintRunSummaryArbitrary = Arbitrary.schema(FingerprintRunSummary);
const platform = FsUtilsLive.pipe(Layer.provideMerge(NodeServices.layer));
const providePlatform = provideScopedLayer(platform);

const writeFile = Effect.fn("PolicyFingerprintTurboTest.writeFile")(function* (
  root: string,
  file: string,
  content: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const target = path.join(root, file);
  yield* fs.makeDirectory(path.dirname(target), { recursive: true });
  yield* fs.writeFileString(target, content);
});

const writeJson = Effect.fn("PolicyFingerprintTurboTest.writeJson")(function* (
  root: string,
  file: string,
  value: unknown
) {
  yield* writeFile(root, file, `${yield* jsonStringifyPretty(value)}\n`);
});

const packageHash = Effect.fn("PolicyFingerprintTurboTest.packageHash")(function* (root: string, binary: string) {
  const run = yield* StepExec.runCaptured({
    command: binary,
    args: ["run", "lint:jsdoc", "--filter=@fixture/consumer", "--dry-run=json", "--cache=local:rw"],
    cwd: root,
    source: "stdout",
    timeout: "20 seconds",
    env: { TURBO_TELEMETRY_DISABLED: "1", TURBO_UI: "stream" },
    extendEnv: true,
  });
  expect(run.exitCode, run.output).toBe(0);
  expect(run.truncated).toBe(false);
  const summary = yield* decodeSummary(run.output);
  const task = A.findFirst(summary.tasks, (row) => row.taskId === "@fixture/consumer#lint:jsdoc");
  expect(O.isSome(task)).toBe(true);
  const found = O.getOrThrow(task);
  expect(found.dependencies).toContain("//#lint:policy-fingerprint");
  expect(A.some(summary.tasks, (row) => row.taskId === "//#lint:policy-fingerprint")).toBe(true);
  return found.hash;
});

const policyHashes = Effect.fn("PolicyFingerprintTurboTest.policyHashes")(function* (root: string, binary: string) {
  const run = yield* StepExec.runCaptured({
    command: binary,
    args: [
      "run",
      "lint:jsdoc",
      "lint:deprecated-apis",
      "//#lint:jsdoc:root",
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
  return A.map(
    ["@fixture/consumer#lint:deprecated-apis", "@fixture/consumer#lint:jsdoc", "//#lint:jsdoc:root"],
    (id) => {
      const task = O.getOrThrow(A.findFirst(summary.tasks, (row) => row.taskId === id));
      expect(task.dependencies).toContain("//#lint:policy-fingerprint");
      return task;
    }
  );
});

describe("policy fingerprint Turbo inputs", { concurrent: false }, () => {
  it.effect("round-trips schema-derived dry-run summaries through the JSON boundary", () =>
    Effect.gen(function* () {
      const result = yield* Arbitrary.checkEffect(
        FingerprintRunSummaryArbitrary,
        (summary) =>
          Effect.gen(function* () {
            const encoded = yield* encodeSummary(summary);
            const decoded = yield* decodeSummary(encoded);
            expect(summaryEquivalent(decoded, summary)).toBe(true);
            expect(yield* encodeSummary(decoded)).toBe(encoded);
            return true;
          }),
        fcRuns()
      );
      expect(result._tag).toBe("Passed");
    })
  );

  it.effect(
    "materializes exactly the computed repository closure and registers a nonrecursive cached root script",
    Effect.fnUntraced(function* () {
      const root = yield* findRepoRoot();
      const fs = yield* FileSystem.FileSystem;
      const text = yield* fs.readFileString(`${root}/turbo.json`);
      const config = yield* decodeConfiguration(text);
      const fingerprint = yield* policyToolsFingerprint(root);
      expect(config.tasks["//#lint:policy-fingerprint"].inputs).toEqual(fingerprint.inputs);
      expect(fingerprint.inputs).toEqual(A.sort(A.dedupe(fingerprint.inputs), Order.String));
      expect(fingerprint.inputs).not.toContain("**/package.json");
      expect(fingerprint.inputs).toContain("package.json");
      expect(fingerprint.inputs).toContain("standards/policy-tools.fingerprint.json");
      expect(fingerprint.inputs).toContain("standards/lint-policy.sweeps.jsonc");
      const contract = yield* decodeContract(text);
      expect(contract.tasks["//#lint:policy-fingerprint"]).toEqual({ cache: true, outputs: [] });
      const manifest = yield* decodeScripts(yield* fs.readFileString(`${root}/package.json`));
      expect(manifest.scripts["lint:policy-fingerprint"]).toBe("beep-cli lint policy-fingerprint --check");
    }, providePlatform)
  );

  it.effect(
    "propagates closure edits through the root dependency hash and isolates unrelated files",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "policy-fingerprint-turbo-" });
      const binary = path.join(repoRoot, "node_modules", ".bin", "turbo");
      yield* writeJson(root, "package.json", {
        name: "fingerprint-fixture",
        private: true,
        packageManager: "bun@1.4.2",
        workspaces: ["packages/*"],
        scripts: { "lint:policy-fingerprint": "echo fingerprint" },
      });
      yield* writeJson(root, "packages/cli/package.json", {
        name: "@beep/repo-cli",
        dependencies: { "@fixture/helper": "workspace:*" },
      });
      yield* writeJson(root, "packages/helper/package.json", { name: "@fixture/helper" });
      yield* writeJson(root, "packages/consumer/package.json", {
        name: "@fixture/consumer",
        scripts: { "lint:jsdoc": "echo jsdoc" },
      });
      yield* writeJson(root, "packages/unrelated/package.json", { name: "@fixture/unrelated", private: true });
      yield* writeFile(root, ".gitignore", "node_modules\n.turbo\n");
      yield* writeFile(root, "packages/cli/src/index.ts", "export const cli = 1;\n");
      yield* writeFile(root, "packages/helper/src/index.ts", "export const helper = 1;\n");
      yield* writeFile(root, "packages/consumer/src/index.ts", "export const consumer = 1;\n");
      yield* writeFile(root, "packages/unrelated/src/index.ts", "export const unrelated = 1;\n");
      yield* writeJson(root, "standards/lint-policy.sweeps.jsonc", {
        schemaVersion: "lint-policy-sweeps/v1",
        deprecatedApis: "shards",
      });
      const fingerprint = yield* policyToolsFingerprint(root);
      yield* writeJson(root, "standards/policy-tools.fingerprint.json", fingerprint);
      yield* writeJson(root, "turbo.json", {
        futureFlags: { affectedUsingTaskInputs: true, filterUsingTasks: true, globalConfiguration: true },
        tasks: {
          "//#lint:policy-fingerprint": { cache: true, outputs: [], inputs: fingerprint.inputs },
          "lint:jsdoc": {
            cache: true,
            outputs: [],
            inputs: ["src/**", "package.json"],
            dependsOn: ["//#lint:policy-fingerprint"],
          },
        },
      });
      const baseline = yield* packageHash(root, binary);
      yield* writeJson(root, "standards/lint-policy.sweeps.jsonc", {
        schemaVersion: "lint-policy-sweeps/v1",
        deprecatedApis: "turbo",
      });
      expect(yield* packageHash(root, binary)).not.toBe(baseline);
      yield* writeJson(root, "standards/lint-policy.sweeps.jsonc", {
        schemaVersion: "lint-policy-sweeps/v1",
        deprecatedApis: "shards",
      });
      expect(yield* packageHash(root, binary)).toBe(baseline);
      yield* writeFile(root, "packages/unrelated/src/index.ts", "export const unrelated = 2;\n");
      expect(yield* packageHash(root, binary)).toBe(baseline);
      yield* writeJson(root, "packages/unrelated/package.json", { name: "@fixture/unrelated", private: false });
      expect(yield* packageHash(root, binary)).toBe(baseline);
      yield* writeFile(root, "packages/helper/src/index.ts", "export const helper = 2;\n");
      expect(yield* packageHash(root, binary)).not.toBe(baseline);
      yield* writeFile(root, "packages/helper/src/index.ts", "export const helper = 1;\n");
      expect(yield* packageHash(root, binary)).toBe(baseline);
      yield* writeJson(root, "packages/helper/package.json", { name: "@fixture/helper", description: "closure edit" });
      expect(yield* packageHash(root, binary)).not.toBe(baseline);
      yield* writeJson(root, "packages/helper/package.json", { name: "@fixture/helper" });
      expect(yield* packageHash(root, binary)).toBe(baseline);
    }, providePlatform),
    { timeout: 120_000 }
  );
});

describe("Stage B eslint task inputs", { concurrent: false }, () => {
  it.effect(
    "pins the table declarations and the nonrecursive root residual script",
    Effect.fnUntraced(function* () {
      const root = yield* findRepoRoot();
      const fs = yield* FileSystem.FileSystem;
      const config = yield* decodePolicyTasks(yield* fs.readFileString(`${root}/turbo.json`));
      expect(config.tasks["lint:deprecated-apis"]).toEqual(expectedPolicyTasks["lint:deprecated-apis"]);
      expect(config.tasks["lint:jsdoc"]).toEqual(expectedPolicyTasks["lint:jsdoc"]);
      expect(config.tasks["//#lint:jsdoc:root"]).toEqual(expectedPolicyTasks["//#lint:jsdoc:root"]);
      const manifest = yield* decodeScripts(yield* fs.readFileString(`${root}/package.json`));
      expect(manifest.scripts["lint:jsdoc:root"]).toBe("beep-cli lint jsdoc --root-only");
    }, providePlatform)
  );

  it.effect(
    "isolates package and root sources while invalidating every actual checker input and typed dependency",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const config = yield* decodePolicyTasks(yield* fs.readFileString(`${repoRoot}/turbo.json`));
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "policy-eslint-turbo-" });
      const binary = path.join(repoRoot, "node_modules", ".bin", "turbo");
      yield* writeJson(root, "package.json", {
        name: "policy-eslint-fixture",
        private: true,
        packageManager: "bun@1.4.2",
        workspaces: ["packages/*", "packages/tooling/policy-pack/*"],
        scripts: { "lint:policy-fingerprint": "echo fingerprint", "lint:jsdoc:root": "echo root" },
      });
      yield* writeJson(root, "packages/cli/package.json", {
        name: "@beep/repo-cli",
        dependencies: { "@fixture/helper": "workspace:*", "@fixture/repo-configs": "workspace:*" },
      });
      yield* writeJson(root, "packages/helper/package.json", { name: "@fixture/helper" });
      yield* writeJson(root, "packages/tooling/policy-pack/repo-configs/package.json", {
        name: "@fixture/repo-configs",
      });
      yield* writeJson(root, "packages/consumer/package.json", {
        name: "@fixture/consumer",
        dependencies: { "@fixture/dependency": "workspace:*" },
        scripts: { "lint:jsdoc": "echo jsdoc", "lint:deprecated-apis": "echo deprecated" },
      });
      yield* writeJson(root, "packages/dependency/package.json", { name: "@fixture/dependency" });
      yield* writeJson(root, "packages/unrelated/package.json", { name: "@fixture/unrelated" });
      yield* writeFile(root, ".gitignore", "node_modules\n.turbo\n");
      // These files exist before configuration is frozen; each mutation is restored before the next.
      const sourceFiles = [
        "packages/cli/src/index.ts",
        "packages/helper/src/index.ts",
        "packages/consumer/src/index.ts",
        "packages/dependency/src/index.ts",
        "packages/unrelated/src/index.ts",
        "scripts/check.ts",
        "packages/tooling/policy-pack/repo-configs/src/eslint/rule.ts",
        "packages/tooling/policy-pack/repo-configs/src/internal/eslint/helper.ts",
      ];
      yield* Effect.forEach(sourceFiles, (file) => writeFile(root, file, "export const value = 1;\n"));
      yield* writeFile(root, "eslint.config.mjs", "export default [];\n");
      yield* writeFile(root, "tsdoc.json", "{}\n");
      yield* writeFile(root, "tsconfig.proof.json", "{}\n");
      const fingerprint = yield* policyToolsFingerprint(root);
      yield* writeJson(root, "standards/policy-tools.fingerprint.json", fingerprint);
      yield* writeJson(root, "turbo.json", {
        futureFlags: { affectedUsingTaskInputs: true, filterUsingTasks: true, globalConfiguration: true },
        tasks: {
          ...config.tasks,
          "//#lint:policy-fingerprint": { cache: true, outputs: [], inputs: fingerprint.inputs },
        },
      });
      const baseline = yield* policyHashes(root, binary);
      expect(O.getOrThrow(A.head(baseline)).dependencies).toContain("@fixture/dependency#transit");
      const assertMutation = Effect.fnUntraced(function* (file: string, changed: ReadonlyArray<boolean>) {
        const original = yield* fs.readFileString(path.join(root, file));
        yield* writeFile(root, file, `${original}\n`);
        const mutated = yield* policyHashes(root, binary);
        A.forEach(mutated, (task, index) => {
          expect(task.hash === baseline[index]?.hash, `${file}: ${task.taskId}`).toBe(!changed[index]);
        });
        yield* writeFile(root, file, original);
        expect(yield* policyHashes(root, binary)).toEqual(baseline);
      });
      yield* assertMutation("packages/consumer/src/index.ts", [true, true, false]);
      yield* assertMutation("scripts/check.ts", [false, false, true]);
      yield* assertMutation("packages/unrelated/src/index.ts", [false, false, false]);
      yield* assertMutation("packages/dependency/src/index.ts", [true, false, false]);
      // This root tsconfig is deliberately outside the fingerprint's two named tsconfigs.
      yield* assertMutation("tsconfig.proof.json", [true, false, false]);
      yield* Effect.forEach(
        [
          "eslint.config.mjs",
          "tsdoc.json",
          "packages/tooling/policy-pack/repo-configs/src/eslint/rule.ts",
          "packages/tooling/policy-pack/repo-configs/src/internal/eslint/helper.ts",
          "packages/helper/src/index.ts",
        ],
        (file) => assertMutation(file, [true, true, true])
      );
    }, providePlatform),
    { timeout: 180_000 }
  );
});
