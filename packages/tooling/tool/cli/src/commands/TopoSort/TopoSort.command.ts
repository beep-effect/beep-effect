/**
 * Topological sort command - outputs workspace packages in dependency order.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { buildRepoDependencyIndex, findRepoRoot, topologicalSort } from "@beep/repo-utils";
import { A } from "@beep/utils";
import { Console, Effect, HashMap, HashSet, pipe } from "effect";
import * as R from "effect/Record";
import { Command } from "effect/unstable/cli";
import type { WorkspaceDeps } from "@beep/repo-utils";

const dependencyNames = (workspaceDeps: WorkspaceDeps): ReadonlyArray<string> =>
  pipe(
    workspaceDeps.workspace,
    R.toEntries,
    A.map(([k]) => k)
  );

/**
 * CLI command that builds the workspace dependency graph and prints package names
 * in topological order (leaf dependencies first, dependents last).
 *
 * **Example** (Reference topo sort command)
 *
 * ```ts
 * console.log("topoSortCommand")
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const topoSortCommand = Command.make(
  "topo-sort",
  {},
  Effect.fn(function* () {
    const rootDir = yield* findRepoRoot();
    const depIndex = yield* buildRepoDependencyIndex(rootDir);

    // Build adjacency list: each package maps to its workspace dependencies
    let adjacencyList = HashMap.empty<string, HashSet.HashSet<string>>();

    for (const [name, workspaceDeps] of depIndex) {
      let depSet = HashSet.empty<string>();
      for (const depName of dependencyNames(workspaceDeps)) {
        depSet = HashSet.add(depSet, depName);
      }

      adjacencyList = HashMap.set(adjacencyList, name, depSet);
    }

    const sorted = yield* Effect.catchTag(
      topologicalSort(adjacencyList),
      "CyclicDependencyError",
      Effect.fn(function* (err) {
        yield* Console.error(`Error: Cyclic dependencies detected`);
        for (const cycle of err.cycles) {
          yield* Console.error(`  ${A.join(cycle, " -> ")}`);
        }
        return yield* err;
      })
    );

    yield* Effect.forEach(sorted, Console.log, {
      discard: true,
    });
  })
).pipe(Command.withDescription("Output workspace packages in topological dependency order"));
