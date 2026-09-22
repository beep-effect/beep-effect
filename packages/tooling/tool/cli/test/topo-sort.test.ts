import { topoSortCommand } from "@beep/repo-cli";
import { buildRepoDependencyIndex, findRepoRoot, workspaceDependencyNames } from "@beep/repo-utils";
import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { A } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as P from "effect/Predicate";
import * as TestConsole from "effect/testing/TestConsole";
import { Command } from "effect/unstable/cli";

const runTopoSort = Command.runWith(topoSortCommand, { version: "0.0.0" });
const bucketNames = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"] as const;
const testLayer = Layer.mergeAll(TestConsole.layer, FsUtilsLive.pipe(Layer.provideMerge(NodeServices.layer)));

describe("topo-sort", () => {
  it.effect("prints workspace package names in dependency order", () =>
    Effect.gen(function* () {
      yield* runTopoSort([]);
      const lines = A.filter(yield* TestConsole.logLines, P.isString);
      const rootDir = yield* findRepoRoot();
      const depIndex = yield* buildRepoDependencyIndex(rootDir);
      let dependencyEdges = 0;

      expect(lines.length).toBeGreaterThan(0);
      for (const bucketName of bucketNames) {
        expect(lines).not.toContain(bucketName);
      }
      for (const line of lines) {
        expect(line.includes(" ")).toBe(false);
      }
      for (const [name, deps] of depIndex) {
        const dependentAt = lines.indexOf(name);
        expect(dependentAt).toBeGreaterThanOrEqual(0);
        for (const dependencyName of workspaceDependencyNames(deps)) {
          expect(lines.indexOf(dependencyName)).toBeLessThan(dependentAt);
          dependencyEdges = dependencyEdges + 1;
        }
      }
      expect(dependencyEdges).toBeGreaterThan(0);
    }).pipe(Effect.provide(testLayer))
  );
});
