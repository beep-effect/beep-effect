/**
 * Semantic projections for the HTML script type algorithm, MIME author
 * conformance, and contextual script attributes.
 *
 * @packageDocumentation \@beep/html/Html.script
 * @since 0.0.0
 */

import { $HtmlId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import { flow, Match, pipe, Result } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { toAsciiLowerCase } from "./Html.foreign.ts";
import type { Script } from "./Html.model.ts";

const $I = $HtmlId.create("Html.script");

const htmlMimeTypePattern =
  /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+\/[!#$%&'*+\-.^_`|~0-9A-Za-z]+(?:[\t ]*;[\t ]*[!#$%&'*+\-.^_`|~0-9A-Za-z]+=(?:[!#$%&'*+\-.^_`|~0-9A-Za-z]+|"(?:[\t\u0020-\u0021\u0023-\u005b\u005d-\u007e\u0080-\u00ff]|\\[\t\u0020-\u007e\u0080-\u00ff])*"))*$/u;

/**
 * Author-valid MIME type string used by HTML attribute conformance checks.
 *
 * **Example** (Decode a MIME type)
 *
 * ```ts import.meta.vitest name="Decode a MIME type"
 * import { HtmlMimeType } from "@beep/html"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * Result.isSuccess(S.decodeResult(HtmlMimeType)("application/json")) // => true
 * ```
 *
 * @invariant Values match the MIME Sniffing valid MIME type string grammar used for author conformance.
 * @see {@link https://mimesniff.spec.whatwg.org/#valid-mime-type} for the normative valid MIME type string definition.
 * @category schemas
 * @since 0.0.0
 */
export const HtmlMimeType = S.String.check(
  S.isPattern(htmlMimeTypePattern, {
    identifier: $I`HtmlMimeTypePatternCheck`,
    title: "HTML MIME type string",
    description: "A string matching the author-conformance grammar for valid MIME type strings.",
    message: "Expected a valid MIME type string",
  })
).pipe(
  S.brand("HtmlMimeType"),
  $I.annoteSchema("HtmlMimeType", {
    description: "Author-valid MIME type string used by HTML attribute conformance checks.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Branded runtime MIME type represented by {@link HtmlMimeType}.
 *
 * @see {@link HtmlMimeType} for the schema decoder and author-conformance grammar.
 * @category type-level
 * @since 0.0.0
 */
export type HtmlMimeType = typeof HtmlMimeType.Type;

/**
 * Exact MIME essence strings treated as classic JavaScript by `script[type]`.
 *
 * **Example** (Recognize a legacy JavaScript essence)
 *
 * ```ts import.meta.vitest name="Recognize a legacy JavaScript essence"
 * import { JavaScriptMimeTypeEssence } from "@beep/html"
 * import * as S from "effect/Schema"
 *
 * S.is(JavaScriptMimeTypeEssence)("text/javascript1.5") // => true
 * ```
 *
 * @invariant The literal set is exactly the JavaScript MIME type essence list from MIME Sniffing.
 * @see {@link https://mimesniff.spec.whatwg.org/#javascript-mime-type} for the normative essence-string registry.
 * @category models
 * @since 0.0.0
 */
export const JavaScriptMimeTypeEssence = LiteralKit([
  "application/ecmascript",
  "application/javascript",
  "application/x-ecmascript",
  "application/x-javascript",
  "text/ecmascript",
  "text/javascript",
  "text/javascript1.0",
  "text/javascript1.1",
  "text/javascript1.2",
  "text/javascript1.3",
  "text/javascript1.4",
  "text/javascript1.5",
  "text/jscript",
  "text/livescript",
  "text/x-ecmascript",
  "text/x-javascript",
]).pipe(
  $I.annoteSchema("JavaScriptMimeTypeEssence", {
    description: "Exact JavaScript MIME type essence strings recognized by the HTML script type algorithm.",
  })
);

/**
 * Runtime JavaScript MIME essence represented by {@link JavaScriptMimeTypeEssence}.
 *
 * @see {@link JavaScriptMimeTypeEssence} for the exact standard literal registry.
 * @category type-level
 * @since 0.0.0
 */
export type JavaScriptMimeTypeEssence = typeof JavaScriptMimeTypeEssence.Type;

const isJavaScriptMimeTypeEssence = S.is(JavaScriptMimeTypeEssence);
const isJavaScriptMimeTypeEssenceMatch = flow(toAsciiLowerCase, isJavaScriptMimeTypeEssence);

/**
 * Valid MIME string that is not a JavaScript essence match, carried by a
 * script data-block state.
 *
 * **Example** (Decode a script data-block MIME type)
 *
 * ```ts import.meta.vitest name="Decode a script data-block MIME type"
 * import { ScriptDataBlockMimeType } from "@beep/html"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * Result.isSuccess(S.decodeResult(ScriptDataBlockMimeType)("application/ld+json")) // => true
 * ```
 *
 * @invariant Values are valid MIME strings and are not JavaScript MIME type essence matches.
 * @see {@link https://html.spec.whatwg.org/multipage/scripting.html#attr-script-type} for the data-block authoring constraint.
 * @category schemas
 * @since 0.0.0
 */
export const ScriptDataBlockMimeType = HtmlMimeType.check(
  S.makeFilter(P.not(isJavaScriptMimeTypeEssenceMatch), {
    identifier: $I`ScriptDataBlockMimeTypeNotJavaScriptCheck`,
    title: "Script data-block MIME type",
    description: "A valid MIME type string that is not a JavaScript MIME type essence match.",
    message: "Script data blocks require a valid MIME string that is not a JavaScript essence match",
  })
).pipe(
  S.brand("ScriptDataBlockMimeType"),
  $I.annoteSchema("ScriptDataBlockMimeType", {
    description: "Author-valid MIME string that is not a JavaScript essence match, carried by a script data block.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Branded data-block MIME type represented by {@link ScriptDataBlockMimeType}.
 *
 * @see {@link ScriptDataBlockMimeType} for MIME validation and JavaScript exclusion.
 * @category type-level
 * @since 0.0.0
 */
export type ScriptDataBlockMimeType = typeof ScriptDataBlockMimeType.Type;

const ScriptStateName = LiteralKit(["classic", "module", "importMap", "speculationRules", "dataBlock"]).pipe(
  $I.annoteSchema("ScriptStateName", {
    description: "Author-conforming semantic states of the HTML script type attribute.",
  })
);

/**
 * Author-conforming semantic projection of the HTML script type algorithm.
 *
 * **Details**
 *
 * This additive view leaves {@link Script} and its open string `type` wire
 * untouched. The `dataBlock` member alone carries a MIME payload, and that
 * payload is schema-refined to a valid MIME string that is not itself a
 * JavaScript MIME type essence match.
 *
 * **Example** (Construct a module script state)
 *
 * ```ts import.meta.vitest name="Construct a module script state"
 * import { ScriptState } from "@beep/html"
 *
 * const state = ScriptState.cases.module.make({})
 * state.state // => "module"
 * ```
 *
 * @invariant The union contains classic, module, import-map, speculation-rules, and valid data-block states only.
 * @see {@link https://html.spec.whatwg.org/multipage/scripting.html#attr-script-type} for the normative script type algorithm.
 * @category models
 * @since 0.0.0
 */
export const ScriptState = ScriptStateName.toTaggedUnion("state")({
  classic: {},
  module: {},
  importMap: {},
  speculationRules: {},
  dataBlock: {
    mimeType: ScriptDataBlockMimeType.annotateKey({
      description: "Validated MIME string that is not a JavaScript essence match and denotes the data block.",
    }),
  },
}).pipe(
  $I.annoteSchema("ScriptState", {
    description: "Tagged semantic projection of the author-conforming HTML script type algorithm.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime script-state projection represented by {@link ScriptState}.
 *
 * @see {@link ScriptState} for correlated cases, guards, and exhaustive matching.
 * @category type-level
 * @since 0.0.0
 */
export type ScriptState = typeof ScriptState.Type;

/**
 * Invalid non-special `script[type]` value rejected at the semantic boundary.
 *
 * **Example** (Construct an invalid script type error)
 *
 * ```ts import.meta.vitest name="Construct an invalid script type error"
 * import { InvalidScriptType } from "@beep/html"
 *
 * const error = InvalidScriptType.make({ value: "beep" })
 * error._tag // => "InvalidScriptType"
 * ```
 *
 * @see {@link resolveScriptState} for the non-throwing typed resolver boundary.
 * @category errors
 * @since 0.0.0
 */
export class InvalidScriptType extends S.TaggedError<InvalidScriptType>($I`InvalidScriptType`)(
  "InvalidScriptType",
  {
    value: S.String,
  },
  $I.annoteError<InvalidScriptType>("InvalidScriptType", {
    description: "A script type string that is neither special nor an author-valid data-block MIME type.",
  })
) {}

const decodeScriptDataBlockMimeType = S.decodeResult(ScriptDataBlockMimeType);

const resolveExplicitScriptType = (value: string): Result.Result<ScriptState, InvalidScriptType> =>
  Match.value(toAsciiLowerCase(value)).pipe(
    Match.when(Str.isEmpty, () => Result.succeed(ScriptState.cases.classic.make({}))),
    Match.when(isJavaScriptMimeTypeEssence, () => Result.succeed(ScriptState.cases.classic.make({}))),
    Match.when("module", () => Result.succeed(ScriptState.cases.module.make({}))),
    Match.when("importmap", () => Result.succeed(ScriptState.cases.importMap.make({}))),
    Match.when("speculationrules", () => Result.succeed(ScriptState.cases.speculationRules.make({}))),
    Match.orElse(() =>
      pipe(
        decodeScriptDataBlockMimeType(value),
        Result.map((mimeType) => ScriptState.cases.dataBlock.make({ mimeType })),
        Result.mapError(() => InvalidScriptType.make({ value }))
      )
    )
  );

/**
 * Resolves a script node to an author-conforming semantic state without throwing.
 *
 * **Details**
 *
 * Missing and empty types resolve to `classic`. JavaScript MIME essence strings
 * are matched ASCII-case-insensitively against the exact standard registry.
 * Special keywords are also ASCII-case-insensitive. Every other string must
 * decode as a valid MIME string that is not a JavaScript essence match or
 * returns {@link InvalidScriptType}.
 *
 * **Example** (Resolve a missing script type)
 *
 * ```ts import.meta.vitest name="Resolve a missing script type"
 * import { resolveScriptState } from "@beep/html"
 * import { Script } from "@beep/html/Html.model"
 * import { Result } from "effect"
 *
 * const result = resolveScriptState(Script.make({ content: "" }))
 * Result.isSuccess(result) && result.success.state === "classic" // => true
 * ```
 *
 * @returns A successful semantic state or a typed invalid-author-value error.
 * @invariant Resolution never rewrites the source Script node or invents an unsupported standards state.
 * @see {@link https://html.spec.whatwg.org/multipage/scripting.html#attr-script-type} for the normative classification order.
 * @category normalization
 * @since 0.0.0
 */
export const resolveScriptState = (script: Script.Type): Result.Result<ScriptState, InvalidScriptType> =>
  pipe(
    script.type,
    O.match({
      onNone: () => Result.succeed(ScriptState.cases.classic.make({})),
      onSome: resolveExplicitScriptType,
    })
  );
