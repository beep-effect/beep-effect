/**
 * Consumer-shaped type-performance fixture for the round-six descriptor migration.
 */

import { make } from "@beep/effect-drizzle";
import {
  Array as ArraySchema,
  Boolean as BooleanSchema,
  Finite,
  Int,
  Literals,
  NullOr,
  String as StringSchema,
  Struct as StructSchema,
} from "effect/Schema";
import { Model as EffectModel } from "effect/unstable/schema";
import type { Repository } from "@beep/effect-drizzle";

const kit = make({
  dialect: "pg",
  defaultColumns: (pg) => ({
    createdAt: EffectModel.DateTimeInsert.pipe(pg.timestamp()),
    updatedAt: EffectModel.DateTimeUpdate.pipe(pg.timestamp()),
    rowVersion: Int.pipe(pg.integer(), pg.default(1), pg.version()),
  }),
});

const { Entity, Model, pg, schema, toPgTable } = kit;

class PerfAccount extends Entity<PerfAccount>("PerfAccount")({
  id: Int.pipe(pg.integer(), pg.identity(), pg.primaryKey()),
  email: StringSchema.pipe(pg.varchar(320), pg.unique()),
  displayName: StringSchema.pipe(pg.varchar(120)),
  status: Literals(["active", "disabled", "invited"]).pipe(pg.enum("perf_account_status")),
  locale: StringSchema.pipe(pg.varchar(12), pg.default("en-US")),
  active: BooleanSchema,
  settings: StructSchema({ theme: StringSchema, compact: BooleanSchema }),
  tags: ArraySchema(StringSchema).pipe(pg.array(StringSchema.pipe(pg.text()))),
  loginCount: Int.pipe(pg.integer(), pg.default(0)),
  score: Finite.pipe(pg.real()),
}) {}

class PerfProject extends Entity<PerfProject>("PerfProject")({
  id: Int.pipe(pg.integer(), pg.identity()),
  ownerId: Int.pipe(pg.integer()),
  slug: StringSchema.pipe(pg.varchar(80), pg.unique()),
  name: StringSchema.pipe(pg.varchar(160)),
  description: NullOr(StringSchema),
  visibility: Literals(["private", "team", "public"]).pipe(pg.enum("perf_project_visibility")),
  archived: BooleanSchema.pipe(pg.default(false)),
  metadata: StructSchema({ source: StringSchema, revision: Int }),
  labels: ArraySchema(StringSchema).pipe(pg.array(StringSchema.pipe(pg.text()))),
}) {}

class PerfEvent extends Model<PerfEvent>("PerfEvent")({
  id: Int.pipe(pg.integer(), pg.identity()),
  accountId: Int.pipe(pg.integer()),
  projectId: Int.pipe(pg.integer()),
  kind: Literals(["created", "updated", "deleted"]).pipe(pg.enum("perf_event_kind")),
  payload: StructSchema({ path: StringSchema, sequence: Int }),
  occurredAt: StringSchema.pipe(pg.timestamp()),
  traceId: StringSchema.pipe(pg.uuid()),
  attempts: Int.pipe(pg.smallint(), pg.default(0)),
  processed: BooleanSchema.pipe(pg.default(false)),
}) {}

class PerfMembership extends Model<PerfMembership>("PerfMembership")(
  {
    accountId: Int.pipe(pg.integer()),
    projectId: Int.pipe(pg.integer()),
    role: Literals(["owner", "editor", "viewer"]).pipe(pg.enum("perf_membership_role")),
    invitedBy: NullOr(Int).pipe(pg.integer()),
    accepted: BooleanSchema.pipe(pg.default(false)),
  },
  (columns) => [kit.Table.compositePrimaryKey("perf_membership_pk", [columns.accountId, columns.projectId])]
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
