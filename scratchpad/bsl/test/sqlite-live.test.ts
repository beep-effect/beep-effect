/** Real-file SQLite execution proofs for the round-seven dialect. */
import { Database } from "bun:sqlite";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { numeric, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { findFirst } from "effect/Array";
import { formatIso } from "effect/DateTime";
import {
  all,
  exit,
  flip,
  gen,
  option,
  promise,
  provide,
  runPromise,
  sync,
  tryPromise,
} from "effect/Effect";
import { isSuccess } from "effect/Exit";
import { FileSystem } from "effect/FileSystem";
import {
  getOrThrow,
  getOrThrowWith,
  getOrUndefined,
  isNone,
  match,
  none,
  some,
} from "effect/Option";
import { hasProperty, isFunction } from "effect/Predicate";
import {
  Array as ArraySchema,
  Date as DateSchema,
  Finite,
  String as StringSchema,
  Struct as StructSchema,
  TaggedError,
  Unknown,
  decodeUnknownEffect,
  is,
} from "effect/Schema";
import { makeEffect } from "effect/SchemaParser";
import { SqlClient } from "effect/unstable/sql/SqlClient";
import { isSqlError } from "effect/unstable/sql/SqlError";
import { makeRepository as makeSqlRepository } from "effect/unstable/sql/SqlModel";
import { VersionConflictError } from "../src/index.ts";
import {
  sqliteAssembly,
  sqliteNativeUserRepository,
  sqliteUserRepository,
  SqliteOrganization,
  SqliteUser,
} from "./sqlite-fixtures.ts";
import {
  makeSqliteLiveTestSupport,
  type SqliteLiveTestSupport,
} from "./sqlite-live.test-support.ts";

const RelationId = StructSchema({ id: Finite.annotate({ identifier: "SqliteRelationId" }) });
const UserRelationRows = ArraySchema(
  StructSchema({
    id: Finite,
    organization: RelationId,
    sharedOrganizationsThroughSharedMembership: ArraySchema(RelationId),
  }),
);
const OrganizationRelationRows = ArraySchema(
  StructSchema({
    id: Finite,
    sharedUsers: ArraySchema(RelationId),
    sharedUsersThroughSharedMembership: ArraySchema(RelationId),
  }),
);

class SqliteHarnessError extends TaggedError<SqliteHarnessError>(
  "@beep/effect-drizzle/test/SqliteHarnessError",
)("SqliteHarnessError", { message: StringSchema, cause: Unknown }) {}

const invokeFindMany = (query: unknown, config: unknown): Promise<unknown> => {
  if (hasProperty(query, "findMany") && isFunction(query.findMany)) {
    return Reflect.apply(query.findMany, query, [config]);
  }
  return Promise.reject(new Error("SQLite RQBv2 findMany is unavailable"));
};

const repositoryRoot = new URL("../../../", import.meta.url).pathname;
const schemaPath = "scratchpad/bsl/test/sqlite-drizzle-schema.ts";
const preloadPath = new URL("./drizzle-kit-sqlite-rc-compat.cjs", import.meta.url).pathname;
let databaseDirectory = "";
let databasePath = "";

const runPush = tryPromise({
  try: (): Promise<string> => {
    const inheritedOptions = Bun.env.NODE_OPTIONS;
    const nodeOptions = inheritedOptions === undefined
      ? `--require=${preloadPath}`
      : `${inheritedOptions} --require=${preloadPath}`;
    const process = Bun.spawn(
      [
        "script",
        "-q",
        "-e",
        "/dev/null",
        "--",
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
        stdout: "pipe",
        stderr: "pipe",
      },
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
  catch: (cause) => SqliteHarnessError.make({
    message: "drizzle-kit SQLite push failed",
    cause,
  }),
});

const deleteDatabaseDirectory = gen(function* () {
  if (databaseDirectory.length === 0) return;
  const fileSystem = yield* FileSystem;
  yield* fileSystem.remove(databaseDirectory, { recursive: true, force: true });
});

let live = none<SqliteLiveTestSupport>();
let drizzleClient: Database | undefined;
let migrationOutput = "";
let noOpOutput = "";

const support = (): SqliteLiveTestSupport =>
  getOrThrowWith(live, () => new Error("live SQLite support is not ready"));

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

beforeAll(() =>
  runPromise(
    gen(function* () {
      const fileSystem = yield* FileSystem;
      databaseDirectory = yield* fileSystem.makeTempDirectory({ prefix: "effect-drizzle-live-" });
      databasePath = `${databaseDirectory}/live.sqlite`;
      migrationOutput = yield* runPush;
      noOpOutput = yield* runPush;
      drizzleClient = new Database(databasePath);
      drizzleClient.run("PRAGMA foreign_keys = ON");
      live = some(yield* makeSqliteLiveTestSupport(databasePath));
      // @effect-diagnostics-next-line strictEffectProvide:off
    }).pipe(provide(BunFileSystem.layer)),
  ),
  90_000,
);

afterAll(() =>
  runPromise(
    gen(function* () {
      yield* promise(() =>
        match(live, {
          onNone: () => Promise.resolve(),
          onSome: (current) => current.close(),
        }),
      );
      yield* sync(() => drizzleClient?.close());
      yield* deleteDatabaseDirectory;
      // @effect-diagnostics-next-line strictEffectProvide:off
    }).pipe(provide(BunFileSystem.layer)),
  ),
);

describe.serial("@beep/effect-drizzle live SQLite gauntlet", () => {
  it("applies projected DDL through drizzle-kit and regenerates to no-op", () => {
    expect(migrationOutput).toContain("`shared_user`");
    expect(migrationOutput).toContain("AUTOINCREMENT");
    expect(migrationOutput).toContain("shared_user_status_enum_check");
    expect(migrationOutput).toContain("Changes applied");
    expect(noOpOutput).toContain("No changes detected");
  });

  it("restricts NUMERIC modes to live representation-preserving carriers", () => {
    const client = new Database(":memory:");
    try {
      client.exec("create table numeric_affinity_probe (value numeric)");
      const insertAffinity = client.query("insert into numeric_affinity_probe values (?)");
      insertAffinity.run("3.0e+5");
      insertAffinity.run("001.2300");
      insertAffinity.run("0.12345678901234567890123456789");
      expect(
        client.query("select value, typeof(value) as storage from numeric_affinity_probe").all(),
      ).toEqual([
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
      client.exec("create table wave_e_numeric_number (value numeric not null)");
      client.exec("create table wave_e_numeric_bigint (value numeric not null)");
      const db = drizzle({ client });
      db.insert(numbers).values([{ value: -1.25 }, { value: 0 }, { value: 42.5 }]).run();
      db.insert(bigints)
        .values([{ value: -9_223_372_036_854_775_808n }, { value: 9_223_372_036_854_775_807n }])
        .run();
      expect(db.select().from(numbers).all()).toEqual([
        { value: -1.25 },
        { value: 0 },
        { value: 42.5 },
      ]);
      expect(db.select().from(bigints).all()).toEqual([
        { value: -9_223_372_036_854_775_808n },
        { value: 9_223_372_036_854_775_807n },
      ]);
      db.insert(bigints).values({ value: 9_223_372_036_854_775_808n }).run();
      expect(
        client
          .query("select typeof(value) as storage from wave_e_numeric_bigint where rowid = 3")
          .get(),
      ).toEqual({ storage: "real" });
      expect(() => db.select().from(bigints).all()).toThrow();
    } finally {
      client.close();
    }
  });

  it("probes bun:sqlite NaN binding before the SQLite REAL refinement", () => {
    const client = new Database(":memory:");
    try {
      client.exec("create table nan_binding_probe (value real)");
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
      client.exec("create table date_json_mode_probe (value text not null)");
      // @effect-diagnostics-next-line globalDate:off -- live probe for Drizzle's Date JSON behavior.
      const date = new Date("2026-08-10T00:00:00.000Z");
      const db = drizzle({ client });
      db.insert(table).values({ value: date }).run();
      const selected = db.select().from(table).get();
      expect(client.query("select value from date_json_mode_probe").get()).toEqual({
        value: "\"2026-08-10T00:00:00.000Z\"",
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
        client.exec(`
          create table wave_e_generated_volatile (
            value integer generated always as (random()) stored
          )
        `),
      ).toThrow();
      expect(() =>
        client.exec(`
          create table wave_e_default_column_reference (
            source integer,
            value integer default (source + 1)
          )
        `),
      ).toThrow();
      expect(() =>
        client.exec(`
          create table wave_e_check_subquery (
            value integer check (value > (select 0))
          )
        `),
      ).toThrow();
      client.exec("create table wave_e_partial_index (value integer)");
      expect(() =>
        client.exec(`
          create index wave_e_partial_index_volatile
          on wave_e_partial_index (value)
          where random() > 0.5
        `),
      ).toThrow();
    } finally {
      client.close();
    }
  });

  it("mirrors SQLite default, action, and cardinality boundaries", () => {
    const client = new Database(":memory:");
    try {
      expect(() => client.exec("create table wave_e_empty ()")).toThrow();
      expect(() =>
        client.exec(`
          create table wave_e_generated_only (
            value integer generated always as (1) stored
          )
        `),
      ).toThrow();
      expect(() =>
        client.exec(`
          create table wave_e_too_many_columns (
            ${Array.from({ length: 2_001 }, (_, index) => `c${index} integer`).join(", ")}
          )
        `),
      ).toThrow();
      expect(() =>
        client.exec("create table wave_e_invalid_default (value real default (-Infinity))"),
      ).toThrow();

      client.exec("pragma foreign_keys = on");
      client.exec(`
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

  it("runs native repository CRUD with db keys, timestamps, and Option NULL codecs", () =>
    support().run(
      gen(function* () {
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
      }),
    ));

  it("increments optimistically, rejects stale writes, and lets one concurrent writer win", () =>
    support().run(
      gen(function* () {
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
          }),
        );
        const concurrentRequests = yield* all(
          ["Concurrent A", "Concurrent B"].map((name) =>
            makeEffect(SqliteUser.update)({
              id: concurrentSeed.id,
              rowVersion: concurrentSeed.rowVersion,
              name,
            }),
          ),
        );
        const concurrentUpdates = yield* all(
          concurrentRequests.map((current) => exit(repository.update(current))),
          {
            concurrency: "unbounded",
          },
        );

        expect(snapshot.rowVersion).toBe(1);
        expect(winner.rowVersion).toBe(2);
        expect(conflict.expectedVersion).toBe(1);
        expect(concurrentUpdates.filter(isSuccess)).toHaveLength(1);
      }),
    ));

  it("round-trips valid enums and lets SQLite reject invalid domain values", () =>
    support().run(
      gen(function* () {
        const organization = yield* createOrganization("SQLite Enum");
        const repository = yield* sqliteUserRepository;
        const valid = yield* repository.insert(
          yield* makeEffect(SqliteUser.insert)({
            organizationId: organization.id,
            name: "SQLite Enum User",
            nickname: none(),
            status: "draft",
          }),
        );
        const sql = yield* SqlClient;
        const invalid = yield* flip(
          sql`
            update ${sql(SqliteUser.sql.tableName)}
            set ${sql("status")} = ${"outside-domain"}
            where ${sql("id")} = ${valid.id}
          `,
        );
        expect(valid.status).toBe("draft");
        expect(invalid.pipe(isSqlError)).toBe(true);
      }),
    ));

  it("queries forward, reverse, and through relations through SQLite RQBv2", () =>
    support().run(
      gen(function* () {
        const users = yield* sqliteUserRepository;
        const organization = yield* createOrganization("SQLite Relations");
        const direct = yield* users.insert(
          yield* makeEffect(SqliteUser.insert)({
            organizationId: organization.id,
            name: "SQLite Direct",
            nickname: none(),
            status: "active",
          }),
        );
        const member = yield* users.insert(
          yield* makeEffect(SqliteUser.insert)({
            organizationId: organization.id,
            name: "SQLite Member",
            nickname: none(),
            status: "draft",
          }),
        );
        const sql = yield* SqlClient;
        yield* sql`
          insert into shared_membership (organization_id, user_id, role)
          values (${organization.id}, ${member.id}, ${"member"})
        `;

        const client = drizzleClient;
        if (client === undefined) throw new Error("Drizzle SQLite client is not ready");
        const db = drizzle({ client, relations: sqliteAssembly.relations });
        const usersUnknown = yield* tryPromise(() =>
          invokeFindMany(db.query.shared_user, {
            with: {
              organization: true,
              sharedOrganizationsThroughSharedMembership: true,
            },
          }),
        );
        const organizationsUnknown = yield* tryPromise(() =>
          invokeFindMany(db.query.shared_organization, {
            with: {
              sharedUsers: true,
              sharedUsersThroughSharedMembership: true,
            },
          }),
        );
        const userRows = yield* decodeUnknownEffect(UserRelationRows)(usersUnknown);
        const organizationRows =
          yield* decodeUnknownEffect(OrganizationRelationRows)(organizationsUnknown);
        const directRow = getOrThrow(findFirst(userRows, (row) => row.id === direct.id));
        const memberRow = getOrThrow(findFirst(userRows, (row) => row.id === member.id));
        const organizationRow = getOrThrow(
          findFirst(organizationRows, (row) => row.id === organization.id),
        );

        expect(directRow.organization.id).toBe(organization.id);
        expect(memberRow.sharedOrganizationsThroughSharedMembership.map((row) => row.id)).toContain(
          organization.id,
        );
        expect(organizationRow.sharedUsers.map((row) => row.id)).toContain(direct.id);
        expect(organizationRow.sharedUsersThroughSharedMembership.map((row) => row.id)).toContain(
          member.id,
        );
      }),
    ));
});
