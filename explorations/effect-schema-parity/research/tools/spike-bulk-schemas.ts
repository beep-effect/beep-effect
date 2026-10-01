/**
 * Schemas for spike-bulk.ts, in their own module so the AOT Build smoke can load
 * this module's direct Schema exports (the entry module cannot import itself
 * while its top-level await is pending).
 */
import * as S from "effect/Schema";
import * as Model from "effect/schema/Model";

// ---------------------------------------------------------------------------
// Schemas (factory: every child builds fresh ASTs after its mode is set up)

export const makeSchemas = () => {
  const UserId = S.Int.pipe(S.brand("UserId"));
  const OrganizationId = S.Int.pipe(S.brand("OrganizationId"));
  const RecordStatus = S.Literals(["active", "archived", "suspended"]);
  const Settings = S.Struct({ theme: S.String });

  class UserRow extends Model.Class<UserRow>("UserRow")({
    id: Model.GeneratedByDb(UserId),
    orgId: OrganizationId,
    email: S.String.check(S.isMaxLength(320)),
    name: S.String,
    bio: S.NullOr(S.String),
    nickname: S.OptionFromNullOr(S.String),
    settings: Settings,
    active: S.Boolean,
    status: RecordStatus,
    searchName: Model.GeneratedByDb(S.String),
    createdAt: Model.DateTimeInsert,
    updatedAt: Model.DateTimeUpdate,
    rowVersion: S.Int.check(S.isGreaterThan(0)),
  }) {}

  // The select-variant fields, as SqlModel decodes a row.
  const selectFields = {
    id: UserId,
    orgId: OrganizationId,
    email: S.String.check(S.isMaxLength(320)),
    name: S.String,
    bio: S.NullOr(S.String),
    nickname: S.OptionFromNullOr(S.String),
    settings: Settings,
    active: S.Boolean,
    status: RecordStatus,
    searchName: S.String,
    createdAt: S.DateTimeUtcFromString,
    updatedAt: S.DateTimeUtcFromString,
    rowVersion: S.Int.check(S.isGreaterThan(0)),
  };

  class UserRowClass extends S.Class<UserRowClass>("UserRowClass")(selectFields) {}

  const wireFields = {
    ...selectFields,
    nickname: S.NullOr(S.String),
    createdAt: S.String,
    updatedAt: S.String,
  };

  return {
    "model-class": S.Array(UserRow),
    "schema-class": S.Array(UserRowClass),
    struct: S.Array(S.Struct(selectFields)),
    "struct-wire": S.Array(S.Struct(wireFields)),
  } as const;
};

export type CaseName = keyof ReturnType<typeof makeSchemas>;
export const CASES: ReadonlyArray<CaseName> = ["model-class", "schema-class", "struct", "struct-wire"];
export const MODES = ["interp", "jit-selective", "jit-global", "jit-late", "jit-blocked", "aot"] as const;

// Direct Schema export for the AOT Build smoke.
export const BuildSmokeRows = makeSchemas().struct;
