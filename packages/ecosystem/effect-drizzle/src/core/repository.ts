/**
 * Derives Effect SQL repositories from model SQL metadata.
 *
 * Both constructors delegate ordinary CRUD to Effect SQL's `SqlModel`
 * repository. `makeRepository` owns the atomic compare-and-increment update
 * required by versioned models; `makeNativeRepository` keeps Effect SQL's
 * repository unchanged for models without a version field.
 *
 * @since 0.0.0
 */

import { findFirst, some as someArray } from "effect/Array";
import { catchTag, fail as failEffect, gen, withSpan } from "effect/Effect";
import { dual } from "effect/Function";
import { getOrElse, isSome, map } from "effect/Option";
import { isTagged } from "effect/Predicate";
import { filter, get, isEmptyReadonlyRecord, keys, toEntries } from "effect/Record";
import { Int, is, isSchema, NonEmptyString, TaggedError, Unknown } from "effect/Schema";
import { toEncoded } from "effect/SchemaAST";
import * as VariantSchema from "effect/schema/VariantSchema";
import { SqlClient } from "effect/sql/SqlClient";
import { makeRepository as makeSqlRepository } from "effect/sql/SqlModel";
import { findOne } from "effect/sql/SqlSchema";
import { camelCase, snakeCase } from "../internal/case.ts";
import { isUnknownRecord } from "../internal/guards.ts";
import { flattenEncoded } from "./classification.ts";
import * as Field from "./Field.ts";
import * as Meta from "./Meta.ts";
import { ModelInvariantError } from "./model.ts";
import type { Effect, Success } from "effect/Effect";
import type { Option } from "effect/Option";
import type { SchemaError } from "effect/Schema";
import type * as EffectModel from "effect/schema/Model";
import type { SqlError } from "effect/sql/SqlError";
import type { UnknownRecord } from "../internal/guards.ts";
import type { AnyModel } from "./model.ts";

/**
 * Reports an optimistic update whose id/version pair matched no current row.
 *
 * **When to use**
 *
 * Use to recover from concurrent writes at a repository boundary, usually by
 * reloading the entity or asking the caller to retry.
 *
 * **Details**
 *
 * Missing rows and stale rows intentionally share this error. A follow-up
 * read would add a round trip and could race with another writer.
 *
 * **Example** (Construct a version conflict)
 *
 * ```ts
 * import { VersionConflictError } from
 *   "@beep/effect-drizzle"
 *
 * const error = VersionConflictError.make({ table: "user", id: 1, expectedVersion: 2 })
 * error._tag // => "VersionConflictError"
 * error.expectedVersion // => 2
 * ```
 *
 * @see {@link makeRepository} for the operation that produces this error.
 * @category errors
 * @since 0.0.0
 */
export class VersionConflictError extends TaggedError<VersionConflictError, { readonly brand: unique symbol }>(
  "@beep/effect-drizzle/VersionConflictError"
)(
  "VersionConflictError",
  {
    table: NonEmptyString,
    id: Unknown.annotate({ toEquivalence: () => () => true }),
    expectedVersion: Int,
  },
  {
    description: "An optimistic repository update found no row with the expected version.",
  }
) {}

type RepositoryModel = EffectModel.Any & AnyModel;

type LocatorKey<M extends AnyModel> = {
  readonly [K in keyof M["sql"]["columns"] & keyof M["sql"]["fields"] & string]: null extends Field.EncodedOf<
    M["sql"]["fields"][K]
  >
    ? never
    : M["sql"]["columns"][K] extends {
          readonly version: true;
        }
      ? never
      : Meta.IsUniqueKey<M["sql"]["columns"][K]> extends true
        ? K
        : never;
}[keyof M["sql"]["columns"] & string];

type IdKey<M extends RepositoryModel> = keyof M["Type"] &
  keyof M["update"]["Type"] &
  keyof M["fields"] &
  LocatorKey<M> &
  string;

/**
 * Selects the field key marked as a model's optimistic version.
 *
 * **Details**
 *
 * The projection inspects resolved SQL metadata and returns `never` when the
 * model has no version field.
 *
 * **Example** (Infer a version key)
 *
 * ```ts
 * import { Int } from "effect/Schema"
 * import { Model, type VersionKey } from
 *   "@beep/effect-drizzle"
 * import { default as defaultValue, integer, version } from
 *   "@beep/effect-drizzle/pg"
 *
 * class User extends Model<User>("User")({
 *   revision: Int.pipe(integer(), defaultValue(1), version())
 * }) {}
 *
 * type Key = VersionKey<typeof User> // => "revision"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type VersionKey<M extends AnyModel> = {
  readonly [K in keyof M["sql"]["columns"] & string]: M["sql"]["columns"][K] extends {
    readonly version: true;
  }
    ? K
    : never;
}[keyof M["sql"]["columns"] & string];

type ValidateVersionModel<M extends AnyModel> = [VersionKey<M>] extends [never]
  ? Field.SqlTypeError<"optimistic repository requires one pg.version() field">
  : unknown;

type ValidateNativeModel<M extends AnyModel> = [VersionKey<M>] extends [never]
  ? unknown
  : Field.SqlTypeError<"native repositories reject version() models; use makeRepository">;

type ColumnNameKey<M extends AnyModel> = {
  readonly [K in keyof M["sql"]["columns"] & string]: M["sql"]["columns"][K] extends {
    readonly columnName: string;
  }
    ? K
    : never;
}[keyof M["sql"]["columns"] & string];

type ValidateColumnNames<M extends AnyModel> = [ColumnNameKey<M>] extends [never]
  ? unknown
  : Field.SqlTypeError<"optimistic repositories do not yet support columnName overrides">;

type ValidateLocator<M extends RepositoryModel, Id extends string> =
  Id extends IdKey<M>
    ? unknown
    : Field.SqlTypeError<"repository locator must be a non-null primary key, unique field, or single-column unique index">;

type SqlModelRepository<M extends RepositoryModel, Id extends IdKey<M>> = Success<
  ReturnType<typeof makeSqlRepository<M, Id>>
>;

/**
 * Exposes Effect SQL's native CRUD repository for a model without a version field.
 *
 * **When to use**
 *
 * Use as an application port for models whose updates may overwrite by id,
 * such as reference data or rows guarded by an outer lock.
 *
 * **Details**
 *
 * The surface is exactly `SqlModel.makeRepository`'s: `insert`, `insertVoid`,
 * `update`, `updateVoid`, `findById`, and `delete`.
 *
 * **Gotchas**
 *
 * `update` and `insert` turn a zero-row result into a defect rather than a
 * typed failure, and `updateVoid` and `delete` succeed when no row matches.
 *
 * **Example** (Name a native repository port)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Model, type NativeRepository } from
 *   "@beep/effect-drizzle"
 * import { identity, integer, primaryKey } from
 *   "@beep/effect-drizzle/pg"
 *
 * class Tag extends Model<Tag>("Tag")({
 *   id: S.Int.pipe(integer(), identity("always"), primaryKey()),
 *   displayName: S.String
 * }) {}
 *
 * type TagRepository = NativeRepository<typeof Tag, "id">
 * // => Effect SQL's CRUD port, including update and updateVoid
 * ```
 *
 * @see {@link makeNativeRepository} for deriving this port from model metadata.
 * @category repositories
 * @since 0.0.0
 */
export type NativeRepository<M extends RepositoryModel, Id extends IdKey<M>> = Pick<
  SqlModelRepository<M, Id>,
  "insert" | "insertVoid" | "update" | "updateVoid" | "findById" | "delete"
>;

/**
 * Exposes CRUD with an atomic compare-and-increment update operation.
 *
 * **When to use**
 *
 * Use as an application port when writes must reject stale versions without a
 * preceding read.
 *
 * **Details**
 *
 * Insert, lookup, and delete retain Effect SQL's native repository behavior.
 * Update locates by id and expected version, excludes both from `SET`, and
 * increments the stored version in the same statement.
 *
 * **Gotchas**
 *
 * The update payload must contain both the row id and current version even
 * though neither value is written verbatim. Missing rows and stale rows both
 * fail with {@link VersionConflictError}.
 *
 * **Example** (Name an optimistic repository port)
 *
 * ```ts
 * import { Int, String } from "effect/Schema"
 * import { Model, type Repository } from
 *   "@beep/effect-drizzle"
 * import { default as defaultValue, identity, integer, primaryKey, version } from
 *   "@beep/effect-drizzle/pg"
 *
 * class User extends Model<User>("User")({
 *   id: Int.pipe(integer(), identity("always"), primaryKey()),
 *   email: String,
 *   revision: Int.pipe(integer(), defaultValue(1), version())
 * }) {}
 *
 * type UserRepository = Repository<typeof User, "id">
 * // => CRUD port whose update can fail with VersionConflictError
 * ```
 *
 * @see {@link makeRepository} for deriving this port from model metadata.
 * @category repositories
 * @since 0.0.0
 */
export type Repository<M extends RepositoryModel, Id extends IdKey<M>> = Pick<
  SqlModelRepository<M, Id>,
  "insert" | "insertVoid" | "findById" | "delete"
> & {
  readonly update: (
    update: M["update"]["Type"]
  ) => Effect<
    M["Type"],
    SchemaError | SqlError | VersionConflictError,
    M["DecodingServices"] | M["update"]["EncodingServices"]
  >;
};

const versionColumnOf = (model: AnyModel): Option<string> =>
  map(
    findFirst(toEntries(model.sql.columns), ([, metadata]) => metadata.version),
    ([key]) => key
  );

const findVersionColumn = (model: AnyModel): string =>
  getOrElse(versionColumnOf(model), () => {
    throw ModelInvariantError.make({
      message: `Model '${model.sql.tableName}' has no optimistic-version field.`,
      fieldName: "(model)",
    });
  });

const rejectVersionedModel = (model: AnyModel): void => {
  const versionColumn = versionColumnOf(model);
  if (isSome(versionColumn)) {
    throw ModelInvariantError.make({
      message: `Native repository for '${model.sql.tableName}' would overwrite optimistic-version field '${versionColumn.value}'; use makeRepository.`,
      fieldName: versionColumn.value,
    });
  }
};

const requireRecord = (value: unknown, table: string): UnknownRecord => {
  if (isUnknownRecord(value)) return value;
  throw ModelInvariantError.make({
    message: `Repository request for '${table}' is not a string-keyed record.`,
    fieldName: "(request)",
  });
};

const requireValue = (record: UnknownRecord, key: string, table: string): unknown =>
  getOrElse(get(record, key), () => {
    throw ModelInvariantError.make({
      message: `Repository request for '${table}' is missing '${key}'.`,
      fieldName: key,
    });
  });

const requireVersion = (record: UnknownRecord, key: string, table: string): number => {
  const value = requireValue(record, key, table);
  if (is(Int)(value)) return value;
  throw ModelInvariantError.make({
    message: `Repository version '${key}' for '${table}' is not an integer.`,
    fieldName: key,
  });
};

const validateRepositoryModel = (model: AnyModel, idColumn: string): void => {
  const override = findFirst(toEntries(model.sql.columns), ([, metadata]) => metadata.columnName !== undefined);
  if (isSome(override)) {
    throw ModelInvariantError.make({
      message: `Repository for '${model.sql.tableName}' does not support columnName override on '${override.value[0]}'.`,
      fieldName: override.value[0],
    });
  }
  const lossyKey = findFirst(keys(model.sql.columns), (key) => camelCase(snakeCase(key)) !== key);
  if (isSome(lossyKey)) {
    const column = snakeCase(lossyKey.value);
    throw ModelInvariantError.make({
      message: `Repository for '${model.sql.tableName}' cannot address field '${lossyKey.value}': column '${column}' reads back as '${camelCase(column)}'.`,
      fieldName: lossyKey.value,
    });
  }
  const locator = getOrElse(get(model.sql.columns, idColumn), () => {
    throw ModelInvariantError.make({
      message: `Repository locator '${idColumn}' is not a model field.`,
      fieldName: idColumn,
    });
  });
  if (locator.version) {
    throw ModelInvariantError.make({
      message: `Repository locator '${idColumn}' cannot be the optimistic-version field.`,
      fieldName: idColumn,
    });
  }
  if (!Meta.isUniqueKey(locator)) {
    throw ModelInvariantError.make({
      message: `Repository locator '${idColumn}' must be a primary key, unique field, or single-column unique index.`,
      fieldName: idColumn,
    });
  }
  const locatorInput = getOrElse(get(model.sql.fields, idColumn), () => {
    throw ModelInvariantError.make({
      message: `Repository locator '${idColumn}' is not a model field.`,
      fieldName: idColumn,
    });
  });
  const locatorSchema = Field.from(locatorInput).schema;
  const select = VariantSchema.isField(locatorSchema) ? locatorSchema.schemas.select : locatorSchema;
  if (!isSchema(select) || someArray(flattenEncoded(toEncoded(select.ast), idColumn), isTagged("Null"))) {
    throw ModelInvariantError.make({
      message: `Repository locator '${idColumn}' must have a non-null encoded schema.`,
      fieldName: idColumn,
    });
  }
};

/**
 * Builds a repository whose version field is discovered from model metadata.
 *
 * **When to use**
 *
 * Use when a model has exactly one `version()` field and updates must be
 * optimistic rather than Effect SQL's native id-only update.
 *
 * **Details**
 *
 * Repository acquisition is an Effect requiring `SqlClient`. The generated
 * update performs one `UPDATE ... WHERE id = ... AND version = ... RETURNING`
 * statement and increments the version inside SQL. Both
 * `makeRepository(model, options)` and `makeRepository(options)(model)` retain
 * model-specific locator inference.
 * The update span keeps the static catalog name `EffectDrizzleRepository.updateOptimistic`; `spanPrefix`
 * becomes the bounded `repository.entity` attribute rather than a span-name segment.
 *
 * **Gotchas**
 *
 * The id field must remain in the model's update variant as a row locator, and
 * the version field is required in every update payload. A zero-row result
 * deliberately cannot distinguish a missing id from a stale version. Delete is
 * Effect SQL's native id-only delete: it ignores the version and succeeds when
 * no row matches.
 *
 * Effect SQL writes model keys as SQL identifiers and decodes `returning *`
 * rows by key, while derived columns are `snakeCase(key)`. The `SqlClient`
 * must set `transformQueryNames: snakeCase` and
 * `transformResultNames: camelCase`; otherwise every multi-word field misses
 * its column. Every field
 * key must survive `camelCase(snakeCase(key))` unchanged, so acronym keys such
 * as `userID` and snake_case keys throw {@link ModelInvariantError} at
 * construction. Set `transformJson: false` as well: otherwise PostgreSQL
 * clients also rewrite keys inside JSON values, and an update writes the
 * renamed keys back.
 *
 * Do not pass a `version()` model to `effect/sql/SqlModel` directly. Its
 * `update` matches by id only, so a stale write succeeds and silently
 * overwrites the newer row, writing the caller's old version back. Only a
 * missing row becomes a defect.
 *
 * **Example** (Run an optimistic repository)
 *
 * ```ts
 * import { makeLayer } from "@beep/pglite"
 * import { gen, provide, runPromise } from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { SqlClient } from "effect/sql/SqlClient"
 * import { camelCase, snakeCase } from "effect/String"
 * import { Model, makeRepository } from
 *   "@beep/effect-drizzle"
 * import { default as defaultValue, identity, integer, primaryKey, version } from
 *   "@beep/effect-drizzle/pg"
 *
 * class Account extends Model<Account>("Account")({
 *   id: S.Int.pipe(integer(), identity("always"), primaryKey()),
 *   email: S.String,
 *   revision: S.Int.pipe(integer(), defaultValue(1), version())
 * }) {}
 *
 * const program = gen(function*() {
 *   const sql = yield* SqlClient
 *   yield* sql`create table account (
 *     id integer generated always as identity primary key,
 *     email text not null,
 *     revision integer not null default 1
 *   )`
 *   const repository = yield* makeRepository(Account, {
 *     spanPrefix: "Account",
 *     idColumn: "id"
 *   })
 *   return yield* repository.insert({ email: "ada@example.com" })
 * })
 *
 * const RepositoryClientLayer = makeLayer({
 *   transformQueryNames: snakeCase,
 *   transformResultNames: camelCase,
 *   transformJson: false
 * })
 *
 * await runPromise(provide(program, RepositoryClientLayer))
 * // => Account { id: 1, email: "ada@example.com", revision: 1 }
 * ```
 *
 * @see {@link Repository} for the returned CRUD surface.
 * @see {@link VersionConflictError} for stale or missing update matches.
 * @category factories
 * @since 0.0.0
 */
export const makeRepository: {
  <const Id extends string>(options: {
    readonly spanPrefix: string;
    readonly idColumn: Id;
  }): <const M extends RepositoryModel>(
    model: M & ValidateVersionModel<M> & ValidateColumnNames<M> & ValidateLocator<M, Id>
  ) => Effect<Repository<M, Id & IdKey<M>>, never, SqlClient>;
  <const M extends RepositoryModel, const Id extends IdKey<M>>(options: {
    readonly spanPrefix: string;
    readonly idColumn: Id;
  }): (model: M & ValidateVersionModel<M> & ValidateColumnNames<M>) => Effect<Repository<M, Id>, never, SqlClient>;
  <const M extends RepositoryModel, const Id extends IdKey<M>>(
    model: M & ValidateVersionModel<M> & ValidateColumnNames<M>,
    options: {
      readonly spanPrefix: string;
      readonly idColumn: Id;
    }
  ): Effect<Repository<M, Id>, never, SqlClient>;
} = /* @__PURE__ */ dual(
  2,
  <const M extends RepositoryModel, const Id extends IdKey<M>>(
    model: M & ValidateVersionModel<M> & ValidateColumnNames<M>,
    options: {
      readonly spanPrefix: string;
      readonly idColumn: Id;
    }
  ): Effect<Repository<M, Id>, never, SqlClient> => {
    const idColumn: string = options.idColumn;
    validateRepositoryModel(model, idColumn);
    return gen(function* () {
      const sql = yield* SqlClient;
      const base = yield* makeSqlRepository<M, Id>(model, {
        tableName: model.sql.tableName,
        spanPrefix: options.spanPrefix,
        idColumn: options.idColumn,
      });
      const versionColumn = findVersionColumn(model);
      const updateSchema = findOne<M["update"], M, SqlError, never>({
        Request: model.update,
        Result: model,
        execute: (request) => {
          const record = requireRecord(request, model.sql.tableName);
          const id = requireValue(record, idColumn, model.sql.tableName);
          const expectedVersion = requireVersion(record, versionColumn, model.sql.tableName);
          const authorFields = filter(record, (_value, key) => key !== idColumn && key !== versionColumn);
          const versionSet = sql`${sql(versionColumn)} = ${expectedVersion} + 1`;
          const set = isEmptyReadonlyRecord(authorFields)
            ? versionSet
            : sql`${sql.update(authorFields)}, ${versionSet}`;
          return sql`
          update ${sql(model.sql.tableName)}
          set ${set}
          where ${sql(idColumn)} = ${id}
            and ${sql(versionColumn)} = ${expectedVersion}
          returning *
        `;
        },
      });
      const update = (request: M["update"]["Type"]) => {
        const record = requireRecord(request, model.sql.tableName);
        const id = requireValue(record, idColumn, model.sql.tableName);
        const expectedVersion = requireVersion(record, versionColumn, model.sql.tableName);
        return updateSchema(request).pipe(
          catchTag("NoSuchElementError", () =>
            failEffect(
              VersionConflictError.make({
                table: model.sql.tableName,
                id,
                expectedVersion,
              })
            )
          ),
          withSpan(
            "EffectDrizzleRepository.updateOptimistic",
            { attributes: { "repository.entity": options.spanPrefix, id, expectedVersion } },
            { captureStackTrace: false }
          )
        );
      };
      return {
        insert: base.insert,
        insertVoid: base.insertVoid,
        findById: base.findById,
        delete: base.delete,
        update,
      };
    });
  }
);

/**
 * Builds Effect SQL's native repository for a model without a version field.
 *
 * **When to use**
 *
 * Use for models that declare no `version()` field, where Effect SQL's id-only
 * update is acceptable. Versioned models must use {@link makeRepository}.
 *
 * **Details**
 *
 * Repository acquisition is an Effect requiring `SqlClient`. The table name
 * comes from the model's SQL metadata, and the locator receives the same
 * primary-key, uniqueness, and non-null checks as {@link makeRepository}.
 * Both `makeNativeRepository(model, options)` and
 * `makeNativeRepository(options)(model)` retain model-specific locator
 * inference.
 *
 * **Gotchas**
 *
 * The `SqlClient` must set `transformQueryNames: snakeCase` and
 * `transformResultNames: camelCase`, because Effect SQL addresses columns by
 * model key while derived columns are `snakeCase(key)`. Models with a
 * `version()` field or a `columnName` override fail at the call site and
 * throw {@link ModelInvariantError} at construction, as do field keys that do
 * not survive `camelCase(snakeCase(key))` unchanged.
 *
 * **Example** (Run a native repository)
 *
 * ```ts
 * import { makeLayer } from "@beep/pglite"
 * import { gen, provide, runPromise } from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { SqlClient } from "effect/sql/SqlClient"
 * import { camelCase, snakeCase } from "effect/String"
 * import { Model, makeNativeRepository } from
 *   "@beep/effect-drizzle"
 * import { identity, integer, primaryKey } from
 *   "@beep/effect-drizzle/pg"
 *
 * class Tag extends Model<Tag>("Tag")({
 *   id: S.Int.pipe(integer(), identity("always"), primaryKey()),
 *   displayName: S.String
 * }) {}
 *
 * const program = gen(function*() {
 *   const sql = yield* SqlClient
 *   yield* sql`create table tag (
 *     id integer generated always as identity primary key,
 *     display_name text not null
 *   )`
 *   const repository = yield* makeNativeRepository(Tag, {
 *     spanPrefix: "Tag",
 *     idColumn: "id"
 *   })
 *   return yield* repository.insert({ displayName: "urgent" })
 * })
 *
 * const NamedClientLayer = makeLayer({
 *   transformQueryNames: snakeCase,
 *   transformResultNames: camelCase,
 *   transformJson: false
 * })
 *
 * await runPromise(provide(program, NamedClientLayer))
 * // => Tag { id: 1, displayName: "urgent" }
 * ```
 *
 * @see {@link NativeRepository} for the returned CRUD surface.
 * @see {@link makeRepository} for models with an optimistic version field.
 * @category factories
 * @since 0.0.0
 */
export const makeNativeRepository: {
  <const Id extends string>(options: {
    readonly spanPrefix: string;
    readonly idColumn: Id;
  }): <const M extends RepositoryModel>(
    model: M & ValidateNativeModel<M> & ValidateColumnNames<M> & ValidateLocator<M, Id>
  ) => Effect<NativeRepository<M, Id & IdKey<M>>, never, SqlClient>;
  <const M extends RepositoryModel, const Id extends IdKey<M>>(options: {
    readonly spanPrefix: string;
    readonly idColumn: Id;
  }): (model: M & ValidateNativeModel<M> & ValidateColumnNames<M>) => Effect<NativeRepository<M, Id>, never, SqlClient>;
  <const M extends RepositoryModel, const Id extends IdKey<M>>(
    model: M & ValidateNativeModel<M> & ValidateColumnNames<M>,
    options: {
      readonly spanPrefix: string;
      readonly idColumn: Id;
    }
  ): Effect<NativeRepository<M, Id>, never, SqlClient>;
} = /* @__PURE__ */ dual(
  2,
  <const M extends RepositoryModel, const Id extends IdKey<M>>(
    model: M & ValidateNativeModel<M> & ValidateColumnNames<M>,
    options: {
      readonly spanPrefix: string;
      readonly idColumn: Id;
    }
  ): Effect<NativeRepository<M, Id>, never, SqlClient> => {
    rejectVersionedModel(model);
    validateRepositoryModel(model, options.idColumn);
    return makeSqlRepository<M, Id>(model, {
      tableName: model.sql.tableName,
      spanPrefix: options.spanPrefix,
      idColumn: options.idColumn,
    });
  }
);
