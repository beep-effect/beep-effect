/** Real-file SQLite execution proofs for the round-seven dialect. */
import { Database } from "bun:sqlite";
import { VersionConflictError } from "@beep/effect-drizzle";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { layer as makeSqliteLayer } from "@effect/sql-sqlite-bun/SqliteClient";
import { expect, layer } from "@effect/vitest";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { numeric, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { findFirst } from "effect/Array";
import { Service } from "effect/Context";
import { formatIso, makeUnsafe, toDate } from "effect/DateTime";
import {
  addFinalizer,
  exit,
  flip,
  fnUntraced,
  forEach,
  gen,
  map,
  option,
  orDie,
  sync,
  tryPromise,
} from "effect/Effect";
import { isSuccess } from "effect/Exit";
import { FileSystem } from "effect/FileSystem";
import { effect as effectLayer, provide, provideMerge, unwrap } from "effect/Layer";
import { getOrThrow, getOrUndefined, isNone, none, some } from "effect/Option";
import { hasProperty, isFunction } from "effect/Predicate";
import {
  Array as ArraySchema,
  Date as DateSchema,
  decodeUnknownEffect,
  Finite,
  is,
  String as StringSchema,
  Struct as StructSchema,
  TaggedError,
  Unknown,
} from "effect/Schema";
import { makeEffect } from "effect/SchemaParser";
import { camelCase, snakeCase } from "effect/String";
import { SqlClient } from "effect/unstable/sql/SqlClient";
import { isSqlError } from "effect/unstable/sql/SqlError";
import { makeRepository as makeSqlRepository } from "effect/unstable/sql/SqlModel";
import {
  SqliteOrganization,
  SqliteUser,
  sqliteAssembly,
  sqliteNativeUserRepository,
  sqliteUserRepository,
} from "../sqlite-fixtures.ts";

const RelationId = StructSchema({ id: Finite.annotate({ identifier: "SqliteRelationId" }) });
const UserRelationRows = ArraySchema(
  StructSchema({
    id: Finite,
    organization: RelationId,
    sharedOrganizationsThroughSharedMembership: ArraySchema(RelationId),
  })
);
const OrganizationRelationRows = ArraySchema(
  StructSchema({
    id: Finite,
    sharedUsers: ArraySchema(RelationId),
    sharedUsersThroughSharedMembership: ArraySchema(RelationId),
  })
);

class SqliteHarnessError extends TaggedError<SqliteHarnessError>("@beep/effect-drizzle/test/SqliteHarnessError")(
  "SqliteHarnessError",
  { message: StringSchema, cause: Unknown }
) {}

const invokeFindMany = (query: unknown, config: unknown): Promise<unknown> => {
  if (hasProperty(query, "findMany") && isFunction(query.findMany)) {
    return Reflect.apply(query.findMany, query, [config]);
  }
  return Promise.reject(new Error("SQLite RQBv2 findMany is unavailable"));
};

const repositoryRoot = new URL("../../../../../", import.meta.url).pathname;
const schemaPath = "packages/ecosystem/effect-drizzle/test/integration/sqlite-drizzle-schema.ts";
const preloadPath = new URL("./drizzle-kit-sqlite-rc-compat.cjs", import.meta.url).pathname;

// drizzle-kit needs Node's CJS module loader, but under `bunx --bun vitest`
// every PATH entry named `node` (including `/usr/bin/env node`) resolves to
// Bun's shim. Probe PATH candidates for a real Node binary instead of
// hardcoding a location that differs across hosts and CI runners.
const isRealNode = (candidate: string): boolean => {
  const probe = Bun.spawnSync([candidate, "--print", "process.isBun ? 1 : 0"]);
  return probe.exitCode === 0 && new TextDecoder().decode(probe.stdout).trim() === "0";
};

const resolveNodeBinary = (): string => {
  const override = Bun.env.BEEP_NODE_BIN;
  if (override !== undefined && override.length > 0) {
    return override;
  }
  return (
    (Bun.env.PATH ?? "")
      .split(":")
      .filter((directory) => directory.length > 0)
      .map((directory) => Bun.which("node", { PATH: directory }))
      .find((candidate) => candidate !== null && isRealNode(candidate)) ?? "/usr/bin/node"
  );
};

const nodeBinary = resolveNodeBinary();

const runPush = (databasePath: string) =>
  tryPromise({
    try: (): Promise<string> => {
      const inheritedOptions = Bun.env.NODE_OPTIONS;
      const nodeOptions =
        inheritedOptions === undefined ? `--require=${preloadPath}` : `${inheritedOptions} --require=${preloadPath}`;
      const process = Bun.spawn(
        [
          nodeBinary,
          "./node_modules/.bin/drizzle-kit",
          "push",
          "--dialect",
          "sqlite",
          "--schema",
          schemaPath,
          "--url",
          databasePath,
          "--force",
          "--verbose",
        ],
        {
          cwd: repositoryRoot,
          env: { ...Bun.env, NODE_OPTIONS: nodeOptions },
          stdin: "ignore",
          stdout: "pipe",
          stderr: "pipe",
        }
      );
      return Promise.all([
        process.exited,
        new Response(process.stdout).text(),
        new Response(process.stderr).text(),
      ]).then(([status, stdout, stderr]) => {
        const output = `${stdout}\n${stderr}`;
        if (status !== 0) {
          throw SqliteHarnessError.make({
            message: `drizzle-kit SQLite push failed (${status})`,
            cause: output,
          });
        }
        return output;
      });
    },
    catch: (cause) =>
      SqliteHarnessError.make({
        message: "drizzle-kit SQLite push failed",
        cause,
      }),
  });

class SqliteHarness extends Service<
  SqliteHarness,
  {
    readonly databasePath: string;
    readonly drizzleClient: Database;
    readonly migrationOutput: string;
    readonly noOpOutput: string;
  }
>()("@beep/effect-drizzle/test/integration/sqlite-live.test/SqliteHarness") {}

const organizationRepository = makeSqlRepository(SqliteOrganization, {
  tableName: SqliteOrganization.sql.tableName,
  spanPrefix: "SqliteOrganization",
  idColumn: "id",
});

const createOrganization = (name: string) =>
  gen(function* () {
    const repository = yield* organizationRepository;
    const request = yield* makeEffect(SqliteOrganization.insert)({ name });
    return yield* repository.insert(request);
  });

const SqliteHarnessState = effectLayer(
  SqliteHarness,
  gen(function* () {
    const fileSystem = yield* FileSystem;
    const databaseDirectory = yield* fileSystem.makeTempDirectory({
      prefix: "effect-drizzle-live-",
    });
    yield* addFinalizer(() => fileSystem.remove(databaseDirectory, { recursive: true, force: true }).pipe(orDie));
    const databasePath = `${databaseDirectory}/live.sqlite`;
    const migrationOutput = yield* runPush(databasePath);
    const noOpOutput = yield* runPush(databasePath);
    const drizzleClient = new Database(databasePath);
    drizzleClient.run("PRAGMA foreign_keys = ON");
    yield* addFinalizer(() => sync(() => drizzleClient.close()));
    return SqliteHarness.of({ databasePath, drizzleClient, migrationOutput, noOpOutput });
  })
).pipe(provide(BunFileSystem.layer));

const SqliteRepositoryLayer = unwrap(
  map(SqliteHarness, ({ databasePath }) =>
    makeSqliteLayer({
      filename: databasePath,
      transformQueryNames: snakeCase,
      transformResultNames: camelCase,
    })
  )
);

const SqliteHarnessLayer = SqliteRepositoryLayer.pipe(provideMerge(SqliteHarnessState));

layer(SqliteHarnessLayer, { timeout: 90_000 })("@beep/effect-drizzle live SQLite gauntlet", (it) => {
  it.effect(
    "applies projected DDL through drizzle-kit and regenerates to no-op",
    fnUntraced(function* () {
      const { migrationOutput, noOpOutput } = yield* SqliteHarness;
      expect(migrationOutput).toContain("`shared_user`");
      expect(migrationOutput).toContain("AUTOINCREMENT");
      expect(migrationOutput).toContain("shared_user_status_enum_check");
      expect(migrationOutput).toContain("Changes applied");
      expect(noOpOutput).toContain("No changes detected");
    })
  );

  it.effect(
    "keeps the SQLite RC preload only while the upstream export is absent",
    fnUntraced(function* () {
      const sqliteCore = yield* tryPromise(() => import("drizzle-orm/sqlite-core"));
      expect(hasProperty(sqliteCore, "SQLiteSyncDialect")).toBe(false);
      expect(hasProperty(sqliteCore, "SQLiteDialect")).toBe(true);
    })
  );

  it("restricts NUMERIC modes to live representation-preserving carriers", () => {
    const client = new Database(":memory:");
    try {
      client.run("create table numeric_affinity_probe (value numeric)");
      const insertAffinity = client.query("insert into numeric_affinity_probe values (?)");
      insertAffinity.run("3.0e+5");
      insertAffinity.run("001.2300");
      insertAffinity.run("0.12345678901234567890123456789");
      expect(client.query("select value, typeof(value) as storage from numeric_affinity_probe").all()).toEqual([
        { value: 300000, storage: "integer" },
        { value: 1.23, storage: "real" },
        { value: 0.12345678901234568, storage: "real" },
      ]);

      const numbers = sqliteTable("wave_e_numeric_number", {
        value: numeric({ mode: "number" }).notNull(),
      });
      const bigints = sqliteTable("wave_e_numeric_bigint", {
        value: numeric({ mode: "bigint" }).notNull(),
      });
      client.run("create table wave_e_numeric_number (value numeric not null)");
      client.run("create table wave_e_numeric_bigint (value numeric not null)");
      const db = drizzle({ client });
      db.insert(numbers)
        .values([{ value: -1.25 }, { value: 0 }, { value: 42.5 }])
        .run();
      db.insert(bigints)
        .values([{ value: -9_223_372_036_854_775_808n }, { value: 9_223_372_036_854_775_807n }])
        .run();
      expect(db.select().from(numbers).all()).toEqual([{ value: -1.25 }, { value: 0 }, { value: 42.5 }]);
      expect(db.select().from(bigints).all()).toEqual([
        { value: -9_223_372_036_854_775_808n },
        { value: 9_223_372_036_854_775_807n },
      ]);
      db.insert(bigints).values({ value: 9_223_372_036_854_775_808n }).run();
      expect(client.query("select typeof(value) as storage from wave_e_numeric_bigint where rowid = 3").get()).toEqual({
        storage: "real",
      });
      expect(() => db.select().from(bigints).all()).toThrow();
    } finally {
      client.close();
    }
  });

  it("probes bun:sqlite NaN binding before the SQLite REAL refinement", () => {
    const client = new Database(":memory:");
    try {
      client.run("create table nan_binding_probe (value real)");
      client.query("insert into nan_binding_probe values (?)").run(Number.NaN);
      expect(client.query("select value, typeof(value) as storage from nan_binding_probe").get()).toEqual({
        value: null,
        storage: "null",
      });
    } finally {
      client.close();
    }
  });

  it("probes Date corruption through Drizzle SQLite JSON mode", () => {
    const client = new Database(":memory:");
    try {
      const table = sqliteTable("date_json_mode_probe", {
        value: text("value", { mode: "json" }).$type<Date>(),
      });
      client.run("create table date_json_mode_probe (value text not null)");
      const date = toDate(makeUnsafe("2026-08-10T00:00:00.000Z"));
      const db = drizzle({ client });
      db.insert(table).values({ value: date }).run();
      const selected = db.select().from(table).get();
      expect(client.query("select value from date_json_mode_probe").get()).toEqual({
        value: '"2026-08-10T00:00:00.000Z"',
      });
      expect(typeof selected?.value).toBe("string");
      expect(is(DateSchema)(selected?.value)).toBe(false);
    } finally {
      client.close();
    }
  });

  it("keeps deeper SQLite expression restrictions database-checked", () => {
    const client = new Database(":memory:");
    try {
      expect(() =>
        client.run(`
          create table wave_e_generated_volatile (
            value integer generated always as (random()) stored
          )
        `)
      ).toThrow();
      expect(() =>
        client.run(`
          create table wave_e_default_column_reference (
            source integer,
            value integer default (source + 1)
          )
        `)
      ).toThrow();
      expect(() =>
        client.run(`
          create table wave_e_check_subquery (
            value integer check (value > (select 0))
          )
        `)
      ).toThrow();
      client.run("create table wave_e_partial_index (value integer)");
      expect(() =>
        client.run(`
          create index wave_e_partial_index_volatile
          on wave_e_partial_index (value)
          where random() > 0.5
        `)
      ).toThrow();
    } finally {
      client.close();
    }
  });

  it("mirrors SQLite default, action, and cardinality boundaries", () => {
    const client = new Database(":memory:");
    try {
      expect(() => client.run("create table wave_e_empty ()")).toThrow();
      expect(() =>
        client.run(`
          create table wave_e_generated_only (
            value integer generated always as (1) stored
          )
        `)
      ).toThrow();
      expect(() =>
        client.run(`
          create table wave_e_too_many_columns (
            ${Array.from({ length: 2_001 }, (_, index) => `c${index} integer`).join(", ")}
          )
        `)
      ).toThrow();
      expect(() => client.run("create table wave_e_invalid_default (value real default (-Infinity))")).toThrow();

      client.run("pragma foreign_keys = on");
      client.run(`
        create table wave_e_action_parent (id integer primary key);
        create table wave_e_action_child (
          id integer primary key,
          parent_id integer references wave_e_action_parent(id) on delete set null
        );
        insert into wave_e_action_parent values (1);
        insert into wave_e_action_child values (1, 1);
        delete from wave_e_action_parent where id = 1;
      `);
      expect(client.query("select parent_id from wave_e_action_child").get()).toEqual({
        parent_id: null,
      });
    } finally {
      client.close();
    }
  });

  it.effect(
    "runs native repository CRUD with db keys, timestamps, and Option NULL codecs",
    fnUntraced(function* () {
      const organization = yield* createOrganization("SQLite Native");
      const repository = yield* sqliteNativeUserRepository;
      const request = yield* makeEffect(SqliteUser.insert)({
        organizationId: organization.id,
        name: "Native SQLite User",
        nickname: none(),
        status: "draft",
      });
      const inserted = yield* repository.insert(request);
      const found = yield* repository.findById(inserted.id);
      const update = yield* makeEffect(SqliteUser.update)({
        id: inserted.id,
        rowVersion: inserted.rowVersion,
        name: "Native SQLite User Updated",
        nickname: some("round-seven"),
      });
      const updated = yield* repository.update(update);
      yield* repository.delete(inserted.id);
      const missing = yield* option(repository.findById(inserted.id));

      expect(inserted.id).toBeGreaterThan(0);
      expect(formatIso(inserted.createdAt)).toBe(formatIso(request.createdAt));
      expect(formatIso(inserted.updatedAt)).toBe(formatIso(request.updatedAt));
      expect(found.id).toBe(inserted.id);
      expect(inserted.nickname.pipe(isNone)).toBe(true);
      expect(updated.nickname.pipe(getOrUndefined)).toBe("round-seven");
      expect(formatIso(updated.updatedAt)).toBe(formatIso(update.updatedAt));
      expect(missing.pipe(isNone)).toBe(true);
    })
  );

  it.effect(
    "increments optimistically, rejects stale writes, and lets one concurrent writer win",
    fnUntraced(function* () {
      const organization = yield* createOrganization("SQLite Optimistic");
      const repository = yield* sqliteUserRepository;
      const request = yield* makeEffect(SqliteUser.insert)({
        organizationId: organization.id,
        name: "SQLite Snapshot",
        nickname: none(),
        status: "active",
      });
      const snapshot = yield* repository.insert(request);
      const first = yield* makeEffect(SqliteUser.update)({
        id: snapshot.id,
        rowVersion: snapshot.rowVersion,
        name: "SQLite First Writer",
      });
      const stale = yield* makeEffect(SqliteUser.update)({
        id: snapshot.id,
        rowVersion: snapshot.rowVersion,
        name: "SQLite Stale Writer",
      });
      const winner = yield* repository.update(first);
      const conflict = yield* flip(repository.update(stale));
      if (!is(VersionConflictError)(conflict)) {
        throw new Error("SQLite stale update did not return VersionConflictError");
      }

      const concurrentSeed = yield* repository.insert(
        yield* makeEffect(SqliteUser.insert)({
          organizationId: organization.id,
          name: "SQLite Concurrent Snapshot",
          nickname: none(),
          status: "active",
        })
      );
      const concurrentRequests = yield* forEach(["Concurrent A", "Concurrent B"], (name) =>
        makeEffect(SqliteUser.update)({
          id: concurrentSeed.id,
          rowVersion: concurrentSeed.rowVersion,
          name,
        })
      );
      const concurrentUpdates = yield* forEach(concurrentRequests, (current) => exit(repository.update(current)), {
        concurrency: "unbounded",
      });

      expect(snapshot.rowVersion).toBe(1);
      expect(winner.rowVersion).toBe(2);
      expect(conflict.expectedVersion).toBe(1);
      expect(concurrentUpdates.filter(isSuccess)).toHaveLength(1);
    })
  );

  it.effect(
    "round-trips valid enums and lets SQLite reject invalid domain values",
    fnUntraced(function* () {
      const organization = yield* createOrganization("SQLite Enum");
      const repository = yield* sqliteUserRepository;
      const valid = yield* repository.insert(
        yield* makeEffect(SqliteUser.insert)({
          organizationId: organization.id,
          name: "SQLite Enum User",
          nickname: none(),
          status: "draft",
        })
      );
      const sql = yield* SqlClient;
      const invalid = yield* flip(
        sql`
            update ${sql(SqliteUser.sql.tableName)}
            set ${sql("status")} = ${"outside-domain"}
            where ${sql("id")} = ${valid.id}
          `
      );
      expect(valid.status).toBe("draft");
      expect(invalid.pipe(isSqlError)).toBe(true);
    })
  );

  it.effect(
    "queries forward, reverse, and through relations through SQLite RQBv2",
    fnUntraced(function* () {
      const users = yield* sqliteUserRepository;
      const organization = yield* createOrganization("SQLite Relations");
      const direct = yield* users.insert(
        yield* makeEffect(SqliteUser.insert)({
          organizationId: organization.id,
          name: "SQLite Direct",
          nickname: none(),
          status: "active",
        })
      );
      const member = yield* users.insert(
        yield* makeEffect(SqliteUser.insert)({
          organizationId: organization.id,
          name: "SQLite Member",
          nickname: none(),
          status: "draft",
        })
      );
      const sql = yield* SqlClient;
      yield* sql`
          insert into shared_membership (organization_id, user_id, role)
          values (${organization.id}, ${member.id}, ${"member"})
        `;

      const { drizzleClient } = yield* SqliteHarness;
      const db = drizzle({ client: drizzleClient, relations: sqliteAssembly.relations });
      const usersUnknown = yield* tryPromise(() =>
        invokeFindMany(db.query.shared_user, {
          with: {
            organization: true,
            sharedOrganizationsThroughSharedMembership: true,
          },
        })
      );
      const organizationsUnknown = yield* tryPromise(() =>
        invokeFindMany(db.query.shared_organization, {
          with: {
            sharedUsers: true,
            sharedUsersThroughSharedMembership: true,
          },
        })
      );
      const userRows = yield* decodeUnknownEffect(UserRelationRows)(usersUnknown);
      const organizationRows = yield* decodeUnknownEffect(OrganizationRelationRows)(organizationsUnknown);
      const directRow = getOrThrow(findFirst(userRows, (row) => row.id === direct.id));
      const memberRow = getOrThrow(findFirst(userRows, (row) => row.id === member.id));
      const organizationRow = getOrThrow(findFirst(organizationRows, (row) => row.id === organization.id));

      expect(directRow.organization.id).toBe(organization.id);
      expect(memberRow.sharedOrganizationsThroughSharedMembership.map((row) => row.id)).toContain(organization.id);
      expect(organizationRow.sharedUsers.map((row) => row.id)).toContain(direct.id);
      expect(organizationRow.sharedUsersThroughSharedMembership.map((row) => row.id)).toContain(member.id);
    })
  );
});
