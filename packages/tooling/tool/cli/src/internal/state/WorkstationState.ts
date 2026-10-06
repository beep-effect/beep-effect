/**
 * Where workstation-scoped, repository-partitioned agent state lives: one
 * directory under the beep state root per store, one JSON Lines file per
 * GitHub repository inside it. Shared by the PR-session registry and the
 * session ledger.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Config, Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";
import type { PlatformError } from "effect";

/**
 * The repository identity a state file is partitioned by.
 *
 * @category models
 * @since 0.0.0
 */
export interface StateRepository {
  readonly host: string;
  readonly name: string;
  readonly owner: string;
}

/**
 * Resolve a store's directory: an explicit override variable first, then
 * `$XDG_STATE_HOME/beep/<store>`, then `$HOME/.local/state/beep/<store>`.
 *
 * **Example** (Build the resolver effect)
 *
 * ```ts
 * import { resolveWorkstationStateDir } from "@beep/repo-cli/test/SharedInternals"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(resolveWorkstationStateDir({ override: "BEEP_SESSION_STATE_ROOT", store: "sessions" }))) // true
 * ```
 *
 * @param options - The override environment variable and the store name under the beep root.
 * @returns The absolute directory the store lives in.
 * @category utilities
 * @since 0.0.0
 */
export const resolveWorkstationStateDir = Effect.fn("WorkstationState.resolveDir")(function* (options: {
  readonly override: string;
  readonly store: string;
}) {
  const configured = yield* Config.option(Config.String(options.override));
  if (O.isSome(configured) && Str.isNonEmpty(Str.trim(configured.value))) return configured.value;
  const xdg = yield* Config.option(Config.String("XDG_STATE_HOME"));
  if (O.isSome(xdg) && Str.isNonEmpty(Str.trim(xdg.value))) return `${xdg.value}/beep/${options.store}`;
  const home = yield* Config.String("HOME");
  return `${home}/.local/state/beep/${options.store}`;
});

/**
 * The JSON Lines file name for a repository: `host__owner__name.jsonl`, with
 * no local data in it.
 *
 * **Example** (Name a file)
 *
 * ```ts
 * import { repositoryJsonLinesFileName } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(repositoryJsonLinesFileName({ host: "github.com", owner: "beep-effect", name: "beep-effect" }))
 * // "github.com__beep-effect__beep-effect.jsonl"
 * ```
 *
 * @param repository - The repository the file is partitioned by.
 * @returns The file name.
 * @category formatting
 * @since 0.0.0
 */
export const repositoryJsonLinesFileName = (repository: StateRepository): string =>
  `${repository.host}__${repository.owner}__${repository.name}.jsonl`;

/**
 * Treat a missing state file as empty history and map every other platform
 * failure through the store's own error.
 *
 * **Example** (A missing file reads as no rows)
 *
 * ```ts
 * import { emptyWhenNotFound } from "@beep/repo-cli/test/SharedInternals"
 * import * as Effect from "effect/Effect"
 *
 * console.log(typeof emptyWhenNotFound) // "function"
 * ```
 *
 * @param onError - Maps a platform error other than NotFound to the store's error.
 * @returns A pipeable that recovers NotFound with an empty array.
 * @category utilities
 * @since 0.0.0
 */
export const emptyWhenNotFound =
  <E>(onError: (error: PlatformError.PlatformError) => E) =>
  <Row, R>(
    read: Effect.Effect<ReadonlyArray<Row>, PlatformError.PlatformError, R>
  ): Effect.Effect<ReadonlyArray<Row>, E, R> =>
    read.pipe(
      Effect.catchTag("PlatformError", (error) =>
        error.reason._tag === "NotFound" ? Effect.succeed(A.empty<Row>()) : Effect.fail(onError(error))
      )
    );
