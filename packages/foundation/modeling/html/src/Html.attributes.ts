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
 * @category schemas
 * @since 0.0.0
 */
export const Dir = LiteralKit(["ltr", "rtl", "auto"]).pipe(
  $I.annoteSchema("Dir", { description: "Text directionality." })
);
/**
 * `translate` global attribute value.
 *
 * @category schemas
 * @since 0.0.0
 */
export const Translate = LiteralKit(["yes", "no"]).pipe(
  $I.annoteSchema("Translate", { description: "Whether to translate the element's contents." })
);
/**
 * `contenteditable` global attribute value.
 *
 * @category schemas
 * @since 0.0.0
 */
export const ContentEditable = LiteralKit(["", "true", "false", "plaintext-only"]).pipe(
  $I.annoteSchema("ContentEditable", { description: "Whether the element is editable." })
);
/**
 * `draggable` global attribute value.
 *
 * @category schemas
 * @since 0.0.0
 */
export const Draggable = LiteralKit(["true", "false"]).pipe(
  $I.annoteSchema("Draggable", { description: "Whether the element is draggable." })
);
/**
 * `spellcheck` global attribute value.
 *
 * @category schemas
 * @since 0.0.0
 */
export const SpellCheck = LiteralKit(["true", "false", ""]).pipe(
  $I.annoteSchema("SpellCheck", { description: "Whether spellchecking is enabled." })
);
/**
 * `writingsuggestions` global attribute value.
 *
 * @category schemas
 * @since 0.0.0
 */
export const WritingSuggestions = LiteralKit(["true", "false"]).pipe(
  $I.annoteSchema("WritingSuggestions", { description: "Whether writing suggestions are enabled." })
);
/**
 * `autocapitalize` global attribute value.
 *
 * @category schemas
 * @since 0.0.0
 */
export const AutoCapitalize = LiteralKit(["off", "none", "on", "sentences", "words", "characters"]).pipe(
  $I.annoteSchema("AutoCapitalize", { description: "Autocapitalization behavior." })
);
/**
 * `autocorrect` global attribute value.
 *
 * @category schemas
 * @since 0.0.0
 */
export const AutoCorrect = LiteralKit(["on", "off"]).pipe(
  $I.annoteSchema("AutoCorrect", { description: "Autocorrection behavior." })
);
/**
 * `inputmode` global attribute value.
 *
 * @category schemas
 * @since 0.0.0
 */
export const InputMode = LiteralKit(["none", "text", "tel", "url", "email", "numeric", "decimal", "search"]).pipe(
  $I.annoteSchema("InputMode", { description: "Virtual keyboard input mode hint." })
);
/**
 * `enterkeyhint` global attribute value.
 *
 * @category schemas
 * @since 0.0.0
 */
export const EnterKeyHint = LiteralKit(["enter", "done", "go", "next", "previous", "search", "send"]).pipe(
  $I.annoteSchema("EnterKeyHint", { description: "Enter-key action hint." })
);
/**
 * `hidden` global attribute value.
 *
 * @category schemas
 * @since 0.0.0
 */
export const Hidden = LiteralKit(["", "hidden", "until-found"]).pipe(
  $I.annoteSchema("Hidden", { description: "Hidden state of the element." })
);
/**
 * `popover` global attribute value.
 *
 * @category schemas
 * @since 0.0.0
 */
export const Popover = LiteralKit(["auto", "manual", "hint"]).pipe(
  $I.annoteSchema("Popover", { description: "Popover behavior." })
);
/**
 * `popovertargetaction` global attribute value.
 *
 * @category schemas
 * @since 0.0.0
 */
export const PopoverTargetAction = LiteralKit(["toggle", "show", "hide"]).pipe(
  $I.annoteSchema("PopoverTargetAction", { description: "Action a popover invoker performs." })
);
/**
 * An HTML boolean attribute value. The attribute's presence means `true`; the
 * spec permits both `true`/`false` and the empty-string presence form (`""`,
 * e.g. `disabled=""`) on the wire, so both are accepted.
 *
 * @category schemas
 * @since 0.0.0
 */
export const BooleanAttribute = S.Union([S.Boolean, S.Literal("")]).pipe(
  $I.annoteSchema("BooleanAttribute", { description: "HTML boolean attribute (true/false or empty-string presence)." }),
  SchemaUtils.withCodecStatics
);

// -----------------------------------------------------------------------------
// field bundles
// -----------------------------------------------------------------------------

const Str = S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault);
type Str = typeof Str;

/**
 * The WHATWG global attributes (`dom.html#global-attributes`), value-typed.
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
 * @category schemas
 * @since 0.0.0
 */
export const GlobalAttributesStruct = S.Struct(GlobalAttributes).pipe(
  $I.annoteSchema("GlobalAttributesStruct", { description: "Struct schema over the shared HTML global attributes." })
);

/**
 * Decoded type of the shared global attributes.
 *
 * @category schemas
 * @since 0.0.0
 */
export type GlobalAttributesType = typeof GlobalAttributesStruct.Type;

/**
 * Encoded type of the shared global attributes.
 *
 * @category schemas
 * @since 0.0.0
 */
export type GlobalAttributesEncoded = typeof GlobalAttributesStruct.Encoded;
