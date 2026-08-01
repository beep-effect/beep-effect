#!/usr/bin/env bun
import { $HtmlId } from "@beep/identity";
import { TaggedErrorClass } from "@beep/schema";
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
import { Effect, FileSystem, flow, Layer, Logger, Match, MutableHashMap, MutableHashSet, Path, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { EnumeratedGlobalAttributes, GlobalAttributes, tokenizeHtmlSpaceSeparated } from "../src/Html.attributes.ts";

const $I = $HtmlId.create("scripts/generate");

class HtmlGenerationError extends TaggedErrorClass<HtmlGenerationError>($I`HtmlGenerationError`)(
  "HtmlGenerationError",
  {
    cause: S.Defect({ includeStack: true }).pipe(S.optionalKey),
    message: S.String,
  },
  $I.annote("HtmlGenerationError", {
    description: "Typed failure raised when pinned HTML metadata cannot produce a valid deterministic model.",
  })
) {}

const isHtmlGenerationError = S.is(HtmlGenerationError);

const htmlAsciiUppercaseCharacters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const toHtmlAsciiLowerCase: (value: string) => string = flow(
  Str.split(""),
  A.map((character) =>
    Str.includes(character)(htmlAsciiUppercaseCharacters) ? Str.toLowerCase(character) : character
  ),
  A.join("")
);

const failGeneration = (message: string): never => {
  throw HtmlGenerationError.make({ message });
};

const assertExactInventory = (label: string, actual: ReadonlyArray<string>, expected: ReadonlyArray<string>): void => {
  const normalizedActual = [...actual].sort();
  const normalizedExpected = [...expected].sort();
  if (JSON.stringify(normalizedActual) !== JSON.stringify(normalizedExpected)) {
    failGeneration(
      `HTML generator requires the exact ${label}; expected ${JSON.stringify(normalizedExpected)}, received ${JSON.stringify(normalizedActual)}`
    );
  }
};

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
  "ButtonCommand",
  "CrossOrigin",
  "FormAutocomplete",
  "HtmlIdReferenceList",
  "HtmlRelationList",
  "HtmlStep",
  "LinkRelationList",
  "MetadataName",
  "ReferrerPolicy",
  "Utf8Charset",
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
  readonly attributeEqualities: ReadonlyArray<AttributeEquality>;
  readonly attributeRequirements: ReadonlyArray<AttributeRequirement>;
  readonly categories: ReadonlyArray<string>;
  readonly childGrammar: string | undefined;
  readonly children: ReadonlyArray<string>;
  readonly childSequencePattern: string | undefined;
  readonly cls: string;
  readonly conditionalCategories: ReadonlyArray<ConditionalCategoryRule>;
  readonly currentAttributes: ReadonlyArray<string>;
  readonly encoded: string;
  readonly iface: string;
  readonly kind: Kind;
  readonly numericAttributeRelationships: ReadonlyArray<NumericAttributeRelationship>;
  readonly obsolete: boolean;
  readonly obsoleteAttributes: ReadonlyArray<string>;
  readonly rules: ReviewedConformanceRules;
  readonly runtime: string;
  readonly tag: string;
  readonly textMode: TextMode;
  readonly type: string;
  readonly uniqueAttributes: ReadonlyArray<string>;
}

/** A single webref definition entry from `ed/dfns/html.json`. */
class Dfn extends S.Class<Dfn>($I`Dfn`)(
  {
    access: S.Unknown.pipe(S.optionalKey),
    definedIn: S.Unknown.pipe(S.optionalKey),
    for: S.Array(S.String).pipe(S.optionalKey),
    heading: S.Unknown.pipe(S.optionalKey),
    href: S.String,
    id: S.Unknown.pipe(S.optionalKey),
    informative: S.Unknown.pipe(S.optionalKey),
    links: S.Unknown.pipe(S.optionalKey),
    linkingText: S.Array(S.String),
    localLinkingText: S.Unknown.pipe(S.optionalKey),
    type: S.String,
  },
  $I.annote("Dfn", { description: "A single webref definition entry from ed/dfns/html.json." })
) {}

class WebrefElement extends S.Class<WebrefElement>($I`WebrefElement`)(
  {
    href: S.String,
    interface: S.String,
    name: S.String,
  },
  $I.annote("WebrefElement", { description: "A single webref element-index entry." })
) {}

class ContentModelEntry extends S.Class<ContentModelEntry>($I`ContentModelEntry`)(
  {
    attributes: S.Array(S.String).pipe(S.optionalKey),
    categories: S.Array(S.String).pipe(S.optionalKey),
    children: S.Array(S.String).pipe(S.optionalKey),
    void: S.Boolean.pipe(S.optionalKey),
  },
  $I.annote("ContentModelEntry", { description: "WHATWG content-model metadata for one element." })
) {}

class ConditionalCategoryRule extends S.Class<ConditionalCategoryRule>($I`ConditionalCategoryRule`)(
  {
    attribute: S.String,
    category: S.String,
    condition: S.Literals(["present", "not-equals", "tokens-subset"]),
    value: S.String.pipe(S.optionalKey),
  },
  $I.annote("ConditionalCategoryRule", {
    description: "An attribute predicate controlling membership in an HTML content category.",
  })
) {}

class ReviewedForbiddenDescendants extends S.Class<ReviewedForbiddenDescendants>($I`ReviewedForbiddenDescendants`)(
  {
    attributes: S.Array(S.String),
    categories: S.Array(S.String),
    tags: S.Array(S.String),
  },
  $I.annote("ReviewedForbiddenDescendants", {
    description: "Reviewed descendant exclusions attached to one generated HTML element profile.",
  })
) {}

class ReviewedForbiddenNamedAncestor extends S.Class<ReviewedForbiddenNamedAncestor>(
  $I`ReviewedForbiddenNamedAncestor`
)(
  {
    attributes: S.String.pipe(S.NonEmptyArray),
    tag: S.String,
  },
  $I.annote("ReviewedForbiddenNamedAncestor", {
    description: "Reviewed named-ancestor exclusion attached to one generated HTML element profile.",
  })
) {}

class ReviewedDocumentVisibilityLimit extends S.Class<ReviewedDocumentVisibilityLimit>(
  $I`ReviewedDocumentVisibilityLimit`
)(
  {
    maximum: S.Int.check(S.isGreaterThan(0)),
    unlessAttribute: S.String,
  },
  $I.annote("ReviewedDocumentVisibilityLimit", {
    description: "Reviewed document-wide visible-element cardinality limit.",
  })
) {}

class ReviewedConformanceRules extends S.Class<ReviewedConformanceRules>($I`ReviewedConformanceRules`)(
  {
    documentVisibilityLimit: ReviewedDocumentVisibilityLimit.pipe(S.optionalKey),
    forbiddenDescendants: ReviewedForbiddenDescendants.pipe(S.optionalKey),
    forbiddenNamedAncestors: ReviewedForbiddenNamedAncestor.pipe(S.NonEmptyArray, S.optionalKey),
    permittedAncestors: S.String.pipe(S.NonEmptyArray, S.optionalKey),
    requiredAncestor: S.String.pipe(S.optionalKey),
  },
  $I.annote("ReviewedConformanceRules", {
    description: "Reviewed element-specific rules omitted from the tabular WHATWG element index.",
  })
) {}

const AttributeValueConstraint = S.Union([
  S.TaggedStruct("allowedValues", {
    attribute: S.String,
    values: S.String.pipe(S.NonEmptyArray),
  }),
  S.TaggedStruct("containsAllTokens", {
    attribute: S.String,
    values: S.String.pipe(S.NonEmptyArray),
  }),
  S.TaggedStruct("containsAnyToken", {
    attribute: S.String,
    values: S.String.pipe(S.NonEmptyArray),
  }),
  S.TaggedStruct("equals", {
    asciiCaseInsensitive: S.Boolean.pipe(S.optionalKey),
    attribute: S.String,
    value: S.String,
  }),
]).pipe(
  $I.annoteSchema("AttributeValueConstraint", {
    description: "Generated relationship constraint over an HTML attribute value.",
  })
);

const AttributeRequirementPredicate = S.Union([
  S.TaggedStruct("attributeContainsToken", { attribute: S.String, value: S.String }),
  S.TaggedStruct("attributeEquals", { attribute: S.String, value: S.String }),
  S.TaggedStruct("attributePresent", { attribute: S.String }),
]).pipe(
  $I.annoteSchema("AttributeRequirementPredicate", {
    description: "Generated predicate controlling when an HTML attribute requirement applies.",
  })
);

class AttributeRequirement extends S.Class<AttributeRequirement>($I`AttributeRequirement`)(
  {
    constraints: AttributeValueConstraint.pipe(S.NonEmptyArray, S.optionalKey),
    forbidden: S.String.pipe(S.NonEmptyArray, S.optionalKey),
    message: S.String,
    nonBlank: S.String.pipe(S.NonEmptyArray, S.optionalKey),
    required: S.String.pipe(S.NonEmptyArray, S.NonEmptyArray),
    validNonEmptyUrl: S.String.pipe(S.NonEmptyArray, S.optionalKey),
    when: AttributeRequirementPredicate.pipe(S.optionalKey),
    whenParents: S.String.pipe(S.NonEmptyArray, S.optionalKey),
  },
  $I.annote("AttributeRequirement", {
    description: "A generated conditional requirement or exclusion for HTML attributes.",
  })
) {}

class AttributeEquality extends S.Class<AttributeEquality>($I`AttributeEquality`)(
  {
    left: S.String,
    message: S.String,
    right: S.String,
  },
  $I.annote("AttributeEquality", {
    description: "A generated same-value relationship between two HTML attributes.",
  })
) {}

class NumericAttributeRelationship extends S.Class<NumericAttributeRelationship>($I`NumericAttributeRelationship`)(
  {
    left: S.String,
    leftDefault: S.Finite.pipe(S.optionalKey),
    message: S.String,
    right: S.String,
    rightDefault: S.Finite.pipe(S.optionalKey),
  },
  $I.annote("NumericAttributeRelationship", {
    description: "A generated less-than-or-equal relationship between two HTML numeric attributes.",
  })
) {}

const AttributeSyntax = S.Literals(["icon-sizes", "source-size-list", "srcset"]).pipe(
  $I.annoteSchema("AttributeSyntax", {
    description: "Reviewed HTML attribute microsyntax requiring conformance inspection beyond its wire schema.",
  })
);

class Classification extends S.Class<Classification>($I`Classification`)(
  {
    autocompleteAttributes: S.Array(S.String),
    autocompleteContactFields: S.Array(S.String),
    autocompleteFieldGroups: S.Record(S.String, S.Array(S.String)),
    autocompleteInputStateGroups: S.Record(S.String, S.Array(S.String)),
    attributeEqualities: S.Record(S.String, S.Array(AttributeEquality)),
    attributeRequirements: S.Record(S.String, S.Array(AttributeRequirement)),
    attributeSyntaxes: S.Record(S.String, AttributeSyntax),
    booleanAttributes: S.Array(S.String),
    buttonSubmitOnlyAttributes: S.Array(S.String),
    boundedIntegerAttributes: S.Record(S.String, S.Tuple([S.Int, S.Int])),
    caseSensitiveKeywordAttributes: S.Array(S.String),
    childSequencePatterns: S.Record(S.String, S.String),
    conditionalCategories: S.Record(S.String, S.Array(ConditionalCategoryRule)),
    conformanceRules: S.Record(S.String, ReviewedConformanceRules),
    contentTokenExpansions: S.Record(S.String, S.Array(S.String)),
    currentAttributeOverrides: S.Record(S.String, S.Array(S.String)),
    enumeratedAttributeValueOverrides: S.Record(S.String, S.String.pipe(S.NonEmptyArray)),
    finiteNumberAttributes: S.Array(S.String),
    htmlIdValueAttributes: S.Array(S.String),
    iconLinkRelations: S.Array(S.String),
    idReferenceAttributes: S.Array(S.String),
    idReferenceListAttributes: S.Array(S.String),
    inputAttributeApplicability: S.Record(S.String, S.Array(S.String)),
    integerAttributes: S.Array(S.String),
    mathMlAttributeNameAdjustments: S.Record(S.String, S.String),
    nonNegativeIntegerAttributes: S.Array(S.String),
    nonNegativeNumberAttributes: S.Array(S.String),
    note: S.String,
    normal: S.Array(S.String),
    emptyContentModelElements: S.Array(S.String),
    plaintext: S.Array(S.String),
    positiveIntegerAttributes: S.Array(S.String),
    positiveNumberAttributes: S.Array(S.String),
    rawText: S.Array(S.String),
    rcData: S.Array(S.String),
    specialChildGrammars: S.Record(S.String, S.String),
    spaceSeparatedTokenAttributes: S.Array(S.String),
    stringAttributes: S.Array(S.String),
    svgAttributeNameAdjustments: S.Record(S.String, S.String),
    svgElementNameAdjustments: S.Record(S.String, S.String),
    numericAttributeRelationships: S.Record(S.String, S.Array(NumericAttributeRelationship)),
    uniqueAttributes: S.Record(S.String, S.Array(S.String)),
    void: S.Array(S.String),
    xmlAttributeNames: S.Array(S.String),
  },
  $I.annote("Classification", { description: "Pinned HTML attribute and element classifications." })
) {}

class DfnsDoc extends S.Class<DfnsDoc>($I`DfnsDoc`)(
  { dfns: S.Array(Dfn), spec: S.Unknown },
  $I.annote("DfnsDoc", { description: "webref dfns-html.json document." })
) {}

class ElementsDoc extends S.Class<ElementsDoc>($I`ElementsDoc`)(
  { elements: S.Array(WebrefElement), spec: S.Unknown },
  $I.annote("ElementsDoc", { description: "webref elements-html.json document." })
) {}

class ContentModelDoc extends S.Class<ContentModelDoc>($I`ContentModelDoc`)(
  {
    elementCount: S.Int,
    elements: S.Record(S.String, ContentModelEntry),
    fetched: S.String,
    note: S.String,
    source: S.String,
  },
  $I.annote("ContentModelDoc", { description: "WHATWG content-model.json document." })
) {}

class ObsoleteInterfacesDoc extends S.Class<ObsoleteInterfacesDoc>($I`ObsoleteInterfacesDoc`)(
  { interfaces: S.Record(S.String, S.String), note: S.String },
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

type ReviewedCurrentAttributeGap = {
  readonly pinned: ReadonlyArray<string>;
  readonly reviewed: ReadonlyArray<string>;
  readonly tag: string;
  readonly webref: ReadonlyArray<string>;
};

/**
 * Requires every pinned current attribute missing from webref to have an exact
 * reviewed override, with no stale or speculative entries.
 *
 * @since 0.0.0
 */
export const assertReviewedCurrentAttributeGap = (input: ReviewedCurrentAttributeGap): void => {
  const webrefNames = MutableHashSet.fromIterable(input.webref);
  const missingFromWebref = input.pinned.filter((name) => !MutableHashSet.has(webrefNames, name)).sort();
  const reviewedNames = [...input.reviewed].sort();
  if (JSON.stringify(missingFromWebref) !== JSON.stringify(reviewedNames)) {
    failGeneration(
      `HTML generator current-attribute gap for <${input.tag}> requires an exact reviewed override; expected ${JSON.stringify(missingFromWebref)}, received ${JSON.stringify(reviewedNames)}`
    );
  }
};

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
  for (const [key, values] of R.toEntries(classification.enumeratedAttributeValueOverrides)) {
    if (A.dedupe(values).length !== values.length) {
      failGeneration(`HTML generator enumerated-value override for ${key} contains duplicate keywords`);
    }
    MutableHashMap.set(enumValues, key, [...values]);
  }
  for (const [tag, requirements] of R.toEntries(classification.attributeRequirements)) {
    for (const requirement of requirements) {
      for (const constraint of requirement.constraints ?? []) {
        if (constraint._tag !== "allowedValues") {
          continue;
        }
        const key = `${tag}/${constraint.attribute}`;
        const values = pipe(
          MutableHashMap.get(enumValues, key),
          O.getOrElse((): Array<string> => []),
          A.appendAll(constraint.values),
          A.dedupe,
          A.sort(Str.Order)
        );
        MutableHashMap.set(enumValues, key, values);
      }
    }
  }

  const interfaceByName = MutableHashMap.empty<string, string>();
  for (const e of elementsData) MutableHashMap.set(interfaceByName, e.name, e.interface);

  const globalKeys = MutableHashSet.fromIterable<string>(R.keys(GlobalAttributes));
  const currentElemAttrs = MutableHashMap.empty<string, MutableHashSet.MutableHashSet<string>>();
  const obsoleteElemAttrs = MutableHashMap.empty<string, MutableHashSet.MutableHashSet<string>>();
  for (const tag of elementNames) {
    const definition = elementDfns.find((entry) => entry.linkingText[0] === tag);
    const webref = MutableHashMap.get(elemAttrs, tag).pipe(
      O.getOrElse((): MutableHashSet.MutableHashSet<string> => MutableHashSet.empty())
    );
    const webrefSpecific = MutableHashSet.fromIterable(
      [...webref].filter((name) => !MutableHashSet.has(globalKeys, name))
    );
    if (isObsolete(definition)) {
      MutableHashMap.set(currentElemAttrs, tag, MutableHashSet.empty());
      MutableHashMap.set(obsoleteElemAttrs, tag, webrefSpecific);
      continue;
    }

    const pinned =
      contentModel[tag]?.attributes ??
      failGeneration(`HTML generator has no pinned current-attribute inventory for conforming <${tag}>`);
    if (!pinned.includes("globals")) {
      failGeneration(`HTML generator requires the pinned <${tag}> inventory to classify global attributes explicitly`);
    }
    const pinnedSpecific = MutableHashSet.fromIterable(pinned.filter((name) => name !== "globals"));
    const reviewed = [...(classification.currentAttributeOverrides[tag] ?? [])].sort();
    assertReviewedCurrentAttributeGap({
      pinned: [...pinnedSpecific],
      reviewed,
      tag,
      webref: [...webrefSpecific],
    });
    MutableHashMap.set(currentElemAttrs, tag, pinnedSpecific);
    MutableHashMap.set(
      obsoleteElemAttrs,
      tag,
      MutableHashSet.fromIterable([...webrefSpecific].filter((name) => !MutableHashSet.has(pinnedSpecific, name)))
    );
  }
  for (const tag of R.keys(classification.currentAttributeOverrides)) {
    if (!MutableHashSet.has(elementNameSet, tag)) {
      failGeneration(`HTML generator current-attribute override names unknown element <${tag}>`);
    }
    if (isObsolete(elementDfns.find((entry) => entry.linkingText[0] === tag))) {
      failGeneration(`HTML generator current-attribute override names obsolete element <${tag}>`);
    }
  }

  const autocompleteAttrs = MutableHashSet.fromIterable(classification.autocompleteAttributes);
  const booleanAttrs = MutableHashSet.fromIterable(classification.booleanAttributes);
  const caseSensitiveKeywordAttrs = MutableHashSet.fromIterable(classification.caseSensitiveKeywordAttributes);
  const finiteNumberAttrs = MutableHashSet.fromIterable(classification.finiteNumberAttributes);
  const htmlIdValueAttrs = MutableHashSet.fromIterable(classification.htmlIdValueAttributes);
  const idReferenceAttrs = MutableHashSet.fromIterable(classification.idReferenceAttributes);
  const idReferenceListAttrs = MutableHashSet.fromIterable(classification.idReferenceListAttributes);
  const integerAttrs = MutableHashSet.fromIterable(classification.integerAttributes);
  const nonNegativeIntegerAttrs = MutableHashSet.fromIterable(classification.nonNegativeIntegerAttributes);
  const nonNegativeNumberAttrs = MutableHashSet.fromIterable(classification.nonNegativeNumberAttributes);
  const positiveIntegerAttrs = MutableHashSet.fromIterable(classification.positiveIntegerAttributes);
  const positiveNumberAttrs = MutableHashSet.fromIterable(classification.positiveNumberAttributes);
  const spaceSeparatedTokenAttrs = MutableHashSet.fromIterable(classification.spaceSeparatedTokenAttributes);
  const stringAttrs = MutableHashSet.fromIterable(classification.stringAttributes);
  const voidEls = MutableHashSet.fromIterable(classification.void);
  const rawTextEls = MutableHashSet.fromIterable(classification.rawText);
  const rcDataEls = MutableHashSet.fromIterable(classification.rcData);
  const plaintextEls = MutableHashSet.fromIterable(classification.plaintext);
  const normalEls = MutableHashSet.fromIterable(classification.normal);
  const emptyContentModelEls = MutableHashSet.fromIterable(classification.emptyContentModelElements);
  const globalBooleanAttributes = R.keys(GlobalAttributes).filter((name) => S.is(GlobalAttributes[name])(O.some(true)));
  for (const name of globalBooleanAttributes) {
    if (!MutableHashSet.has(booleanAttrs, name)) {
      failGeneration(`HTML generator boolean registry omits global BooleanAttribute field ${name}`);
    }
  }
  const requiredEnumeratedGlobalAttributes = [
    "autocapitalize",
    "autocorrect",
    "contenteditable",
    "dir",
    "draggable",
    "enterkeyhint",
    "hidden",
    "inputmode",
    "popover",
    "spellcheck",
    "translate",
    "writingsuggestions",
  ];
  if (
    JSON.stringify(R.keys(EnumeratedGlobalAttributes).sort()) !== JSON.stringify(requiredEnumeratedGlobalAttributes)
  ) {
    failGeneration(
      `HTML generator requires the exact hand-authored enumerated global-attribute inventory; expected ${JSON.stringify(requiredEnumeratedGlobalAttributes)}, received ${JSON.stringify(R.keys(EnumeratedGlobalAttributes).sort())}`
    );
  }
  const isClassifiedAs = (
    classificationSet: MutableHashSet.MutableHashSet<string>,
    element: string,
    attribute: string
  ): boolean =>
    MutableHashSet.has(classificationSet, `${element}/${attribute}`) ||
    MutableHashSet.has(classificationSet, attribute);

  const primitiveDomainOwners = MutableHashMap.empty<string, string>();
  const primitiveDomainRegistries: ReadonlyArray<readonly [string, Iterable<string>]> = [
    ["boolean", booleanAttrs],
    ["bounded-integer", R.keys(classification.boundedIntegerAttributes)],
    ["finite-number", finiteNumberAttrs],
    ["html-id", htmlIdValueAttrs],
    ["integer", integerAttrs],
    ["nonnegative-integer", nonNegativeIntegerAttrs],
    ["nonnegative-number", nonNegativeNumberAttrs],
    ["positive-integer", positiveIntegerAttrs],
    ["positive-number", positiveNumberAttrs],
    ["space-separated-token", spaceSeparatedTokenAttrs],
    ["string", stringAttrs],
  ];
  for (const [owner, attributes] of primitiveDomainRegistries) {
    for (const attribute of attributes) {
      const previous = MutableHashMap.get(primitiveDomainOwners, attribute);
      if (O.isSome(previous)) {
        failGeneration(
          `HTML generator primitive attribute ${attribute} is classified by both ${previous.value} and ${owner}`
        );
      }
      MutableHashMap.set(primitiveDomainOwners, attribute, owner);
    }
  }
  MutableHashMap.forEach(enumValues, (values, key) => {
    const [tag = "", attribute = ""] = Str.split("/")(key);
    if (isClassifiedAs(caseSensitiveKeywordAttrs, tag, attribute)) return;
    const folded = A.map(values, toHtmlAsciiLowerCase);
    if (A.dedupe(folded).length !== values.length) {
      failGeneration(`HTML generator ASCII-case-insensitive domain ${key} contains folded duplicate keywords`);
    }
    if (isClassifiedAs(spaceSeparatedTokenAttrs, tag, attribute) && A.some(values, Str.isEmpty)) {
      failGeneration(`HTML generator token-list domain ${key} contains an empty registered token`);
    }
  });

  if (!MutableHashSet.has(booleanAttrs, "shadowrootcustomelementregistry")) {
    failGeneration("HTML generator must classify template/shadowrootcustomelementregistry as a boolean attribute");
  }
  assertExactInventory(
    "space-separated token attribute inventory",
    [...spaceSeparatedTokenAttrs],
    ["blocking", "rel", "sandbox"]
  );
  assertExactInventory("button submit-only attribute inventory", classification.buttonSubmitOnlyAttributes, [
    "formaction",
    "formenctype",
    "formmethod",
    "formnovalidate",
    "formtarget",
  ]);
  assertExactInventory("icon link-relation inventory", classification.iconLinkRelations, ["apple-touch-icon", "icon"]);
  assertExactInventory("id-reference-list attribute inventory", classification.idReferenceListAttributes, [
    "output/for",
    "td/headers",
    "th/headers",
  ]);
  assertExactInventory("single id-reference attribute inventory", classification.idReferenceAttributes, [
    "button/commandfor",
  ]);

  const inputStates = [
    "hidden",
    "text",
    "search",
    "tel",
    "url",
    "email",
    "password",
    "date",
    "month",
    "week",
    "time",
    "datetime-local",
    "number",
    "range",
    "color",
    "checkbox",
    "radio",
    "file",
    "submit",
    "image",
    "reset",
    "button",
  ];
  assertExactInventory(
    "input-state applicability inventory",
    R.keys(classification.inputAttributeApplicability),
    inputStates
  );
  assertExactInventory(
    "autocomplete input-state inventory",
    R.keys(classification.autocompleteInputStateGroups),
    inputStates
  );
  const conditionalInputAttributes = [
    "accept",
    "alpha",
    "alt",
    "autocomplete",
    "checked",
    "colorspace",
    "dirname",
    "formaction",
    "formenctype",
    "formmethod",
    "formnovalidate",
    "formtarget",
    "height",
    "list",
    "max",
    "maxlength",
    "min",
    "minlength",
    "multiple",
    "pattern",
    "placeholder",
    "popovertarget",
    "popovertargetaction",
    "readonly",
    "required",
    "size",
    "src",
    "step",
    "width",
  ];
  const configuredConditionalInputAttributes = pipe(
    R.values(classification.inputAttributeApplicability),
    A.flatten,
    A.dedupe
  );
  assertExactInventory(
    "conditionally applicable input attribute inventory",
    configuredConditionalInputAttributes,
    conditionalInputAttributes
  );
  for (const [state, attributes] of R.toEntries(classification.inputAttributeApplicability)) {
    if (A.dedupe(attributes).length !== attributes.length) {
      failGeneration(`HTML generator input applicability for ${state} contains duplicate attributes`);
    }
    for (const attribute of attributes) {
      if (!A.contains(conditionalInputAttributes, attribute)) {
        failGeneration(`HTML generator input applicability for ${state} references unclassified ${attribute}`);
      }
    }
  }

  const autocompleteGroupNames = [
    "date",
    "month",
    "multiline",
    "numeric",
    "password",
    "tel",
    "text",
    "url",
    "username",
  ];
  assertExactInventory(
    "autocomplete field-group inventory",
    R.keys(classification.autocompleteFieldGroups),
    autocompleteGroupNames
  );
  const autocompleteFields = [
    "additional-name",
    "address-level1",
    "address-level2",
    "address-level3",
    "address-level4",
    "address-line1",
    "address-line2",
    "address-line3",
    "bday",
    "bday-day",
    "bday-month",
    "bday-year",
    "cc-additional-name",
    "cc-csc",
    "cc-exp",
    "cc-exp-month",
    "cc-exp-year",
    "cc-family-name",
    "cc-given-name",
    "cc-name",
    "cc-number",
    "cc-type",
    "country",
    "country-name",
    "current-password",
    "email",
    "family-name",
    "given-name",
    "honorific-prefix",
    "honorific-suffix",
    "impp",
    "language",
    "name",
    "new-password",
    "nickname",
    "one-time-code",
    "organization",
    "organization-title",
    "photo",
    "postal-code",
    "sex",
    "street-address",
    "tel",
    "tel-area-code",
    "tel-country-code",
    "tel-extension",
    "tel-local",
    "tel-local-prefix",
    "tel-local-suffix",
    "tel-national",
    "transaction-amount",
    "transaction-currency",
    "url",
    "username",
  ];
  assertExactInventory(
    "autocomplete field-name inventory",
    pipe(R.values(classification.autocompleteFieldGroups), A.flatten),
    autocompleteFields
  );
  for (const [state, groups] of R.toEntries(classification.autocompleteInputStateGroups)) {
    if (
      A.dedupe(groups).length !== groups.length ||
      A.some(groups, (group) => !A.contains(autocompleteGroupNames, group))
    ) {
      failGeneration(`HTML generator autocomplete groups for input state ${state} are duplicated or unclassified`);
    }
  }
  if (
    A.dedupe(classification.autocompleteContactFields).length !== classification.autocompleteContactFields.length ||
    A.some(classification.autocompleteContactFields, (field) => !A.contains(autocompleteFields, field))
  ) {
    failGeneration("HTML generator autocomplete contact fields must be unique classified autocomplete fields");
  }

  const requiredCaseSensitiveKeywordAttributes = ["ol/type"];
  if (
    JSON.stringify([...caseSensitiveKeywordAttrs].sort()) !== JSON.stringify(requiredCaseSensitiveKeywordAttributes)
  ) {
    failGeneration(
      `HTML generator requires the exact case-sensitive keyword-attribute inventory; expected ${JSON.stringify(requiredCaseSensitiveKeywordAttributes)}, received ${JSON.stringify([...caseSensitiveKeywordAttrs].sort())}`
    );
  }
  const orderedListTypeValues = pipe(
    MutableHashMap.get(enumValues, "ol/type"),
    O.getOrElse((): Array<string> => [])
  );
  if (
    orderedListTypeValues.length === 0 ||
    A.dedupe(A.map(orderedListTypeValues, Str.toLowerCase)).length === orderedListTypeValues.length
  ) {
    failGeneration("HTML generator case-sensitive keyword exceptions must distinguish ASCII case semantically");
  }
  const requiredEnumeratedAttributeValueOverrides = [
    "area/shape",
    "button/formenctype",
    "input/formenctype",
    "link/blocking",
    "meta/http-equiv",
    "script/blocking",
    "style/blocking",
  ];
  if (
    JSON.stringify(R.keys(classification.enumeratedAttributeValueOverrides).sort()) !==
    JSON.stringify(requiredEnumeratedAttributeValueOverrides)
  ) {
    failGeneration(
      `HTML generator requires the exact enumerated-value override inventory; expected ${JSON.stringify(requiredEnumeratedAttributeValueOverrides)}, received ${JSON.stringify(R.keys(classification.enumeratedAttributeValueOverrides).sort())}`
    );
  }
  if (
    JSON.stringify(classification.enumeratedAttributeValueOverrides["area/shape"]) !==
    JSON.stringify(["circle", "default", "poly", "rect"])
  ) {
    failGeneration("HTML generator requires the exact conforming <area shape> keyword domain");
  }
  const formEncodingKeywords = ["application/x-www-form-urlencoded", "multipart/form-data", "text/plain"];
  for (const attribute of ["button/formenctype", "input/formenctype"]) {
    if (
      JSON.stringify(classification.enumeratedAttributeValueOverrides[attribute]) !==
      JSON.stringify(formEncodingKeywords)
    ) {
      failGeneration(`HTML generator requires the exact conforming ${attribute} keyword domain`);
    }
  }
  for (const attribute of ["link/blocking", "script/blocking", "style/blocking"]) {
    if (JSON.stringify(classification.enumeratedAttributeValueOverrides[attribute]) !== JSON.stringify(["render"])) {
      failGeneration(`HTML generator requires the exact conforming ${attribute} token domain`);
    }
  }
  if (
    JSON.stringify(classification.enumeratedAttributeValueOverrides["meta/http-equiv"]) !==
    JSON.stringify(["content-type", "default-style", "refresh", "x-ua-compatible", "content-security-policy"])
  ) {
    failGeneration("HTML generator requires the exact current conforming meta/http-equiv keyword domain");
  }

  const elementClassifications = [voidEls, rawTextEls, rcDataEls, plaintextEls, normalEls];
  for (const tag of elementNames) {
    const matches = elementClassifications.filter((classificationSet) =>
      MutableHashSet.has(classificationSet, tag)
    ).length;
    if (matches !== 1) {
      failGeneration(`HTML generator requires exactly one element classification for <${tag}>; found ${matches}`);
    }
    const hasPinnedContentModel = contentModel[tag] !== undefined;
    const hasExplicitEmptyContentModel = MutableHashSet.has(emptyContentModelEls, tag);
    if (hasPinnedContentModel === hasExplicitEmptyContentModel) {
      failGeneration(
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
        failGeneration(`HTML generator ${classificationName} classification names unknown element <${tag}>`);
      }
    }
  }
  for (const [tag, pattern] of R.toEntries(classification.childSequencePatterns)) {
    if (!MutableHashSet.has(elementNameSet, tag)) {
      failGeneration(`HTML generator child-sequence pattern names unknown element <${tag}>`);
    }
    try {
      new RegExp(pattern, "u");
    } catch {
      failGeneration(`HTML generator child-sequence pattern for <${tag}> is not a valid Unicode regexp`);
    }
  }
  const grammarRequiredTags = [
    "audio",
    "colgroup",
    "datalist",
    "details",
    "div",
    "dl",
    "fieldset",
    "figure",
    "head",
    "hgroup",
    "html",
    "legend",
    "optgroup",
    "picture",
    "ruby",
    "select",
    "summary",
    "table",
    "video",
  ];
  const configuredGrammarTags = R.keys(classification.specialChildGrammars).sort();
  if (JSON.stringify(configuredGrammarTags) !== JSON.stringify(grammarRequiredTags)) {
    failGeneration(
      `HTML generator requires an exact special-child grammar inventory; expected ${JSON.stringify(grammarRequiredTags)}, received ${JSON.stringify(configuredGrammarTags)}`
    );
  }
  const opaqueContentTokens = [
    ...MutableHashSet.fromIterable(
      R.values(contentModel).flatMap((entry) =>
        (entry.children ?? []).filter((token) => Str.includes("inner content elements")(token))
      )
    ),
  ].sort();
  const expandedContentTokens = R.keys(classification.contentTokenExpansions).sort();
  if (JSON.stringify(opaqueContentTokens) !== JSON.stringify(expandedContentTokens)) {
    failGeneration(
      `HTML generator requires an exact contextual content-token expansion inventory; expected ${JSON.stringify(opaqueContentTokens)}, received ${JSON.stringify(expandedContentTokens)}`
    );
  }
  const modeledAttributesFor = (tag: string): MutableHashSet.MutableHashSet<string> =>
    MutableHashSet.fromIterable([
      ...globalKeys,
      ...MutableHashMap.get(currentElemAttrs, tag).pipe(O.getOrElse(() => MutableHashSet.empty<string>())),
      ...MutableHashMap.get(obsoleteElemAttrs, tag).pipe(O.getOrElse(() => MutableHashSet.empty<string>())),
    ]);
  for (const key of R.keys(classification.enumeratedAttributeValueOverrides)) {
    const [tag, attribute, ...unexpected] = Str.split("/")(key);
    if (
      tag === undefined ||
      attribute === undefined ||
      unexpected.length > 0 ||
      !MutableHashSet.has(elementNameSet, tag) ||
      !MutableHashSet.has(modeledAttributesFor(tag), attribute)
    ) {
      failGeneration(`HTML generator enumerated-value override references unknown ${key}`);
    }
  }

  const syntaxSensitiveAttributeNames = MutableHashSet.fromIterable(["imagesizes", "imagesrcset", "sizes", "srcset"]);
  const requiredAttributeSyntaxKeys = elementNames
    .flatMap((tag) =>
      [...MutableHashMap.get(currentElemAttrs, tag).pipe(O.getOrElse(() => MutableHashSet.empty<string>()))]
        .filter((attribute) => MutableHashSet.has(syntaxSensitiveAttributeNames, attribute))
        .map((attribute) => `${tag}/${attribute}`)
    )
    .sort();
  const configuredAttributeSyntaxKeys = R.keys(classification.attributeSyntaxes).sort();
  if (JSON.stringify(configuredAttributeSyntaxKeys) !== JSON.stringify(requiredAttributeSyntaxKeys)) {
    failGeneration(
      `HTML generator requires an exact special-attribute syntax inventory; expected ${JSON.stringify(requiredAttributeSyntaxKeys)}, received ${JSON.stringify(configuredAttributeSyntaxKeys)}`
    );
  }
  for (const [key, syntax] of R.toEntries(classification.attributeSyntaxes)) {
    const [tag, attribute, ...unexpected] = Str.split("/")(key);
    const expectedSyntax =
      attribute === "srcset" || attribute === "imagesrcset"
        ? "srcset"
        : tag === "link" && attribute === "sizes"
          ? "icon-sizes"
          : "source-size-list";
    if (tag === undefined || attribute === undefined || unexpected.length > 0 || syntax !== expectedSyntax) {
      failGeneration(`HTML generator special-attribute syntax for ${key} must be ${expectedSyntax}`);
    }
  }

  const requiredConformanceRuleTags = [
    "a",
    "address",
    "area",
    "audio",
    "button",
    "dfn",
    "dt",
    "footer",
    "form",
    "header",
    "label",
    "main",
    "meter",
    "progress",
    "th",
    "video",
  ];
  const configuredConformanceRuleTags = R.keys(classification.conformanceRules).sort();
  if (JSON.stringify(configuredConformanceRuleTags) !== JSON.stringify(requiredConformanceRuleTags)) {
    failGeneration(
      `HTML generator requires an exact reviewed conformance-rule inventory; expected ${JSON.stringify(requiredConformanceRuleTags)}, received ${JSON.stringify(configuredConformanceRuleTags)}`
    );
  }
  const configuredForbiddenDescendantTags = R.toEntries(classification.conformanceRules)
    .filter(([, rules]) => rules.forbiddenDescendants !== undefined)
    .map(([tag]) => tag)
    .sort();
  const requiredForbiddenDescendantTags = [
    "a",
    "address",
    "audio",
    "button",
    "dfn",
    "dt",
    "footer",
    "form",
    "header",
    "label",
    "meter",
    "progress",
    "th",
    "video",
  ];
  if (JSON.stringify(configuredForbiddenDescendantTags) !== JSON.stringify(requiredForbiddenDescendantTags)) {
    failGeneration(
      `HTML generator requires an exact forbidden-descendant inventory; expected ${JSON.stringify(requiredForbiddenDescendantTags)}, received ${JSON.stringify(configuredForbiddenDescendantTags)}`
    );
  }
  const configuredPermittedAncestorTags = R.toEntries(classification.conformanceRules)
    .filter(([, rules]) => rules.permittedAncestors !== undefined)
    .map(([tag]) => tag)
    .sort();
  if (JSON.stringify(configuredPermittedAncestorTags) !== JSON.stringify(["main"])) {
    failGeneration(
      `HTML generator requires permitted-ancestor metadata exactly for <main>; received ${JSON.stringify(configuredPermittedAncestorTags)}`
    );
  }
  const configuredRequiredAncestorTags = R.toEntries(classification.conformanceRules)
    .filter(([, rules]) => rules.requiredAncestor !== undefined)
    .map(([tag]) => tag)
    .sort();
  if (JSON.stringify(configuredRequiredAncestorTags) !== JSON.stringify(["area"])) {
    failGeneration(
      `HTML generator requires required-ancestor metadata exactly for <area>; received ${JSON.stringify(configuredRequiredAncestorTags)}`
    );
  }
  const configuredDocumentVisibilityTags = R.toEntries(classification.conformanceRules)
    .filter(([, rules]) => rules.documentVisibilityLimit !== undefined)
    .map(([tag]) => tag)
    .sort();
  if (JSON.stringify(configuredDocumentVisibilityTags) !== JSON.stringify(["main"])) {
    failGeneration(
      `HTML generator requires document-visibility metadata exactly for <main>; received ${JSON.stringify(configuredDocumentVisibilityTags)}`
    );
  }
  const configuredForbiddenNamedAncestors = classification.conformanceRules.main?.forbiddenNamedAncestors;
  const requiredForbiddenNamedAncestors = [{ attributes: ["aria-label", "aria-labelledby", "title"], tag: "form" }];
  if (JSON.stringify(configuredForbiddenNamedAncestors) !== JSON.stringify(requiredForbiddenNamedAncestors)) {
    failGeneration(
      `HTML generator requires the exact named-ancestor exclusion for <main>; expected ${JSON.stringify(requiredForbiddenNamedAncestors)}, received ${JSON.stringify(configuredForbiddenNamedAncestors)}`
    );
  }
  const knownCategories = MutableHashSet.fromIterable(
    R.values(contentModel).flatMap((entry) => entry.categories ?? [])
  );
  for (const [tag, rules] of R.toEntries(classification.conformanceRules)) {
    if (
      !MutableHashSet.has(elementNameSet, tag) ||
      isObsolete(elementDfns.find((entry) => entry.linkingText[0] === tag))
    ) {
      failGeneration(`HTML generator conformance rules name non-current element <${tag}>`);
    }
    if (
      rules.forbiddenDescendants === undefined &&
      rules.forbiddenNamedAncestors === undefined &&
      rules.permittedAncestors === undefined &&
      rules.requiredAncestor === undefined &&
      rules.documentVisibilityLimit === undefined
    ) {
      failGeneration(`HTML generator conformance rules for <${tag}> must not be empty`);
    }
    if (rules.forbiddenDescendants !== undefined) {
      const { attributes, categories, tags } = rules.forbiddenDescendants;
      if (attributes.length + categories.length + tags.length === 0) {
        failGeneration(`HTML generator forbidden-descendant rules for <${tag}> must not be empty`);
      }
      for (const attribute of attributes) {
        if (!MutableHashSet.has(globalKeys, attribute)) {
          failGeneration(
            `HTML generator forbidden-descendant rules for <${tag}> reference non-global attribute ${attribute}`
          );
        }
      }
      for (const category of categories) {
        if (!MutableHashSet.has(knownCategories, category)) {
          failGeneration(
            `HTML generator forbidden-descendant rules for <${tag}> reference unknown category ${category}`
          );
        }
      }
      for (const descendantTag of tags) {
        if (
          !MutableHashSet.has(elementNameSet, descendantTag) ||
          isObsolete(elementDfns.find((entry) => entry.linkingText[0] === descendantTag))
        ) {
          failGeneration(
            `HTML generator forbidden-descendant rules for <${tag}> reference non-current <${descendantTag}>`
          );
        }
      }
    }
    for (const ancestorTag of rules.permittedAncestors ?? []) {
      if (
        !MutableHashSet.has(elementNameSet, ancestorTag) ||
        isObsolete(elementDfns.find((entry) => entry.linkingText[0] === ancestorTag))
      ) {
        failGeneration(`HTML generator conformance rules for <${tag}> permit non-current <${ancestorTag}>`);
      }
    }
    if (rules.requiredAncestor !== undefined) {
      const ancestorTag = rules.requiredAncestor;
      if (
        !MutableHashSet.has(elementNameSet, ancestorTag) ||
        isObsolete(elementDfns.find((entry) => entry.linkingText[0] === ancestorTag))
      ) {
        failGeneration(`HTML generator conformance rules for <${tag}> require non-current <${ancestorTag}>`);
      }
    }
    for (const condition of rules.forbiddenNamedAncestors ?? []) {
      if (
        !MutableHashSet.has(elementNameSet, condition.tag) ||
        isObsolete(elementDfns.find((entry) => entry.linkingText[0] === condition.tag))
      ) {
        failGeneration(`HTML generator named-ancestor rules for <${tag}> reference non-current <${condition.tag}>`);
      }
      const ancestorAttributes = modeledAttributesFor(condition.tag);
      for (const attribute of condition.attributes) {
        if (!MutableHashSet.has(ancestorAttributes, attribute)) {
          failGeneration(
            `HTML generator named-ancestor rules for <${tag}> reference unknown <${condition.tag} ${attribute}>`
          );
        }
      }
    }
    if (rules.documentVisibilityLimit !== undefined) {
      const { maximum, unlessAttribute } = rules.documentVisibilityLimit;
      if (maximum < 1) {
        failGeneration(`HTML generator document-visibility limit for <${tag}> must be positive`);
      }
      if (!MutableHashSet.has(modeledAttributesFor(tag), unlessAttribute)) {
        failGeneration(`HTML generator document-visibility limit for <${tag}> references unknown ${unlessAttribute}`);
      }
    }
  }

  const requiredConditionalCategoryTags = ["a", "audio", "img", "input", "link", "meta", "object", "video"];
  const configuredConditionalCategoryTags = R.keys(classification.conditionalCategories).sort();
  if (JSON.stringify(configuredConditionalCategoryTags) !== JSON.stringify(requiredConditionalCategoryTags)) {
    failGeneration(
      `HTML generator requires an exact conditional-category inventory; expected ${JSON.stringify(requiredConditionalCategoryTags)}, received ${JSON.stringify(configuredConditionalCategoryTags)}`
    );
  }
  for (const [tag, rules] of R.toEntries(classification.conditionalCategories)) {
    if (
      !MutableHashSet.has(elementNameSet, tag) ||
      isObsolete(elementDfns.find((entry) => entry.linkingText[0] === tag))
    ) {
      failGeneration(`HTML generator conditional-category metadata names non-current element <${tag}>`);
    }
    const modeledAttributes = modeledAttributesFor(tag);
    for (const rule of rules) {
      const categories = contentModel[tag]?.categories ?? [];
      if (!categories.includes(rule.category)) {
        failGeneration(`HTML generator conditional category ${tag}/${rule.category} is absent from pinned categories`);
      }
      if (!MutableHashSet.has(modeledAttributes, rule.attribute)) {
        failGeneration(
          `HTML generator conditional category ${tag}/${rule.category} references unknown ${rule.attribute}`
        );
      }
      if ((rule.condition !== "present") !== (rule.value !== undefined)) {
        failGeneration(`HTML generator conditional category ${tag}/${rule.category} has an invalid predicate value`);
      }
      if (rule.condition === "tokens-subset") {
        const tokens = tokenizeHtmlSpaceSeparated(rule.value ?? "");
        const attributeValues = pipe(
          MutableHashMap.get(enumValues, `${tag}/${rule.attribute}`),
          O.getOrElse((): Array<string> => [])
        );
        if (
          tokens.length === 0 ||
          A.dedupe(tokens).length !== tokens.length ||
          A.some(tokens, (token) => Str.toLowerCase(token) !== token || !A.contains(attributeValues, token))
        ) {
          failGeneration(
            `HTML generator conditional category ${tag}/${rule.category} has an invalid token-subset registry`
          );
        }
      }
    }
  }
  const attributeRequirementTags = R.keys(classification.attributeRequirements).sort();
  const requiredAttributeRequirementTags = [
    "a",
    "area",
    "base",
    "img",
    "input",
    "link",
    "map",
    "meta",
    "meter",
    "source",
    "track",
  ];
  if (JSON.stringify(attributeRequirementTags) !== JSON.stringify(requiredAttributeRequirementTags)) {
    failGeneration(
      `HTML generator requires an exact attribute-requirement inventory; expected ${JSON.stringify(requiredAttributeRequirementTags)}, received ${JSON.stringify(attributeRequirementTags)}`
    );
  }
  const nonBlankRequirementTags = R.toEntries(classification.attributeRequirements)
    .filter(([, requirements]) => A.some(requirements, (requirement) => requirement.nonBlank !== undefined))
    .map(([tag]) => tag)
    .sort();
  if (JSON.stringify(nonBlankRequirementTags) !== JSON.stringify(["link"])) {
    failGeneration(
      `HTML generator requires non-blank attribute requirements exactly for <link>; received ${JSON.stringify(nonBlankRequirementTags)}`
    );
  }
  const linkNonBlankRequirements = A.filter(
    classification.attributeRequirements.link ?? [],
    (requirement) => requirement.nonBlank !== undefined
  );
  if (
    linkNonBlankRequirements.length !== 1 ||
    JSON.stringify(linkNonBlankRequirements[0]?.nonBlank) !== JSON.stringify(["imagesrcset"]) ||
    JSON.stringify(linkNonBlankRequirements[0]?.required) !== JSON.stringify([["href", "imagesrcset"]]) ||
    JSON.stringify(linkNonBlankRequirements[0]?.validNonEmptyUrl) !== JSON.stringify(["href"])
  ) {
    failGeneration("HTML generator requires <link> to have an address and validates href as a non-empty URL");
  }
  const validNonEmptyUrlRequirementTags = R.toEntries(classification.attributeRequirements)
    .filter(([, requirements]) => A.some(requirements, (requirement) => requirement.validNonEmptyUrl !== undefined))
    .map(([tag]) => tag)
    .sort();
  if (JSON.stringify(validNonEmptyUrlRequirementTags) !== JSON.stringify(["link"])) {
    failGeneration(
      `HTML generator requires valid non-empty URL requirements exactly for <link>; received ${JSON.stringify(validNonEmptyUrlRequirementTags)}`
    );
  }
  const constrainedRequirementTags = R.toEntries(classification.attributeRequirements)
    .filter(([, requirements]) => A.some(requirements, (requirement) => requirement.constraints !== undefined))
    .map(([tag]) => tag)
    .sort();
  if (JSON.stringify(constrainedRequirementTags) !== JSON.stringify(["link", "meta"])) {
    failGeneration(
      `HTML generator requires value constraints exactly for <link> and <meta>; received ${JSON.stringify(constrainedRequirementTags)}`
    );
  }
  const metaCharsetRequirements = A.filter(
    classification.attributeRequirements.meta ?? [],
    (requirement) => requirement.constraints !== undefined
  );
  const metaCharsetConstraint = metaCharsetRequirements[0]?.constraints?.[0];
  if (
    metaCharsetRequirements.length !== 1 ||
    metaCharsetRequirements[0]?.when?._tag !== "attributePresent" ||
    metaCharsetRequirements[0]?.when.attribute !== "charset" ||
    metaCharsetConstraint?._tag !== "equals" ||
    metaCharsetConstraint.attribute !== "charset" ||
    metaCharsetConstraint.value !== "utf-8" ||
    metaCharsetConstraint.asciiCaseInsensitive !== true ||
    !A.contains(metaCharsetRequirements[0]?.forbidden ?? [], "content")
  ) {
    failGeneration("HTML generator requires <meta charset> to be utf-8 and omit content");
  }
  const linkAsValues = pipe(
    MutableHashMap.get(enumValues, "link/as"),
    O.getOrElse((): Array<string> => []),
    A.dedupe,
    A.sort(Str.Order)
  );
  const requiredLinkAsValues = [
    "audioworklet",
    "fetch",
    "font",
    "image",
    "json",
    "paintworklet",
    "script",
    "serviceworker",
    "sharedworker",
    "style",
    "text",
    "track",
    "worker",
  ];
  if (JSON.stringify(linkAsValues) !== JSON.stringify(requiredLinkAsValues)) {
    failGeneration(
      `HTML generator requires the exact link/as preload destination domain; expected ${JSON.stringify(requiredLinkAsValues)}, received ${JSON.stringify(linkAsValues)}`
    );
  }
  for (const [tag, requirements] of R.toEntries(classification.attributeRequirements)) {
    if (
      !MutableHashSet.has(elementNameSet, tag) ||
      isObsolete(elementDfns.find((entry) => entry.linkingText[0] === tag))
    ) {
      failGeneration(`HTML generator attribute-requirement metadata names non-current element <${tag}>`);
    }
    const modeledAttributes = modeledAttributesFor(tag);
    for (const requirement of requirements) {
      if (requirement.when !== undefined && !MutableHashSet.has(modeledAttributes, requirement.when.attribute)) {
        failGeneration(
          `HTML generator attribute requirement for <${tag}> references unknown ${requirement.when.attribute}`
        );
      }
      if (requirement.when?._tag === "attributeContainsToken") {
        const { attribute, value } = requirement.when;
        if (!isClassifiedAs(spaceSeparatedTokenAttrs, tag, attribute)) {
          failGeneration(
            `HTML generator token predicate for <${tag}> references non-token-list attribute ${attribute}`
          );
        }
        const values = MutableHashMap.get(enumValues, `${tag}/${attribute}`).pipe(O.getOrElse((): Array<string> => []));
        if (Str.toLowerCase(value) !== value || !A.contains(values, value)) {
          failGeneration(
            `HTML generator token predicate for <${tag} ${attribute}> references unclassified token ${value}`
          );
        }
      }
      if (requirement.when?._tag === "attributeEquals") {
        const { attribute, value } = requirement.when;
        const values = MutableHashMap.get(enumValues, `${tag}/${attribute}`).pipe(O.getOrElse((): Array<string> => []));
        if (values.length > 0 && !A.contains(values, value)) {
          failGeneration(
            `HTML generator equality predicate for <${tag} ${attribute}> references unclassified value ${value}`
          );
        }
      }
      const constraintAttributes = MutableHashSet.empty<string>();
      for (const constraint of requirement.constraints ?? []) {
        if (!MutableHashSet.has(modeledAttributes, constraint.attribute)) {
          failGeneration(`HTML generator value constraint for <${tag}> references unknown ${constraint.attribute}`);
        }
        if (MutableHashSet.has(constraintAttributes, constraint.attribute)) {
          failGeneration(
            `HTML generator attribute requirement for <${tag}> constrains ${constraint.attribute} more than once`
          );
        }
        MutableHashSet.add(constraintAttributes, constraint.attribute);
        Match.value(constraint).pipe(
          Match.tags({
            allowedValues: ({ attribute, values }) => {
              const domain = MutableHashMap.get(enumValues, `${tag}/${attribute}`).pipe(
                O.getOrElse((): Array<string> => [])
              );
              if (
                A.dedupe(values).length !== values.length ||
                A.some(
                  values,
                  (value) => Str.isEmpty(value) || Str.toLowerCase(value) !== value || !A.contains(domain, value)
                )
              ) {
                failGeneration(
                  `HTML generator allowed-value constraint for <${tag} ${attribute}> is not an exact classified lowercase subset`
                );
              }
            },
            containsAllTokens: ({ attribute, values }) => {
              const domain = MutableHashMap.get(enumValues, `${tag}/${attribute}`).pipe(
                O.getOrElse((): Array<string> => [])
              );
              if (
                !isClassifiedAs(spaceSeparatedTokenAttrs, tag, attribute) ||
                A.dedupe(values).length !== values.length ||
                A.some(
                  values,
                  (value) => Str.isEmpty(value) || Str.toLowerCase(value) !== value || !A.contains(domain, value)
                )
              ) {
                failGeneration(
                  `HTML generator all-token constraint for <${tag} ${attribute}> is not an exact classified lowercase token subset`
                );
              }
            },
            containsAnyToken: ({ attribute, values }) => {
              const domain = MutableHashMap.get(enumValues, `${tag}/${attribute}`).pipe(
                O.getOrElse((): Array<string> => [])
              );
              if (
                !isClassifiedAs(spaceSeparatedTokenAttrs, tag, attribute) ||
                A.dedupe(values).length !== values.length ||
                A.some(
                  values,
                  (value) => Str.isEmpty(value) || Str.toLowerCase(value) !== value || !A.contains(domain, value)
                )
              ) {
                failGeneration(
                  `HTML generator any-token constraint for <${tag} ${attribute}> is not an exact classified lowercase token subset`
                );
              }
            },
            equals: ({ attribute, value }) => {
              const domain = MutableHashMap.get(enumValues, `${tag}/${attribute}`).pipe(
                O.getOrElse((): Array<string> => [])
              );
              if (Str.isEmpty(value) || (domain.length > 0 && !A.contains(domain, value))) {
                failGeneration(
                  `HTML generator equality constraint for <${tag} ${attribute}> references unclassified value ${value}`
                );
              }
            },
          }),
          Match.exhaustive
        );
      }
      for (const parent of requirement.whenParents ?? []) {
        if (
          !MutableHashSet.has(elementNameSet, parent) ||
          isObsolete(elementDfns.find((entry) => entry.linkingText[0] === parent))
        ) {
          failGeneration(`HTML generator attribute requirement for <${tag}> references non-current parent <${parent}>`);
        }
      }
      for (const attribute of requirement.forbidden ?? []) {
        if (!MutableHashSet.has(modeledAttributes, attribute)) {
          failGeneration(`HTML generator attribute exclusion for <${tag}> references unknown ${attribute}`);
        }
      }
      for (const attribute of requirement.nonBlank ?? []) {
        if (!MutableHashSet.has(modeledAttributes, attribute)) {
          failGeneration(`HTML generator non-blank requirement for <${tag}> references unknown ${attribute}`);
        }
      }
      for (const attribute of requirement.validNonEmptyUrl ?? []) {
        if (!MutableHashSet.has(modeledAttributes, attribute)) {
          failGeneration(`HTML generator URL requirement for <${tag}> references unknown ${attribute}`);
        }
      }
      for (const alternatives of requirement.required) {
        for (const attribute of alternatives) {
          if (!MutableHashSet.has(modeledAttributes, attribute)) {
            failGeneration(`HTML generator attribute requirement for <${tag}> references unknown ${attribute}`);
          }
        }
      }
    }
  }
  const attributeEqualityTags = R.keys(classification.attributeEqualities).sort();
  const requiredAttributeEqualityTags = ["map"];
  if (JSON.stringify(attributeEqualityTags) !== JSON.stringify(requiredAttributeEqualityTags)) {
    failGeneration(
      `HTML generator requires an exact attribute-equality inventory; expected ${JSON.stringify(requiredAttributeEqualityTags)}, received ${JSON.stringify(attributeEqualityTags)}`
    );
  }
  for (const [tag, equalities] of R.toEntries(classification.attributeEqualities)) {
    const modeledAttributes = modeledAttributesFor(tag);
    if (equalities.length !== 1 || equalities[0]?.left !== "id" || equalities[0]?.right !== "name") {
      failGeneration(`HTML generator requires <${tag}> attribute equality to be exactly id = name`);
    }
    for (const equality of equalities) {
      for (const attribute of [equality.left, equality.right]) {
        if (!MutableHashSet.has(modeledAttributes, attribute)) {
          failGeneration(`HTML generator attribute equality for <${tag}> references unknown ${attribute}`);
        }
      }
    }
  }
  const htmlIdValueAttributeInventory = [...htmlIdValueAttrs].sort();
  const requiredHtmlIdValueAttributeInventory = ["map/name"];
  if (JSON.stringify(htmlIdValueAttributeInventory) !== JSON.stringify(requiredHtmlIdValueAttributeInventory)) {
    failGeneration(
      `HTML generator requires an exact HTML id-value attribute inventory; expected ${JSON.stringify(requiredHtmlIdValueAttributeInventory)}, received ${JSON.stringify(htmlIdValueAttributeInventory)}`
    );
  }
  for (const key of A.appendAll(classification.idReferenceAttributes, classification.idReferenceListAttributes)) {
    const [tag, attribute, ...unexpected] = Str.split("/")(key);
    if (
      tag === undefined ||
      attribute === undefined ||
      unexpected.length > 0 ||
      !MutableHashSet.has(elementNameSet, tag) ||
      !MutableHashSet.has(modeledAttributesFor(tag), attribute)
    ) {
      failGeneration(`HTML generator id-reference inventory references unknown ${key}`);
    }
  }
  const uniqueAttributeTags = R.keys(classification.uniqueAttributes).sort();
  const requiredUniqueAttributeTags = ["map"];
  if (JSON.stringify(uniqueAttributeTags) !== JSON.stringify(requiredUniqueAttributeTags)) {
    failGeneration(
      `HTML generator requires an exact tree-unique attribute inventory; expected ${JSON.stringify(requiredUniqueAttributeTags)}, received ${JSON.stringify(uniqueAttributeTags)}`
    );
  }
  for (const [tag, attributes] of R.toEntries(classification.uniqueAttributes)) {
    if (JSON.stringify([...attributes].sort()) !== JSON.stringify(["name"])) {
      failGeneration(`HTML generator requires <${tag}> tree-unique attributes to be exactly ["name"]`);
    }
    const modeledAttributes = modeledAttributesFor(tag);
    for (const attribute of attributes) {
      if (!MutableHashSet.has(modeledAttributes, attribute)) {
        failGeneration(`HTML generator tree-unique attribute for <${tag}> references unknown ${attribute}`);
      }
    }
  }
  const numericRelationshipTags = R.keys(classification.numericAttributeRelationships).sort();
  const requiredNumericRelationshipTags = ["input", "meter", "progress", "textarea"];
  if (JSON.stringify(numericRelationshipTags) !== JSON.stringify(requiredNumericRelationshipTags)) {
    failGeneration(
      `HTML generator requires an exact numeric-relationship inventory; expected ${JSON.stringify(requiredNumericRelationshipTags)}, received ${JSON.stringify(numericRelationshipTags)}`
    );
  }
  const isNumericAttribute = (tag: string, attribute: string): boolean =>
    isClassifiedAs(finiteNumberAttrs, tag, attribute) ||
    isClassifiedAs(nonNegativeNumberAttrs, tag, attribute) ||
    isClassifiedAs(positiveNumberAttrs, tag, attribute) ||
    isClassifiedAs(integerAttrs, tag, attribute) ||
    isClassifiedAs(nonNegativeIntegerAttrs, tag, attribute) ||
    isClassifiedAs(positiveIntegerAttrs, tag, attribute) ||
    classification.boundedIntegerAttributes[attribute] !== undefined;
  for (const [tag, relationships] of R.toEntries(classification.numericAttributeRelationships)) {
    if (relationships.length === 0) {
      failGeneration(`HTML generator numeric-relationship metadata for <${tag}> must not be empty`);
    }
    const modeledAttributes = modeledAttributesFor(tag);
    for (const relationship of relationships) {
      for (const attribute of [relationship.left, relationship.right]) {
        if (!MutableHashSet.has(modeledAttributes, attribute) || !isNumericAttribute(tag, attribute)) {
          failGeneration(
            `HTML generator numeric relationship for <${tag}> references non-numeric attribute ${attribute}`
          );
        }
      }
    }
  }
  for (const [label, adjustments] of [
    ["SVG element", classification.svgElementNameAdjustments],
    ["SVG attribute", classification.svgAttributeNameAdjustments],
    ["MathML attribute", classification.mathMlAttributeNameAdjustments],
  ] as const) {
    for (const [lowercase, canonical] of R.toEntries(adjustments)) {
      if (Str.toLowerCase(lowercase) !== lowercase || Str.toLowerCase(canonical) !== lowercase) {
        failGeneration(`${label} adjustment ${lowercase} -> ${canonical} is not a browser fixed-point pair`);
      }
    }
  }
  for (const name of classification.xmlAttributeNames) {
    if (Str.toLowerCase(name) !== name) {
      failGeneration(`XML foreign attribute ${name} must be the lowercase browser fixed point`);
    }
  }

  const valueSchema = (el: string, attr: string): AttributeSpec => {
    if (Str.startsWith("on")(attr)) {
      return {
        runtime: optionalRuntime("S.String"),
        type: "O.Option<string>",
        encoded: "string",
      };
    }
    if (attr === "popovertargetaction") {
      return {
        runtime: optionalRuntime("PopoverTargetAction"),
        type: 'O.Option<"toggle" | "show" | "hide">',
        encoded: "string",
      };
    }
    if (attr === "crossorigin") {
      return {
        runtime: optionalRuntime("CrossOrigin"),
        type: 'O.Option<"anonymous" | "use-credentials">',
        encoded: "string",
      };
    }
    if (attr === "referrerpolicy") {
      return {
        runtime: optionalRuntime("ReferrerPolicy"),
        type: 'O.Option<"" | "no-referrer" | "no-referrer-when-downgrade" | "same-origin" | "origin" | "strict-origin" | "origin-when-cross-origin" | "strict-origin-when-cross-origin" | "unsafe-url">',
        encoded: "string",
      };
    }
    if ((el === "form" && attr === "accept-charset") || (el === "meta" && attr === "charset")) {
      return {
        runtime: optionalRuntime("Utf8Charset"),
        type: 'O.Option<"utf-8">',
        encoded: "string",
      };
    }
    if (el === "form" && attr === "autocomplete") {
      return {
        runtime: optionalRuntime("FormAutocomplete"),
        type: 'O.Option<"on" | "off">',
        encoded: "string",
      };
    }
    if (el === "button" && attr === "command") {
      return {
        runtime: optionalRuntime("ButtonCommand"),
        type: "O.Option<string>",
        encoded: "string",
      };
    }
    if (el === "input" && attr === "step") {
      return {
        runtime: optionalRuntime("HtmlStep"),
        type: 'O.Option<"any" | number>',
        encoded: "string | number",
      };
    }
    if (attr === "rel") {
      return {
        runtime: optionalRuntime(el === "link" ? "LinkRelationList" : "HtmlRelationList"),
        type: "O.Option<string>",
        encoded: "string",
      };
    }
    if (el === "meta" && attr === "name") {
      return {
        runtime: optionalRuntime("MetadataName"),
        type: "O.Option<string>",
        encoded: "string",
      };
    }
    if (isClassifiedAs(idReferenceAttrs, el, attr)) {
      return {
        runtime: optionalRuntime("HtmlIdValue"),
        type: "O.Option<string>",
        encoded: "string",
      };
    }
    if (isClassifiedAs(idReferenceListAttrs, el, attr)) {
      return {
        runtime: optionalRuntime("HtmlIdReferenceList"),
        type: "O.Option<string>",
        encoded: "string",
      };
    }
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
      const union = literalUnion(uniq);
      if (isClassifiedAs(caseSensitiveKeywordAttrs, el, attr)) {
        const schema =
          uniq.length === 1 ? `S.Literal(${JSON.stringify(uniq[0])})` : `S.Literals(${JSON.stringify(uniq)})`;
        return {
          runtime: optionalRuntime(schema),
          type: `O.Option<${union}>`,
          encoded: union,
        };
      }
      if (A.some(uniq, (value) => Str.toLowerCase(value) !== value)) {
        return failGeneration(
          `HTML generator ASCII-case-insensitive enumeration ${el}/${attr} has non-canonical keyword casing`
        );
      }
      return {
        runtime: optionalRuntime(`makeAsciiCaseInsensitiveEnumerated(${JSON.stringify(uniq)})`),
        type: `O.Option<${union}>`,
        encoded: "string",
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
    if (isClassifiedAs(positiveNumberAttrs, el, attr)) {
      return {
        runtime: optionalRuntime("HtmlPositiveNumber"),
        type: "O.Option<number>",
        encoded: "number",
      };
    }
    if (isClassifiedAs(nonNegativeNumberAttrs, el, attr)) {
      return {
        runtime: optionalRuntime("HtmlNonNegativeNumber"),
        type: "O.Option<number>",
        encoded: "number",
      };
    }
    if (isClassifiedAs(finiteNumberAttrs, el, attr)) {
      return {
        runtime: optionalRuntime("HtmlFiniteNumber"),
        type: "O.Option<number>",
        encoded: "number",
      };
    }
    if (isClassifiedAs(htmlIdValueAttrs, el, attr)) {
      return {
        runtime: optionalRuntime("HtmlIdValue"),
        type: "O.Option<string>",
        encoded: "string",
      };
    }
    if (isClassifiedAs(stringAttrs, el, attr)) {
      return {
        runtime: optionalRuntime("S.String"),
        type: "O.Option<string>",
        encoded: "string",
      };
    }
    return failGeneration(`HTML generator has no attribute classification for ${el}/${attr}`);
  };

  // Generated runtime field body + TS type bodies for an element's specific
  // attributes (globals/`_tag`/children excluded).
  const specificBodies = (el: string): { encoded: string; runtime: string; type: string } => {
    const current = MutableHashMap.get(currentElemAttrs, el).pipe(O.getOrElse(() => MutableHashSet.empty<string>()));
    const obsolete = MutableHashMap.get(obsoleteElemAttrs, el).pipe(O.getOrElse(() => MutableHashSet.empty<string>()));
    const attrs = [...MutableHashSet.fromIterable([...current, ...obsolete])].sort();
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
    const currentAttributes = [
      ...MutableHashMap.get(currentElemAttrs, tag).pipe(O.getOrElse(() => MutableHashSet.empty<string>())),
    ].sort();
    const obsoleteAttributes = [
      ...MutableHashMap.get(obsoleteElemAttrs, tag).pipe(O.getOrElse(() => MutableHashSet.empty<string>())),
    ].sort();
    return {
      tag,
      cls: className(tag),
      attributeEqualities: classification.attributeEqualities[tag] ?? [],
      attributeRequirements: classification.attributeRequirements[tag] ?? [],
      encoded,
      obsolete,
      kind,
      iface: interfaceOf(tag, obsolete),
      categories: contentModel[tag]?.categories ?? [],
      children: contentModel[tag]?.children ?? [],
      conditionalCategories: classification.conditionalCategories[tag] ?? [],
      currentAttributes,
      numericAttributeRelationships: classification.numericAttributeRelationships[tag] ?? [],
      obsoleteAttributes,
      rules: classification.conformanceRules[tag] ?? ReviewedConformanceRules.make({}),
      childSequencePattern: classification.childSequencePatterns[tag],
      childGrammar: classification.specialChildGrammars[tag],
      runtime,
      textMode,
      type,
      uniqueAttributes: classification.uniqueAttributes[tag] ?? [],
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

// WHATWG's lowercase global event handler names are normative.
// cspell:words onpagereveal onpageswap

import {
  AutocompleteAttribute,
  BooleanAttribute,
  ButtonCommand,
  CrossOrigin,
  ForeignAttributeName,
  ForeignElementName,
  FormAutocomplete,
  GlobalAttributes,
  HtmlFiniteNumber,
  HtmlIdReferenceList,
  HtmlIdValue,
  HtmlNonNegativeInteger,
  HtmlNonNegativeNumber,
  HtmlPositiveInteger,
  HtmlPositiveNumber,
  HtmlRelationList,
  HtmlStep,
  LinkRelationList,
  makeAsciiCaseInsensitiveEnumerated,
  makeSpaceSeparatedTokenList,
  MetadataName,
  PopoverTargetAction,
  ReferrerPolicy,
  Utf8Charset,
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
      const childGrammar = e.childGrammar === undefined ? "" : ` childGrammar: ${JSON.stringify(e.childGrammar)},`;
      const currentAttributes =
        e.currentAttributes.length === 0
          ? "HTML_GLOBAL_ATTRIBUTE_NAMES"
          : `[...HTML_GLOBAL_ATTRIBUTE_NAMES, ...${JSON.stringify(e.currentAttributes)}]`;
      return `  "${e.tag}": { tag: "${e.tag}", interface: "${e.iface}", conformance: "${conformance}", void: ${e.kind === "void"}, rawText: ${e.textMode === "raw-text"}, textMode: "${e.textMode}", categories: ${JSON.stringify(e.categories)}, children: ${JSON.stringify(e.children)}, currentAttributes: ${currentAttributes}, obsoleteAttributes: ${JSON.stringify(e.obsoleteAttributes)}, conditionalCategories: ${JSON.stringify(e.conditionalCategories)}, attributeEqualities: ${JSON.stringify(e.attributeEqualities)}, attributeRequirements: ${JSON.stringify(e.attributeRequirements)}, numericAttributeRelationships: ${JSON.stringify(e.numericAttributeRelationships)}, rules: ${JSON.stringify(e.rules)}, uniqueAttributes: ${JSON.stringify(e.uniqueAttributes)},${childSequencePattern}${childGrammar} },`;
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
  const attributeSyntaxValues = JSON.stringify(
    [...MutableHashSet.fromIterable(R.values(classification.attributeSyntaxes))].sort()
  );
  const attributeSyntaxes = JSON.stringify(classification.attributeSyntaxes);
  const childGrammarValues = JSON.stringify(
    [...MutableHashSet.fromIterable(R.values(classification.specialChildGrammars))].sort()
  );
  const svgElementNameAdjustments = JSON.stringify(classification.svgElementNameAdjustments);
  const svgAttributeNameAdjustments = JSON.stringify(classification.svgAttributeNameAdjustments);
  const mathMlAttributeNameAdjustments = JSON.stringify(classification.mathMlAttributeNameAdjustments);
  const xmlAttributeNames = JSON.stringify([...classification.xmlAttributeNames].sort());
  const globalAttributeNames = JSON.stringify([...globalKeys].sort());
  const readonlyArrayRecord = (record: Readonly<Record<string, ReadonlyArray<string>>>): string => `{
${R.toEntries(record)
  .map(([key, values]) => `  ${JSON.stringify(key)}: Object.freeze(${JSON.stringify(values)}),`)
  .join("\n")}
}`;
  const autocompleteFieldGroups = readonlyArrayRecord(classification.autocompleteFieldGroups);
  const autocompleteInputStateGroups = readonlyArrayRecord(classification.autocompleteInputStateGroups);
  const inputAttributeApplicability = readonlyArrayRecord(classification.inputAttributeApplicability);
  const autocompleteContactFields = JSON.stringify(classification.autocompleteContactFields);
  const buttonSubmitOnlyAttributes = JSON.stringify(classification.buttonSubmitOnlyAttributes);
  const conditionalInputAttributeNames = JSON.stringify(conditionalInputAttributes);
  const iconLinkRelations = JSON.stringify(classification.iconLinkRelations);
  const idReferenceAttributes = JSON.stringify(classification.idReferenceAttributes);
  const idReferenceListAttributes = JSON.stringify(classification.idReferenceListAttributes);
  const contentTokenExpansions = `{
${R.toEntries(classification.contentTokenExpansions)
  .map(([token, values]) => `  ${JSON.stringify(token)}: Object.freeze(${JSON.stringify(values)}),`)
  .join("\n")}
}`;

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
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

// WHATWG's tokenizer-lowercased attribute and event names are normative.
// cspell:words numoctaves onpagereveal onpageswap pointsatx pointsaty pointsatz refx refy
// cspell:words targetx targety xchannelselector ychannelselector

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
 * Reviewed grammar profiles for HTML elements whose child rules include
 * ordering, cardinality, alternatives, or attribute-dependent branches.
 *
 * @example
 * \`\`\`ts
 * import { HtmlChildGrammar } from "@beep/html/Html.meta"
 *
 * console.log(HtmlChildGrammar.is.table("table")) // true
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export const HtmlChildGrammar = LiteralKit(${childGrammarValues}).pipe(
  $I.annoteSchema("HtmlChildGrammar", { description: "Reviewed HTML special-child grammar profile." })
);

/**
 * Decoded HTML special-child grammar profile.
 *
 * @example
 * \`\`\`ts
 * import type { HtmlChildGrammar } from "@beep/html/Html.meta"
 *
 * const grammar: HtmlChildGrammar = "table"
 * console.log(grammar)
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export type HtmlChildGrammar = typeof HtmlChildGrammar.Type;

/**
 * One attribute-dependent content-category membership rule.
 *
 * @example
 * \`\`\`ts
 * import { HtmlConditionalCategoryRule } from "@beep/html/Html.meta"
 *
 * const rule = HtmlConditionalCategoryRule.make({
 *   attribute: "href",
 *   category: "interactive",
 *   condition: "present"
 * })
 * console.log(rule.category) // "interactive"
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export class HtmlConditionalCategoryRule extends S.Class<HtmlConditionalCategoryRule>(
  $I\`HtmlConditionalCategoryRule\`
)(
  {
    attribute: S.String,
    category: HtmlCategory,
    condition: S.Literals(["present", "not-equals", "tokens-subset"]),
    value: S.String.pipe(S.optionalKey),
  },
  $I.annote("HtmlConditionalCategoryRule", {
    description: "Attribute predicate controlling one element content-category membership.",
  })
) {}

/**
 * WHATWG SVG element-name adjustments keyed by tokenizer-lowercased input.
 *
 * @example
 * \`\`\`ts
 * import { SVG_ELEMENT_NAME_ADJUSTMENTS } from "@beep/html/Html.meta"
 *
 * console.log(SVG_ELEMENT_NAME_ADJUSTMENTS.lineargradient) // "linearGradient"
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const SVG_ELEMENT_NAME_ADJUSTMENTS: Readonly<Record<string, string>> = Object.freeze(
  ${svgElementNameAdjustments}
);

/**
 * WHATWG SVG attribute-name adjustments keyed by tokenizer-lowercased input.
 *
 * @example
 * \`\`\`ts
 * import { SVG_ATTRIBUTE_NAME_ADJUSTMENTS } from "@beep/html/Html.meta"
 *
 * console.log(SVG_ATTRIBUTE_NAME_ADJUSTMENTS.viewbox) // "viewBox"
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const SVG_ATTRIBUTE_NAME_ADJUSTMENTS: Readonly<Record<string, string>> = Object.freeze(
  ${svgAttributeNameAdjustments}
);

/**
 * WHATWG MathML attribute-name adjustments keyed by tokenizer-lowercased input.
 *
 * @example
 * \`\`\`ts
 * import { MATHML_ATTRIBUTE_NAME_ADJUSTMENTS } from "@beep/html/Html.meta"
 *
 * console.log(MATHML_ATTRIBUTE_NAME_ADJUSTMENTS.definitionurl) // "definitionURL"
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const MATHML_ATTRIBUTE_NAME_ADJUSTMENTS: Readonly<Record<string, string>> = Object.freeze(
  ${mathMlAttributeNameAdjustments}
);

/**
 * Foreign qualified attributes whose HTML parser adjustment assigns an XML,
 * XMLNS, or XLink namespace while preserving this serialized name.
 *
 * @example
 * \`\`\`ts
 * import { XML_FOREIGN_ATTRIBUTE_NAMES } from "@beep/html/Html.meta"
 *
 * console.log(XML_FOREIGN_ATTRIBUTE_NAMES.includes("xlink:href")) // true
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const XML_FOREIGN_ATTRIBUTE_NAMES: ReadonlyArray<string> = Object.freeze(${xmlAttributeNames});

/**
 * Shared current attributes permitted on every generated HTML element.
 *
 * Per-element metadata reuses this frozen inventory and appends only its
 * element-specific current attributes.
 *
 * @example
 * \`\`\`ts
 * import { HTML_GLOBAL_ATTRIBUTE_NAMES } from "@beep/html/Html.meta"
 *
 * console.log(HTML_GLOBAL_ATTRIBUTE_NAMES.includes("inert")) // true
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const HTML_GLOBAL_ATTRIBUTE_NAMES: ReadonlyArray<string> = Object.freeze(${globalAttributeNames});

/**
 * Reviewed expansions for context-sensitive content-model tokens emitted by
 * the non-normative WHATWG element index.
 *
 * @example
 * \`\`\`ts
 * import { HTML_CONTENT_TOKEN_EXPANSIONS } from "@beep/html/Html.meta"
 *
 * console.log(HTML_CONTENT_TOKEN_EXPANSIONS["option element inner content elements"]) // ["phrasing"]
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const HTML_CONTENT_TOKEN_EXPANSIONS: Readonly<Record<string, ReadonlyArray<string>>> = Object.freeze(
  ${contentTokenExpansions}
);

/**
 * Generator-owned autocomplete field groups from the WHATWG control table.
 *
 * @example
 * \`\`\`ts
 * import { HTML_AUTOCOMPLETE_FIELD_GROUPS } from "@beep/html/Html.meta"
 *
 * console.log(HTML_AUTOCOMPLETE_FIELD_GROUPS.password.includes("new-password")) // true
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const HTML_AUTOCOMPLETE_FIELD_GROUPS: Readonly<Record<string, ReadonlyArray<string>>> = Object.freeze(
  ${autocompleteFieldGroups}
);

/**
 * Generator-owned input-state compatibility for autocomplete field groups.
 *
 * @example
 * \`\`\`ts
 * import { HTML_AUTOCOMPLETE_INPUT_STATE_GROUPS } from "@beep/html/Html.meta"
 *
 * console.log(HTML_AUTOCOMPLETE_INPUT_STATE_GROUPS.email.includes("username")) // true
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const HTML_AUTOCOMPLETE_INPUT_STATE_GROUPS: Readonly<Record<string, ReadonlyArray<string>>> = Object.freeze(
  ${autocompleteInputStateGroups}
);

/**
 * Autocomplete fields that may carry a contact-recipient hint.
 *
 * @example
 * \`\`\`ts
 * import { HTML_AUTOCOMPLETE_CONTACT_FIELDS } from "@beep/html/Html.meta"
 *
 * console.log(HTML_AUTOCOMPLETE_CONTACT_FIELDS.includes("email")) // true
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const HTML_AUTOCOMPLETE_CONTACT_FIELDS: ReadonlyArray<string> = Object.freeze(${autocompleteContactFields});

/**
 * Exact conditional attribute applicability for every input type state.
 *
 * @example
 * \`\`\`ts
 * import { HTML_INPUT_ATTRIBUTE_APPLICABILITY } from "@beep/html/Html.meta"
 *
 * console.log(HTML_INPUT_ATTRIBUTE_APPLICABILITY.file.includes("accept")) // true
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const HTML_INPUT_ATTRIBUTE_APPLICABILITY: Readonly<Record<string, ReadonlyArray<string>>> = Object.freeze(
  ${inputAttributeApplicability}
);

/**
 * Conditional input attributes covered by the applicability table.
 *
 * @example
 * \`\`\`ts
 * import { HTML_CONDITIONAL_INPUT_ATTRIBUTE_NAMES } from "@beep/html/Html.meta"
 *
 * console.log(HTML_CONDITIONAL_INPUT_ATTRIBUTE_NAMES.includes("autocomplete")) // true
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const HTML_CONDITIONAL_INPUT_ATTRIBUTE_NAMES: ReadonlyArray<string> = Object.freeze(
  ${conditionalInputAttributeNames}
);

/**
 * Button attributes permitted only for effective submit buttons.
 *
 * @example
 * \`\`\`ts
 * import { HTML_BUTTON_SUBMIT_ONLY_ATTRIBUTES } from "@beep/html/Html.meta"
 *
 * console.log(HTML_BUTTON_SUBMIT_ONLY_ATTRIBUTES.includes("formaction")) // true
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const HTML_BUTTON_SUBMIT_ONLY_ATTRIBUTES: ReadonlyArray<string> = Object.freeze(
  ${buttonSubmitOnlyAttributes}
);

/**
 * Reviewed icon relation tokens used by link-specific attributes.
 *
 * @example
 * \`\`\`ts
 * import { HTML_ICON_LINK_RELATIONS } from "@beep/html/Html.meta"
 *
 * console.log(HTML_ICON_LINK_RELATIONS.includes("apple-touch-icon")) // true
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const HTML_ICON_LINK_RELATIONS: ReadonlyArray<string> = Object.freeze(${iconLinkRelations});

/**
 * Element/attribute keys using the HTML ID-reference-list microsyntax.
 *
 * @example
 * \`\`\`ts
 * import { HTML_ID_REFERENCE_LIST_ATTRIBUTES } from "@beep/html/Html.meta"
 *
 * console.log(HTML_ID_REFERENCE_LIST_ATTRIBUTES.includes("output/for")) // true
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const HTML_ID_REFERENCE_LIST_ATTRIBUTES: ReadonlyArray<string> = Object.freeze(
  ${idReferenceListAttributes}
);

/**
 * Element/attribute keys containing one case-sensitive HTML ID reference.
 *
 * @example
 * \`\`\`ts
 * import { HTML_ID_REFERENCE_ATTRIBUTES } from "@beep/html/Html.meta"
 *
 * console.log(HTML_ID_REFERENCE_ATTRIBUTES.includes("button/commandfor")) // true
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const HTML_ID_REFERENCE_ATTRIBUTES: ReadonlyArray<string> = Object.freeze(${idReferenceAttributes});

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
 * @example
 * \`\`\`ts
 * import { HtmlBooleanAttributeName } from "@beep/html/Html.meta"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownResult(HtmlBooleanAttributeName)("disabled")
 * if (Result.isSuccess(decoded)) {
 *   const name: HtmlBooleanAttributeName = decoded.success
 *   console.log(name) // "disabled"
 * }
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export type HtmlBooleanAttributeName = typeof HtmlBooleanAttributeName.Type;

/**
 * Reviewed HTML attribute microsyntaxes that require conformance inspection
 * beyond their lossless wire schemas.
 *
 * @example
 * \`\`\`ts
 * import { HtmlAttributeSyntax } from "@beep/html/Html.meta"
 *
 * console.log(HtmlAttributeSyntax.is.srcset("srcset")) // true
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export const HtmlAttributeSyntax = LiteralKit(${attributeSyntaxValues}).pipe(
  $I.annoteSchema("HtmlAttributeSyntax", {
    description: "Reviewed HTML attribute microsyntax requiring specialized conformance inspection.",
  })
);

/**
 * Decoded reviewed HTML attribute microsyntax.
 *
 * @example
 * \`\`\`ts
 * import type { HtmlAttributeSyntax } from "@beep/html/Html.meta"
 *
 * const syntax: HtmlAttributeSyntax = "srcset"
 * console.log(syntax)
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export type HtmlAttributeSyntax = typeof HtmlAttributeSyntax.Type;

/**
 * Exact generator-owned mapping from element/attribute pairs to specialized
 * conformance microsyntaxes.
 *
 * @example
 * \`\`\`ts
 * import { HTML_ATTRIBUTE_SYNTAXES } from "@beep/html/Html.meta"
 *
 * console.log(HTML_ATTRIBUTE_SYNTAXES["link/sizes"]) // "icon-sizes"
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const HTML_ATTRIBUTE_SYNTAXES: Readonly<Record<string, HtmlAttributeSyntax>> = Object.freeze(
  ${attributeSyntaxes}
);

/**
 * Generated same-value relationship between two HTML attributes.
 *
 * @example
 * \`\`\`ts
 * import { HtmlAttributeEquality } from "@beep/html/Html.meta"
 *
 * const equality = HtmlAttributeEquality.make({
 *   left: "id",
 *   message: "id must equal name",
 *   right: "name"
 * })
 * console.log(equality.right) // "name"
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export class HtmlAttributeEquality extends S.Class<HtmlAttributeEquality>($I\`HtmlAttributeEquality\`)(
  {
    left: S.String,
    message: S.String,
    right: S.String,
  },
  $I.annote("HtmlAttributeEquality", {
    description: "Generated same-value relationship between two HTML attributes.",
  })
) {}

const HtmlAttributeValueConstraint = S.Union([
  S.TaggedStruct("allowedValues", {
    attribute: S.String,
    values: S.String.pipe(S.NonEmptyArray),
  }),
  S.TaggedStruct("containsAllTokens", {
    attribute: S.String,
    values: S.String.pipe(S.NonEmptyArray),
  }),
  S.TaggedStruct("containsAnyToken", {
    attribute: S.String,
    values: S.String.pipe(S.NonEmptyArray),
  }),
  S.TaggedStruct("equals", {
    asciiCaseInsensitive: S.Boolean.pipe(S.optionalKey),
    attribute: S.String,
    value: S.String,
  }),
]).pipe(
  $I.annoteSchema("HtmlAttributeValueConstraint", {
    description: "Generated relationship constraint over an HTML attribute value.",
  })
);

const HtmlAttributeRequirementPredicate = S.Union([
  S.TaggedStruct("attributeContainsToken", { attribute: S.String, value: S.String }),
  S.TaggedStruct("attributeEquals", { attribute: S.String, value: S.String }),
  S.TaggedStruct("attributePresent", { attribute: S.String }),
]).pipe(
  $I.annoteSchema("HtmlAttributeRequirementPredicate", {
    description: "Generated predicate controlling when an HTML attribute requirement applies.",
  })
);

/**
 * Generated conditional requirement or exclusion for HTML attributes.
 *
 * @example
 * \`\`\`ts
 * import { HtmlAttributeRequirement } from "@beep/html/Html.meta"
 *
 * const requirement = HtmlAttributeRequirement.make({
 *   message: "target requires href",
 *   required: [["href"]],
 *   when: { _tag: "attributePresent", attribute: "target" }
 * })
 * console.log(requirement.required[0])
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export class HtmlAttributeRequirement extends S.Class<HtmlAttributeRequirement>($I\`HtmlAttributeRequirement\`)(
  {
    constraints: HtmlAttributeValueConstraint.pipe(S.NonEmptyArray, S.optionalKey),
    forbidden: S.String.pipe(S.NonEmptyArray, S.optionalKey),
    message: S.String,
    nonBlank: S.String.pipe(S.NonEmptyArray, S.optionalKey),
    required: S.String.pipe(S.NonEmptyArray, S.NonEmptyArray),
    validNonEmptyUrl: S.String.pipe(S.NonEmptyArray, S.optionalKey),
    when: HtmlAttributeRequirementPredicate.pipe(S.optionalKey),
    whenParents: HtmlTag.pipe(S.NonEmptyArray, S.optionalKey),
  },
  $I.annote("HtmlAttributeRequirement", {
    description: "Generated conditional requirement or exclusion for HTML attributes.",
  })
) {}

/**
 * Generated less-than-or-equal relationship between numeric attributes.
 *
 * @example
 * \`\`\`ts
 * import { HtmlNumericAttributeRelationship } from "@beep/html/Html.meta"
 *
 * const relationship = HtmlNumericAttributeRelationship.make({
 *   left: "value",
 *   message: "value must not exceed max",
 *   right: "max",
 *   rightDefault: 1
 * })
 * console.log(relationship.right)
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export class HtmlNumericAttributeRelationship extends S.Class<HtmlNumericAttributeRelationship>(
  $I\`HtmlNumericAttributeRelationship\`
)(
  {
    left: S.String,
    leftDefault: S.Finite.pipe(S.optionalKey),
    message: S.String,
    right: S.String,
    rightDefault: S.Finite.pipe(S.optionalKey),
  },
  $I.annote("HtmlNumericAttributeRelationship", {
    description: "Generated less-than-or-equal relationship between two HTML numeric attributes.",
  })
) {}

/**
 * Generated exclusions that apply to every descendant of one HTML element.
 *
 * @example
 * \`\`\`ts
 * import { HtmlForbiddenDescendants } from "@beep/html/Html.meta"
 *
 * const rule = HtmlForbiddenDescendants.make({
 *   attributes: [],
 *   categories: [],
 *   tags: ["dfn"]
 * })
 * console.log(rule.tags[0]) // "dfn"
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export class HtmlForbiddenDescendants extends S.Class<HtmlForbiddenDescendants>($I\`HtmlForbiddenDescendants\`)(
  {
    attributes: S.Array(S.String),
    categories: S.Array(HtmlCategory),
    tags: S.Array(HtmlTag),
  },
  $I.annote("HtmlForbiddenDescendants", {
    description: "Generated exclusions applying to every descendant of one HTML element.",
  })
) {}

/**
 * Generated exclusion for an ancestor with an author-provided accessible name.
 *
 * @example
 * \`\`\`ts
 * import { HtmlForbiddenNamedAncestor } from "@beep/html/Html.meta"
 *
 * const rule = HtmlForbiddenNamedAncestor.make({
 *   attributes: ["aria-label", "aria-labelledby", "title"],
 *   tag: "form"
 * })
 * console.log(rule.tag) // "form"
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export class HtmlForbiddenNamedAncestor extends S.Class<HtmlForbiddenNamedAncestor>(
  $I\`HtmlForbiddenNamedAncestor\`
)(
  {
    attributes: S.String.pipe(S.NonEmptyArray),
    tag: HtmlTag,
  },
  $I.annote("HtmlForbiddenNamedAncestor", {
    description: "Generated ancestor exclusion activated by a nonblank accessible-name source attribute.",
  })
) {}

/**
 * Generated document-wide visibility-aware element limit.
 *
 * @example
 * \`\`\`ts
 * import { HtmlDocumentVisibilityLimit } from "@beep/html/Html.meta"
 *
 * const rule = HtmlDocumentVisibilityLimit.make({ maximum: 1, unlessAttribute: "hidden" })
 * console.log(rule.maximum) // 1
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export class HtmlDocumentVisibilityLimit extends S.Class<HtmlDocumentVisibilityLimit>(
  $I\`HtmlDocumentVisibilityLimit\`
)(
  {
    maximum: S.Int.check(S.isGreaterThan(0)),
    unlessAttribute: S.String,
  },
  $I.annote("HtmlDocumentVisibilityLimit", {
    description: "Generated document-wide visible-element cardinality limit.",
  })
) {}

/**
 * Generated element-specific conformance rules absent from the tabular WHATWG index.
 *
 * @example
 * \`\`\`ts
 * import { HtmlElementConformanceRules } from "@beep/html/Html.meta"
 *
 * const rules = HtmlElementConformanceRules.make({ permittedAncestors: ["body", "html"] })
 * console.log(rules.permittedAncestors)
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export class HtmlElementConformanceRules extends S.Class<HtmlElementConformanceRules>(
  $I\`HtmlElementConformanceRules\`
)(
  {
    documentVisibilityLimit: HtmlDocumentVisibilityLimit.pipe(S.optionalKey),
    forbiddenDescendants: HtmlForbiddenDescendants.pipe(S.optionalKey),
    forbiddenNamedAncestors: HtmlForbiddenNamedAncestor.pipe(S.NonEmptyArray, S.optionalKey),
    permittedAncestors: HtmlTag.pipe(S.NonEmptyArray, S.optionalKey),
    requiredAncestor: HtmlTag.pipe(S.optionalKey),
  },
  $I.annote("HtmlElementConformanceRules", {
    description: "Generated element-specific rules absent from the tabular WHATWG element index.",
  })
) {}

/**
 * Schema describing one HTML element kind's metadata.
 *
 * @example
 * \`\`\`ts
 * import { ELEMENT_META, HtmlElementMeta } from "@beep/html/Html.meta"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(HtmlElementMeta)(ELEMENT_META.div)) // true
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
    currentAttributes: S.Array(S.String),
    obsoleteAttributes: S.Array(S.String),
    conditionalCategories: S.Array(HtmlConditionalCategoryRule),
    attributeEqualities: S.Array(HtmlAttributeEquality),
    attributeRequirements: S.Array(HtmlAttributeRequirement),
    numericAttributeRelationships: S.Array(HtmlNumericAttributeRelationship),
    rules: HtmlElementConformanceRules,
    uniqueAttributes: S.Array(S.String),
    childSequencePattern: S.String.pipe(S.optionalKey),
    childGrammar: HtmlChildGrammar.pipe(S.optionalKey),
  },
  $I.annote("HtmlElementMeta", { description: "Metadata describing one HTML element kind." })
) {}

const freezeElementConformanceRules = (value: HtmlElementConformanceRules): HtmlElementConformanceRules => {
  if (value.documentVisibilityLimit !== undefined) {
    Object.freeze(value.documentVisibilityLimit);
  }
  if (value.forbiddenDescendants !== undefined) {
    Object.freeze(value.forbiddenDescendants.attributes);
    Object.freeze(value.forbiddenDescendants.categories);
    Object.freeze(value.forbiddenDescendants.tags);
    Object.freeze(value.forbiddenDescendants);
  }
  if (value.forbiddenNamedAncestors !== undefined) {
    for (const condition of value.forbiddenNamedAncestors) {
      Object.freeze(condition.attributes);
      Object.freeze(condition);
    }
    Object.freeze(value.forbiddenNamedAncestors);
  }
  if (value.permittedAncestors !== undefined) {
    Object.freeze(value.permittedAncestors);
  }
  return Object.freeze(value);
};

const freezeElementMeta = (value: HtmlElementMeta): HtmlElementMeta =>
  {
    Object.freeze(value.categories);
    Object.freeze(value.children);
    for (const rule of value.conditionalCategories) Object.freeze(rule);
    Object.freeze(value.conditionalCategories);
    for (const equality of value.attributeEqualities) Object.freeze(equality);
    Object.freeze(value.attributeEqualities);
    for (const requirement of value.attributeRequirements) {
      if (requirement.constraints !== undefined) {
        for (const constraint of requirement.constraints) {
          if ("values" in constraint) Object.freeze(constraint.values);
          Object.freeze(constraint);
        }
        Object.freeze(requirement.constraints);
      }
      if (requirement.forbidden !== undefined) Object.freeze(requirement.forbidden);
      if (requirement.when !== undefined) Object.freeze(requirement.when);
      if (requirement.whenParents !== undefined) Object.freeze(requirement.whenParents);
      if (requirement.nonBlank !== undefined) Object.freeze(requirement.nonBlank);
      if (requirement.validNonEmptyUrl !== undefined) Object.freeze(requirement.validNonEmptyUrl);
      for (const alternatives of requirement.required) Object.freeze(alternatives);
      Object.freeze(requirement.required);
      Object.freeze(requirement);
    }
    Object.freeze(value.attributeRequirements);
    Object.freeze(value.currentAttributes);
    for (const relationship of value.numericAttributeRelationships) Object.freeze(relationship);
    Object.freeze(value.numericAttributeRelationships);
    Object.freeze(value.obsoleteAttributes);
    freezeElementConformanceRules(value.rules);
    Object.freeze(value.uniqueAttributes);
    return Object.freeze(value);
  };

const elementMetaSource: Readonly<Record<HtmlTag, S.Codec.Encoded<typeof HtmlElementMeta>>> = {
${metaEntries}
};

const decodeElementMeta = (value: S.Codec.Encoded<typeof HtmlElementMeta>): HtmlElementMeta =>
  Result.getOrThrow(S.decodeUnknownResult(HtmlElementMeta)(value));

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
export const ELEMENT_META: Readonly<Record<HtmlTag, HtmlElementMeta>> = Object.freeze(
  R.map(elementMetaSource, (value) => freezeElementMeta(decodeElementMeta(value)))
);
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
    fs
      .readFileString(path.join(dataDir, rel))
      .pipe(
        Effect.flatMap(S.decodeUnknownEffect(S.fromJsonString(schema), { errors: "all", onExcessProperty: "error" }))
      );

  const dfnsDoc = yield* readJson(DfnsDoc, "webref/dfns-html.json");
  const elementsDoc = yield* readJson(ElementsDoc, "webref/elements-html.json");
  const cmDoc = yield* readJson(ContentModelDoc, "whatwg/content-model.json");
  const classification = yield* readJson(Classification, "overrides/classification.json");
  const obsDoc = yield* readJson(ObsoleteInterfacesDoc, "overrides/obsolete-interfaces.json");

  const { conforming, meta, model, total } = yield* Effect.try({
    try: () =>
      buildModel({
        dfns: dfnsDoc.dfns,
        elements: elementsDoc.elements,
        contentModel: cmDoc.elements,
        classification,
        obsoleteInterfaces: obsDoc.interfaces,
      }),
    catch: (cause) =>
      isHtmlGenerationError(cause)
        ? cause
        : HtmlGenerationError.make({
            cause,
            message: "HTML generation failed unexpectedly",
          }),
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

if (import.meta.main) {
  NodeRuntime.runMain(main);
}
