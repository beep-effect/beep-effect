import { $ScratchpadId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
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
 * Mutable JavaScript Date value represented by epoch milliseconds.
 *
 * @category runtime
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
 * Mutable JavaScript RegExp value.
 *
 * @category runtime
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
 * Mutable JavaScript Set value.
 *
 * @category runtime
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
 * Mutable JavaScript URLSearchParams value.
 *
 * @category runtime
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
 * Mutable JavaScript URL value.
 *
 * @category runtime
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
 * Values whose native mutation and identity semantics are part of the guest
 * JavaScript contract.
 *
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

/** Runtime type for {@link CodeModeValue}. */
export type CodeModeValue = typeof CodeModeValue.Type;

/** Guard for {@link CodeModeValue}. */
export const isCodeModeValue = CodeModeValue.is;
