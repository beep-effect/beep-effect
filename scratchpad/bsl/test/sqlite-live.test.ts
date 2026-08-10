/** Real-file SQLite execution proofs for the round-seven dialect. */
import { Database } from "bun:sqlite";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { findFirst } from "effect/Array";
import { formatIso } from "effect/DateTime";
import {
  all,
  exit,
  flip,
  gen,
  option,
  promise,
  runPromise,
  sync,
  tryPromise,
} from "effect/Effect";
import { isSuccess } from "effect/Exit";
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
const databasePath = "/tmp/effect-drizzle-round7-live.sqlite";

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

const deleteDatabaseFiles = promise(() =>
  Promise.all(
    [databasePath, `${databasePath}-shm`, `${databasePath}-wal`].map((path) =>
      Bun.file(path).delete().catch(() => 0),
    ),
  ),
);

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
      yield* deleteDatabaseFiles;
      migrationOutput = yield* runPush;
      noOpOutput = yield* runPush;
      drizzleClient = new Database(databasePath);
      drizzleClient.run("PRAGMA foreign_keys = ON");
      live = some(yield* makeSqliteLiveTestSupport(databasePath));
    }),
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
      yield* deleteDatabaseFiles;
    }),
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
