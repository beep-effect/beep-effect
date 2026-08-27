/**
 * Finite method-name domains shared by CodeMode models and adapters.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";

const $I = $ScratchpadId.create("codemode/Codemode.method-names");

/**
 * Finite Array instance method names the interpreter may dispatch on guest arrays.
 *
 * **Example** (Admit map, reject concatX)
 *
 * ```ts
 * import { arrayMethods } from "../../../codemode/Codemode.method-names.ts"
 *
 * console.log(arrayMethods.is.map("map")) // true
 * console.log(arrayMethods.is.map("concatX")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
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
]).annotate(
  $I.annote("arrayMethods", {
    description: "Finite Array.prototype method names the interpreter may dispatch.",
  })
);

/**
 * One Array instance method name admitted by {@link arrayMethods}.
 *
 * @see {@link arrayMethods} for the runtime literal kit and membership guards.
 * @category type-level
 * @since 0.0.0
 */
export type ArrayMethod = typeof arrayMethods.Type;

/**
 * Finite Array constructor names the interpreter may dispatch as statics.
 *
 * **Example** (Admit isArray)
 *
 * ```ts
 * import { arrayStatics } from "../../../codemode/Codemode.method-names.ts"
 *
 * console.log(arrayStatics.is.isArray("isArray")) // true
 * console.log(arrayStatics.is.isArray("fromEntries")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const arrayStatics = LiteralKit(["isArray", "of", "from"]).annotate(
  $I.annote("arrayStatics", {
    description: "Finite Array constructor names the interpreter may dispatch.",
  })
);

/**
 * One Array constructor name admitted by {@link arrayStatics}.
 *
 * @see {@link arrayStatics} for the runtime literal kit and membership guards.
 * @category type-level
 * @since 0.0.0
 */
export type ArrayStatic = typeof arrayStatics.Type;

/**
 * Finite Map instance method names the interpreter may dispatch on guest maps.
 *
 * **Example** (Admit get)
 *
 * ```ts
 * import { mapMethods } from "../../../codemode/Codemode.method-names.ts"
 *
 * console.log(mapMethods.is.get("get")) // true
 * console.log(mapMethods.is.get("groupBy")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
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
]).annotate(
  $I.annote("mapMethods", {
    description: "Finite Map.prototype method names the interpreter may dispatch.",
  })
);

/**
 * One Map instance method name admitted by {@link mapMethods}.
 *
 * @see {@link mapMethods} for the runtime literal kit and membership guards.
 * @category type-level
 * @since 0.0.0
 */
export type MapMethod = typeof mapMethods.Type;

/**
 * Finite Map constructor names the interpreter may dispatch as statics.
 *
 * **Example** (Admit groupBy)
 *
 * ```ts
 * import { mapStatics } from "../../../codemode/Codemode.method-names.ts"
 *
 * console.log(mapStatics.is.groupBy("groupBy")) // true
 * console.log(mapStatics.is.groupBy("from")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const mapStatics = LiteralKit(["groupBy"]).annotate(
  $I.annote("mapStatics", {
    description: "Finite Map constructor names the interpreter may dispatch.",
  })
);

/**
 * One Map constructor name admitted by {@link mapStatics}.
 *
 * @see {@link mapStatics} for the runtime literal kit and membership guards.
 * @category type-level
 * @since 0.0.0
 */
export type MapStatic = typeof mapStatics.Type;

/**
 * Finite Set instance method names the interpreter may dispatch on guest sets.
 *
 * **Example** (Admit has)
 *
 * ```ts
 * import { setMethods } from "../../../codemode/Codemode.method-names.ts"
 *
 * console.log(setMethods.is.has("has")) // true
 * console.log(setMethods.is.has("get")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
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
]).annotate(
  $I.annote("setMethods", {
    description: "Finite Set.prototype method names the interpreter may dispatch.",
  })
);

/**
 * One Set instance method name admitted by {@link setMethods}.
 *
 * @see {@link setMethods} for the runtime literal kit and membership guards.
 * @category type-level
 * @since 0.0.0
 */
export type SetMethod = typeof setMethods.Type;

/**
 * Finite String instance method names the interpreter may dispatch on guest strings.
 *
 * **Example** (Admit includes)
 *
 * ```ts
 * import { stringMethods } from "../../../codemode/Codemode.method-names.ts"
 *
 * console.log(stringMethods.is.includes("includes")) // true
 * console.log(stringMethods.is.includes("fromCharCode")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
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
]).annotate(
  $I.annote("stringMethods", {
    description: "Finite String.prototype method names the interpreter may dispatch.",
  })
);

/**
 * One String instance method name admitted by {@link stringMethods}.
 *
 * @see {@link stringMethods} for the runtime literal kit and membership guards.
 * @category type-level
 * @since 0.0.0
 */
export type StringMethod = typeof stringMethods.Type;

/**
 * Finite String constructor names the interpreter may dispatch as statics.
 *
 * **Example** (Admit fromCodePoint)
 *
 * ```ts
 * import { stringStatics } from "../../../codemode/Codemode.method-names.ts"
 *
 * console.log(stringStatics.is.fromCodePoint("fromCodePoint")) // true
 * console.log(stringStatics.is.fromCodePoint("charAt")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const stringStatics = LiteralKit(["fromCharCode", "fromCodePoint"]).annotate(
  $I.annote("stringStatics", {
    description: "Finite String constructor names the interpreter may dispatch.",
  })
);

/**
 * One String constructor name admitted by {@link stringStatics}.
 *
 * @see {@link stringStatics} for the runtime literal kit and membership guards.
 * @category type-level
 * @since 0.0.0
 */
export type StringStatic = typeof stringStatics.Type;

/**
 * Finite Date setter names that mutate guest Date adapters.
 *
 * **Example** (Admit setHours)
 *
 * ```ts
 * import { DateSetterName } from "../../../codemode/Codemode.method-names.ts"
 *
 * console.log(DateSetterName.is.setHours("setHours")) // true
 * console.log(DateSetterName.is.setHours("getHours")) // false
 * ```
 *
 * @see {@link DateSetterArity} for maximum optional-argument counts of these setters.
 * @see {@link dateMethods} for the Date kit that includes these setters.
 * @category schemas
 * @since 0.0.0
 */
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
]).annotate(
  $I.annote("DateSetterName", {
    description: "Finite Date setter names that mutate guest Date adapters.",
  })
);

/**
 * One Date setter name admitted by {@link DateSetterName}.
 *
 * @see {@link DateSetterName} for the runtime literal kit and membership guards.
 * @category type-level
 * @since 0.0.0
 */
export type DateSetterName = typeof DateSetterName.Type;

/**
 * Maximum optional-argument counts for JavaScript Date setters.
 *
 * **Gotchas**
 *
 * Entries are maximum optional-argument counts, not required arities.
 * `setHours: 4` means hours plus optional minutes, seconds, and milliseconds.
 *
 * **Example** (Look up setHours vs setTime)
 *
 * ```ts
 * import { DateSetterArity } from "../../../codemode/Codemode.method-names.ts"
 *
 * console.log(DateSetterArity.setHours) // 4
 * console.log(DateSetterArity.setTime) // 1
 * ```
 *
 * @see {@link DateSetterName} for the setter names these counts describe.
 * @category constants
 * @since 0.0.0
 */
export const DateSetterArity = {
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
} as const satisfies Record<DateSetterName, 1 | 2 | 3 | 4>;

/**
 * Finite Date instance method names, including getters and mutating setters.
 *
 * **Gotchas**
 *
 * Setter names are included via {@link DateSetterName}.Options, so this kit is
 * not getters-only. Dispatch that mutates time must consult {@link DateSetterArity}.
 *
 * **Example** (Admit a getter and a setter)
 *
 * ```ts
 * import { dateMethods } from "../../../codemode/Codemode.method-names.ts"
 *
 * console.log(dateMethods.is.getTime("getTime")) // true
 * console.log(dateMethods.is.setHours("setHours")) // true
 * ```
 *
 * @see {@link DateSetterName} for the setter subset spread into this kit.
 * @category schemas
 * @since 0.0.0
 */
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
]).annotate(
  $I.annote("dateMethods", {
    description: "Finite Date.prototype method names, including mutating setters.",
  })
);

/**
 * One Date instance method name admitted by {@link dateMethods}.
 *
 * @see {@link dateMethods} for the runtime literal kit and membership guards.
 * @category type-level
 * @since 0.0.0
 */
export type DateMethod = typeof dateMethods.Type;

/**
 * Finite Date constructor names the interpreter may dispatch as statics.
 *
 * **Example** (Admit now)
 *
 * ```ts
 * import { dateStatics } from "../../../codemode/Codemode.method-names.ts"
 *
 * console.log(dateStatics.is.now("now")) // true
 * console.log(dateStatics.is.now("getTime")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const dateStatics = LiteralKit(["now", "parse", "UTC"]).annotate(
  $I.annote("dateStatics", {
    description: "Finite Date constructor names the interpreter may dispatch.",
  })
);

/**
 * One Date constructor name admitted by {@link dateStatics}.
 *
 * @see {@link dateStatics} for the runtime literal kit and membership guards.
 * @category type-level
 * @since 0.0.0
 */
export type DateStatic = typeof dateStatics.Type;

/**
 * Finite RegExp instance method names the interpreter may dispatch.
 *
 * **Example** (Admit test)
 *
 * ```ts
 * import { regexpMethods } from "../../../codemode/Codemode.method-names.ts"
 *
 * console.log(regexpMethods.is.test("test")) // true
 * console.log(regexpMethods.is.test("escape")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const regexpMethods = LiteralKit(["test", "exec", "toString"]).annotate(
  $I.annote("regexpMethods", {
    description: "Finite RegExp.prototype method names the interpreter may dispatch.",
  })
);

/**
 * One RegExp instance method name admitted by {@link regexpMethods}.
 *
 * @see {@link regexpMethods} for the runtime literal kit and membership guards.
 * @category type-level
 * @since 0.0.0
 */
export type RegExpMethod = typeof regexpMethods.Type;

/**
 * Finite RegExp constructor names the interpreter may dispatch as statics.
 *
 * **Example** (Admit escape)
 *
 * ```ts
 * import { regexpStatics } from "../../../codemode/Codemode.method-names.ts"
 *
 * console.log(regexpStatics.is.escape("escape")) // true
 * console.log(regexpStatics.is.escape("test")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const regexpStatics = LiteralKit(["escape"]).annotate(
  $I.annote("regexpStatics", {
    description: "Finite RegExp constructor names the interpreter may dispatch.",
  })
);

/**
 * One RegExp constructor name admitted by {@link regexpStatics}.
 *
 * @see {@link regexpStatics} for the runtime literal kit and membership guards.
 * @category type-level
 * @since 0.0.0
 */
export type RegExpStatic = typeof regexpStatics.Type;

/**
 * Finite Object constructor names the interpreter may dispatch as statics.
 *
 * **Example** (Admit keys)
 *
 * ```ts
 * import { objectStatics } from "../../../codemode/Codemode.method-names.ts"
 *
 * console.log(objectStatics.is.keys("keys")) // true
 * console.log(objectStatics.is.keys("assignOwn")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const objectStatics = LiteralKit([
  "keys",
  "values",
  "entries",
  "hasOwn",
  "is",
  "assign",
  "fromEntries",
  "groupBy",
]).annotate(
  $I.annote("objectStatics", {
    description: "Finite Object constructor names the interpreter may dispatch.",
  })
);

/**
 * One Object constructor name admitted by {@link objectStatics}.
 *
 * @see {@link objectStatics} for the runtime literal kit and membership guards.
 * @category type-level
 * @since 0.0.0
 */
export type ObjectStatic = typeof objectStatics.Type;

/**
 * Finite Number instance method names the interpreter may dispatch.
 *
 * **Example** (Admit toFixed)
 *
 * ```ts
 * import { numberMethods } from "../../../codemode/Codemode.method-names.ts"
 *
 * console.log(numberMethods.is.toFixed("toFixed")) // true
 * console.log(numberMethods.is.toFixed("isInteger")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const numberMethods = LiteralKit(["toFixed", "toPrecision", "toExponential", "toString", "valueOf"]).annotate(
  $I.annote("numberMethods", {
    description: "Finite Number.prototype method names the interpreter may dispatch.",
  })
);

/**
 * One Number instance method name admitted by {@link numberMethods}.
 *
 * @see {@link numberMethods} for the runtime literal kit and membership guards.
 * @category type-level
 * @since 0.0.0
 */
export type NumberMethod = typeof numberMethods.Type;

/**
 * Finite Number constructor names the interpreter may dispatch as statics.
 *
 * **Example** (Admit isInteger)
 *
 * ```ts
 * import { numberStatics } from "../../../codemode/Codemode.method-names.ts"
 *
 * console.log(numberStatics.is.isInteger("isInteger")) // true
 * console.log(numberStatics.is.isInteger("toFixed")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const numberStatics = LiteralKit([
  "isInteger",
  "isFinite",
  "isNaN",
  "isSafeInteger",
  "parseInt",
  "parseFloat",
]).annotate(
  $I.annote("numberStatics", {
    description: "Finite Number constructor names the interpreter may dispatch.",
  })
);

/**
 * One Number constructor name admitted by {@link numberStatics}.
 *
 * @see {@link numberStatics} for the runtime literal kit and membership guards.
 * @category type-level
 * @since 0.0.0
 */
export type NumberStatic = typeof numberStatics.Type;

/**
 * Finite Math function names the interpreter may dispatch.
 *
 * **Example** (Admit abs)
 *
 * ```ts
 * import { mathMethods } from "../../../codemode/Codemode.method-names.ts"
 *
 * console.log(mathMethods.is.abs("abs")) // true
 * console.log(mathMethods.is.abs("sum")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
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
]).annotate(
  $I.annote("mathMethods", {
    description: "Finite Math function names the interpreter may dispatch.",
  })
);

/**
 * One Math function name admitted by {@link mathMethods}.
 *
 * @see {@link mathMethods} for the runtime literal kit and membership guards.
 * @category type-level
 * @since 0.0.0
 */
export type MathMethod = typeof mathMethods.Type;

/**
 * Finite console method names captured into CodeMode logs.
 *
 * **Example** (Admit log)
 *
 * ```ts
 * import { ConsoleMethod } from "../../../codemode/Codemode.method-names.ts"
 *
 * console.log(ConsoleMethod.is.log("log")) // true
 * console.log(ConsoleMethod.is.log("trace")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ConsoleMethod = LiteralKit(["log", "info", "debug", "warn", "error", "dir", "table"]).annotate(
  $I.annote("ConsoleMethod", {
    description: "Finite console method names captured into CodeMode logs.",
  })
);

/**
 * One console method name admitted by {@link ConsoleMethod}.
 *
 * @see {@link ConsoleMethod} for the runtime literal kit and membership guards.
 * @category type-level
 * @since 0.0.0
 */
export type ConsoleMethod = typeof ConsoleMethod.Type;

/**
 * Finite URL instance method names the interpreter may dispatch.
 *
 * **Example** (Admit toString)
 *
 * ```ts
 * import { UrlMethod } from "../../../codemode/Codemode.method-names.ts"
 *
 * console.log(UrlMethod.is.toString("toString")) // true
 * console.log(UrlMethod.is.toString("canParse")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const UrlMethod = LiteralKit(["toString", "toJSON"]).annotate(
  $I.annote("UrlMethod", {
    description: "Finite URL.prototype method names the interpreter may dispatch.",
  })
);

/**
 * One URL instance method name admitted by {@link UrlMethod}.
 *
 * @see {@link UrlMethod} for the runtime literal kit and membership guards.
 * @category type-level
 * @since 0.0.0
 */
export type UrlMethod = typeof UrlMethod.Type;

/**
 * Finite URL constructor names the interpreter may dispatch as statics.
 *
 * **Example** (Admit canParse)
 *
 * ```ts
 * import { UrlStatic } from "../../../codemode/Codemode.method-names.ts"
 *
 * console.log(UrlStatic.is.canParse("canParse")) // true
 * console.log(UrlStatic.is.canParse("toJSON")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const UrlStatic = LiteralKit(["canParse", "parse"]).annotate(
  $I.annote("UrlStatic", {
    description: "Finite URL constructor names the interpreter may dispatch.",
  })
);

/**
 * One URL constructor name admitted by {@link UrlStatic}.
 *
 * @see {@link UrlStatic} for the runtime literal kit and membership guards.
 * @category type-level
 * @since 0.0.0
 */
export type UrlStatic = typeof UrlStatic.Type;

/**
 * Finite URLSearchParams instance method names the interpreter may dispatch.
 *
 * **Example** (Admit get)
 *
 * ```ts
 * import { UrlSearchParamsMethod } from "../../../codemode/Codemode.method-names.ts"
 *
 * console.log(UrlSearchParamsMethod.is.get("get")) // true
 * console.log(UrlSearchParamsMethod.is.get("canParse")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
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
]).annotate(
  $I.annote("UrlSearchParamsMethod", {
    description: "Finite URLSearchParams.prototype method names the interpreter may dispatch.",
  })
);

/**
 * One URLSearchParams instance method name admitted by {@link UrlSearchParamsMethod}.
 *
 * @see {@link UrlSearchParamsMethod} for the runtime literal kit and membership guards.
 * @category type-level
 * @since 0.0.0
 */
export type UrlSearchParamsMethod = typeof UrlSearchParamsMethod.Type;
