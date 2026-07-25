/**
 * Finite method-name domains shared by CodeMode models and adapters.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { LiteralKit } from "@beep/schema";

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
]);

export type ArrayMethod = typeof arrayMethods.Type;

export const arrayStatics = LiteralKit(["isArray", "of", "from"]);

export type ArrayStatic = typeof arrayStatics.Type;

export const mapMethods = LiteralKit([
  "get",
  "set",
  "has",
  "delete",
  "clear",
  "forEach",
  "keys",
  "values",
  "entries",
]);

export type MapMethod = typeof mapMethods.Type;

export const mapStatics = LiteralKit(["groupBy"]);

export type MapStatic = typeof mapStatics.Type;

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
]);

export type SetMethod = typeof setMethods.Type;

export const stringMethods = LiteralKit([
  "toLowerCase",
  "toUpperCase",
  "trim",
  "trimStart",
  "trimEnd",
  "split",
  "slice",
  "substring",
  "includes",
  "startsWith",
  "endsWith",
  "indexOf",
  "lastIndexOf",
  "replace",
  "replaceAll",
  "repeat",
  "padStart",
  "padEnd",
  "charAt",
  "charCodeAt",
  "codePointAt",
  "at",
  "concat",
  "toString",
  "match",
  "matchAll",
  "search",
  "localeCompare",
  "normalize",
]);

export type StringMethod = typeof stringMethods.Type;

export const stringStatics = LiteralKit(["fromCharCode", "fromCodePoint"]);

export type StringStatic = typeof stringStatics.Type;

export const DateSetterName = LiteralKit([
  "setTime",
  "setMilliseconds",
  "setUTCMilliseconds",
  "setDate",
  "setUTCDate",
  "setSeconds",
  "setUTCSeconds",
  "setMonth",
  "setUTCMonth",
  "setMinutes",
  "setUTCMinutes",
  "setFullYear",
  "setUTCFullYear",
  "setHours",
  "setUTCHours",
]);

export type DateSetterName = typeof DateSetterName.Type;

export const DateSetterArity = Object.freeze({
  setTime: 1,
  setMilliseconds: 1,
  setUTCMilliseconds: 1,
  setDate: 1,
  setUTCDate: 1,
  setSeconds: 2,
  setUTCSeconds: 2,
  setMonth: 2,
  setUTCMonth: 2,
  setMinutes: 3,
  setUTCMinutes: 3,
  setFullYear: 3,
  setUTCFullYear: 3,
  setHours: 4,
  setUTCHours: 4,
} satisfies Record<DateSetterName, 1 | 2 | 3 | 4>);

export const dateMethods = LiteralKit([
  "getTime",
  "valueOf",
  "toISOString",
  "toJSON",
  "toString",
  "toUTCString",
  "toGMTString",
  "getFullYear",
  "getMonth",
  "getDate",
  "getDay",
  "getHours",
  "getMinutes",
  "getSeconds",
  "getMilliseconds",
  "getUTCFullYear",
  "getUTCMonth",
  "getUTCDate",
  "getUTCDay",
  "getUTCHours",
  "getUTCMinutes",
  "getUTCSeconds",
  "getUTCMilliseconds",
  "getTimezoneOffset",
  ...DateSetterName.Options,
]);

export type DateMethod = typeof dateMethods.Type;

export const dateStatics = LiteralKit(["now", "parse", "UTC"]);

export type DateStatic = typeof dateStatics.Type;

export const regexpMethods = LiteralKit(["test", "exec", "toString"]);
export type RegExpMethod = typeof regexpMethods.Type;

export const regexpStatics = LiteralKit(["escape"]);
export type RegExpStatic = typeof regexpStatics.Type;

export const objectStatics = LiteralKit([
  "keys",
  "values",
  "entries",
  "hasOwn",
  "is",
  "assign",
  "fromEntries",
  "groupBy",
]);

export type ObjectStatic = typeof objectStatics.Type;

export const numberMethods = LiteralKit([
  "toFixed",
  "toPrecision",
  "toExponential",
  "toString",
  "valueOf",
]);

export type NumberMethod = typeof numberMethods.Type;

export const numberStatics = LiteralKit([
  "isInteger",
  "isFinite",
  "isNaN",
  "isSafeInteger",
  "parseInt",
  "parseFloat",
]);

export type NumberStatic = typeof numberStatics.Type;

export const mathMethods = LiteralKit([
  "random",
  "max",
  "min",
  "abs",
  "acos",
  "acosh",
  "asin",
  "asinh",
  "atan",
  "atan2",
  "atanh",
  "floor",
  "ceil",
  "round",
  "trunc",
  "sign",
  "sqrt",
  "cbrt",
  "pow",
  "hypot",
  "cos",
  "cosh",
  "sin",
  "sinh",
  "tan",
  "tanh",
  "log",
  "log2",
  "log10",
  "log1p",
  "exp",
  "expm1",
  "f16round",
  "fround",
  "clz32",
  "imul",
  "sumPrecise",
]);

export type MathMethod = typeof mathMethods.Type;

export const ConsoleMethod = LiteralKit([
  "log",
  "info",
  "debug",
  "warn",
  "error",
  "dir",
  "table",
]);

export type ConsoleMethod = typeof ConsoleMethod.Type;

export const UrlMethod = LiteralKit(["toString", "toJSON"]);
export type UrlMethod = typeof UrlMethod.Type;

export const UrlStatic = LiteralKit(["canParse", "parse"]);
export type UrlStatic = typeof UrlStatic.Type;

export const UrlSearchParamsMethod = LiteralKit([
  "append",
  "delete",
  "get",
  "getAll",
  "has",
  "set",
  "sort",
  "forEach",
  "keys",
  "values",
  "entries",
  "toString",
]);

export type UrlSearchParamsMethod = typeof UrlSearchParamsMethod.Type;
