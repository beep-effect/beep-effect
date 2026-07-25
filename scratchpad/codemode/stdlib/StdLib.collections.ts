import { LiteralKit } from "@beep/schema"
import { A } from "@beep/utils"
import { CodeModeMap, CodeModeSet, CodeModeURLSearchParams } from "../Codemode.values.ts"

export const arrayMethods = LiteralKit([
  "map",
  "filter",
  "find",
  "findIndex",
  "findLast",
  "findLastIndex",
  "some",
  "every",
  "includes",
  "join",
  "reduce",
  "reduceRight",
  "flatMap",
  "forEach",
  "sort",
  "toSorted",
  "slice",
  "concat",
  "indexOf",
  "lastIndexOf",
  "at",
  "flat",
  "reverse",
  "toReversed",
  "with",
  "push",
  "pop",
  "shift",
  "unshift",
  "splice",
  "toSpliced",
  "fill",
  "copyWithin",
  "keys",
  "values",
  "entries",
])

export const mapMethods = LiteralKit(["get", "set", "has", "delete", "clear", "forEach", "keys", "values", "entries"])

export const mapStatics = LiteralKit(["groupBy"])

export const setMethods = LiteralKit([
  "add",
  "has",
  "delete",
  "clear",
  "forEach",
  "keys",
  "values",
  "entries",
  "union",
  "intersection",
  "difference",
  "symmetricDifference",
  "isSubsetOf",
  "isSupersetOf",
  "isDisjointFrom",
])

export const spreadItems = (value: unknown): Array<unknown> | undefined => {
  if (A.isArray(value)) return value
  if (typeof value === "string") return A.fromIterable(value)
  if (value instanceof CodeModeMap) return A.map(A.fromIterable(value.map.entries()), ([key, item]) => [key, item])
  if (value instanceof CodeModeSet) return A.fromIterable(value.set.values())
  if (value instanceof CodeModeURLSearchParams) {
    return A.map(A.fromIterable(value.params.entries()), ([key, item]) => [key, item])
  }
  return undefined
}
