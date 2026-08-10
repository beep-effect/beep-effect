/** Scoped PGlite lifecycle support for Bun live suites. */
import { PgliteClient, PgliteTestLayer, type PgliteClientValue } from "@beep/pglite";
import { PGlite, types } from "@electric-sql/pglite";
import type * as Pg from "@effect/sql-pg/PgClient";
import * as Pglite from "@effect/sql-pglite/PgliteClient";
import { Context, Effect, Exit, Layer, Scope } from "effect";
import { identity } from "effect/Function";
import * as Str from "effect/String";
import type * as SqlClient from "effect/unstable/sql/SqlClient";

type BaseServices = PgliteClientValue | Pg.PgClient | SqlClient.SqlClient;

type RepositoryServices = Pglite.PgliteClient | SqlClient.SqlClient;

/**
 * Pin PGlite timestamp parsers to the string carrier used by @beep/effect-drizzle timestamp schemas.
 *
 * **Example** (Pin one caller-owned client)
 *
 * ```ts
 * import { PGlite } from "@electric-sql/pglite"
 * import { pinStringTimestampParsers } from "./live.test-support.ts"
 *
 * const client = pinStringTimestampParsers(new PGlite())
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const pinStringTimestampParsers = (client: PGlite): PGlite => {
  client.parsers[types.TIMESTAMP] = identity;
  client.parsers[types.TIMESTAMPTZ] = identity;
  return client;
};

/**
 * Construct the camel-query/snake-result repository view over one PGlite client.
 *
 * **Example** (Construct a repository layer)
 *
 * ```ts
 * import { PGlite } from "@electric-sql/pglite"
 * import { makeCamelSnakeRepositoryLayer } from "./live.test-support.ts"
 *
 * const layer = makeCamelSnakeRepositoryLayer(new PGlite())
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeCamelSnakeRepositoryLayer = (client: PGlite) =>
  Pglite.layer({
    liveClient: client,
    transformQueryNames: Str.snakeCase,
    transformResultNames: Str.camelCase,
  });

/**
 * One scoped in-memory database plus runners for raw and model-key SQL views.
 *
 * **Details**
 *
 * `run` uses the exact `PgliteTestLayer` context. `runRepository` supplies a
 * second client view over the same raw PGlite instance with camel/snake name
 * transforms required by `SqlModel.makeRepository` and @beep/effect-drizzle's physical names.
 * Timestamp parsers retain PostgreSQL ISO strings for @beep/effect-drizzle's timestamp codecs.
 *
 * @category testing
 * @since 0.0.0
 */
export interface LiveTestSupport {
  readonly run: <A, E>(effect: Effect.Effect<A, E, BaseServices>) => Promise<A>;
  readonly runRepository: <A, E>(effect: Effect.Effect<A, E, RepositoryServices>) => Promise<A>;
  readonly close: () => Promise<void>;
}

const makeSupport = (
  scope: Scope.Closeable,
  context: Context.Context<BaseServices>,
  repositoryContext: Context.Context<RepositoryServices>,
): LiveTestSupport => {
  const run = <A, E>(effect: Effect.Effect<A, E, BaseServices>): Promise<A> =>
    Effect.runPromise(Effect.provide(effect, context));
  const runRepository = <A, E>(effect: Effect.Effect<A, E, RepositoryServices>): Promise<A> =>
    Effect.runPromise(Effect.provide(effect, repositoryContext));
  const close = (): Promise<void> => Effect.runPromise(Scope.close(scope, Exit.void));
  return { run, runRepository, close };
};

/**
 * Build `PgliteTestLayer` once and retain its scope until {@link LiveTestSupport.close}.
 *
 * **Example** (Acquire Bun test support)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { makeLiveTestSupport } from "./live.test-support.ts"
 *
 * const support = await Effect.runPromise(makeLiveTestSupport)
 * await support.close()
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const makeLiveTestSupport = Effect.gen(function* () {
  const scope = yield* Scope.make();
  const context = yield* Layer.buildWithScope(PgliteTestLayer, scope);
  const client = Context.get(context, PgliteClient);
  if (!(client.pglite instanceof PGlite)) {
    throw new Error("PgliteTestLayer did not expose a concrete PGlite client");
  }
  const pglite = pinStringTimestampParsers(client.pglite);
  const repositoryContext = yield* Layer.buildWithScope(
    makeCamelSnakeRepositoryLayer(pglite),
    scope,
  );
  return makeSupport(scope, context, repositoryContext);
}).pipe(Effect.withSpan("EffectDrizzleLiveTestSupport.make"));
