/**
 * Model-shaped catalogs for a bounded context's client contract.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import type * as Domain from "@alchemy.run/domain";
import type * as Kernel from "@alchemy.run/domain/Kernel";
import type * as Projection from "@alchemy.run/domain/Projection";

/**
 * A model-shaped catalog of a context's aggregate-free declarations: its
 * commands, the read contracts of its views, and its queries. `Domain.Api`
 * over a catalog builds the same RPC group and the same typed client as
 * `Domain.Api` over the real Model, with no aggregate in the closure.
 *
 * **Gotchas**
 *
 * Interim, until `@alchemy.run/domain` can declare an Api without a Model
 * (D9). It relies on `Domain.Api` reading only `commands`, `views`,
 * `streams`, `queries` and `modelName` at declaration. An Api over a
 * catalog is a client contract only: serving it (`yield* Api`) or calling
 * `clientInProcess` on it has no model behind it and fails.
 *
 * **Example** (A catalog with one command)
 *
 * ```ts
 * import * as Domain from "@alchemy.run/domain"
 * import * as Catalog from "@beep/contract-kit/Catalog"
 * import * as S from "effect/Schema"
 *
 * class Ping extends Domain.Command("Ping", { target: S.String }) {}
 * const PingCatalog = Catalog.make({ name: "Ping", commands: [Ping], views: [], queries: [] })
 * class PingContract extends Domain.Api("PingContract", {
 *   model: PingCatalog,
 *   commands: ["Ping"],
 *   views: [],
 *   queries: [],
 *   streams: [],
 * }) {}
 * console.log(PingContract.group.requests.size) // 1
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const make = <
  const Name extends string,
  const C extends ReadonlyArray<Domain.Command.Any>,
  const V extends ReadonlyArray<Domain.View.Any>,
  const Q extends ReadonlyArray<Domain.Query.Any>,
>(members: {
  readonly name: Name;
  readonly commands: C;
  readonly views: V;
  readonly queries: Q;
}) => {
  const definitions: Kernel.Definitions = {
    aggregates: [],
    views: members.views,
    policies: [],
    projections: [],
    streams: [],
    queries: members.queries,
  };
  return {
    kind: "Model" as const,
    annotations: {},
    modelName: members.name,
    definitions,
    aggregates: [] as const,
    commands: members.commands,
    views: members.views,
    streams: [] as const,
    queries: members.queries,
  };
};

/**
 * What a contract query lists as `waitsFor` so its RPC carries the
 * `ConsistencyTimeout` the model's query can fail with. Only the length of
 * `waitsFor` shapes a query's RPC; the name is kept for the reader. Never
 * host a query that waits on this.
 *
 * **Gotchas**
 *
 * Interim (D9): the model's query must wait on its own projection, and
 * `Domain.verify` refuses a wait on anything the model does not hold, so the
 * model and the contract each declare the query from shared parts.
 *
 * **Example** (Name the projection a contract query waits on)
 *
 * ```ts
 * import * as Catalog from "@beep/contract-kit/Catalog"
 *
 * const waits = Catalog.waitsOnProjection("NoteIndex")
 * console.log(waits.kind) // "Projection"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const waitsOnProjection = (projectionName: string): Projection.Any =>
  ({ kind: "Projection", projectionName }) as unknown as Projection.Any;
