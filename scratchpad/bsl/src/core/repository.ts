/** Optimistic repositories derived from @beep/effect-drizzle model metadata. */
import { catchTag, fail as failEffect, gen, withSpan } from "effect/Effect";
import type { Effect, Success } from "effect/Effect";
import { findFirst } from "effect/Array";
import { getOrElse, map } from "effect/Option";
import { filter, get, isEmptyReadonlyRecord } from "effect/Record";
import { Int, NonEmptyString, TaggedError, Unknown, is } from "effect/Schema";
import type { SchemaError } from "effect/Schema";
import type { Model as EffectModel } from "effect/unstable/schema";
import { SqlClient } from "effect/unstable/sql/SqlClient";
import type { SqlError } from "effect/unstable/sql/SqlError";
import { makeRepository as makeSqlRepository } from "effect/unstable/sql/SqlModel";
import { findOne } from "effect/unstable/sql/SqlSchema";
import { isUnknownRecord, type UnknownRecord } from "../internal/guards.ts";
import type * as Field from "./Field.ts";
import { ModelInvariantError, type AnyModel } from "./model.ts";

/**
 * Error returned when an optimistic update matches no current row version.
 *
 * **Details**
 *
 * Missing rows and stale rows intentionally share this error. A follow-up
 * read would add a round trip and could race with another writer.
 *
 * **Example** (Construct a version conflict)
 *
 * ```ts
 * import { VersionConflictError } from "./repository.ts"
 *
 * const error = VersionConflictError.make({ table: "user", id: 1, expectedVersion: 2 })
 * console.log(error._tag) // "VersionConflictError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class VersionConflictError extends TaggedError<VersionConflictError>(
  "@beep/effect-drizzle/VersionConflictError",
)(
  "VersionConflictError",
  {
    table: NonEmptyString,
    id: Unknown,
    expectedVersion: Int,
  },
  {
    description: "An optimistic repository update found no row with the expected version.",
  },
) {}

type RepositoryModel = EffectModel.Any & AnyModel;

type IdKey<M extends EffectModel.Any> = keyof M["Type"] &
  keyof M["update"]["Type"] &
  keyof M["fields"] &
  string;

/**
 * Field key marked as the model's optimistic version.
 *
 * @category models
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

type NativeRepository<M extends EffectModel.Any, Id extends IdKey<M>> = Success<
  ReturnType<typeof makeSqlRepository<M, Id>>
>;

/**
 * CRUD repository whose update is an atomic compare-and-increment operation.
 *
 * @category models
 * @since 0.0.0
 */
export type Repository<M extends EffectModel.Any, Id extends IdKey<M>> = Pick<
  NativeRepository<M, Id>,
  "insert" | "insertVoid" | "findById" | "delete"
> & {
  readonly update: (
    update: M["update"]["Type"],
  ) => Effect<
    M["Type"],
    SchemaError | SqlError | VersionConflictError,
    M["DecodingServices"] | M["update"]["EncodingServices"]
  >;
};

const findVersionColumn = (model: AnyModel): string =>
  getOrElse(
    map(
      findFirst(Object.entries(model.sql.columns), ([, metadata]) => metadata.version),
      ([key]) => key,
    ),
    () => {
      throw ModelInvariantError.make({
        message: `Model '${model.sql.tableName}' has no optimistic-version field.`,
        fieldName: "(model)",
      });
    },
  );

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

/**
 * Build a repository whose version field is discovered from `pg.version()`.
 *
 * **Example** (Build an optimistic repository effect)
 *
 * ```ts
 * import { User } from "./fixtures.ts"
 * import { makeRepository } from "./repository.ts"
 *
 * const repository = makeRepository(User, { spanPrefix: "User", idColumn: "id" })
 * console.log(repository)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeRepository = <const M extends RepositoryModel, const Id extends IdKey<M>>(
  model: M & ValidateVersionModel<M>,
  options: {
    readonly spanPrefix: string;
    readonly idColumn: Id;
  },
): Effect<Repository<M, Id>, never, SqlClient> =>
  gen(function* () {
    const sql = yield* SqlClient;
    const base = yield* makeSqlRepository<M, Id>(model, {
      tableName: model.sql.tableName,
      spanPrefix: options.spanPrefix,
      idColumn: options.idColumn,
    });
    const idColumn: string = options.idColumn;
    const versionColumn = findVersionColumn(model);
    const updateSchema = findOne<M["update"], M, SqlError, never>({
      Request: model.update,
      Result: model,
      execute: (request) => {
        const record = requireRecord(request, model.sql.tableName);
        const id = requireValue(record, idColumn, model.sql.tableName);
        const expectedVersion = requireVersion(record, versionColumn, model.sql.tableName);
        const authorFields = filter(
          record,
          (_value, key) => key !== idColumn && key !== versionColumn,
        );
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
            }),
          ),
        ),
        withSpan(
          `${options.spanPrefix}.updateOptimistic`,
          { attributes: { id, expectedVersion } },
          { captureStackTrace: false },
        ),
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
