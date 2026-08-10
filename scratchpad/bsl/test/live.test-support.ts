/** Scoped PGlite lifecycle support for Bun live suites. */
import { PgliteClient, PgliteTestLayer, type PgliteClientValue } from "@beep/pglite";
import { PGlite, types } from "@electric-sql/pglite";
import type * as Pg from "@effect/sql-pg/PgClient";
import * as Pglite from "@effect/sql-pglite/PgliteClient";
import { get as getContext } from "effect/Context";
import type { Context } from "effect/Context";
import { gen, provide, runPromise, withSpan } from "effect/Effect";
import type { Effect } from "effect/Effect";
import { void as voidExit } from "effect/Exit";
import { buildWithScope } from "effect/Layer";
import { close as closeScope, make as makeScope } from "effect/Scope";
import type { Closeable } from "effect/Scope";
import { identity } from "effect/Function";
import { camelCase, snakeCase } from "effect/String";
import type { SqlClient } from "effect/unstable/sql/SqlClient";

type BaseServices = PgliteClientValue | Pg.PgClient | SqlClient;

type RepositoryServices = Pglite.PgliteClient | SqlClient;

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
    transformQueryNames: snakeCase,
    transformResultNames: camelCase,
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
  readonly run: <A, E>(effect: Effect<A, E, BaseServices>) => Promise<A>;
  readonly runRepository: <A, E>(effect: Effect<A, E, RepositoryServices>) => Promise<A>;
  readonly close: () => Promise<void>;
}

const makeSupport = (
  scope: Closeable,
  context: Context<BaseServices>,
  repositoryContext: Context<RepositoryServices>,
): LiveTestSupport => {
  const run = <A, E>(effect: Effect<A, E, BaseServices>): Promise<A> =>
    runPromise(provide(effect, context));
  const runRepository = <A, E>(effect: Effect<A, E, RepositoryServices>): Promise<A> =>
    runPromise(provide(effect, repositoryContext));
  const close = (): Promise<void> => runPromise(closeScope(scope, voidExit));
  return { run, runRepository, close };
};

/**
 * Build `PgliteTestLayer` once and retain its scope until {@link LiveTestSupport.close}.
 *
 * **Example** (Acquire Bun test support)
 *
 * ```ts
 * import { runPromise } from "effect/Effect"
 * import { makeLiveTestSupport } from "./live.test-support.ts"
 *
 * const support = await runPromise(makeLiveTestSupport)
 * await support.close()
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const makeLiveTestSupport = gen(function* () {
  const scope = yield* makeScope();
  const context = yield* buildWithScope(PgliteTestLayer, scope);
  const client = getContext(context, PgliteClient);
  if (!(client.pglite instanceof PGlite)) {
    throw new Error("PgliteTestLayer did not expose a concrete PGlite client");
  }
  const pglite = pinStringTimestampParsers(client.pglite);
  const repositoryContext = yield* buildWithScope(makeCamelSnakeRepositoryLayer(pglite), scope);
  return makeSupport(scope, context, repositoryContext);
}).pipe(withSpan("EffectDrizzleLiveTestSupport.make"));
