import { fcRuns } from "@beep/fc-runs";
import { $RepoCliId } from "@beep/identity/packages";
import { moduleRootFileReads, POLICY_ROOT_FILE_ROUTES, POLICY_SHARED_ROOT_FILES } from "@beep/repo-cli/test/Lint";
import { PolicyToolsFingerprintPolicy, StepExec } from "@beep/repo-cli/test/PackageScripts";
import { FsUtils, FsUtilsLive, findRepoRoot, GlobOptions, jsonStringifyPretty } from "@beep/repo-utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
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

const SEAL = "@beep/repo-cli#lint:policy-fingerprint:";
const TURBO_ROOT = "$TURBO_ROOT$/";
const expectedPolicyTasks = {
  "lint:deprecated-apis": {
    cache: true,
    outputs: [],
    dependsOn: ["^transit", `${SEAL}lint-deprecated-apis`],
  },
  "lint:jsdoc": { cache: true, outputs: [], dependsOn: [`${SEAL}lint-jsdoc`] },
  "//#lint:jsdoc:root": { cache: true, outputs: [], dependsOn: [`${SEAL}lint-jsdoc`] },
};
// Every seal id, current or a legacy root seal (`//#lint:policy-fingerprint:<key>`).
const isSeal = Str.includes("#lint:policy-fingerprint:");
const TurboTasks = S.Struct({
  tasks: S.Record(
    S.String,
    S.Struct({
      dependsOn: S.Array(S.String).pipe(S.optionalKey),
      cache: S.Boolean.pipe(S.optionalKey),
      outputs: S.Array(S.String).pipe(S.optionalKey),
      inputs: S.Array(S.String).pipe(S.optionalKey),
    })
  ),
});
const TYPESCRIPT_SOURCE = /\.(?:ts|tsx|mts|cts)$/;
const routedFiles = A.flatMap(POLICY_ROOT_FILE_ROUTES, (route) => route.files);
const decodeTurboTasks = S.decodeEffect(S.fromJsonString(TurboTasks));

const RootScripts = S.Struct({ scripts: S.Record(S.String, S.String) });
const decodeScripts = S.decodeEffect(S.fromJsonString(RootScripts));
const decodeSummary = S.decodeEffect(S.fromJsonString(FingerprintRunSummary));
const encodeSummary = S.encodeEffect(S.fromJsonString(FingerprintRunSummary));
const summaryEquivalent = S.toEquivalence(FingerprintRunSummary);
const FingerprintRunSummaryArbitrary = Arbitrary.schema(FingerprintRunSummary);
const platform = FsUtilsLive.pipe(Layer.provideMerge(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer)));

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
  expect(A.some(summary.tasks, (row) => row.taskId === `${SEAL}shared`)).toBe(true);
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
      const encodedSummary = yield* encodeSummary(decoded);
      expect(encodedSummary).toBe(encoded);
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
        const readFileString1 = yield* fs.readFileString(`${root}/turbo.json`);
        const config = yield* decodeTurboTasks(readFileString1);
        expect(config.tasks["//#lint:policy-fingerprint"]).toMatchObject({ cache: true, outputs: [] });
        for (const [task, value] of R.toEntries(config.tasks)) {
          // Nothing depends on the drift check: its inputs span every seal.
          expect(value.dependsOn ?? [], task).not.toContain("//#lint:policy-fingerprint");
        }
        const readFileString2 = yield* fs.readFileString(`${root}/package.json`);
        const manifest = yield* decodeScripts(readFileString2);
        expect(manifest.scripts["lint:policy-fingerprint"]).toBe("beep-cli lint policy-fingerprint --check");
        // The seals are script-less CLI-workspace tasks (quality audit M9): no root `true` script remains,
        // and every seal input is root-relative.
        expect(A.filter(R.keys(manifest.scripts), Str.startsWith("lint:policy-fingerprint:"))).toEqual([]);
        for (const [task, value] of R.toEntries(config.tasks)) {
          if (!isSeal(task)) continue;
          expect(Str.startsWith(SEAL)(task), task).toBe(true);
          expect(
            A.filter(value.inputs ?? [], (input) => !Str.startsWith(TURBO_ROOT)(input)),
            task
          ).toEqual([]);
        }
      })
    );

    it.effect(
      "declares in every seal chain each root file its closure modules read",
      Effect.fnUntraced(function* () {
        const root = yield* findRepoRoot();
        const fs = yield* FileSystem.FileSystem;
        const fsUtils = yield* FsUtils;
        const readFileString3 = yield* fs.readFileString(`${root}/turbo.json`);
        const config = yield* decodeTurboTasks(readFileString3);
        const seals = A.filter(R.toEntries(config.tasks), ([task]) => isSeal(task));
        expect(A.length(seals)).toBeGreaterThan(1);
        const declaredOf = (task: string): ReadonlyArray<string> => {
          const value = config.tasks[task];
          return [
            ...A.map(value?.inputs ?? [], Str.slice(Str.length(TURBO_ROOT))),
            ...A.flatMap(value?.dependsOn ?? [], declaredOf),
          ];
        };
        // Re-derive each chain's reads from the declared modules' live text, independently of the writer;
        // a whole-`src` input (an opaque dynamic import) contributes every TypeScript file under it.
        const modulesOf = Effect.fnUntraced(function* (input: string) {
          if (TYPESCRIPT_SOURCE.test(input)) return [input];
          if (!Str.endsWith("/src/**")(input)) return [];
          const directory = Str.slice(0, -Str.length("/**"))(input);
          const files = yield* fsUtils.globFiles("**/*", GlobOptions.make({ cwd: `${root}/${directory}` }));
          return A.map(
            A.filter(files, (file) => TYPESCRIPT_SOURCE.test(file)),
            (file) => `${directory}/${file}`
          );
        });
        const forEach4 = yield* Effect.forEach(A.dedupe(A.flatMap(seals, ([task]) => declaredOf(task))), modulesOf);
        const modules = A.dedupe(A.flatten(forEach4));
        const forEach5 = yield* Effect.forEach(
          modules,
          Effect.fnUntraced(function* (module) {
            const readFileString23 = yield* fs.readFileString(`${root}/${module}`);
            return [module, moduleRootFileReads(module, readFileString23)] as const;
          })
        );
        const reads = HashMap.fromIterable(forEach5);
        for (const [task] of seals) {
          const declared = declaredOf(task);
          const forEach6 = yield* Effect.forEach(declared, modulesOf);
          const read = A.flatMap(A.flatten(forEach6), (module) =>
            O.getOrElse(HashMap.get(reads, module), A.empty<string>)
          );
          expect(A.dedupe(A.filter(read, (file) => !A.contains(declared, file))), task).toEqual([]);
          // A seal's root-level inputs are the shared ones or routed families, nothing else.
          const rootLevel = A.filter(declared, (input) => !Str.includes("/")(input) || A.contains(routedFiles, input));
          expect(
            A.filter(rootLevel, (input) => !A.contains([...POLICY_SHARED_ROOT_FILES, ...routedFiles], input)),
            task
          ).toEqual([]);
        }
        // The per-package policy chains read no root `turbo.json` (the M9 cascade).
        for (const key of ["lint-laws", "lint-jsdoc"])
          expect(declaredOf(`${SEAL}${key}`), key).not.toContain("turbo.json");
      }),
      { timeout: 60_000 }
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
            { group: "lint", leaves: [{ name: "jsdoc", imports: ["@beep/helper", "@beep/sweeps"] }] },
            { group: "other", imports: ["@beep/sibling"] },
          ]),
          ...fixturePackageFiles("helper"),
          ...fixturePackageFiles("sibling"),
          ...fixturePackageFiles("sweeps"),
          // The one module that names the sweeps file: that root file is routed to this command's seal.
          "packages/sweeps/src/index.ts": 'export const value = "standards/lint-policy.sweeps.jsonc";\n',
        });
        yield* writeJson(root, "packages/consumer/package.json", {
          name: "@fixture/consumer",
          scripts: { "lint:jsdoc": "beep-cli lint jsdoc --package ." },
        });
        yield* writeJson(root, "packages/unrelated/package.json", { name: "@fixture/unrelated", private: true });
        yield* writeFile(root, ".gitignore", "node_modules\n.turbo\n");
        yield* writeFile(root, "packages/consumer/src/index.ts", "export const consumer = 1;\n");
        yield* writeFile(root, "packages/unrelated/src/index.ts", "export const unrelated = 1;\n");
        yield* writeFile(root, "_typos.toml", "[default]\n");
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
        const packageHash7 = yield* packageHash(root, binary);
        expect(packageHash7).not.toBe(baseline);
        yield* writeJson(root, "standards/lint-policy.sweeps.jsonc", {
          schemaVersion: "lint-policy-sweeps/v1",
          deprecatedApis: "oxlint",
        });
        const packageHash8 = yield* packageHash(root, binary);
        expect(packageHash8).toBe(baseline);
        // A root file no closure module names is no seal input.
        yield* writeFile(root, "_typos.toml", '[default]\nlocale = "en-us"\n');
        const packageHash9 = yield* packageHash(root, binary);
        expect(packageHash9).toBe(baseline);
        // Turbo hashes the root `turbo.json` into root tasks only; the CLI-workspace seal keeps a
        // `turbo.json` edit out of package policy tasks (quality audit M9).
        const turboText = yield* fs.readFileString(path.join(root, "turbo.json"));
        yield* writeFile(root, "turbo.json", `${turboText}\n`);
        const packageHash10 = yield* packageHash(root, binary);
        expect(packageHash10).toBe(baseline);
        yield* writeFile(root, "turbo.json", turboText);
        yield* writeFile(root, "packages/unrelated/src/index.ts", "export const unrelated = 2;\n");
        const packageHash11 = yield* packageHash(root, binary);
        expect(packageHash11).toBe(baseline);
        yield* writeJson(root, "packages/unrelated/package.json", { name: "@fixture/unrelated", private: false });
        const packageHash12 = yield* packageHash(root, binary);
        expect(packageHash12).toBe(baseline);
        yield* writeFile(root, "packages/helper/src/index.ts", "export const value = 2;\n");
        const packageHash13 = yield* packageHash(root, binary);
        expect(packageHash13).not.toBe(baseline);
        yield* writeFile(root, "packages/helper/src/index.ts", "export const value = 1;\n");
        const packageHash14 = yield* packageHash(root, binary);
        expect(packageHash14).toBe(baseline);
        // Another command's closure is not this task's input: the per-task seal isolates it.
        yield* writeFile(root, "packages/sibling/src/index.ts", "export const value = 2;\n");
        const packageHash15 = yield* packageHash(root, binary);
        expect(packageHash15).toBe(baseline);
        yield* writeFile(root, "packages/sibling/src/index.ts", "export const value = 1;\n");
        // The shell is shared by every command.
        const binMain = yield* fs.readFileString(path.join(root, "packages/cli/src/bin-main.ts"));
        yield* writeFile(root, "packages/cli/src/bin-main.ts", `${binMain}// edited\n`);
        const packageHash16 = yield* packageHash(root, binary);
        expect(packageHash16).not.toBe(baseline);
        yield* writeFile(root, "packages/cli/src/bin-main.ts", binMain);
        const packageHash17 = yield* packageHash(root, binary);
        expect(packageHash17).toBe(baseline);
        yield* writeJson(root, "packages/helper/package.json", {
          name: "@beep/helper",
          exports: { ".": "./src/index.ts" },
          description: "closure edit",
        });
        const packageHash18 = yield* packageHash(root, binary);
        expect(packageHash18).not.toBe(baseline);
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
        const readFileString19 = yield* fs.readFileString(`${root}/turbo.json`);
        const config = yield* decodePolicyTasks(readFileString19);
        expect(config.tasks["lint:deprecated-apis"]).toMatchObject(expectedPolicyTasks["lint:deprecated-apis"]);
        expect(config.tasks["lint:jsdoc"]).toMatchObject(expectedPolicyTasks["lint:jsdoc"]);
        expect(config.tasks["//#lint:jsdoc:root"]).toMatchObject(expectedPolicyTasks["//#lint:jsdoc:root"]);
        const readFileString20 = yield* fs.readFileString(`${root}/package.json`);
        const manifest = yield* decodeScripts(readFileString20);
        expect(manifest.scripts["lint:jsdoc:root"]).toBe("beep-cli lint jsdoc --root-only");
      })
    );

    it.effect(
      "isolates package checks while covering root residual sources and workspace discovery",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const repoRoot = yield* findRepoRoot();
        const readFileString21 = yield* fs.readFileString(`${repoRoot}/turbo.json`);
        const config = yield* decodePolicyTasks(readFileString21);
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
          const policyHashes22 = yield* policyHashes(root, binary);
          expect(policyHashes22).toEqual(baseline);
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
        // No fixture closure module names a checker configuration, so each one replays only the
        // tasks that declare it: the routed seal families are proven against the live CLI separately.
        yield* assertMutation(".oxlintrc.deprecated-apis.jsonc", [true, false, false]);
        yield* Effect.forEach([".oxlintrc.docs.json", "tsdoc.json"], (file) =>
          assertMutation(file, [false, true, true])
        );
        yield* Effect.forEach(
          [
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
