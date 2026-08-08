import {$ScratchpadId} from "@beep/identity";
import {
  LiteralKit,
  SchemaUtils,
} from "@beep/schema";
import {Str, A} from "@beep/utils";

const $I = $ScratchpadId.create("bsl/Columns.model");

export const ColumnDataType = LiteralKit(
  [
    "array",
    "bigint",
    "boolean",
    "custom",
    "number",
    "object",
    "string",
  ]
).pipe(
  $I.annoteSchema("ColumnDataType", {
    description: "The data type of a column",
  })
);

export type ColumnDataType = typeof ColumnDataType.Type;


export const ColumnDataArrayConstraint = LiteralKit(
  [
    "vector",
    "int64vector",
    "halfvector",
    "basecolumn",
    "point",
    "geometry",
    "line",
  ]
).pipe(
  SchemaUtils.withStatics((schema) => ({
    columnType: A.mapNonEmptyReadonly(schema.Options, Str.prefix("array "))
  })),
  $I.annoteSchema("ColumnDataArrayConstraint", {
    description: "",
  })
);

export type ColumnDataArrayConstraint = typeof ColumnDataArrayConstraint.Type;

export const ColumnDataBigIntConstraint = LiteralKit(
  [
    "int64", "uint64"
  ]
).pipe(
  SchemaUtils.withStatics((schema) => ({
    columnType: A.mapNonEmptyReadonly(schema.Options, Str.prefix("bigint "))
  })),
  $I.annoteSchema("ColumnDataBigIntConstraint", {
    description: "",
  })
);

export type ColumnDataBigIntConstraint = typeof ColumnDataBigIntConstraint.Type;

export const ColumnDataNumberConstraint = LiteralKit(
  [
    "double",
    "float",
    "int8",
    "int16",
    "int24",
    "int32",
    "int53",
    "udouble",
    "ufloat",
    "uint8",
    "uint16",
    "uint24",
    "uint32",
    "uint53",
    "unsigned",
    "year",
  ]
).pipe(
  SchemaUtils.withStatics((schema) => ({
    columnType: A.mapNonEmptyReadonly(schema.Options, Str.prefix("number "))
  })),
  $I.annoteSchema("ColumnDataNumberConstraint", {
    description: "",
  })
);

export type ColumnDataNumberConstraint = typeof ColumnDataNumberConstraint.Type;

export const ColumnDataObjectConstraint = LiteralKit(
  [
    "buffer",
    "date",
    "geometry",
    "json",
    "line",
    "point",
    // Gel-specific,
    "dateDuration",
    "duration",
    "localDate",
    "localDateTime",
    "localTime",
    "relDuration",
  ]
).pipe(
  SchemaUtils.withStatics((schema) => ({
    columnType: A.mapNonEmptyReadonly(schema.Options, Str.prefix("object "))
  })),
  $I.annoteSchema("ColumnDataObjectConstraint", {
    description: "",
  })
);

export type ColumnDataObjectConstraint = typeof ColumnDataObjectConstraint.Type;


export const ColumnDataStringConstraint = LiteralKit(
  [
    "binary",
    "cidr",
    "date",
    "datetime",
    "enum",
    "inet",
    "int64",
    "interval",
    "macaddr",
    "macaddr8",
    "numeric",
    "sparsevec",
    "time",
    "timestamp",
    "uint64",
    "unumeric",
    "uuid",
  ]
).pipe(
  SchemaUtils.withStatics((schema) => ({
    columnType: A.mapNonEmptyReadonly(schema.Options, Str.prefix("string "))
  })),
  $I.annoteSchema("ColumnDataStringConstraint", {
    description: "",
  })
);

export type ColumnDataStringConstraint = typeof ColumnDataStringConstraint.Type;

export const ColumnDataConstraint = LiteralKit(
  [
    ...ColumnDataArrayConstraint.Options,
    ...ColumnDataBigIntConstraint.Options,
    ...ColumnDataNumberConstraint.Options,
    ...ColumnDataObjectConstraint.Options,
    ...ColumnDataStringConstraint.Options,
  ]
).pipe(
  $I.annoteSchema("ColumnDataConstraint", {
    description: "",
  })
);

export type ColumnDataConstraint = typeof ColumnDataConstraint.Type;

export const ColumnType = LiteralKit(
  [
    ...ColumnDataType.Options,
    ...ColumnDataArrayConstraint.columnType,
    ...ColumnDataBigIntConstraint.columnType,
    ...ColumnDataNumberConstraint.columnType,
    ...ColumnDataObjectConstraint.columnType,
    ...ColumnDataStringConstraint.columnType,
  ]
).pipe(
  $I.annoteSchema("ColumnType", {
    description: "",
  })
);

export type ColumnType = typeof ColumnType.Type;

export const Dialect = LiteralKit(
  [
    "pg", "mysql", "sqlite", "singlestore", "mssql", "common", "cockroach"
  ]
).pipe(
  $I.annoteSchema("Dialect", {
    description: "",
  })
);

export type Dialect = typeof Dialect.Type;
