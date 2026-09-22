/**
 * Topological sort command - outputs workspace packages in dependency order.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { buildRepoDependencyIndex, findRepoRoot, sortWorkspacePackages } from "@beep/repo-utils";
import { A } from "@beep/utils";
import { Console, Effect } from "effect";
import { Command } from "effect/unstable/cli";

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
    const sorted = yield* Effect.catchTag(
      sortWorkspacePackages(depIndex),
      "CyclicDependencyError",
      Effect.fn(function* (err) {
        yield* Console.error(`Error: Cyclic dependencies detected`);
        for (const cycle of err.cycles) {
          yield* Console.error(`  ${A.join(cycle, " -> ")}`);
        }
        return yield* err;
      })
    );

    yield* Effect.forEach(sorted, (name) => Console.log(name), {
      discard: true,
    });
  })
).pipe(Command.withDescription("Output workspace packages in topological dependency order"));
