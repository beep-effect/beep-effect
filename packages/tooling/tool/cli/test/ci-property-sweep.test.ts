/**
 * The nightly's second property step: its census of the tree, the receipts it
 * judges, its replay command, and the live workspace it runs over.
 */
import { propertyTestMarker } from "@beep/fc-runs/PropertySelection";
import {
  clearPropertySweepReceipts,
  judgePropertySweep,
  PROPERTY_SWEEP_NO_CACHE,
  PROPERTY_SWEEP_RECEIPTS,
  PropertySweepPackage,
  propertySweepIsComplete,
  propertySweepLines,
  propertySweepMarkerForTesting,
  propertySweepPackages,
  propertySweepReplay,
} from "@beep/repo-cli/commands/Ci";
import { workspaceManifests } from "@beep/repo-cli-kit/RepoWorkspaces";
import { findRepoRoot } from "@beep/repo-utils";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, it } from "@effect/vitest";
import { assertFalse, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as R from "effect/Record";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";

const UNIT = "bunx --bun vitest run --exclude=test/integration/**";
const PROPERTY = 'it.effect.prop("law", [S.Int], check);\n';
const PLAIN = 'it("adds", check);\n';
const replay = { seed: "7", runs: "1000" };

const manifest = (name: string, scripts: Record<string, string>): string =>
  `{ "name": "${name}", "version": "0.0.0", "private": true, "scripts": { ${A.join(
    A.map(R.toEntries(scripts), ([key, value]) => `"${key}": "${value}"`),
    ", "
  )} } }`;

const fixture = Effect.fnUntraced(function* (files: Record<string, string>) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "property-sweep-" });
  yield* Effect.forEach(
    R.toEntries({ "package.json": '{ "name": "root", "private": true, "workspaces": ["packages/*"] }', ...files }),
    Effect.fnUntraced(function* ([file, content]) {
      const target = path.join(root, file);
      yield* fs.makeDirectory(path.dirname(target), { recursive: true });
      yield* fs.writeFileString(target, content);
    }),
    { concurrency: 1, discard: true }
  );
  return root;
});

const receipt = (files: ReadonlyArray<readonly [file: string, executed: number]>): string =>
  `{"schemaVersion":"property-sweep/v1","files":[${A.join(
    A.map(files, ([file, executed]) => `{"file":"${file}","executed":${executed}}`),
    ","
  )}]}`;

const swept = PropertySweepPackage.make({
  name: "@t/a",
  dir: "packages/a",
  files: ["test/a.test.ts", "test/b.test.ts"],
  integration: ["test/integration/c.test.ts"],
});

describe("property sweep", () => {
  it("selects files by the marker the shared Vitest configuration selects with", () => {
    strictEqual(propertySweepMarkerForTesting.source, propertyTestMarker.source);
    strictEqual(propertySweepMarkerForTesting.flags, propertyTestMarker.flags);
  });

  it("names the replay command, uncached, with the run's seed and floor", () => {
    strictEqual(
      propertySweepReplay("@t/a", replay),
      `BEEP_FC_SEED=7 BEEP_FC_NUM_RUNS=1000 bunx turbo run test --filter=@t/a ${PROPERTY_SWEEP_NO_CACHE}`
    );
  });

  it.layer(NodeServices.layer, { timeout: "120 seconds" })("over a workspace", (it) => {
    it.effect("takes property files of packages with a test script and no test:property script", () =>
      Effect.gen(function* () {
        const root = yield* fixture({
          "packages/a/package.json": manifest("@t/a", { test: "bun run beep:test", "beep:test": UNIT }),
          "packages/a/test/a.test.ts": PROPERTY,
          "packages/a/test/nested/b.test.tsx": PROPERTY,
          "packages/a/test/plain.test.ts": PLAIN,
          "packages/a/test/support.ts": PROPERTY,
          "packages/a/test/__screenshots__/a.test.ts/image.txt": PROPERTY,
          "packages/a/test/fixtures/f.test.ts": PROPERTY,
          "packages/a/test/integration/c.test.ts": PROPERTY,
          "packages/b/package.json": manifest("@t/b", { test: "bun run beep:test", "beep:test": "bunx vitest run" }),
          "packages/b/test/integration/d.test.ts": PROPERTY,
          "packages/c/package.json": manifest("@t/c", { test: "x", "test:property": "x" }),
          "packages/c/test/a.test.ts": PROPERTY,
          "packages/d/package.json": manifest("@t/d", { build: "x" }),
          "packages/d/test/a.test.ts": PROPERTY,
          "packages/e/package.json": manifest("@t/e", { test: "x" }),
          "packages/e/test/plain.test.ts": PLAIN,
          "packages/f/package.json": manifest("@t/f", { test: "x" }),
        });
        const packages = yield* propertySweepPackages(root);
        deepStrictEqual(packages, [
          PropertySweepPackage.make({
            name: "@t/a",
            dir: "packages/a",
            files: ["test/a.test.ts", "test/nested/b.test.tsx"],
            integration: ["test/integration/c.test.ts"],
          }),
          PropertySweepPackage.make({
            name: "@t/b",
            dir: "packages/b",
            files: ["test/integration/d.test.ts"],
            integration: [],
          }),
        ]);
      })
    );

    it.effect("fails on a workspace it cannot read", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(propertySweepPackages("/home/alice/missing"));
        strictEqual(error.message, "Failed to read the property sweep's packages.");
      })
    );

    it.effect("is complete only when every expected file executed a test, over all of a package's receipts", () =>
      Effect.gen(function* () {
        const root = yield* fixture({
          [`packages/a/${PROPERTY_SWEEP_RECEIPTS}/1.json`]: receipt([["test/a.test.ts", 3]]),
          [`packages/a/${PROPERTY_SWEEP_RECEIPTS}/2.json`]: receipt([
            ["test/b.test.ts", 1],
            ["test/more.test.ts", 5],
          ]),
        });
        const verdicts = yield* judgePropertySweep(root, [swept]);
        assertTrue(propertySweepIsComplete(verdicts));
        deepStrictEqual(propertySweepLines(verdicts, replay), [
          "[property-sweep] 1 package(s): 2 of 2 expected file(s) executed, 1 left to the integration lane",
          "[property-sweep] @t/a: 2 expected, 3 executed",
          "[property-sweep] left to the integration lane: packages/a/test/integration/c.test.ts",
        ]);
      })
    );

    it.effect("is red, with a replay command, when a file ran no test or a package left no receipt", () =>
      Effect.gen(function* () {
        const root = yield* fixture({
          [`packages/a/${PROPERTY_SWEEP_RECEIPTS}/1.json`]: receipt([
            ["test/a.test.ts", 3],
            ["test/b.test.ts", 0],
          ]),
        });
        const silent = PropertySweepPackage.make({
          name: "@t/s",
          dir: "packages/s",
          files: ["test/s.test.ts"],
          integration: [],
        });
        const verdicts = yield* judgePropertySweep(root, [swept, silent]);
        assertFalse(propertySweepIsComplete(verdicts));
        deepStrictEqual(A.drop(propertySweepLines(verdicts, replay), 4), [
          "[property-sweep] expected and not executed: packages/a/test/b.test.ts",
          "[property-sweep] expected and not executed: packages/s/test/s.test.ts",
          `[property-sweep] replay: ${propertySweepReplay("@t/a", replay)}`,
          `[property-sweep] replay: ${propertySweepReplay("@t/s", replay)}`,
        ]);
        strictEqual(
          propertySweepLines(verdicts, replay)[0],
          "[property-sweep] 2 package(s): 1 of 3 expected file(s) executed, 1 left to the integration lane"
        );
      })
    );

    it.effect("reads no receipt of an earlier run, and refuses one it cannot decode", () =>
      Effect.gen(function* () {
        const root = yield* fixture({
          [`packages/a/${PROPERTY_SWEEP_RECEIPTS}/1.json`]: receipt([["test/a.test.ts", 3]]),
          [`packages/b/${PROPERTY_SWEEP_RECEIPTS}/1.json`]: "{}",
        });
        yield* clearPropertySweepReceipts(root, [swept]);
        const cleared = yield* judgePropertySweep(root, [swept]);
        deepStrictEqual(cleared[0]?.missing, swept.files);
        const other = PropertySweepPackage.make({ name: "@t/b", dir: "packages/b", files: [], integration: [] });
        const error = yield* Effect.flip(judgePropertySweep(root, [other]));
        strictEqual(error.message, "Failed to read the property sweep's receipts.");
      })
    );

    it.effect("covers, with the first step, every package of the live workspace that has a property file", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* findRepoRoot();
        const workspaces = yield* Effect.map(workspaceManifests(root), flow(HashMap.entries, A.fromIterable));
        // Git's list of test files, not the census's own walk of the tree.
        const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
        const git = yield* spawner.spawn(ChildProcess.make("git", ["-C", root, "ls-files", "*.test.ts", "*.test.tsx"]));
        const listed = yield* git.stdout.pipe(Stream.decodeText, Stream.mkString);
        const marked = yield* Effect.filter(
          A.filter(Str.split(listed, "\n"), (file) => Str.isNonEmpty(file) && !Str.includes("/fixtures/")(file)),
          (file) => Effect.map(fs.readFileString(path.join(root, file)), (source) => propertyTestMarker.test(source)),
          { concurrency: 16 }
        );
        const holding = A.filter(workspaces, ([, workspace]) => {
          const tests = `${path.relative(root, workspace.dir)}/test/`;
          return A.some(marked, Str.startsWith(tests));
        });
        const packages = yield* propertySweepPackages(root);
        const second = A.map(packages, (entry) => entry.name);
        const first = pipe(
          workspaces,
          A.filter(([, workspace]) => HashMap.has(workspace.manifest.scripts, "test:property")),
          A.map(([name]) => name)
        );
        assertTrue(A.isReadonlyArrayNonEmpty(second), "the census is empty");
        deepStrictEqual(
          A.filter(second, (name) => A.contains(first, name)),
          []
        );
        // @beep/scratchpad has no test script, so no hosted lane runs its tests.
        deepStrictEqual(
          pipe(
            holding,
            A.map(([name]) => name),
            A.filter((name) => !A.contains(first, name) && !A.contains(second, name))
          ),
          ["@beep/scratchpad"]
        );
      })
    );

    it.effect("names every property file of the live workspace it leaves to the integration lane", () =>
      Effect.gen(function* () {
        const root = yield* findRepoRoot();
        const packages = yield* propertySweepPackages(root);
        const left = A.flatMap(packages, (entry) => A.map(entry.integration, (file) => `${entry.dir}/${file}`));
        // A new entry is a property file no nightly explores: name it here only if the integration lane runs it.
        deepStrictEqual(left, ["packages/tooling/infra/turbo-cache/test/integration/Runtime.test.ts"]);
        assertTrue(A.some(packages, (entry) => entry.name === "@beep/xlsx"));
        assertTrue(A.every(packages, (entry) => A.every(entry.files, Str.startsWith("test/"))));
      })
    );
  });
});
