import {
  makePgliteSqlTestLayer,
  makePgliteTestcontainerResource,
  makeSqlTestLayer,
  PgExternalTestDriver,
  PgliteInProcessTestDriver,
  PgliteTestcontainersTestDriver,
  SqlTestHarnessError,
  TestDatabaseInfo,
} from "@beep/test-utils";
import { A, O } from "@beep/utils";
import { beforeAll, describe, expect, it } from "@effect/vitest";
import { Cause, Context, Duration, Effect, Exit, Layer, pipe, Scope } from "effect";
import * as S from "effect/Schema";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import type { SqlTestHooks } from "@beep/test-utils";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const sharedConnectionUri = Bun.env.BEEP_TEST_DATABASE_URL;
const hasSharedConnectionUri = sharedConnectionUri !== undefined && sharedConnectionUri !== "";
let pgliteTestcontainersAvailable = false;
const isSqlTestHarnessError = S.is(SqlTestHarnessError);
const ContainerInspectTimeout = Duration.seconds(5);
const SharedPgliteIntegrationTimeoutMs = 60_000;
const PgliteTestcontainersIntegrationTimeoutMs = 120_000;

beforeAll(() => {
  if (hasSharedConnectionUri) {
    pgliteTestcontainersAvailable = false;
    return;
  }

  return Effect.runPromise(
    Effect.scoped(
      makePgliteTestcontainerResource({
        startupTimeoutMs: 30_000,
      }).pipe(Effect.timeoutOption(Duration.seconds(45)))
    )
  ).then(
    (availability) => {
      pgliteTestcontainersAvailable = O.isSome(availability);
    },
    () => {
      pgliteTestcontainersAvailable = false;
    }
  );
}, 60_000);

const skipWhenNoSharedDatabase = (ctx: { readonly skip: (message?: string) => void }) =>
  hasSharedConnectionUri
    ? Effect.void
    : Effect.sync(() => ctx.skip("BEEP_TEST_DATABASE_URL is required for shared external PostgreSQL tests."));

const skipTestcontainersWhenUnavailable = (ctx: { readonly skip: (message?: string) => void }) =>
  pgliteTestcontainersAvailable
    ? Effect.void
    : Effect.sync(() => ctx.skip("Docker/Testcontainers is unavailable or redundant for PGLite integration tests."));

const makeSharedLayer = <MigrateError = never, SeedError = never>(hooks?: SqlTestHooks<MigrateError, SeedError>) =>
  Layer.fresh(
    hooks === undefined
      ? makePgliteSqlTestLayer({
          external: { connectionUri: sharedConnectionUri ?? "" },
          mode: "external",
        })
      : makePgliteSqlTestLayer({
          external: { connectionUri: sharedConnectionUri ?? "" },
          hooks,
          mode: "external",
        })
  );

const makeContainerLayer = <MigrateError = never, SeedError = never>(hooks?: SqlTestHooks<MigrateError, SeedError>) =>
  makeSqlTestLayer(
    hooks === undefined
      ? {
          config: undefined,
          driver: PgliteTestcontainersTestDriver,
        }
      : {
          config: undefined,
          driver: PgliteTestcontainersTestDriver,
          hooks,
        }
  );

const makeExternalNoIsolationLayer = (connectionUri: string) =>
  makeSqlTestLayer({
    config: {
      connectionUri,
      isolation: "none",
    },
    driver: PgExternalTestDriver,
  });

const countIsolatedNotes = Effect.fn("SqlTestIntegration.countIsolatedNotes")(function* () {
  const sql = (yield* SqlClient.SqlClient).withoutTransforms();
  const rows = yield* sql<{ readonly count: number }>`
    SELECT COUNT(*)::integer AS count
    FROM isolated_notes
  `;

  return pipe(
    rows,
    A.head,
    O.map((row) => row.count),
    O.getOrElse(() => 0)
  );
});

const schemaExists = Effect.fn("SqlTestIntegration.schemaExists")(function* (schemaName: string) {
  const sql = (yield* SqlClient.SqlClient).withoutTransforms();
  const rows = yield* sql<{ readonly schema_name: string }>`
    SELECT schema_name
    FROM information_schema.schemata
    WHERE schema_name = ${schemaName}
  `;
  return A.isReadonlyArrayNonEmpty(rows);
});

const isContainerInspectable = Effect.fn("SqlTestIntegration.isContainerInspectable")(function* (containerId: string) {
  const inspected = yield* Effect.tryPromise({
    try: () =>
      import("testcontainers")
        .then(({ getContainerRuntimeClient }) => getContainerRuntimeClient())
        .then((runtime) => runtime.container.inspect(runtime.container.getById(containerId)))
        .then(() => true),
    catch: () => false,
  }).pipe(Effect.option, Effect.timeoutOption(ContainerInspectTimeout));

  return pipe(
    inspected,
    O.flatten,
    O.getOrElse(() => false)
  );
});

// The docker-free in-process driver is the default the gate selects; it needs no
// env or container, so this block always runs and proves the default path.
describe("PGLite in-process SQL test driver", () => {
  it.effect(
    "runs select 1 and CRUD through the in-process driver",
    Effect.fnUntraced(function* () {
      const result = yield* Effect.gen(function* () {
        const sql = (yield* SqlClient.SqlClient).withoutTransforms();
        const info = yield* TestDatabaseInfo;
        yield* sql`
            CREATE TABLE notes (
              id SERIAL PRIMARY KEY,
              body TEXT NOT NULL
            )
          `;
        yield* sql`
            INSERT INTO notes (body)
            VALUES ('alpha'), ('beta')
          `;
        const rows = yield* sql<{ readonly body: string }>`
            SELECT body
            FROM notes
            ORDER BY id ASC
          `;

        return {
          bodies: pipe(
            rows,
            A.map((row) => row.body)
          ),
          driver: info.driver,
        };
      }).pipe(provideScopedLayer(makeSqlTestLayer({ config: undefined, driver: PgliteInProcessTestDriver })));

      expect(result.driver).toBe("pglite-inprocess");
      expect(result.bodies).toEqual(["alpha", "beta"]);
    }),
    SharedPgliteIntegrationTimeoutMs
  );
});

// Sequential (overriding the global `sequence.concurrent: true`): every test in this block opens
// its own connection to the single shared external database. The PGLite wire-protocol server backing
// the integration lane accepts only one connection at a time, so concurrent tests would terminate
// each other's connections and hang. The provisioning lane already enforces this with
// `--concurrency=1` and `BEEP_TEST_DATABASE_MAX_CONNECTIONS=1`.
describe("PGLite shared external SQL test driver", { concurrent: false }, () => {
  it.effect(
    "runs select 1 through the shared external driver",

    Effect.fnUntraced(function* (ctx) {
      yield* skipWhenNoSharedDatabase(ctx);

      const result = yield* Effect.gen(function* () {
        const sql = (yield* SqlClient.SqlClient).withoutTransforms();
        const info = yield* TestDatabaseInfo;
        const rows = yield* sql<{ readonly one: number }>`SELECT 1 AS one`;

        return {
          driver: info.driver,
          one: pipe(
            rows,
            A.head,
            O.map((row) => row.one),
            O.getOrElse(() => 0)
          ),
          schema: O.isSome(info.schema),
        };
      }).pipe(provideScopedLayer(makeSharedLayer()));

      expect(result.driver).toBe("pg-external");
      expect(result.one).toBe(1);
      expect(result.schema).toBe(true);
    }),
    SharedPgliteIntegrationTimeoutMs
  );

  it.effect(
    "creates, inserts, and queries PostgreSQL tables inside the generated schema",

    Effect.fnUntraced(function* (ctx) {
      yield* skipWhenNoSharedDatabase(ctx);

      const values = yield* Effect.gen(function* () {
        const sql = (yield* SqlClient.SqlClient).withoutTransforms();
        yield* sql`
            CREATE TABLE notes (
              id SERIAL PRIMARY KEY,
              body TEXT NOT NULL
            )
          `;
        yield* sql`
            INSERT INTO notes (body)
            VALUES ('alpha'), ('beta')
          `;
        const rows = yield* sql<{ readonly body: string }>`
            SELECT body
            FROM notes
            ORDER BY id ASC
          `;

        return pipe(
          rows,
          A.map((row) => row.body)
        );
      }).pipe(provideScopedLayer(makeSharedLayer()));

      expect(values).toEqual(["alpha", "beta"]);
    }),
    SharedPgliteIntegrationTimeoutMs
  );

  it.effect(
    "isolates schemas between scoped external layers",
    Effect.fnUntraced(function* (ctx) {
      yield* skipWhenNoSharedDatabase(ctx);

      const createTableAndCountRows = Effect.gen(function* () {
        const sql = (yield* SqlClient.SqlClient).withoutTransforms();
        yield* sql`
            CREATE TABLE isolated_notes (
              id SERIAL PRIMARY KEY,
              body TEXT NOT NULL
            )
          `;
        yield* sql`
            INSERT INTO isolated_notes (body)
            VALUES ('first')
          `;

        return yield* countIsolatedNotes();
      }).pipe(provideScopedLayer(makeSharedLayer()));

      const countAfterCreate = yield* createTableAndCountRows;
      const countAfterFreshProvision = yield* Effect.gen(function* () {
        const sql = (yield* SqlClient.SqlClient).withoutTransforms();
        yield* sql`
            CREATE TABLE isolated_notes (
              id SERIAL PRIMARY KEY,
              body TEXT NOT NULL
            )
          `;
        return yield* countIsolatedNotes();
      }).pipe(provideScopedLayer(makeSharedLayer()));

      expect(countAfterCreate).toBe(1);
      expect(countAfterFreshProvision).toBe(0);
    }),
    SharedPgliteIntegrationTimeoutMs
  );

  it.effect(
    "runs migrate and seed hooks inside the generated schema",
    Effect.fnUntraced(function* (ctx) {
      yield* skipWhenNoSharedDatabase(ctx);

      const result = yield* Effect.gen(function* () {
        const info = yield* TestDatabaseInfo;
        const sql = (yield* SqlClient.SqlClient).withoutTransforms();
        const rows = yield* sql<{ readonly value: string }>`
            SELECT value
            FROM seeded_values
            ORDER BY value ASC
          `;

        return {
          driver: info.driver,
          values: pipe(
            rows,
            A.map((row) => row.value)
          ),
        };
      }).pipe(
        provideScopedLayer(
          makeSharedLayer({
            migrate: Effect.gen(function* () {
              const sql = (yield* SqlClient.SqlClient).withoutTransforms();
              yield* sql`
                  CREATE TABLE seeded_values (
                    value TEXT NOT NULL
                  )
                `;
            }),
            seed: Effect.gen(function* () {
              const sql = (yield* SqlClient.SqlClient).withoutTransforms();
              yield* sql`
                  INSERT INTO seeded_values (value)
                  VALUES ('alpha'), ('beta')
                `;
            }),
          })
        )
      );

      expect(result.driver).toBe("pg-external");
      expect(result.values).toEqual(["alpha", "beta"]);
    }),
    SharedPgliteIntegrationTimeoutMs
  );

  it.effect(
    "wraps hook failures with the external driver id",
    Effect.fnUntraced(function* (ctx) {
      yield* skipWhenNoSharedDatabase(ctx);

      const exit = yield* Effect.exit(
        Effect.void.pipe(
          provideScopedLayer(
            makeSharedLayer({
              migrate: Effect.fail("boom"),
            })
          )
        )
      );

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const failure = Cause.squash(exit.cause);

        expect(failure).toBeInstanceOf(SqlTestHarnessError);
        if (isSqlTestHarnessError(failure)) {
          expect(failure.phase).toBe("migrate");
          expect(failure.driver).toBe("pg-external");
        }
      }
    }),
    SharedPgliteIntegrationTimeoutMs
  );

  it.effect(
    "drops generated schemas when the layer scope closes",
    Effect.fnUntraced(function* (ctx) {
      yield* skipWhenNoSharedDatabase(ctx);

      const scope = yield* Scope.make();
      const services = yield* Layer.buildWithScope(makeSharedLayer(), scope);
      const info = Context.get(services, TestDatabaseInfo);
      const schemaName = yield* Effect.fromOption(info.schema).pipe(Effect.orDie);
      const connectionUri = yield* Effect.fromOption(info.connectionUri).pipe(Effect.orDie);

      expect(
        yield* schemaExists(schemaName).pipe(
          Effect.provideService(SqlClient.SqlClient, Context.get(services, SqlClient.SqlClient))
        )
      ).toBe(true);
      yield* Scope.close(scope, Exit.void);
      const existsAfterClose = yield* schemaExists(schemaName).pipe(
        provideScopedLayer(makeExternalNoIsolationLayer(connectionUri))
      );

      expect(existsAfterClose).toBe(false);
    }),
    SharedPgliteIntegrationTimeoutMs
  );
});

if (hasSharedConnectionUri) {
  describe.skip("PGLite Testcontainers SQL test driver", () => {});
} else {
  describe("PGLite Testcontainers SQL test driver", { concurrent: false }, () => {
    it.effect(
      "starts a PGLite Testcontainers database and runs select 1 through SqlClient",
      Effect.fnUntraced(function* (ctx) {
        yield* skipTestcontainersWhenUnavailable(ctx);

        const result = yield* Effect.gen(function* () {
          const sql = (yield* SqlClient.SqlClient).withoutTransforms();
          const info = yield* TestDatabaseInfo;
          const rows = yield* sql<{ readonly one: number }>`SELECT 1 AS one`;

          return {
            connectionUri: O.isSome(info.connectionUri),
            containerId: O.isSome(info.containerId),
            database: O.isSome(info.database),
            driver: info.driver,
            host: O.isSome(info.host),
            one: pipe(
              rows,
              A.head,
              O.map((row) => row.one),
              O.getOrElse(() => 0)
            ),
            port: O.isSome(info.port),
            username: O.isSome(info.username),
          };
        }).pipe(provideScopedLayer(makeContainerLayer()));

        expect(result.driver).toBe("pglite-testcontainers");
        expect(result.one).toBe(1);
        expect(result.connectionUri).toBe(true);
        expect(result.containerId).toBe(true);
        expect(result.database).toBe(true);
        expect(result.host).toBe(true);
        expect(result.port).toBe(true);
        expect(result.username).toBe(true);
      }),
      PgliteTestcontainersIntegrationTimeoutMs
    );

    it.effect(
      "stops and removes the PGLite container when the layer scope closes",
      Effect.fnUntraced(function* (ctx) {
        yield* skipTestcontainersWhenUnavailable(ctx);

        const containerId = yield* Effect.scoped(
          Effect.gen(function* () {
            const resource = yield* makePgliteTestcontainerResource();
            const id = resource.container.getId();

            expect(yield* isContainerInspectable(id)).toBe(true);
            return id;
          })
        );

        expect(yield* isContainerInspectable(containerId)).toBe(false);
      }),
      PgliteTestcontainersIntegrationTimeoutMs
    );
  });
}
