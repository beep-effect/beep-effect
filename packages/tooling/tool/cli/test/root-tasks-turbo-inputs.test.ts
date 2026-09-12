import { $RepoCliId } from "@beep/identity/packages";
import { StepExec } from "@beep/repo-cli/test/PackageScripts";
import { TurboConfigProofTaskName } from "@beep/repo-cli/test/Quality";
import { FsUtilsLive, findRepoRoot, jsonStringifyPretty } from "@beep/repo-utils";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";

const $I = $RepoCliId.create("test/root-tasks-turbo-inputs");
const fingerprintId = "//#lint:policy-fingerprint";
const nonInput = ".beep/c3-fixture-excluded.bin";
const providePlatform = provideScopedLayer(FsUtilsLive.pipe(Layer.provideMerge(NodeServices.layer)));
const Strings = S.Array(S.String).pipe(S.withDecodingDefaultKey(Effect.succeed([])));

class RootTask extends S.Class<RootTask>($I`RootTask`)(
  {
    cache: S.Boolean,
    inputs: S.Array(S.String),
    outputs: Strings,
    dependsOn: Strings,
    env: Strings,
    passThroughEnv: Strings,
  },
  $I.annote("RootTask", { description: "Root task declarations copied into the real Turbo fixture." })
) {}
class TaskSummary extends S.Class<TaskSummary>($I`TaskSummary`)(
  { taskId: S.String, hash: S.String, inputs: S.Record(S.String, S.String), dependencies: S.Array(S.String) },
  $I.annote("TaskSummary", {
    description: "Observed hashes and input membership from Turbo, never synthesized hashes.",
  })
) {}
const Configuration = S.Struct({ tasks: S.Record(S.String, S.Unknown), global: S.Unknown, futureFlags: S.Unknown });
const Manifest = S.Struct({ scripts: S.Record(S.String, S.String) });
const Summary = S.Struct({ tasks: S.Array(TaskSummary) });
const decodeConfiguration = S.decodeEffect(S.fromJsonString(Configuration));
const decodeManifest = S.decodeEffect(S.fromJsonString(Manifest));
const decodeTask = S.decodeUnknownEffect(RootTask);
const decodeSummary = S.decodeEffect(S.fromJsonString(Summary));

// One direct read per §2.2 row, including expanded Fallow rows. These are independent
// probes, not strings derived from the input globs whose behavior we are testing.
const nonReusableTasks: ReadonlyArray<string> = [
  "knowledge:semantic-delta",
  "knowledge:refs-check",
  "lint:oxlint",
  "lint:jsdoc-module-tags",
  "goals:doctor",
  "lint:typos",
  "knip:check",
  "fallow:audit:check",
  "fallow:health:advisory",
  "fallow:boundaries:advisory",
  "fallow:flags:advisory",
  "fallow:security:advisory",
  "fallow:fix-preview:advisory",
  "jsdoc:inventory:check",
  "changeset:status",
  "fallow:dead-code:check",
  "repo-sanity:bun-audit",
  "fallow:boundaries:config-check",
];

const directInputs: Readonly<Record<string, string>> = {
  "lint:policy-fingerprint": "standards/policy-tools.fingerprint.json",
  "lint:jsdoc:root": "scripts/c3-probe.ts",
  "lint:native-runtime:roots": "scratchpad/c3-probe.ts",
  "lint:package-scripts": "packages/fixture/vitest.config.ts",
  "knowledge:semantic-delta": "docs/c3-probe.md",
  "knowledge:refs-check": "docs/c3-probe.md",
  "lint:schema-first": "standards/schema-first.inventory.jsonc",
  "lint:identity-registry": "tools/fixture/c3-probe.ts",
  "lint:circular": "packages/foundation/fixture/src/c3-probe.ts",
  "lint:effect-imports": "apps/fixture/c3-probe.mts",
  "lint:effect-imports-markdown": ".patterns/c3-probe.md",
  "lint:tsgo-rules": "tooling/c3-probe.cts",
  "lint:oxlint": "scripts/c3-probe.ts",
  "lint:ecosystem-polarity": "packages/ecosystem/fixture/src/c3-probe.mts",
  "lint:allowlist": "standards/effect-laws.allowlist.jsonc",
  "lint:jsdoc-module-tags": "tooling/c3-probe.hbs",
  "goals:doctor": "goals/fixture/GOAL.md",
  "goals:index-check": "goals/fixture/GOAL.md",
  "lint:reflection-artifacts": "goals/fixture/history/reflections/c3-probe.md",
  "lint:roadmap-refs": "assets/c3-probe.bin",
  "lint:judge-rubric": ".claude/skills/browser-qa-loop/resources/judge-prompt.md",
  "lint:typos": "docs/c3-probe.md",
  "knip:check": "standards/knip.regression-baseline.jsonc",
  "fallow:audit:check": ".fallow/plugins/c3-probe.ts",
  "fallow:dead-code:check": ".fallow/plugins/c3-probe.ts",
  "fallow:health:advisory": ".fallow/plugins/c3-probe.ts",
  "fallow:boundaries:advisory": ".fallow/plugins/c3-probe.ts",
  "fallow:flags:advisory": ".fallow/plugins/c3-probe.ts",
  "fallow:security:advisory": ".fallow/plugins/c3-probe.ts",
  "fallow:fix-preview:advisory": ".fallow/plugins/c3-probe.ts",
  "jsdoc:inventory:check": "packages/fixture/docgen.json",
  "changeset:status": ".changeset/c3-probe.md",
  "config-sync:check": "packages/fixture/docgen.json",
  "repo-sanity:changeset-graph": ".changeset/c3-probe.md",
  "repo-sanity:syncpack": "syncpack.config.ts",
  "repo-sanity:sherif": "packages/fixture/package.json",
  "repo-sanity:versions": "mise.toml",
  "repo-sanity:bun-audit": "osv-scanner.toml",
  "fallow:boundaries:config-check": "standards/fallow.boundaries.generated.jsonc",
  "topo-sort": "packages/fixture/package.json",
};

const writeFile = Effect.fn("RootTasksFixture.writeFile")(function* (root: string, file: string, text: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const target = path.join(root, file);
  yield* fs.makeDirectory(path.dirname(target), { recursive: true });
  yield* fs.writeFileString(target, text);
});
const writeJson = Effect.fn("RootTasksFixture.writeJson")(function* (root: string, file: string, value: unknown) {
  yield* writeFile(root, file, `${yield* jsonStringifyPretty(value)}\n`);
});
const fixture = Effect.fn("RootTasksFixture.make")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repo = yield* findRepoRoot();
  const configuration = yield* decodeConfiguration(yield* fs.readFileString(path.join(repo, "turbo.json")));
  const manifest = yield* decodeManifest(yield* fs.readFileString(path.join(repo, "package.json")));
  const rootEntries = yield* Effect.forEach(
    A.filter(R.toEntries(configuration.tasks), ([id]) => Str.startsWith("//#")(id)),
    Effect.fnUntraced(function* ([id, raw]) {
      return Tuple.make(id, yield* decodeTask(raw));
    })
  );
  const tasks = R.fromEntries(rootEntries);
  expect(A.length(rootEntries)).toBe(A.length(R.keys(directInputs)));
  for (const [id, task] of rootEntries) {
    expect(S.is(TurboConfigProofTaskName)(id), id).toBe(true);
    expect(R.has(directInputs, Str.slice(3)(id)), id).toBe(true);
    expect(R.has(manifest.scripts, Str.slice(3)(id)), id).toBe(true);
    const script = O.getOrThrow(R.get(manifest.scripts, Str.slice(3)(id)));
    if (
      id !== fingerprintId &&
      (Str.startsWith("bun run beep")(script) || Str.startsWith("beep-cli")(script) || id === "//#repo-sanity:versions")
    ) {
      expect(task.dependsOn, id).toEqual([fingerprintId]);
    }
    expect(task.cache, id).toBe(!A.contains(nonReusableTasks, Str.slice(3)(id)));
    const name = Str.slice(3)(id);
    const fallowEnvelope = Str.startsWith("fallow:")(name) && name !== "fallow:boundaries:config-check";
    expect(task.env, id).toEqual(fallowEnvelope ? ["BEEP_PROOF_BASE"] : []);
    expect(task.passThroughEnv, id).toEqual(id === "//#knowledge:semantic-delta" ? ["GITHUB_EVENT_PATH"] : []);
    if (fallowEnvelope) {
      const lane = O.getOrThrow(A.get(Str.split(":")(name), 1));
      const mode = Str.endsWith(":check")(name) ? "check" : "advisory";
      expect(task.outputs, id).toEqual([`.beep/fallow/${lane}.${mode}.json`, `.beep/fallow/raw/${lane}.${mode}.*`]);
    } else {
      expect(task.outputs, id).toEqual(
        id === "//#jsdoc:inventory:check" ? [".beep/ci/jsdoc-documentation.inventory.*"] : []
      );
    }
  }
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "root-tasks-turbo-" });
  yield* writeFile(root, ".gitignore", "node_modules\n.turbo\n");
  yield* writeJson(root, "package.json", {
    name: "root-tasks-fixture",
    private: true,
    packageManager: "bun@1.4.2",
    workspaces: ["packages/fixture"],
    scripts: manifest.scripts,
  });
  yield* Effect.forEach(A.dedupe([...R.values(directInputs), nonInput]), (file) => writeFile(root, file, "{}\n"));
  yield* writeJson(root, "packages/fixture/package.json", { name: "@fixture/member" });
  // Candidate tool reads omitted from many direct row inputs, but carried by D15.
  // All are real entries in the production fingerprint declaration.
  yield* Effect.forEach(closureInputs, (file) => writeFile(root, file, "{}\n"));
  yield* writeJson(root, "turbo.json", { ...configuration, tasks });
  return { root, tasks, binary: path.join(repo, "node_modules/.bin/turbo") };
});
const closureInputs = [
  ".fallowrc.jsonc",
  "_typos.toml",
  "biome.jsonc",
  "packages/drivers/duckdb/src/c3-probe.ts",
  "packages/tooling/tool/cli/src/c3-probe.ts",
];
const dryRun = Effect.fn("RootTasksFixture.dryRun")(function* (
  root: string,
  binary: string,
  taskIds: ReadonlyArray<string>,
  affected: boolean
) {
  const result = yield* StepExec.runCaptured({
    command: binary,
    args: ["run", ...taskIds, "--dry-run=json", "--cache=local:rw", ...(affected ? ["--affected"] : [])],
    cwd: root,
    source: "stdout",
    timeout: "30 seconds",
    extendEnv: true,
    env: { TURBO_TELEMETRY_DISABLED: "1", TURBO_UI: "stream", TURBO_SCM_BASE: "HEAD", TURBO_SCM_HEAD: "HEAD" },
  });
  expect(result.exitCode, result.output).toBe(0);
  expect(result.truncated).toBe(false);
  return (yield* decodeSummary(result.output)).tasks;
});
const rowFor = (rows: ReadonlyArray<TaskSummary>, id: string) =>
  O.getOrThrow(A.findFirst(rows, (row) => row.taskId === id));
const mutate = Effect.fn("RootTasksFixture.mutate")(function* <E, R>(
  root: string,
  file: string,
  check: Effect.Effect<void, E, R>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const original = yield* fs.readFileString(path.join(root, file));
  yield* writeFile(root, file, `${original}\n`);
  yield* check.pipe(Effect.ensuring(writeFile(root, file, original).pipe(Effect.orDie)));
});

describe("Stage C root task inputs", { concurrent: false }, () => {
  it.effect(
    "hashes declared inputs and excludes non-inputs for every registered root task",
    Effect.fnUntraced(function* () {
      const { root, tasks, binary } = yield* fixture();
      const ids = R.keys(tasks);
      const baseline = yield* dryRun(root, binary, ids, false);
      expect(A.length(baseline)).toBe(A.length(ids));
      for (const [name, file] of R.toEntries(directInputs)) {
        const id = `//#${name}`;
        expect(R.has(rowFor(baseline, id).inputs, file), `${id}: ${file}`).toBe(true);
        yield* mutate(
          root,
          file,
          Effect.gen(function* () {
            const changed = yield* dryRun(root, binary, ids, false);
            expect(rowFor(changed, id).hash, `${id}: ${file}`).not.toBe(rowFor(baseline, id).hash);
          })
        );
      }
      yield* mutate(
        root,
        nonInput,
        Effect.gen(function* () {
          const changed = yield* dryRun(root, binary, ids, false);
          for (const id of ids) {
            expect(R.has(rowFor(baseline, id).inputs, nonInput), id).toBe(false);
            expect(rowFor(changed, id).hash, id).toBe(rowFor(baseline, id).hash);
          }
        })
      );
      expect(yield* dryRun(root, binary, ids, false)).toEqual(baseline);
    }, providePlatform),
    { timeout: 180_000 }
  );

  it.effect(
    "closes tool reads through the fingerprint for every CLI-backed task",
    Effect.fnUntraced(function* () {
      const { root, tasks, binary } = yield* fixture();
      const ids = R.keys(tasks);
      const baseline = yield* dryRun(root, binary, ids, false);
      for (const [id, task] of R.toEntries(tasks)) {
        if (!A.contains(task.dependsOn, fingerprintId)) continue;
        const outside = A.findFirst(closureInputs, (file) => !R.has(rowFor(baseline, id).inputs, file));
        // Roadmap's whole-tree contract already includes every candidate tool read.
        if (O.isNone(outside)) expect(id).toBe("//#lint:roadmap-refs");
        const candidate = O.getOrElse(outside, () => "packages/tooling/tool/cli/src/c3-probe.ts");
        expect(R.has(rowFor(baseline, fingerprintId).inputs, candidate), candidate).toBe(true);
        expect(rowFor(baseline, id).dependencies, id).toContain(fingerprintId);
        yield* mutate(
          root,
          candidate,
          Effect.gen(function* () {
            const changed = yield* dryRun(root, binary, ids, false);
            expect(rowFor(changed, fingerprintId).hash).not.toBe(rowFor(baseline, fingerprintId).hash);
            expect(rowFor(changed, id).hash, `${id}: ${candidate}`).not.toBe(rowFor(baseline, id).hash);
          })
        );
      }
    }, providePlatform),
    { timeout: 180_000 }
  );

  // Fable runs this case separately: it writes Git state only inside its synthetic
  // fixture. The implementer lane selects the two hash cases with -t.
  it.effect(
    "selects root tasks under --affected from declared inputs only (Git fixture)",
    Effect.fnUntraced(function* () {
      const { root, tasks, binary } = yield* fixture();
      for (const args of [
        ["init", "--initial-branch=main"],
        ["add", "."],
        [
          "-c",
          "user.name=Turbo Fixture",
          "-c",
          "user.email=turbo-fixture@example.invalid",
          "-c",
          "commit.gpgsign=false",
          "commit",
          "--no-verify",
          "-m",
          "fixture",
        ],
      ]) {
        const result = yield* StepExec.runCaptured({
          command: "git",
          args,
          cwd: root,
          source: "stdout",
          extendEnv: true,
        });
        expect(result.exitCode, result.output).toBe(0);
      }
      const ids = R.keys(tasks);
      expect(yield* dryRun(root, binary, ids, true)).toEqual([]);
      for (const [name, file] of R.toEntries(directInputs)) {
        yield* mutate(
          root,
          file,
          Effect.gen(function* () {
            const selected = yield* dryRun(root, binary, ids, true);
            expect(
              A.map(selected, (row) => row.taskId),
              `${name}: ${file}`
            ).toContain(`//#${name}`);
          })
        );
      }
      yield* mutate(
        root,
        nonInput,
        Effect.gen(function* () {
          expect(yield* dryRun(root, binary, ids, true)).toEqual([]);
        })
      );
    }, providePlatform),
    { timeout: 180_000 }
  );
});
