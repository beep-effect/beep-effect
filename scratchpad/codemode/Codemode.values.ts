import { $ScratchpadId } from "@beep/identity";
import { Equal, Fiber } from "effect";
import * as S from "effect/Schema";
import type { InterpreterFailure } from "./interpreter/Interpreter.model.ts";

const $I = $ScratchpadId.create("codemode/Codemode.values");

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
 * Promise handle owned by one CodeMode execution.
 *
 * @category runtime
 * @since 0.0.0
 */
export class CodeModePromise extends S.Class<CodeModePromise>($I`CodeModePromise`)(
  { fiber: CodeModeFiber },
  $I.annote("CodeModePromise", {
    description: "Promise handle owned by one CodeMode execution.",
  })
) {
  static readonly new = (
    fiber: Fiber.Fiber<unknown, InterpreterFailure>
  ): CodeModePromise =>
    // Promise handles are mutable runtime identities. Effect hash collections
    // must not structurally traverse the Fiber stored inside them.
    Equal.byReferenceUnsafe(CodeModePromise.make({ fiber }));
}

/**
 * Mutable JavaScript Date value represented by epoch milliseconds.
 *
 * @category runtime
 * @since 0.0.0
 */
export class CodeModeDate extends S.Class<CodeModeDate>($I`CodeModeDate`)(
  // Invalid JavaScript dates carry NaN and must remain representable.
  // @effect-diagnostics-next-line schemaNumber:off
  { time: S.Number.pipe(S.mutableKey) },
  $I.annote("CodeModeDate", {
    description: "Mutable JavaScript Date value represented by epoch milliseconds.",
  })
) {
  static readonly new = (time: number): CodeModeDate => CodeModeDate.make({ time });
}

/**
 * Mutable JavaScript RegExp value.
 *
 * @category runtime
 * @since 0.0.0
 */
export class CodeModeRegExp extends S.Class<CodeModeRegExp>($I`CodeModeRegExp`)(
  { regex: NativeRegExp },
  $I.annote("CodeModeRegExp", {
    description: "Mutable JavaScript RegExp value.",
  })
) {
  static readonly new = (pattern: string, flags: string): CodeModeRegExp =>
    CodeModeRegExp.make({ regex: new RegExp(pattern, flags) });

  get lastIndex(): unknown {
    return Reflect.get(this.regex, "lastIndex");
  }

  set lastIndex(value: unknown) {
    Reflect.set(this.regex, "lastIndex", value);
  }
}

/**
 * Mutable JavaScript Map value.
 *
 * @category runtime
 * @since 0.0.0
 */
export class CodeModeMap extends S.Class<CodeModeMap>($I`CodeModeMap`)(
  { map: NativeMap },
  $I.annote("CodeModeMap", {
    description: "Mutable JavaScript Map value.",
  })
) {
  // crispen: native Map is the guest-language semantic adapter; a HashMap
  // cannot preserve object identity, SameValueZero, or live mutation.
  static readonly new = (): CodeModeMap => CodeModeMap.make({ map: new Map() });
}

/**
 * Mutable JavaScript Set value.
 *
 * @category runtime
 * @since 0.0.0
 */
export class CodeModeSet extends S.Class<CodeModeSet>($I`CodeModeSet`)(
  { set: NativeSet },
  $I.annote("CodeModeSet", {
    description: "Mutable JavaScript Set value.",
  })
) {
  // crispen: native Set is the guest-language semantic adapter; a HashSet
  // cannot preserve object identity, SameValueZero, or live mutation.
  static readonly new = (): CodeModeSet => CodeModeSet.make({ set: new Set() });
}

/**
 * Mutable JavaScript URLSearchParams value.
 *
 * @category runtime
 * @since 0.0.0
 */
export class CodeModeURLSearchParams extends S.Class<CodeModeURLSearchParams>($I`CodeModeURLSearchParams`)(
  { params: NativeURLSearchParams },
  $I.annote("CodeModeURLSearchParams", {
    description: "Mutable JavaScript URLSearchParams value.",
  })
) {
  static readonly new = (params: URLSearchParams): CodeModeURLSearchParams =>
    CodeModeURLSearchParams.make({ params });
}

/**
 * Mutable JavaScript URL value.
 *
 * @category runtime
 * @since 0.0.0
 */
export class CodeModeURL extends S.Class<CodeModeURL>($I`CodeModeURL`)(
  {
    searchParams: CodeModeURLSearchParams,
    url: NativeURL,
  },
  $I.annote("CodeModeURL", {
    description: "Mutable JavaScript URL value.",
  })
) {
  static readonly new = (url: URL): CodeModeURL =>
    CodeModeURL.make({
      searchParams: CodeModeURLSearchParams.new(url.searchParams),
      url,
    });
}

/**
 * Identifies values whose native mutation and identity semantics are part of
 * the guest JavaScript contract.
 *
 * @category guards
 * @since 0.0.0
 */
export const isCodeModeValue = (
  value: unknown
): value is CodeModeDate | CodeModeRegExp | CodeModeMap | CodeModeSet | CodeModeURL | CodeModeURLSearchParams =>
  S.is(CodeModeDate)(value) ||
  S.is(CodeModeRegExp)(value) ||
  S.is(CodeModeMap)(value) ||
  S.is(CodeModeSet)(value) ||
  S.is(CodeModeURL)(value) ||
  S.is(CodeModeURLSearchParams)(value);
