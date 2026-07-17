/**
 * `gh` (GitHub CLI) invocation and GraphQL cursor pagination plumbing.
 *
 * {@link ghOutput} is the single "run gh, map a nonzero exit or a truncated
 * capture into a caller-owned error" wrapper that Yeet previously hand-rolled at
 * three call sites. It builds on the wave-1 {@link runRepoCommandCapture} so the
 * spawn, env, and capture-bound semantics stay identical; only the error mapping
 * is a parameter, keeping this module free of any command-group error type.
 *
 * {@link ghGraphqlPage} and {@link nextCursor} lift the closeout cursor
 * pagination loop into reusable pieces, decoupled from any repository-view
 * schema by taking `owner`/`name`/`number` directly.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { runRepoCommandCapture } from "../repo-run/index.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { GhPageInfo } from "./GhSchema.ts";

/**
 * A classified `gh` invocation failure handed to a caller's error mapper.
 *
 * `spawn` carries the underlying spawn failure cause; `nonzero-exit` carries the
 * exit code and captured output; `truncated` reports that captured output
 * overflowed the repo-run capture bound.
 *
 * @example
 * ```ts
 * import type { GhCommandFailure } from "@beep/repo-cli/internal/github"
 *
 * const failure: GhCommandFailure = { _tag: "truncated", label: "gh pr view", command: "gh pr view" }
 * console.log(failure._tag)
 * ```
 * @category models
 * @since 0.0.0
 */
export type GhCommandFailure =
  | { readonly _tag: "spawn"; readonly label: string; readonly command: string; readonly cause: unknown }
  | {
      readonly _tag: "nonzero-exit";
      readonly label: string;
      readonly command: string;
      readonly exitCode: number;
      readonly output: string;
    }
  | { readonly _tag: "truncated"; readonly label: string; readonly command: string };

/**
 * Options for {@link ghOutput}.
 *
 * @typeParam E - Caller-owned error produced from a {@link GhCommandFailure}.
 * @category models
 * @since 0.0.0
 */
export interface GhOutputOptions<E> {
  readonly args: ReadonlyArray<string>;
  readonly cwd: string;
  readonly label: string;
  readonly onFailure: (failure: GhCommandFailure) => E;
}

/**
 * Run `gh` with captured output, returning stdout on success and mapping a spawn
 * failure, nonzero exit, or truncated capture into the caller's error.
 *
 * @param options - Command args, working directory, label, and error mapper.
 * @returns The captured stdout on a clean, non-truncated zero-exit run.
 * @example
 * ```ts
 * import { ghOutput } from "@beep/repo-cli/internal/github"
 * import { Effect } from "effect"
 *
 * const program = ghOutput({
 *   args: ["pr", "view", "--json", "number,headRefName,state"],
 *   cwd: process.cwd(),
 *   label: "gh pr view",
 *   onFailure: (failure) => new Error(`${failure.label} failed (${failure._tag})`)
 * })
 * console.log(Effect.isEffect(program))
 * ```
 * @category execution
 * @since 0.0.0
 */
export const ghOutput = Effect.fn("GhCommand.ghOutput")(function* <E>(options: GhOutputOptions<E>) {
  const command = A.join(["gh", ...options.args], " ");
  const result = yield* runRepoCommandCapture("gh", options.args, options.cwd).pipe(
    Effect.mapError((cause) => options.onFailure({ _tag: "spawn", label: options.label, command, cause }))
  );
  if (result.exitCode !== 0) {
    return yield* Effect.fail(
      options.onFailure({
        _tag: "nonzero-exit",
        label: options.label,
        command,
        exitCode: result.exitCode,
        output: result.output,
      })
    );
  }
  if (result.truncated) {
    return yield* Effect.fail(options.onFailure({ _tag: "truncated", label: options.label, command }));
  }
  return result.output;
});

/**
 * Build the `-F cursor=<value>` argument pair for a GraphQL page request, or an
 * empty argument list when there is no cursor.
 *
 * @param cursor - The page cursor, if any.
 * @returns The `gh api graphql` cursor argument fragment.
 * @example
 * ```ts
 * import { cursorArgs } from "@beep/repo-cli/internal/github"
 * import * as O from "effect/Option"
 *
 * console.log(cursorArgs(O.some("abc")))
 * console.log(cursorArgs(O.none()))
 * ```
 * @category execution
 * @since 0.0.0
 */
export const cursorArgs = (cursor: O.Option<string>): ReadonlyArray<string> =>
  O.isSome(cursor) ? ["-F", `cursor=${cursor.value}`] : [];

/**
 * Resolve the next page cursor from GraphQL page info, failing when another page
 * is reported without an end cursor.
 *
 * @param options - Page info, a label for error text, and the missing-cursor mapper.
 * @returns `Some(cursor)` for a further page, `None` when pagination is complete.
 * @example
 * ```ts
 * import { GhPageInfo, nextCursor } from "@beep/repo-cli/internal/github"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const done = nextCursor({
 *   pageInfo: GhPageInfo.make({ endCursor: null, hasNextPage: false }),
 *   label: "comments",
 *   onMissingCursor: (label) => new Error(`${label} had no cursor`)
 * })
 * console.log(O.isNone(Effect.runSync(done)))
 * ```
 * @category execution
 * @since 0.0.0
 */
export const nextCursor = <E>(options: {
  readonly pageInfo: GhPageInfo;
  readonly label: string;
  readonly onMissingCursor: (label: string) => E;
}): Effect.Effect<O.Option<string>, E> =>
  !options.pageInfo.hasNextPage
    ? Effect.succeed(O.none())
    : pipe(
        O.fromNullishOr(options.pageInfo.endCursor),
        O.match({
          onNone: () => Effect.fail(options.onMissingCursor(options.label)),
          onSome: (cursor) => Effect.succeed(O.some(cursor)),
        })
      );

/**
 * Options for {@link ghGraphqlPage}.
 *
 * @typeParam E - Caller-owned error produced from a {@link GhCommandFailure}.
 * @category models
 * @since 0.0.0
 */
export interface GhGraphqlPageOptions<E> {
  readonly cursor: O.Option<string>;
  readonly cwd: string;
  readonly label: string;
  readonly name: string;
  readonly number: number;
  readonly onFailure: (failure: GhCommandFailure) => E;
  readonly owner: string;
  readonly query: string;
}

/**
 * Fetch one `gh api graphql` page for a pull request, threading `owner`, `name`,
 * `number`, and the optional cursor into the query variables.
 *
 * @param options - Repository coordinates, GraphQL query, cursor, and error mapper.
 * @returns The raw GraphQL response body on success.
 * @example
 * ```ts
 * import { ghGraphqlPage } from "@beep/repo-cli/internal/github"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const program = ghGraphqlPage({
 *   cwd: process.cwd(),
 *   owner: "octo",
 *   name: "repo",
 *   number: 1,
 *   query: "query { __typename }",
 *   cursor: O.none(),
 *   label: "gh api graphql comments",
 *   onFailure: (failure) => new Error(failure.label)
 * })
 * console.log(Effect.isEffect(program))
 * ```
 * @category execution
 * @since 0.0.0
 */
export const ghGraphqlPage = <E>(
  options: GhGraphqlPageOptions<E>
): Effect.Effect<string, E, ChildProcessSpawner.ChildProcessSpawner> =>
  ghOutput({
    args: [
      "api",
      "graphql",
      "-f",
      `query=${options.query}`,
      "-F",
      `owner=${options.owner}`,
      "-F",
      `name=${options.name}`,
      "-F",
      `number=${options.number}`,
      ...cursorArgs(options.cursor),
    ],
    cwd: options.cwd,
    label: options.label,
    onFailure: options.onFailure,
  });
