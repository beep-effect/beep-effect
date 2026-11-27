import { propertyTestMarker } from "@beep/fc-runs/PropertySelection";
import {
  clearPropertySweepReceipts,
  judgePropertySweep,
  PROPERTY_SWEEP_NO_CACHE,
  PROPERTY_SWEEP_RECEIPTS,
  PROPERTY_TEST_MARKER,
  PropertySweepPackage,
  propertySweepIsComplete,
  propertySweepLines,
  propertySweepPackages,
  propertySweepReplay,
} from "@beep/repo-cli/commands/Ci";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, it } from "@effect/vitest";
import { assertFalse, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as R from "effect/Record";

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
    strictEqual(PROPERTY_TEST_MARKER.source, propertyTestMarker.source);
    strictEqual(PROPERTY_TEST_MARKER.flags, propertyTestMarker.flags);
  });

  it("names the replay command, uncached, with the run's seed and floor", () => {
    strictEqual(
      propertySweepReplay("@t/a", replay),
      `BEEP_FC_SEED=7 BEEP_FC_NUM_RUNS=1000 bunx turbo run test --filter=@t/a ${PROPERTY_SWEEP_NO_CACHE}`
    );
  });

  it.layer(Layer.merge(NodeFileSystem.layer, NodePath.layer), { timeout: "120 seconds" })("over a workspace", (it) => {
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

    it.effect("names the same directories for a checkout reached through a link", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fixture({
          "packages/a/package.json": manifest("@t/a", { test: "x" }),
          "packages/a/test/a.test.ts": PROPERTY,
        });
        const links = yield* fs.makeTempDirectoryScoped({ prefix: "property-sweep-link-" });
        const link = path.join(links, "checkout");
        yield* fs.symlink(root, link);
        const direct = yield* propertySweepPackages(root);
        const linked = yield* propertySweepPackages(link);
        deepStrictEqual(linked, direct);
        strictEqual(linked[0]?.dir, "packages/a");
      })
    );

    it.effect("fails, not narrows, when a package's test directory cannot be read", () =>
      Effect.gen(function* () {
        const root = yield* fixture({
          "packages/a/package.json": manifest("@t/a", { test: "x" }),
          "packages/a/test": "a file where the test directory should be",
        });
        const error = yield* Effect.flip(propertySweepPackages(root));
        strictEqual(error.message, "Failed to read the property sweep's packages.");
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
  });
});
