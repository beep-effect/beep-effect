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
import * as S from "effect/Schema";

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
 * An HTML boolean attribute value. The attribute's presence means `true`; the
 * spec permits both `true`/`false` and the empty-string presence form (`""`,
 * e.g. `disabled=""`) on the wire, so both are accepted.
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
export const BooleanAttribute = S.Union([S.Boolean, S.Literal("")]).pipe(
  $I.annoteSchema("BooleanAttribute", { description: "HTML boolean attribute (true/false or empty-string presence)." }),
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

// -----------------------------------------------------------------------------
// field bundles
// -----------------------------------------------------------------------------

const Str = S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault);
type Str = typeof Str;

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
  accesskey: Str,
  autocapitalize: S.OptionFromOptionalKey(AutoCapitalize).pipe(SchemaUtils.withNoneDefault),
  autocorrect: S.OptionFromOptionalKey(AutoCorrect).pipe(SchemaUtils.withNoneDefault),
  autofocus: S.OptionFromOptionalKey(BooleanAttribute).pipe(SchemaUtils.withNoneDefault),
  class: Str,
  contenteditable: S.OptionFromOptionalKey(ContentEditable).pipe(SchemaUtils.withNoneDefault),
  dir: S.OptionFromOptionalKey(Dir).pipe(SchemaUtils.withNoneDefault),
  draggable: S.OptionFromOptionalKey(Draggable).pipe(SchemaUtils.withNoneDefault),
  enterkeyhint: S.OptionFromOptionalKey(EnterKeyHint).pipe(SchemaUtils.withNoneDefault),
  exportparts: Str,
  headingoffset: S.OptionFromOptionalKey(S.Int).pipe(SchemaUtils.withNoneDefault),
  headingreset: Str,
  hidden: S.OptionFromOptionalKey(Hidden).pipe(SchemaUtils.withNoneDefault),
  id: Str,
  inert: S.OptionFromOptionalKey(BooleanAttribute).pipe(SchemaUtils.withNoneDefault),
  inputmode: S.OptionFromOptionalKey(InputMode).pipe(SchemaUtils.withNoneDefault),
  is: Str,
  itemid: Str,
  itemprop: Str,
  itemref: Str,
  itemscope: S.OptionFromOptionalKey(BooleanAttribute).pipe(SchemaUtils.withNoneDefault),
  itemtype: Str,
  lang: Str,
  nonce: Str,
  part: Str,
  popover: S.OptionFromOptionalKey(Popover).pipe(SchemaUtils.withNoneDefault),
  popovertarget: Str,
  popovertargetaction: S.OptionFromOptionalKey(PopoverTargetAction).pipe(SchemaUtils.withNoneDefault),
  slot: Str,
  spellcheck: S.OptionFromOptionalKey(SpellCheck).pipe(SchemaUtils.withNoneDefault),
  style: Str,
  tabindex: S.OptionFromOptionalKey(S.Int).pipe(SchemaUtils.withNoneDefault),
  title: Str,
  translate: S.OptionFromOptionalKey(Translate).pipe(SchemaUtils.withNoneDefault),
  writingsuggestions: S.OptionFromOptionalKey(WritingSuggestions).pipe(SchemaUtils.withNoneDefault),
} as const;

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
  dataset: S.OptionFromOptionalKey(S.Record(S.String, S.String)).pipe(SchemaUtils.withNoneDefault),
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
  role: Str,
  ...(Struct.fromEntries(A.map(ariaAttributeNames, (n) => [n, Str] as const)) as {
    readonly [K in (typeof ariaAttributeNames)[number]]: Str;
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
export const EventHandlerAttributes = Struct.fromEntries(A.map(eventHandlerNames, (n) => [n, Str] as const)) as {
  readonly [K in (typeof eventHandlerNames)[number]]: Str;
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
