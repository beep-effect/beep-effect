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

describe("policy fingerprint Turbo inputs", { concurrent: false }, () => {
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
