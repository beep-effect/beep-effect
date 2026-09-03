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
 * **Example** (Classify a truncated capture)
 *
 * ```ts
 * import type { GhCommandFailure } from "@beep/repo-cli/internal/github"
 *
 * const failure: GhCommandFailure = { _tag: "truncated", label: "gh pr view", command: "gh pr view" }
 * console.log(failure._tag)
 * ```
 *
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
 * **Example** (Fetch PR facts with a caller-owned error)
 *
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
 *
 * @param options - Command args, working directory, label, and error mapper.
 * @returns The captured stdout on a clean, non-truncated zero-exit run.
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
 * **Example** (Render cursor arguments for both cases)
 *
 * ```ts
 * import { cursorArgs } from "@beep/repo-cli/internal/github"
 * import * as O from "effect/Option"
 *
 * console.log(cursorArgs(O.some("abc")))
 * console.log(cursorArgs(O.none()))
 * ```
 *
 * @param cursor - The page cursor, if any.
 * @returns The `gh api graphql` cursor argument fragment.
 * @category execution
 * @since 0.0.0
 */
export const cursorArgs = (cursor: O.Option<string>): ReadonlyArray<string> =>
  O.isSome(cursor) ? ["-F", `cursor=${cursor.value}`] : [];

/**
 * Resolve the next page cursor from GraphQL page info, failing when another page
 * is reported without an end cursor.
 *
 * **Example** (Finish pagination on the last page)
 *
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
 *
 * @param options - Page info, a label for error text, and the missing-cursor mapper.
 * @returns `Some(cursor)` for a further page, `None` when pagination is complete.
 * @category execution
 * @since 0.0.0
 */
export const nextCursor = <E>(options: {
  readonly pageInfo: GhPageInfo;
  readonly label: string;
  readonly onMissingCursor: (label: string) => E;
}): Effect.Effect<O.Option<string>, E> =>
  !options.pageInfo.hasNextPage
    ? Effect.succeedNone
    : pipe(
        O.fromNullishOr(options.pageInfo.endCursor),
        O.match({
          onNone: () => Effect.fail(options.onMissingCursor(options.label)),
          onSome: (cursor) => Effect.succeedSome(cursor),
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
 * **Example** (Request the first page of a PR query)
 *
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
 *
 * @param options - Repository coordinates, GraphQL query, cursor, and error mapper.
 * @returns The raw GraphQL response body on success.
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

/** A review-thread node whose nested comment connection can report truncation. */
interface GhTruncatableThread {
  readonly comments: { readonly pageInfo: GhPageInfo };
  readonly id: string;
}

/**
 * Options for {@link collectTruncatableThreadPages}.
 *
 * @typeParam T - Thread node type carried by each page.
 * @typeParam E - Caller-owned error for page fetches and cursor advancement.
 * @typeParam R - Requirements of the page fetch.
 * @category models
 * @since 0.0.0
 */
export interface CollectTruncatableThreadPagesOptions<T extends GhTruncatableThread, E, R> {
  readonly advance: (pageInfo: GhPageInfo) => Effect.Effect<O.Option<string>, E>;
  readonly fetchPage: (
    cursor: O.Option<string>
  ) => Effect.Effect<{ readonly nodes: ReadonlyArray<T>; readonly pageInfo: GhPageInfo }, E, R>;
  readonly truncationWarning: (threadIds: ReadonlyArray<string>) => string;
}

/**
 * Collect every page of a review-thread connection, warning once per page about
 * threads whose nested comment connection is truncated.
 *
 * **Details**
 *
 * Both the closeout collector and the reply engine paginate the same
 * `reviewThreads` shape and must warn when a thread carries more than one
 * nested comment page; this owns that loop once, parameterized by the page
 * fetch, the cursor advance, and the caller's warning text.
 *
 * **Example** (Collect a single closed page)
 *
 * ```ts
 * import { collectTruncatableThreadPages, GhPageInfo } from "@beep/repo-cli/internal/github"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const program = collectTruncatableThreadPages({
 *   advance: () => Effect.succeed(O.none()),
 *   fetchPage: () =>
 *     Effect.succeed({ nodes: [], pageInfo: GhPageInfo.make({ endCursor: null, hasNextPage: false }) }),
 *   truncationWarning: (ids) => `truncated: ${ids.length}`
 * })
 * console.log(Effect.isEffect(program))
 * ```
 *
 * @param options - Page fetch, cursor advance, and truncation-warning text.
 * @returns Every thread node across all pages, in page order.
 * @category execution
 * @since 0.0.0
 */
export const collectTruncatableThreadPages = <T extends GhTruncatableThread, E, R>(
  options: CollectTruncatableThreadPagesOptions<T, E, R>
): Effect.Effect<ReadonlyArray<T>, E, R> => {
  const go = (cursor: O.Option<string>, collected: ReadonlyArray<T>): Effect.Effect<ReadonlyArray<T>, E, R> =>
    options.fetchPage(cursor).pipe(
      Effect.flatMap((page) => {
        const truncatedThreadIds = pipe(
          page.nodes,
          A.filter((thread) => thread.comments.pageInfo.hasNextPage),
          A.map((thread) => thread.id)
        );
        const warn = A.isReadonlyArrayNonEmpty(truncatedThreadIds)
          ? Effect.logWarning(options.truncationWarning(truncatedThreadIds))
          : Effect.void;
        const threads = [...collected, ...page.nodes];
        return warn.pipe(
          Effect.andThen(options.advance(page.pageInfo)),
          Effect.flatMap((next) => (O.isSome(next) ? go(next, threads) : Effect.succeed(threads)))
        );
      })
    );
  return go(O.none(), A.empty<T>());
};
