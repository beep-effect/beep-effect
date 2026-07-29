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
import { A, Struct } from "@beep/utils";
import { pipe, SchemaTransformation } from "effect";
import { identity } from "effect/Function";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $HtmlId.create("Html.attributes");

// -----------------------------------------------------------------------------
// reusable enumerated value schemas (sourced from webref html-global attr-values)
// -----------------------------------------------------------------------------

/**
 * `dir` global attribute value.
 *
 * @example
 * ```ts
 * import { Dir } from "@beep/html/Html.attributes"
 *
 * console.log(Dir.is.ltr("ltr")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Dir = LiteralKit(["ltr", "rtl", "auto"]).pipe(
  $I.annoteSchema("Dir", { description: "Text directionality." })
);
/**
 * Decoded type of {@link Dir}.
 *
 * @example
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
/**
 * `translate` global attribute value.
 *
 * @example
 * ```ts
 * import { Translate } from "@beep/html/Html.attributes"
 *
 * console.log(Translate.is.yes("yes")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Translate = LiteralKit(["yes", "no"]).pipe(
  $I.annoteSchema("Translate", { description: "Whether to translate the element's contents." })
);
/**
 * Decoded type of {@link Translate}.
 *
 * @example
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
/**
 * `contenteditable` global attribute value.
 *
 * @example
 * ```ts
 * import { ContentEditable } from "@beep/html/Html.attributes"
 *
 * console.log(ContentEditable.is.true("true")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ContentEditable = LiteralKit(["", "true", "false", "plaintext-only"]).pipe(
  $I.annoteSchema("ContentEditable", { description: "Whether the element is editable." })
);
/**
 * Decoded type of {@link ContentEditable}.
 *
 * @example
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
 * @example
 * ```ts
 * import { Draggable } from "@beep/html/Html.attributes"
 *
 * console.log(Draggable.is.true("true")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Draggable = LiteralKit(["true", "false"]).pipe(
  $I.annoteSchema("Draggable", { description: "Whether the element is draggable." })
);
/**
 * Decoded type of {@link Draggable}.
 *
 * @example
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
/**
 * `spellcheck` global attribute value.
 *
 * @example
 * ```ts
 * import { SpellCheck } from "@beep/html/Html.attributes"
 *
 * console.log(SpellCheck.is.true("true")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SpellCheck = LiteralKit(["true", "false", ""]).pipe(
  $I.annoteSchema("SpellCheck", { description: "Whether spellchecking is enabled." })
);
/**
 * Decoded type of {@link SpellCheck}.
 *
 * @example
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
/**
 * `writingsuggestions` global attribute value.
 *
 * @example
 * ```ts
 * import { WritingSuggestions } from "@beep/html/Html.attributes"
 *
 * console.log(WritingSuggestions.is.true("true")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const WritingSuggestions = LiteralKit(["true", "false"]).pipe(
  $I.annoteSchema("WritingSuggestions", { description: "Whether writing suggestions are enabled." })
);
/**
 * Decoded type of {@link WritingSuggestions}.
 *
 * @example
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
 * @example
 * ```ts
 * import { AutoCapitalize } from "@beep/html/Html.attributes"
 *
 * console.log(AutoCapitalize.is.off("off")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AutoCapitalize = LiteralKit(["off", "none", "on", "sentences", "words", "characters"]).pipe(
  $I.annoteSchema("AutoCapitalize", { description: "Autocapitalization behavior." })
);
/**
 * Decoded type of {@link AutoCapitalize}.
 *
 * @example
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
/**
 * `autocorrect` global attribute value.
 *
 * @example
 * ```ts
 * import { AutoCorrect } from "@beep/html/Html.attributes"
 *
 * console.log(AutoCorrect.is.on("on")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AutoCorrect = LiteralKit(["on", "off"]).pipe(
  $I.annoteSchema("AutoCorrect", { description: "Autocorrection behavior." })
);
/**
 * Decoded type of {@link AutoCorrect}.
 *
 * @example
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
 * @example
 * ```ts
 * import { InputMode } from "@beep/html/Html.attributes"
 *
 * console.log(InputMode.is.text("text")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const InputMode = LiteralKit(["none", "text", "tel", "url", "email", "numeric", "decimal", "search"]).pipe(
  $I.annoteSchema("InputMode", { description: "Virtual keyboard input mode hint." })
);
/**
 * Decoded type of {@link InputMode}.
 *
 * @example
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
 * @example
 * ```ts
 * import { EnterKeyHint } from "@beep/html/Html.attributes"
 *
 * console.log(EnterKeyHint.is.enter("enter")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EnterKeyHint = LiteralKit(["enter", "done", "go", "next", "previous", "search", "send"]).pipe(
  $I.annoteSchema("EnterKeyHint", { description: "Enter-key action hint." })
);
/**
 * Decoded type of {@link EnterKeyHint}.
 *
 * @example
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
/**
 * `hidden` global attribute value.
 *
 * @example
 * ```ts
 * import { Hidden } from "@beep/html/Html.attributes"
 *
 * console.log(Hidden.is.hidden("hidden")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Hidden = LiteralKit(["", "hidden", "until-found"]).pipe(
  $I.annoteSchema("Hidden", { description: "Hidden state of the element." })
);
/**
 * Decoded type of {@link Hidden}.
 *
 * @example
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
/**
 * `popover` global attribute value.
 *
 * @example
 * ```ts
 * import { Popover } from "@beep/html/Html.attributes"
 *
 * console.log(Popover.is.auto("auto")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Popover = LiteralKit(["auto", "manual", "hint"]).pipe(
  $I.annoteSchema("Popover", { description: "Popover behavior." })
);
/**
 * Decoded type of {@link Popover}.
 *
 * @example
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
 * @example
 * ```ts
 * import { PopoverTargetAction } from "@beep/html/Html.attributes"
 *
 * console.log(PopoverTargetAction.is.toggle("toggle")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PopoverTargetAction = LiteralKit(["toggle", "show", "hide"]).pipe(
  $I.annoteSchema("PopoverTargetAction", { description: "Action a popover invoker performs." })
);
/**
 * Decoded type of {@link PopoverTargetAction}.
 *
 * @example
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
 * HTML boolean attributes are true by presence. The literal `false` is not a
 * false value in HTML source (`disabled="false"` still disables), so this
 * schema deliberately accepts only `true` and the empty presence form.
 *
 * @example
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
 * @example
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

/**
 * An HTML non-negative integer microsyntax.
 *
 * @example
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
 * @example
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
 * @example
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
 * @example
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
 * Builds a schema for a space-separated list of known HTML tokens.
 *
 * Empty text is accepted because attributes such as `sandbox=""` have
 * meaningful presence semantics. Unknown and duplicate tokens are rejected.
 *
 * @example
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
  const allowedTokens = A.map(allowed, Str.toLowerCase);
  const tokenize = (value: string): ReadonlyArray<string> =>
    pipe(value, Str.trim, Str.split(/\s+/u), A.filter(Str.isNonEmpty), A.map(Str.toLowerCase));
  const normalize = (value: string): string => {
    const inputTokens = tokenize(value);
    return pipe(
      allowedTokens,
      A.filter((token) => A.contains(inputTokens, token)),
      A.join(" ")
    );
  };
  const isAllowed = (value: string): boolean =>
    pipe(
      value,
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

const autocompleteAttributePattern =
  /^(?:on|off|(?:(?:section-[^\s]+)\s+)?(?:(?:shipping|billing)\s+)?(?:(?:home|work|mobile|fax|pager)\s+)?(?:name|honorific-prefix|given-name|additional-name|family-name|honorific-suffix|nickname|username|new-password|current-password|one-time-code|organization-title|organization|street-address|address-line1|address-line2|address-line3|address-level4|address-level3|address-level2|address-level1|country|country-name|postal-code|cc-name|cc-given-name|cc-additional-name|cc-family-name|cc-number|cc-exp|cc-exp-month|cc-exp-year|cc-csc|cc-type|transaction-currency|transaction-amount|language|bday|bday-day|bday-month|bday-year|sex|url|photo|tel|tel-country-code|tel-national|tel-area-code|tel-local|tel-local-prefix|tel-local-suffix|tel-extension|email|impp)(?:\s+webauthn)?)$/u;

const normalizeAutocompleteAttribute = (value: string): string =>
  pipe(value, Str.trim, Str.split(/\s+/u), A.map(Str.toLowerCase), A.join(" "));

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
 * Decoding canonicalizes ASCII case and whitespace. Direct construction
 * accepts only the lowercase, single-space fixed point.
 *
 * @example
 * ```ts
 * import { AutocompleteAttribute } from "@beep/html/Html.attributes"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownSync(AutocompleteAttribute)("SHIPPING  Email")) // "shipping email"
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
 * @example
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
 * @example
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
  S.isPattern(/^(?:(?:svg|mathml):)?[_\p{L}][\p{L}\p{N}_.-]*$/u, {
    identifier: $I`ForeignElementNameCheck`,
    title: "Foreign Element Name",
    description: "Checks a serializable SVG or MathML element name.",
    message: "Expected a valid foreign element name",
  })
).pipe(
  $I.annoteSchema("ForeignElementName", {
    description: "Serializable SVG or MathML element name.",
  })
);

/**
 * Decoded type of {@link ForeignElementName}.
 *
 * @example
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
 * @example
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
 * @example
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

// -----------------------------------------------------------------------------
// field bundles
// -----------------------------------------------------------------------------

const OptionalString = S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault);
type OptionalString = typeof OptionalString;

/**
 * The WHATWG global attributes (`dom.html#global-attributes`), value-typed.
 *
 * @example
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
export const StandardGlobalAttributes = {
  accesskey: OptionalString,
  autocapitalize: S.OptionFromOptionalKey(AutoCapitalize).pipe(SchemaUtils.withNoneDefault),
  autocorrect: S.OptionFromOptionalKey(AutoCorrect).pipe(SchemaUtils.withNoneDefault),
  autofocus: S.OptionFromOptionalKey(BooleanAttribute).pipe(SchemaUtils.withNoneDefault),
  class: OptionalString,
  contenteditable: S.OptionFromOptionalKey(ContentEditable).pipe(SchemaUtils.withNoneDefault),
  dir: S.OptionFromOptionalKey(Dir).pipe(SchemaUtils.withNoneDefault),
  draggable: S.OptionFromOptionalKey(Draggable).pipe(SchemaUtils.withNoneDefault),
  enterkeyhint: S.OptionFromOptionalKey(EnterKeyHint).pipe(SchemaUtils.withNoneDefault),
  exportparts: OptionalString,
  headingoffset: S.OptionFromOptionalKey(S.Int).pipe(SchemaUtils.withNoneDefault),
  headingreset: OptionalString,
  hidden: S.OptionFromOptionalKey(Hidden).pipe(SchemaUtils.withNoneDefault),
  id: OptionalString,
  inert: S.OptionFromOptionalKey(BooleanAttribute).pipe(SchemaUtils.withNoneDefault),
  inputmode: S.OptionFromOptionalKey(InputMode).pipe(SchemaUtils.withNoneDefault),
  is: OptionalString,
  itemid: OptionalString,
  itemprop: OptionalString,
  itemref: OptionalString,
  itemscope: S.OptionFromOptionalKey(BooleanAttribute).pipe(SchemaUtils.withNoneDefault),
  itemtype: OptionalString,
  lang: OptionalString,
  nonce: OptionalString,
  part: OptionalString,
  popover: S.OptionFromOptionalKey(Popover).pipe(SchemaUtils.withNoneDefault),
  popovertarget: OptionalString,
  popovertargetaction: S.OptionFromOptionalKey(PopoverTargetAction).pipe(SchemaUtils.withNoneDefault),
  slot: OptionalString,
  spellcheck: S.OptionFromOptionalKey(SpellCheck).pipe(SchemaUtils.withNoneDefault),
  style: OptionalString,
  tabindex: S.OptionFromOptionalKey(S.Int).pipe(SchemaUtils.withNoneDefault),
  title: OptionalString,
  translate: S.OptionFromOptionalKey(Translate).pipe(SchemaUtils.withNoneDefault),
  writingsuggestions: S.OptionFromOptionalKey(WritingSuggestions).pipe(SchemaUtils.withNoneDefault),
} as const;

/**
 * Key inside the AST's `dataset` attribute bag.
 *
 * The key is appended to `data-` by the serializer, so characters that could
 * terminate or split an HTML attribute name are rejected at the schema edge.
 *
 * @example
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
  S.isPattern(/^[A-Za-z_][A-Za-z0-9_.:-]*$/u, {
    identifier: $I`DatasetKeyCheck`,
    title: "HTML Dataset Key",
    description: "Checks a key that can be safely serialized after the `data-` prefix.",
    message: "Expected a serializable data-* attribute key",
  })
).pipe(
  $I.annoteSchema("DatasetKey", {
    description: "Serializable key in the AST dataset bag.",
  })
);

/**
 * Decoded type of {@link DatasetKey}.
 *
 * @category models
 * @since 0.0.0
 */
export type DatasetKey = typeof DatasetKey.Type;

/**
 * `data-*` custom data attributes, represented as the `dataset` record bag
 * (mirrors `HTMLElement.dataset`).
 *
 * @example
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
export const DatasetAttribute = {
  dataset: S.OptionFromOptionalKey(S.Record(DatasetKey, S.String)).pipe(SchemaUtils.withNoneDefault),
} as const;

const ariaAttributeNames = [
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
] as const;

/**
 * `role` plus the WAI-ARIA `aria-*` state and property attributes. Universally
 * permitted; typed as optional strings.
 *
 * @example
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
export const AriaAttributes = {
  role: OptionalString,
  ...(Struct.fromEntries(A.map(ariaAttributeNames, (n) => [n, OptionalString] as const)) as {
    readonly [K in (typeof ariaAttributeNames)[number]]: OptionalString;
  }),
} as const;

const eventHandlerNames = [
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
] as const;

/**
 * The global event-handler content attributes (`on*`). Universally permitted;
 * typed as optional strings.
 *
 * @example
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
export const EventHandlerAttributes = Struct.fromEntries(
  A.map(eventHandlerNames, (n) => [n, OptionalString] as const)
) as {
  readonly [K in (typeof eventHandlerNames)[number]]: OptionalString;
};

/**
 * The complete global attribute bundle spread into every generated element
 * class: standard globals + `data-*` (`dataset`) + ARIA + event handlers.
 *
 * @example
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
export const GlobalAttributes = {
  ...StandardGlobalAttributes,
  ...DatasetAttribute,
  ...AriaAttributes,
  ...EventHandlerAttributes,
} as const;

/**
 * Struct schema over {@link GlobalAttributes}; the source of the shared global
 * attribute decoded/encoded types referenced (by intersection) in every
 * generated element's companion namespace.
 *
 * @example
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
 * @example
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
 * @example
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
 * @example
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
