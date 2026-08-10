/** Live PostgreSQL execution proofs for @beep/effect-drizzle round four. */
import { PgliteClient } from "@beep/pglite";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { pushSchema } from "drizzle-kit/api-postgres";
import { drizzle } from "drizzle-orm/pglite";
import { DateTime, Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as SchemaParser from "effect/SchemaParser";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as SqlError from "effect/unstable/sql/SqlError";
import * as SqlModel from "effect/unstable/sql/SqlModel";
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

const RelationId = S.Struct({ id: S.Finite }).annotate({
  identifier: "@beep/effect-drizzle/test/RelationId",
  description: "Minimal related-row shape asserted by the @beep/effect-drizzle live suite.",
});
const UserRelationRows = S.Array(
  S.Struct({
    id: S.Finite,
    org: RelationId,
    organizationsThroughMembership: S.Array(RelationId),
  }),
).annotate({
  identifier: "@beep/effect-drizzle/test/UserRelationRows",
  description: "User relation rows decoded from live RQBv2 queries.",
});
const OrganizationRelationRows = S.Array(
  S.Struct({
    id: S.Finite,
    parentOrg: S.NullOr(RelationId),
    childOrgs: S.Array(RelationId),
    users: S.Array(RelationId),
    usersThroughMembership: S.Array(RelationId),
  }),
).annotate({
  identifier: "@beep/effect-drizzle/test/OrganizationRelationRows",
  description: "Organization relation rows decoded from live RQBv2 queries.",
});

const invokeFindMany = (query: unknown, config: unknown): Promise<unknown> => {
  if (P.hasProperty(query, "findMany") && P.isFunction(query.findMany)) {
    return Reflect.apply(query.findMany, query, [config]);
  }
  return Promise.reject(new Error("RQBv2 findMany is unavailable"));
};

const drizzleExports: Record<string, unknown> = {
  ...effectDrizzleSchema.enums,
  ...effectDrizzleSchema.tables,
};

let live = O.none<LiveTestSupport>();
let migrationStatements: ReadonlyArray<string> = A.empty();
let noOpStatements: ReadonlyArray<string> = A.empty();

const support = (): LiveTestSupport =>
  O.getOrThrowWith(live, () => new Error("live PGlite support is not ready"));

const isVersionConflict = S.is(VersionConflictError);

const organizationRepository = SqlModel.makeRepository(Organization, {
  tableName: Organization.sql.tableName,
  spanPrefix: "Organization",
  idColumn: "id",
});

const arrayRecordRepository = SqlModel.makeRepository(ArrayRecord, {
  tableName: ArrayRecord.sql.tableName,
  spanPrefix: "ArrayRecord",
  idColumn: "id",
});

const createOrganization = Effect.fn("EffectDrizzleLiveTest.createOrganization")(function* (
  suffix: string,
) {
  const repository = yield* organizationRepository;
  const request = yield* SchemaParser.makeEffect(Organization.insert)({
    parentOrgId: null,
    slug: `round-four-${suffix}`,
    name: `Round Four ${suffix}`,
    code: `R4-${suffix}`,
  });
  return yield* repository.insert(request);
});

const setupLive = Effect.gen(function* () {
  const current = yield* makeLiveTestSupport;
  live = O.some(current);
  const result = yield* Effect.tryPromise(() =>
    current.run(
      Effect.gen(function* () {
        const client = yield* PgliteClient;
        if (!(client.pglite instanceof PGlite)) {
          throw new Error("PgliteTestLayer did not expose a concrete PGlite client");
        }
        const db = drizzle({ client: client.pglite });
        const migration = yield* Effect.tryPromise(() => pushSchema(drizzleExports, db));
        yield* Effect.tryPromise(() => migration.apply());
        const noOp = yield* Effect.tryPromise(() => pushSchema(drizzleExports, db));
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

beforeAll(() => Effect.runPromise(setupLive), 90_000);

afterAll(() =>
  O.match(live, {
    onNone: () => Promise.resolve(),
    onSome: (current) => current.close(),
  }),
);

describe.serial("@beep/effect-drizzle live PGlite gauntlet", () => {
  it("applies drizzle-kit DDL from the @beep/effect-drizzle projection and regenerates to no-op", () => {
    expect(A.isReadonlyArrayNonEmpty(migrationStatements)).toBe(true);
    expect(A.some(migrationStatements, Str.includes('CREATE TABLE "user"'))).toBe(true);
    expect(A.some(migrationStatements, Str.includes("record_status"))).toBe(true);
    expect(A.some(migrationStatements, Str.includes('"labels" text[]'))).toBe(true);
    expect(A.some(migrationStatements, Str.includes('"matrix" text[][]'))).toBe(true);
    expect(noOpStatements).toEqual([]);
  });

  it("round-trips one- and two-dimensional arrays through the model repository", () =>
    support().runRepository(
      Effect.gen(function* () {
        const repository = yield* arrayRecordRepository;
        const request = yield* SchemaParser.makeEffect(ArrayRecord.insert)({
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
      Effect.gen(function* () {
        const organization = yield* createOrganization("native");
        const repository = yield* userRepository;
        const insert = yield* SchemaParser.makeEffect(User.insert)({
          orgId: organization.id,
          email: "round-four-native@example.com",
          name: "Native Repository",
          bio: null,
          nickname: O.none(),
          settings: { theme: "dark" },
          active: true,
          status: "draft",
        });
        const inserted = yield* repository.insert(insert);
        const found = yield* repository.findById(inserted.id);
        const update = yield* SchemaParser.makeEffect(User.update)({
          id: inserted.id,
          rowVersion: inserted.rowVersion,
          name: "Native Repository Updated",
          nickname: O.some("round-four"),
        });
        const updated = yield* repository.update(update);
        yield* repository.delete(inserted.id);
        const missing = yield* Effect.option(repository.findById(inserted.id));
        expect(inserted.id).toBeGreaterThan(0);
        expect(DateTime.formatIso(inserted.createdAt)).toBe(DateTime.formatIso(insert.createdAt));
        expect(DateTime.formatIso(inserted.updatedAt)).toBe(DateTime.formatIso(insert.updatedAt));
        expect(found.id).toBe(inserted.id);
        expect(inserted.nickname.pipe(O.isNone)).toBe(true);
        expect(updated.id).toBe(inserted.id);
        expect(updated.name).toBe("Native Repository Updated");
        expect(updated.nickname.pipe(O.getOrUndefined)).toBe("round-four");
        expect(DateTime.formatIso(updated.updatedAt)).toBe(DateTime.formatIso(update.updatedAt));
        expect(missing.pipe(O.isNone)).toBe(true);
      }),
    ));

  it("increments versions and rejects stale concurrent writers", () =>
    support().runRepository(
      Effect.gen(function* () {
        const organization = yield* createOrganization("optimistic");
        const repository = yield* userOptimisticRepository;
        const insert = yield* SchemaParser.makeEffect(User.insert)({
          orgId: organization.id,
          email: "round-four-optimistic@example.com",
          name: "Optimistic Snapshot",
          bio: null,
          nickname: O.none(),
          settings: { theme: "light" },
          active: true,
          status: "active",
        });
        const snapshot = yield* repository.insert(insert);
        const firstRequest = yield* SchemaParser.makeEffect(User.update)({
          id: snapshot.id,
          rowVersion: snapshot.rowVersion,
          name: "First Writer",
        });
        const secondRequest = yield* SchemaParser.makeEffect(User.update)({
          id: snapshot.id,
          rowVersion: snapshot.rowVersion,
          name: "Second Writer",
        });
        const winner = yield* repository.update(firstRequest);
        const conflict = yield* Effect.flip(repository.update(secondRequest));
        const current = yield* repository.findById(snapshot.id);
        yield* repository.delete(snapshot.id);
        expect(snapshot.rowVersion).toBe(1);
        expect(winner.rowVersion).toBe(2);
        expect(winner.name).toBe("First Writer");
        expect(DateTime.formatIso(winner.updatedAt)).toBe(
          DateTime.formatIso(firstRequest.updatedAt),
        );
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
      Effect.gen(function* () {
        const organization = yield* createOrganization("enum");
        const repository = yield* userOptimisticRepository;
        const insert = yield* SchemaParser.makeEffect(User.insert)({
          orgId: organization.id,
          email: "round-four-enum@example.com",
          name: "Enum Proof",
          bio: null,
          nickname: O.none(),
          settings: { theme: "dark" },
          active: true,
          status: "draft",
        });
        const valid = yield* repository.insert(insert);
        const sql = yield* SqlClient.SqlClient;
        const invalid = yield* Effect.flip(
          sql`
            update ${sql(User.sql.tableName)}
            set ${sql("status")} = ${"not-a-record-status"}
            where ${sql("id")} = ${valid.id}
          `,
        );
        yield* repository.delete(valid.id);
        expect(valid.status).toBe("draft");
        expect(invalid.pipe(SqlError.isSqlError)).toBe(true);
      }),
    ));

  it("queries forward, reverse, self, and junction relations through RQBv2", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const seeded = yield* Effect.tryPromise(() =>
          support().runRepository(
            Effect.gen(function* () {
              const organizations = yield* organizationRepository;
              const users = yield* userOptimisticRepository;
              const rootRequest = yield* SchemaParser.makeEffect(Organization.insert)({
                parentOrgId: null,
                slug: "round-five-root",
                name: "Round Five Root",
                code: "R5-ROOT",
              });
              const root = yield* organizations.insert(rootRequest);
              const childRequest = yield* SchemaParser.makeEffect(Organization.insert)({
                parentOrgId: root.id,
                slug: "round-five-child",
                name: "Round Five Child",
                code: "R5-CHILD",
              });
              const child = yield* organizations.insert(childRequest);
              const directRequest = yield* SchemaParser.makeEffect(User.insert)({
                orgId: root.id,
                email: "round-five-direct@example.com",
                name: "Round Five Direct",
                bio: null,
                nickname: O.none(),
                settings: { theme: "direct" },
                active: true,
                status: "active",
              });
              const direct = yield* users.insert(directRequest);
              const memberRequest = yield* SchemaParser.makeEffect(User.insert)({
                orgId: child.id,
                email: "round-five-member@example.com",
                name: "Round Five Member",
                bio: null,
                nickname: O.none(),
                settings: { theme: "member" },
                active: true,
                status: "draft",
              });
              const member = yield* users.insert(memberRequest);
              const sql = yield* SqlClient.SqlClient;
              yield* sql`
                insert into membership (organization_id, user_id, role)
                values (${root.id}, ${member.id}, ${"member"})
              `;
              return { root, child, direct, member };
            }),
          ),
        );

        const queried = yield* Effect.tryPromise(() =>
          support().run(
            Effect.gen(function* () {
              const client = yield* PgliteClient;
              if (!(client.pglite instanceof PGlite)) {
                throw new Error("PgliteTestLayer did not expose a concrete PGlite client");
              }
              const db = drizzle({
                client: client.pglite,
                relations: effectDrizzleSchema.relations,
              });
              const usersUnknown = yield* Effect.tryPromise(() =>
                invokeFindMany(db.query.user, {
                  with: {
                    org: true,
                    organizationsThroughMembership: true,
                  },
                }),
              );
              const organizationsUnknown = yield* Effect.tryPromise(() =>
                invokeFindMany(db.query.organization, {
                  with: {
                    parentOrg: true,
                    childOrgs: true,
                    users: true,
                    usersThroughMembership: true,
                  },
                }),
              );
              const users = yield* S.decodeUnknownEffect(UserRelationRows)(usersUnknown);
              const organizations =
                yield* S.decodeUnknownEffect(OrganizationRelationRows)(organizationsUnknown);
              return { users, organizations };
            }),
          ),
        );

        const direct = O.getOrThrow(
          A.findFirst(queried.users, (row) => row.id === seeded.direct.id),
        );
        const member = O.getOrThrow(
          A.findFirst(queried.users, (row) => row.id === seeded.member.id),
        );
        const root = O.getOrThrow(
          A.findFirst(queried.organizations, (row) => row.id === seeded.root.id),
        );
        const child = O.getOrThrow(
          A.findFirst(queried.organizations, (row) => row.id === seeded.child.id),
        );
        expect(direct.org.id).toBe(seeded.root.id);
        expect(child.parentOrg?.id).toBe(seeded.root.id);
        expect(A.map(root.childOrgs, (row) => row.id)).toContain(seeded.child.id);
        expect(A.map(root.users, (row) => row.id)).toContain(seeded.direct.id);
        expect(A.map(root.usersThroughMembership, (row) => row.id)).toContain(seeded.member.id);
        expect(A.map(member.organizationsThroughMembership, (row) => row.id)).toContain(
          seeded.root.id,
        );
      }),
    ));
});
