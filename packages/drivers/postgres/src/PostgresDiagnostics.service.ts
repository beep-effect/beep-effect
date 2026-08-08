/**
 * SQL formatting and Postgres error rendering helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import colors from "@beep/colors";
import { A, Str } from "@beep/utils";
import { Cause, Console, flow, pipe, Result } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import { format } from "sql-formatter";
import { isCause, isObject, readCauseReasons, safeBoolean } from "./internal/PostgresDiagnosticGuards.ts";
import { PostgresError } from "./Postgres.errors.ts";
import type { Colors } from "@beep/colors";
import type { Effect } from "effect";

const SqlKeywordValues = [
  "select",
  "from",
  "where",
  "insert",
  "into",
  "values",
  "update",
  "set",
  "delete",
  "create",
  "drop",
  "alter",
  "table",
  "index",
  "join",
  "left",
  "right",
  "inner",
  "outer",
  "on",
  "and",
  "or",
  "not",
  "in",
  "is",
  "null",
  "like",
  "between",
  "exists",
  "case",
  "when",
  "then",
  "else",
  "end",
  "order",
  "by",
  "group",
  "having",
  "limit",
  "offset",
  "as",
  "distinct",
  "union",
  "all",
  "returning",
  "default",
  "cascade",
  "constraint",
  "primary",
  "key",
  "foreign",
  "references",
  "unique",
  "check",
  "begin",
  "commit",
  "rollback",
  "transaction",
  "with",
  "recursive",
  "asc",
  "desc",
  "true",
  "false",
  "cast",
];

const SqlFunctionValues = [
  "count",
  "sum",
  "avg",
  "min",
  "max",
  "now",
  "current_timestamp",
  "coalesce",
  "nullif",
  "array_agg",
  "json_agg",
  "jsonb_agg",
  "row_number",
  "rank",
  "dense_rank",
  "lead",
  "lag",
  "first_value",
  "last_value",
  "string_agg",
  "concat",
  "lower",
  "upper",
  "trim",
  "length",
  "substring",
];

const stripAnsi = Str.replace(/\x1b\[[0-9;]*m/g, "");
const visualLength = flow(stripAnsi, Str.length);

const padEnd = (text: string, targetLength: number): string => {
  const currentLength = visualLength(text);
  return currentLength >= targetLength ? text : `${text}${Str.repeat(" ", targetLength - currentLength)}`;
};

const highlightLine = (line: string, palette: Colors): string =>
  pipe(
    line,
    Str.replaceWith(/\$\d+/g, flow(palette.bold, palette.yellow)),
    Str.replaceWith(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g, (word) => {
      const lower = Str.toLowerCase(word);
      if (A.contains(SqlKeywordValues, lower)) {
        return palette.magenta(palette.bold(word));
      }
      if (A.contains(SqlFunctionValues, lower)) {
        return palette.blue(word);
      }
      return word;
    }),
    Str.replaceWith(/([=<>!]+|::|->|@>|<@|\?\||\?&)/g, palette.cyan)
  );

const isDate = (value: unknown): value is Date => safeBoolean(() => value instanceof Date);

const isPostgresError = (value: unknown): value is PostgresError => safeBoolean(() => PostgresError.is(value));

const unprintable = "<unprintable>";

const formatDate = (value: Date): string =>
  pipe(
    Result.try(() => {
      const iso: unknown = value.toJSON();
      return P.isString(iso) ? iso : value.toString();
    }),
    Result.getOrElse(() => unprintable)
  );

const previewValue = (value: unknown): string =>
  pipe(
    Result.try(() => String(value)),
    Result.getOrElse(() => unprintable)
  );

const formatParam = (value: unknown, index: number, palette: Colors): string => {
  const label = palette.yellow(palette.bold(`$${index + 1}`));
  const separator = palette.dim("=");

  if (P.isNull(value)) {
    return `${label}${separator}${palette.dim("null")}`;
  }
  if (P.isUndefined(value)) {
    return `${label}${separator}${palette.dim("undefined")}`;
  }
  if (P.isString(value)) {
    const truncated = Str.length(value) > 40 ? `${Str.slice(0, 37)(value)}...` : value;
    return `${label}${separator}${palette.green(`"${truncated}"`)}`;
  }
  if (P.isNumber(value)) {
    return `${label}${separator}${palette.cyan(`${value}`)}`;
  }
  if (P.isBoolean(value)) {
    return `${label}${separator}${palette.blue(`${value}`)}`;
  }
  if (isDate(value)) {
    return `${label}${separator}${palette.magenta(formatDate(value))}`;
  }
  if (A.isArray(value)) {
    const preview =
      A.length(value) > 3
        ? `[${pipe(value, A.take(3), A.map(previewValue), A.join(", "))}, ...]`
        : `[${pipe(value, A.map(previewValue), A.join(", "))}]`;
    return `${label}${separator}${palette.cyan(preview)}`;
  }
  if (isObject(value)) {
    return `${label}${separator}${palette.gray("[Object]")}`;
  }

  return `${label}${separator}${palette.gray(previewValue(value))}`;
};

const formatParams = (parameters: ReadonlyArray<unknown>, palette: Colors): string => {
  if (A.isReadonlyArrayEmpty(parameters)) {
    return "";
  }

  const formatted = A.map(parameters, (parameter, index) => formatParam(parameter, index, palette));
  if (formatted.length <= 3) {
    return `${palette.dim("params")} ${A.join(formatted, palette.dim("  "))}`;
  }

  const widths = pipe(
    formatted,
    A.map((parameter, index): readonly [number, number] => [index % 3, visualLength(parameter)]),
    A.reduce([0, 0, 0] as ReadonlyArray<number>, (acc, [column, length]) => [
      column === 0 ? Math.max(acc[0], length) : acc[0],
      column === 1 ? Math.max(acc[1], length) : acc[1],
      column === 2 ? Math.max(acc[2], length) : acc[2],
    ])
  );

  return pipe(
    formatted,
    A.chunksOf(3),
    A.map((chunk, rowIndex) => {
      const cells = A.map(chunk, (item, column) => padEnd(item, widths[column] ?? 0));
      return `${rowIndex === 0 ? palette.dim("params") : "      "} ${A.join(cells, palette.dim("  "))}`;
    }),
    A.join("\n")
  );
};

const queryType = (query: string): string => {
  const first = pipe(
    query,
    Str.trim,
    Str.toLowerCase,
    Str.split(/\s+/),
    A.head,
    O.getOrElse(() => "other")
  );
  return Str.toUpperCase(first);
};

const formatStatement = (statement: string): string =>
  pipe(
    Result.try(() =>
      format(statement, {
        language: "postgresql",
        tabWidth: 2,
        keywordCase: "lower",
        linesBetweenQueries: 1,
      })
    ),
    Result.getOrElse(() => statement)
  );

const postgresErrorFromReason = (reason: Cause.Reason<unknown>): O.Option<PostgresError> =>
  pipe(
    Result.try((): O.Option<PostgresError> => {
      if (Cause.isFailReason(reason)) {
        return isPostgresError(reason.error) ? O.some(reason.error) : O.none();
      }
      if (Cause.isDieReason(reason)) {
        return isPostgresError(reason.defect) ? O.some(reason.defect) : O.none();
      }
      return O.none();
    }),
    Result.getOrElse(O.none)
  );

const postgresErrorFromCause: (cause: Cause.Cause<unknown>) => O.Option<PostgresError> = flow(
  readCauseReasons,
  A.map(postgresErrorFromReason),
  A.getSomes,
  A.head
);

const normalizePostgresError = (error: unknown): PostgresError => {
  if (isPostgresError(error)) {
    return error;
  }

  if (isCause(error)) {
    return pipe(
      postgresErrorFromCause(error),
      O.getOrElse(() => PostgresError.fromUnknown("format", error))
    );
  }

  return PostgresError.fromUnknown("format", error);
};

/**
 * Format and highlight PostgreSQL SQL for terminal output.
 *
 * **Example** (Format SQL with parameters)
 *
 * ```ts
 * import { pipe } from "effect"
 * import { formatSql } from "@beep/postgres"
 *
 * const sql = formatSql("select * from users where id = $1", [1])
 * const piped = pipe("select * from users where id = $1", formatSql([1]))
 * console.log(sql, piped)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const formatSql: {
  (parameters?: ReadonlyArray<unknown>, palette?: Colors): (statement: string) => string;
  (statement: string, parameters?: ReadonlyArray<unknown>, palette?: Colors): string;
} = dual(
  (args) => P.isString(args[0]),
  (statement: string, parameters: ReadonlyArray<unknown> = [], palette: Colors = colors): string => {
    const formatted = formatStatement(statement);
    const highlighted = pipe(
      formatted,
      Str.split("\n"),
      A.map((line) => highlightLine(line, palette)),
      A.join("\n")
    );
    const renderedParams = formatParams(parameters, palette);

    return renderedParams.length === 0 ? highlighted : `${highlighted}\n${renderedParams}`;
  }
);

/**
 * Renderer that turns an unknown Postgres failure into diagnostic text.
 *
 * @example
 * ```ts
 * import type { PostgresErrorFormatter } from "@beep/postgres"
 * import { formatPostgresError } from "@beep/postgres"
 *
 * const render: PostgresErrorFormatter = formatPostgresError
 * console.log(render(new Error("failed")))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export type PostgresErrorFormatter = (error: unknown) => string;

/**
 * Build a Postgres failure renderer bound to a specific terminal palette.
 *
 * @example
 * ```ts
 * import { createColors } from "@beep/colors"
 * import { formatPostgresErrorWith, PostgresError } from "@beep/postgres"
 *
 * const renderPlain = formatPostgresErrorWith(createColors(false))
 * console.log(renderPlain(PostgresError.fromUnknown("query", new Error("failed"))))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const formatPostgresErrorWith =
  (palette: Colors): PostgresErrorFormatter =>
  (error) => {
    const normalized = normalizePostgresError(error);
    const detailLines = A.getSomes([
      O.map(normalized.message, (message) => `${palette.dim("message")}   ${message}`),
      O.map(normalized.sqlState, (code) => {
        const name = O.match(normalized.sqlStateName, {
          onNone: () => "",
          onSome: (value) => palette.dim(` (${value})`),
        });
        return `${palette.dim("sqlstate")}  ${palette.yellow(code)}${name}`;
      }),
      O.map(normalized.severity, (severity) => `${palette.dim("severity")}  ${palette.red(severity)}`),
      O.map(normalized.schemaName, (schema) => `${palette.dim("schema")}    ${palette.cyan(schema)}`),
      O.map(normalized.tableName, (table) => `${palette.dim("table")}     ${palette.cyan(table)}`),
      O.map(normalized.columnName, (column) => `${palette.dim("column")}    ${palette.cyan(column)}`),
      O.map(normalized.constraintName, (constraint) => `${palette.dim("constraint")} ${palette.magenta(constraint)}`),
      O.map(normalized.detail, (detail) => `${palette.dim("detail")}    ${detail}`),
      O.map(normalized.hint, (hint) => `${palette.dim("hint")}      ${palette.green(hint)}`),
      O.map(normalized.where, (where) => `${palette.dim("where")}     ${palette.gray(where)}`),
      O.map(normalized.sourceLocation, (location) => `${palette.dim("source")}    ${palette.underline(location)}`),
    ]);
    const queryLines = O.match(normalized.query, {
      onNone: A.empty<string>,
      onSome: (query) => {
        const parameters = O.getOrElse(normalized.params, A.empty<unknown>);
        return ["", palette.bold(queryType(query)), formatSql(query, parameters, palette)];
      },
    });

    return pipe(
      [palette.red(palette.bold("POSTGRES ERROR")), `${palette.dim("operation")} ${normalized.operation}`],
      A.appendAll(detailLines),
      A.appendAll(queryLines),
      A.join("\n")
    );
  };

/**
 * Render a Postgres failure with diagnostics and formatted SQL.
 *
 * **Example** (Format unknown query failure)
 *
 * ```ts
 * import { formatPostgresError, PostgresError } from "@beep/postgres"
 *
 * const text = formatPostgresError(PostgresError.fromUnknown("query", new Error("failed")))
 * console.log(text)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const formatPostgresError: PostgresErrorFormatter = formatPostgresErrorWith(colors);

/**
 * Log a formatted Postgres failure to stderr.
 *
 * **Example** (Log error via Effect)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { logPostgresError, PostgresError } from "@beep/postgres"
 *
 * const program = logPostgresError(PostgresError.fromUnknown("query", new Error("failed")))
 * Effect.runPromise(program).then(() => console.log("logged"))
 * ```
 *
 * @effects Formats the unknown failure as a Postgres diagnostic message and
 * writes it to stderr through Effect's `Console` service when the returned
 * effect is executed.
 * @category utilities
 * @since 0.0.0
 */
export const logPostgresError = (error: unknown): Effect.Effect<void> => Console.error(formatPostgresError(error));
