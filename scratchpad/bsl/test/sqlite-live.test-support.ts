/** Scoped Bun SQLite lifecycle support for the live SQLite suite. */
import { layer, type SqliteClient } from "@effect/sql-sqlite-bun/SqliteClient";
import type { Context } from "effect/Context";
import { gen, provide, runPromise } from "effect/Effect";
import type { Effect } from "effect/Effect";
import { void as voidExit } from "effect/Exit";
import { buildWithScope } from "effect/Layer";
import { close as closeScope, make as makeScope } from "effect/Scope";
import type { Closeable } from "effect/Scope";
import { camelCase, snakeCase } from "effect/String";
import type { SqlClient } from "effect/unstable/sql/SqlClient";

type Services = SqliteClient | SqlClient;

/** One scoped Effect SQL view over a caller-owned SQLite database file. */
export interface SqliteLiveTestSupport {
  readonly run: <A, E>(effect: Effect<A, E, Services>) => Promise<A>;
  readonly close: () => Promise<void>;
}

const makeSupport = (
  scope: Closeable,
  context: Context<Services>,
): SqliteLiveTestSupport => ({
  run: <A, E>(effect: Effect<A, E, Services>): Promise<A> =>
    runPromise(provide(effect, context)),
  close: (): Promise<void> => runPromise(closeScope(scope, voidExit)),
});

/** Build one camel-query/snake-result SQLite client and retain its scope. */
export const makeSqliteLiveTestSupport = (filename: string) =>
  gen(function* () {
    const scope = yield* makeScope();
    const context = yield* buildWithScope(
        layer({
          filename,
          transformQueryNames: snakeCase,
          transformResultNames: camelCase,
        }),
        scope,
    );
    return makeSupport(scope, context);
  });
