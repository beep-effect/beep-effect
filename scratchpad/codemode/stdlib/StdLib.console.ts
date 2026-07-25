import {
  containsOpaqueReference,
  containsRuntimeReference,
  isRuntimeReference,
} from "../interpreter/Interpreter.references.ts";
import {MutableHashSet, pipe} from "effect";
import * as S from "effect/Schema";
import {A, O, P, R} from "@beep/utils";
import {copyIn, copyOut} from "../Codemode.tool-runtime.ts";
import {
  isCodeModeValue,
  CodeModeDate,
  CodeModeMap,
  CodeModePromise,
  CodeModeRegExp,
  CodeModeSet,
  CodeModeURL,
  CodeModeURLSearchParams,
} from "../Codemode.values.ts";
import {boundedData, coerceToString} from "./StdLib.value.ts";
import { ConsoleMethod } from "../Codemode.method-names.ts";

export { ConsoleMethod };

const MAX_CONSOLE_DEPTH = 32;
const encodeJson = S.encodeUnknownSync(S.UnknownFromJsonString);

export const formatConsoleMessage = (name: string, args: Array<unknown>): string => {
  if (ConsoleMethod.is.dir(name)) return A.isArrayEmpty(args) ? "undefined" : formatConsoleArgument(args[0]);
  if (ConsoleMethod.is.table(name)) return formatConsoleTable(args[0], args[1]);
  const prefix = ConsoleMethod.is.warn(name) ? "[warn] " : ConsoleMethod.is.error(name) ? "[error] " : name === "debug" ? "[debug] " : "";
  return `${prefix}${pipe(args, A.map(formatConsoleArgument), A.join(" "))}`;
};

const formatConsoleArgument = (value: unknown): string => {
  if (P.isUndefined(value)) return "undefined";
  if (P.isString(value)) return value;
  return formatConsoleValue(value, MutableHashSet.empty(), 0);
};

const formatConsoleValue = (
  value: unknown,
  seen: MutableHashSet.MutableHashSet<object>,
  depth: number,
): string => {
  if (P.isNull(value) || P.isUndefined(value)) return "null";
  if (P.isString(value)) return encodeJson(value);
  if (P.isNumber(value) || P.isBoolean(value)) return String(value);
  if (!P.isObjectKeyword(value)) return String(value);
  if (CodeModePromise.is(value)) return "[Promise (await it to get its value)]";
  if (CodeModeDate.is(value)) return coerceToString(value);
  if (CodeModeRegExp.is(value)) return coerceToString(value);
  if (CodeModeURL.is(value)) return coerceToString(value);
  if (CodeModeURLSearchParams.is(value)) return coerceToString(value);
  if (depth > MAX_CONSOLE_DEPTH) return "...";
  if (MutableHashSet.has(seen, value)) return "[Circular]";
  if (CodeModeMap.is(value)) {
    MutableHashSet.add(seen, value);
    try {
      const entries = pipe(
        value.map.entries(),
        A.fromIterable,
        A.map(([key, item]): Array<unknown> => [key, item]),
      );
      return `Map(${value.map.size}) ${formatConsoleValue(entries, seen, depth + 1)}`;
    } finally {
      MutableHashSet.remove(seen, value);
    }
  }
  if (CodeModeSet.is(value)) {
    MutableHashSet.add(seen, value);
    try {
      return `Set(${value.set.size}) ${formatConsoleValue(A.fromIterable(value.set.values()), seen, depth + 1)}`;
    } finally {
      MutableHashSet.remove(seen, value);
    }
  }
  if (isRuntimeReference(value)) return "[opaque reference]";
  MutableHashSet.add(seen, value);
  try {
    if (A.isArray(value)) {
      return `[${pipe(value, A.map((item) => formatConsoleValue(item, seen, depth + 1)), A.join(","))}]`;
    }
    return `{${pipe(
      R.toEntries(value),
      A.map(([key, item]) => `${encodeJson(key)}:${formatConsoleValue(item, seen, depth + 1)}`),
      A.join(","),
    )}}`;
  } finally {
    MutableHashSet.remove(seen, value);
  }
};

const formatConsoleTable = (value: unknown, columnsArgument: unknown): string => {
  if (P.isUndefined(value)) return "undefined";
  if (containsOpaqueReference(value)) return "[opaque reference]";
  const data = boundedData(value, "console.table argument");
  const columns = consoleTableColumns(columnsArgument);
  const rows = consoleTableRows(data, columns);
  const keys = O.getOrElse(
    columns,
    () => pipe(rows, A.flatMap((row) => Object.keys(row.values)), A.dedupe),
  );
  const header = pipe(["(index)", ...keys], A.join("\t"));
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
  );
};

const consoleTableColumns = (value: unknown): O.Option<ReadonlyArray<string>> => {
  if (P.isUndefined(value) || containsRuntimeReference(value)) return O.none();
  const columns = copyOut(copyIn(value, "console.table columns"), "nullify");
  return A.isArray(columns)
    ? O.some(A.map(columns, (column) => String(column)))
    : O.none();
};

const consoleTableRows = (
  data: unknown,
  columns: O.Option<ReadonlyArray<string>>,
): Array<{
  readonly index: string;
  readonly values: Record<string, unknown>
}> => {
  if (A.isArray(data)) {
    return A.map(data, (item, index) => ({
      index: String(index),
      values: consoleTableValues(item, columns)
    }));
  }
  if (P.isNotNull(data) && P.isObjectKeyword(data) && !isCodeModeValue(data)) {
    return A.map(
      R.toEntries(data),
      ([index, item]) => ({index, values: consoleTableValues(item, columns)}),
    );
  }
  return [{index: "0", values: {Value: data}}];
};

const consoleTableValues = (
  value: unknown,
  columns: O.Option<ReadonlyArray<string>>,
): Record<string, unknown> => {
  if (P.isNotNull(value) && P.isObjectKeyword(value) && !A.isArray(value) && !isCodeModeValue(value)) {
    const source = value as Record<string, unknown>;
    return O.match(columns, {
      onNone: () => R.fromEntries(R.toEntries(source)),
      onSome: (names) => R.fromEntries(A.map(names, (column) => [column, source[column]])),
    });
  }
  return {Value: value};
};

const formatConsoleTableCell = (value: unknown): string => {
  if (P.isUndefined(value)) return "";
  if (P.isString(value)) return value;
  return formatConsoleValue(value, MutableHashSet.empty(), 0);
};
