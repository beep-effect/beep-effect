/**
 * SQL integration-test harness helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { randomUUID } from "node:crypto";
import { $TestUtilsId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils, TaggedErrorClass } from "@beep/schema";
import { O, Str } from "@beep/utils";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { Config, Context, Duration, Effect, FileSystem, Layer, Path, pipe, Redacted, Schedule } from "effect";
import * as S from "effect/Schema";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import { ConnectionError, SqlError } from "effect/unstable/sql/SqlError";
import type * as PgClient from "@effect/sql-pg/PgClient";
import type * as NodeSqliteClient from "@effect/sql-sqlite-node/SqliteClient";
import type { GenericContainer, StartedTestContainer } from "testcontainers";

const $I = $TestUtilsId.create("SqlTest");
const PgliteImageName = "beep/pglite-testcontainers:0.4.5";
const PgliteDockerContextUrl = new URL("../docker/pglite", import.meta.url);
const PgliteHealthCheckCommand =
  "node -e \"const { Client } = require('pg'); const client = new Client({ host: '127.0.0.1', port: Number(process.env.PGPORT || '5432'), database: process.env.PGDATABASE, user: process.env.PGUSER, password: process.env.PGPASSWORD, ssl: false }); client.connect().then(() => client.query('select 1')).then(() => client.end()).catch((cause) => { console.error(cause); process.exit(1); });\"";
const PgliteHealthCheckIntervalMs = 1_000;
const PgExternalClientEndTimeout = Duration.seconds(5);
const PgExternalSchemaDropTimeout = Duration.seconds(10);
const PgliteHostReadinessTimeout = Duration.seconds(45);
const PgliteHostProbeTimeoutMs = 5_000;
let pgliteImageBuild = O.none<Promise<GenericContainer>>();

class PgliteIntegrationGateEnv extends S.Class<PgliteIntegrationGateEnv>($I`PgliteIntegrationGateEnv`)(
  {
    databaseDriver: S.optionalKey(S.String.pipe(S.UndefinedOr)),
    databaseUrl: S.optionalKey(S.String.pipe(S.UndefinedOr)),
  },
  $I.annote("PgliteIntegrationGateEnv", {
    description: "Optional environment override for reusable PGLite integration-test gate selection.",
  })
) {}

const SqlTestHarnessPhase = LiteralKit(["provision", "migrate", "seed", "teardown"]).pipe(
  $I.annoteSchema("SqlTestHarnessPhase", {
    description: "Lifecycle phases for reusable SQL integration-test harness failures.",
  })
);

const TestDatabaseDriver = LiteralKit([
  "bun-sqlite",
  "node-sqlite",
  "pglite-testcontainers",
  "pglite-inprocess",
  "pg-external",
]).pipe(
  $I.annoteSchema("TestDatabaseDriver", {
    description: "Driver identifier for reusable SQL integration-test harnesses.",
  })
);

const PgExternalIsolationMode = LiteralKit(["schema", "none"]).pipe(
  $I.annoteSchema("PgExternalIsolationMode", {
    description: "Isolation mode for shared external PostgreSQL SQL test drivers.",
  })
);

const PgliteTcpPort = S.Int.check(
  S.isBetween(
    {
      maximum: 65_535,
      minimum: 1,
    },
    {
      description: "A TCP port number accepted by Docker and PostgreSQL clients.",
      identifier: $I`PgliteTcpPortRangeCheck`,
      message: "PGLite TCP ports must be between 1 and 65535",
      title: "PGLite TCP Port Range",
    }
  )
).pipe(
  $I.annoteSchema("PgliteTcpPort", {
    description: "TCP port number used by the PGLite Testcontainers SQL test driver.",
  })
);

const PglitePositiveInteger = S.Int.check(
  S.isGreaterThan(0, {
    description: "A positive integer accepted by the PGLite Testcontainers SQL test driver.",
    identifier: $I`PglitePositiveIntegerCheck`,
    message: "PGLite numeric configuration values must be greater than zero",
    title: "PGLite Positive Integer",
  })
).pipe(
  $I.annoteSchema("PglitePositiveInteger", {
    description: "Positive integer used by the PGLite Testcontainers SQL test driver.",
  })
);

const PgExternalSchemaPrefix = S.String.check(
  S.isPattern(/^[A-Za-z_][A-Za-z0-9_]*$/, {
    description: "A PostgreSQL identifier-safe prefix for generated integration-test schemas.",
    identifier: $I`PgExternalSchemaPrefixPattern`,
    message: "PostgreSQL test schema prefixes must be valid unquoted identifiers",
    title: "PostgreSQL External Schema Prefix",
  })
).pipe(
  $I.annoteSchema("PgExternalSchemaPrefix", {
    description: "Identifier-safe prefix used when creating external PostgreSQL test schemas.",
  })
);

/**
 * PostgreSQL-compatible connection URI accepted by the external SQL test driver.
 *
 * @example
 * ```ts
 * import { PgExternalConnectionUri } from "@beep/test-utils"
 *
 * console.log(PgExternalConnectionUri.is("postgres://postgres:postgres@127.0.0.1:5432/postgres"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const PgExternalConnectionUri = S.NonEmptyString.check(
  S.isPattern(/^postgres(?:ql)?:\/\//, {
    description: "A PostgreSQL connection URI must use the postgres or postgresql protocol.",
    identifier: $I`PgExternalConnectionUriProtocol`,
    message: "External PostgreSQL connection URIs must start with postgres:// or postgresql://",
    title: "PostgreSQL External Connection URI",
  })
).pipe(
  $I.annoteSchema("PgExternalConnectionUri", {
    description: "PostgreSQL-compatible connection URI accepted by the external SQL test driver.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * PostgreSQL-compatible connection URI accepted by the external SQL test driver.
 *
 * @example
 * ```ts
 * import type { PgExternalConnectionUri } from "@beep/test-utils"
 *
 * const uri: PgExternalConnectionUri = "postgres://postgres:postgres@127.0.0.1:5432/postgres"
 * console.log(uri)
 * ```
 * @category models
 * @since 0.0.0
 */
export type PgExternalConnectionUri = typeof PgExternalConnectionUri.Type;

/**
 * Runtime metadata for an ephemeral integration-test database instance.
 *
 * @example
 * ```ts
 * import { TestDatabaseInfoShape } from "@beep/test-utils"
 * import * as O from "effect/Option"
 * const info = TestDatabaseInfoShape.make({
 *   connectionUri: O.none(),
 *   containerId: O.none(),
 *   database: O.none(),
 *   databasePath: O.some("/tmp/test.db"),
 *   driver: "node-sqlite",
 *   host: O.none(),
 *   port: O.none(),
 *   schema: O.none(),
 *   tempDir: O.some("/tmp"),
 *   username: O.none()
 * })
 * console.log(info.databasePath)
 * ```
 * @category models
 * @since 0.0.0
 */
export class TestDatabaseInfoShape extends S.Class<TestDatabaseInfoShape>($I`TestDatabaseInfoShape`)(
  {
    connectionUri: S.Option(PgExternalConnectionUri).pipe(
      $I.annoteKey("TestDatabaseInfoShape.connectionUri", {
        description: "PostgreSQL-compatible connection URI for drivers that expose a network endpoint.",
      })
    ),
    containerId: S.Option(S.String).pipe(
      $I.annoteKey("TestDatabaseInfoShape.containerId", {
        description: "Container runtime identifier for container-backed SQL test drivers.",
      })
    ),
    database: S.Option(S.String).pipe(
      $I.annoteKey("TestDatabaseInfoShape.database", {
        description: "Database name selected by the active SQL test driver.",
      })
    ),
    databasePath: S.Option(S.String).pipe(
      $I.annoteKey("TestDatabaseInfoShape.databasePath", {
        description: "Filesystem path for file-backed SQL test drivers.",
      })
    ),
    driver: TestDatabaseDriver.pipe(
      $I.annoteKey("TestDatabaseInfoShape.driver", {
        description: "Driver that provisioned the SQL integration-test database.",
      })
    ),
    host: S.Option(S.String).pipe(
      $I.annoteKey("TestDatabaseInfoShape.host", {
        description: "Network host for drivers that expose a PostgreSQL endpoint.",
      })
    ),
    port: S.Option(PgliteTcpPort).pipe(
      $I.annoteKey("TestDatabaseInfoShape.port", {
        description: "Network port for drivers that expose a PostgreSQL endpoint.",
      })
    ),
    schema: S.Option(S.String).pipe(
      $I.annoteKey("TestDatabaseInfoShape.schema", {
        description: "Temporary PostgreSQL schema used for external-driver isolation.",
      })
    ),
    tempDir: S.Option(S.String).pipe(
      $I.annoteKey("TestDatabaseInfoShape.tempDir", {
        description: "Scoped temporary directory backing local file-based SQL test drivers.",
      })
    ),
    username: S.Option(S.String).pipe(
      $I.annoteKey("TestDatabaseInfoShape.username", {
        description: "Database username selected by the active SQL test driver.",
      })
    ),
  },
  $I.annote("TestDatabaseInfoShape", {
    description: "Runtime metadata for an ephemeral integration-test database instance.",
  })
) {}

/**
 * Runtime configuration for the PGLite Testcontainers SQL test driver.
 *
 * @example
 * ```ts
 * import { PgliteTestcontainersTestDriverConfig } from "@beep/test-utils"
 * const config = PgliteTestcontainersTestDriverConfig.make({})
 * console.log(config.maxConnections)
 * ```
 * @category models
 * @since 0.0.0
 */
export class PgliteTestcontainersTestDriverConfig extends S.Class<PgliteTestcontainersTestDriverConfig>(
  $I`PgliteTestcontainersTestDriverConfig`
)(
  {
    database: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("postgres")),
      S.withDecodingDefaultKey(Effect.succeed("postgres")),
      $I.annoteKey("PgliteTestcontainersTestDriverConfig.database", {
        description: "Database name configured inside the PGLite Testcontainers server.",
      })
    ),
    internalPort: PgliteTcpPort.pipe(
      S.withConstructorDefault(Effect.succeed(5432)),
      S.withDecodingDefaultKey(Effect.succeed(5432)),
      $I.annoteKey("PgliteTestcontainersTestDriverConfig.internalPort", {
        description: "Internal PostgreSQL TCP port exposed inside the PGLite container.",
      })
    ),
    maxConnections: PglitePositiveInteger.pipe(
      S.withConstructorDefault(Effect.succeed(1)),
      S.withDecodingDefaultKey(Effect.succeed(1)),
      $I.annoteKey("PgliteTestcontainersTestDriverConfig.maxConnections", {
        description: "Maximum PostgreSQL client connections for the PGLite test driver.",
      })
    ),
    password: S.String.pipe(
      S.withConstructorDefault(Effect.sync(randomUUID)),
      S.withDecodingDefaultKey(Effect.sync(randomUUID)),
      $I.annoteKey("PgliteTestcontainersTestDriverConfig.password", {
        description: "Generated PostgreSQL password configured for the PGLite test driver.",
      })
    ),
    startupTimeoutMs: PglitePositiveInteger.pipe(
      S.withConstructorDefault(Effect.succeed(60_000)),
      S.withDecodingDefaultKey(Effect.succeed(60_000)),
      $I.annoteKey("PgliteTestcontainersTestDriverConfig.startupTimeoutMs", {
        description: "Startup timeout in milliseconds for the PGLite Testcontainers server.",
      })
    ),
    username: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("postgres")),
      S.withDecodingDefaultKey(Effect.succeed("postgres")),
      $I.annoteKey("PgliteTestcontainersTestDriverConfig.username", {
        description: "PostgreSQL username configured for the PGLite test driver.",
      })
    ),
  },
  $I.annote("PgliteTestcontainersTestDriverConfig", {
    description: "Runtime configuration for the PGLite Testcontainers SQL test driver.",
  })
) {
  static readonly decodeEffect = S.decodeUnknownEffect(PgliteTestcontainersTestDriverConfig);
}

/**
 * Constructor input accepted by the PGLite Testcontainers SQL test driver.
 *
 * @example
 * ```ts
 * import type { PgliteTestcontainersTestDriverConfigInput } from "@beep/test-utils/SqlTest"
 *
 * const value: PgliteTestcontainersTestDriverConfigInput = { database: "custom_test_db" }
 * console.log(value?.database)
 * ```
 * @category models
 * @since 0.0.0
 */
export type PgliteTestcontainersTestDriverConfigInput = Partial<PgliteTestcontainersTestDriverConfig> | undefined;

/**
 * Runtime configuration for an externally managed PostgreSQL-compatible SQL test driver.
 *
 * @example
 * ```ts
 * import { PgExternalTestDriverConfig } from "@beep/test-utils"
 * const config = PgExternalTestDriverConfig.make({
 *   connectionUri: "postgres://postgres:postgres@127.0.0.1:5432/postgres"
 * })
 * console.log(config.isolation)
 * ```
 * @category models
 * @since 0.0.0
 */
export class PgExternalTestDriverConfig extends S.Class<PgExternalTestDriverConfig>($I`PgExternalTestDriverConfig`)(
  {
    connectTimeoutMs: PglitePositiveInteger.pipe(
      S.withConstructorDefault(Effect.succeed(5_000)),
      S.withDecodingDefaultKey(Effect.succeed(5_000)),
      $I.annoteKey("PgExternalTestDriverConfig.connectTimeoutMs", {
        description: "Connection timeout in milliseconds for the external PostgreSQL test driver.",
      })
    ),
    connectionUri: PgExternalConnectionUri.pipe(
      $I.annoteKey("PgExternalTestDriverConfig.connectionUri", {
        description: "PostgreSQL-compatible connection URI for the external SQL test driver.",
      })
    ),
    isolation: PgExternalIsolationMode.pipe(
      S.withConstructorDefault(Effect.succeed("schema" as const)),
      S.withDecodingDefaultKey(Effect.succeed("schema" as const)),
      $I.annoteKey("PgExternalTestDriverConfig.isolation", {
        description: "Isolation strategy applied around external PostgreSQL integration tests.",
      })
    ),
    maxConnections: PglitePositiveInteger.pipe(
      S.withConstructorDefault(Effect.succeed(1)),
      S.withDecodingDefaultKey(Effect.succeed(1)),
      $I.annoteKey("PgExternalTestDriverConfig.maxConnections", {
        description: "Maximum PostgreSQL client connections for the external SQL test driver.",
      })
    ),
    schemaPrefix: PgExternalSchemaPrefix.pipe(
      S.withConstructorDefault(Effect.succeed("beep_test")),
      S.withDecodingDefaultKey(Effect.succeed("beep_test")),
      $I.annoteKey("PgExternalTestDriverConfig.schemaPrefix", {
        description: "Prefix used when generating temporary external PostgreSQL schemas.",
      })
    ),
    ssl: S.Literal(false).pipe(
      S.withConstructorDefault(Effect.succeed(false as const)),
      S.withDecodingDefaultKey(Effect.succeed(false as const)),
      $I.annoteKey("PgExternalTestDriverConfig.ssl", {
        description: "SSL toggle for the external PostgreSQL test driver; currently fixed to false.",
      })
    ),
  },
  $I.annote("PgExternalTestDriverConfig", {
    description: "Runtime configuration for an externally managed PostgreSQL-compatible SQL test driver.",
  })
) {
  static readonly decodeEffect = S.decodeUnknownEffect(PgExternalTestDriverConfig);
}

/**
 * Constructor input accepted by the external PostgreSQL SQL test driver.
 *
 * @example
 * ```ts
 * import type { PgExternalTestDriverConfigInput } from "@beep/test-utils/SqlTest"
 *
 * const value: PgExternalTestDriverConfigInput = {
 *   connectionUri: "postgres://postgres:postgres@127.0.0.1:5432/postgres"
 * }
 * console.log(value?.connectionUri)
 * ```
 * @category models
 * @since 0.0.0
 */
export type PgExternalTestDriverConfigInput = Partial<PgExternalTestDriverConfig> | undefined;

/**
 * Mode selector for the public PGLite SQL test layer helper.
 *
 * @example
 * ```ts
 * import { PgliteSqlTestLayerMode } from "@beep/test-utils"
 *
 * console.log(PgliteSqlTestLayerMode.is.auto("auto"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const PgliteSqlTestLayerMode = LiteralKit(["auto", "external", "testcontainers", "in-process"]).pipe(
  $I.annoteSchema("PgliteSqlTestLayerMode", {
    description: "Mode selector for the public PGLite SQL test layer helper.",
  })
);

/**
 * Mode selector for the public PGLite SQL test layer helper.
 *
 * @example
 * ```ts
 * import type { PgliteSqlTestLayerMode } from "@beep/test-utils/SqlTest"
 *
 * const mode: PgliteSqlTestLayerMode = "auto"
 * console.log(mode)
 * ```
 * @category models
 * @since 0.0.0
 */
export type PgliteSqlTestLayerMode = typeof PgliteSqlTestLayerMode.Type;

/**
 * Options for `makePgliteSqlTestLayer`.
 *
 * @example
 * ```ts
 * import type { PgliteSqlTestLayerOptions } from "@beep/test-utils/SqlTest"
 *
 * const value: PgliteSqlTestLayerOptions = { mode: "auto" }
 * console.log(value.mode)
 * ```
 * @category models
 * @since 0.0.0
 */
export interface PgliteSqlTestLayerOptions<MigrateError = never, SeedError = never> {
  readonly external?: PgExternalTestDriverConfigInput;
  readonly hooks?: SqlTestHooks<MigrateError, SeedError>;
  readonly mode?: PgliteSqlTestLayerMode;
  readonly testcontainers?: PgliteTestcontainersTestDriverConfigInput;
}

/**
 * Runtime metadata for an ephemeral integration-test database instance.
 *
 * @example
 * ```ts
 * import { TestDatabaseInfo } from "@beep/test-utils"
 * const key = TestDatabaseInfo
 * console.log(key)
 * ```
 * @category testing
 * @since 0.0.0
 */
export class TestDatabaseInfo extends Context.Service<TestDatabaseInfo, TestDatabaseInfoShape>()(
  $I`TestDatabaseInfo`
) {}

/**
 * Typed harness error surfaced while provisioning or preparing a test database.
 *
 * @example
 * ```ts
 * import { SqlTestHarnessError } from "@beep/test-utils"
 * import * as O from "effect/Option"
 * const error = SqlTestHarnessError.make({
 *   cause: O.none(),
 *   driver: "node-sqlite",
 *   message: "setup failed",
 *   phase: "provision"
 * })
 * console.log(error.message)
 * ```
 * @category error-handling
 * @since 0.0.0
 */
export class SqlTestHarnessError extends TaggedErrorClass<SqlTestHarnessError>($I`SqlTestHarnessError`)(
  "SqlTestHarnessError",
  {
    cause: S.OptionFromOptionalKey(S.Defect({ includeStack: true })).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("SqlTestHarnessError.cause", {
        description: "Optional underlying defect captured while provisioning or preparing the SQL test harness.",
      })
    ),
    driver: TestDatabaseDriver.pipe(
      $I.annoteKey("SqlTestHarnessError.driver", {
        description: "SQL test driver active when the harness failure occurred.",
      })
    ),
    message: S.String.pipe(
      $I.annoteKey("SqlTestHarnessError.message", {
        description: "Human-readable SQL test harness failure message.",
      })
    ),
    phase: SqlTestHarnessPhase.pipe(
      $I.annoteKey("SqlTestHarnessError.phase", {
        description: "Lifecycle phase active when the harness failure occurred.",
      })
    ),
  },
  $I.annote("SqlTestHarnessError", {
    description: "Typed integration-test harness error for SQL database provisioning and setup hooks.",
  })
) {
  static readonly is = S.is(SqlTestHarnessError);
}

/**
 * Optional database setup hooks executed after the driver layer has been built.
 *
 * @example
 * ```ts
 * import type { SqlTestHooks } from "@beep/test-utils"
 * const hooks: SqlTestHooks = {}
 * console.log(hooks)
 * ```
 * @category models
 * @since 0.0.0
 */
export interface SqlTestHooks<MigrateError = never, SeedError = never> {
  readonly migrate?: undefined | Effect.Effect<void, MigrateError, SqlClient.SqlClient>;
  readonly seed?: undefined | Effect.Effect<void, SeedError, SqlClient.SqlClient>;
}

/**
 * Driver contract for reusable SQL integration-test layers.
 *
 * @example
 * ```ts
 * import { NodeSqliteTestDriver } from "@beep/test-utils"
 * import type { SqlTestDriver } from "@beep/test-utils"
 * type DriverName = SqlTestDriver<unknown, unknown, unknown>["name"]
 * const driverName: DriverName = NodeSqliteTestDriver.name
 * console.log(driverName)
 * ```
 * @category models
 * @since 0.0.0
 */
export interface SqlTestDriver<Config, Services, SqlService extends Services> {
  readonly makeLayer: (config: Config) => Layer.Layer<Services, SqlTestHarnessError>;
  readonly name: typeof TestDatabaseDriver.Type;
  readonly sqlClient: Context.Key<SqlService, SqlClient.SqlClient>;
}

const toHarnessError = (
  driver: typeof TestDatabaseDriver.Type,
  phase: typeof SqlTestHarnessPhase.Type,
  message: string,
  cause?: unknown
): SqlTestHarnessError =>
  SqlTestHarnessError.make({
    cause: O.fromUndefinedOr(cause),
    driver,
    message,
    phase,
  });

const makeNoNetworkInfo = (
  driver: Extract<typeof TestDatabaseDriver.Type, "bun-sqlite" | "node-sqlite">,
  databasePath: string,
  tempDir: string
): TestDatabaseInfoShape => ({
  connectionUri: O.none(),
  containerId: O.none(),
  database: O.none(),
  databasePath: O.some(databasePath),
  driver,
  host: O.none(),
  port: O.none(),
  schema: O.none(),
  tempDir: O.some(tempDir),
  username: O.none(),
});

const makeInProcessPgliteInfo = (databasePath: string, tempDir: string): TestDatabaseInfoShape => ({
  connectionUri: O.none(),
  containerId: O.none(),
  database: O.none(),
  databasePath: O.some(databasePath),
  driver: "pglite-inprocess",
  host: O.none(),
  port: O.none(),
  schema: O.none(),
  tempDir: O.some(tempDir),
  username: O.none(),
});

const makePgliteConnectionUri = (host: string, port: number, config: PgliteTestcontainersTestDriverConfig): string => {
  const url = new URL("postgres://localhost");
  url.hostname = host;
  url.port = `${port}`;
  url.pathname = config.database;
  url.username = config.username;
  url.password = config.password;
  return url.href;
};

const makePgliteInfo = (
  container: StartedTestContainer,
  host: string,
  port: number,
  config: PgliteTestcontainersTestDriverConfig
): TestDatabaseInfoShape => ({
  connectionUri: O.some(makePgliteConnectionUri(host, port, config)),
  containerId: O.some(container.getId()),
  database: O.some(config.database),
  databasePath: O.none(),
  driver: "pglite-testcontainers",
  host: O.some(host),
  port: O.some(port),
  schema: O.none(),
  tempDir: O.none(),
  username: O.some(config.username),
});

const databaseNameFromConnectionUri = (parsed: URL): O.Option<string> =>
  pipe(parsed.pathname, Str.replace(/^\//, ""), O.liftPredicate(Str.isNonEmpty));

const makeExternalPgInfo = (connectionUri: string, parsed: URL, schema: O.Option<string>): TestDatabaseInfoShape => ({
  connectionUri: O.some(connectionUri),
  containerId: O.none(),
  database: databaseNameFromConnectionUri(parsed),
  databasePath: O.none(),
  driver: "pg-external",
  host: pipe(parsed.hostname, O.liftPredicate(Str.isNonEmpty)),
  port: pipe(
    parsed.port,
    O.liftPredicate(Str.isNonEmpty),
    O.map((port) => Number.parseInt(port, 10))
  ),
  schema,
  tempDir: O.none(),
  username: pipe(parsed.username, O.liftPredicate(Str.isNonEmpty)),
});

/**
 * Scoped PGLite Testcontainers resource metadata.
 *
 * @example
 * ```ts
 * import type { PgliteTestcontainerResource } from "@beep/test-utils"
 *
 * const host: PgliteTestcontainerResource["host"] = "127.0.0.1"
 * const port: PgliteTestcontainerResource["port"] = 5432
 * console.log(`${host}:${port}`)
 * ```
 * @category models
 * @since 0.0.0
 */
export interface PgliteTestcontainerResource {
  readonly config: PgliteTestcontainersTestDriverConfig;
  readonly connectionUri: string;
  readonly container: StartedTestContainer;
  readonly host: string;
  readonly port: number;
}

interface StartedPgliteContainer {
  readonly container: StartedTestContainer;
  readonly host: string;
  readonly port: number;
}

const releasePgliteContainer = Effect.fn("SqlTest.releasePgliteContainer")(function* (container: StartedTestContainer) {
  yield* Effect.tryPromise({
    try: () => container.stop({ remove: true, removeVolumes: true }),
    catch: (cause) =>
      toHarnessError(
        "pglite-testcontainers",
        "teardown",
        "Failed to stop the PGLite Testcontainers SQL test driver.",
        cause
      ),
  }).pipe(
    Effect.catch(() => Effect.logWarning("Failed to stop PGLite SQL test container; ignoring teardown failure.")),
    Effect.asVoid
  );
});

const runHook = <Services, SqlService extends Services, HookError>(
  driver: typeof TestDatabaseDriver.Type,
  phase: Extract<typeof SqlTestHarnessPhase.Type, "migrate" | "seed">,
  sqlClient: Context.Key<SqlService, SqlClient.SqlClient>,
  hook: undefined | Effect.Effect<void, HookError, SqlClient.SqlClient>,
  context: Context.Context<Services>
): Effect.Effect<void, SqlTestHarnessError> =>
  hook === undefined
    ? Effect.void
    : hook.pipe(
        Effect.provideService(SqlClient.SqlClient, Context.get(context, sqlClient)),
        Effect.mapError((cause) =>
          toHarnessError(
            driver,
            phase,
            phase === "migrate" ? "SQL test migrate hook failed." : "SQL test seed hook failed.",
            cause
          )
        )
      );

/**
 * Build a fresh, scoped SQL integration-test layer for a concrete driver.
 *
 * @param options - Layer construction options, including the driver configuration, driver contract, and optional hooks.
 * @returns A fresh scoped layer that provisions the driver and runs migrate/seed hooks.
 * @example
 * ```ts
 * import { makeSqlTestLayer, NodeSqliteTestDriver } from "@beep/test-utils"
 * const layer = makeSqlTestLayer({
 *   config: undefined,
 *   driver: NodeSqliteTestDriver
 * })
 * console.log(layer)
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const makeSqlTestLayer = <
  Config,
  Services,
  SqlService extends Services,
  MigrateError = never,
  SeedError = never,
>(options: {
  readonly config: Config;
  readonly driver: SqlTestDriver<Config, Services, SqlService>;
  readonly hooks?: SqlTestHooks<MigrateError, SeedError>;
}): Layer.Layer<Services, SqlTestHarnessError> =>
  Layer.effectContext(
    Effect.gen(function* () {
      const context = yield* Layer.build(Layer.fresh(options.driver.makeLayer(options.config)));

      yield* runHook(options.driver.name, "migrate", options.driver.sqlClient, options.hooks?.migrate, context);
      yield* runHook(options.driver.name, "seed", options.driver.sqlClient, options.hooks?.seed, context);

      return context;
    }).pipe(
      Effect.withSpan("SqlTest.makeLayer"),
      Effect.annotateLogs({
        component: "test-utils",
        driver: options.driver.name,
      })
    )
  );

const loadTestcontainersModule = Effect.tryPromise({
  try: () => import("testcontainers"),
  catch: (cause) =>
    toHarnessError(
      "pglite-testcontainers",
      "provision",
      "Failed to load Testcontainers support for PGLite SQL tests.",
      cause
    ),
}).pipe(Effect.withSpan("SqlTest.PgliteTestcontainers.loadTestcontainers"));

const loadPgClientModule = (
  driver: Extract<typeof TestDatabaseDriver.Type, "pglite-testcontainers" | "pglite-inprocess" | "pg-external">
) =>
  Effect.tryPromise({
    try: () => import("@effect/sql-pg"),
    catch: (cause) =>
      toHarnessError(driver, "provision", "Failed to load PostgreSQL client support for SQL tests.", cause),
  }).pipe(Effect.withSpan(`SqlTest.${driver}.loadPgClient`));

const loadPgliteClientModule = Effect.tryPromise({
  try: () => import("@effect/sql-pglite/PgliteClient"),
  catch: (cause) =>
    toHarnessError(
      "pglite-inprocess",
      "provision",
      "Failed to load @effect/sql-pglite in-process driver support for SQL tests.",
      cause
    ),
}).pipe(Effect.withSpan("SqlTest.PgliteInProcess.loadPgliteClient"));

const loadNodeSqliteClientModule = Effect.tryPromise({
  try: () => import("@effect/sql-sqlite-node/SqliteClient"),
  catch: (cause) =>
    toHarnessError(
      "node-sqlite",
      "provision",
      "Failed to load @effect/sql-sqlite-node driver support for SQL tests.",
      cause
    ),
}).pipe(Effect.withSpan("SqlTest.NodeSqliteTestDriver.loadSqliteClient"));

const loadPgModule = Effect.tryPromise({
  try: () => import("pg"),
  catch: (cause) => toHarnessError("pg-external", "provision", "Failed to load pg support for SQL tests.", cause),
}).pipe(Effect.withSpan("SqlTest.PgExternalTestDriver.loadPg"));

const PgConnectRetryPolicy = Schedule.max([Schedule.spaced(Duration.millis(250)), Schedule.recurs(20)]);

const makePgliteConfig = Effect.fn("SqlTest.PgliteTestcontainersTestDriver.makeConfig")(function* (
  configInput: PgliteTestcontainersTestDriverConfigInput
) {
  return yield* PgliteTestcontainersTestDriverConfig.decodeEffect(configInput === undefined ? {} : configInput).pipe(
    Effect.mapError((cause) =>
      toHarnessError("pglite-testcontainers", "provision", "Invalid PGLite Testcontainers SQL test config.", cause)
    )
  );
});

const makePgExternalConfig = Effect.fn("SqlTest.PgExternalTestDriver.makeConfig")(function* (
  configInput: PgExternalTestDriverConfigInput
) {
  return yield* PgExternalTestDriverConfig.decodeEffect(configInput === undefined ? {} : configInput).pipe(
    Effect.mapError((cause) =>
      toHarnessError("pg-external", "provision", "Invalid external PostgreSQL SQL test config.", cause)
    )
  );
});

const resolvePgliteDockerContext = Effect.fn("SqlTest.PgliteTestcontainers.resolveDockerContext")(function* () {
  const pathContext = yield* Layer.build(NodePath.layer);
  const path = Context.get(pathContext, Path.Path);
  return yield* path
    .fromFileUrl(PgliteDockerContextUrl)
    .pipe(
      Effect.mapError((cause) =>
        toHarnessError(
          "pglite-testcontainers",
          "provision",
          "Failed to resolve the PGLite Docker build context.",
          cause
        )
      )
    );
});

const getPgliteImageBuild = (Testcontainers: typeof import("testcontainers"), dockerContext: string) =>
  pipe(
    pgliteImageBuild,
    O.getOrElse(() => {
      const build = Testcontainers.GenericContainer.fromDockerfile(dockerContext).build(PgliteImageName, {
        deleteOnExit: false,
      });

      pgliteImageBuild = O.some(build);
      return build;
    })
  );

const startPgliteContainer = Effect.fn("SqlTest.startPgliteContainer")(function* (
  dockerContext: string,
  config: PgliteTestcontainersTestDriverConfig
) {
  const Testcontainers = yield* loadTestcontainersModule;
  yield* Effect.tryPromise({
    try: () => getPgliteImageBuild(Testcontainers, dockerContext),
    catch: (cause) =>
      toHarnessError("pglite-testcontainers", "provision", "Failed to build the PGLite Testcontainers image.", cause),
  });

  const makeContainer = () =>
    new Testcontainers.GenericContainer(PgliteImageName)
      .withEnvironment({
        PGDATABASE: config.database,
        PGPASSWORD: config.password,
        PGPORT: `${config.internalPort}`,
        PGUSER: config.username,
      })
      .withHealthCheck({
        test: ["CMD-SHELL", PgliteHealthCheckCommand],
        interval: PgliteHealthCheckIntervalMs,
        timeout: 1_000,
        retries: Math.ceil(config.startupTimeoutMs / PgliteHealthCheckIntervalMs),
      })
      .withStartupTimeout(config.startupTimeoutMs)
      .withWaitStrategy(Testcontainers.Wait.forHealthCheck());

  const startBridgeContainer = Effect.tryPromise({
    try: (): Promise<StartedPgliteContainer> =>
      makeContainer()
        .withExposedPorts(config.internalPort)
        .start()
        .then((container) => ({
          container,
          host: container.getHost(),
          port: container.getMappedPort(config.internalPort),
        })),
    catch: (cause) =>
      toHarnessError(
        "pglite-testcontainers",
        "provision",
        "Failed to start the PGLite Testcontainers SQL test driver.",
        cause
      ),
  });

  return yield* Effect.acquireRelease(startBridgeContainer, (started) => releasePgliteContainer(started.container));
});

const waitForPgliteHostReadiness = Effect.fn("SqlTest.waitForPgliteHostReadiness")(function* (connectionUri: string) {
  const PgNative = yield* loadPgModule;
  const probe = Effect.acquireRelease(
    Effect.tryPromise({
      try: () => {
        const client = new PgNative.Client({
          connectionString: connectionUri,
          connectionTimeoutMillis: PgliteHostProbeTimeoutMs,
          query_timeout: PgliteHostProbeTimeoutMs,
          ssl: false,
        });
        return client
          .connect()
          .then(() => client.query("SELECT 1"))
          .then(() => client);
      },
      catch: (cause) =>
        toHarnessError(
          "pglite-testcontainers",
          "provision",
          "PGLite Testcontainers host PostgreSQL port was not ready.",
          cause
        ),
    }),
    (client) => Effect.promise(() => client.end()).pipe(Effect.timeoutOption(PgExternalClientEndTimeout), Effect.asVoid)
  );
  const readiness = Effect.scoped(
    probe.pipe(Effect.asVoid, Effect.retry(PgConnectRetryPolicy), Effect.timeoutOption(PgliteHostReadinessTimeout))
  );

  yield* readiness.pipe(
    Effect.flatMap(
      O.match({
        onNone: () =>
          toHarnessError(
            "pglite-testcontainers",
            "provision",
            "Timed out waiting for the PGLite Testcontainers host PostgreSQL port."
          ),
        onSome: () => Effect.void,
      })
    )
  );
});

/**
 * Start a scoped PGLite Testcontainers PostgreSQL wire-protocol resource.
 *
 * @param configInput - Optional PGLite Testcontainers configuration.
 * @returns Scoped container metadata, including the PostgreSQL connection URI.
 * @example
 * ```ts
 * import { makePgliteTestcontainerResource } from "@beep/test-utils"
 * import { Effect } from "effect"
 * const program = Effect.scoped(makePgliteTestcontainerResource())
 * console.log(program)
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const makePgliteTestcontainerResource = Effect.fn("SqlTest.makePgliteTestcontainerResource")(function* (
  configInput: PgliteTestcontainersTestDriverConfigInput = undefined
) {
  const config = yield* makePgliteConfig(configInput);
  const dockerContext = yield* resolvePgliteDockerContext();
  const started = yield* startPgliteContainer(dockerContext, config);
  const container = started.container;
  const host = started.host;
  const port = started.port;
  const connectionUri = makePgliteConnectionUri(host, port, config);
  yield* waitForPgliteHostReadiness(connectionUri);

  return {
    config,
    connectionUri,
    container,
    host,
    port,
  };
});

const parsePgExternalConnectionUri = Effect.fn("SqlTest.PgExternalTestDriver.parseConnectionUri")(function* (
  connectionUri: string
) {
  const parsed = yield* Effect.try({
    try: () => new URL(connectionUri),
    catch: (cause) => toHarnessError("pg-external", "provision", "Invalid external PostgreSQL connection URI.", cause),
  });

  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    return yield* toHarnessError(
      "pg-external",
      "provision",
      "External PostgreSQL connection URI must use the postgres or postgresql protocol."
    );
  }

  return parsed;
});

const makePgExternalSchemaName = Effect.fn("SqlTest.PgExternalTestDriver.makeSchemaName")(function* (prefix: string) {
  const uuid = randomUUID();
  return `${prefix}_${pipe(uuid, Str.replaceAll("-", "_"))}`;
});

const createPgExternalSchema = Effect.fn("SqlTest.PgExternalTestDriver.createSchema")(function* (
  sql: SqlClient.SqlClient,
  schemaName: string
) {
  yield* sql`CREATE SCHEMA ${sql(schemaName)}`.pipe(
    Effect.mapError((cause) =>
      toHarnessError("pg-external", "provision", "Failed to create external PostgreSQL test schema.", cause)
    )
  );
  yield* sql`SET search_path TO ${sql(schemaName)}, public`.pipe(
    Effect.mapError((cause) =>
      toHarnessError("pg-external", "provision", "Failed to set external PostgreSQL test schema search path.", cause)
    )
  );
});

const resetPgExternalSearchPath = Effect.fn("SqlTest.PgExternalTestDriver.resetSearchPath")(function* (
  sql: SqlClient.SqlClient
) {
  yield* sql`SET search_path TO public`.pipe(
    Effect.catch(() => Effect.logWarning("Failed to reset external PostgreSQL search_path before schema teardown.")),
    Effect.asVoid
  );
});

const dropPgExternalSchema = Effect.fn("SqlTest.PgExternalTestDriver.dropSchema")(function* (
  sql: SqlClient.SqlClient,
  schemaName: string
) {
  yield* Effect.gen(function* () {
    yield* resetPgExternalSearchPath(sql);
    yield* sql`DROP SCHEMA IF EXISTS ${sql(schemaName)} CASCADE`;
  }).pipe(
    Effect.timeoutOption(PgExternalSchemaDropTimeout),
    Effect.flatMap(
      O.match({
        onNone: () => Effect.logWarning(`Timed out dropping external PostgreSQL test schema ${schemaName}.`),
        onSome: () => Effect.void,
      })
    ),
    Effect.catch(() => Effect.logWarning(`Failed to drop external PostgreSQL test schema ${schemaName}.`)),
    Effect.asVoid
  );
});

const acquirePgExternalSchema = Effect.fn("SqlTest.PgExternalTestDriver.acquireSchema")(function* (
  sql: SqlClient.SqlClient,
  schemaName: string
) {
  yield* Effect.acquireRelease(Effect.succeed(schemaName), (name) => dropPgExternalSchema(sql, name));
  yield* createPgExternalSchema(sql, schemaName);
});

const buildPgliteTestcontainersLayer = Effect.fn("SqlTest.PgliteTestcontainersTestDriver.build")(
  function* (configInput: PgliteTestcontainersTestDriverConfigInput) {
    const resource = yield* makePgliteTestcontainerResource(configInput);
    const Pg = yield* loadPgClientModule("pglite-testcontainers");

    return Layer.mergeAll(
      Pg.PgClient.layerFrom(
        Pg.PgClient.make({
          connectTimeout: Duration.seconds(5),
          database: resource.config.database,
          host: resource.host,
          maxConnections: resource.config.maxConnections,
          password: Redacted.make(resource.config.password),
          port: resource.port,
          ssl: false,
          username: resource.config.username,
        }).pipe(
          Effect.retry(PgConnectRetryPolicy),
          Effect.mapError((cause) =>
            toHarnessError(
              "pglite-testcontainers",
              "provision",
              "Failed to connect the Effect PostgreSQL client to the PGLite Testcontainers server.",
              cause
            )
          )
        )
      ),
      Layer.succeed(TestDatabaseInfo, makePgliteInfo(resource.container, resource.host, resource.port, resource.config))
    );
  },
  Effect.mapError((cause) =>
    SqlTestHarnessError.is(cause)
      ? cause
      : toHarnessError(
          "pglite-testcontainers",
          "provision",
          "Failed to provision the PGLite Testcontainers SQL test driver.",
          cause
        )
  ),
  Effect.withSpan("SqlTest.PgliteTestcontainersTestDriver.build")
);

const buildPgExternalLayer: (
  configInput: PgExternalTestDriverConfigInput
) => Effect.Effect<
  Layer.Layer<PgClient.PgClient | SqlClient.SqlClient | TestDatabaseInfo, SqlTestHarnessError>,
  SqlTestHarnessError,
  never
> = Effect.fn("SqlTest.PgExternalTestDriver.build")(
  function* (configInput: PgExternalTestDriverConfigInput) {
    const config = yield* makePgExternalConfig(configInput);
    const parsed = yield* parsePgExternalConnectionUri(config.connectionUri);
    const Pg = yield* loadPgClientModule("pg-external");
    const PgNative = yield* loadPgModule;

    return Layer.effectContext(
      Effect.gen(function* () {
        const reactivityContext = yield* Layer.build(Reactivity.layer);
        const reactivity = Context.get(reactivityContext, Reactivity.Reactivity);
        const client = yield* Pg.PgClient.fromClient({
          acquire: Effect.acquireRelease(
            Effect.tryPromise({
              try: () => {
                const client = new PgNative.Client({
                  connectionString: config.connectionUri,
                  connectionTimeoutMillis: config.connectTimeoutMs,
                  query_timeout: config.connectTimeoutMs,
                  ssl: config.ssl,
                });
                return client
                  .connect()
                  .then(() => client.query("SELECT 1"))
                  .then(() => client);
              },
              catch: (cause) =>
                SqlError.make({
                  reason: ConnectionError.make({
                    cause,
                    message: "PgExternalTestDriver: Failed to connect",
                    operation: "connect",
                  }),
                }),
            }),
            (client) =>
              Effect.promise(() => client.end()).pipe(Effect.timeoutOption(PgExternalClientEndTimeout), Effect.asVoid)
          ),
          acquireForStream: false,
        }).pipe(
          Effect.retry(PgConnectRetryPolicy),
          Effect.provideService(Reactivity.Reactivity, reactivity),
          Effect.mapError((cause) =>
            toHarnessError(
              "pg-external",
              "provision",
              "Failed to connect the Effect PostgreSQL client to the external SQL test server.",
              cause
            )
          )
        );
        const sql = client.withoutTransforms();
        const schema =
          config.isolation === "schema" ? O.some(yield* makePgExternalSchemaName(config.schemaPrefix)) : O.none();

        yield* pipe(
          schema,
          O.match({
            onNone: () => Effect.void,
            onSome: (schemaName) => acquirePgExternalSchema(sql, schemaName),
          })
        );

        return Context.make(Pg.PgClient.PgClient, client).pipe(
          Context.add(SqlClient.SqlClient, client),
          Context.add(TestDatabaseInfo, makeExternalPgInfo(config.connectionUri, parsed, schema))
        );
      })
    );
  },
  Effect.mapError((cause) =>
    SqlTestHarnessError.is(cause)
      ? cause
      : toHarnessError(
          "pg-external",
          "provision",
          "Failed to provision the external PostgreSQL SQL test driver.",
          cause
        )
  ),
  Effect.withSpan("SqlTest.PgExternalTestDriver.build")
);

const buildBunSqliteLayer = Effect.gen(function* () {
  const BunFileSystem = yield* Effect.tryPromise({
    try: () => import("@effect/platform-bun/BunFileSystem"),
    catch: (cause) =>
      toHarnessError("bun-sqlite", "provision", "Failed to load Bun filesystem support for SQL tests.", cause),
  });
  const BunPath = yield* Effect.tryPromise({
    try: () => import("@effect/platform-bun/BunPath"),
    catch: (cause) =>
      toHarnessError("bun-sqlite", "provision", "Failed to load Bun path support for SQL tests.", cause),
  });
  const BunSqliteClient = yield* Effect.tryPromise({
    try: () => import("@effect/sql-sqlite-bun"),
    catch: (cause) =>
      toHarnessError("bun-sqlite", "provision", "Failed to load Bun SQLite support for SQL tests.", cause),
  });
  const context = yield* Layer.build(Layer.mergeAll(BunFileSystem.layer, BunPath.layer));
  const fs = Context.get(context, FileSystem.FileSystem);
  const path = Context.get(context, Path.Path);
  const tempDir = yield* fs
    .makeTempDirectoryScoped({ prefix: "beep-sql-test-" })
    .pipe(
      Effect.mapError((cause) =>
        toHarnessError("bun-sqlite", "provision", "Failed to create a temporary SQLite test directory.", cause)
      )
    );
  const databasePath = path.join(tempDir, "test.db");

  return Layer.mergeAll(
    BunFileSystem.layer,
    BunPath.layer,
    BunSqliteClient.SqliteClient.layer({ filename: databasePath }),
    Layer.succeed(TestDatabaseInfo, makeNoNetworkInfo("bun-sqlite", databasePath, tempDir))
  );
}).pipe(
  Effect.mapError((cause) =>
    SqlTestHarnessError.is(cause)
      ? cause
      : toHarnessError("bun-sqlite", "provision", "Failed to provision the Bun SQLite test driver.", cause)
  ),
  Effect.withSpan("SqlTest.BunSqliteTestDriver.build")
);

/**
 * Fresh Bun SQLite integration-test driver backed by a scoped temp directory.
 *
 * @example
 * ```ts
 * import { BunSqliteTestDriver } from "@beep/test-utils"
 * const driverName = BunSqliteTestDriver.name
 * console.log(driverName)
 * ```
 * @category testing
 * @since 0.0.0
 */
export const BunSqliteTestDriver: SqlTestDriver<
  void,
  FileSystem.FileSystem | Path.Path | SqlClient.SqlClient | TestDatabaseInfo,
  SqlClient.SqlClient
> = {
  makeLayer: () => Layer.unwrap(buildBunSqliteLayer),
  name: "bun-sqlite",
  sqlClient: SqlClient.SqlClient,
};

const makeNodeTempDirectory = Effect.fn("SqlTest.makeNodeTempDirectory")(function* (
  driver: typeof TestDatabaseDriver.Type,
  prefix: string,
  failureMessage: string
) {
  const context = yield* Layer.build(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer));
  const fs = Context.get(context, FileSystem.FileSystem);
  const path = Context.get(context, Path.Path);
  const tempDir = yield* fs
    .makeTempDirectoryScoped({ prefix })
    .pipe(Effect.mapError((cause) => toHarnessError(driver, "provision", failureMessage, cause)));

  return { path, tempDir };
});

const buildNodeSqliteLayer = Effect.gen(function* () {
  const SqliteClient = yield* loadNodeSqliteClientModule;
  const { path, tempDir } = yield* makeNodeTempDirectory(
    "node-sqlite",
    "beep-sql-test-",
    "Failed to create a temporary SQLite test directory."
  );
  const databasePath = path.join(tempDir, "test.db");

  return Layer.effectContext(
    Layer.build(
      Layer.mergeAll(
        NodeFileSystem.layer,
        NodePath.layer,
        SqliteClient.layer({ filename: databasePath }),
        Layer.succeed(TestDatabaseInfo, makeNoNetworkInfo("node-sqlite", databasePath, tempDir))
      )
    ).pipe(
      Effect.catchCause((cause) =>
        Effect.fail(
          toHarnessError(
            "node-sqlite",
            "provision",
            "Failed to provision the Node SQLite test driver. Ensure the current Node.js runtime includes node:sqlite support before selecting NodeSqliteTestDriver.",
            cause
          )
        )
      )
    )
  );
}).pipe(
  Effect.mapError((cause) =>
    SqlTestHarnessError.is(cause)
      ? cause
      : toHarnessError("node-sqlite", "provision", "Failed to provision the Node SQLite test driver.", cause)
  ),
  Effect.withSpan("SqlTest.NodeSqliteTestDriver.build")
);

/**
 * Fresh Node SQLite integration-test driver backed by a scoped temp directory.
 *
 * @example
 * ```ts
 * import { NodeSqliteTestDriver } from "@beep/test-utils"
 * const driverName = NodeSqliteTestDriver.name
 * console.log(driverName)
 * ```
 * @category testing
 * @since 0.0.0
 */
export const NodeSqliteTestDriver: SqlTestDriver<
  void,
  FileSystem.FileSystem | Path.Path | SqlClient.SqlClient | NodeSqliteClient.SqliteClient | TestDatabaseInfo,
  SqlClient.SqlClient
> = {
  makeLayer: () => Layer.unwrap(buildNodeSqliteLayer),
  name: "node-sqlite",
  sqlClient: SqlClient.SqlClient,
};

/**
 * Fresh PGLite integration-test driver backed by a scoped Testcontainers PostgreSQL wire-protocol server.
 *
 * @example
 * ```ts
 * import { PgliteTestcontainersTestDriver } from "@beep/test-utils"
 * const driverName = PgliteTestcontainersTestDriver.name
 * console.log(driverName)
 * ```
 * @category testing
 * @since 0.0.0
 */
export const PgliteTestcontainersTestDriver: SqlTestDriver<
  PgliteTestcontainersTestDriverConfigInput,
  PgClient.PgClient | SqlClient.SqlClient | TestDatabaseInfo,
  SqlClient.SqlClient
> = {
  makeLayer: (config) => Layer.unwrap(buildPgliteTestcontainersLayer(config)),
  name: "pglite-testcontainers",
  sqlClient: SqlClient.SqlClient,
};

const buildPgliteInProcessLayer = Effect.fn("SqlTest.PgliteInProcessTestDriver.build")(
  function* () {
    const PgliteClient = yield* loadPgliteClientModule;
    const Pg = yield* loadPgClientModule("pglite-inprocess");
    const { path, tempDir } = yield* makeNodeTempDirectory(
      "pglite-inprocess",
      "beep-pglite-test-",
      "Failed to create a temporary in-process PGLite test directory."
    );
    const dataDir = path.join(tempDir, "pgdata");

    return Layer.effectContext(
      Effect.gen(function* () {
        const pgliteContext = yield* Layer.build(PgliteClient.layer({ dataDir, relaxedDurability: true })).pipe(
          Effect.mapError((cause) =>
            toHarnessError(
              "pglite-inprocess",
              "provision",
              "Failed to provision the in-process PGLite SQL test driver.",
              cause
            )
          )
        );
        const client = Context.get(pgliteContext, PgliteClient.PgliteClient);
        const pgClient = client as unknown as PgClient.PgClient;

        return Context.make(Pg.PgClient.PgClient, pgClient).pipe(
          Context.add(SqlClient.SqlClient, pgClient),
          Context.add(TestDatabaseInfo, makeInProcessPgliteInfo(dataDir, tempDir))
        );
      })
    );
  },
  Effect.mapError((cause) =>
    SqlTestHarnessError.is(cause)
      ? cause
      : toHarnessError(
          "pglite-inprocess",
          "provision",
          "Failed to provision the in-process PGLite SQL test driver.",
          cause
        )
  ),
  Effect.withSpan("SqlTest.PgliteInProcessTestDriver.build")
);

/**
 * Docker-free in-process PGLite integration-test driver backed by `@effect/sql-pglite`.
 *
 * Runs PGlite (embedded PostgreSQL) in-process against a scoped temporary data
 * directory via `@effect/sql-pglite` and aliases it under the `@effect/sql-pg`
 * PgClient tag, so Drizzle-backed repositories run against it exactly as the
 * desktop sidecar does — with no docker daemon or external server. This is the
 * default driver the gate selects.
 *
 * @example
 * ```ts
 * import { PgliteInProcessTestDriver } from "@beep/test-utils"
 * const driverName = PgliteInProcessTestDriver.name
 * console.log(driverName)
 * ```
 * @category testing
 * @since 0.0.0
 */
export const PgliteInProcessTestDriver: SqlTestDriver<
  void,
  PgClient.PgClient | SqlClient.SqlClient | TestDatabaseInfo,
  SqlClient.SqlClient
> = {
  makeLayer: () => Layer.unwrap(buildPgliteInProcessLayer()),
  name: "pglite-inprocess",
  sqlClient: SqlClient.SqlClient,
};

/**
 * External PostgreSQL-compatible integration-test driver backed by a caller-managed server.
 *
 * @example
 * ```ts
 * import { PgExternalTestDriver } from "@beep/test-utils"
 * const driverName = PgExternalTestDriver.name
 * console.log(driverName)
 * ```
 * @category testing
 * @since 0.0.0
 */
export const PgExternalTestDriver: SqlTestDriver<
  PgExternalTestDriverConfigInput,
  PgClient.PgClient | SqlClient.SqlClient | TestDatabaseInfo,
  SqlClient.SqlClient
> = {
  makeLayer: (config) => Layer.unwrap(buildPgExternalLayer(config)),
  name: "pg-external",
  sqlClient: SqlClient.SqlClient,
};

const resolvePgliteExternalConfig = Effect.fn("SqlTest.resolvePgliteExternalConfig")(function* (
  config: PgExternalTestDriverConfigInput
) {
  const envConnectionUri = yield* Config.string("BEEP_TEST_DATABASE_URL").pipe(
    Config.option,
    Effect.orElseSucceed(O.none<string>)
  );
  if (config?.connectionUri !== undefined || O.isNone(envConnectionUri) || !Str.isNonEmpty(envConnectionUri.value)) {
    return config;
  }

  return {
    ...config,
    connectionUri: envConnectionUri.value,
  };
});

const shouldUseExternalPgliteLayer = (mode: PgliteSqlTestLayerMode, config: PgExternalTestDriverConfigInput): boolean =>
  PgliteSqlTestLayerMode.$match(mode, {
    auto: () => config?.connectionUri !== undefined,
    external: () => true,
    "in-process": () => false,
    testcontainers: () => false,
  });

const shouldUseTestcontainersPgliteLayer = (mode: PgliteSqlTestLayerMode): boolean =>
  PgliteSqlTestLayerMode.$match(mode, {
    auto: () =>
      O.getOrUndefined(Effect.runSync(Config.option(Config.string("BEEP_TEST_DATABASE_DRIVER")))) ===
      "pglite-testcontainers",
    external: () => false,
    "in-process": () => false,
    testcontainers: () => true,
  });

const makeConfiguredSqlTestLayer = <Config, Services, SqlService extends Services, MigrateError, SeedError>(
  driver: SqlTestDriver<Config, Services, SqlService>,
  config: Config,
  hooks: undefined | SqlTestHooks<MigrateError, SeedError>
): Layer.Layer<Services, SqlTestHarnessError> =>
  hooks === undefined
    ? makeSqlTestLayer({
        config,
        driver,
      })
    : makeSqlTestLayer({
        config,
        driver,
        hooks,
      });

/**
 * Pre-computed gate values for PGLite integration tests.
 *
 * Encapsulates the shared connection-URI resolution, testcontainers flag,
 * run-gate predicate, timeout constant, and a `makePgliteLayer` factory so
 * that every pglite integration test file can set up its gate with a single
 * import instead of repeating the five-line preamble.
 *
 * `makePgliteLayer` accepts an optional `hooks` argument (migrate / seed) and
 * returns a fresh scoped {@link makePgliteSqlTestLayer} layer using whichever
 * driver the environment selects.
 *
 * @param env - Optional explicit driver/URL selection. Omitted in real usage
 * (read from the environment via `Config`); tests pass it to exercise each
 * gate branch without mutating the process environment.
 * @returns The run-gate predicate, the integration timeout constant, the
 * resolved connection-URI/testcontainers flags, and a `makePgliteLayer` factory.
 * @example
 * ```ts
 * import { makePgliteIntegrationGate } from "@beep/test-utils"
 *
 * const { shouldRunPgliteIntegration, pgliteIntegrationTimeoutMillis, makePgliteLayer } =
 *   makePgliteIntegrationGate()
 *
 * console.log(shouldRunPgliteIntegration, pgliteIntegrationTimeoutMillis)
 * console.log(makePgliteLayer())
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const makePgliteIntegrationGate = (env?: PgliteIntegrationGateEnv) => {
  // Real usage reads the selection from the environment via Config (Node-safe,
  // law-clean; CI exports these before the process starts, so the boot snapshot
  // is exactly right). Tests pass `env` explicitly to exercise each branch
  // without mutating the process environment.
  const resolved = env ?? {
    databaseDriver: O.getOrUndefined(Effect.runSync(Config.option(Config.string("BEEP_TEST_DATABASE_DRIVER")))),
    databaseUrl: O.getOrUndefined(Effect.runSync(Config.option(Config.string("BEEP_TEST_DATABASE_URL")))),
  };
  const sharedConnectionUri = pipe(resolved.databaseUrl, O.fromNullishOr, O.filter(Str.isNonEmpty));
  const shouldUseTestcontainers = resolved.databaseDriver === "pglite-testcontainers";
  // The in-process @beep/pglite driver is the docker-free default, so the pglite
  // integration suites always run. `BEEP_TEST_DATABASE_URL` (external) and
  // `BEEP_TEST_DATABASE_DRIVER=pglite-testcontainers` remain opt-in fallbacks.
  const shouldRunPgliteIntegration: boolean = true;
  const pgliteIntegrationTimeoutMillis = 300_000;

  // Generic per call so `makePgliteLayer({ migrate })` infers the hook error
  // types (e.g. SqlError) instead of fixing them to `never` at gate creation.
  const makePgliteLayer = <MigrateError = never, SeedError = never>(hooks?: SqlTestHooks<MigrateError, SeedError>) => {
    if (O.isSome(sharedConnectionUri)) {
      const connectionUri = sharedConnectionUri.value;
      return hooks === undefined
        ? Layer.fresh(makePgliteSqlTestLayer({ external: { connectionUri }, mode: "external" }))
        : Layer.fresh(makePgliteSqlTestLayer({ external: { connectionUri }, hooks, mode: "external" }));
    }

    if (shouldUseTestcontainers) {
      return hooks === undefined
        ? Layer.fresh(makePgliteSqlTestLayer({ mode: "testcontainers" }))
        : Layer.fresh(makePgliteSqlTestLayer({ hooks, mode: "testcontainers" }));
    }

    return hooks === undefined
      ? Layer.fresh(makePgliteSqlTestLayer({ mode: "in-process" }))
      : Layer.fresh(makePgliteSqlTestLayer({ hooks, mode: "in-process" }));
  };

  return {
    makePgliteLayer,
    pgliteIntegrationTimeoutMillis,
    sharedConnectionUri,
    shouldRunPgliteIntegration,
    shouldUseTestcontainers,
  };
};

/**
 * Build the recommended PGLite SQL test layer for vertical-slice integration tests.
 *
 * In `auto` mode, `BEEP_TEST_DATABASE_URL` selects the cheap shared external
 * PostgreSQL driver. Without that environment variable, the helper falls back
 * to the docker-free, temp-directory-backed in-process PGLite driver. Set
 * `BEEP_TEST_DATABASE_DRIVER=pglite-testcontainers` when a scoped wire-protocol
 * Testcontainers driver is required.
 *
 * @param options - Optional mode, driver configuration, and migrate/seed hooks.
 * @returns A SQL test layer backed by external PostgreSQL, PGLite Testcontainers, or in-process PGLite.
 * @example
 * ```ts
 * import { makePgliteSqlTestLayer } from "@beep/test-utils"
 * const layer = makePgliteSqlTestLayer()
 * console.log(layer)
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const makePgliteSqlTestLayer = <MigrateError = never, SeedError = never>(
  options: PgliteSqlTestLayerOptions<MigrateError, SeedError> = {}
): Layer.Layer<PgClient.PgClient | SqlClient.SqlClient | TestDatabaseInfo, SqlTestHarnessError> =>
  Layer.unwrap(
    Effect.gen(function* () {
      const mode = options.mode ?? "auto";
      const externalConfig = yield* resolvePgliteExternalConfig(options.external);

      if (shouldUseExternalPgliteLayer(mode, externalConfig)) {
        return makeConfiguredSqlTestLayer(PgExternalTestDriver, externalConfig, options.hooks);
      }

      if (shouldUseTestcontainersPgliteLayer(mode)) {
        return makeConfiguredSqlTestLayer(PgliteTestcontainersTestDriver, options.testcontainers, options.hooks);
      }

      return makeConfiguredSqlTestLayer(PgliteInProcessTestDriver, undefined, options.hooks);
    })
  );
