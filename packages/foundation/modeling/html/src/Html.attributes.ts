/**
 * Hand-authored global-attribute overlay for the generated HTML AST.
 *
 * `GlobalAttributes` is the shared field bundle spread into every element class
 * in `Html.model.ts`. It is value-typed from the WHATWG/webref enumerations
 * (see `data/`), and composed from three documented sub-bundles:
 *
 * - {@link StandardGlobalAttributes} — the spec's global attributes
 *   (`dom.html#global-attributes`), e.g. `id`, `class`, `dir`, `tabindex`.
 * - {@link AriaAttributes} — `role` plus the WAI-ARIA `aria-*` state/property set.
 * - {@link EventHandlerAttributes} — the global event-handler content attributes
 *   (`on*`).
 *
 * `data-*` attributes are open-ended and modeled as the `dataset` record bag
 * (mirroring the DOM `HTMLElement.dataset` API) rather than enumerated keys.
 *
 * @packageDocumentation \@beep/html/Html.attributes
 * @since 0.0.0
 */
import { $HtmlId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as Struct from "@beep/utils/Struct";
import { Effect, flow, pipe, SchemaIssue, SchemaTransformation, Tuple } from "effect";
import * as A from "effect/Array";
import { identity } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { toAsciiLowerCase } from "./internal/Html.ascii.ts";
import { readonlyStruct } from "./internal/Html.readonly.ts";

const $I = $HtmlId.create("Html.attributes");

class HtmlAttributeDomainError extends S.TaggedError<HtmlAttributeDomainError>($I`HtmlAttributeDomainError`)(
  "HtmlAttributeDomainError",
  { message: S.String },
  $I.annoteError<HtmlAttributeDomainError>("HtmlAttributeDomainError", {
    description: "Invalid fixed registry supplied to an HTML attribute schema factory.",
  })
) {}

const assertAsciiFoldUnique = (values: ReadonlyArray<string>, label: string, allowEmpty: boolean): void => {
  const folded = A.map(values, toAsciiLowerCase);
  if ((!allowEmpty && A.some(values, Str.isEmpty)) || A.length(A.dedupe(folded)) !== values.length) {
    throw HtmlAttributeDomainError.make({
      message: `${label} requires unique ASCII-case-folded${allowEmpty ? "" : " non-empty"} values`,
    });
  }
};

/**
 * Builds a canonical codec for an HTML enumerated attribute.
 *
 * **Details**
 *
 * Encoded keywords are matched ASCII-case-insensitively, as required by the
 * HTML enumerated-attribute microsyntax. Decoded values use the supplied
 * canonical spelling, and direct construction accepts only that fixed point.
 * Attributes whose case distinguishes meaning, such as `ol[type]`, must use a
 * literal schema instead because they are not HTML enumerated attributes.
 *
 * **Example** (Validate with `makeAsciiCaseInsensitiveEnumerated`)
 *
 * ```ts
 * import { makeAsciiCaseInsensitiveEnumerated } from "@beep/html/Html.attributes"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const Loading = makeAsciiCaseInsensitiveEnumerated(["eager", "lazy"])
 * const decoded = S.decodeUnknownResult(Loading)("LAZY")
 * if (Result.isSuccess(decoded)) console.log(decoded.success) // "lazy"
 * ```
 *
 * @category factories
 * @since 0.0.0
 */
export const makeAsciiCaseInsensitiveEnumerated = <const Values extends readonly [string, ...ReadonlyArray<string>]>(
  values: Values
) => {
  assertAsciiFoldUnique(values, "ASCII-case-insensitive enumerated attribute", true);
  const Canonical = LiteralKit(values);
  const findCanonical = (value: string) =>
    A.findFirst(values, (candidate) => toAsciiLowerCase(candidate) === toAsciiLowerCase(value));
  const Input = S.String.check(
    S.makeFilter(flow(findCanonical, O.isSome), {
      identifier: $I`AsciiCaseInsensitiveEnumeratedCheck`,
      title: "ASCII Case-Insensitive HTML Enumerated Attribute",
      description: "Checks a keyword against an explicit HTML enumerated-attribute domain.",
      message: "Expected a permitted HTML enumerated-attribute keyword",
    })
  );

  return Input.pipe(
    S.decodeTo(
      Canonical,
      SchemaTransformation.transformOrFail({
        decode: flow(
          findCanonical,
          O.match({
            onNone: () =>
              Effect.fail(
                new SchemaIssue.InvalidValue({
                  message: "Expected a permitted HTML enumerated-attribute keyword",
                })
              ),
            onSome: Effect.succeed,
          })
        ),
        encode: Effect.succeed,
      })
    ),
    SchemaUtils.withLiteralKitStatics(Canonical)
  );
};

// -----------------------------------------------------------------------------
// reusable enumerated value schemas (sourced from webref html-global attr-values)
// -----------------------------------------------------------------------------

/**
 * `dir` global attribute value.
 *
 * **Example** (Validate with `Dir`)
 *
 * ```ts
 * import { Dir } from "@beep/html/Html.attributes"
 *
 * console.log(Dir.is.ltr("ltr")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Dir = makeAsciiCaseInsensitiveEnumerated(["ltr", "rtl", "auto"]).pipe(
  $I.annoteSchema("Dir", { description: "Text directionality." })
);
/**
 * Decoded type of {@link Dir}.
 *
 * **Example** (Annotate a `Dir` value)
 *
 * ```ts
 * import type { Dir } from "@beep/html/Html.attributes"
 *
 * const dir: Dir = "ltr"
 * console.log(dir)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export type Dir = typeof Dir.Type;
const TranslateBase = LiteralKit(["yes", "no"]);
const TranslateInput = makeAsciiCaseInsensitiveEnumerated(["", ...TranslateBase.Options]);

/**
 * `translate` global attribute value.
 *
 * **Example** (Validate with `Translate`)
 *
 * ```ts
 * import { Translate } from "@beep/html/Html.attributes"
 *
 * console.log(Translate.is.yes("yes")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Translate = TranslateInput.pipe(
  S.decodeTo(
    TranslateBase,
    SchemaTransformation.transform({
      decode: (value) => (Str.isEmpty(value) ? "yes" : value),
      encode: identity,
    })
  ),
  SchemaUtils.withLiteralKitStatics(TranslateBase),
  $I.annoteSchema("Translate", { description: "Whether to translate the element's contents." })
);
/**
 * Decoded type of {@link Translate}.
 *
 * **Example** (Annotate a `Translate` value)
 *
 * ```ts
 * import type { Translate } from "@beep/html/Html.attributes"
 *
 * const translate: Translate = "yes"
 * console.log(translate)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export type Translate = typeof Translate.Type;
const ContentEditableBase = LiteralKit(["true", "false", "plaintext-only"]);
const ContentEditableInput = makeAsciiCaseInsensitiveEnumerated(["", ...ContentEditableBase.Options]);

/**
 * `contenteditable` global attribute value.
 *
 * **Example** (Validate with `ContentEditable`)
 *
 * ```ts
 * import { ContentEditable } from "@beep/html/Html.attributes"
 *
 * console.log(ContentEditable.is.true("true")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ContentEditable = ContentEditableInput.pipe(
  S.decodeTo(
    ContentEditableBase,
    SchemaTransformation.transform({
      decode: (value) => (Str.isEmpty(value) ? "true" : value),
      encode: identity,
    })
  ),
  SchemaUtils.withLiteralKitStatics(ContentEditableBase),
  $I.annoteSchema("ContentEditable", { description: "Whether the element is editable." })
);
/**
 * Decoded type of {@link ContentEditable}.
 *
 * **Example** (Annotate a `ContentEditable` value)
 *
 * ```ts
 * import type { ContentEditable } from "@beep/html/Html.attributes"
 *
 * const contentEditable: ContentEditable = "true"
 * console.log(contentEditable)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export type ContentEditable = typeof ContentEditable.Type;
/**
 * `draggable` global attribute value.
 *
 * **Example** (Validate with `Draggable`)
 *
 * ```ts
 * import { Draggable } from "@beep/html/Html.attributes"
 *
 * console.log(Draggable.is.true("true")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Draggable = makeAsciiCaseInsensitiveEnumerated(["true", "false"]).pipe(
  $I.annoteSchema("Draggable", { description: "Whether the element is draggable." })
);
/**
 * Decoded type of {@link Draggable}.
 *
 * **Example** (Annotate a `Draggable` value)
 *
 * ```ts
 * import type { Draggable } from "@beep/html/Html.attributes"
 *
 * const draggable: Draggable = "true"
 * console.log(draggable)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export type Draggable = typeof Draggable.Type;
const SpellCheckBase = LiteralKit(["true", "false"]);
const SpellCheckInput = makeAsciiCaseInsensitiveEnumerated(["", ...SpellCheckBase.Options]);

/**
 * `spellcheck` global attribute value.
 *
 * **Example** (Validate with `SpellCheck`)
 *
 * ```ts
 * import { SpellCheck } from "@beep/html/Html.attributes"
 *
 * console.log(SpellCheck.is.true("true")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SpellCheck = SpellCheckInput.pipe(
  S.decodeTo(
    SpellCheckBase,
    SchemaTransformation.transform({
      decode: (value) => (Str.isEmpty(value) ? "true" : value),
      encode: identity,
    })
  ),
  SchemaUtils.withLiteralKitStatics(SpellCheckBase),
  $I.annoteSchema("SpellCheck", { description: "Whether spellchecking is enabled." })
);
/**
 * Decoded type of {@link SpellCheck}.
 *
 * **Example** (Annotate a `SpellCheck` value)
 *
 * ```ts
 * import type { SpellCheck } from "@beep/html/Html.attributes"
 *
 * const spellCheck: SpellCheck = "true"
 * console.log(spellCheck)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export type SpellCheck = typeof SpellCheck.Type;
const WritingSuggestionsBase = LiteralKit(["true", "false"]);
const WritingSuggestionsInput = makeAsciiCaseInsensitiveEnumerated(["", ...WritingSuggestionsBase.Options]);

/**
 * `writingsuggestions` global attribute value.
 *
 * **Example** (Validate with `WritingSuggestions`)
 *
 * ```ts
 * import { WritingSuggestions } from "@beep/html/Html.attributes"
 *
 * console.log(WritingSuggestions.is.true("true")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const WritingSuggestions = WritingSuggestionsInput.pipe(
  S.decodeTo(
    WritingSuggestionsBase,
    SchemaTransformation.transform({
      decode: (value) => (Str.isEmpty(value) ? "true" : value),
      encode: identity,
    })
  ),
  SchemaUtils.withLiteralKitStatics(WritingSuggestionsBase),
  $I.annoteSchema("WritingSuggestions", { description: "Whether writing suggestions are enabled." })
);
/**
 * Decoded type of {@link WritingSuggestions}.
 *
 * **Example** (Annotate a `WritingSuggestions` value)
 *
 * ```ts
 * import type { WritingSuggestions } from "@beep/html/Html.attributes"
 *
 * const writingSuggestions: WritingSuggestions = "true"
 * console.log(writingSuggestions)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export type WritingSuggestions = typeof WritingSuggestions.Type;
/**
 * `autocapitalize` global attribute value.
 *
 * **Example** (Validate with `AutoCapitalize`)
 *
 * ```ts
 * import { AutoCapitalize } from "@beep/html/Html.attributes"
 *
 * console.log(AutoCapitalize.is.off("off")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AutoCapitalize = makeAsciiCaseInsensitiveEnumerated([
  "off",
  "none",
  "on",
  "sentences",
  "words",
  "characters",
]).pipe($I.annoteSchema("AutoCapitalize", { description: "Autocapitalization behavior." }));
/**
 * Decoded type of {@link AutoCapitalize}.
 *
 * **Example** (Annotate a `AutoCapitalize` value)
 *
 * ```ts
 * import type { AutoCapitalize } from "@beep/html/Html.attributes"
 *
 * const autoCapitalize: AutoCapitalize = "off"
 * console.log(autoCapitalize)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export type AutoCapitalize = typeof AutoCapitalize.Type;
const AutoCorrectBase = LiteralKit(["on", "off"]);
const AutoCorrectInput = makeAsciiCaseInsensitiveEnumerated(["", ...AutoCorrectBase.Options]);

/**
 * `autocorrect` global attribute value.
 *
 * **Example** (Validate with `AutoCorrect`)
 *
 * ```ts
 * import { AutoCorrect } from "@beep/html/Html.attributes"
 *
 * console.log(AutoCorrect.is.on("on")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AutoCorrect = AutoCorrectInput.pipe(
  S.decodeTo(
    AutoCorrectBase,
    SchemaTransformation.transform({
      decode: (value) => (Str.isEmpty(value) ? "on" : value),
      encode: identity,
    })
  ),
  SchemaUtils.withLiteralKitStatics(AutoCorrectBase),
  $I.annoteSchema("AutoCorrect", { description: "Autocorrection behavior." })
);
/**
 * Decoded type of {@link AutoCorrect}.
 *
 * **Example** (Annotate a `AutoCorrect` value)
 *
 * ```ts
 * import type { AutoCorrect } from "@beep/html/Html.attributes"
 *
 * const autoCorrect: AutoCorrect = "on"
 * console.log(autoCorrect)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export type AutoCorrect = typeof AutoCorrect.Type;
/**
 * `inputmode` global attribute value.
 *
 * **Example** (Validate with `InputMode`)
 *
 * ```ts
 * import { InputMode } from "@beep/html/Html.attributes"
 *
 * console.log(InputMode.is.text("text")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const InputMode = makeAsciiCaseInsensitiveEnumerated([
  "none",
  "text",
  "tel",
  "url",
  "email",
  "numeric",
  "decimal",
  "search",
]).pipe($I.annoteSchema("InputMode", { description: "Virtual keyboard input mode hint." }));
/**
 * Decoded type of {@link InputMode}.
 *
 * **Example** (Annotate a `InputMode` value)
 *
 * ```ts
 * import type { InputMode } from "@beep/html/Html.attributes"
 *
 * const inputMode: InputMode = "text"
 * console.log(inputMode)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export type InputMode = typeof InputMode.Type;
/**
 * `enterkeyhint` global attribute value.
 *
 * **Example** (Validate with `EnterKeyHint`)
 *
 * ```ts
 * import { EnterKeyHint } from "@beep/html/Html.attributes"
 *
 * console.log(EnterKeyHint.is.enter("enter")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EnterKeyHint = makeAsciiCaseInsensitiveEnumerated([
  "enter",
  "done",
  "go",
  "next",
  "previous",
  "search",
  "send",
]).pipe($I.annoteSchema("EnterKeyHint", { description: "Enter-key action hint." }));
/**
 * Decoded type of {@link EnterKeyHint}.
 *
 * **Example** (Annotate a `EnterKeyHint` value)
 *
 * ```ts
 * import type { EnterKeyHint } from "@beep/html/Html.attributes"
 *
 * const enterKeyHint: EnterKeyHint = "enter"
 * console.log(enterKeyHint)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export type EnterKeyHint = typeof EnterKeyHint.Type;
const HiddenBase = LiteralKit(["hidden", "until-found"]);
const HiddenInput = makeAsciiCaseInsensitiveEnumerated(["", ...HiddenBase.Options]);

/**
 * `hidden` global attribute value.
 *
 * **Example** (Validate with `Hidden`)
 *
 * ```ts
 * import { Hidden } from "@beep/html/Html.attributes"
 *
 * console.log(Hidden.is.hidden("hidden")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Hidden = HiddenInput.pipe(
  S.decodeTo(
    HiddenBase,
    SchemaTransformation.transform({
      decode: (value) => (Str.isEmpty(value) ? HiddenInput.Enum.hidden : value),
      encode: identity,
    })
  ),
  SchemaUtils.withLiteralKitStatics(HiddenBase),
  $I.annoteSchema("Hidden", { description: "Hidden state of the element." })
);
/**
 * Decoded type of {@link Hidden}.
 *
 * **Example** (Annotate a `Hidden` value)
 *
 * ```ts
 * import type { Hidden } from "@beep/html/Html.attributes"
 *
 * const hidden: Hidden = "hidden"
 * console.log(hidden)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export type Hidden = typeof Hidden.Type;
const PopoverBase = LiteralKit(["auto", "manual", "hint"]);
const PopoverInput = makeAsciiCaseInsensitiveEnumerated(["", ...PopoverBase.Options]);

/**
 * `popover` global attribute value.
 *
 * **Example** (Validate with `Popover`)
 *
 * ```ts
 * import { Popover } from "@beep/html/Html.attributes"
 *
 * console.log(Popover.is.auto("auto")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Popover = PopoverInput.pipe(
  S.decodeTo(
    PopoverBase,
    SchemaTransformation.transform({
      decode: (value) => (Str.isEmpty(value) ? PopoverInput.Enum.auto : value),
      encode: identity,
    })
  ),
  $I.annoteSchema("Popover", { description: "Popover behavior." }),
  SchemaUtils.withLiteralKitStatics(PopoverBase)
);
/**
 * Decoded type of {@link Popover}.
 *
 * **Example** (Annotate a `Popover` value)
 *
 * ```ts
 * import type { Popover } from "@beep/html/Html.attributes"
 *
 * const popover: Popover = "auto"
 * console.log(popover)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export type Popover = typeof Popover.Type;
/**
 * `popovertargetaction` global attribute value.
 *
 * **Example** (Validate with `PopoverTargetAction`)
 *
 * ```ts
 * import { PopoverTargetAction } from "@beep/html/Html.attributes"
 *
 * console.log(PopoverTargetAction.is.toggle("toggle")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PopoverTargetAction = makeAsciiCaseInsensitiveEnumerated(["toggle", "show", "hide"]).pipe(
  $I.annoteSchema("PopoverTargetAction", { description: "Action a popover invoker performs." })
);
/**
 * Decoded type of {@link PopoverTargetAction}.
 *
 * **Example** (Annotate a `PopoverTargetAction` value)
 *
 * ```ts
 * import type { PopoverTargetAction } from "@beep/html/Html.attributes"
 *
 * const action: PopoverTargetAction = "toggle"
 * console.log(action)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export type PopoverTargetAction = typeof PopoverTargetAction.Type;
/**
 * An HTML boolean attribute presence value.
 *
 * **Details**
 *
 * HTML boolean attributes are true by presence. The literal `false` is not a
 * false value in HTML source (`disabled="false"` still disables), so this
 * schema deliberately accepts only `true` and the empty presence form.
 *
 * **Example** (Call `BooleanAttribute`)
 *
 * ```ts
 * import { BooleanAttribute } from "@beep/html/Html.attributes"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(BooleanAttribute)(true)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BooleanAttribute = S.Literals([true, ""]).pipe(
  $I.annoteSchema("BooleanAttribute", { description: "HTML boolean attribute presence (`true` or empty string)." }),
  SchemaUtils.withCodecStatics
);
/**
 * Decoded type of {@link BooleanAttribute}.
 *
 * **Example** (Annotate a `BooleanAttribute` value)
 *
 * ```ts
 * import type { BooleanAttribute } from "@beep/html/Html.attributes"
 *
 * const value: BooleanAttribute = true
 * console.log(value)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export type BooleanAttribute = typeof BooleanAttribute.Type;

const CrossOriginBase = LiteralKit(["anonymous", "use-credentials"]);
const CrossOriginInput = makeAsciiCaseInsensitiveEnumerated(["", ...CrossOriginBase.Options]);

/**
 * CORS settings attribute with the HTML missing-value spelling normalized.
 *
 * **Example** (Validate with `CrossOrigin`)
 *
 * ```ts
 * import { CrossOrigin } from "@beep/html/Html.attributes"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownResult(CrossOrigin)("")
 * if (Result.isSuccess(decoded)) console.log(decoded.success) // "anonymous"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CrossOrigin = CrossOriginInput.pipe(
  S.decodeTo(
    CrossOriginBase,
    SchemaTransformation.transform({
      decode: (value) => (Str.isEmpty(value) ? CrossOriginInput.Enum.anonymous : value),
      encode: identity,
    })
  ),
  SchemaUtils.withLiteralKitStatics(CrossOriginBase),
  $I.annoteSchema("CrossOrigin", { description: "Canonical HTML CORS settings attribute." })
);

/**
 * Decoded type of {@link CrossOrigin}.
 *
 * **Example** (Annotate a `CrossOrigin` value)
 *
 * ```ts
 * import type { CrossOrigin } from "@beep/html/Html.attributes"
 *
 * const value: CrossOrigin = "anonymous"
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CrossOrigin = typeof CrossOrigin.Type;

/**
 * Referrer-policy keyword accepted by HTML fetch attributes.
 *
 * **Example** (Call `ReferrerPolicy`)
 *
 * ```ts
 * import { ReferrerPolicy } from "@beep/html/Html.attributes"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ReferrerPolicy)("strict-origin")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ReferrerPolicy = makeAsciiCaseInsensitiveEnumerated([
  "",
  "no-referrer",
  "no-referrer-when-downgrade",
  "same-origin",
  "origin",
  "strict-origin",
  "origin-when-cross-origin",
  "strict-origin-when-cross-origin",
  "unsafe-url",
]).pipe($I.annoteSchema("ReferrerPolicy", { description: "Canonical HTML referrer-policy keyword." }));

/**
 * Decoded type of {@link ReferrerPolicy}.
 *
 * **Example** (Annotate a `ReferrerPolicy` value)
 *
 * ```ts
 * import type { ReferrerPolicy } from "@beep/html/Html.attributes"
 *
 * const value: ReferrerPolicy = "strict-origin"
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ReferrerPolicy = typeof ReferrerPolicy.Type;

/**
 * The only conforming character encoding spelling accepted by HTML metadata
 * and form submission.
 *
 * **Example** (Validate with `Utf8Charset`)
 *
 * ```ts
 * import { Utf8Charset } from "@beep/html/Html.attributes"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownResult(Utf8Charset)("UTF-8")
 * if (Result.isSuccess(decoded)) console.log(decoded.success) // "utf-8"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Utf8Charset = makeAsciiCaseInsensitiveEnumerated(["utf-8"]).pipe(
  $I.annoteSchema("Utf8Charset", { description: "Canonical UTF-8 HTML character-encoding keyword." })
);

/**
 * Decoded type of {@link Utf8Charset}.
 *
 * **Example** (Annotate a `Utf8Charset` value)
 *
 * ```ts
 * import type { Utf8Charset } from "@beep/html/Html.attributes"
 *
 * const value: Utf8Charset = "utf-8"
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Utf8Charset = typeof Utf8Charset.Type;

/**
 * Form-level autocomplete policy. Form elements accept only `on` or `off`;
 * detailed autofill tokens belong to form controls.
 *
 * **Example** (Validate with `FormAutocomplete`)
 *
 * ```ts
 * import { FormAutocomplete } from "@beep/html/Html.attributes"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownResult(FormAutocomplete)("OFF")
 * if (Result.isSuccess(decoded)) console.log(decoded.success) // "off"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FormAutocomplete = makeAsciiCaseInsensitiveEnumerated(["on", "off"]).pipe(
  $I.annoteSchema("FormAutocomplete", { description: "Canonical form-level autocomplete policy." })
);

/**
 * Decoded type of {@link FormAutocomplete}.
 *
 * **Example** (Annotate a `FormAutocomplete` value)
 *
 * ```ts
 * import type { FormAutocomplete } from "@beep/html/Html.attributes"
 *
 * const value: FormAutocomplete = "off"
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FormAutocomplete = typeof FormAutocomplete.Type;

const BuiltInButtonCommand = makeAsciiCaseInsensitiveEnumerated([
  "toggle-popover",
  "show-popover",
  "hide-popover",
  "close",
  "request-close",
  "show-modal",
]);
const CustomButtonCommand = S.String.check(
  S.makeFilter(Str.startsWith("--"), {
    identifier: $I`CustomButtonCommandCheck`,
    title: "Custom Button Command",
    description: "Checks a case-preserving custom button command beginning with two hyphens.",
    message: "Expected a custom command beginning with --",
  })
);

/**
 * Built-in or case-preserving custom `button[command]` keyword.
 *
 * **Example** (Validate with `ButtonCommand`)
 *
 * ```ts
 * import { ButtonCommand } from "@beep/html/Html.attributes"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownResult(ButtonCommand)("SHOW-MODAL")
 * if (Result.isSuccess(decoded)) console.log(decoded.success) // "show-modal"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ButtonCommand = S.Union([BuiltInButtonCommand, CustomButtonCommand]).pipe(
  $I.annoteSchema("ButtonCommand", { description: "Canonical built-in or custom HTML button command." }),
  SchemaUtils.withCodecStatics
);

/**
 * Decoded type of {@link ButtonCommand}.
 *
 * **Example** (Annotate a `ButtonCommand` value)
 *
 * ```ts
 * import type { ButtonCommand } from "@beep/html/Html.attributes"
 *
 * const value: ButtonCommand = "show-modal"
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ButtonCommand = typeof ButtonCommand.Type;

/**
 * Integer accepted by the `headingoffset` global attribute.
 *
 * **Example** (Call `HeadingOffset`)
 *
 * ```ts
 * import { HeadingOffset } from "@beep/html/Html.attributes"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(HeadingOffset)(8)) // true
 * console.log(S.is(HeadingOffset)(9)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const HeadingOffset = S.Int.check(
  S.isBetween({
    minimum: 0,
    maximum: 8,
  })
).pipe(
  $I.annoteSchema("HeadingOffset", {
    description: "Canonical integer domain of the headingoffset global attribute.",
  })
);

/**
 * Decoded type of {@link HeadingOffset}.
 *
 * **Example** (Annotate a `HeadingOffset` value)
 *
 * ```ts
 * import type { HeadingOffset } from "@beep/html/Html.attributes"
 *
 * const offset: HeadingOffset = 2
 * console.log(offset)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HeadingOffset = typeof HeadingOffset.Type;

/**
 * An HTML non-negative integer microsyntax.
 *
 * **Example** (Call `HtmlNonNegativeInteger`)
 *
 * ```ts
 * import { HtmlNonNegativeInteger } from "@beep/html/Html.attributes"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(HtmlNonNegativeInteger)(0)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const HtmlNonNegativeInteger = S.Int.check(
  S.isGreaterThanOrEqualTo(0, {
    identifier: $I`HtmlNonNegativeIntegerCheck`,
    title: "HTML Non-Negative Integer",
    description: "Checks the HTML non-negative integer microsyntax.",
    message: "Expected a non-negative integer",
  })
).pipe(
  $I.annoteSchema("HtmlNonNegativeInteger", {
    description: "Integer accepted by the HTML non-negative integer microsyntax.",
  })
);

/**
 * Decoded type of {@link HtmlNonNegativeInteger}.
 *
 * **Example** (Annotate a `HtmlNonNegativeInteger` value)
 *
 * ```ts
 * import type { HtmlNonNegativeInteger } from "@beep/html/Html.attributes"
 *
 * const value: HtmlNonNegativeInteger = 0
 * console.log(value)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export type HtmlNonNegativeInteger = typeof HtmlNonNegativeInteger.Type;

/**
 * An HTML positive integer microsyntax.
 *
 * **Example** (Call `HtmlPositiveInteger`)
 *
 * ```ts
 * import { HtmlPositiveInteger } from "@beep/html/Html.attributes"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(HtmlPositiveInteger)(1)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const HtmlPositiveInteger = S.Int.check(
  S.isGreaterThan(0, {
    identifier: $I`HtmlPositiveIntegerCheck`,
    title: "HTML Positive Integer",
    description: "Checks the HTML positive integer microsyntax.",
    message: "Expected a positive integer",
  })
).pipe(
  $I.annoteSchema("HtmlPositiveInteger", {
    description: "Integer accepted by the HTML positive integer microsyntax.",
  })
);

/**
 * Decoded type of {@link HtmlPositiveInteger}.
 *
 * **Example** (Annotate a `HtmlPositiveInteger` value)
 *
 * ```ts
 * import type { HtmlPositiveInteger } from "@beep/html/Html.attributes"
 *
 * const value: HtmlPositiveInteger = 1
 * console.log(value)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export type HtmlPositiveInteger = typeof HtmlPositiveInteger.Type;

/**
 * A finite number accepted by the HTML floating-point microsyntax.
 *
 * **Example** (Call `HtmlFiniteNumber`)
 *
 * ```ts
 * import { HtmlFiniteNumber } from "@beep/html/Html.attributes"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(HtmlFiniteNumber)(1.5)) // true
 * console.log(S.is(HtmlFiniteNumber)(Number.NaN)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const HtmlFiniteNumber = S.Finite.pipe(
  $I.annoteSchema("HtmlFiniteNumber", {
    description: "Finite number accepted by the HTML floating-point microsyntax.",
  })
);

/**
 * Decoded type of {@link HtmlFiniteNumber}.
 *
 * **Example** (Annotate a `HtmlFiniteNumber` value)
 *
 * ```ts
 * import type { HtmlFiniteNumber } from "@beep/html/Html.attributes"
 *
 * const value: HtmlFiniteNumber = 1.5
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HtmlFiniteNumber = typeof HtmlFiniteNumber.Type;

/**
 * A non-negative finite HTML number.
 *
 * **Example** (Call `HtmlNonNegativeNumber`)
 *
 * ```ts
 * import { HtmlNonNegativeNumber } from "@beep/html/Html.attributes"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(HtmlNonNegativeNumber)(0.5)) // true
 * console.log(S.is(HtmlNonNegativeNumber)(-1)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const HtmlNonNegativeNumber = HtmlFiniteNumber.check(
  S.isGreaterThanOrEqualTo(0, {
    identifier: $I`HtmlNonNegativeNumberCheck`,
    title: "HTML Non-Negative Number",
    description: "Checks a finite HTML number greater than or equal to zero.",
    message: "Expected a non-negative finite number",
  })
).pipe(
  $I.annoteSchema("HtmlNonNegativeNumber", {
    description: "Non-negative finite number accepted by an HTML numeric attribute.",
  })
);

/**
 * Decoded type of {@link HtmlNonNegativeNumber}.
 *
 * **Example** (Annotate a `HtmlNonNegativeNumber` value)
 *
 * ```ts
 * import type { HtmlNonNegativeNumber } from "@beep/html/Html.attributes"
 *
 * const value: HtmlNonNegativeNumber = 0.5
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HtmlNonNegativeNumber = typeof HtmlNonNegativeNumber.Type;

/**
 * A positive finite HTML number.
 *
 * **Example** (Call `HtmlPositiveNumber`)
 *
 * ```ts
 * import { HtmlPositiveNumber } from "@beep/html/Html.attributes"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(HtmlPositiveNumber)(0.5)) // true
 * console.log(S.is(HtmlPositiveNumber)(0)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const HtmlPositiveNumber = HtmlFiniteNumber.check(
  S.isGreaterThan(0, {
    identifier: $I`HtmlPositiveNumberCheck`,
    title: "HTML Positive Number",
    description: "Checks a finite HTML number greater than zero.",
    message: "Expected a positive finite number",
  })
).pipe(
  $I.annoteSchema("HtmlPositiveNumber", {
    description: "Positive finite number accepted by an HTML numeric attribute.",
  })
);

/**
 * Decoded type of {@link HtmlPositiveNumber}.
 *
 * **Example** (Annotate a `HtmlPositiveNumber` value)
 *
 * ```ts
 * import type { HtmlPositiveNumber } from "@beep/html/Html.attributes"
 *
 * const value: HtmlPositiveNumber = 0.5
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HtmlPositiveNumber = typeof HtmlPositiveNumber.Type;

/**
 * `input[step]` value: the keyword `any` or a positive finite number.
 *
 * **Example** (Validate with `HtmlStep`)
 *
 * ```ts
 * import { HtmlStep } from "@beep/html/Html.attributes"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownResult(HtmlStep)("ANY")
 * if (Result.isSuccess(decoded)) console.log(decoded.success) // "any"
 * console.log(S.is(HtmlStep)(0)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const HtmlStep = S.Union([makeAsciiCaseInsensitiveEnumerated(["any"]), HtmlPositiveNumber]).pipe(
  $I.annoteSchema("HtmlStep", { description: "Canonical positive numeric or any HTML step value." }),
  SchemaUtils.withCodecStatics
);

/**
 * Decoded type of {@link HtmlStep}.
 *
 * **Example** (Annotate a `HtmlStep` value)
 *
 * ```ts
 * import type { HtmlStep } from "@beep/html/Html.attributes"
 *
 * const value: HtmlStep = "any"
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HtmlStep = typeof HtmlStep.Type;

/**
 * Removes only the five ASCII whitespace code points recognized by HTML from
 * both ends of a string.
 *
 * **Example** (Call `stripHtmlAsciiWhitespace`)
 *
 * ```ts
 * import { stripHtmlAsciiWhitespace } from "@beep/html/Html.attributes"
 *
 * console.log(stripHtmlAsciiWhitespace("\t value \n")) // "value"
 * console.log(stripHtmlAsciiWhitespace("\u00a0")) // "\u00a0"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const stripHtmlAsciiWhitespace = Str.replace(/^[\t\n\f\r ]+|[\t\n\f\r ]+$/gu, "");

/**
 * Splits an HTML space-separated token list on ASCII whitespace only.
 *
 * **Details**
 *
 * Unicode spaces such as NBSP remain part of a token, matching the browser's
 * DOMTokenList behavior.
 *
 * **Example** (Call `tokenizeHtmlSpaceSeparated`)
 *
 * ```ts
 * import { tokenizeHtmlSpaceSeparated } from "@beep/html/Html.attributes"
 *
 * console.log(tokenizeHtmlSpaceSeparated("noopener\tnoreferrer"))
 * console.log(tokenizeHtmlSpaceSeparated("noopener\u00a0noreferrer"))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const tokenizeHtmlSpaceSeparated: (value: string) => ReadonlyArray<string> = flow(
  Str.split(/[\t\n\f\r ]+/u),
  A.filter(Str.isNonEmpty)
);

/**
 * Builds a schema for a space-separated list of known HTML tokens.
 *
 * **Details**
 *
 * Empty text is accepted because attributes such as `sandbox=""` have
 * meaningful presence semantics. Unknown and duplicate tokens are rejected.
 *
 * **Example** (Call `makeSpaceSeparatedTokenList`)
 *
 * ```ts
 * import { makeSpaceSeparatedTokenList } from "@beep/html/Html.attributes"
 * import * as S from "effect/Schema"
 *
 * const Rel = makeSpaceSeparatedTokenList(["noopener", "noreferrer"])
 * console.log(S.is(Rel)("noopener noreferrer")) // true
 * ```
 *
 * @category factories
 * @since 0.0.0
 */
export const makeSpaceSeparatedTokenList = <const Tokens extends readonly [string, ...ReadonlyArray<string>]>(
  allowed: Tokens
) => {
  assertAsciiFoldUnique(allowed, "Space-separated HTML token registry", false);
  const allowedTokens = A.map(allowed, toAsciiLowerCase);
  const tokenize: (value: string) => ReadonlyArray<string> = flow(tokenizeHtmlSpaceSeparated, A.map(toAsciiLowerCase));
  const normalize = (value: string): string => {
    const inputTokens = tokenize(value);
    return pipe(
      allowedTokens,
      A.filter((token) => A.contains(inputTokens, token)),
      A.join(" ")
    );
  };
  const isAllowed: (value: string) => boolean = flow(
    tokenize,
    (tokens) =>
      A.every(tokens, (token) => A.contains(allowedTokens, token)) && A.dedupe(tokens).length === tokens.length
  );

  const Input = S.String.check(
    S.makeFilter(isAllowed, {
      identifier: $I`SpaceSeparatedTokenListCheck`,
      title: "Space-Separated HTML Token List",
      description: "Checks a whitespace-separated list against an explicit token domain.",
      message: "Expected a space-separated list of unique permitted tokens",
    })
  );
  const Canonical = S.String.check(
    S.makeFilter((value) => value === normalize(value), {
      identifier: $I`CanonicalSpaceSeparatedTokenListCheck`,
      title: "Canonical Space-Separated HTML Token List",
      description: "Checks lowercase tokens in registry order with one separating space.",
      message: "Expected canonical token order and spacing",
    })
  );

  return Input.pipe(
    S.decodeTo(
      Canonical,
      SchemaTransformation.transform({
        decode: normalize,
        encode: identity,
      })
    )
  );
};

const makeOpenSpaceSeparatedTokenList = (
  asciiCaseInsensitive: boolean,
  rawIsAllowed?: (value: string) => boolean,
  canonicalizeTokens: (tokens: ReadonlyArray<string>) => ReadonlyArray<string> = identity
) => {
  const normalizeTokens = (value: string): ReadonlyArray<string> =>
    pipe(
      tokenizeHtmlSpaceSeparated(value),
      asciiCaseInsensitive ? A.map(toAsciiLowerCase) : identity,
      canonicalizeTokens
    );
  const normalize = flow(normalizeTokens, A.join(" "));
  const hasUniqueTokens = (value: string): boolean => {
    const tokens = normalizeTokens(value);
    return A.dedupe(tokens).length === tokens.length && (rawIsAllowed === undefined || rawIsAllowed(value));
  };
  const Input = S.String.check(
    S.makeFilter(hasUniqueTokens, {
      identifier: $I`OpenSpaceSeparatedTokenListCheck`,
      title: "Open Space-Separated HTML Token List",
      description: "Checks an open HTML token list for duplicate tokens.",
      message: "Expected a space-separated list of unique tokens",
    })
  );
  const Canonical = S.String.check(
    S.makeFilter((value) => value === normalize(value) && hasUniqueTokens(value), {
      identifier: $I`CanonicalOpenSpaceSeparatedTokenListCheck`,
      title: "Canonical Open Space-Separated HTML Token List",
      description: "Checks an open HTML token list at its canonical whitespace and case fixed point.",
      message: "Expected canonical token spelling and spacing",
    })
  );
  return Input.pipe(
    S.decodeTo(
      Canonical,
      SchemaTransformation.transform({
        decode: normalize,
        encode: identity,
      })
    )
  );
};

/**
 * Open, ASCII-case-insensitive HTML relation-token list.
 *
 * **Details**
 *
 * The structural AST accepts extension relation tokens because WHATWG delegates
 * extension registration to a mutable external registry. Conformance applies
 * semantic rules to known tokens, while SafeHtml owns a smaller finite policy.
 *
 * **Example** (Validate with `HtmlRelationList`)
 *
 * ```ts
 * import { HtmlRelationList } from "@beep/html/Html.attributes"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownResult(HtmlRelationList)("ME x-beep")
 * if (Result.isSuccess(decoded)) console.log(decoded.success) // "me x-beep"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const HtmlRelationList = makeOpenSpaceSeparatedTokenList(true, undefined, A.sort(Str.Order)).pipe(
  $I.annoteSchema("HtmlRelationList", {
    description: "Canonical open relation-token list for HTML link-bearing elements.",
  })
);

/**
 * Decoded type of {@link HtmlRelationList}.
 *
 * **Example** (Annotate a `HtmlRelationList` value)
 *
 * ```ts
 * import type { HtmlRelationList } from "@beep/html/Html.attributes"
 *
 * const value: HtmlRelationList = "me x-beep"
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HtmlRelationList = typeof HtmlRelationList.Type;

/**
 * Open, ASCII-case-insensitive relation-token list for `link[rel]`.
 *
 * **Details**
 *
 * Link relation extensions are registrable, so the structural AST retains
 * unknown extension tokens. Placement and SafeHtml policy stay independently
 * closed over their reviewed relation sets.
 *
 * **Example** (Validate with `LinkRelationList`)
 *
 * ```ts
 * import { LinkRelationList } from "@beep/html/Html.attributes"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownResult(LinkRelationList)("APPLE-TOUCH-ICON x-beep")
 * if (Result.isSuccess(decoded)) console.log(decoded.success)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LinkRelationList = makeOpenSpaceSeparatedTokenList(
  true,
  (value) => {
    const folded = toAsciiLowerCase(value);
    const tokens = tokenizeHtmlSpaceSeparated(folded);
    return !A.contains(tokens, "shortcut") || folded === "shortcut icon";
  },
  (tokens) => (A.contains(tokens, "shortcut") ? tokens : pipe(tokens, A.sort(Str.Order)))
).pipe(
  $I.annoteSchema("LinkRelationList", {
    description: "Canonical open relation-token list for link elements.",
  })
);

/**
 * Decoded type of {@link LinkRelationList}.
 *
 * **Example** (Annotate a `LinkRelationList` value)
 *
 * ```ts
 * import type { LinkRelationList } from "@beep/html/Html.attributes"
 *
 * const value: LinkRelationList = "icon"
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type LinkRelationList = typeof LinkRelationList.Type;

/**
 * Case-preserving unique HTML ID-reference token list.
 *
 * **Example** (Validate with `HtmlIdReferenceList`)
 *
 * ```ts
 * import { HtmlIdReferenceList } from "@beep/html/Html.attributes"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownResult(HtmlIdReferenceList)("First\tsecond")
 * if (Result.isSuccess(decoded)) console.log(decoded.success) // "First second"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const HtmlIdReferenceList = makeOpenSpaceSeparatedTokenList(false).pipe(
  $I.annoteSchema("HtmlIdReferenceList", {
    description: "Canonical case-preserving list of unique HTML id-reference tokens.",
  })
);

/**
 * Decoded type of {@link HtmlIdReferenceList}.
 *
 * **Example** (Annotate a `HtmlIdReferenceList` value)
 *
 * ```ts
 * import type { HtmlIdReferenceList } from "@beep/html/Html.attributes"
 *
 * const value: HtmlIdReferenceList = "first second"
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HtmlIdReferenceList = typeof HtmlIdReferenceList.Type;

const MetadataNameInput = S.String.check(
  S.isPattern(/^[^\t\n\f\r ]+$/u, {
    identifier: $I`MetadataNameInputCheck`,
    title: "HTML Metadata Name",
    description: "Checks a non-empty HTML metadata name token.",
    message: "Expected a non-empty metadata name without ASCII whitespace",
  })
);
const CanonicalMetadataName = MetadataNameInput.check(
  S.makeFilter((value) => value === toAsciiLowerCase(value), {
    identifier: $I`CanonicalMetadataNameCheck`,
    title: "Canonical HTML Metadata Name",
    description: "Checks the ASCII-lowercase fixed point of a metadata name.",
    message: "Expected an ASCII-lowercase metadata name",
  })
);

/**
 * Open metadata name for `meta[name]`.
 *
 * **Details**
 *
 * HTML permits arbitrary extension metadata names; decoding normalizes their
 * ASCII-insensitive spelling without requiring a central registry.
 *
 * **Example** (Validate with `MetadataName`)
 *
 * ```ts
 * import { MetadataName } from "@beep/html/Html.attributes"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownResult(MetadataName)("X-BEEP")
 * if (Result.isSuccess(decoded)) console.log(decoded.success) // "x-beep"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MetadataName = MetadataNameInput.pipe(
  S.decodeTo(
    CanonicalMetadataName,
    SchemaTransformation.transform({
      decode: toAsciiLowerCase,
      encode: identity,
    })
  ),
  $I.annoteSchema("MetadataName", { description: "Canonical open HTML metadata name." })
);

/**
 * Decoded type of {@link MetadataName}.
 *
 * **Example** (Annotate a `MetadataName` value)
 *
 * ```ts
 * import type { MetadataName } from "@beep/html/Html.attributes"
 *
 * const value: MetadataName = "x-beep"
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type MetadataName = typeof MetadataName.Type;

const autocompleteAttributePattern =
  /^(?:on|off|(?:(?:section-[^\t\n\f\r ]+)[\t\n\f\r ]+)?(?:(?:shipping|billing)[\t\n\f\r ]+)?(?:(?:home|work|mobile|fax|pager)[\t\n\f\r ]+)?(?:name|honorific-prefix|given-name|additional-name|family-name|honorific-suffix|nickname|username|new-password|current-password|one-time-code|organization-title|organization|street-address|address-line1|address-line2|address-line3|address-level4|address-level3|address-level2|address-level1|country|country-name|postal-code|cc-name|cc-given-name|cc-additional-name|cc-family-name|cc-number|cc-exp|cc-exp-month|cc-exp-year|cc-csc|cc-type|transaction-currency|transaction-amount|language|bday|bday-day|bday-month|bday-year|sex|url|photo|tel|tel-country-code|tel-national|tel-area-code|tel-local|tel-local-prefix|tel-local-suffix|tel-extension|email|impp)(?:[\t\n\f\r ]+webauthn)?)$/u;

const normalizeAutocompleteAttribute: (value: string) => string = flow(
  tokenizeHtmlSpaceSeparated,
  A.map(toAsciiLowerCase),
  A.join(" ")
);

const AutocompleteAttributeInput = S.String.check(
  S.makeFilter((value) => autocompleteAttributePattern.test(normalizeAutocompleteAttribute(value)), {
    identifier: $I`AutocompleteAttributeInputCheck`,
    title: "HTML Autocomplete Attribute Input",
    description: "Checks the ordered token-list grammar of the HTML autocomplete attribute.",
    message: "Expected a valid autocomplete token sequence",
  })
);

const CanonicalAutocompleteAttribute = S.String.check(
  S.makeFilter((value) => value === normalizeAutocompleteAttribute(value) && autocompleteAttributePattern.test(value), {
    identifier: $I`CanonicalAutocompleteAttributeCheck`,
    title: "Canonical HTML Autocomplete Attribute",
    description: "Checks lowercase autocomplete tokens separated by one space.",
    message: "Expected a canonical autocomplete token sequence",
  })
);

/**
 * Ordered token-list microsyntax used by the HTML `autocomplete` attribute.
 *
 * **Details**
 *
 * Decoding canonicalizes ASCII case and whitespace. Direct construction
 * accepts only the lowercase, single-space fixed point.
 *
 * **Example** (Validate with `AutocompleteAttribute`)
 *
 * ```ts
 * import { AutocompleteAttribute } from "@beep/html/Html.attributes"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownResult(AutocompleteAttribute)("SHIPPING  Email")
 * if (Result.isSuccess(decoded)) {
 *   console.log(decoded.success) // "shipping email"
 * }
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AutocompleteAttribute = AutocompleteAttributeInput.pipe(
  S.decodeTo(
    CanonicalAutocompleteAttribute,
    SchemaTransformation.transform({
      decode: normalizeAutocompleteAttribute,
      encode: identity,
    })
  ),
  $I.annoteSchema("AutocompleteAttribute", {
    description: "Canonical ordered token-list value accepted by the HTML autocomplete attribute.",
  })
);

/**
 * Decoded type of {@link AutocompleteAttribute}.
 *
 * **Example** (Annotate a `AutocompleteAttribute` value)
 *
 * ```ts
 * import type { AutocompleteAttribute } from "@beep/html/Html.attributes"
 *
 * const value: AutocompleteAttribute = "email"
 * console.log(value)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export type AutocompleteAttribute = typeof AutocompleteAttribute.Type;

/**
 * Name of an SVG or MathML foreign element represented inside the HTML AST.
 *
 * **Example** (Call `ForeignElementName`)
 *
 * ```ts
 * import { ForeignElementName } from "@beep/html/Html.attributes"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ForeignElementName)("svg:path")) // true
 * console.log(S.is(ForeignElementName)('path onload="x"')) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ForeignElementName = S.String.check(
  S.isPattern(/^(?:(?:svg|mathml):[_\p{L}]|[A-Za-z])[\p{L}\p{N}_.-]*$/u, {
    identifier: $I`ForeignElementNameCheck`,
    title: "Foreign Element Name",
    description: "Checks an SVG or MathML element name that the HTML tokenizer can open as a tag.",
    message: "Expected a valid foreign element name",
  })
).pipe(
  $I.annoteSchema("ForeignElementName", {
    description: "SVG or MathML element name with an ASCII start accepted by HTML tag tokenization.",
  })
);

/**
 * Decoded type of {@link ForeignElementName}.
 *
 * **Example** (Annotate a `ForeignElementName` value)
 *
 * ```ts
 * import type { ForeignElementName } from "@beep/html/Html.attributes"
 *
 * const name: ForeignElementName = "path"
 * console.log(name)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export type ForeignElementName = typeof ForeignElementName.Type;

/**
 * Name of an attribute on an SVG or MathML foreign element.
 *
 * **Example** (Call `ForeignAttributeName`)
 *
 * ```ts
 * import { ForeignAttributeName } from "@beep/html/Html.attributes"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ForeignAttributeName)("viewBox")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ForeignAttributeName = S.String.check(
  S.isPattern(/^(?:xmlns|(?:(?:xlink|xml|xmlns):)?[_\p{L}][\p{L}\p{N}_.-]*)$/u, {
    identifier: $I`ForeignAttributeNameCheck`,
    title: "Foreign Attribute Name",
    description: "Checks a serializable SVG or MathML attribute name.",
    message: "Expected a valid foreign attribute name",
  })
).pipe(
  $I.annoteSchema("ForeignAttributeName", {
    description: "Serializable SVG or MathML attribute name.",
  })
);

/**
 * Decoded type of {@link ForeignAttributeName}.
 *
 * **Example** (Annotate a `ForeignAttributeName` value)
 *
 * ```ts
 * import type { ForeignAttributeName } from "@beep/html/Html.attributes"
 *
 * const name: ForeignAttributeName = "viewBox"
 * console.log(name)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export type ForeignAttributeName = typeof ForeignAttributeName.Type;

/**
 * Non-empty HTML `id` value without ASCII whitespace.
 *
 * **Details**
 *
 * Tree-wide uniqueness is checked by the conformance validator because it
 * depends on the complete root rather than one attribute value.
 *
 * **Example** (Call `HtmlIdValue`)
 *
 * ```ts
 * import { HtmlIdValue } from "@beep/html/Html.attributes"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(HtmlIdValue)("section-1")) // true
 * console.log(S.is(HtmlIdValue)("two ids")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const HtmlIdValue = S.String.check(
  S.isPattern(/^[^\t\n\f\r ]+$/u, {
    identifier: $I`HtmlIdValueCheck`,
    title: "HTML ID Value",
    description: "Checks a non-empty HTML id without ASCII whitespace.",
    message: "Expected a non-empty HTML id without ASCII whitespace",
  })
).pipe(
  $I.annoteSchema("HtmlIdValue", {
    description: "Lexically conforming HTML id value; root-wide uniqueness is checked separately.",
  })
);

/**
 * Decoded type of {@link HtmlIdValue}.
 *
 * **Example** (Annotate a `HtmlIdValue` value)
 *
 * ```ts
 * import type { HtmlIdValue } from "@beep/html/Html.attributes"
 *
 * const value: HtmlIdValue = "section-1"
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HtmlIdValue = typeof HtmlIdValue.Type;

// -----------------------------------------------------------------------------
// field bundles
// -----------------------------------------------------------------------------

const OptionalString = S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault);
type OptionalString = typeof OptionalString;

/**
 * Exact hand-authored registry of HTML enumerated global-attribute fields.
 *
 * **Details**
 *
 * The individual codecs canonicalize ASCII case and expose semantic fixed
 * points. Keeping the field inventory in one record lets the generator fail
 * when a global enumerated attribute is added or dropped without review.
 *
 * **Example** (Validate with `EnumeratedGlobalAttributes`)
 *
 * ```ts
 * import { EnumeratedGlobalAttributes } from "@beep/html/Html.attributes"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownResult(S.Struct(EnumeratedGlobalAttributes))({ dir: "RTL" })
 * if (Result.isSuccess(decoded)) console.log(decoded.success.dir)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EnumeratedGlobalAttributes = readonlyStruct({
  autocapitalize: S.OptionFromOptionalKey(AutoCapitalize).pipe(SchemaUtils.withNoneDefault),
  autocorrect: S.OptionFromOptionalKey(AutoCorrect).pipe(SchemaUtils.withNoneDefault),
  contenteditable: S.OptionFromOptionalKey(ContentEditable).pipe(SchemaUtils.withNoneDefault),
  dir: S.OptionFromOptionalKey(Dir).pipe(SchemaUtils.withNoneDefault),
  draggable: S.OptionFromOptionalKey(Draggable).pipe(SchemaUtils.withNoneDefault),
  enterkeyhint: S.OptionFromOptionalKey(EnterKeyHint).pipe(SchemaUtils.withNoneDefault),
  hidden: S.OptionFromOptionalKey(Hidden).pipe(SchemaUtils.withNoneDefault),
  inputmode: S.OptionFromOptionalKey(InputMode).pipe(SchemaUtils.withNoneDefault),
  popover: S.OptionFromOptionalKey(Popover).pipe(SchemaUtils.withNoneDefault),
  spellcheck: S.OptionFromOptionalKey(SpellCheck).pipe(SchemaUtils.withNoneDefault),
  translate: S.OptionFromOptionalKey(Translate).pipe(SchemaUtils.withNoneDefault),
  writingsuggestions: S.OptionFromOptionalKey(WritingSuggestions).pipe(SchemaUtils.withNoneDefault),
});

/**
 * The WHATWG global attributes (`dom.html#global-attributes`), value-typed.
 *
 * **Example** (Call `StandardGlobalAttributes`)
 *
 * ```ts
 * import { StandardGlobalAttributes } from "@beep/html/Html.attributes"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(StandardGlobalAttributes.lang)(O.none())) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const StandardGlobalAttributes = readonlyStruct({
  accesskey: OptionalString,
  ...EnumeratedGlobalAttributes,
  autofocus: S.OptionFromOptionalKey(BooleanAttribute).pipe(SchemaUtils.withNoneDefault),
  class: OptionalString,
  exportparts: OptionalString,
  headingoffset: S.OptionFromOptionalKey(HeadingOffset).pipe(SchemaUtils.withNoneDefault),
  headingreset: S.OptionFromOptionalKey(BooleanAttribute).pipe(SchemaUtils.withNoneDefault),
  id: S.OptionFromOptionalKey(HtmlIdValue).pipe(SchemaUtils.withNoneDefault),
  inert: S.OptionFromOptionalKey(BooleanAttribute).pipe(SchemaUtils.withNoneDefault),
  is: OptionalString,
  itemid: OptionalString,
  itemprop: OptionalString,
  itemref: OptionalString,
  itemscope: S.OptionFromOptionalKey(BooleanAttribute).pipe(SchemaUtils.withNoneDefault),
  itemtype: OptionalString,
  lang: OptionalString,
  nonce: OptionalString,
  part: OptionalString,
  slot: OptionalString,
  style: OptionalString,
  tabindex: S.OptionFromOptionalKey(S.Int).pipe(SchemaUtils.withNoneDefault),
  title: OptionalString,
});

/**
 * Key inside the AST's `dataset` attribute bag.
 *
 * **Details**
 *
 * The ASCII-case-fixed key is appended to `data-` by the serializer. Rejecting
 * ASCII uppercase prevents the parser's attribute-name case-fold collisions.
 *
 * **Example** (Call `DatasetKey`)
 *
 * ```ts
 * import { DatasetKey } from "@beep/html/Html.attributes"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(DatasetKey)("testid")) // true
 * console.log(S.is(DatasetKey)('x" onclick')) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DatasetKey = S.String.check(
  S.isPattern(/^[^A-Z\u0000\t\n\f\r "'<>/=]+$/u, {
    identifier: $I`DatasetKeyCheck`,
    title: "HTML Dataset Key",
    description: "Checks a key that can be safely serialized after the `data-` prefix.",
    message: "Expected a serializable data-* attribute key",
  })
).pipe(
  $I.annoteSchema("DatasetKey", {
    description: "ASCII-case-fixed browser-stable suffix in the AST data-* attribute bag.",
  })
);

/**
 * Decoded type of {@link DatasetKey}.
 *
 * **Example** (Annotate a `DatasetKey` value)
 *
 * ```ts
 * import { DatasetKey } from "@beep/html/Html.attributes"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownResult(DatasetKey)("testid")
 * if (Result.isSuccess(decoded)) {
 *   const key: DatasetKey = decoded.success
 *   console.log(key) // "testid"
 * }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DatasetKey = typeof DatasetKey.Type;

/**
 * `data-*` custom data attributes, represented as the `dataset` record bag
 * (mirrors `HTMLElement.dataset`).
 *
 * **Example** (Call `DatasetAttribute`)
 *
 * ```ts
 * import { DatasetAttribute } from "@beep/html/Html.attributes"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(DatasetAttribute.dataset)(O.none())) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DatasetAttribute = readonlyStruct({
  dataset: S.OptionFromOptionalKey(S.Record(DatasetKey, S.String)).pipe(SchemaUtils.withNoneDefault),
});

const ariaAttributeNames = LiteralKit([
  "aria-activedescendant",
  "aria-atomic",
  "aria-autocomplete",
  "aria-braillelabel",
  "aria-brailleroledescription",
  "aria-busy",
  "aria-checked",
  "aria-colcount",
  "aria-colindex",
  "aria-colindextext",
  "aria-colspan",
  "aria-controls",
  "aria-current",
  "aria-describedby",
  "aria-description",
  "aria-details",
  "aria-disabled",
  "aria-dropeffect",
  "aria-errormessage",
  "aria-expanded",
  "aria-flowto",
  "aria-grabbed",
  "aria-haspopup",
  "aria-hidden",
  "aria-invalid",
  "aria-keyshortcuts",
  "aria-label",
  "aria-labelledby",
  "aria-level",
  "aria-live",
  "aria-modal",
  "aria-multiline",
  "aria-multiselectable",
  "aria-orientation",
  "aria-owns",
  "aria-placeholder",
  "aria-posinset",
  "aria-pressed",
  "aria-readonly",
  "aria-relevant",
  "aria-required",
  "aria-roledescription",
  "aria-rowcount",
  "aria-rowindex",
  "aria-rowindextext",
  "aria-rowspan",
  "aria-selected",
  "aria-setsize",
  "aria-sort",
  "aria-valuemax",
  "aria-valuemin",
  "aria-valuenow",
  "aria-valuetext",
]).Options;

/**
 * `role` plus the WAI-ARIA `aria-*` state and property attributes. Universally
 * permitted; typed as optional strings.
 *
 * **Example** (Call `AriaAttributes`)
 *
 * ```ts
 * import { AriaAttributes } from "@beep/html/Html.attributes"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(AriaAttributes.role)(O.none())) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AriaAttributes = readonlyStruct({
  role: OptionalString,
  ...Struct.fromEntries(A.map(ariaAttributeNames, (n) => Tuple.make(n, OptionalString))),
});

const eventHandlerNames = LiteralKit([
  "onabort",
  "onauxclick",
  "onbeforeinput",
  "onbeforematch",
  "onbeforetoggle",
  "onblur",
  "oncancel",
  "oncanplay",
  "oncanplaythrough",
  "onchange",
  "onclick",
  "onclose",
  "oncommand",
  "oncontextlost",
  "oncontextmenu",
  "oncontextrestored",
  "oncopy",
  "oncuechange",
  "oncut",
  "ondblclick",
  "ondrag",
  "ondragend",
  "ondragenter",
  "ondragleave",
  "ondragover",
  "ondragstart",
  "ondrop",
  "ondurationchange",
  "onemptied",
  "onended",
  "onerror",
  "onfocus",
  "onformdata",
  "oninput",
  "oninvalid",
  "onkeydown",
  "onkeypress",
  "onkeyup",
  "onload",
  "onloadeddata",
  "onloadedmetadata",
  "onloadstart",
  "onmousedown",
  "onmouseenter",
  "onmouseleave",
  "onmousemove",
  "onmouseout",
  "onmouseover",
  "onmouseup",
  "onpaste",
  "onpause",
  "onplay",
  "onplaying",
  "onprogress",
  "onratechange",
  "onreset",
  "onresize",
  "onscroll",
  "onscrollend",
  "onsecuritypolicyviolation",
  "onseeked",
  "onseeking",
  "onselect",
  "onslotchange",
  "onstalled",
  "onsubmit",
  "onsuspend",
  "ontimeupdate",
  "ontoggle",
  "onvolumechange",
  "onwaiting",
  "onwheel",
]).Options;

/**
 * The global event-handler content attributes (`on*`). Universally permitted;
 * typed as optional strings.
 *
 * **Example** (Call `EventHandlerAttributes`)
 *
 * ```ts
 * import { EventHandlerAttributes } from "@beep/html/Html.attributes"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(EventHandlerAttributes.onclick)(O.none())) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EventHandlerAttributes = readonlyStruct(
  Struct.fromEntries(A.map(eventHandlerNames, (n) => Tuple.make(n, OptionalString)))
);

/**
 * The complete global attribute bundle spread into every generated element
 * class: standard globals + `data-*` (`dataset`) + ARIA + event handlers.
 *
 * **Example** (Call `GlobalAttributes`)
 *
 * ```ts
 * import { GlobalAttributes } from "@beep/html/Html.attributes"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(GlobalAttributes.id)(O.none())) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GlobalAttributes = readonlyStruct({
  ...StandardGlobalAttributes,
  ...DatasetAttribute,
  ...AriaAttributes,
  ...EventHandlerAttributes,
});

/**
 * Struct schema over {@link GlobalAttributes}; the source of the shared global
 * attribute decoded/encoded types referenced (by intersection) in every
 * generated element's companion namespace.
 *
 * **Example** (Call `GlobalAttributesStruct`)
 *
 * ```ts
 * import { GlobalAttributesStruct } from "@beep/html/Html.attributes"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(GlobalAttributesStruct)({})) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GlobalAttributesStruct = S.Struct(GlobalAttributes).pipe(
  $I.annoteSchema("GlobalAttributesStruct", { description: "Struct schema over the shared HTML global attributes." })
);
/**
 * Decoded type of {@link GlobalAttributesStruct}.
 *
 * **Example** (Annotate a `GlobalAttributesStruct` value)
 *
 * ```ts
 * import type { GlobalAttributesStruct } from "@beep/html/Html.attributes"
 * import * as O from "effect/Option"
 *
 * const dir: GlobalAttributesStruct["dir"] = O.none()
 * console.log(O.isNone(dir)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export type GlobalAttributesStruct = typeof GlobalAttributesStruct.Type;

/**
 * Decoded type of the shared global attributes.
 *
 * **Example** (Annotate a `GlobalAttributesType` value)
 *
 * ```ts
 * import type { GlobalAttributesType } from "@beep/html/Html.attributes"
 * import * as O from "effect/Option"
 *
 * const isHidden = (attrs: GlobalAttributesType): boolean => O.isSome(attrs.hidden)
 * console.log(typeof isHidden) // "function"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export type GlobalAttributesType = GlobalAttributesStruct;

/**
 * Encoded type of the shared global attributes.
 *
 * **Example** (Annotate a `GlobalAttributesEncoded` value)
 *
 * ```ts
 * import type { GlobalAttributesEncoded } from "@beep/html/Html.attributes"
 *
 * const getId = (attrs: GlobalAttributesEncoded): string | undefined => attrs.id
 * console.log(typeof getId) // "function"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export type GlobalAttributesEncoded = typeof GlobalAttributesStruct.Encoded;
