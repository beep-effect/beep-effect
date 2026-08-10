/**
 * Consumer-shaped type-performance fixture for the round-six descriptor migration.
 */
import * as S from "effect/Schema";
import { Model as EffectModel } from "effect/unstable/schema";
import { make, type Repository } from "../src/index.ts";

const kit = make({
  dialect: "pg",
  defaultColumns: (pg) => ({
    createdAt: EffectModel.DateTimeInsert.pipe(pg.timestamp()),
    updatedAt: EffectModel.DateTimeUpdate.pipe(pg.timestamp()),
    rowVersion: S.Int.pipe(pg.integer(), pg.default(1), pg.version()),
  }),
});

const { Entity, Model, pg, schema, toPgTable } = kit;

class PerfAccount extends Entity<PerfAccount>("PerfAccount")({
  id: S.Int.pipe(pg.integer(), pg.identity()),
  email: S.String.pipe(pg.varchar(320), pg.unique()),
  displayName: S.String.pipe(pg.varchar(120)),
  status: S.Literals(["active", "disabled", "invited"]).pipe(pg.enum("perf_account_status")),
  locale: S.String.pipe(pg.varchar(12), pg.default("en-US")),
  active: S.Boolean,
  settings: S.Struct({ theme: S.String, compact: S.Boolean }),
  tags: S.Array(S.String).pipe(pg.array(S.String.pipe(pg.text()))),
  loginCount: S.Int.pipe(pg.integer(), pg.default(0)),
  score: S.Finite.pipe(pg.real()),
}) {}

class PerfProject extends Entity<PerfProject>("PerfProject")({
  id: S.Int.pipe(pg.integer(), pg.identity()),
  ownerId: S.Int.pipe(pg.integer()),
  slug: S.String.pipe(pg.varchar(80), pg.unique()),
  name: S.String.pipe(pg.varchar(160)),
  description: S.NullOr(S.String),
  visibility: S.Literals(["private", "team", "public"]).pipe(pg.enum("perf_project_visibility")),
  archived: S.Boolean.pipe(pg.default(false)),
  metadata: S.Struct({ source: S.String, revision: S.Int }),
  labels: S.Array(S.String).pipe(pg.array(S.String.pipe(pg.text()))),
}) {}

class PerfEvent extends Model<PerfEvent>("PerfEvent")({
  id: S.Int.pipe(pg.integer(), pg.identity()),
  accountId: S.Int.pipe(pg.integer()),
  projectId: S.Int.pipe(pg.integer()),
  kind: S.Literals(["created", "updated", "deleted"]).pipe(pg.enum("perf_event_kind")),
  payload: S.Struct({ path: S.String, sequence: S.Int }),
  occurredAt: S.String.pipe(pg.timestamp()),
  traceId: S.String.pipe(pg.uuid()),
  attempts: S.Int.pipe(pg.smallint(), pg.default(0)),
  processed: S.Boolean.pipe(pg.default(false)),
}) {}

class PerfMembership extends Model<PerfMembership>("PerfMembership")(
  {
    accountId: S.Int.pipe(pg.integer()),
    projectId: S.Int.pipe(pg.integer()),
    role: S.Literals(["owner", "editor", "viewer"]).pipe(pg.enum("perf_membership_role")),
    invitedBy: S.NullOr(S.Int).pipe(pg.integer()),
    accepted: S.Boolean.pipe(pg.default(false)),
  },
  (columns) => [
    kit.Table.compositePrimaryKey("perf_membership_pk", [columns.accountId, columns.projectId]),
  ],
) {}

export const perfAssembly = schema({
  perf_account: PerfAccount,
  perf_project: PerfProject,
  perf_event: PerfEvent,
  perf_membership: PerfMembership,
});

export const perfAccountTable = toPgTable(PerfAccount);
export type PerfAccountRepository = Repository<typeof PerfAccount, "id">;
export type PerfAccountInsert = typeof PerfAccount.insert.Type;
export type PerfAccountUpdate = typeof PerfAccount.update.Type;
export type PerfProjectInsert = typeof PerfProject.insert.Type;
export type PerfEventSelect = PerfEvent;
