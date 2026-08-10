/** Live PostgreSQL execution proofs for @beep/effect-drizzle round four. */
import { PgliteClient } from "@beep/pglite";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { pushSchema } from "drizzle-kit/api-postgres";
import { drizzle } from "drizzle-orm/pglite";
import { formatIso } from "effect/DateTime";
import { flip, fn, gen, option, runPromise, tryPromise } from "effect/Effect";
import { findFirst, isReadonlyArrayNonEmpty } from "effect/Array";
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
  NullOr,
  Struct as StructSchema,
  decodeUnknownEffect,
  is,
} from "effect/Schema";
import { makeEffect } from "effect/SchemaParser";
import { SqlClient } from "effect/unstable/sql/SqlClient";
import { isSqlError } from "effect/unstable/sql/SqlError";
import { makeRepository as makeSqlRepository } from "effect/unstable/sql/SqlModel";
import {
  effectDrizzleSchema,
  ArrayRecord,
  Organization,
  User,
  userOptimisticRepository,
  userRepository,
} from "./fixtures.ts";
import { makeLiveTestSupport, type LiveTestSupport } from "./live.test-support.ts";
import { VersionConflictError } from "../src/index.ts";

const RelationId = StructSchema({ id: Finite }).annotate({
  identifier: "@beep/effect-drizzle/test/RelationId",
  description: "Minimal related-row shape asserted by the @beep/effect-drizzle live suite.",
});
const UserRelationRows = ArraySchema(
  StructSchema({
    id: Finite,
    org: RelationId,
    organizationsThroughMembership: ArraySchema(RelationId),
  }),
).annotate({
  identifier: "@beep/effect-drizzle/test/UserRelationRows",
  description: "User relation rows decoded from live RQBv2 queries.",
});
const OrganizationRelationRows = ArraySchema(
  StructSchema({
    id: Finite,
    parentOrg: NullOr(RelationId),
    childOrgs: ArraySchema(RelationId),
    users: ArraySchema(RelationId),
    usersThroughMembership: ArraySchema(RelationId),
  }),
).annotate({
  identifier: "@beep/effect-drizzle/test/OrganizationRelationRows",
  description: "Organization relation rows decoded from live RQBv2 queries.",
});

const invokeFindMany = (query: unknown, config: unknown): Promise<unknown> => {
  if (hasProperty(query, "findMany") && isFunction(query.findMany)) {
    return Reflect.apply(query.findMany, query, [config]);
  }
  return Promise.reject(new Error("RQBv2 findMany is unavailable"));
};

const drizzleExports: Record<string, unknown> = {
  ...effectDrizzleSchema.enums,
  ...effectDrizzleSchema.tables,
};

let live = none<LiveTestSupport>();
let migrationStatements: ReadonlyArray<string> = [];
let noOpStatements: ReadonlyArray<string> = [];

const support = (): LiveTestSupport =>
  getOrThrowWith(live, () => new Error("live PGlite support is not ready"));

const isVersionConflict = is(VersionConflictError);

const organizationRepository = makeSqlRepository(Organization, {
  tableName: Organization.sql.tableName,
  spanPrefix: "Organization",
  idColumn: "id",
});

const arrayRecordRepository = makeSqlRepository(ArrayRecord, {
  tableName: ArrayRecord.sql.tableName,
  spanPrefix: "ArrayRecord",
  idColumn: "id",
});

const createOrganization = fn("EffectDrizzleLiveTest.createOrganization")(function* (
  suffix: string,
) {
  const repository = yield* organizationRepository;
  const request = yield* makeEffect(Organization.insert)({
    parentOrgId: null,
    slug: `round-four-${suffix}`,
    name: `Round Four ${suffix}`,
    code: `R4-${suffix}`,
  });
  return yield* repository.insert(request);
});

const setupLive = gen(function* () {
  const current = yield* makeLiveTestSupport;
  live = some(current);
  const result = yield* tryPromise(() =>
    current.run(
      gen(function* () {
        const client = yield* PgliteClient;
        if (!(client.pglite instanceof PGlite)) {
          throw new Error("PgliteTestLayer did not expose a concrete PGlite client");
        }
        const db = drizzle({ client: client.pglite });
        const migration = yield* tryPromise(() => pushSchema(drizzleExports, db));
        yield* tryPromise(() => migration.apply());
        const noOp = yield* tryPromise(() => pushSchema(drizzleExports, db));
        return {
          migrationStatements: migration.sqlStatements,
          noOpStatements: noOp.sqlStatements,
        };
      }),
    ),
  );
  migrationStatements = result.migrationStatements;
  noOpStatements = result.noOpStatements;
});

beforeAll(() => runPromise(setupLive), 90_000);

afterAll(() =>
  match(live, {
    onNone: () => Promise.resolve(),
    onSome: (current) => current.close(),
  }),
);

describe.serial("@beep/effect-drizzle live PGlite gauntlet", () => {
  it("applies drizzle-kit DDL from the @beep/effect-drizzle projection and regenerates to no-op", () => {
    expect(isReadonlyArrayNonEmpty(migrationStatements)).toBe(true);
    expect(migrationStatements.some((statement) => statement.includes('CREATE TABLE "user"'))).toBe(
      true,
    );
    expect(migrationStatements.some((statement) => statement.includes("record_status"))).toBe(true);
    expect(migrationStatements.some((statement) => statement.includes('"labels" text[]'))).toBe(
      true,
    );
    expect(migrationStatements.some((statement) => statement.includes('"matrix" text[][]'))).toBe(
      true,
    );
    expect(noOpStatements).toEqual([]);
  });

  it("round-trips one- and two-dimensional arrays through the model repository", () =>
    support().runRepository(
      gen(function* () {
        const repository = yield* arrayRecordRepository;
        const request = yield* makeEffect(ArrayRecord.insert)({
          labels: ["round-five", "array"],
          matrix: [
            ["a", "b"],
            ["c", "d"],
          ],
        });
        const inserted = yield* repository.insert(request);
        const selected = yield* repository.findById(inserted.id);
        yield* repository.delete(inserted.id);
        expect(selected.labels).toEqual(["round-five", "array"]);
        expect(selected.matrix).toEqual([
          ["a", "b"],
          ["c", "d"],
        ]);
      }),
    ));

  it("executes the installed SqlModel repository and Option codec", () =>
    support().runRepository(
      gen(function* () {
        const organization = yield* createOrganization("native");
        const repository = yield* userRepository;
        const insert = yield* makeEffect(User.insert)({
          orgId: organization.id,
          email: "round-four-native@example.com",
          name: "Native Repository",
          bio: null,
          nickname: none(),
          settings: { theme: "dark" },
          active: true,
          status: "draft",
        });
        const inserted = yield* repository.insert(insert);
        const found = yield* repository.findById(inserted.id);
        const update = yield* makeEffect(User.update)({
          id: inserted.id,
          rowVersion: inserted.rowVersion,
          name: "Native Repository Updated",
          nickname: some("round-four"),
        });
        const updated = yield* repository.update(update);
        yield* repository.delete(inserted.id);
        const missing = yield* option(repository.findById(inserted.id));
        expect(inserted.id).toBeGreaterThan(0);
        expect(formatIso(inserted.createdAt)).toBe(formatIso(insert.createdAt));
        expect(formatIso(inserted.updatedAt)).toBe(formatIso(insert.updatedAt));
        expect(found.id).toBe(inserted.id);
        expect(inserted.nickname.pipe(isNone)).toBe(true);
        expect(updated.id).toBe(inserted.id);
        expect(updated.name).toBe("Native Repository Updated");
        expect(updated.nickname.pipe(getOrUndefined)).toBe("round-four");
        expect(formatIso(updated.updatedAt)).toBe(formatIso(update.updatedAt));
        expect(missing.pipe(isNone)).toBe(true);
      }),
    ));

  it("increments versions and rejects stale concurrent writers", () =>
    support().runRepository(
      gen(function* () {
        const organization = yield* createOrganization("optimistic");
        const repository = yield* userOptimisticRepository;
        const insert = yield* makeEffect(User.insert)({
          orgId: organization.id,
          email: "round-four-optimistic@example.com",
          name: "Optimistic Snapshot",
          bio: null,
          nickname: none(),
          settings: { theme: "light" },
          active: true,
          status: "active",
        });
        const snapshot = yield* repository.insert(insert);
        const firstRequest = yield* makeEffect(User.update)({
          id: snapshot.id,
          rowVersion: snapshot.rowVersion,
          name: "First Writer",
        });
        const secondRequest = yield* makeEffect(User.update)({
          id: snapshot.id,
          rowVersion: snapshot.rowVersion,
          name: "Second Writer",
        });
        const winner = yield* repository.update(firstRequest);
        const conflict = yield* flip(repository.update(secondRequest));
        const current = yield* repository.findById(snapshot.id);
        yield* repository.delete(snapshot.id);
        expect(snapshot.rowVersion).toBe(1);
        expect(winner.rowVersion).toBe(2);
        expect(winner.name).toBe("First Writer");
        expect(formatIso(winner.updatedAt)).toBe(formatIso(firstRequest.updatedAt));
        expect(current.rowVersion).toBe(2);
        expect(current.name).toBe("First Writer");
        if (!isVersionConflict(conflict)) {
          throw new Error("stale update did not return VersionConflictError");
        }
        expect(conflict.table).toBe("user");
        expect(conflict.id).toBe(snapshot.id);
        expect(conflict.expectedVersion).toBe(1);
      }),
    ));

  it("round-trips valid enums and surfaces invalid values as SqlError", () =>
    support().runRepository(
      gen(function* () {
        const organization = yield* createOrganization("enum");
        const repository = yield* userOptimisticRepository;
        const insert = yield* makeEffect(User.insert)({
          orgId: organization.id,
          email: "round-four-enum@example.com",
          name: "Enum Proof",
          bio: null,
          nickname: none(),
          settings: { theme: "dark" },
          active: true,
          status: "draft",
        });
        const valid = yield* repository.insert(insert);
        const sql = yield* SqlClient;
        const invalid = yield* flip(
          sql`
            update ${sql(User.sql.tableName)}
            set ${sql("status")} = ${"not-a-record-status"}
            where ${sql("id")} = ${valid.id}
          `,
        );
        yield* repository.delete(valid.id);
        expect(valid.status).toBe("draft");
        expect(invalid.pipe(isSqlError)).toBe(true);
      }),
    ));

  it("queries forward, reverse, self, and junction relations through RQBv2", () =>
    runPromise(
      gen(function* () {
        const seeded = yield* tryPromise(() =>
          support().runRepository(
            gen(function* () {
              const organizations = yield* organizationRepository;
              const users = yield* userOptimisticRepository;
              const rootRequest = yield* makeEffect(Organization.insert)({
                parentOrgId: null,
                slug: "round-five-root",
                name: "Round Five Root",
                code: "R5-ROOT",
              });
              const root = yield* organizations.insert(rootRequest);
              const childRequest = yield* makeEffect(Organization.insert)({
                parentOrgId: root.id,
                slug: "round-five-child",
                name: "Round Five Child",
                code: "R5-CHILD",
              });
              const child = yield* organizations.insert(childRequest);
              const directRequest = yield* makeEffect(User.insert)({
                orgId: root.id,
                email: "round-five-direct@example.com",
                name: "Round Five Direct",
                bio: null,
                nickname: none(),
                settings: { theme: "direct" },
                active: true,
                status: "active",
              });
              const direct = yield* users.insert(directRequest);
              const memberRequest = yield* makeEffect(User.insert)({
                orgId: child.id,
                email: "round-five-member@example.com",
                name: "Round Five Member",
                bio: null,
                nickname: none(),
                settings: { theme: "member" },
                active: true,
                status: "draft",
              });
              const member = yield* users.insert(memberRequest);
              const sql = yield* SqlClient;
              yield* sql`
                insert into membership (organization_id, user_id, role)
                values (${root.id}, ${member.id}, ${"member"})
              `;
              return { root, child, direct, member };
            }),
          ),
        );

        const queried = yield* tryPromise(() =>
          support().run(
            gen(function* () {
              const client = yield* PgliteClient;
              if (!(client.pglite instanceof PGlite)) {
                throw new Error("PgliteTestLayer did not expose a concrete PGlite client");
              }
              const db = drizzle({
                client: client.pglite,
                relations: effectDrizzleSchema.relations,
              });
              const usersUnknown = yield* tryPromise(() =>
                invokeFindMany(db.query.user, {
                  with: {
                    org: true,
                    organizationsThroughMembership: true,
                  },
                }),
              );
              const organizationsUnknown = yield* tryPromise(() =>
                invokeFindMany(db.query.organization, {
                  with: {
                    parentOrg: true,
                    childOrgs: true,
                    users: true,
                    usersThroughMembership: true,
                  },
                }),
              );
              const users = yield* decodeUnknownEffect(UserRelationRows)(usersUnknown);
              const organizations =
                yield* decodeUnknownEffect(OrganizationRelationRows)(organizationsUnknown);
              return { users, organizations };
            }),
          ),
        );

        const direct = getOrThrow(findFirst(queried.users, (row) => row.id === seeded.direct.id));
        const member = getOrThrow(findFirst(queried.users, (row) => row.id === seeded.member.id));
        const root = getOrThrow(
          findFirst(queried.organizations, (row) => row.id === seeded.root.id),
        );
        const child = getOrThrow(
          findFirst(queried.organizations, (row) => row.id === seeded.child.id),
        );
        expect(direct.org.id).toBe(seeded.root.id);
        expect(child.parentOrg?.id).toBe(seeded.root.id);
        expect(root.childOrgs.map((row) => row.id)).toContain(seeded.child.id);
        expect(root.users.map((row) => row.id)).toContain(seeded.direct.id);
        expect(root.usersThroughMembership.map((row) => row.id)).toContain(seeded.member.id);
        expect(member.organizationsThroughMembership.map((row) => row.id)).toContain(
          seeded.root.id,
        );
      }),
    ));
});
