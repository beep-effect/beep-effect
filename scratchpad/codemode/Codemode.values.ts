/**
 * Guest JavaScript values whose mutation and identity are part of the
 * interpreter contract at the copyIn checkpoint boundary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import { SafeObject as SafeObjectSchema, type SafeObject } from "@beep/schema/SafeObject";
import { Equal, Fiber } from "effect";
import * as S from "effect/Schema";
import type { InterpreterFailure } from "./interpreter/Interpreter.model.ts";

const $I = $ScratchpadId.create("codemode/Codemode.values");

/**
 * Allocates the null-prototype data object used at guest-language boundaries.
 *
 * **Details**
 *
 * A null prototype prevents inherited host members from becoming observable
 * guest data. Centralizing the allocation keeps that security invariant
 * consistent across object literals, destructuring, JSON, RegExp groups,
 * Promise outcomes, and guest error values.
 *
 * **Example** (Allocate an inherited-member-free object)
 *
 * ```ts
 * import { makeEmptySafeObject } from "../../../codemode/Codemode.values.ts"
 *
 * const value = makeEmptySafeObject()
 * console.log(Object.getPrototypeOf(value) === null) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeEmptySafeObject = (): SafeObject => SafeObjectSchema.make(Object.create(null));

const CodeModeFiber = S.declare(
  (u: unknown): u is Fiber.Fiber<unknown, InterpreterFailure> => Fiber.isFiber(u)
).pipe(
  $I.annoteSchema("CodeModeFiber", {
    description: "Fiber backing one pending CodeMode promise.",
  })
);

const NativeRegExp = S.instanceOf(RegExp).pipe(
  $I.annoteSchema("NativeRegExp", {
    description: "Native regular expression carrying guest RegExp state.",
  })
);

const NativeMap = S.instanceOf(Map).pipe(
  $I.annoteSchema("NativeMap", {
    description: "Native map carrying guest Map state.",
  })
);

const NativeSet = S.instanceOf(Set).pipe(
  $I.annoteSchema("NativeSet", {
    description: "Native set carrying guest Set state.",
  })
);

const NativeURLSearchParams = S.instanceOf(URLSearchParams).pipe(
  $I.annoteSchema("NativeURLSearchParams", {
    description: "Native URL search parameters carrying guest URLSearchParams state.",
  })
);

const NativeURL = S.instanceOf(URL).pipe(
  $I.annoteSchema("NativeURL", {
    description: "Native URL carrying guest URL state.",
  })
);

/**
 * Promise handle owned by one CodeMode execution, identity-equal by reference.
 *
 * **Gotchas**
 *
 * {@link CodeModePromise.new} wraps the instance with `Equal.byReferenceUnsafe`
 * because Effect hash collections must not structurally traverse the stored
 * Fiber. This type is not a {@link CodeModeValue} member; un-awaited promises
 * are rejected at the copyIn boundary instead.
 *
 * **Example** (Wrap a forked fiber)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { CodeModePromise } from "../../../codemode/Codemode.values.ts"
 *
 * const promise = CodeModePromise.new(Effect.runFork(Effect.succeed("done")))
 *
 * console.log(CodeModePromise.is(promise)) // true
 * ```
 *
 * @see {@link isCodeModeValue} for the guest-value guard that excludes this handle.
 * @category models
 * @since 0.0.0
 */
export class CodeModePromise extends S.TaggedClass<CodeModePromise>($I`CodeModePromise`)("CodeModePromise",
  { fiber: CodeModeFiber },
  $I.annote("CodeModePromise", {
    description: "Promise handle owned by one CodeMode execution.",
  })
) {
  static readonly is = S.is(CodeModePromise);

  static readonly new = (
    fiber: Fiber.Fiber<unknown, InterpreterFailure>
  ): CodeModePromise =>
    // Promise handles are mutable runtime identities. Effect hash collections
    // must not structurally traverse the Fiber stored inside them.
    Equal.byReferenceUnsafe(CodeModePromise.make({ fiber }));
}

/**
 * Guest Date adapter that stores epoch milliseconds, including NaN invalid dates.
 *
 * **Gotchas**
 *
 * The `time` field is `S.Number` so an invalid JavaScript Date (`NaN`) stays
 * representable instead of being rejected by a finite-number schema.
 *
 * **Example** (Keep an invalid date observable)
 *
 * ```ts
 * import { CodeModeDate } from "../../../codemode/Codemode.values.ts"
 *
 * const date = CodeModeDate.new(Number.NaN)
 *
 * console.log(CodeModeDate.is(date)) // true
 * console.log(Number.isNaN(date.time)) // true
 * ```
 *
 * @see {@link CodeModeValue} for the tagged union that includes this adapter.
 * @category models
 * @since 0.0.0
 */
export class CodeModeDate extends S.TaggedClass<CodeModeDate>($I`CodeModeDate`)("CodeModeDate",
  // Invalid JavaScript dates carry NaN and must remain representable.
  // @effect-diagnostics-next-line schemaNumber:off
  { time: S.Number.pipe(S.mutableKey) },
  $I.annote("CodeModeDate", {
    description: "Mutable JavaScript Date value represented by epoch milliseconds.",
  })
) {
  static readonly is = S.is(CodeModeDate);

  static readonly new = (time: number): CodeModeDate => CodeModeDate.make({ time });
}

/**
 * Guest RegExp adapter backed by a native regular expression instance.
 *
 * **Example** (Construct a global regex)
 *
 * ```ts
 * import { CodeModeRegExp } from "../../../codemode/Codemode.values.ts"
 *
 * const regex = CodeModeRegExp.new("ab+", "g")
 *
 * console.log(CodeModeRegExp.is(regex)) // true
 * console.log(regex.regex.source) // "ab+"
 * ```
 *
 * @see {@link CodeModeValue} for the tagged union that includes this adapter.
 * @category models
 * @since 0.0.0
 */
export class CodeModeRegExp extends S.TaggedClass<CodeModeRegExp>($I`CodeModeRegExp`)("CodeModeRegExp",
  { regex: NativeRegExp },
  $I.annote("CodeModeRegExp", {
    description: "Mutable JavaScript RegExp value.",
  })
) {
  static readonly is = S.is(CodeModeRegExp);

  static readonly new = (pattern: string, flags: string): CodeModeRegExp =>
    CodeModeRegExp.make({ regex: new RegExp(pattern, flags) });

  /**
   * Last-index cursor of the wrapped native RegExp.
   *
   * **Example** (Read and write lastIndex)
   *
   * ```ts
   * import { CodeModeRegExp } from "../../../codemode/Codemode.values.ts"
   *
   * const regex = CodeModeRegExp.new("a", "g")
   * regex.lastIndex = 1
   *
   * console.log(regex.lastIndex) // 1
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  get lastIndex(): unknown {
    return Reflect.get(this.regex, "lastIndex");
  }

  set lastIndex(value: unknown) {
    Reflect.set(this.regex, "lastIndex", value);
  }
}

/**
 * Guest Map adapter backed by a native Map so object identity and live
 * mutation match JavaScript.
 *
 * **Gotchas**
 *
 * HashMap cannot preserve object identity, SameValueZero, or in-place
 * mutation, so the guest collection is a native `Map`.
 *
 * **Example** (Mutate a native-backed map)
 *
 * ```ts
 * import { CodeModeMap } from "../../../codemode/Codemode.values.ts"
 *
 * const map = CodeModeMap.new()
 * map.map.set("a", 1)
 *
 * console.log(CodeModeMap.is(map)) // true
 * console.log(map.map.size) // 1
 * ```
 *
 * @see {@link CodeModeValue} for the tagged union that includes this adapter.
 * @category models
 * @since 0.0.0
 */
export class CodeModeMap extends S.TaggedClass<CodeModeMap>($I`CodeModeMap`)("CodeModeMap",
  { map: NativeMap },
  $I.annote("CodeModeMap", {
    description: "Mutable JavaScript Map value.",
  })
) {
  static readonly is = S.is(CodeModeMap);

  // crispen: native Map is the guest-language semantic adapter; a HashMap
  // cannot preserve object identity, SameValueZero, or live mutation.
  static readonly new = (): CodeModeMap => CodeModeMap.make({ map: new Map() });
}

/**
 * Guest Set adapter backed by a native Set so object identity and live
 * mutation match JavaScript.
 *
 * **Gotchas**
 *
 * HashSet cannot preserve object identity, SameValueZero, or in-place
 * mutation, so the guest collection is a native `Set`.
 *
 * **Example** (Mutate a native-backed set)
 *
 * ```ts
 * import { CodeModeSet } from "../../../codemode/Codemode.values.ts"
 *
 * const set = CodeModeSet.new()
 * set.set.add("a")
 *
 * console.log(CodeModeSet.is(set)) // true
 * console.log(set.set.size) // 1
 * ```
 *
 * @see {@link CodeModeValue} for the tagged union that includes this adapter.
 * @category models
 * @since 0.0.0
 */
export class CodeModeSet extends S.TaggedClass<CodeModeSet>($I`CodeModeSet`)("CodeModeSet",
  { set: NativeSet },
  $I.annote("CodeModeSet", {
    description: "Mutable JavaScript Set value.",
  })
) {
  static readonly is = S.is(CodeModeSet);

  // crispen: native Set is the guest-language semantic adapter; a HashSet
  // cannot preserve object identity, SameValueZero, or live mutation.
  static readonly new = (): CodeModeSet => CodeModeSet.make({ set: new Set() });
}

/**
 * Guest URLSearchParams adapter wrapping a native search-parameter list.
 *
 * **Example** (Read a query parameter)
 *
 * ```ts
 * import { CodeModeURLSearchParams } from "../../../codemode/Codemode.values.ts"
 *
 * const params = CodeModeURLSearchParams.new(new URLSearchParams("q=1"))
 *
 * console.log(CodeModeURLSearchParams.is(params)) // true
 * console.log(params.params.get("q")) // "1"
 * ```
 *
 * @see {@link CodeModeURL} for the URL adapter that owns a search-params instance.
 * @see {@link CodeModeValue} for the tagged union that includes this adapter.
 * @category models
 * @since 0.0.0
 */
export class CodeModeURLSearchParams extends S.TaggedClass<CodeModeURLSearchParams>($I`CodeModeURLSearchParams`)("CodeModeURLSearchParams",
  { params: NativeURLSearchParams },
  $I.annote("CodeModeURLSearchParams", {
    description: "Mutable JavaScript URLSearchParams value.",
  })
) {
  static readonly is = S.is(CodeModeURLSearchParams);

  static readonly new = (params: URLSearchParams): CodeModeURLSearchParams =>
    CodeModeURLSearchParams.make({ params });
}

/**
 * Guest URL adapter wrapping a native URL and its live searchParams object.
 *
 * **Example** (Read href from a wrapped URL)
 *
 * ```ts
 * import { CodeModeURL } from "../../../codemode/Codemode.values.ts"
 *
 * const url = CodeModeURL.new(new URL("https://example.com/path"))
 *
 * console.log(CodeModeURL.is(url)) // true
 * console.log(url.url.href) // "https://example.com/path"
 * ```
 *
 * @see {@link CodeModeURLSearchParams} for the search-params adapter stored on `searchParams`.
 * @see {@link CodeModeValue} for the tagged union that includes this adapter.
 * @category models
 * @since 0.0.0
 */
export class CodeModeURL extends S.TaggedClass<CodeModeURL>($I`CodeModeURL`)("CodeModeURL",
  {
    searchParams: CodeModeURLSearchParams,
    url: NativeURL,
  },
  $I.annote("CodeModeURL", {
    description: "Mutable JavaScript URL value.",
  })
) {
  static readonly is = S.is(CodeModeURL);

  static readonly new = (url: URL): CodeModeURL =>
    CodeModeURL.make({
      searchParams: CodeModeURLSearchParams.new(url.searchParams),
      url,
    });
}

/**
 * Tagged union of guest values whose native mutation and identity semantics
 * are part of the JavaScript contract.
 *
 * **Gotchas**
 *
 * Members are Date, RegExp, Map, Set, URL, and URLSearchParams.
 * {@link CodeModePromise} is excluded; un-awaited promises fail at copyIn.
 *
 * **Example** (Match a tagged Date member)
 *
 * ```ts
 * import { CodeModeDate, CodeModeValue } from "../../../codemode/Codemode.values.ts"
 *
 * const date = CodeModeDate.new(0)
 *
 * console.log(CodeModeValue.is(date)) // true
 * console.log(date._tag) // "CodeModeDate"
 * ```
 *
 * @see {@link isCodeModeValue} for the exported type guard over this union.
 * @see {@link CodeModePromise} for the promise handle excluded from this union.
 * @category models
 * @since 0.0.0
 */
export const CodeModeValue = S.Union([
  CodeModeDate,
  CodeModeRegExp,
  CodeModeMap,
  CodeModeSet,
  CodeModeURL,
  CodeModeURLSearchParams,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("CodeModeValue", {
    description: "Mutable guest values backed by native JavaScript state.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Decoded guest-value member produced by {@link CodeModeValue}.
 *
 * @see {@link CodeModeValue} for the runtime tagged union and membership guard.
 * @category type-level
 * @since 0.0.0
 */
export type CodeModeValue = typeof CodeModeValue.Type;

/**
 * Type guard for {@link CodeModeValue} guest adapters.
 *
 * **Example** (Date is a guest value; a promise handle is not)
 *
 * ```ts
 * import { Effect } from "effect"
 * import {
 *   CodeModeDate,
 *   CodeModePromise,
 *   isCodeModeValue,
 * } from "../../../codemode/Codemode.values.ts"
 *
 * console.log(isCodeModeValue(CodeModeDate.new(0))) // true
 * console.log(isCodeModeValue(CodeModePromise.new(Effect.runFork(Effect.succeed("done"))))) // false
 * ```
 *
 * @see {@link CodeModePromise} for the handle this guard deliberately excludes.
 * @category predicates
 * @since 0.0.0
 */
export const isCodeModeValue = CodeModeValue.is;
