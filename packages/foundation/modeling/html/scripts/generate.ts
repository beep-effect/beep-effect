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
import { Effect, FileSystem, Layer, Logger, Path } from "effect";
import * as S from "effect/Schema";
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
const RESERVED = new Set([
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
  const pascal = tag.charAt(0).toUpperCase() + tag.slice(1);
  return RESERVED.has(pascal) ? `${pascal}Element` : pascal;
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

type Kind = "void" | "rawText" | "normal";

interface AttributeSpec {
  readonly encoded: string;
  readonly runtime: string;
  readonly type: string;
}

interface El {
  readonly categories: ReadonlyArray<string>;
  readonly cls: string;
  readonly encoded: string;
  readonly iface: string;
  readonly kind: Kind;
  readonly obsolete: boolean;
  readonly runtime: string;
  readonly tag: string;
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
  },
  $I.annote("ContentModelEntry", { description: "WHATWG content-model metadata for one element." })
) {}

class Classification extends S.Class<Classification>($I`Classification`)(
  {
    booleanAttributes: S.Array(S.String),
    numericAttributes: S.Array(S.String),
    rawText: S.Array(S.String),
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
  const elementNameSet = new Set(elementNames);
  const isObsolete = (d: Dfn | undefined): boolean => d !== undefined && /\/obsolete\.html/.test(d.href);

  // element -> specific attribute names (webref `for` arrays already expand
  // groups to concrete element names; the only non-element `for` tokens are the
  // global groups, which we skip).
  const elemAttrs = new Map<string, Set<string>>();
  for (const name of elementNames) elemAttrs.set(name, new Set());
  for (const ea of dfns.filter((d) => d.type === "element-attr")) {
    const attr = ea.linkingText[0];
    for (const f of ea.for ?? []) {
      if (elementNameSet.has(f)) elemAttrs.get(f)!.add(attr);
    }
  }

  // "element/attr" (or "group/attr") -> permitted value keywords
  const enumValues = new Map<string, Array<string>>();
  for (const av of dfns.filter((d) => d.type === "attr-value")) {
    for (const f of av.for ?? []) {
      let arr = enumValues.get(f);
      if (arr === undefined) {
        arr = [];
        enumValues.set(f, arr);
      }
      arr.push(av.linkingText[0]);
    }
  }

  const interfaceByName = new Map<string, string>();
  for (const e of elementsData) interfaceByName.set(e.name, e.interface);

  const globalKeys = new Set(Object.keys(GlobalAttributes));
  const booleanAttrs = new Set<string>(classification.booleanAttributes);
  const numericAttrs = new Set<string>(classification.numericAttributes);
  const voidEls = new Set<string>(classification.void);
  const rawTextEls = new Set<string>(classification.rawText);

  const valueSchema = (el: string, attr: string): AttributeSpec => {
    // HTML boolean attributes accept true/false and the empty-string presence
    // form (`disabled=""`); mirror the hand-authored `BooleanAttribute` overlay.
    if (booleanAttrs.has(attr)) {
      return {
        runtime: optionalRuntime('S.Union([S.Boolean, S.Literal("")])'),
        type: 'O.Option<boolean | "">',
        encoded: 'boolean | ""',
      };
    }
    const vals = enumValues.get(`${el}/${attr}`);
    if (vals !== undefined && vals.length > 0) {
      const uniq = [...new Set(vals)];
      const schema =
        uniq.length === 1 ? `S.Literal(${JSON.stringify(uniq[0])})` : `S.Literals(${JSON.stringify(uniq)})`;
      const union = literalUnion(uniq);
      return {
        runtime: optionalRuntime(schema),
        type: `O.Option<${union}>`,
        encoded: union,
      };
    }
    if (numericAttrs.has(attr)) {
      return {
        runtime: optionalRuntime("S.Int"),
        type: "O.Option<number>",
        encoded: "number",
      };
    }
    return {
      runtime: optionalRuntime("S.String"),
      type: "O.Option<string>",
      encoded: "string",
    };
  };

  // Generated runtime field body + TS type bodies for an element's specific
  // attributes (globals/`_tag`/children excluded).
  const specificBodies = (el: string): { encoded: string; runtime: string; type: string } => {
    const attrs = [...elemAttrs.get(el)!].filter((a) => !globalKeys.has(a)).sort();
    if (attrs.length === 0) return { encoded: "", runtime: "", type: "" };
    const fields = attrs.map((attr) => [attr, valueSchema(el, attr)] as const);
    return {
      runtime: fields.map(([attr, spec]) => `${JSON.stringify(attr)}: ${spec.runtime}`).join(", "),
      type: fields.map(([attr, spec]) => `readonly ${JSON.stringify(attr)}: ${spec.type}`).join("; "),
      encoded: fields.map(([attr, spec]) => `readonly ${JSON.stringify(attr)}?: ${spec.encoded}`).join("; "),
    };
  };

  const interfaceOf = (name: string, obsolete: boolean): string =>
    interfaceByName.get(name) ?? obsoleteInterfaces[name] ?? (obsolete ? "HTMLUnknownElement" : "HTMLElement");

  const els: ReadonlyArray<El> = [...elementNames].sort().map((tag): El => {
    const d = elementDfns.find((x) => x.linkingText[0] === tag);
    const obsolete = isObsolete(d);
    const kind: Kind = voidEls.has(tag) ? "void" : rawTextEls.has(tag) ? "rawText" : "normal";
    const { encoded, runtime, type } = specificBodies(tag);
    return {
      tag,
      cls: className(tag),
      encoded,
      obsolete,
      kind,
      iface: interfaceOf(tag, obsolete),
      categories: contentModel[tag]?.categories ?? [],
      runtime,
      type,
    };
  });

  const childField = (kind: Kind): string =>
    kind === "void" ? "" : kind === "rawText" ? "    content: S.String," : "    children: HtmlChildren,";

  const childTypeField = (kind: Kind, encoded: boolean): string =>
    kind === "void"
      ? ""
      : kind === "rawText"
        ? "    readonly content: string;"
        : `    readonly children: HtmlChildren.${encoded ? "Encoded" : "Type"};`;

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
 * @category models
 * @since 0.0.0
 */
export declare namespace ${cls} {
  /** @since 0.0.0 */
  export type Type = { readonly _tag: "${tag}"; readonly children: HtmlChildren.Type };
  /** @since 0.0.0 */
  export type Encoded = { readonly _tag: "${tag}"; readonly children: HtmlChildren.Encoded };
}`;

  const unionMembers = [...els.map((e) => e.cls), "Text", "Comment", "Doctype", "Document", "Fragment"];

  const categoryUnion = (name: string, cat: string): string => {
    const members = els.filter((e) => e.categories.includes(cat)).map((e) => e.cls);
    if (members.length === 0) return "";
    const types = members.map((m) => `${m}.Type`).join(" | ");
    const encodeds = members.map((m) => `${m}.Encoded`).join(" | ");
    return `/**
 * Advisory sub-union of elements in the "${cat}" content category. Non-normative
 * (derived from the WHATWG element index); see \`data/SOURCES.md\`.
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
import { SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { GlobalAttributes } from "./Html.attributes.ts";
import { Comment, Doctype, Text } from "./Html.nodes.ts";
import type { GlobalAttributesEncoded, GlobalAttributesType } from "./Html.attributes.ts";
import type * as O from "effect/Option";

const $I = $HtmlId.create("Html.model");

/** Union members carrying a literal \`_tag\` (the shape \`toTaggedUnion\` requires). */
type Tagged = S.Top & { readonly Type: { readonly _tag: PropertyKey } };

/**
 * Build a \`_tag\`-discriminated union at runtime via \`S.toTaggedUnion\`, typed
 * explicitly. \`toTaggedUnion\`'s type-level discriminant map does not scale to the
 * ~150 HTML node kinds (TS2589), so members are erased to a \`ReadonlyArray\` and
 * the result is cast to its declared codec type — the runtime is the real tagged
 * union.
 *
 * @category models
 * @since 0.0.0
 */
const taggedUnion = <A, E>(id: string, description: string, members: ReadonlyArray<S.Top>): S.Codec<A, E> =>
  S.Union(members as ReadonlyArray<Tagged>).pipe(
    S.toTaggedUnion("_tag"),
    $I.annoteSchema(id, { description })
  ) as unknown as S.Codec<A, E>;

/**
 * Recursive list of HTML AST child nodes (any {@link HtmlNode}).
 *
 * @category models
 * @since 0.0.0
 */
export const HtmlChildren = S.Array(S.suspend((): S.Codec<HtmlNode.Type, HtmlNode.Encoded> => HtmlNode)).pipe(
  $I.annoteSchema("HtmlChildren", { description: "Recursive list of HTML AST child nodes." })
);
/**
 * Companion namespace for {@link HtmlChildren}.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace HtmlChildren {
  /** @since 0.0.0 */
  export type Type = ReadonlyArray<HtmlNode.Type>;
  /** @since 0.0.0 */
  export type Encoded = ReadonlyArray<HtmlNode.Encoded>;
}`;

  const unionBlock = `/**
 * Discriminated union of every HTML AST node — all ${els.length} elements plus the
 * text, comment, doctype, document, and fragment node kinds — keyed on \`_tag\`.
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
    containerNode("Document", "#document", "A document root node."),
    ...els.map(elementBlock),
    unionBlock,
    ...CATEGORIES.map(([n, c]) => categoryUnion(n, c)).filter((s) => s !== ""),
  ].join("\n\n");

  const metaEntries = els
    .map((e) => {
      const conformance = e.obsolete ? "non-conforming" : "conforming";
      return `  "${e.tag}": { tag: "${e.tag}", interface: "${e.iface}", conformance: "${conformance}", void: ${e.kind === "void"}, rawText: ${e.kind === "rawText"}, categories: ${JSON.stringify(e.categories)} },`;
    })
    .join("\n");

  const categoryValues = JSON.stringify([...new Set(els.flatMap((element) => element.categories))].sort());

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
 * Schema describing one HTML element kind's metadata.
 *
 * @category models
 * @since 0.0.0
 */
export const HtmlElementMeta = S.Struct({
  tag: S.String,
  interface: S.String,
  conformance: S.Literals(["conforming", "non-conforming"]),
  void: S.Boolean,
  rawText: S.Boolean,
  categories: S.Array(HtmlCategory),
}).pipe($I.annoteSchema("HtmlElementMeta", { description: "Metadata describing one HTML element kind." }));

/**
 * Decoded type of {@link HtmlElementMeta}.
 *
 * @category models
 * @since 0.0.0
 */
export type HtmlElementMeta = typeof HtmlElementMeta.Type;

/**
 * Metadata for every generated HTML element, keyed by tag name.
 *
 * @category models
 * @since 0.0.0
 */
export const ELEMENT_META: { readonly [tag: string]: HtmlElementMeta } = {
${metaEntries}
} as const;
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
    `generated ${total} elements (${conforming} conforming, ${total - conforming} obsolete) + 5 node kinds -> src/Html.model.ts, src/Html.meta.ts`
  );
});

const runtimeLayer = Layer.mergeAll(Logger.layer([Logger.consolePretty()]), NodeServices.layer);

const main = Effect.scoped(
  Layer.build(runtimeLayer).pipe(Effect.flatMap((context) => Effect.provide(program, context)))
);

NodeRuntime.runMain(main);
