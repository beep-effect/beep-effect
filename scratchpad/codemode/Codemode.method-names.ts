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

export const arrayStatics = LiteralKit(["isArray", "of", "from"]);

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

export const mapStatics = LiteralKit(["groupBy"]);

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

export const stringStatics = LiteralKit(["fromCharCode", "fromCodePoint"]);

export const oneArgumentDateSetter = LiteralKit([
  "setTime",
  "setMilliseconds",
  "setUTCMilliseconds",
  "setDate",
  "setUTCDate",
]);

export const twoArgumentDateSetter = LiteralKit([
  "setSeconds",
  "setUTCSeconds",
  "setMonth",
  "setUTCMonth",
]);

export const threeArgumentDateSetter = LiteralKit([
  "setMinutes",
  "setUTCMinutes",
  "setFullYear",
  "setUTCFullYear",
]);

export const fourArgumentDateSetter = LiteralKit([
  "setHours",
  "setUTCHours",
]);

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
  ...oneArgumentDateSetter.Options,
  ...twoArgumentDateSetter.Options,
  ...threeArgumentDateSetter.Options,
  ...fourArgumentDateSetter.Options,
]);

export const dateStatics = LiteralKit(["now", "parse", "UTC"]);

export const regexpMethods = LiteralKit(["test", "exec", "toString"]);
export const regexpStatics = LiteralKit(["escape"]);

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

export const numberMethods = LiteralKit([
  "toFixed",
  "toPrecision",
  "toExponential",
  "toString",
  "valueOf",
]);

export const numberStatics = LiteralKit([
  "isInteger",
  "isFinite",
  "isNaN",
  "isSafeInteger",
  "parseInt",
  "parseFloat",
]);

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
export const UrlStatic = LiteralKit(["canParse", "parse"]);

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
