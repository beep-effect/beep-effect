/**
 * Workspace owner resolution for repo-wide ts-morph scans.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { toPosixPath } from "@beep/repo-utils/schemas/TypeScriptSourceExclusions";
import { resolveWorkspaceDirs } from "@beep/repo-utils/Workspaces";
import { A, Str } from "@beep/utils";
import { Effect, HashMap, Order, pipe } from "effect";
import * as O from "effect/Option";

type WorkspaceOwnerFallback = {
  readonly prefix: string;
  readonly owner: string;
};

type WorkspaceOwnerResolverInput = {
  readonly root: string;
  readonly fallbackOwner: string;
  readonly fallbackPrefixes?: ReadonlyArray<WorkspaceOwnerFallback>;
  readonly swallowWorkspaceErrors?: boolean;
};

const byWorkspacePathLengthDescending: Order.Order<readonly [string, string]> = Order.mapInput(
  Order.Number,
  (entry) => -entry[1].length
);

/**
 * Create a resolver from absolute source file paths to owning workspace names.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { createWorkspaceOwnerResolver } from "@beep/repo-cli/internal/tsmorph/OwnerResolver"
 *
 * const program = createWorkspaceOwnerResolver({
 *   root: process.cwd(),
 *   fallbackOwner: "@beep/root"
 * })
 * console.log(Effect.isEffect(program))
 * ```
 * @category factories
 * @since 0.0.0
 */
export const createWorkspaceOwnerResolver = Effect.fn("TSMorph.createWorkspaceOwnerResolver")(function* (
  input: WorkspaceOwnerResolverInput
) {
  const workspaces =
    input.swallowWorkspaceErrors === true
      ? yield* resolveWorkspaceDirs(input.root).pipe(
          Effect.option,
          Effect.map(O.getOrElse(() => HashMap.empty<string, string>()))
        )
      : yield* resolveWorkspaceDirs(input.root);
  const workspaceEntries = pipe(
    HashMap.toEntries(workspaces),
    A.map(([packageName, absolutePath]) => [packageName, toPosixPath(absolutePath)] as const),
    A.sort(byWorkspacePathLengthDescending)
  );
  const cwd = toPosixPath(input.root);
  const fallbackPrefixes = input.fallbackPrefixes ?? [];

  return (absoluteFilePath: string): string => {
    const normalized = toPosixPath(absoluteFilePath);
    const relativePath = toPosixPath(Str.replace(`${cwd}/`, "")(normalized));
    const workspaceMatch = A.findFirst(
      workspaceEntries,
      ([, workspacePath]) => normalized === workspacePath || Str.startsWith(`${workspacePath}/`)(normalized)
    );
    if (O.isSome(workspaceMatch)) {
      return workspaceMatch.value[0];
    }

    const fallbackMatch = A.findFirst(fallbackPrefixes, (fallback) => Str.startsWith(fallback.prefix)(relativePath));
    return O.match(fallbackMatch, {
      onNone: () => input.fallbackOwner,
      onSome: (fallback) => fallback.owner,
    });
  };
});
