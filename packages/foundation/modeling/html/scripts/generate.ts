#!/usr/bin/env bun
import { $HtmlId } from "@beep/identity";
/**
 * Code generator for the exhaustive HTML AST.
 *
 * Reads the vendored, version-pinned datasets in `data/` and emits committed
 * source under `src/`:
 *   - `src/Html.model.ts` — every element as an `S.TaggedClass`, the recursive
 *     `HtmlChildren` list, the `HtmlNode` discriminated union (via
 *     `S.toTaggedUnion("_tag")`), and advisory content-category sub-unions.
 *   - `src/Html.meta.ts`  — the `ELEMENT_META` table (interface, conformance,
 *     content categories, void/raw-text flags).
 *
 * Per-element attribute field bodies and decoded/encoded TypeScript types are
 * emitted from one attribute spec so decoded absence can be `Option` while the
 * encoded wire key remains optional. Run with `bun run generate` (which then
 * formats the output with biome). Output is deterministic.
 *
 * @since 0.0.0
 */
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, FileSystem, Layer, Logger, MutableHashMap, MutableHashSet, Path } from "effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { GlobalAttributes } from "../src/Html.attributes.ts";

const $I = $HtmlId.create("scripts/generate");

// ---------------------------------------------------------------------------
// reserved identifiers / naming
// ---------------------------------------------------------------------------

// Identifiers a generated element class must not collide with: JS restricted
// globals, the module-level bindings the generated file introduces, and the
// exports it imports from `Html.attributes` / `Html.nodes`. Collisions get an
// `Element` suffix (`<s>` -> `SElement`, `<dir>` -> `DirElement`,
// `<object>` -> `ObjectElement`); the `_tag` value is always the real tag name.
const RESERVED = MutableHashSet.fromIterable([
  "Object",
  "Function",
  "Array",
  "Number",
  "Boolean",
  "String",
  "Symbol",
  "BigInt",
  "Math",
  "Date",
  "RegExp",
  "Error",
  "Map",
  "Set",
  "WeakMap",
  "WeakSet",
  "Promise",
  "Proxy",
  "Reflect",
  "JSON",
  "Infinity",
  "NaN",
  "S",
  "$I",
  "HtmlChildren",
  "HtmlNode",
  "Fragment",
  "Document",
  "Text",
  "Comment",
  "Doctype",
  "GlobalAttributes",
  "GlobalAttributesStruct",
  "GlobalAttributesType",
  "GlobalAttributesEncoded",
  "StandardGlobalAttributes",
  "DatasetAttribute",
  "AriaAttributes",
  "EventHandlerAttributes",
  "Dir",
  "Translate",
  "ContentEditable",
  "Draggable",
  "SpellCheck",
  "WritingSuggestions",
  "AutoCapitalize",
  "AutoCorrect",
  "InputMode",
  "EnterKeyHint",
  "Hidden",
  "Popover",
  "PopoverTargetAction",
  "Metadata",
  "Flow",
  "Sectioning",
  "Heading",
  "Phrasing",
  "Embedded",
  "Interactive",
  "Palpable",
  "ScriptSupporting",
]);

const className = (tag: string): string => {
  const pascal = Str.toUpperCase(tag.charAt(0)) + tag.slice(1);
  return MutableHashSet.has(RESERVED, pascal) ? `${pascal}Element` : pascal;
};

const CATEGORIES: ReadonlyArray<readonly [string, string]> = [
  ["Metadata", "metadata"],
  ["Flow", "flow"],
  ["Sectioning", "sectioning"],
  ["Heading", "heading"],
  ["Phrasing", "phrasing"],
  ["Embedded", "embedded"],
  ["Interactive", "interactive"],
  ["Palpable", "palpable"],
  ["ScriptSupporting", "script-supporting"],
];

type Kind = "void" | "text" | "normal";
type TextMode = "normal" | "raw-text" | "rcdata" | "plaintext";

interface AttributeSpec {
  readonly encoded: string;
  readonly runtime: string;
  readonly type: string;
}

interface El {
  readonly categories: ReadonlyArray<string>;
  readonly children: ReadonlyArray<string>;
  readonly childSequencePattern: string | undefined;
  readonly cls: string;
  readonly encoded: string;
  readonly iface: string;
  readonly kind: Kind;
  readonly obsolete: boolean;
  readonly runtime: string;
  readonly tag: string;
  readonly textMode: TextMode;
  readonly type: string;
}

/** A single webref definition entry from `ed/dfns/html.json`. */
class Dfn extends S.Class<Dfn>($I`Dfn`)(
  {
    for: S.Array(S.String).pipe(S.optionalKey),
    href: S.String,
    linkingText: S.Array(S.String),
    type: S.String,
  },
  $I.annote("Dfn", { description: "A single webref definition entry from ed/dfns/html.json." })
) {}

class WebrefElement extends S.Class<WebrefElement>($I`WebrefElement`)(
  {
    interface: S.String,
    name: S.String,
  },
  $I.annote("WebrefElement", { description: "A single webref element-index entry." })
) {}

class ContentModelEntry extends S.Class<ContentModelEntry>($I`ContentModelEntry`)(
  {
    categories: S.Array(S.String).pipe(S.optionalKey),
    children: S.Array(S.String).pipe(S.optionalKey),
  },
  $I.annote("ContentModelEntry", { description: "WHATWG content-model metadata for one element." })
) {}

class Classification extends S.Class<Classification>($I`Classification`)(
  {
    autocompleteAttributes: S.Array(S.String),
    booleanAttributes: S.Array(S.String),
    boundedIntegerAttributes: S.Record(S.String, S.Tuple([S.Int, S.Int])),
    childSequencePatterns: S.Record(S.String, S.String),
    integerAttributes: S.Array(S.String),
    nonNegativeIntegerAttributes: S.Array(S.String),
    normal: S.Array(S.String),
    emptyContentModelElements: S.Array(S.String),
    plaintext: S.Array(S.String),
    positiveIntegerAttributes: S.Array(S.String),
    rawText: S.Array(S.String),
    rcData: S.Array(S.String),
    spaceSeparatedTokenAttributes: S.Array(S.String),
    stringAttributes: S.Array(S.String),
    void: S.Array(S.String),
  },
  $I.annote("Classification", { description: "Pinned HTML attribute and element classifications." })
) {}

class DfnsDoc extends S.Class<DfnsDoc>($I`DfnsDoc`)(
  { dfns: S.Array(Dfn) },
  $I.annote("DfnsDoc", { description: "webref dfns-html.json document." })
) {}

class ElementsDoc extends S.Class<ElementsDoc>($I`ElementsDoc`)(
  { elements: S.Array(WebrefElement) },
  $I.annote("ElementsDoc", { description: "webref elements-html.json document." })
) {}

class ContentModelDoc extends S.Class<ContentModelDoc>($I`ContentModelDoc`)(
  { elements: S.Record(S.String, ContentModelEntry) },
  $I.annote("ContentModelDoc", { description: "WHATWG content-model.json document." })
) {}

class ObsoleteInterfacesDoc extends S.Class<ObsoleteInterfacesDoc>($I`ObsoleteInterfacesDoc`)(
  { interfaces: S.Record(S.String, S.String) },
  $I.annote("ObsoleteInterfacesDoc", { description: "Local obsolete interface override document." })
) {}

interface RawData {
  readonly classification: Classification;
  readonly contentModel: Record<string, ContentModelEntry>;
  readonly dfns: ReadonlyArray<Dfn>;
  readonly elements: ReadonlyArray<WebrefElement>;
  readonly obsoleteInterfaces: Record<string, string>;
}

// ---------------------------------------------------------------------------
// pure build
// ---------------------------------------------------------------------------

const optionalRuntime = (schema: string): string =>
  `S.OptionFromOptionalKey(${schema}).pipe(SchemaUtils.withNoneDefault)`;

const literalUnion = (values: ReadonlyArray<string>): string =>
  values.map((value) => JSON.stringify(value)).join(" | ");

const buildModel = (data: RawData): { model: string; meta: string; conforming: number; total: number } => {
  const { classification, contentModel, dfns, elements: elementsData, obsoleteInterfaces } = data;

  const elementDfns = dfns.filter((d) => d.type === "element");
  const elementNames: ReadonlyArray<string> = elementDfns.map((d) => d.linkingText[0]);
  const elementNameSet = MutableHashSet.fromIterable(elementNames);
  const isObsolete = (d: Dfn | undefined): boolean => d !== undefined && /\/obsolete\.html/.test(d.href);

  // element -> specific attribute names (webref `for` arrays already expand
  // groups to concrete element names; the only non-element `for` tokens are the
  // global groups, which we skip).
  const elemAttrs = MutableHashMap.empty<string, MutableHashSet.MutableHashSet<string>>();
  for (const name of elementNames) MutableHashMap.set(elemAttrs, name, MutableHashSet.empty<string>());
  for (const ea of dfns.filter((d) => d.type === "element-attr")) {
    const attr = ea.linkingText[0];
    for (const f of ea.for ?? []) {
      if (MutableHashSet.has(elementNameSet, f)) {
        const bucket = MutableHashMap.get(elemAttrs, f);
        if (O.isSome(bucket)) MutableHashSet.add(bucket.value, attr);
      }
    }
  }

  // "element/attr" (or "group/attr") -> permitted value keywords
  const enumValues = MutableHashMap.empty<string, Array<string>>();
  for (const av of dfns.filter((d) => d.type === "attr-value")) {
    for (const f of av.for ?? []) {
      const arr = MutableHashMap.get(enumValues, f).pipe(O.getOrElse((): Array<string> => []));
      arr.push(av.linkingText[0]);
      MutableHashMap.set(enumValues, f, arr);
    }
  }

  const interfaceByName = MutableHashMap.empty<string, string>();
  for (const e of elementsData) MutableHashMap.set(interfaceByName, e.name, e.interface);

  const globalKeys = MutableHashSet.fromIterable<string>(R.keys(GlobalAttributes));
  const autocompleteAttrs = MutableHashSet.fromIterable(classification.autocompleteAttributes);
  const booleanAttrs = MutableHashSet.fromIterable(classification.booleanAttributes);
  const integerAttrs = MutableHashSet.fromIterable(classification.integerAttributes);
  const nonNegativeIntegerAttrs = MutableHashSet.fromIterable(classification.nonNegativeIntegerAttributes);
  const positiveIntegerAttrs = MutableHashSet.fromIterable(classification.positiveIntegerAttributes);
  const spaceSeparatedTokenAttrs = MutableHashSet.fromIterable(classification.spaceSeparatedTokenAttributes);
  const stringAttrs = MutableHashSet.fromIterable(classification.stringAttributes);
  const voidEls = MutableHashSet.fromIterable(classification.void);
  const rawTextEls = MutableHashSet.fromIterable(classification.rawText);
  const rcDataEls = MutableHashSet.fromIterable(classification.rcData);
  const plaintextEls = MutableHashSet.fromIterable(classification.plaintext);
  const normalEls = MutableHashSet.fromIterable(classification.normal);
  const emptyContentModelEls = MutableHashSet.fromIterable(classification.emptyContentModelElements);
  const isClassifiedAs = (
    classificationSet: MutableHashSet.MutableHashSet<string>,
    element: string,
    attribute: string
  ): boolean =>
    MutableHashSet.has(classificationSet, `${element}/${attribute}`) ||
    MutableHashSet.has(classificationSet, attribute);

  const elementClassifications = [voidEls, rawTextEls, rcDataEls, plaintextEls, normalEls];
  for (const tag of elementNames) {
    const matches = elementClassifications.filter((classificationSet) =>
      MutableHashSet.has(classificationSet, tag)
    ).length;
    if (matches !== 1) {
      throw new Error(`HTML generator requires exactly one element classification for <${tag}>; found ${matches}`);
    }
    const hasPinnedContentModel = contentModel[tag] !== undefined;
    const hasExplicitEmptyContentModel = MutableHashSet.has(emptyContentModelEls, tag);
    if (hasPinnedContentModel === hasExplicitEmptyContentModel) {
      throw new Error(
        `HTML generator requires exactly one content-model source for <${tag}> (pinned or explicit empty override)`
      );
    }
  }

  for (const [classificationName, classificationSet] of [
    ["void", voidEls],
    ["rawText", rawTextEls],
    ["rcData", rcDataEls],
    ["plaintext", plaintextEls],
    ["normal", normalEls],
    ["emptyContentModelElements", emptyContentModelEls],
  ] as const) {
    for (const tag of classificationSet) {
      if (!MutableHashSet.has(elementNameSet, tag)) {
        throw new Error(`HTML generator ${classificationName} classification names unknown element <${tag}>`);
      }
    }
  }
  for (const [tag, pattern] of R.toEntries(classification.childSequencePatterns)) {
    if (!MutableHashSet.has(elementNameSet, tag)) {
      throw new Error(`HTML generator child-sequence pattern names unknown element <${tag}>`);
    }
    try {
      new RegExp(pattern, "u");
    } catch {
      throw new Error(`HTML generator child-sequence pattern for <${tag}> is not a valid Unicode regexp`);
    }
  }

  const valueSchema = (el: string, attr: string): AttributeSpec => {
    if (isClassifiedAs(booleanAttrs, el, attr)) {
      return {
        runtime: optionalRuntime("BooleanAttribute"),
        type: 'O.Option<true | "">',
        encoded: 'true | ""',
      };
    }
    if (isClassifiedAs(autocompleteAttrs, el, attr)) {
      return {
        runtime: optionalRuntime("AutocompleteAttribute"),
        type: "O.Option<string>",
        encoded: "string",
      };
    }
    const valsOption = MutableHashMap.get(enumValues, `${el}/${attr}`);
    if (isClassifiedAs(spaceSeparatedTokenAttrs, el, attr) && O.isSome(valsOption) && valsOption.value.length > 0) {
      const uniq = [...MutableHashSet.fromIterable(valsOption.value)];
      return {
        runtime: optionalRuntime(`makeSpaceSeparatedTokenList(${JSON.stringify(uniq)})`),
        type: "O.Option<string>",
        encoded: "string",
      };
    }
    if (O.isSome(valsOption) && valsOption.value.length > 0) {
      const uniq = [...MutableHashSet.fromIterable(valsOption.value)];
      const schema =
        uniq.length === 1 ? `S.Literal(${JSON.stringify(uniq[0])})` : `S.Literals(${JSON.stringify(uniq)})`;
      const union = literalUnion(uniq);
      return {
        runtime: optionalRuntime(schema),
        type: `O.Option<${union}>`,
        encoded: union,
      };
    }
    const bounded = classification.boundedIntegerAttributes[attr];
    if (bounded !== undefined) {
      return {
        runtime: optionalRuntime(`S.Int.check(S.isBetween({ minimum: ${bounded[0]}, maximum: ${bounded[1]} }))`),
        type: "O.Option<number>",
        encoded: "number",
      };
    }
    if (isClassifiedAs(positiveIntegerAttrs, el, attr)) {
      return {
        runtime: optionalRuntime("HtmlPositiveInteger"),
        type: "O.Option<number>",
        encoded: "number",
      };
    }
    if (isClassifiedAs(nonNegativeIntegerAttrs, el, attr)) {
      return {
        runtime: optionalRuntime("HtmlNonNegativeInteger"),
        type: "O.Option<number>",
        encoded: "number",
      };
    }
    if (isClassifiedAs(integerAttrs, el, attr)) {
      return {
        runtime: optionalRuntime("S.Int"),
        type: "O.Option<number>",
        encoded: "number",
      };
    }
    if (isClassifiedAs(stringAttrs, el, attr)) {
      return {
        runtime: optionalRuntime("S.String"),
        type: "O.Option<string>",
        encoded: "string",
      };
    }
    throw new Error(`HTML generator has no attribute classification for ${el}/${attr}`);
  };

  // Generated runtime field body + TS type bodies for an element's specific
  // attributes (globals/`_tag`/children excluded).
  const specificBodies = (el: string): { encoded: string; runtime: string; type: string } => {
    const attrBucket = MutableHashMap.get(elemAttrs, el).pipe(
      O.getOrElse((): MutableHashSet.MutableHashSet<string> => MutableHashSet.empty())
    );
    const attrs = [...attrBucket].filter((a) => !MutableHashSet.has(globalKeys, a)).sort();
    if (attrs.length === 0) return { encoded: "", runtime: "", type: "" };
    const fields = attrs.map((attr) => [attr, valueSchema(el, attr)] as const);
    return {
      runtime: fields.map(([attr, spec]) => `${JSON.stringify(attr)}: ${spec.runtime}`).join(", "),
      type: fields.map(([attr, spec]) => `readonly ${JSON.stringify(attr)}: ${spec.type}`).join("; "),
      encoded: fields.map(([attr, spec]) => `readonly ${JSON.stringify(attr)}?: ${spec.encoded}`).join("; "),
    };
  };

  const interfaceOf = (name: string, obsolete: boolean): string =>
    MutableHashMap.get(interfaceByName, name).pipe(
      O.getOrElse(() => obsoleteInterfaces[name] ?? (obsolete ? "HTMLUnknownElement" : "HTMLElement"))
    );

  const els: ReadonlyArray<El> = [...elementNames].sort().map((tag): El => {
    const d = elementDfns.find((x) => x.linkingText[0] === tag);
    const obsolete = isObsolete(d);
    const kind: Kind = MutableHashSet.has(voidEls, tag)
      ? "void"
      : MutableHashSet.has(rawTextEls, tag) ||
          MutableHashSet.has(rcDataEls, tag) ||
          MutableHashSet.has(plaintextEls, tag)
        ? "text"
        : "normal";
    const textMode: TextMode = MutableHashSet.has(plaintextEls, tag)
      ? "plaintext"
      : MutableHashSet.has(rcDataEls, tag)
        ? "rcdata"
        : MutableHashSet.has(rawTextEls, tag)
          ? "raw-text"
          : "normal";
    const { encoded, runtime, type } = specificBodies(tag);
    return {
      tag,
      cls: className(tag),
      encoded,
      obsolete,
      kind,
      iface: interfaceOf(tag, obsolete),
      categories: contentModel[tag]?.categories ?? [],
      children: contentModel[tag]?.children ?? [],
      childSequencePattern: classification.childSequencePatterns[tag],
      runtime,
      textMode,
      type,
    };
  });

  const childField = (kind: Kind): string =>
    kind === "void" ? "" : kind === "text" ? "    content: S.String," : "    children: HtmlChildren,";

  const childTypeField = (kind: Kind, encoded: boolean): string =>
    kind === "void"
      ? ""
      : kind === "text"
        ? "    readonly content: string;"
        : `    readonly children: HtmlChildren.${encoded ? "Encoded" : "Type"};`;

  // `.make()` call argument body for a class example, driven by element `kind`.
  const exampleArgs = (kind: Kind): string =>
    kind === "void" ? "{}" : kind === "text" ? '{ content: "" }' : "{ children: [] }";

  // `Encoded`-literal body for a companion-namespace example, driven by element `kind`.
  const exampleEncoded = (tag: string, kind: Kind): string =>
    kind === "void"
      ? `{ _tag: "${tag}" }`
      : kind === "text"
        ? `{ _tag: "${tag}", content: "" }`
        : `{ _tag: "${tag}", children: [] }`;

  const elementBlock = (e: El): string => {
    const desc = `The <${e.tag}> element.${e.obsolete ? " Obsolete / non-conforming (WHATWG §16.2)." : ""}`;
    const runtimeFields = ["    ...GlobalAttributes,", e.runtime !== "" ? `    ${e.runtime},` : "", childField(e.kind)]
      .filter((l) => l !== "")
      .join("\n");
    const typeFields = (encoded: boolean): string =>
      [
        `    readonly _tag: "${e.tag}";`,
        encoded ? (e.encoded !== "" ? `    ${e.encoded};` : "") : e.type !== "" ? `    ${e.type};` : "",
        childTypeField(e.kind, encoded),
      ]
        .filter((l) => l !== "")
        .join("\n");
    return `/**
 * ${desc}
 *
 * @example
 * \`\`\`ts
 * import { ${e.cls} } from "@beep/html/Html.model"
 *
 * const node = ${e.cls}.make(${exampleArgs(e.kind)})
 * console.log(node._tag) // "${e.tag}"
 * \`\`\`
 *
 * @category elements
 * @since 0.0.0
 */
export class ${e.cls} extends S.TaggedClass<${e.cls}>($I\`${e.cls}\`)(
  "${e.tag}",
  {
${runtimeFields}
  },
  $I.annote("${e.cls}", { description: ${JSON.stringify(desc)} })
) {}
/**
 * Companion namespace for {@link ${e.cls}}.
 *
 * @example
 * \`\`\`ts
 * import { ${e.cls} } from "@beep/html/Html.model"
 *
 * const encoded: ${e.cls}.Encoded = ${exampleEncoded(e.tag, e.kind)}
 * console.log(encoded._tag) // "${e.tag}"
 * \`\`\`
 *
 * @category elements
 * @since 0.0.0
 */
export declare namespace ${e.cls} {
  /** @since 0.0.0 */
  export type Type = GlobalAttributesType & {
${typeFields(false)}
  };
  /** @since 0.0.0 */
  export type Encoded = GlobalAttributesEncoded & {
${typeFields(true)}
  };
}`;
  };

  const containerNode = (cls: string, tag: string, desc: string): string =>
    `/**
 * ${desc}
 *
 * @example
 * \`\`\`ts
 * import { ${cls} } from "@beep/html/Html.model"
 *
 * const node = ${cls}.make(${exampleArgs("normal")})
 * console.log(node._tag) // "${tag}"
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export class ${cls} extends S.TaggedClass<${cls}>($I\`${cls}\`)(
  "${tag}",
  { children: HtmlChildren },
  $I.annote("${cls}", { description: ${JSON.stringify(desc)} })
) {}
/**
 * Companion namespace for {@link ${cls}}.
 *
 * @example
 * \`\`\`ts
 * import { ${cls} } from "@beep/html/Html.model"
 *
 * const encoded: ${cls}.Encoded = ${exampleEncoded(tag, "normal")}
 * console.log(encoded._tag) // "${tag}"
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace ${cls} {
  /** @since 0.0.0 */
  export type Type = { readonly _tag: "${tag}"; readonly children: HtmlChildren.Type };
  /** @since 0.0.0 */
  export type Encoded = { readonly _tag: "${tag}"; readonly children: HtmlChildren.Encoded };
}`;

  const documentNode = `/**
 * An HTML document root with an optional doctype and child nodes.
 *
 * @example
 * \`\`\`ts
 * import { Document } from "@beep/html/Html.model"
 *
 * const document = Document.make({ children: [] })
 * console.log(document._tag) // "#document"
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export class Document extends S.TaggedClass<Document>($I\`Document\`)(
  "#document",
  {
    doctype: S.OptionFromOptionalKey(Doctype).pipe(SchemaUtils.withNoneDefault),
    children: HtmlChildren,
  },
  $I.annote("Document", { description: "An HTML document root." })
) {}

/**
 * Companion namespace for {@link Document}.
 *
 * @example
 * \`\`\`ts
 * import type { Document } from "@beep/html/Html.model"
 *
 * const document: Document.Encoded = { _tag: "#document", children: [] }
 * console.log(document._tag) // "#document"
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Document {
  /** @since 0.0.0 */
  export type Type = {
    readonly _tag: "#document";
    readonly doctype: O.Option<Doctype.Type>;
    readonly children: HtmlChildren.Type;
  };
  /** @since 0.0.0 */
  export type Encoded = {
    readonly _tag: "#document";
    readonly doctype?: Doctype.Encoded;
    readonly children: HtmlChildren.Encoded;
  };
}`;

  const foreignNode = `/**
 * Namespace of a foreign-content element embedded in HTML.
 *
 * @example
 * \`\`\`ts
 * import { ForeignNamespace } from "@beep/html/Html.model"
 *
 * console.log(ForeignNamespace.is.svg("svg")) // true
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export const ForeignNamespace = LiteralKit(["svg", "mathml"]).pipe(
  $I.annoteSchema("ForeignNamespace", { description: "SVG or MathML foreign-content namespace." })
);

/**
 * Decoded type of {@link ForeignNamespace}.
 *
 * @example
 * \`\`\`ts
 * import type { ForeignNamespace } from "@beep/html/Html.model"
 *
 * const namespace: ForeignNamespace = "svg"
 * console.log(namespace)
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export type ForeignNamespace = typeof ForeignNamespace.Type;

/**
 * An opaque SVG or MathML element carried inside the HTML AST.
 *
 * @remarks
 * This package validates the foreign node's serializable shape but does not
 * model the complete SVG or MathML vocabularies.
 *
 * @example
 * \`\`\`ts
 * import { ForeignElement } from "@beep/html/Html.model"
 *
 * const svg = ForeignElement.make({ namespace: "svg", name: "svg", children: [] })
 * console.log(svg.name) // "svg"
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export class ForeignElement extends S.TaggedClass<ForeignElement>($I\`ForeignElement\`)(
  "#foreign",
  {
    namespace: ForeignNamespace,
    name: ForeignElementName,
    attributes: S.OptionFromOptionalKey(S.Record(ForeignAttributeName, S.String)).pipe(
      SchemaUtils.withNoneDefault
    ),
    children: HtmlChildren,
  },
  $I.annote("ForeignElement", { description: "Opaque SVG or MathML element embedded in HTML." })
) {}

/**
 * Companion namespace for {@link ForeignElement}.
 *
 * @example
 * \`\`\`ts
 * import type { ForeignElement } from "@beep/html/Html.model"
 *
 * const svg: ForeignElement.Encoded = {
 *   _tag: "#foreign",
 *   namespace: "svg",
 *   name: "svg",
 *   children: []
 * }
 * console.log(svg.name) // "svg"
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace ForeignElement {
  /** @since 0.0.0 */
  export type Type = {
    readonly _tag: "#foreign";
    readonly namespace: ForeignNamespace;
    readonly name: string;
    readonly attributes: O.Option<Readonly<Record<string, string>>>;
    readonly children: HtmlChildren.Type;
  };
  /** @since 0.0.0 */
  export type Encoded = {
    readonly _tag: "#foreign";
    readonly namespace: ForeignNamespace;
    readonly name: string;
    readonly attributes?: Readonly<Record<string, string>>;
    readonly children: HtmlChildren.Encoded;
  };
}`;

  const childMembers = [...els.map((e) => e.cls), "ForeignElement", "Text", "Comment"];
  const rootMembers = [...childMembers, "Document", "Fragment"];
  const unionMembers = [...rootMembers, "Doctype"];

  const categoryUnion = (name: string, cat: string): string => {
    const matching = els.filter((e) => e.categories.includes(cat));
    if (matching.length === 0) return "";
    const members = matching.map((e) => e.cls);
    const types = members.map((m) => `${m}.Type`).join(" | ");
    const encodeds = members.map((m) => `${m}.Encoded`).join(" | ");
    const representative = matching[0]!;
    return `/**
 * Advisory sub-union of elements in the "${cat}" content category. Non-normative
 * (derived from the WHATWG element index); see \`data/SOURCES.md\`.
 *
 * @example
 * \`\`\`ts
 * import { ${representative.cls}, ${name} } from "@beep/html/Html.model"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(${name})(${representative.cls}.make(${exampleArgs(representative.kind)}))) // true
 * \`\`\`
 *
 * @category schemas
 * @since 0.0.0
 */
export const ${name} = taggedUnion<${types}, ${encodeds}>(
  "${name}",
  "Advisory ${cat}-content element union.",
  [${members.join(", ")}]
);`;
  };

  const header = `/**
 * GENERATED FILE — do not edit by hand. Run \`bun run generate\`.
 *
 * Exhaustive, schema-first AST of the WHATWG HTML specification (conforming +
 * obsolete elements). Each element is an \`S.TaggedClass\` whose \`_tag\` is its tag
 * name; all are combined into the {@link HtmlNode} discriminated union via
 * \`S.toTaggedUnion("_tag")\`. Generated from the vendored datasets in \`data/\`
 * (see \`data/SOURCES.md\`); attribute field bodies/types are emitted from the
 * generator's schema-first attribute specs.
 *
 * @packageDocumentation \\@beep/html/Html.model
 * @since 0.0.0
 */
import { $HtmlId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import {
  AutocompleteAttribute,
  BooleanAttribute,
  ForeignAttributeName,
  ForeignElementName,
  GlobalAttributes,
  HtmlNonNegativeInteger,
  HtmlPositiveInteger,
  makeSpaceSeparatedTokenList,
} from "./Html.attributes.ts";
import { Comment, Doctype, Text } from "./Html.nodes.ts";
import type { GlobalAttributesEncoded, GlobalAttributesType } from "./Html.attributes.ts";
import type * as O from "effect/Option";

const $I = $HtmlId.create("Html.model");

type Tagged = { readonly _tag: PropertyKey };
type TaggedSchema<A extends Tagged, E extends Tagged> = S.Codec<A, E> & {
  readonly Type: A;
  readonly Encoded: E;
};
type TaggedMembers<A extends Tagged, E extends Tagged> = readonly [
  TaggedSchema<A, E>,
  ...ReadonlyArray<TaggedSchema<A, E>>,
];

/**
 * Build a large \`_tag\`-discriminated union without erasing member Type or
 * Encoded information.
 *
 * @category models
 * @since 0.0.0
 */
const taggedUnion = <A extends Tagged, E extends Tagged>(
  id: string,
  description: string,
  members: TaggedMembers<A, E>
) =>
  S.Union(members).pipe(
    S.toTaggedUnion("_tag"),
    $I.annoteSchema(id, { description }),
    S.revealCodec
  );

/**
 * Recursive list of nodes that may occur as element or fragment children.
 *
 * @example
 * \`\`\`ts
 * import { HtmlChildren } from "@beep/html/Html.model"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(HtmlChildren)([])) // true
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export const HtmlChildren = S.Array(S.suspend((): S.Codec<HtmlChild.Type, HtmlChild.Encoded> => HtmlChild)).pipe(
  $I.annoteSchema("HtmlChildren", { description: "Recursive list of HTML AST child nodes." })
);
/**
 * Decoded type of {@link HtmlChildren}.
 *
 * @example
 * \`\`\`ts
 * import type { HtmlChildren } from "@beep/html/Html.model"
 *
 * const children: HtmlChildren = []
 * console.log(children.length) // 0
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export type HtmlChildren = typeof HtmlChildren.Type;
/**
 * Companion namespace for {@link HtmlChildren}.
 *
 * @example
 * \`\`\`ts
 * import type { HtmlChildren } from "@beep/html/Html.model"
 *
 * const children: HtmlChildren.Type = []
 * console.log(children.length) // 0
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace HtmlChildren {
  /** @since 0.0.0 */
  export type Type = ReadonlyArray<HtmlChild.Type>;
  /** @since 0.0.0 */
  export type Encoded = ReadonlyArray<HtmlChild.Encoded>;
}`;

  const unionBlock = `/**
 * Discriminated union of nodes valid as element or fragment children.
 *
 * @example
 * \`\`\`ts
 * import { HtmlChild } from "@beep/html/Html.model"
 * import { Text } from "@beep/html/Html.nodes"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(HtmlChild)(Text.make({ value: "hello" }))) // true
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export const HtmlChild = taggedUnion<HtmlChild.Type, HtmlChild.Encoded>(
  "HtmlChild",
  "Nodes valid as element or fragment children.",
  [${childMembers.join(", ")}]
);

/**
 * Companion namespace for {@link HtmlChild}.
 *
 * @example
 * \`\`\`ts
 * import type { HtmlChild } from "@beep/html/Html.model"
 *
 * const child: HtmlChild.Encoded = { _tag: "#text", value: "hello" }
 * console.log(child._tag) // "#text"
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace HtmlChild {
  /** @since 0.0.0 */
  export type Type =
${childMembers.map((m) => `    | ${m}.Type`).join("\n")};
  /** @since 0.0.0 */
  export type Encoded =
${childMembers.map((m) => `    | ${m}.Encoded`).join("\n")};
}

/**
 * Discriminated union of serializable HTML roots.
 *
 * @example
 * \`\`\`ts
 * import { Fragment, HtmlRoot } from "@beep/html/Html.model"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(HtmlRoot)(Fragment.make({ children: [] }))) // true
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export const HtmlRoot = taggedUnion<HtmlRoot.Type, HtmlRoot.Encoded>(
  "HtmlRoot",
  "HTML document, fragment, element, or child-node root.",
  [${rootMembers.join(", ")}]
);

/**
 * Companion namespace for {@link HtmlRoot}.
 *
 * @example
 * \`\`\`ts
 * import type { HtmlRoot } from "@beep/html/Html.model"
 *
 * const root: HtmlRoot.Encoded = { _tag: "#fragment", children: [] }
 * console.log(root._tag) // "#fragment"
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace HtmlRoot {
  /** @since 0.0.0 */
  export type Type =
${rootMembers.map((m) => `    | ${m}.Type`).join("\n")};
  /** @since 0.0.0 */
  export type Encoded =
${rootMembers.map((m) => `    | ${m}.Encoded`).join("\n")};
}

/**
 * Discriminated union of every HTML AST node — all ${els.length} elements plus the
 * text, comment, foreign, doctype, document, and fragment node kinds.
 *
 * @example
 * \`\`\`ts
 * import { A, HtmlNode } from "@beep/html/Html.model"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(HtmlNode)(A.make({ children: [] }))) // true
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export const HtmlNode = taggedUnion<HtmlNode.Type, HtmlNode.Encoded>(
  "HtmlNode",
  "Discriminated union of all HTML AST nodes.",
  [${unionMembers.join(", ")}]
);
/**
 * Companion namespace for {@link HtmlNode}.
 *
 * @example
 * \`\`\`ts
 * import { A } from "@beep/html/Html.model"
 * import type { HtmlNode } from "@beep/html/Html.model"
 *
 * const node: HtmlNode.Type = A.make({ children: [] })
 * console.log(node._tag) // "a"
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace HtmlNode {
  /** @since 0.0.0 */
  export type Type =
${unionMembers.map((m) => `    | ${m}.Type`).join("\n")};
  /** @since 0.0.0 */
  export type Encoded =
${unionMembers.map((m) => `    | ${m}.Encoded`).join("\n")};
}`;

  const model = [
    header,
    containerNode("Fragment", "#fragment", "A document fragment node (a detached group of children)."),
    documentNode,
    foreignNode,
    ...els.map(elementBlock),
    unionBlock,
    ...CATEGORIES.map(([n, c]) => categoryUnion(n, c)).filter((s) => s !== ""),
  ].join("\n\n");

  const metaEntries = els
    .map((e) => {
      const conformance = e.obsolete ? "non-conforming" : "conforming";
      const childSequencePattern =
        e.childSequencePattern === undefined ? "" : ` childSequencePattern: ${JSON.stringify(e.childSequencePattern)},`;
      return `  "${e.tag}": { tag: "${e.tag}", interface: "${e.iface}", conformance: "${conformance}", void: ${e.kind === "void"}, rawText: ${e.textMode === "raw-text"}, textMode: "${e.textMode}", categories: ${JSON.stringify(e.categories)}, children: ${JSON.stringify(e.children)},${childSequencePattern} },`;
    })
    .join("\n");

  const tagValues = JSON.stringify(els.map((element) => element.tag));
  const categoryValues = JSON.stringify(
    [...MutableHashSet.fromIterable(els.flatMap((element) => element.categories))].sort()
  );
  const contentTokenValues = JSON.stringify(
    [...MutableHashSet.fromIterable(els.flatMap((element) => element.children))].sort()
  );
  const booleanAttributeValues = JSON.stringify([...booleanAttrs].sort());

  const meta = `/**
 * GENERATED FILE — do not edit by hand. Run \`bun run generate\`.
 *
 * Per-element metadata for the HTML AST: DOM interface, conformance tier, void /
 * raw-text classification, and (advisory) content categories.
 *
 * @packageDocumentation \\@beep/html/Html.meta
 * @since 0.0.0
 */
import { $HtmlId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $HtmlId.create("Html.meta");

/**
 * Exact generated HTML element-tag domain.
 *
 * @example
 * \`\`\`ts
 * import { HtmlTag } from "@beep/html/Html.meta"
 *
 * console.log(HtmlTag.is.div("div")) // true
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export const HtmlTag = LiteralKit(${tagValues}).pipe(
  $I.annoteSchema("HtmlTag", { description: "Exact generated HTML element-tag domain." })
);

/**
 * Decoded HTML element tag.
 *
 * @example
 * \`\`\`ts
 * import type { HtmlTag } from "@beep/html/Html.meta"
 *
 * const tag: HtmlTag = "div"
 * console.log(tag)
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export type HtmlTag = typeof HtmlTag.Type;

/**
 * Advisory content-category values emitted by the WHATWG element index.
 *
 * @example
 * \`\`\`ts
 * import { HtmlCategory } from "@beep/html/Html.meta"
 *
 * console.log(HtmlCategory.is.flow("flow")) // true
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export const HtmlCategory = LiteralKit(${categoryValues}).pipe(
  $I.annoteSchema("HtmlCategory", { description: "Advisory WHATWG content-category value." })
);

/**
 * Decoded advisory content category.
 *
 * @example
 * \`\`\`ts
 * import type { HtmlCategory } from "@beep/html/Html.meta"
 *
 * const category: HtmlCategory = "flow"
 * console.log(category)
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export type HtmlCategory = typeof HtmlCategory.Type;

/**
 * Content-model tokens emitted by the pinned WHATWG element index.
 *
 * @example
 * \`\`\`ts
 * import { HtmlContentToken } from "@beep/html/Html.meta"
 *
 * console.log(HtmlContentToken.is.flow("flow")) // true
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export const HtmlContentToken = LiteralKit(${contentTokenValues}).pipe(
  $I.annoteSchema("HtmlContentToken", { description: "Pinned HTML content-model token." })
);

/**
 * Decoded HTML content-model token.
 *
 * @example
 * \`\`\`ts
 * import type { HtmlContentToken } from "@beep/html/Html.meta"
 *
 * const token: HtmlContentToken = "flow"
 * console.log(token)
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export type HtmlContentToken = typeof HtmlContentToken.Type;

/**
 * Text parsing and serialization mode of an HTML element.
 *
 * @example
 * \`\`\`ts
 * import { HtmlTextMode } from "@beep/html/Html.meta"
 *
 * console.log(HtmlTextMode.is.rcdata("rcdata")) // true
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export const HtmlTextMode = LiteralKit(["normal", "raw-text", "rcdata", "plaintext"]).pipe(
  $I.annoteSchema("HtmlTextMode", { description: "HTML text parsing and serialization mode." })
);

/**
 * Decoded HTML text mode.
 *
 * @example
 * \`\`\`ts
 * import type { HtmlTextMode } from "@beep/html/Html.meta"
 *
 * const mode: HtmlTextMode = "normal"
 * console.log(mode)
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export type HtmlTextMode = typeof HtmlTextMode.Type;

/**
 * Authoritative generated domain of HTML boolean attribute names.
 *
 * @example
 * \`\`\`ts
 * import { HtmlBooleanAttributeName } from "@beep/html/Html.meta"
 *
 * console.log(HtmlBooleanAttributeName.is.disabled("disabled")) // true
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export const HtmlBooleanAttributeName = LiteralKit(${booleanAttributeValues}).pipe(
  $I.annoteSchema("HtmlBooleanAttributeName", {
    description: "Authoritative HTML boolean attribute-name domain used by generation and serialization.",
  })
);

/**
 * Decoded HTML boolean attribute name.
 *
 * @category models
 * @since 0.0.0
 */
export type HtmlBooleanAttributeName = typeof HtmlBooleanAttributeName.Type;

/**
 * Schema describing one HTML element kind's metadata.
 *
 * @example
 * \`\`\`ts
 * import { HtmlElementMeta } from "@beep/html/Html.meta"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(HtmlElementMeta)({
 *   tag: "div",
 *   interface: "HTMLDivElement",
 *   conformance: "conforming",
 *   void: false,
 *   rawText: false,
 *   categories: ["flow"]
 * })) // true
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export class HtmlElementMeta extends S.Class<HtmlElementMeta>($I\`HtmlElementMeta\`)(
  {
    tag: HtmlTag,
    interface: S.NonEmptyString,
    conformance: S.Literals(["conforming", "non-conforming"]),
    void: S.Boolean,
    rawText: S.Boolean,
    textMode: HtmlTextMode,
    categories: S.Array(HtmlCategory),
    children: S.Array(HtmlContentToken),
    childSequencePattern: S.String.pipe(S.optionalKey),
  },
  $I.annote("HtmlElementMeta", { description: "Metadata describing one HTML element kind." })
) {}

/**
 * Metadata for every generated HTML element, keyed by tag name.
 *
 * @example
 * \`\`\`ts
 * import { ELEMENT_META } from "@beep/html/Html.meta"
 *
 * console.log(ELEMENT_META.div.interface) // "HTMLDivElement"
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export const ELEMENT_META: Readonly<Record<HtmlTag, HtmlElementMeta>> = {
${metaEntries}
};
`;

  const conforming = els.filter((e) => !e.obsolete).length;
  return { model, meta, conforming, total: els.length };
};

// ---------------------------------------------------------------------------
// IO program
// ---------------------------------------------------------------------------

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const pkgRoot = path.resolve(import.meta.dirname, "..");
  const dataDir = path.join(pkgRoot, "data");
  const srcDir = path.join(pkgRoot, "src");

  const readJson = <Schema extends S.Top>(schema: Schema, rel: string) =>
    fs.readFileString(path.join(dataDir, rel)).pipe(Effect.flatMap(S.decodeUnknownEffect(S.fromJsonString(schema))));

  const dfnsDoc = yield* readJson(DfnsDoc, "webref/dfns-html.json");
  const elementsDoc = yield* readJson(ElementsDoc, "webref/elements-html.json");
  const cmDoc = yield* readJson(ContentModelDoc, "whatwg/content-model.json");
  const classification = yield* readJson(Classification, "overrides/classification.json");
  const obsDoc = yield* readJson(ObsoleteInterfacesDoc, "overrides/obsolete-interfaces.json");

  const { conforming, meta, model, total } = buildModel({
    dfns: dfnsDoc.dfns,
    elements: elementsDoc.elements,
    contentModel: cmDoc.elements,
    classification,
    obsoleteInterfaces: obsDoc.interfaces,
  });

  yield* fs.writeFileString(path.join(srcDir, "Html.model.ts"), model);
  yield* fs.writeFileString(path.join(srcDir, "Html.meta.ts"), meta);

  yield* Effect.log(
    `generated ${total} elements (${conforming} conforming, ${total - conforming} obsolete) + 6 node kinds -> src/Html.model.ts, src/Html.meta.ts`
  );
});

const runtimeLayer = Layer.mergeAll(Logger.layer([Logger.consolePretty()]), NodeServices.layer);

const main = Effect.scoped(
  Layer.build(runtimeLayer).pipe(Effect.flatMap((context) => Effect.provide(program, context)))
);

NodeRuntime.runMain(main);
