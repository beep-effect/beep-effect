import * as Domain from "@alchemy.run/domain";
import type * as Kernel from "@alchemy.run/domain/Kernel";
import * as S from "effect/Schema";

/**
 * A model-shaped catalog of a context's aggregate-free declarations: its
 * commands, the read contracts of its views, and its queries. `Domain.Api`
 * over a catalog builds the same RPC group and the same typed client as
 * `Domain.Api` over the real Model, with no aggregate in the closure.
 *
 * **Gotchas**
 *
 * Interim, until the library can declare an Api without a Model (D9). It
 * relies on `Domain.Api` reading only `commands`, `views`, `streams`,
 * `queries` and `modelName` at declaration (`Api.ts` `make`). An Api over a
 * catalog is a client contract only: serving it (`yield* Api`) or calling
 * `clientInProcess` on it has no model behind it and fails.
 *
 * **Example** (A catalog with one command)
 * ```ts
 * import * as Domain from "@alchemy.run/domain";
 * import * as Catalog from "@proto/contract-kit/Catalog";
 * import * as S from "effect/Schema";
 *
 * class Ping extends Domain.Command("Ping", { target: S.String }) {}
 * const PingCatalog = Catalog.make({ name: "Ping", commands: [Ping], views: [], queries: [] });
 * class PingContract extends Domain.Api("PingContract", { model: PingCatalog, commands: ["Ping"], views: [], queries: [], streams: [] }) {}
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
 * `ConsistencyTimeout` the model's query can fail with: a projection of the
 * same name declared with the library's own constructor, with no sources and
 * no events. Only the length of `waitsFor` shapes a query's RPC (`Query.ts`
 * `make`); the name is kept for the reader.
 *
 * **Gotchas**
 *
 * Interim (D9): the model's query must wait on its own projection, and
 * `Domain.verify` refuses a wait on anything the model does not hold, so
 * the model and the contract each declare the query from shared parts. The
 * declaration shares the model projection's service key and is never part of
 * a model: never host it, give it a Layer, or host a query that waits on it.
 *
 * **Example** (A contract query that can time out waiting)
 * ```ts
 * import * as Domain from "@alchemy.run/domain";
 * import * as Catalog from "@proto/contract-kit/Catalog";
 * import * as S from "effect/Schema";
 *
 * class FindThings extends Domain.Query("FindThings", {
 *   input: { text: S.String },
 *   success: S.String,
 *   waitsFor: [Catalog.waitsOnProjection("ThingDirectory")],
 * }) {}
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const waitsOnProjection = <const Name extends string>(projectionName: Name) =>
  Domain.Projection(projectionName, { from: [], key: S.String, on: [] });
