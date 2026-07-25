import {
  containsOpaqueReference,
  containsRuntimeReference,
  isRuntimeReference,
} from "../interpreter/index.ts"
import { MutableHashSet, pipe } from "effect"
import * as S from "effect/Schema"
import { LiteralKit } from "@beep/schema"
import { A, O, P } from "@beep/utils"
import { copyIn, copyOut } from "../Codemode.tool-runtime.ts"
import {
  isCodeModeValue,
  CodeModeDate,
  CodeModeMap,
  CodeModePromise,
  CodeModeRegExp,
  CodeModeSet,
  CodeModeURL,
  CodeModeURLSearchParams,
} from "../Codemode.values.ts"
import { boundedData, coerceToString } from "./StdLib.value.ts"

export const consoleMethods = LiteralKit(["log", "info", "debug", "warn", "error", "dir", "table"])

const MAX_CONSOLE_DEPTH = 32
const encodeJson = S.encodeUnknownSync(S.UnknownFromJsonString)

export const formatConsoleMessage = (name: string, args: Array<unknown>): string => {
  if (name === "dir") return A.isArrayEmpty(args) ? "undefined" : formatConsoleArgument(args[0])
  if (name === "table") return formatConsoleTable(args[0], args[1])
  const prefix = name === "warn" ? "[warn] " : name === "error" ? "[error] " : name === "debug" ? "[debug] " : ""
  return `${prefix}${pipe(args, A.map(formatConsoleArgument), A.join(" "))}`
}

const formatConsoleArgument = (value: unknown): string => {
  if (value === undefined) return "undefined"
  if (typeof value === "string") return value
  return formatConsoleValue(value, MutableHashSet.empty(), 0)
}

const formatConsoleValue = (
  value: unknown,
  seen: MutableHashSet.MutableHashSet<object>,
  depth: number,
): string => {
  if (value === null || value === undefined) return "null"
  if (typeof value === "string") return encodeJson(value)
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (typeof value !== "object") return String(value)
  if (value instanceof CodeModePromise) return "[Promise (await it to get its value)]"
  if (value instanceof CodeModeDate) return coerceToString(value)
  if (value instanceof CodeModeRegExp) return coerceToString(value)
  if (value instanceof CodeModeURL) return coerceToString(value)
  if (value instanceof CodeModeURLSearchParams) return coerceToString(value)
  if (depth > MAX_CONSOLE_DEPTH) return "..."
  if (MutableHashSet.has(seen, value)) return "[Circular]"
  if (value instanceof CodeModeMap) {
    MutableHashSet.add(seen, value)
    try {
      const entries = pipe(
        value.map.entries(),
        A.fromIterable,
        A.map(([key, item]): Array<unknown> => [key, item]),
      )
      return `Map(${value.map.size}) ${formatConsoleValue(entries, seen, depth + 1)}`
    } finally {
      MutableHashSet.remove(seen, value)
    }
  }
  if (value instanceof CodeModeSet) {
    MutableHashSet.add(seen, value)
    try {
      return `Set(${value.set.size}) ${formatConsoleValue(A.fromIterable(value.set.values()), seen, depth + 1)}`
    } finally {
      MutableHashSet.remove(seen, value)
    }
  }
  if (isRuntimeReference(value)) return "[opaque reference]"
  MutableHashSet.add(seen, value)
  try {
    if (A.isArray(value)) {
      return `[${pipe(value, A.map((item) => formatConsoleValue(item, seen, depth + 1)), A.join(","))}]`
    }
    return `{${pipe(
      Object.entries(value),
      A.map(([key, item]) => `${encodeJson(key)}:${formatConsoleValue(item, seen, depth + 1)}`),
      A.join(","),
    )}}`
  } finally {
    MutableHashSet.remove(seen, value)
  }
}

const formatConsoleTable = (value: unknown, columnsArgument: unknown): string => {
  if (value === undefined) return "undefined"
  if (containsOpaqueReference(value)) return "[opaque reference]"
  const data = boundedData(value, "console.table argument")
  const columns = consoleTableColumns(columnsArgument)
  const rows = consoleTableRows(data, columns)
  const keys = O.getOrElse(
    columns,
    () => pipe(rows, A.flatMap((row) => Object.keys(row.values)), A.dedupe),
  )
  const header = pipe(["(index)", ...keys], A.join("\t"))
  return pipe(
    [
      header,
      ...A.map(
        rows,
        (row) => pipe(
          [row.index, ...A.map(keys, (key) => formatConsoleTableCell(row.values[key]))],
          A.join("\t"),
        ),
      ),
    ],
    A.join("\n"),
  )
}

const consoleTableColumns = (value: unknown): O.Option<ReadonlyArray<string>> => {
  if (value === undefined || containsRuntimeReference(value)) return O.none()
  const columns = copyOut(copyIn(value, "console.table columns"), "nullify")
  return A.isArray(columns)
    ? O.some(A.map(columns, (column) => String(column)))
    : O.none()
}

const consoleTableRows = (
  data: unknown,
  columns: O.Option<ReadonlyArray<string>>,
): Array<{ readonly index: string; readonly values: Record<string, unknown> }> => {
  if (A.isArray(data)) {
    return A.map(data, (item, index) => ({ index: String(index), values: consoleTableValues(item, columns) }))
  }
  if (data !== null && typeof data === "object" && !isCodeModeValue(data)) {
    return A.map(
      Object.entries(data),
      ([index, item]) => ({ index, values: consoleTableValues(item, columns) }),
    )
  }
  return [{ index: "0", values: { Value: data } }]
}

const consoleTableValues = (
  value: unknown,
  columns: O.Option<ReadonlyArray<string>>,
): Record<string, unknown> => {
  if (P.isNotNull(value) && P.isObjectKeyword(value) && !A.isArray(value) && !isCodeModeValue(value)) {
    const source = value as Record<string, unknown>
    return O.match(columns, {
      onNone: () => Object.fromEntries(Object.entries(source)),
      onSome: (names) => Object.fromEntries(A.map(names, (column) => [column, source[column]])),
    })
  }
  return { Value: value }
}

const formatConsoleTableCell = (value: unknown): string => {
  if (value === undefined) return ""
  if (typeof value === "string") return value
  return formatConsoleValue(value, MutableHashSet.empty(), 0)
}
