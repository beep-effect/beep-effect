/**
 * A module for CSV schema definitions.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity";
import { A, O } from "@beep/utils";
import { Effect, HashSet, Order, pipe, SchemaIssue, SchemaTransformation } from "effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { CsvCodecOptions, CsvCodecOptionsParseOptions } from "../CsvCodecOptions/index.ts";
import { csvError } from "../CsvError/index.ts";
import { formatCsvDocument } from "../CsvFormatter/index.ts";
import { parseCsvRows } from "../CsvParser/index.ts";
import { ParserOptions } from "../ParserOptions/index.ts";
import type { CsvCodecOptionsArgs } from "../CsvCodecOptions/index.ts";
import type { CsvError } from "../CsvError/index.ts";

const $I = $SchemaId.create("Csv");

const CsvText = S.String.pipe(
  S.brand("CSV"),
  $I.annoteSchema("CsvText", {
    description: "Branded CSV document text.",
  })
);

/**
 * Object-like row schema contract accepted by the CSV schema factory.
 *
 * **Example** (Satisfy row schema contract)
 *
 * ```ts
 * import type { RowSchemaWithFields } from "@beep/schema/Csv"
 * import * as S from "effect/Schema"
 *
 * const Row = S.Struct({ name: S.String }) satisfies RowSchemaWithFields
 * console.log(Object.keys(Row.fields))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type RowSchemaWithFields = S.Top & {
  readonly fields: S.Struct.Fields;
};

/**
 * Schema transformation returned by the CSV schema factory for a row schema.
 *
 * **Example** (Decode CSV document rows)
 *
 * ```ts
 * import type { CsvDocument } from "@beep/schema/Csv"
 * import { CSV } from "@beep/schema/Csv"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const Row = S.Struct({ name: S.String })
 * const document: CsvDocument<typeof Row> = CSV(Row)
 * const rows = await Effect.runPromise(S.decodeUnknownEffect(document)("name\nAda"))
 * console.log(rows[0]?.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CsvDocument<RowSchema extends RowSchemaWithFields> = S.decodeTo<
  S.toType<S.$Array<RowSchema>>,
  typeof CsvText
>;

const isRowSchemaWithFields = (value: unknown): value is RowSchemaWithFields =>
  P.isObjectKeyword(value) && P.hasProperty(value, "fields");

const toSchemaIssue = (error: CsvError | S.SchemaError): SchemaIssue.Issue =>
  new SchemaIssue.InvalidValue({
    message: error.message,
  });

const getSchemaColumns = <RowSchema extends RowSchemaWithFields>(rowSchema: RowSchema): ReadonlyArray<string> =>
  R.keys(rowSchema.fields);

const CsvEffect = <RowSchema extends RowSchemaWithFields>(
  rowSchema: RowSchema,
  options?: CsvCodecOptionsArgs
): CsvDocument<RowSchema> => {
  const decodeRows = decodeCsvRowsEffect(rowSchema, options);
  const encodeRows = encodeCsvRowsEffect(rowSchema, options);
  const rowsSchema = rowSchema.pipe(S.Array, S.toType);

  return CsvText.pipe(
    S.decodeTo(
      rowsSchema,
      SchemaTransformation.transformOrFail({
        decode: (input) => decodeRows(input).pipe(Effect.mapError(toSchemaIssue)),
        encode: (rows) => encodeRows(rows).pipe(Effect.mapError(toSchemaIssue)),
      })
    ),
    $I.annoteSchema("Csv", {
      description: "Schema factory for branded CSV text decoded into typed row arrays.",
    })
  );
};

const validateHeaderRow = Effect.fn("validateHeaderRow")(function* (
  headerRow: ReadonlyArray<string>,
  schemaColumns: ReadonlyArray<string>
) {
  let seen = HashSet.empty<string>();
  let duplicates = HashSet.empty<string>();

  for (const header of headerRow) {
    if (HashSet.has(seen, header)) {
      duplicates = HashSet.add(duplicates, header);
    } else {
      seen = HashSet.add(seen, header);
    }
  }

  const duplicateHeadersSorted = pipe(A.fromIterable(duplicates), A.sort(Order.String));

  if (A.isReadonlyArrayNonEmpty(duplicateHeadersSorted)) {
    return yield* csvError(`Duplicate headers found [${A.join(duplicateHeadersSorted, ", ")}]`);
  }

  const headerSet = HashSet.fromIterable(headerRow);
  const schemaSet = HashSet.fromIterable(schemaColumns);
  const missingHeaders = pipe(
    schemaColumns,
    A.filter((column) => !HashSet.has(headerSet, column)),
    A.sort(Order.String)
  );
  const extraHeaders = pipe(
    headerRow,
    A.filter((column) => !HashSet.has(schemaSet, column)),
    A.sort(Order.String)
  );

  if (A.isReadonlyArrayNonEmpty(missingHeaders) || A.isReadonlyArrayNonEmpty(extraHeaders)) {
    const details = pipe(
      [
        A.isReadonlyArrayNonEmpty(missingHeaders) ? `missing: ${A.join(missingHeaders, ", ")}` : null,
        A.isReadonlyArrayNonEmpty(extraHeaders) ? `unexpected: ${A.join(extraHeaders, ", ")}` : null,
      ],
      A.filter(P.isNotNull),
      A.join("; ")
    );

    return yield* csvError(`CSV header mismatch (${details}).`);
  }

  return yield* Effect.void;
});

const mapRowToHeaderRecord = (
  headerRow: ReadonlyArray<string>,
  row: ReadonlyArray<string>,
  strictColumnHandling: boolean
): Effect.Effect<Record<string, string>, CsvError> => {
  if (strictColumnHandling && row.length !== headerRow.length) {
    return Effect.fail(csvError(`Column header mismatch expected: ${headerRow.length} columns got: ${row.length}`));
  }

  if (row.length > headerRow.length) {
    return Effect.fail(csvError(`Column header mismatch expected: ${headerRow.length} columns got: ${row.length}`));
  }

  return Effect.succeed(
    R.fromEntries(
      pipe(
        headerRow,
        A.map(
          (header, index) =>
            [
              header,
              pipe(
                row,
                A.get(index),
                O.getOrElse(() => "")
              ),
            ] as const
        )
      )
    )
  );
};

const normalizeParserOptions = Effect.fn("Csv.normalizeParserOptions")(function* (options?: CsvCodecOptionsArgs) {
  const decoded = yield* CsvCodecOptions.decodeEffect(options ?? {}, CsvCodecOptionsParseOptions);

  return {
    codec: decoded,
    parser: ParserOptions.new({
      comment: O.getOrNull(decoded.comment),
      delimiter: decoded.delimiter,
      escape: O.getOrNull(decoded.escape),
      ignoreEmpty: decoded.ignoreEmpty,
      ltrim: decoded.ltrim,
      maxRows: decoded.maxRows,
      quote: O.getOrNull(decoded.quote),
      rtrim: decoded.rtrim,
      skipLines: decoded.skipLines,
      skipRows: decoded.skipRows,
      strictColumnHandling: decoded.strictColumnHandling,
      trim: decoded.trim,
    }),
  };
});

const decodeCsvRowsEffect = <RowSchema extends RowSchemaWithFields>(
  rowSchema: RowSchema,
  options?: CsvCodecOptionsArgs
) =>
  Effect.fn("Csv.decodeCsvRowsEffect")(function* (input: string) {
    const normalized = yield* normalizeParserOptions(options);
    const rawRows = yield* parseCsvRows(input, normalized.parser);
    const rowsAfterSkippedLines = A.drop(rawRows, normalized.codec.skipLines);

    const decodeNonEmptyRows = Effect.fn("Csv.decodeCsvRowsEffect.onNonEmpty")(function* (
      headerRow: ReadonlyArray<string>,
      dataRows: ReadonlyArray<ReadonlyArray<string>>
    ) {
      const schemaColumns = getSchemaColumns(rowSchema);

      yield* validateHeaderRow(headerRow, schemaColumns);

      const rowsAfterSkipRows = A.drop(dataRows, normalized.codec.skipRows);
      const rowsAfterLimit =
        normalized.codec.maxRows > 0 ? A.take(rowsAfterSkipRows, normalized.codec.maxRows) : rowsAfterSkipRows;

      const mappedRows = yield* Effect.forEach(rowsAfterLimit, (row) =>
        mapRowToHeaderRecord(headerRow, row, normalized.codec.strictColumnHandling)
      );

      return yield* S.decodeEffect(S.Array(rowSchema))(mappedRows);
    });

    return yield* A.match(rowsAfterSkippedLines, {
      onEmpty: () => Effect.succeed(A.empty<RowSchema["Type"]>()),
      onNonEmpty: ([headerRow, ...dataRows]) => decodeNonEmptyRows(headerRow, dataRows),
    });
  });

const getEncodedCell = (row: unknown, column: string): Effect.Effect<string, CsvError> => {
  if (!P.isObject(row)) {
    return Effect.fail(csvError("Encoded CSV rows must be object-like values."));
  }

  if (!(column in row)) {
    return Effect.succeed("");
  }

  const value = row[column];

  if (P.isNull(value) || P.isUndefined(value)) {
    return Effect.succeed("");
  }

  if (P.isString(value)) {
    return Effect.succeed(value);
  }

  return Effect.fail(csvError(`Encoded CSV field '${column}' must be a string-compatible value.`));
};

const encodeCsvRowsEffect = <RowSchema extends RowSchemaWithFields>(
  rowSchema: RowSchema,
  options?: CsvCodecOptionsArgs
) =>
  Effect.fn("Csv.encodeCsvRowsEffect")(function* (rows: ReadonlyArray<RowSchema["Type"]>) {
    const normalized = yield* normalizeParserOptions(options);
    const schemaColumns = getSchemaColumns(rowSchema);
    const encodedRows = yield* S.encodeEffect(S.Array(rowSchema))(rows);
    const formattedRows = yield* Effect.forEach(encodedRows, (row) =>
      Effect.forEach(schemaColumns, (column) => getEncodedCell(row, column))
    );
    const document = yield* formatCsvDocument(schemaColumns, formattedRows, normalized.codec);

    return CsvText.make(document);
  });

/**
 * Schema factory for CSV documents whose rows are validated by the provided
 * row schema.
 *
 * **Details**
 *
 * The row schema must be an object-like Effect schema with named fields. CSV
 * cells remain string boundaries, so callers should use string-backed field
 * schemas such as `S.FiniteFromString` when coercion is needed.
 *
 * **Example** (Decode CSV with coercion)
 *
 * ```ts import.meta.vitest name="Decode CSV with coercion"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { CSV } from "@beep/schema/Csv"
 *
 * const Row = S.Struct({ name: S.String, age: S.FiniteFromString })
 * const CsvSchema = CSV(Row)
 *
 * const program = S.decodeUnknownEffect(CsvSchema)("name,age\nAda,36")
 * const rows = await Effect.runPromise(program)
 * rows[0]?.age // => 36
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const Csv: {
  <RowSchema extends RowSchemaWithFields>(rowSchema: RowSchema): CsvDocument<RowSchema>;
  <RowSchema extends RowSchemaWithFields>(rowSchema: RowSchema, options: CsvCodecOptionsArgs): CsvDocument<RowSchema>;
  <RowSchema extends RowSchemaWithFields>(
    options: CsvCodecOptionsArgs
  ): (rowSchema: RowSchema) => CsvDocument<RowSchema>;
} = dual(
  (args) => isRowSchemaWithFields(args[0]),
  <RowSchema extends RowSchemaWithFields>(
    rowSchema: RowSchema | CsvCodecOptionsArgs,
    options?: CsvCodecOptionsArgs
  ): CsvDocument<RowSchema> | ((schema: RowSchema) => CsvDocument<RowSchema>) => {
    if (isRowSchemaWithFields(rowSchema)) {
      return CsvEffect(rowSchema, options);
    }

    return (schema: RowSchema) => CsvEffect(schema, rowSchema);
  }
);

/**
 * Branded runtime type for CSV document text produced by encoding a `CSV`
 * schema.
 *
 * **Example** (Type branded CSV text)
 *
 * ```ts
 * import type { CsvText } from "@beep/schema/Csv"
 *
 * const describe = (text: CsvText): string => `${text.length} characters`
 * console.log(describe.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CsvText = typeof CsvText.Type;

/**
 * Public aliases for concise namespace roles.
 *
 * @category schemas
 * @since 0.0.0
 */
export { Csv as CSV, Csv as Schema };

/**
 * Runtime type extracted from the {@link CSV} alias.
 *
 * **Example** (Type CSV schema alias)
 *
 * ```ts
 * import { CSV } from "@beep/schema/Csv"
 * import type { CSV as CSVSchema } from "@beep/schema/Csv"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const Row = S.Struct({ name: S.String })
 * const schema: CSVSchema<typeof Row> = CSV(Row)
 * const rows = await Effect.runPromise(S.decodeUnknownEffect(schema)("name\nAda"))
 * console.log(rows[0]?.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CSV<RowSchema extends RowSchemaWithFields> = CsvDocument<RowSchema>;

/**
 * Runtime type extracted from the {@link Schema} alias.
 *
 * **Example** (Type Schema alias usage)
 *
 * ```ts
 * import { Schema as CsvSchema } from "@beep/schema/Csv"
 * import type { Schema as CsvSchemaType } from "@beep/schema/Csv"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const Row = S.Struct({ name: S.String })
 * const schema: CsvSchemaType<typeof Row> = CsvSchema(Row)
 * const rows = await Effect.runPromise(S.decodeUnknownEffect(schema)("name\nAda"))
 * console.log(rows[0]?.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Schema<RowSchema extends RowSchemaWithFields> = CsvDocument<RowSchema>;
