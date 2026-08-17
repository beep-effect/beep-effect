/**
 * Shared row-decoding scaffolding for the law-practice repository adapters.
 *
 * **Details**
 *
 * Both durable repositories in this package — the candor record store and the
 * legal position record store — read rows back through their entity schema and
 * decode the row an append returned, with identical semantics in both
 * directions. This module owns that scaffolding so the adapters stay
 * behavior-identical without repeating it, and so the reason an appended row
 * beats the appended value is written down once.
 *
 * The repository-specific parts stay with their repository: each one keeps its
 * own operation vocabulary, its own typed unavailability error, and its own
 * `repositoryUnavailable` combinator (which names that repository in its debug
 * log and its failure message). The combinator is passed in, so nothing here
 * knows which store it is serving.
 *
 * It is private to `@beep/law-practice-server` — not re-exported from any
 * barrel, covered by the package's `./internal/*: null` export guard, and
 * excluded from docgen.
 *
 * @packageDocumentation
 * @internal
 * @category repositories
 * @since 0.0.0
 */

import { Effect, Order } from "effect";
import * as A from "effect/Array";
import { dual, flow, pipe } from "effect/Function";
import * as O from "effect/Option";
import type { Result } from "effect";
import type * as S from "effect/Schema";

/**
 * A repository's combinator turning any driver failure into its typed
 * unavailability error, tagged with the operation that failed.
 *
 * **Details**
 *
 * Each repository builds its own so the dropped failure names the store and the
 * physical table it was going to touch. Both decoders below take one rather than
 * constructing an error themselves.
 *
 * @internal
 * @category repositories
 * @since 0.0.0
 */
export type RepositoryUnavailable<Operation, Unavailable> = (
  operation: Operation
) => <Value, E, R>(effect: Effect.Effect<Value, E, R>) => Effect.Effect<Value, Unavailable, R>;

/**
 * Canonical ascending order for repository entities carrying a numeric id.
 *
 * @internal
 * @category repositories
 * @since 0.0.0
 */
const byIdAscending = Order.mapInput(Order.Number, (record: { readonly id: number }) => record.id);

/**
 * Sort repository entities by their numeric id in ascending order.
 *
 * @internal
 * @category repositories
 * @since 0.0.0
 */
export const sortByIdAscending = <Entity extends { readonly id: number }>(
  records: ReadonlyArray<Entity>
): Array<Entity> => A.sort(records, byIdAscending);

/**
 * The pair of row decoders one repository uses, bound to that repository's
 * unavailability combinator.
 *
 * @internal
 * @category repositories
 * @since 0.0.0
 */
export interface RowDecoders<Operation, Unavailable> {
  /**
   * Decode the row an append returned, falling back to the appended value.
   */
  readonly decodeAppended: {
    <Entity>(
      rows: ReadonlyArray<unknown>,
      operation: Operation,
      decode: (row: unknown) => Result.Result<Entity, S.SchemaError>,
      appended: Entity
    ): Effect.Effect<Entity, Unavailable>;
    <Entity>(
      operation: Operation,
      decode: (row: unknown) => Result.Result<Entity, S.SchemaError>,
      appended: Entity
    ): (rows: ReadonlyArray<unknown>) => Effect.Effect<Entity, Unavailable>;
  };
  /**
   * Decode every selected row through its entity schema.
   */
  readonly decodeRows: {
    <Entity>(
      rows: ReadonlyArray<unknown>,
      operation: Operation,
      decode: (row: unknown) => Result.Result<Entity, S.SchemaError>
    ): Effect.Effect<ReadonlyArray<Entity>, Unavailable>;
    <Entity>(
      operation: Operation,
      decode: (row: unknown) => Result.Result<Entity, S.SchemaError>
    ): (rows: ReadonlyArray<unknown>) => Effect.Effect<ReadonlyArray<Entity>, Unavailable>;
  };
}

/**
 * Build the row decoders for one repository.
 *
 * **When to use**
 *
 * Use once per repository adapter, immediately after its
 * `repositoryUnavailable` combinator is defined, and destructure both decoders
 * from the result.
 *
 * **Details**
 *
 * `decodeRows` re-decodes every selected row through its entity schema. The
 * driver's declared column types are not trusted: a jsonb column hands back
 * whatever the database holds, so a row that no longer decodes is a repository
 * failure rather than a silently-shaped value.
 *
 * `decodeAppended` decodes the row an append returned. The database assigns the
 * SERIAL id, so the returned row is the authority; the appended value only
 * stands in if the driver returned none.
 *
 * **Gotchas**
 *
 * Neither decoder ever issues a write. Both repositories in this package are
 * append-and-read-only and the migration backs that with triggers, so a decoder
 * that repaired a row rather than failing on it would be hiding exactly the
 * drift these two exist to surface.
 *
 * @param repositoryUnavailable - The calling repository's unavailability combinator.
 * @returns Both row decoders, bound to that repository's error channel.
 * @internal
 * @category repositories
 * @since 0.0.0
 */
export const makeRowDecoders = <Operation, Unavailable>(
  repositoryUnavailable: RepositoryUnavailable<Operation, Unavailable>
): RowDecoders<Operation, Unavailable> => ({
  decodeAppended: dual(4, (rows, operation, decode, appended) =>
    pipe(
      rows,
      A.head,
      O.map(flow(decode, Effect.fromResult)),
      O.getOrElse(() => Effect.succeed(appended)),
      repositoryUnavailable(operation)
    )
  ),
  decodeRows: dual(
    3,
    <Entity>(
      rows: ReadonlyArray<unknown>,
      operation: Operation,
      decode: (row: unknown) => Result.Result<Entity, S.SchemaError>
    ): Effect.Effect<ReadonlyArray<Entity>, Unavailable> =>
      Effect.forEach(rows, flow(decode, Effect.fromResult)).pipe(repositoryUnavailable(operation))
  ),
});
