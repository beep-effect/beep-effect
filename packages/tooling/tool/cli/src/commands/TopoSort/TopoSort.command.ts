/**
 * Topological sort command - outputs workspace packages in dependency order.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { findRepoRoot } from "@beep/repo-utils";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import { workspaceDependencyGraph } from "../../internal/RepoWorkspaces.ts";

/**
 * CLI command that builds the workspace dependency graph and prints package names
 * in topological order (leaf dependencies first, dependents last).
 *
 * **Details**
 *
 * The order is `@beep/repo-workspaces` `DependencyGraph.sort()`: Kahn levels
 * over the workspace members (root excluded), each level sorted by name, so
 * the output is deterministic for a given dependency graph. A cycle prints
 * its members to stderr and fails.
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
    const graph = yield* workspaceDependencyGraph(rootDir);
    const sorted = yield* Effect.catchTag(
      graph.sort(),
      "CyclicDependencyError",
      Effect.fn(function* (err) {
        yield* Console.error(`Error: ${err.message}`);
        return yield* err;
      })
    );

    yield* Effect.forEach(sorted, (name) => Console.log(name), {
      discard: true,
    });
  })
).pipe(Command.withDescription("Output workspace packages in topological dependency order"));
