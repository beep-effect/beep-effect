/** Optimistic repositories derived from BSL model metadata. */
import { $ScratchpadId } from "@beep/identity";
import { TaggedErrorClass, UnknownRecord } from "@beep/schema";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { Model as EffectModel } from "effect/unstable/schema";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import type { SqlError } from "effect/unstable/sql/SqlError";
import * as SqlModel from "effect/unstable/sql/SqlModel";
import * as SqlSchema from "effect/unstable/sql/SqlSchema";
import type * as Field from "./Field.ts";
import { ModelInvariantError, type AnyModel } from "./factory.ts";

const $I = $ScratchpadId.create("bsl/repository");

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
export class VersionConflictError extends TaggedErrorClass<VersionConflictError>(
  $I`VersionConflictError`
)(
  "VersionConflictError",
  {
    table: S.NonEmptyString,
    id: S.Unknown,
    expectedVersion: S.Int,
  },
  $I.annote("VersionConflictError", {
    description:
      "An optimistic repository update found no row with the expected version.",
  })
) {}

type RepositoryModel = EffectModel.Any & AnyModel;

type IdKey<M extends EffectModel.Any> =
  & keyof M["Type"]
  & keyof M["update"]["Type"]
  & keyof M["fields"]
  & string;

/**
 * Field key marked as the model's optimistic version.
 *
 * @category models
 * @since 0.0.0
 */
export type VersionKey<M extends AnyModel> = {
  readonly [K in keyof M["bsl"]["columns"] & string]: M["bsl"]["columns"][K] extends {
    readonly version: true;
  }
    ? K
    : never;
}[keyof M["bsl"]["columns"] & string];

type ValidateVersionModel<M extends AnyModel> = [VersionKey<M>] extends [never]
  ? Field.BslTypeError<"optimistic repository requires one pg.version() field">
  : unknown;

type NativeRepository<
  M extends EffectModel.Any,
  Id extends IdKey<M>
> = Effect.Success<ReturnType<typeof SqlModel.makeRepository<M, Id>>>;

/**
 * CRUD repository whose update is an atomic compare-and-increment operation.
 *
 * @category models
 * @since 0.0.0
 */
export type Repository<
  M extends EffectModel.Any,
  Id extends IdKey<M>
> = Pick<NativeRepository<M, Id>, "insert" | "insertVoid" | "findById" | "delete"> & {
  readonly update: (
    update: M["update"]["Type"]
  ) => Effect.Effect<
    M["Type"],
    S.SchemaError | SqlError | VersionConflictError,
    M["DecodingServices"] | M["update"]["EncodingServices"]
  >;
};

const isUnknownRecord = S.is(UnknownRecord);

const findVersionColumn = (model: AnyModel): string =>
  O.getOrElse(
    O.map(
      A.findFirst(
        R.toEntries(model.bsl.columns),
        ([, metadata]) => metadata.version
      ),
      ([key]) => key
    ),
    () => {
      throw ModelInvariantError.make({
        message: `Model '${model.bsl.tableName}' has no optimistic-version field.`,
        fieldName: "(model)",
      });
    }
  );

const requireRecord = (value: unknown, table: string): UnknownRecord => {
  if (isUnknownRecord(value)) return value;
  throw ModelInvariantError.make({
    message: `Repository request for '${table}' is not a string-keyed record.`,
    fieldName: "(request)",
  });
};

const requireValue = (
  record: UnknownRecord,
  key: string,
  table: string
): unknown =>
  O.getOrElse(R.get(record, key), () => {
    throw ModelInvariantError.make({
      message: `Repository request for '${table}' is missing '${key}'.`,
      fieldName: key,
    });
  });

const requireVersion = (
  record: UnknownRecord,
  key: string,
  table: string
): number => {
  const value = requireValue(record, key, table);
  if (S.is(S.Int)(value)) return value;
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
export const makeRepository = <
  const M extends RepositoryModel,
  const Id extends IdKey<M>
>(
  model: M & ValidateVersionModel<M>,
  options: {
    readonly spanPrefix: string;
    readonly idColumn: Id;
  }
): Effect.Effect<Repository<M, Id>, never, SqlClient.SqlClient> =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const base = yield* SqlModel.makeRepository<M, Id>(model, {
      tableName: model.bsl.tableName,
      spanPrefix: options.spanPrefix,
      idColumn: options.idColumn,
    });
    const idColumn: string = options.idColumn;
    const versionColumn = findVersionColumn(model);
    const updateSchema = SqlSchema.findOne<
      M["update"],
      M,
      SqlError,
      never
    >({
      Request: model.update,
      Result: model,
      execute: (request) => {
        const record = requireRecord(request, model.bsl.tableName);
        const id = requireValue(record, idColumn, model.bsl.tableName);
        const expectedVersion = requireVersion(
          record,
          versionColumn,
          model.bsl.tableName
        );
        const authorFields = R.filter(
          record,
          (_value, key) =>
            !Eq.equals(key, idColumn) && !Eq.equals(key, versionColumn)
        );
        const versionSet = sql`${sql(versionColumn)} = ${expectedVersion} + 1`;
        const set = R.isEmptyReadonlyRecord(authorFields)
          ? versionSet
          : sql`${sql.update(authorFields)}, ${versionSet}`;
        return sql`
          update ${sql(model.bsl.tableName)}
          set ${set}
          where ${sql(idColumn)} = ${id}
            and ${sql(versionColumn)} = ${expectedVersion}
          returning *
        `;
      },
    });
    const update = (request: M["update"]["Type"]) => {
      const record = requireRecord(request, model.bsl.tableName);
      const id = requireValue(record, idColumn, model.bsl.tableName);
      const expectedVersion = requireVersion(
        record,
        versionColumn,
        model.bsl.tableName
      );
      return updateSchema(request).pipe(
        Effect.catchTag("NoSuchElementError", () =>
          Effect.fail(
            VersionConflictError.make({
              table: model.bsl.tableName,
              id,
              expectedVersion,
            })
          )
        ),
        Effect.withSpan(
          `${options.spanPrefix}.updateOptimistic`,
          { attributes: { id, expectedVersion } },
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
