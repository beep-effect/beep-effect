import { propertyTestMarker } from "@beep/fc-runs/PropertySelection";
import { propertySweepPackages } from "@beep/repo-cli/commands/Ci";
import { workspaceManifests } from "@beep/repo-cli-kit/RepoWorkspaces";
import { findRepoRoot } from "@beep/repo-utils";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, it } from "@effect/vitest";
import { assertTrue, deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Str from "effect/String";

const CAPPED_RUNS = /\barbitrary: fcRunsCapped\((\d+)\)/gu;
const CAPPED_SITES_WITH_MS_PER_RUN = [
  ["apps/labs/ciops/test/backfill-fairness.test.ts 64", "about 40 ms a run: simulates a train of up to 80 arrivals"],
  [
    "packages/law-practice/server/test/CitationBuiltinCleaners.test.ts 20",
    "about 140 ms a run: spawns native worker processes",
  ],
  [
    "packages/law-practice/server/test/CitationLiteralUnicodeComposition.test.ts 25",
    "about 90 ms a run: spawns native worker processes",
  ],
  [
    "packages/law-practice/server/test/CitationRendering.test.ts 20",
    "about 310 ms a run: spawns native worker processes",
  ],
  [
    "packages/tooling/tool/cli/test/cache-private-producer-object.test.ts 20",
    "an I/O-heavy cache producer property, capped before this list",
  ],
] as const;
const FAST_CHECK_IMPORT = /^import [^;]*from "fast-check";$/mu;
const SEED_LITERAL = /\bseed: (\d+)/gu;

const testFilesInGit = (root: string): ReadonlyArray<string> => {
  const listed = Bun.spawnSync({ cmd: ["git", "-C", root, "ls-files", "*.test.ts", "*.test.tsx"], stdout: "pipe" });
  assertTrue(listed.success, "git lists the tree");
  return A.filter(Str.split(listed.stdout.toString(), "\n"), Str.isNonEmpty);
};

describe("property sweep over the live checkout", () => {
  it.layer(Layer.merge(NodeFileSystem.layer, NodePath.layer), { timeout: "120 seconds" })(
    "tracked test files",
    (it) => {
      it.effect("covers, with the first step, every package of the live workspace that has a property file", () =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const root = yield* findRepoRoot();
          const workspaces = yield* Effect.map(workspaceManifests(root), flow(HashMap.entries, A.fromIterable));
          const listed = testFilesInGit(root);
          const marked = yield* Effect.filter(
            A.filter(listed, (file) => !Str.includes("/fixtures/")(file)),
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
          deepStrictEqual(
            pipe(
              holding,
              A.map(([name]) => name),
              A.filter((name) => !A.contains(first, name) && !A.contains(second, name))
            ),
            ["@beep/scratchpad"],
            "only @beep/scratchpad, which has no test script and so no hosted lane, holds property files outside both steps"
          );
        })
      );

      it.effect(
        "names every test file that draws from fast-check, which no shared seed reaches, with its own seeds",
        () =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const root = yield* findRepoRoot();
            const tracked = A.filter(testFilesInGit(root), (file) => !Str.startsWith("scratchpad/")(file));
            const drawing = yield* Effect.filter(
              tracked,
              (file) =>
                Effect.map(fs.readFileString(path.join(root, file)), (source) => FAST_CHECK_IMPORT.test(source)),
              { concurrency: 16 }
            );
            const seeds = yield* Effect.forEach(
              drawing,
              (file) =>
                Effect.map(
                  fs.readFileString(path.join(root, file)),
                  (source) =>
                    [
                      file,
                      A.map(A.fromIterable(Str.matchAll(SEED_LITERAL)(source)), (match) => match[1] ?? ""),
                    ] as const
                ),
              { concurrency: 1 }
            );
            deepStrictEqual(
              R.fromEntries(seeds),
              {
                "apps/professional-desktop/test/intake-model.test.ts": ["11", "5"],
                "packages/drivers/xstate/test/ModelTesting.test.ts": ["7", "7", "7", "1", "3"],
              },
              "a new entry passes a literal seed to every draw, so the nightly explores neither it nor these"
            );
          })
      );

      it.effect("names every property the nightly floor does not raise, with its count and why", () =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const root = yield* findRepoRoot();
          const tracked = A.filter(testFilesInGit(root), (file) => !Str.startsWith("scratchpad/")(file));
          const capped = yield* Effect.forEach(
            tracked,
            (file) =>
              Effect.map(fs.readFileString(path.join(root, file)), (source) =>
                A.map(A.fromIterable(Str.matchAll(CAPPED_RUNS)(source)), (match) => `${file} ${match[1] ?? ""}`)
              ),
            { concurrency: 16 }
          );
          deepStrictEqual(
            A.sort(A.flatten(capped), Order.String),
            A.map(CAPPED_SITES_WITH_MS_PER_RUN, ([site]) => site),
            "a new capped site fails until CAPPED_SITES_WITH_MS_PER_RUN lists it with its measured cost and reason"
          );
        })
      );

      it.effect("names every property file of the live workspace it leaves to the integration lane", () =>
        Effect.gen(function* () {
          const root = yield* findRepoRoot();
          const packages = yield* propertySweepPackages(root);
          const left = A.flatMap(packages, (entry) => A.map(entry.integration, (file) => `${entry.dir}/${file}`));
          deepStrictEqual(
            left,
            ["packages/tooling/infra/turbo-cache/test/integration/Runtime.test.ts"],
            "a new entry is a property file no nightly explores: name it only if the integration lane runs it"
          );
          assertTrue(A.some(packages, (entry) => entry.name === "@beep/xlsx"));
          assertTrue(A.every(packages, (entry) => A.every(entry.files, Str.startsWith("test/"))));
        })
      );
    }
  );
});
