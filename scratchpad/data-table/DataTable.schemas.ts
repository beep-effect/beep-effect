import * as S from "effect/Schema"
import { $ScratchpadId } from "@beep/identity/packages"
import { LiteralKit } from "@beep/schema/LiteralKit"
import { MappedLiteralKit } from "@beep/schema/MappedLiteralKit"
import * as Tuple from "effect/Tuple"
import { pipe } from "effect/Function"
import * as SchemaUtils from "@beep/schema/SchemaUtils"

const $I = $ScratchpadId.create("data-table/DataTable.schemas")

export const FilterVariant = LiteralKit(
  [
    "text",
    "number",
    "date",
    "boolean",
    "select"
  ]
).pipe(
  $I.annoteSchema("FilterVariant", {
    description: ""
  })
)

export type FilterVariant = typeof FilterVariant.Type;

export const FilterOperator = MappedLiteralKit(
  [
    ["iLike", "ilike"],
    ["notILike", "not.ilike"],
    ["eq", "eq"],
    ["ne", "neq"],
    ["inArray", "in"],
    ["notInArray", "not.in"],
    ["isEmpty", "is.empty"],
    ["isNotEmpty", "not.is.empty"],
    ["lt", "lt"],
    ["lte", "lte"],
    ["gt", "gt"],
    ["gte", "gte"],
    ["isBetween", "between"]
  ]
).pipe(
  $I.annoteSchema("FilterOperator", {
    description: ""
  })
);

export type FilterOperator = typeof FilterOperator.Type;
export declare namespace FilterOperator {
  export type Encoded = typeof FilterOperator.From.Type;
}

export const JoinOperator = LiteralKit(
  [
    "and",
    "or"
  ]
).pipe(
  $I.annoteSchema("JoinOperator", {
    description: ""
  })
)

export type JoinOperator = typeof JoinOperator.Type;


export const OrderingOperator = FilterOperator.pick(
  [
    "lt",
    "lte",
    "gt",
    "gte"
  ]
).pipe(
  $I.annoteSchema("OrderingOperator", {
    description: ""
  })
)

export type OrderingOperator = typeof OrderingOperator.Type;

