/** Live PostgreSQL execution proofs for BSL round four. */
import { PgliteClient } from "@beep/pglite";
import { Str } from "@beep/utils";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { pushSchema } from "drizzle-kit/api-postgres";
import { drizzle } from "drizzle-orm/pglite";
import { DateTime, Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SchemaParser from "effect/SchemaParser";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as SqlError from "effect/unstable/sql/SqlError";
import * as SqlModel from "effect/unstable/sql/SqlModel";
import {
  bslSchema,
  Organization,
  User,
  userOptimisticRepository,
  userRepository,
} from "./fixtures.ts";
import {
  makeLiveTestSupport,
  type LiveTestSupport,
} from "./live.test-support.ts";
import { VersionConflictError } from "./repository.ts";

const drizzleExports: Record<string, unknown> = {
  ...bslSchema.enums,
  ...bslSchema.tables,
};

let live = O.none<LiveTestSupport>();
let migrationStatements: ReadonlyArray<string> = A.empty();
let noOpStatements: ReadonlyArray<string> = A.empty();

const support = (): LiveTestSupport =>
  O.getOrThrowWith(live, () => new Error("live PGlite support is not ready"));

const isVersionConflict = S.is(VersionConflictError);

const organizationRepository = SqlModel.makeRepository(Organization, {
  tableName: Organization.bsl.tableName,
  spanPrefix: "Organization",
  idColumn: "id",
});

const createOrganization = Effect.fn("BslLiveTest.createOrganization")(
  function* (suffix: string) {
    const repository = yield* organizationRepository;
    const request = yield* SchemaParser.makeEffect(Organization.insert)({
      parentOrgId: null,
      slug: `round-four-${suffix}`,
      name: `Round Four ${suffix}`,
      code: `R4-${suffix}`,
    });
    return yield* repository.insert(request);
  }
);

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
        const migration = yield* Effect.tryPromise(() =>
          pushSchema(drizzleExports, db)
        );
        yield* Effect.tryPromise(() => migration.apply());
        const noOp = yield* Effect.tryPromise(() =>
          pushSchema(drizzleExports, db)
        );
        return {
          migrationStatements: migration.sqlStatements,
          noOpStatements: noOp.sqlStatements,
        };
      })
    )
  );
  migrationStatements = result.migrationStatements;
  noOpStatements = result.noOpStatements;
});

beforeAll(() => Effect.runPromise(setupLive), 90_000);

afterAll(() =>
  O.match(live, {
    onNone: () => Promise.resolve(),
    onSome: (current) => current.close(),
  })
);

describe.serial("BSL live PGlite gauntlet", () => {
  it("applies drizzle-kit DDL from the BSL projection and regenerates to no-op", () => {
    expect(A.isReadonlyArrayNonEmpty(migrationStatements)).toBe(true);
    expect(
      A.some(migrationStatements, Str.includes('CREATE TABLE "user"'))
    ).toBe(true);
    expect(
      A.some(migrationStatements, Str.includes("record_status"))
    ).toBe(true);
    expect(noOpStatements).toEqual([]);
  });

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
        expect(DateTime.formatIso(inserted.createdAt)).toBe(
          DateTime.formatIso(insert.createdAt)
        );
        expect(DateTime.formatIso(inserted.updatedAt)).toBe(
          DateTime.formatIso(insert.updatedAt)
        );
        expect(found.id).toBe(inserted.id);
        expect(inserted.nickname.pipe(O.isNone)).toBe(true);
        expect(updated.id).toBe(inserted.id);
        expect(updated.name).toBe("Native Repository Updated");
        expect(updated.nickname.pipe(O.getOrUndefined)).toBe("round-four");
        expect(DateTime.formatIso(updated.updatedAt)).toBe(
          DateTime.formatIso(update.updatedAt)
        );
        expect(missing.pipe(O.isNone)).toBe(true);
      })
    )
  );

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
          DateTime.formatIso(firstRequest.updatedAt)
        );
        expect(current.rowVersion).toBe(2);
        expect(current.name).toBe("First Writer");
        if (!isVersionConflict(conflict)) {
          throw new Error("stale update did not return VersionConflictError");
        }
        expect(conflict.table).toBe("user");
        expect(conflict.id).toBe(snapshot.id);
        expect(conflict.expectedVersion).toBe(1);
      })
    )
  );

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
            update ${sql(User.bsl.tableName)}
            set ${sql("status")} = ${"not-a-record-status"}
            where ${sql("id")} = ${valid.id}
          `
        );
        yield* repository.delete(valid.id);
        expect(valid.status).toBe("draft");
        expect(invalid.pipe(SqlError.isSqlError)).toBe(true);
      })
    )
  );
});
