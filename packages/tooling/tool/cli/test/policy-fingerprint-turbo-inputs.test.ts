import { fcRuns } from "@beep/fc-runs";
import { $RepoCliId } from "@beep/identity/packages";
import { PolicyToolsFingerprintPolicy, StepExec } from "@beep/repo-cli/test/PackageScripts";
import { FsUtilsLive, findRepoRoot, jsonStringifyPretty } from "@beep/repo-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  fixturePackageFiles,
  policyCliFixtureFiles,
  withFingerprintMarker,
  writeFixtureFiles,
  writeFixtureFingerprint,
} from "./support/PolicyCliFixture.ts";

const $I = $RepoCliId.create("test/policy-fingerprint-turbo-inputs");

class FingerprintTaskSummary extends S.Opaque<FingerprintTaskSummary, { readonly brand: unique symbol }>()(
  S.Struct({ taskId: S.String, hash: S.String, dependencies: S.Array(S.String) }).pipe(
    $I.annoteSchema("FingerprintTaskSummary", {
      description: "Task hashes and dependency identities from a real Turbo dry run.",
    })
  )
) {}

class FingerprintRunSummary extends S.Opaque<FingerprintRunSummary, { readonly brand: unique symbol }>()(
  S.Struct({ tasks: S.Array(FingerprintTaskSummary) }).pipe(
    $I.annoteSchema("FingerprintRunSummary", {
      description: "Turbo dry-run tasks used to prove the root dependency hash edge.",
    })
  )
) {}

class PolicyTaskDefinition extends S.Opaque<PolicyTaskDefinition, { readonly brand: unique symbol }>()(
  S.Struct({
    cache: S.Boolean,
    outputs: S.Array(S.String),
    inputs: S.Array(S.String),
    dependsOn: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("PolicyTaskDefinition", {
      description: "Cached policy task declaration copied into the real hash fixture.",
    })
  )
) {}

const PolicyTaskConfiguration = S.Struct({
  tasks: S.Struct({
    "lint:deprecated-apis": PolicyTaskDefinition,
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
    dependsOn: ["^transit", "//#lint:policy-fingerprint:lint-deprecated-apis"],
  },
  "lint:jsdoc": { cache: true, outputs: [], dependsOn: ["//#lint:policy-fingerprint:lint-jsdoc"] },
  "//#lint:jsdoc:root": { cache: true, outputs: [], dependsOn: ["//#lint:policy-fingerprint:lint-jsdoc"] },
};
const isSeal = Str.startsWith("//#lint:policy-fingerprint:");
const TurboTasks = S.Struct({
  tasks: S.Record(
    S.String,
    S.Struct({
      dependsOn: S.Array(S.String).pipe(S.optionalKey),
      cache: S.Boolean.pipe(S.optionalKey),
      outputs: S.Array(S.String).pipe(S.optionalKey),
    })
  ),
});
const decodeTurboTasks = S.decodeEffect(S.fromJsonString(TurboTasks));

const RootScripts = S.Struct({ scripts: S.Record(S.String, S.String) });
const decodeScripts = S.decodeEffect(S.fromJsonString(RootScripts));
const decodeSummary = S.decodeEffect(S.fromJsonString(FingerprintRunSummary));
const encodeSummary = S.encodeEffect(S.fromJsonString(FingerprintRunSummary));
const summaryEquivalent = S.toEquivalence(FingerprintRunSummary);
const FingerprintRunSummaryArbitrary = Arbitrary.schema(FingerprintRunSummary);
const platform = FsUtilsLive.pipe(Layer.provideMerge(NodeServices.layer));

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
  expect(A.some(found.dependencies, isSeal)).toBe(true);
  expect(A.some(summary.tasks, (row) => row.taskId === "//#lint:policy-fingerprint:shared")).toBe(true);
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
      expect(A.some(task.dependencies, isSeal)).toBe(true);
      return task;
    }
  );
});

describe("policy fingerprint Turbo inputs", { concurrent: false }, () => {
  it.effect.prop(
    "round-trips schema-derived dry-run summaries through the JSON boundary",
    [FingerprintRunSummaryArbitrary],
    Effect.fnUntraced(function* ([summary]) {
      const encoded = yield* encodeSummary(summary);
      const decoded = yield* decodeSummary(encoded);
      expect(summaryEquivalent(decoded, summary)).toBe(true);
      expect(yield* encodeSummary(decoded)).toBe(encoded);
    }),
    { arbitrary: fcRuns() }
  );

  it.layer(platform, { timeout: "30 seconds" })((it) => {
    it.effect(
      "keeps the live generated seals current and points every policy task at one",
      Effect.fnUntraced(function* () {
        const root = yield* findRepoRoot();
        const fs = yield* FileSystem.FileSystem;
        const policy = yield* PolicyToolsFingerprintPolicy.make(root);
        yield* policy.check;
        const config = yield* decodeTurboTasks(yield* fs.readFileString(`${root}/turbo.json`));
        expect(config.tasks["//#lint:policy-fingerprint"]).toMatchObject({ cache: true, outputs: [] });
        for (const [task, value] of R.toEntries(config.tasks)) {
          // Nothing depends on the drift check: its inputs span every seal.
          expect(value.dependsOn ?? [], task).not.toContain("//#lint:policy-fingerprint");
        }
        const manifest = yield* decodeScripts(yield* fs.readFileString(`${root}/package.json`));
        expect(manifest.scripts["lint:policy-fingerprint"]).toBe("beep-cli lint policy-fingerprint --check");
        for (const [name, script] of R.toEntries(manifest.scripts))
          if (Str.startsWith("lint:policy-fingerprint:")(name)) expect(script, name).toBe("true");
      })
    );
  });

  it.layer(platform, { timeout: "120 seconds" })((it) => {
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
          scripts: { "lint:policy-fingerprint": "echo fingerprint", "other:check": "beep-cli other" },
        });
        yield* writeFixtureFiles(root, {
          ...policyCliFixtureFiles([
            { group: "lint", leaves: [{ name: "jsdoc", imports: ["@beep/helper"] }] },
            { group: "other", imports: ["@beep/sibling"] },
          ]),
          ...fixturePackageFiles("helper"),
          ...fixturePackageFiles("sibling"),
        });
        yield* writeJson(root, "packages/consumer/package.json", {
          name: "@fixture/consumer",
          scripts: { "lint:jsdoc": "beep-cli lint jsdoc --package ." },
        });
        yield* writeJson(root, "packages/unrelated/package.json", { name: "@fixture/unrelated", private: true });
        yield* writeFile(root, ".gitignore", "node_modules\n.turbo\n");
        yield* writeFile(root, "packages/consumer/src/index.ts", "export const consumer = 1;\n");
        yield* writeFile(root, "packages/unrelated/src/index.ts", "export const unrelated = 1;\n");
        yield* writeJson(root, "standards/lint-policy.sweeps.jsonc", {
          schemaVersion: "lint-policy-sweeps/v1",
          deprecatedApis: "oxlint",
        });
        yield* writeJson(root, "turbo.json", {
          futureFlags: { affectedUsingTaskInputs: true, filterUsingTasks: true, globalConfiguration: true },
          tasks: {
            "//#lint:policy-fingerprint": { cache: true, outputs: [], inputs: [] },
            "//#other:check": { cache: true, outputs: [], dependsOn: ["//#lint:policy-fingerprint"] },
            "lint:jsdoc": {
              cache: true,
              outputs: [],
              inputs: ["src/**", "package.json"],
              dependsOn: ["//#lint:policy-fingerprint"],
            },
          },
        });
        yield* writeFixtureFingerprint(root);
        const baseline = yield* packageHash(root, binary);
        yield* writeJson(root, "standards/lint-policy.sweeps.jsonc", {
          schemaVersion: "lint-policy-sweeps/v1",
          deprecatedApis: "turbo",
        });
        expect(yield* packageHash(root, binary)).not.toBe(baseline);
        yield* writeJson(root, "standards/lint-policy.sweeps.jsonc", {
          schemaVersion: "lint-policy-sweeps/v1",
          deprecatedApis: "oxlint",
        });
        expect(yield* packageHash(root, binary)).toBe(baseline);
        yield* writeFile(root, "packages/unrelated/src/index.ts", "export const unrelated = 2;\n");
        expect(yield* packageHash(root, binary)).toBe(baseline);
        yield* writeJson(root, "packages/unrelated/package.json", { name: "@fixture/unrelated", private: false });
        expect(yield* packageHash(root, binary)).toBe(baseline);
        yield* writeFile(root, "packages/helper/src/index.ts", "export const value = 2;\n");
        expect(yield* packageHash(root, binary)).not.toBe(baseline);
        yield* writeFile(root, "packages/helper/src/index.ts", "export const value = 1;\n");
        expect(yield* packageHash(root, binary)).toBe(baseline);
        // Another command's closure is not this task's input: the per-task seal isolates it.
        yield* writeFile(root, "packages/sibling/src/index.ts", "export const value = 2;\n");
        expect(yield* packageHash(root, binary)).toBe(baseline);
        yield* writeFile(root, "packages/sibling/src/index.ts", "export const value = 1;\n");
        // The shell is shared by every command.
        const binMain = yield* fs.readFileString(path.join(root, "packages/cli/src/bin-main.ts"));
        yield* writeFile(root, "packages/cli/src/bin-main.ts", `${binMain}// edited\n`);
        expect(yield* packageHash(root, binary)).not.toBe(baseline);
        yield* writeFile(root, "packages/cli/src/bin-main.ts", binMain);
        expect(yield* packageHash(root, binary)).toBe(baseline);
        yield* writeJson(root, "packages/helper/package.json", {
          name: "@beep/helper",
          exports: { ".": "./src/index.ts" },
          description: "closure edit",
        });
        expect(yield* packageHash(root, binary)).not.toBe(baseline);
      })
    );
  });
});

describe("Documentation task inputs", { concurrent: false }, () => {
  it.layer(platform, { timeout: "30 seconds" })("native policy hashes", (it) => {
    it.effect(
      "retains replay policy, dependency edges and the nonrecursive root script",
      Effect.fnUntraced(function* () {
        const root = yield* findRepoRoot();
        const fs = yield* FileSystem.FileSystem;
        const config = yield* decodePolicyTasks(yield* fs.readFileString(`${root}/turbo.json`));
        expect(config.tasks["lint:deprecated-apis"]).toMatchObject(expectedPolicyTasks["lint:deprecated-apis"]);
        expect(config.tasks["lint:jsdoc"]).toMatchObject(expectedPolicyTasks["lint:jsdoc"]);
        expect(config.tasks["//#lint:jsdoc:root"]).toMatchObject(expectedPolicyTasks["//#lint:jsdoc:root"]);
        const manifest = yield* decodeScripts(yield* fs.readFileString(`${root}/package.json`));
        expect(manifest.scripts["lint:jsdoc:root"]).toBe("beep-cli lint jsdoc --root-only");
      })
    );

    it.effect(
      "isolates package checks while covering root residual sources and workspace discovery",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const repoRoot = yield* findRepoRoot();
        const config = yield* decodePolicyTasks(yield* fs.readFileString(`${repoRoot}/turbo.json`));
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "policy-docs-turbo-" });
        const binary = path.join(repoRoot, "node_modules", ".bin", "turbo");
        yield* writeJson(root, "package.json", {
          name: "policy-docs-fixture",
          private: true,
          packageManager: "bun@1.4.2",
          workspaces: ["packages/*", "packages/tooling/policy-pack/*"],
          scripts: {
            "lint:policy-fingerprint": "echo fingerprint",
            "lint:jsdoc:root": "beep-cli lint jsdoc --root-only",
          },
        });
        // Both lint leaves reach the helper and the rule modules, so those edits replay all three tasks.
        const closure = [
          "@fixture/helper",
          "@fixture/repo-configs/laws/rule",
          "@fixture/repo-configs/internal/laws/helper",
        ];
        yield* writeFixtureFiles(
          root,
          policyCliFixtureFiles([
            {
              group: "lint",
              leaves: [
                { name: "jsdoc", imports: closure },
                { name: "deprecated-apis", imports: closure },
              ],
            },
          ])
        );
        yield* writeJson(root, "packages/helper/package.json", {
          name: "@fixture/helper",
          exports: { ".": "./src/index.ts" },
        });
        yield* writeJson(root, "packages/tooling/policy-pack/repo-configs/package.json", {
          name: "@fixture/repo-configs",
          exports: {
            "./laws/rule": "./src/laws/rule.ts",
            "./internal/laws/helper": "./src/internal/laws/helper.ts",
          },
        });
        yield* writeJson(root, "packages/consumer/package.json", {
          name: "@fixture/consumer",
          dependencies: { "@fixture/dependency": "workspace:*" },
          scripts: {
            "lint:jsdoc": "beep-cli lint jsdoc --package .",
            "lint:deprecated-apis": "beep-cli lint deprecated-apis --package .",
          },
        });
        yield* writeJson(root, "packages/dependency/package.json", { name: "@fixture/dependency" });
        yield* writeJson(root, "packages/unrelated/package.json", { name: "@fixture/unrelated" });
        yield* writeFile(root, ".gitignore", "node_modules\n.turbo\n");
        // These files exist before configuration is frozen; each mutation is restored before the next.
        const sourceFiles = [
          "packages/helper/src/index.ts",
          "packages/consumer/src/index.ts",
          "packages/dependency/src/index.ts",
          "packages/unrelated/src/index.ts",
          "scripts/check.ts",
          "tools/check.ts",
          "scratchpad/check.ts",
          "apps/labs/probe/check.ts",
          "packages/probe/.context/check.ts",
          "infra/standalone/check.ts",
          "packages/tooling/policy-pack/repo-configs/src/laws/rule.ts",
          "packages/tooling/policy-pack/repo-configs/src/internal/laws/helper.ts",
        ];
        yield* Effect.forEach(sourceFiles, (file) => writeFile(root, file, "export const value = 1;\n"));
        yield* writeFile(root, ".oxlintrc.docs.json", "{}\n");
        yield* writeFile(root, ".oxlintrc.deprecated-apis.jsonc", "{}\n");
        yield* writeFile(root, "tsdoc.json", "{}\n");
        yield* writeFile(root, "tsconfig.proof.json", "{}\n");
        yield* writeJson(root, "turbo.json", {
          futureFlags: { affectedUsingTaskInputs: true, filterUsingTasks: true, globalConfiguration: true },
          tasks: {
            ...withFingerprintMarker(config.tasks),
            "//#lint:policy-fingerprint": { cache: true, outputs: [], inputs: [] },
          },
        });
        yield* writeFixtureFingerprint(root);
        const baseline = yield* policyHashes(root, binary);
        expect(O.getOrThrow(A.head(baseline)).dependencies).toContain("@fixture/dependency#transit");
        const assertMutation = Effect.fnUntraced(function* (file: string, changed: ReadonlyArray<boolean>) {
          const original = yield* fs.readFileString(path.join(root, file));
          yield* writeFile(root, file, `${original}\n`);
          const mutated = yield* policyHashes(root, binary);
          A.forEach(mutated, (task, index) => {
            expect(task.hash === baseline[index]?.hash, `${file}: ${task.taskId}`).toBe(
              !O.getOrThrow(A.get(changed, index))
            );
          });
          yield* writeFile(root, file, original);
          expect(yield* policyHashes(root, binary)).toEqual(baseline);
        });
        yield* assertMutation("packages/consumer/src/index.ts", [true, true, true]);
        yield* Effect.forEach(
          [
            "scripts/check.ts",
            "tools/check.ts",
            "scratchpad/check.ts",
            "apps/labs/probe/check.ts",
            "packages/probe/.context/check.ts",
          ],
          (file) => assertMutation(file, [false, false, false])
        );
        yield* assertMutation("infra/standalone/check.ts", [false, false, true]);
        yield* assertMutation("packages/unrelated/package.json", [true, false, true]);
        yield* assertMutation("packages/unrelated/src/index.ts", [false, false, true]);
        yield* assertMutation("packages/dependency/src/index.ts", [true, false, true]);
        // This root tsconfig is deliberately outside the fingerprint's two named tsconfigs.
        yield* assertMutation("tsconfig.proof.json", [true, false, false]);
        yield* Effect.forEach(
          [
            ".oxlintrc.deprecated-apis.jsonc",
            "tsdoc.json",
            "packages/tooling/policy-pack/repo-configs/src/laws/rule.ts",
            "packages/tooling/policy-pack/repo-configs/src/internal/laws/helper.ts",
            "packages/helper/src/index.ts",
          ],
          (file) => assertMutation(file, [true, true, true])
        );
      }),
      { timeout: 180_000 }
    );
  });
});
