import { StepExec } from "@beep/repo-cli/test/PackageScripts";
import { fallowReportPathsForTesting } from "@beep/repo-cli/test/Quality";
import { FsUtilsLive, findRepoRoot, jsonStringifyPretty } from "@beep/repo-utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const RawTask = S.Record(S.String, S.Unknown);
const Configuration = S.Struct({ tasks: S.Record(S.String, RawTask) });
const FallowTask = S.Struct({ cache: S.Boolean, outputs: S.Array(S.String) });
const Manifest = S.Struct({ scripts: S.Record(S.String, S.String) });
const Envelope = S.Struct({ status: S.String, rawOutputRef: S.String });
const decodeConfiguration = S.decodeEffect(S.fromJsonString(Configuration));
const decodeFallowTask = S.decodeUnknownEffect(FallowTask);
const decodeManifest = S.decodeEffect(S.fromJsonString(Manifest));
const decodeEnvelope = S.decodeEffect(S.fromJsonString(Envelope));
const DryRun = S.Struct({
  tasks: S.Array(S.Struct({ taskId: S.String, inputs: S.Record(S.String, S.String) })),
});
const FallowFiles = S.Struct({ files: S.Array(S.Union([S.String, S.Struct({ path: S.String })])) });
const decodeDryRun = S.decodeEffect(S.fromJsonString(DryRun));
const decodeFallowFiles = S.decodeEffect(S.fromJsonString(FallowFiles));
const filePath = (file: (typeof FallowFiles.Type)["files"][number]): string => (P.isString(file) ? file : file.path);
// Configuration files read by the active Fallow plugins (turborepo, biome, oxlint,
// lefthook, mise, changesets, syncpack, commitlint, the manual tools plugin). They
// shape entry points and dependency use without being discovered source files.
const PLUGIN_CONFIG_FILES = [
  "turbo.json",
  "biome.jsonc",
  ".oxlintrc.json",
  "lefthook.yml",
  "mise.toml",
  ".changeset/config.json",
  "syncpack.config.ts",
  "commitlint.config.ts",
  "fallow-plugin-manual-development-tools.json",
  ".gitignore",
];
const isFallowFeature = S.is(
  S.Literals(["audit", "dead-code", "health", "boundaries", "flags", "security", "fix-preview"])
);
const PlatformLayer = FsUtilsLive.pipe(Layer.provideMerge(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer)));

// Stands in for `beep quality fallow <feature> --out <envelope>`: it writes the envelope
// and the raw evidence it cites at the wrapper's own paths, counts its runs outside every
// Turbo input and output, and exits 1 while a fail marker exists.
const STUB = `import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
const [task, out, raw] = process.argv.slice(2);
const key = task.replaceAll(":", "_");
mkdirSync(".stub/runs", { recursive: true });
appendFileSync(".stub/runs/" + key, "run\\n");
if (out) {
  mkdirSync(dirname(raw), { recursive: true });
  writeFileSync(raw, "raw evidence for " + task + "\\n");
  writeFileSync(out, JSON.stringify({ status: "ok", rawOutputRef: raw }) + "\\n");
}
if (existsSync(".stub/fail-" + key)) process.exit(1);
`;

type FallowRow = {
  readonly id: string;
  readonly script: string;
  readonly reportPath: O.Option<string>;
  readonly rawPath: O.Option<string>;
};

const cachedEntries = Effect.fn("FallowTurboCacheTest.cachedEntries")(function* (
  entries: ReadonlyArray<readonly [string, typeof RawTask.Type]>
) {
  return yield* Effect.filter(
    entries,
    Effect.fnUntraced(function* ([, task]) {
      return (yield* decodeFallowTask(task)).cache;
    })
  );
});

const writeFile = Effect.fn("FallowTurboCacheTest.writeFile")(function* (root: string, file: string, text: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const target = path.join(root, file);
  yield* fs.makeDirectory(path.dirname(target), { recursive: true });
  yield* fs.writeFileString(target, text);
});
const writeJson = Effect.fn("FallowTurboCacheTest.writeJson")(function* (root: string, file: string, value: unknown) {
  yield* writeFile(root, file, `${yield* jsonStringifyPretty(value)}\n`);
});
const runKey = Str.replaceAll(":", "_");
const outFlagValue = (script: string): O.Option<string> =>
  pipe(Str.split(script, " "), (tokens) =>
    O.flatMap(
      A.findFirstIndex(tokens, (token) => token === "--out"),
      (index) => A.get(tokens, index + 1)
    )
  );

const fallowRow = Effect.fn("FallowTurboCacheTest.fallowRow")(function* (
  id: string,
  scripts: Readonly<Record<string, string>>
) {
  const name = Str.slice(3)(id);
  const feature = O.filter(A.get(Str.split(name, ":"), 1), isFallowFeature);
  const reportPath = O.flatMap(R.get(scripts, name), outFlagValue);
  const paths = yield* O.match(O.all([reportPath, feature]), {
    onNone: () => Effect.succeed(O.none<string>()),
    onSome: ([out, family]) =>
      fallowReportPathsForTesting({ repoRoot: "/fixture", out, feature: family }).pipe(
        Effect.map((resolved) => O.some(resolved.rawRelative))
      ),
  });
  return { id, script: name, reportPath, rawPath: paths } satisfies FallowRow;
});

it.layer(PlatformLayer, { timeout: "30 seconds" })("Fallow Turbo cache restore", (it) => {
  it.effect(
    "restores each cached Fallow verdict with its raw evidence and never caches a failure",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const readFileString1 = yield* fs.readFileString(path.join(repoRoot, "turbo.json"));
      const configuration = yield* decodeConfiguration(readFileString1);
      const readFileString2 = yield* fs.readFileString(path.join(repoRoot, "package.json"));
      const manifest = yield* decodeManifest(readFileString2);
      const fallowEntries = A.filter(R.toEntries(configuration.tasks), ([id]) => Str.startsWith("//#fallow:")(id));
      const cached = yield* cachedEntries(fallowEntries);
      // Audit diffs against BEEP_PROOF_BASE, a ref name whose commit can move under an
      // unchanged key, so it is the one Fallow row that must stay uncached.
      const uncached = A.filter(fallowEntries, ([id]) => !A.some(cached, ([cachedId]) => cachedId === id));
      expect(A.map(uncached, ([id]) => id)).toEqual(["//#fallow:audit:check"]);
      const rows = yield* Effect.forEach(cached, ([id]) => fallowRow(id, manifest.scripts));
      expect(A.length(rows)).toBe(8);

      const root = yield* fs.makeTempDirectoryScoped({ prefix: "fallow-turbo-cache-" });
      yield* writeFile(root, ".gitignore", "node_modules\n.turbo\n.beep\n.stub/runs\n");
      yield* writeFile(root, ".stub/stub.mjs", STUB);
      yield* writeFile(root, "packages/fixture/src/index.ts", "export const fixture = 1;\n");
      yield* writeJson(root, "packages/fixture/package.json", { name: "@fixture/member" });
      yield* writeJson(root, "package.json", {
        name: "fallow-turbo-cache-fixture",
        private: true,
        packageManager: "bun@1.4.2",
        workspaces: ["packages/fixture"],
        scripts: R.fromEntries(
          A.map(rows, (row) => [
            row.script,
            A.join(
              ["node", ".stub/stub.mjs", row.script, ...A.getSomes([row.reportPath]), ...A.getSomes([row.rawPath])],
              " "
            ),
          ])
        ),
      });
      // The policy-fingerprint seals are other tasks; the restore contract is per row.
      yield* writeJson(root, "turbo.json", {
        tasks: R.fromEntries(A.map(cached, ([id, task]) => [id, R.set(task, "dependsOn", [])])),
      });
      for (const args of [
        ["init", "--quiet"],
        ["add", "."],
        [
          "-c",
          "user.name=Turbo Fixture",
          "-c",
          "user.email=turbo-fixture@example.invalid",
          "-c",
          "commit.gpgsign=false",
          "commit",
          "--quiet",
          "-m",
          "fixture",
        ],
      ]) {
        const git = yield* StepExec.runCaptured({
          command: "git",
          args,
          cwd: root,
          source: "all",
          timeout: "20 seconds",
          extendEnv: true,
        });
        expect(git.exitCode, git.output).toBe(0);
      }

      const runAll = Effect.fnUntraced(function* () {
        return yield* StepExec.runCaptured({
          command: path.join(repoRoot, "node_modules/.bin/turbo"),
          // A fixture-local cache dir: the developer's shared Turbo cache would replay
          // an earlier test run's entries for these identical fixture hashes.
          args: [
            "run",
            ...A.map(rows, (row) => row.script),
            "--cache=local:rw",
            `--cache-dir=${path.join(root, ".turbo/cache")}`,
            "--continue",
          ],
          cwd: root,
          source: "all",
          timeout: "60 seconds",
          env: { TURBO_TELEMETRY_DISABLED: "1", TURBO_UI: "stream", BEEP_PROOF_BASE: "origin/main" },
          extendEnv: true,
        });
      });
      const runCounts = Effect.fnUntraced(function* () {
        return yield* Effect.forEach(rows, (row) =>
          fs.readFileString(path.join(root, ".stub/runs", runKey(row.script))).pipe(
            Effect.map((text) => A.length(A.filter(Str.split(text, "\n"), Str.isNonEmpty))),
            Effect.orElseSucceed(() => 0)
          )
        );
      });
      const evidence = Effect.fnUntraced(function* () {
        return yield* Effect.forEach(rows, (row) =>
          Effect.forEach(A.getSomes([row.reportPath, row.rawPath]), (file) => fs.readFileString(path.join(root, file)))
        );
      });
      const counts = (n: number) => A.map(rows, () => n);

      const first = yield* runAll();
      expect(first.exitCode, first.output).toBe(0);
      const resultCounts = yield* runCounts();
      expect(resultCounts).toEqual(counts(1));
      const produced = yield* evidence();

      // Second run with the verdicts deleted: every row restores instead of running, and
      // the restored envelope still points at raw evidence that exists.
      yield* fs.remove(path.join(root, ".beep"), { recursive: true });
      const restored = yield* runAll();
      expect(restored.exitCode, restored.output).toBe(0);
      const resultCounts3 = yield* runCounts();
      expect(resultCounts3).toEqual(counts(1));
      const evidence4 = yield* evidence();
      expect(evidence4).toEqual(produced);
      for (const row of rows) {
        if (O.isSome(row.reportPath)) {
          const readFileString5 = yield* fs.readFileString(path.join(root, row.reportPath.value));
          const envelope = yield* decodeEnvelope(readFileString5);
          assertSome(row.rawPath, envelope.rawOutputRef);
          const exists6 = yield* fs.exists(path.join(root, envelope.rawOutputRef));
          expect(exists6, row.id).toBe(true);
        }
      }

      // Prose outside the Fallow inputs keeps every row cached.
      yield* writeFile(root, "goals/fixture/notes.md", "# notes\n");
      expect((yield* runAll()).exitCode).toBe(0);
      const resultCounts7 = yield* runCounts();
      expect(resultCounts7).toEqual(counts(1));

      // A failing run is never cached: with the marker in place the row runs every time.
      const failing = O.getOrThrow(A.findFirst(rows, (row) => row.script === "fallow:health:check"));
      yield* writeFile(root, `.stub/fail-${runKey(failing.script)}`, "");
      yield* writeFile(root, "packages/fixture/src/index.ts", "export const fixture = 2;\n");
      expect((yield* runAll()).exitCode).not.toBe(0);
      const resultCounts8 = yield* runCounts();
      expect(resultCounts8).toEqual(counts(2));
      expect((yield* runAll()).exitCode).not.toBe(0);
      const resultCounts9 = yield* runCounts();
      expect(resultCounts9).toEqual(A.map(rows, (row) => (row.script === failing.script ? 3 : 2)));
    }),
    { timeout: 180_000 }
  );

  it.effect(
    "hashes every file Fallow discovers and every plugin configuration in each cached row",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const readFileString10 = yield* fs.readFileString(path.join(repoRoot, "turbo.json"));
      const configuration = yield* decodeConfiguration(readFileString10);
      const cachedEntries11 = yield* cachedEntries(
        A.filter(R.toEntries(configuration.tasks), ([id]) => Str.startsWith("//#fallow:")(id))
      );
      const cached = A.map(cachedEntries11, ([id]) => id);
      const listed = yield* StepExec.runCaptured({
        command: path.join(repoRoot, "node_modules/.bin/fallow"),
        args: ["list", "--files", "--config", ".fallowrc.jsonc", "--format", "json", "--no-cache"],
        cwd: repoRoot,
        source: "stdout",
        timeout: "60 seconds",
        extendEnv: true,
      });
      expect(listed.exitCode, listed.output).toBe(0);
      const discovered = A.map((yield* decodeFallowFiles(listed.output)).files, filePath);
      expect(A.length(discovered)).toBeGreaterThan(1000);
      const dryRun = yield* StepExec.runCaptured({
        command: path.join(repoRoot, "node_modules/.bin/turbo"),
        args: ["run", ...A.map(cached, Str.slice(3)), "--dry-run=json", "--only"],
        cwd: repoRoot,
        source: "stdout",
        timeout: "60 seconds",
        env: { TURBO_TELEMETRY_DISABLED: "1", BEEP_PROOF_BASE: "origin/main" },
        extendEnv: true,
      });
      expect(dryRun.exitCode, dryRun.output).toBe(0);
      expect(dryRun.truncated).toBe(false);
      const summary = yield* decodeDryRun(dryRun.output);
      for (const id of cached) {
        const task = O.getOrThrow(A.findFirst(summary.tasks, (row) => row.taskId === id));
        const unhashed = A.filter([...discovered, ...PLUGIN_CONFIG_FILES], (file) => !R.has(task.inputs, file));
        expect(unhashed, id).toEqual([]);
      }
    }),
    { timeout: 180_000 }
  );
});
