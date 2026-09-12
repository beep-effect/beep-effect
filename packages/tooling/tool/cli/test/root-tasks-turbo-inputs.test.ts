import { $RepoCliId } from "@beep/identity/packages";
import { StepExec } from "@beep/repo-cli/test/PackageScripts";
import { TurboConfigProofTaskName } from "@beep/repo-cli/test/Quality";
import { FsUtilsLive, findRepoRoot, jsonStringifyPretty } from "@beep/repo-utils";
import { fcRuns, provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const $I = $RepoCliId.create("test/root-tasks-turbo-inputs");
const fingerprintId = "//#lint:policy-fingerprint";
const nonInput = ".beep/c3-fixture-excluded.bin";
const providePlatform = provideScopedLayer(FsUtilsLive.pipe(Layer.provideMerge(NodeServices.layer)));
const isProofTaskName = S.is(TurboConfigProofTaskName);
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
const encodeTaskSummary = S.encodeEffect(S.fromJsonString(TaskSummary));
const decodeTaskSummary = S.decodeEffect(S.fromJsonString(TaskSummary));
const encodeRootTask = S.encodeEffect(S.fromJsonString(RootTask));
const decodeRootTask = S.decodeEffect(S.fromJsonString(RootTask));
const taskSummaryEquivalent = S.toEquivalence(TaskSummary);
const rootTaskEquivalent = S.toEquivalence(RootTask);
const fixtureArbitrary = Arbitrary.all([Arbitrary.schema(TaskSummary), Arbitrary.schema(RootTask)]);

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
  "fallow:health:check",
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
  "fallow:health:check": ".fallow/plugins/c3-probe.ts",
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
    expect(isProofTaskName(id), id).toBe(true);
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
  const root = yield* fs.makeTempDirectoryScoped({ directory: "/tmp", prefix: "root-tasks-turbo-" });
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
    env: { TURBO_TELEMETRY_DISABLED: "1", TURBO_UI: "stream", TURBO_SCM_BASE: "base", TURBO_SCM_HEAD: "HEAD" },
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

const git = Effect.fn("RootTasksFixture.git")(function* (root: string, args: ReadonlyArray<string>) {
  const result = yield* StepExec.runCaptured({
    command: "git",
    args,
    cwd: root,
    source: "stdout",
    extendEnv: true,
  });
  expect(result.exitCode, result.output).toBe(0);
  return result;
});
const commit = (root: string) =>
  git(root, [
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
  ]);
const initializeGit = Effect.fn("RootTasksFixture.initializeGit")(function* (root: string) {
  yield* git(root, ["init", "--initial-branch=main"]);
  yield* writeFile(root, "README.md", "fixture base\n");
  yield* git(root, ["add", "."]);
  yield* commit(root);
  yield* git(root, ["branch", "base"]);
  yield* writeFile(root, "README.md", "fixture readme change\n");
  yield* git(root, ["add", "README.md"]);
  yield* commit(root);
  expect((yield* git(root, ["status", "--porcelain"])).output).toBe("");
});
const selectedIds = (rows: ReadonlyArray<TaskSummary>) =>
  A.sort(
    A.map(rows, (row) => row.taskId),
    Str.Order
  );
const withDependencies = (ids: ReadonlyArray<string>, rows: ReadonlyArray<TaskSummary>) =>
  A.sort(A.dedupe([...ids, ...A.flatMap(ids, (id) => rowFor(rows, id).dependencies)]), Str.Order);

describe("Stage C root task inputs", { concurrent: false }, () => {
  it("round-trips the fixture's schema-derived rows through JSON", () =>
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          fixtureArbitrary,
          ([summary, task]) => {
            const encodedSummary = Effect.runSync(encodeTaskSummary(summary));
            const decodedSummary = Effect.runSync(decodeTaskSummary(encodedSummary));
            expect(taskSummaryEquivalent(decodedSummary, summary)).toBe(true);
            expect(Effect.runSync(encodeTaskSummary(decodedSummary))).toBe(encodedSummary);
            const encodedTask = Effect.runSync(encodeRootTask(task));
            const decodedTask = Effect.runSync(decodeRootTask(encodedTask));
            expect(rootTaskEquivalent(decodedTask, task)).toBe(true);
            expect(Effect.runSync(encodeRootTask(decodedTask))).toBe(encodedTask);
            return true;
          },
          fcRuns(25)
        )
      )._tag
    ).toBe("Passed"));

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

  it.effect(
    "selects root tasks under --affected from declared inputs only (Git fixture)",
    Effect.fnUntraced(function* () {
      const { root, tasks, binary } = yield* fixture();
      yield* initializeGit(root);
      const ids = R.keys(tasks);
      const baseline = yield* dryRun(root, binary, ids, false);
      const readmeIds = A.map(
        A.filter(baseline, (row) => R.has(row.inputs, "README.md")),
        (row) => row.taskId
      );
      expect(readmeIds).toEqual(expect.arrayContaining(["//#lint:roadmap-refs", "//#lint:typos"]));
      expect(selectedIds(yield* dryRun(root, binary, A.map(ids, Str.slice(3)), true))).toEqual(
        withDependencies(readmeIds, baseline)
      );
      // Scope each independent row probe to that row and the whole-tree walkers.
      // Other production rows intentionally share source/config globs.
      const wholeTreeIds = A.map(
        A.filter(R.toEntries(tasks), ([, task]) => A.contains(task.inputs, "**/*")),
        ([id]) => id
      );
      for (const [name, file] of R.toEntries(directInputs)) {
        const requested = A.dedupe([`//#${name}`, ...wholeTreeIds]);
        yield* mutate(
          root,
          file,
          Effect.gen(function* () {
            const isolated = yield* dryRun(root, binary, [name], true);
            expect(selectedIds(isolated), `${name}: isolated ${file}`).toEqual(
              withDependencies([`//#${name}`], baseline)
            );
            const selected = yield* dryRun(root, binary, A.map(requested, Str.slice(3)), true);
            expect(selectedIds(selected), `${name}: ${file}`).toEqual(withDependencies(requested, baseline));
          })
        );
      }
      // README is an input of the two whole-tree walkers. A non-input edit adds
      // no selection to that committed baseline; all other requested rows stay absent.
      yield* mutate(
        root,
        nonInput,
        Effect.gen(function* () {
          expect(selectedIds(yield* dryRun(root, binary, A.map(ids, Str.slice(3)), true))).toEqual(
            withDependencies(readmeIds, baseline)
          );
          const narrow = A.filter(ids, (id) => !A.contains(readmeIds, id));
          expect(yield* dryRun(root, binary, A.map(narrow, Str.slice(3)), true)).toEqual([]);
        })
      );
    }, providePlatform),
    { timeout: 180_000 }
  );

  it.effect(
    "explicit root selectors bypass --affected for the same non-input edit",
    Effect.fnUntraced(function* () {
      const { root, tasks, binary } = yield* fixture();
      yield* initializeGit(root);
      const ids = R.keys(tasks);
      yield* mutate(
        root,
        nonInput,
        Effect.gen(function* () {
          expect(selectedIds(yield* dryRun(root, binary, ids, true))).toEqual(A.sort(ids, Str.Order));
          const bare = yield* dryRun(root, binary, A.map(ids, Str.slice(3)), true);
          expect(selectedIds(bare)).not.toEqual(A.sort(ids, Str.Order));
        })
      );
    }, providePlatform),
    { timeout: 180_000 }
  );

  it.effect(
    "excludes loose Git objects from every registered root task hash",
    Effect.fnUntraced(function* () {
      const { root, tasks, binary } = yield* fixture();
      yield* initializeGit(root);
      const ids = R.keys(tasks);
      const baseline = yield* dryRun(root, binary, ids, false);
      // Non-input bytes are absent from the initial commit, so this creates a new object.
      yield* writeFile(root, nonInput, "untracked object payload\n");
      const candidate = yield* git(root, ["hash-object", "--", nonInput]);
      const fs = yield* FileSystem.FileSystem;
      const candidateHash = Str.trim(candidate.output);
      expect(
        yield* fs.exists(`${root}/.git/objects/${Str.slice(0, 2)(candidateHash)}/${Str.slice(2)(candidateHash)}`)
      ).toBe(false);
      // Hash a new blob without adding any working-tree input or updating refs.
      const object = yield* git(root, ["hash-object", "-w", "--", nonInput]);
      const hash = Str.trim(object.output);
      expect(yield* fs.exists(`${root}/.git/objects/${Str.slice(0, 2)(hash)}/${Str.slice(2)(hash)}`)).toBe(true);
      yield* writeFile(root, "nested/.git/objects/ab/c3-probe", "nested git metadata");
      const changed = yield* dryRun(root, binary, ids, false);
      for (const id of ids) {
        expect(rowFor(changed, id).hash, id).toBe(rowFor(baseline, id).hash);
        expect(
          A.filter(
            R.keys(rowFor(changed, id).inputs),
            (file) => Str.startsWith(".git/")(file) || Str.includes("/.git/")(file)
          ),
          id
        ).toEqual([]);
      }
    }, providePlatform),
    { timeout: 180_000 }
  );
});
