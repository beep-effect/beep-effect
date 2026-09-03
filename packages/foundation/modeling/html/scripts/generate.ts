#!/usr/bin/env bun
import { $HtmlId } from "@beep/identity";
import { Defect, LiteralKit } from "@beep/schema";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
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
 *   - `src/internal/Html.language-tag-registry.generated.ts` — the compact
 *     RFC 5646 membership data projected from the pinned IANA registry.
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
import {
  Crypto,
  Effect,
  Encoding,
  FileSystem,
  flow,
  Layer,
  Logger,
  Match,
  MutableHashMap,
  MutableHashSet,
  Order,
  Path,
  pipe,
  Result,
  Tuple,
} from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { EnumeratedGlobalAttributes, GlobalAttributes, tokenizeHtmlSpaceSeparated } from "../src/Html.attributes.ts";
import { toAsciiLowerCase } from "../src/internal/Html.ascii.ts";

const $I = $HtmlId.create("scripts/generate");

class HtmlGenerationError extends S.TaggedError<HtmlGenerationError>($I`HtmlGenerationError`)(
  "HtmlGenerationError",
  {
    cause: Defect({ includeStack: true }).pipe(S.optionalKey),
    message: S.String,
  },
  $I.annoteError<HtmlGenerationError>("HtmlGenerationError", {
    description: "Typed failure raised when pinned HTML metadata cannot produce a valid deterministic model.",
  })
) {}

const isHtmlGenerationError = S.is(HtmlGenerationError);

const encodeJsonResult = UnknownFromJsonString.encodeUnknownResult;
const encodeJson = (value: unknown): string =>
  pipe(
    encodeJsonResult(value),
    Result.getOrThrowWith((cause) =>
      HtmlGenerationError.make({
        cause,
        message: "HTML generator could not encode deterministic JSON",
      })
    )
  );
const jsonEqual = (left: unknown, right: unknown): boolean => encodeJson(left) === encodeJson(right);

const htmlAsciiLowercaseCharacters = "abcdefghijklmnopqrstuvwxyz";

const markRunnableExampleFences = (source: string): string => {
  let exampleTitle: string | undefined;
  return pipe(
    Str.split("\n")(source),
    A.map((line) => {
      const heading = /^ \* \*\*Example\*\* \((.+)\)$/u.exec(line);
      if (heading !== null) {
        exampleTitle = heading[1];
        return line;
      }
      if (line === " * ```ts" && exampleTitle !== undefined) {
        const name = Str.replaceAll("`", "")(exampleTitle);
        return ` * \`\`\`ts import.meta.vitest name="${name}"`;
      }
      return line;
    }),
    A.join("\n")
  );
};

const failGeneration = (message: string): never => {
  throw HtmlGenerationError.make({ message });
};

const assertExactInventory = (label: string, actual: ReadonlyArray<string>, expected: ReadonlyArray<string>): void => {
  const normalizedActual = A.sort(actual, Order.String);
  const normalizedExpected = A.sort(expected, Order.String);
  if (encodeJson(normalizedActual) !== encodeJson(normalizedExpected)) {
    failGeneration(
      `HTML generator requires the exact ${label}; expected ${encodeJson(normalizedExpected)}, received ${encodeJson(normalizedActual)}`
    );
  }
};

const IANA_LANGUAGE_SUBTAG_REGISTRY_SHA256 = "be1fad86a99e3a932d07b80c9b3c271ec2381a5909ce22420144e5077ab0a43a";
const IANA_LANGUAGE_SUBTAG_REGISTRY_FILE_DATE = "2026-06-14";
const LanguageSubtagRegistryKind = LiteralKit([
  "extlang",
  "grandfathered",
  "language",
  "redundant",
  "region",
  "script",
  "variant",
]);
type LanguageSubtagRegistryKind = typeof LanguageSubtagRegistryKind.Type;
const isLanguageSubtagRegistryKind = S.is(LanguageSubtagRegistryKind);
const IANA_LANGUAGE_SUBTAG_REGISTRY_COUNTS: Readonly<Record<LanguageSubtagRegistryKind, number>> = {
  extlang: 258,
  grandfathered: 26,
  language: 8276,
  redundant: 67,
  region: 305,
  script: 225,
  variant: 139,
};
const IANA_LANGUAGE_SUBTAG_REGISTRY_RANGES = ["qaa..qtz", "Qaaa..Qabx", "QM..QZ", "XA..XZ"];

const LanguageSubtagRegistryRecord = S.Struct({
  prefixes: S.Array(S.String),
  subtagOrTag: S.String,
  type: LanguageSubtagRegistryKind,
}).pipe(
  $I.annoteSchema("LanguageSubtagRegistryRecord", {
    description: "Normalized fields from one IANA language-subtag registry record.",
  })
);
type LanguageSubtagRegistryRecord = typeof LanguageSubtagRegistryRecord.Type;

const LanguageTagRegistryData = S.Struct({
  extlangPrefixes: S.Record(S.String, S.String),
  fileDate: S.String,
  grandfathered: S.Array(S.String),
  languages: S.Array(S.String),
  regions: S.Array(S.String),
  scripts: S.Array(S.String),
  variants: S.Array(S.String),
}).pipe(
  $I.annoteSchema("LanguageTagRegistryData", {
    description: "Normalized IANA language-tag registry data rendered into the generated HTML module.",
  })
);
type LanguageTagRegistryData = typeof LanguageTagRegistryData.Type;

const asciiAlphaOrdinal = (value: string): number => {
  let ordinal = 0;
  for (const character of Str.toLowerCase(value)) {
    const digit =
      pipe(
        Str.charCodeAt(character, 0),
        O.getOrElse(() => failGeneration(`IANA registry range ${value} contains an empty character`))
      ) - 97;
    if (digit < 0 || digit > 25) failGeneration(`IANA registry range ${value} is not ASCII alphabetic`);
    ordinal = ordinal * 26 + digit;
  }
  return ordinal;
};

const asciiAlphaFromOrdinal = (ordinal: number, length: number): string => {
  let characters = A.empty<string>();
  let remainder = ordinal;
  for (let index = 0; index < length; index += 1) {
    const character = pipe(
      Str.charAt(htmlAsciiLowercaseCharacters, remainder % 26),
      O.getOrElse(() => failGeneration(`IANA registry ordinal ${ordinal} has an invalid alphabet offset`))
    );
    characters = A.prepend(characters, character);
    remainder = Math.floor(remainder / 26);
  }
  if (remainder !== 0) failGeneration(`IANA registry range ordinal ${ordinal} exceeds width ${length}`);
  return A.join(characters, "");
};

const expandLanguageSubtag = (value: string): ReadonlyArray<string> => {
  const [start, end, ...unexpected] = Str.split(value, "..");
  if (end === undefined) return [Str.toLowerCase(value)];
  if (start === undefined || A.isReadonlyArrayNonEmpty(unexpected) || Str.length(start) !== Str.length(end)) {
    return failGeneration(`IANA registry range ${value} is malformed`);
  }
  const startOrdinal = asciiAlphaOrdinal(start);
  const endOrdinal = asciiAlphaOrdinal(end);
  if (endOrdinal < startOrdinal) return failGeneration(`IANA registry range ${value} is descending`);
  return A.makeBy(endOrdinal - startOrdinal + 1, (index) =>
    asciiAlphaFromOrdinal(startOrdinal + index, Str.length(start))
  );
};

const parseLanguageSubtagRegistry = (source: string): LanguageTagRegistryData => {
  const [header, ...blocks] = pipe(source, Str.replace(/\r\n?/gu, "\n"), Str.split("\n%%\n"));
  const fileDate = pipe(
    header,
    O.fromUndefinedOr,
    O.flatMap(Str.match(/^File-Date: ([0-9]{4}-[0-9]{2}-[0-9]{2})$/u)),
    O.flatMap(A.get(1)),
    O.getOrUndefined
  );
  if (fileDate !== IANA_LANGUAGE_SUBTAG_REGISTRY_FILE_DATE) {
    return failGeneration(
      `IANA registry requires File-Date ${IANA_LANGUAGE_SUBTAG_REGISTRY_FILE_DATE}; received ${fileDate ?? "missing"}`
    );
  }

  const records = A.map(blocks, (block): LanguageSubtagRegistryRecord => {
    const fields = MutableHashMap.empty<string, Array<string>>();
    for (const line of pipe(block, Str.trim, Str.split("\n"))) {
      const separator = pipe(
        line,
        Str.indexOf(":"),
        O.getOrElse(() => -1)
      );
      if (separator <= 0) continue;
      const name = pipe(line, Str.slice(0, separator));
      const values = pipe(MutableHashMap.get(fields, name), O.getOrElse(A.empty<string>));
      MutableHashMap.set(fields, name, A.append(values, pipe(line, Str.slice(separator + 1), Str.trim)));
    }
    const type = pipe(MutableHashMap.get(fields, "Type"), O.flatMap(A.head), O.getOrUndefined);
    const subtagOrTag = pipe(
      MutableHashMap.get(fields, "Subtag"),
      O.flatMap(A.head),
      O.orElse(() => pipe(MutableHashMap.get(fields, "Tag"), O.flatMap(A.head))),
      O.getOrUndefined
    );
    if (type === undefined || !isLanguageSubtagRegistryKind(type)) {
      return failGeneration(`IANA registry record has unknown Type ${type ?? "missing"}`);
    }
    if (subtagOrTag === undefined) return failGeneration(`IANA registry ${type} record has no Subtag or Tag`);
    return {
      prefixes: pipe(MutableHashMap.get(fields, "Prefix"), O.getOrElse(A.empty<string>)),
      subtagOrTag,
      type,
    };
  });

  for (const [type, expected] of R.toEntries(IANA_LANGUAGE_SUBTAG_REGISTRY_COUNTS)) {
    const actual = pipe(records, A.filter(P.Struct({ type: Eq.equals(type) })), A.length);
    if (actual !== expected) {
      return failGeneration(`IANA registry requires ${expected} ${type} records; received ${actual}`);
    }
  }
  assertExactInventory(
    "IANA registry range inventory",
    pipe(
      records,
      A.map((record) => record.subtagOrTag),
      A.filter(Str.includes(".."))
    ),
    IANA_LANGUAGE_SUBTAG_REGISTRY_RANGES
  );

  const valuesFor = (type: LanguageSubtagRegistryKind): ReadonlyArray<string> => {
    const values = pipe(
      records,
      A.filter(
        P.Struct({
          type: Eq.equals(type),
        })
      ),
      A.flatMap((record) => expandLanguageSubtag(record.subtagOrTag)),
      A.sort(Order.String)
    );
    if (A.length(A.dedupe(values)) !== A.length(values)) {
      return failGeneration(`IANA registry contains a duplicate expanded ${type} value`);
    }
    return values;
  };

  const extlangs = valuesFor("extlang");
  const languages = valuesFor("language");
  const extlangPrefixes = R.fromEntries(
    pipe(
      records,
      A.filter(P.Struct({ type: Eq.equals("extlang") })),
      A.map((record) => {
        const [prefix] = record.prefixes;
        if (prefix === undefined || A.length(record.prefixes) !== 1) {
          return failGeneration(
            `IANA registry extlang ${record.subtagOrTag} requires exactly one Prefix; received ${encodeJson(record.prefixes)}`
          );
        }
        const normalizedExtlang = Str.toLowerCase(record.subtagOrTag);
        const normalizedPrefix = Str.toLowerCase(prefix);
        if (!A.contains(languages, normalizedPrefix)) {
          return failGeneration(`IANA registry extlang ${record.subtagOrTag} has invalid registered Prefix ${prefix}`);
        }
        return Tuple.make(normalizedExtlang, normalizedPrefix);
      })
    )
  );
  assertExactInventory("IANA registry extlang prefix inventory", R.keys(extlangPrefixes), extlangs);

  return {
    extlangPrefixes,
    fileDate,
    grandfathered: valuesFor("grandfathered"),
    languages,
    regions: valuesFor("region"),
    scripts: valuesFor("script"),
    variants: valuesFor("variant"),
  };
};

const buildLanguageTagRegistryModule = (registry: LanguageTagRegistryData): string => `/**
 * GENERATED FILE — do not edit by hand. Run \`bun run generate\`.
 *
 * Compact RFC 5646 validity data derived from the pinned IANA Language
 * Subtag Registry documented in \`data/SOURCES.md\`.
 *
 * @since 0.0.0
 */

// Raw registered IANA subtags are authoritative data, not prose.

type GeneratedLanguageTagRegistry = Readonly<{
  fileDate: string;
  languages: ReadonlyArray<string>;
  extlangPrefixes: Readonly<Record<string, string>>;
  scripts: ReadonlyArray<string>;
  regions: ReadonlyArray<string>;
  variants: ReadonlyArray<string>;
  grandfathered: ReadonlyArray<string>;
}>;

/**
 * Compact registered-subtag membership data for BCP 47 validation.
 *
 * **Example** (Read the IANA registry file date)
 *
 * \`\`\`ts
 * import { IANA_LANGUAGE_TAG_REGISTRY } from "./Html.language-tag-registry.generated"
 *
 * console.log(IANA_LANGUAGE_TAG_REGISTRY.fileDate) // ${registry.fileDate}
 * \`\`\`
 *
 * @category generated
 * @since 0.0.0
 */
export const IANA_LANGUAGE_TAG_REGISTRY: GeneratedLanguageTagRegistry = Object.freeze({
  fileDate: ${encodeJson(registry.fileDate)},
  languages: Object.freeze(${encodeJson(registry.languages)}),
  extlangPrefixes: Object.freeze(${encodeJson(registry.extlangPrefixes)}),
  scripts: Object.freeze(${encodeJson(registry.scripts)}),
  regions: Object.freeze(${encodeJson(registry.regions)}),
  variants: Object.freeze(${encodeJson(registry.variants)}),
  grandfathered: Object.freeze(${encodeJson(registry.grandfathered)}),
});
`;

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
  const first = pipe(
    Str.charAt(tag, 0),
    O.getOrElse(() => "")
  );
  const pascal = Str.concat(Str.toUpperCase(first), pipe(tag, Str.slice(1)));
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

const Kind = LiteralKit(["void", "text", "normal"]).pipe(
  $I.annoteSchema("Kind", {
    description: "Generated HTML element content-body kind.",
  })
);
type Kind = typeof Kind.Type;

const TextMode = LiteralKit(["normal", "raw-text", "rcdata", "plaintext"]).pipe(
  $I.annoteSchema("TextMode", {
    description: "HTML tokenizer text mode associated with a generated element.",
  })
);
type TextMode = typeof TextMode.Type;

const AttributeSpec = S.Struct({
  encoded: S.String,
  runtime: S.String,
  type: S.String,
}).pipe(
  $I.annoteSchema("AttributeSpec", {
    description: "Generated runtime, decoded, and encoded source fragments for one HTML attribute.",
  })
);
type AttributeSpec = typeof AttributeSpec.Type;

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
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("AttributeValueConstraint", {
    description: "Generated relationship constraint over an HTML attribute value.",
  })
);
const isAllowedValuesConstraint = P.isTagged("allowedValues");

const AttributeRequirementPredicate = S.Union([
  S.TaggedStruct("attributeContainsToken", {
    attribute: S.String,
    value: S.String,
  }),
  S.TaggedStruct("attributeEquals", { attribute: S.String, value: S.String }),
  S.TaggedStruct("attributeEqualsOrMissing", {
    attribute: S.String,
    value: S.String,
  }),
  S.TaggedStruct("attributePresent", { attribute: S.String }),
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("AttributeRequirementPredicate", {
    description: "Generated predicate controlling when an HTML attribute requirement applies.",
  })
);
const isAttributeContainsTokenPredicate = P.isTagged("attributeContainsToken");
const isAttributeEqualsOrMissingPredicate = P.isTagged("attributeEqualsOrMissing");
const isAttributeEqualityPredicate = P.or(P.isTagged("attributeEquals"), isAttributeEqualsOrMissingPredicate);

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

const AttributeSyntax = S.Literals(["icon-sizes", "language-tag", "source-size-list", "srcset"]).pipe(
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

const El = S.Struct({
  attributeEqualities: S.Array(AttributeEquality),
  attributeRequirements: S.Array(AttributeRequirement),
  categories: S.Array(S.String),
  childGrammar: S.UndefinedOr(S.String),
  children: S.Array(S.String),
  childSequencePattern: S.UndefinedOr(S.String),
  cls: S.String,
  conditionalCategories: S.Array(ConditionalCategoryRule),
  currentAttributes: S.Array(S.String),
  encoded: S.String,
  iface: S.String,
  kind: Kind,
  numericAttributeRelationships: S.Array(NumericAttributeRelationship),
  obsolete: S.Boolean,
  obsoleteAttributes: S.Array(S.String),
  rules: ReviewedConformanceRules,
  runtime: S.String,
  tag: S.String,
  textMode: TextMode,
  type: S.String,
  uniqueAttributes: S.Array(S.String),
}).pipe(
  $I.annoteSchema("El", {
    description: "Normalized generator state for one HTML element model and metadata entry.",
  })
);
type El = typeof El.Type;

const RawData = S.Struct({
  classification: Classification,
  contentModel: S.Record(S.String, ContentModelEntry),
  dfns: S.Array(Dfn),
  elements: S.Array(WebrefElement),
  obsoleteInterfaces: S.Record(S.String, S.String),
}).pipe(
  $I.annoteSchema("RawData", {
    description: "Decoded pinned datasets consumed by the pure HTML model builder.",
  })
);
type RawData = typeof RawData.Type;

// ---------------------------------------------------------------------------
// pure build
// ---------------------------------------------------------------------------

const optionalRuntime = (schema: string): string =>
  `S.OptionFromOptionalKey(${schema}).pipe(SchemaUtils.withNoneDefault)`;

const literalUnion: (values: ReadonlyArray<string>) => string = flow(A.map(encodeJson), A.join(" | "));

const ReviewedCurrentAttributeGap = S.Struct({
  pinned: S.Array(S.String),
  reviewed: S.Array(S.String),
  tag: S.String,
  webref: S.Array(S.String),
}).pipe(
  $I.annoteSchema("ReviewedCurrentAttributeGap", {
    description: "Pinned and reviewed current-attribute inventories compared for one HTML element.",
  })
);
type ReviewedCurrentAttributeGap = typeof ReviewedCurrentAttributeGap.Type;

/**
 * Requires every pinned current attribute missing from webref to have an exact
 * reviewed override, with no stale or speculative entries.
 *
 * @since 0.0.0
 */
export const assertReviewedCurrentAttributeGap = (input: ReviewedCurrentAttributeGap): void => {
  const webrefNames = MutableHashSet.fromIterable(input.webref);
  const missingFromWebref = pipe(
    input.pinned,
    A.filter((name) => !MutableHashSet.has(webrefNames, name)),
    A.sort(Order.String)
  );
  const reviewedNames = A.sort(input.reviewed, Order.String);
  if (encodeJson(missingFromWebref) !== encodeJson(reviewedNames)) {
    failGeneration(
      `HTML generator current-attribute gap for <${input.tag}> requires an exact reviewed override; expected ${encodeJson(missingFromWebref)}, received ${encodeJson(reviewedNames)}`
    );
  }
};

const buildModel = (
  data: RawData
): {
  model: string;
  meta: string;
  conforming: number;
  total: number;
} => {
  const { classification, contentModel, dfns, elements: elementsData, obsoleteInterfaces } = data;

  const elementDfns = A.filter(dfns, (d) => d.type === "element");
  const elementNames: ReadonlyArray<string> = A.map(elementDfns, (d) => d.linkingText[0]);
  const elementNameSet = MutableHashSet.fromIterable(elementNames);
  const isObsolete = (d: Dfn | undefined): boolean => d !== undefined && /\/obsolete\.html/.test(d.href);
  const findElementDfn = (tag: string): Dfn | undefined =>
    pipe(
      elementDfns,
      A.findFirst((entry) => entry.linkingText[0] === tag),
      O.getOrUndefined
    );

  // element -> specific attribute names (webref `for` arrays already expand
  // groups to concrete element names; the only non-element `for` tokens are the
  // global groups, which we skip).
  const elemAttrs = MutableHashMap.empty<string, MutableHashSet.MutableHashSet<string>>();
  for (const name of elementNames) MutableHashMap.set(elemAttrs, name, MutableHashSet.empty<string>());
  for (const ea of A.filter(dfns, (d) => d.type === "element-attr")) {
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
  for (const av of A.filter(dfns, (d) => d.type === "attr-value")) {
    for (const f of av.for ?? []) {
      const arr = MutableHashMap.get(enumValues, f).pipe(O.getOrElse(A.empty<string>));
      MutableHashMap.set(enumValues, f, A.append(arr, av.linkingText[0]));
    }
  }
  for (const [key, values] of R.toEntries(classification.enumeratedAttributeValueOverrides)) {
    if (A.length(A.dedupe(values)) !== A.length(values)) {
      failGeneration(`HTML generator enumerated-value override for ${key} contains duplicate keywords`);
    }
    MutableHashMap.set(enumValues, key, A.copy(values));
  }
  for (const [tag, requirements] of R.toEntries(classification.attributeRequirements)) {
    for (const requirement of requirements) {
      for (const constraint of requirement.constraints ?? []) {
        if (!isAllowedValuesConstraint(constraint)) {
          continue;
        }
        const key = `${tag}/${constraint.attribute}`;
        const values = pipe(
          MutableHashMap.get(enumValues, key),
          O.getOrElse(A.empty<string>),
          A.appendAll(constraint.values),
          A.dedupe,
          A.sort(Order.String)
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
    const definition = findElementDfn(tag);
    const webref = MutableHashMap.get(elemAttrs, tag).pipe(
      O.getOrElse((): MutableHashSet.MutableHashSet<string> => MutableHashSet.empty())
    );
    const webrefSpecific = MutableHashSet.fromIterable(
      A.filter(webref, (name) => !MutableHashSet.has(globalKeys, name))
    );
    if (isObsolete(definition)) {
      MutableHashMap.set(currentElemAttrs, tag, MutableHashSet.empty());
      MutableHashMap.set(obsoleteElemAttrs, tag, webrefSpecific);
      continue;
    }

    const pinned =
      contentModel[tag]?.attributes ??
      failGeneration(`HTML generator has no pinned current-attribute inventory for conforming <${tag}>`);
    if (!A.contains(pinned, "globals")) {
      failGeneration(`HTML generator requires the pinned <${tag}> inventory to classify global attributes explicitly`);
    }
    const pinnedSpecific = MutableHashSet.fromIterable(A.filter(pinned, (name) => name !== "globals"));
    const reviewed = A.sort(classification.currentAttributeOverrides[tag] ?? A.empty(), Order.String);
    assertReviewedCurrentAttributeGap({
      pinned: A.fromIterable(pinnedSpecific),
      reviewed,
      tag,
      webref: A.fromIterable(webrefSpecific),
    });
    MutableHashMap.set(currentElemAttrs, tag, pinnedSpecific);
    MutableHashMap.set(
      obsoleteElemAttrs,
      tag,
      MutableHashSet.fromIterable(A.filter(webrefSpecific, (name) => !MutableHashSet.has(pinnedSpecific, name)))
    );
  }
  for (const tag of R.keys(classification.currentAttributeOverrides)) {
    if (!MutableHashSet.has(elementNameSet, tag)) {
      failGeneration(`HTML generator current-attribute override names unknown element <${tag}>`);
    }
    if (isObsolete(findElementDfn(tag))) {
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
  const globalBooleanAttributes = A.filter(R.keys(GlobalAttributes), (name) =>
    S.is(GlobalAttributes[name])(O.some(true))
  );
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
    encodeJson(A.sort(R.keys(EnumeratedGlobalAttributes), Order.String)) !==
    encodeJson(requiredEnumeratedGlobalAttributes)
  ) {
    failGeneration(
      `HTML generator requires the exact hand-authored enumerated global-attribute inventory; expected ${encodeJson(requiredEnumeratedGlobalAttributes)}, received ${encodeJson(A.sort(R.keys(EnumeratedGlobalAttributes), Order.String))}`
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
    const folded = A.map(values, toAsciiLowerCase);
    if (A.length(A.dedupe(folded)) !== A.length(values)) {
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
    if (A.length(A.dedupe(attributes)) !== A.length(attributes)) {
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
      A.length(A.dedupe(groups)) !== A.length(groups) ||
      A.some(groups, (group) => !A.contains(autocompleteGroupNames, group))
    ) {
      failGeneration(`HTML generator autocomplete groups for input state ${state} are duplicated or unclassified`);
    }
  }
  if (
    A.length(A.dedupe(classification.autocompleteContactFields)) !==
      A.length(classification.autocompleteContactFields) ||
    A.some(classification.autocompleteContactFields, (field) => !A.contains(autocompleteFields, field))
  ) {
    failGeneration("HTML generator autocomplete contact fields must be unique classified autocomplete fields");
  }

  const requiredCaseSensitiveKeywordAttributes = ["ol/type"];
  const caseSensitiveKeywordAttributeInventory = A.sort(caseSensitiveKeywordAttrs, Order.String);
  if (!jsonEqual(caseSensitiveKeywordAttributeInventory, requiredCaseSensitiveKeywordAttributes)) {
    failGeneration(
      `HTML generator requires the exact case-sensitive keyword-attribute inventory; expected ${encodeJson(requiredCaseSensitiveKeywordAttributes)}, received ${encodeJson(caseSensitiveKeywordAttributeInventory)}`
    );
  }
  const orderedListTypeValues = pipe(MutableHashMap.get(enumValues, "ol/type"), O.getOrElse(A.empty<string>));
  if (
    A.isReadonlyArrayEmpty(orderedListTypeValues) ||
    A.length(A.dedupe(A.map(orderedListTypeValues, Str.toLowerCase))) === A.length(orderedListTypeValues)
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
  const enumeratedAttributeValueOverrideKeys = A.sort(
    R.keys(classification.enumeratedAttributeValueOverrides),
    Order.String
  );
  if (!jsonEqual(enumeratedAttributeValueOverrideKeys, requiredEnumeratedAttributeValueOverrides)) {
    failGeneration(
      `HTML generator requires the exact enumerated-value override inventory; expected ${encodeJson(requiredEnumeratedAttributeValueOverrides)}, received ${encodeJson(enumeratedAttributeValueOverrideKeys)}`
    );
  }
  if (
    !jsonEqual(classification.enumeratedAttributeValueOverrides["area/shape"], ["circle", "default", "poly", "rect"])
  ) {
    failGeneration("HTML generator requires the exact conforming <area shape> keyword domain");
  }
  const formEncodingKeywords = ["application/x-www-form-urlencoded", "multipart/form-data", "text/plain"];
  for (const attribute of ["button/formenctype", "input/formenctype"]) {
    if (!jsonEqual(classification.enumeratedAttributeValueOverrides[attribute], formEncodingKeywords)) {
      failGeneration(`HTML generator requires the exact conforming ${attribute} keyword domain`);
    }
  }
  for (const attribute of ["link/blocking", "script/blocking", "style/blocking"]) {
    if (!jsonEqual(classification.enumeratedAttributeValueOverrides[attribute], ["render"])) {
      failGeneration(`HTML generator requires the exact conforming ${attribute} token domain`);
    }
  }
  if (
    !jsonEqual(classification.enumeratedAttributeValueOverrides["meta/http-equiv"], [
      "content-type",
      "default-style",
      "refresh",
      "x-ua-compatible",
      "content-security-policy",
    ])
  ) {
    failGeneration("HTML generator requires the exact current conforming meta/http-equiv keyword domain");
  }

  const elementClassifications = [voidEls, rawTextEls, rcDataEls, plaintextEls, normalEls];
  for (const tag of elementNames) {
    const matches = pipe(
      elementClassifications,
      A.filter((classificationSet) => MutableHashSet.has(classificationSet, tag)),
      A.length
    );
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

  for (const [classificationName, classificationSet] of A.make(
    Tuple.make("void", voidEls),
    Tuple.make("rawText", rawTextEls),
    Tuple.make("rcData", rcDataEls),
    Tuple.make("plaintext", plaintextEls),
    Tuple.make("normal", normalEls),
    Tuple.make("emptyContentModelElements", emptyContentModelEls)
  )) {
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
  const configuredGrammarTags = A.sort(R.keys(classification.specialChildGrammars), Order.String);
  if (!jsonEqual(configuredGrammarTags, grammarRequiredTags)) {
    failGeneration(
      `HTML generator requires an exact special-child grammar inventory; expected ${encodeJson(grammarRequiredTags)}, received ${encodeJson(configuredGrammarTags)}`
    );
  }
  const opaqueContentTokens = pipe(
    R.values(contentModel),
    A.flatMap((entry) => A.filter(entry.children ?? A.empty(), Str.includes("inner content elements"))),
    MutableHashSet.fromIterable,
    A.sort(Order.String)
  );
  const expandedContentTokens = A.sort(R.keys(classification.contentTokenExpansions), Order.String);
  if (!jsonEqual(opaqueContentTokens, expandedContentTokens)) {
    failGeneration(
      `HTML generator requires an exact contextual content-token expansion inventory; expected ${encodeJson(opaqueContentTokens)}, received ${encodeJson(expandedContentTokens)}`
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
      A.isReadonlyArrayNonEmpty(unexpected) ||
      !MutableHashSet.has(elementNameSet, tag) ||
      !MutableHashSet.has(modeledAttributesFor(tag), attribute)
    ) {
      failGeneration(`HTML generator enumerated-value override references unknown ${key}`);
    }
  }

  const syntaxSensitiveAttributeNames = MutableHashSet.fromIterable([
    "imagesizes",
    "imagesrcset",
    "sizes",
    "srcset",
    "srclang",
  ]);
  const requiredAttributeSyntaxKeys = pipe(
    elementNames,
    A.flatMap((tag) =>
      pipe(
        MutableHashMap.get(currentElemAttrs, tag),
        O.getOrElse(() => MutableHashSet.empty<string>()),
        A.filter((attribute) => MutableHashSet.has(syntaxSensitiveAttributeNames, attribute)),
        A.map((attribute) => `${tag}/${attribute}`)
      )
    ),
    A.sort(Order.String)
  );
  const configuredAttributeSyntaxKeys = A.sort(R.keys(classification.attributeSyntaxes), Order.String);
  if (!jsonEqual(configuredAttributeSyntaxKeys, requiredAttributeSyntaxKeys)) {
    failGeneration(
      `HTML generator requires an exact special-attribute syntax inventory; expected ${encodeJson(requiredAttributeSyntaxKeys)}, received ${encodeJson(configuredAttributeSyntaxKeys)}`
    );
  }
  for (const [key, syntax] of R.toEntries(classification.attributeSyntaxes)) {
    const [tag, attribute, ...unexpected] = Str.split("/")(key);
    const expectedSyntax =
      tag === "track" && attribute === "srclang"
        ? "language-tag"
        : attribute === "srcset" || attribute === "imagesrcset"
          ? "srcset"
          : tag === "link" && attribute === "sizes"
            ? "icon-sizes"
            : "source-size-list";
    if (
      tag === undefined ||
      attribute === undefined ||
      A.isReadonlyArrayNonEmpty(unexpected) ||
      syntax !== expectedSyntax
    ) {
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
  const configuredConformanceRuleTags = A.sort(R.keys(classification.conformanceRules), Order.String);
  if (!jsonEqual(configuredConformanceRuleTags, requiredConformanceRuleTags)) {
    failGeneration(
      `HTML generator requires an exact reviewed conformance-rule inventory; expected ${encodeJson(requiredConformanceRuleTags)}, received ${encodeJson(configuredConformanceRuleTags)}`
    );
  }
  const configuredForbiddenDescendantTags = pipe(
    R.toEntries(classification.conformanceRules),
    A.filter(([, rules]) => rules.forbiddenDescendants !== undefined),
    A.map(([tag]) => tag),
    A.sort(Order.String)
  );
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
  if (!jsonEqual(configuredForbiddenDescendantTags, requiredForbiddenDescendantTags)) {
    failGeneration(
      `HTML generator requires an exact forbidden-descendant inventory; expected ${encodeJson(requiredForbiddenDescendantTags)}, received ${encodeJson(configuredForbiddenDescendantTags)}`
    );
  }
  const configuredPermittedAncestorTags = pipe(
    R.toEntries(classification.conformanceRules),
    A.filter(([, rules]) => rules.permittedAncestors !== undefined),
    A.map(([tag]) => tag),
    A.sort(Order.String)
  );
  if (!jsonEqual(configuredPermittedAncestorTags, ["main"])) {
    failGeneration(
      `HTML generator requires permitted-ancestor metadata exactly for <main>; received ${encodeJson(configuredPermittedAncestorTags)}`
    );
  }
  const configuredRequiredAncestorTags = pipe(
    R.toEntries(classification.conformanceRules),
    A.filter(([, rules]) => rules.requiredAncestor !== undefined),
    A.map(([tag]) => tag),
    A.sort(Order.String)
  );
  if (!jsonEqual(configuredRequiredAncestorTags, ["area"])) {
    failGeneration(
      `HTML generator requires required-ancestor metadata exactly for <area>; received ${encodeJson(configuredRequiredAncestorTags)}`
    );
  }
  const configuredDocumentVisibilityTags = pipe(
    R.toEntries(classification.conformanceRules),
    A.filter(([, rules]) => rules.documentVisibilityLimit !== undefined),
    A.map(([tag]) => tag),
    A.sort(Order.String)
  );
  if (!jsonEqual(configuredDocumentVisibilityTags, ["main"])) {
    failGeneration(
      `HTML generator requires document-visibility metadata exactly for <main>; received ${encodeJson(configuredDocumentVisibilityTags)}`
    );
  }
  const configuredForbiddenNamedAncestors = classification.conformanceRules.main?.forbiddenNamedAncestors;
  const requiredForbiddenNamedAncestors = [
    {
      attributes: ["aria-label", "aria-labelledby", "title"],
      tag: "form",
    },
  ];
  if (!jsonEqual(configuredForbiddenNamedAncestors, requiredForbiddenNamedAncestors)) {
    failGeneration(
      `HTML generator requires the exact named-ancestor exclusion for <main>; expected ${encodeJson(requiredForbiddenNamedAncestors)}, received ${encodeJson(configuredForbiddenNamedAncestors)}`
    );
  }
  const knownCategories = MutableHashSet.fromIterable(
    A.flatMap(R.values(contentModel), (entry) => entry.categories ?? A.empty())
  );
  for (const [tag, rules] of R.toEntries(classification.conformanceRules)) {
    if (!MutableHashSet.has(elementNameSet, tag) || isObsolete(findElementDfn(tag))) {
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
      if (A.length(attributes) + A.length(categories) + A.length(tags) === 0) {
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
        if (!MutableHashSet.has(elementNameSet, descendantTag) || isObsolete(findElementDfn(descendantTag))) {
          failGeneration(
            `HTML generator forbidden-descendant rules for <${tag}> reference non-current <${descendantTag}>`
          );
        }
      }
    }
    for (const ancestorTag of rules.permittedAncestors ?? []) {
      if (!MutableHashSet.has(elementNameSet, ancestorTag) || isObsolete(findElementDfn(ancestorTag))) {
        failGeneration(`HTML generator conformance rules for <${tag}> permit non-current <${ancestorTag}>`);
      }
    }
    if (rules.requiredAncestor !== undefined) {
      const ancestorTag = rules.requiredAncestor;
      if (!MutableHashSet.has(elementNameSet, ancestorTag) || isObsolete(findElementDfn(ancestorTag))) {
        failGeneration(`HTML generator conformance rules for <${tag}> require non-current <${ancestorTag}>`);
      }
    }
    for (const condition of rules.forbiddenNamedAncestors ?? []) {
      if (!MutableHashSet.has(elementNameSet, condition.tag) || isObsolete(findElementDfn(condition.tag))) {
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
  const configuredConditionalCategoryTags = A.sort(R.keys(classification.conditionalCategories), Order.String);
  if (!jsonEqual(configuredConditionalCategoryTags, requiredConditionalCategoryTags)) {
    failGeneration(
      `HTML generator requires an exact conditional-category inventory; expected ${encodeJson(requiredConditionalCategoryTags)}, received ${encodeJson(configuredConditionalCategoryTags)}`
    );
  }
  for (const [tag, rules] of R.toEntries(classification.conditionalCategories)) {
    if (!MutableHashSet.has(elementNameSet, tag) || isObsolete(findElementDfn(tag))) {
      failGeneration(`HTML generator conditional-category metadata names non-current element <${tag}>`);
    }
    const modeledAttributes = modeledAttributesFor(tag);
    for (const rule of rules) {
      const categories = contentModel[tag]?.categories ?? [];
      if (!A.contains(categories, rule.category)) {
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
          O.getOrElse(A.empty<string>)
        );
        if (
          A.isReadonlyArrayEmpty(tokens) ||
          A.length(A.dedupe(tokens)) !== A.length(tokens) ||
          A.some(tokens, (token) => Str.toLowerCase(token) !== token || !A.contains(attributeValues, token))
        ) {
          failGeneration(
            `HTML generator conditional category ${tag}/${rule.category} has an invalid token-subset registry`
          );
        }
      }
    }
  }
  const attributeRequirementTags = A.sort(R.keys(classification.attributeRequirements), Order.String);
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
  if (!jsonEqual(attributeRequirementTags, requiredAttributeRequirementTags)) {
    failGeneration(
      `HTML generator requires an exact attribute-requirement inventory; expected ${encodeJson(requiredAttributeRequirementTags)}, received ${encodeJson(attributeRequirementTags)}`
    );
  }
  const nonBlankRequirementTags = pipe(
    R.toEntries(classification.attributeRequirements),
    A.filter(([, requirements]) => A.some(requirements, (requirement) => requirement.nonBlank !== undefined)),
    A.map(([tag]) => tag),
    A.sort(Order.String)
  );
  if (!jsonEqual(nonBlankRequirementTags, ["link"])) {
    failGeneration(
      `HTML generator requires non-blank attribute requirements exactly for <link>; received ${encodeJson(nonBlankRequirementTags)}`
    );
  }
  const linkNonBlankRequirements = A.filter(
    classification.attributeRequirements.link ?? [],
    (requirement) => requirement.nonBlank !== undefined
  );
  if (
    A.length(linkNonBlankRequirements) !== 1 ||
    !jsonEqual(linkNonBlankRequirements[0]?.nonBlank, ["imagesrcset"]) ||
    !jsonEqual(linkNonBlankRequirements[0]?.required, [["href", "imagesrcset"]]) ||
    !jsonEqual(linkNonBlankRequirements[0]?.validNonEmptyUrl, ["href"])
  ) {
    failGeneration("HTML generator requires <link> to have an address and validates href as a non-empty URL");
  }
  const validNonEmptyUrlRequirementTags = pipe(
    R.toEntries(classification.attributeRequirements),
    A.filter(([, requirements]) => A.some(requirements, (requirement) => requirement.validNonEmptyUrl !== undefined)),
    A.map(([tag]) => tag),
    A.sort(Order.String)
  );
  if (!jsonEqual(validNonEmptyUrlRequirementTags, ["link"])) {
    failGeneration(
      `HTML generator requires valid non-empty URL requirements exactly for <link>; received ${encodeJson(validNonEmptyUrlRequirementTags)}`
    );
  }
  const constrainedRequirementTags = pipe(
    R.toEntries(classification.attributeRequirements),
    A.filter(([, requirements]) => A.some(requirements, (requirement) => requirement.constraints !== undefined)),
    A.map(([tag]) => tag),
    A.sort(Order.String)
  );
  if (!jsonEqual(constrainedRequirementTags, ["link", "meta"])) {
    failGeneration(
      `HTML generator requires value constraints exactly for <link> and <meta>; received ${encodeJson(constrainedRequirementTags)}`
    );
  }
  const metaCharsetRequirements = A.filter(
    classification.attributeRequirements.meta ?? [],
    (requirement) => requirement.constraints !== undefined
  );
  const metaCharsetConstraint = metaCharsetRequirements[0]?.constraints?.[0];
  if (
    A.length(metaCharsetRequirements) !== 1 ||
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
  const trackSubtitleRequirements = A.filter(
    classification.attributeRequirements.track ?? [],
    (requirement) =>
      isAttributeEqualsOrMissingPredicate(requirement.when) &&
      requirement.when.attribute === "kind" &&
      requirement.when.value === "subtitles"
  );
  if (A.length(trackSubtitleRequirements) !== 1 || !jsonEqual(trackSubtitleRequirements[0]?.required, [["srclang"]])) {
    failGeneration("HTML generator requires <track> with omitted kind or kind=subtitles to have srclang");
  }
  const linkAsValues = pipe(
    MutableHashMap.get(enumValues, "link/as"),
    O.getOrElse(A.empty<string>),
    A.dedupe,
    A.sort(Order.String)
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
  if (!jsonEqual(linkAsValues, requiredLinkAsValues)) {
    failGeneration(
      `HTML generator requires the exact link/as preload destination domain; expected ${encodeJson(requiredLinkAsValues)}, received ${encodeJson(linkAsValues)}`
    );
  }
  for (const [tag, requirements] of R.toEntries(classification.attributeRequirements)) {
    if (!MutableHashSet.has(elementNameSet, tag) || isObsolete(findElementDfn(tag))) {
      failGeneration(`HTML generator attribute-requirement metadata names non-current element <${tag}>`);
    }
    const modeledAttributes = modeledAttributesFor(tag);
    for (const requirement of requirements) {
      if (requirement.when !== undefined && !MutableHashSet.has(modeledAttributes, requirement.when.attribute)) {
        failGeneration(
          `HTML generator attribute requirement for <${tag}> references unknown ${requirement.when.attribute}`
        );
      }
      if (isAttributeContainsTokenPredicate(requirement.when)) {
        const { attribute, value } = requirement.when;
        if (!isClassifiedAs(spaceSeparatedTokenAttrs, tag, attribute)) {
          failGeneration(
            `HTML generator token predicate for <${tag}> references non-token-list attribute ${attribute}`
          );
        }
        const values = MutableHashMap.get(enumValues, `${tag}/${attribute}`).pipe(O.getOrElse(A.empty<string>));
        if (Str.toLowerCase(value) !== value || !A.contains(values, value)) {
          failGeneration(
            `HTML generator token predicate for <${tag} ${attribute}> references unclassified token ${value}`
          );
        }
      }
      if (isAttributeEqualityPredicate(requirement.when)) {
        const { attribute, value } = requirement.when;
        const values = MutableHashMap.get(enumValues, `${tag}/${attribute}`).pipe(O.getOrElse(A.empty<string>));
        if (A.isReadonlyArrayNonEmpty(values) && !A.contains(values, value)) {
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
              const domain = MutableHashMap.get(enumValues, `${tag}/${attribute}`).pipe(O.getOrElse(A.empty<string>));
              if (
                A.length(A.dedupe(values)) !== A.length(values) ||
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
              const domain = MutableHashMap.get(enumValues, `${tag}/${attribute}`).pipe(O.getOrElse(A.empty<string>));
              if (
                !isClassifiedAs(spaceSeparatedTokenAttrs, tag, attribute) ||
                A.length(A.dedupe(values)) !== A.length(values) ||
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
              const domain = MutableHashMap.get(enumValues, `${tag}/${attribute}`).pipe(O.getOrElse(A.empty<string>));
              if (
                !isClassifiedAs(spaceSeparatedTokenAttrs, tag, attribute) ||
                A.length(A.dedupe(values)) !== A.length(values) ||
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
              const domain = MutableHashMap.get(enumValues, `${tag}/${attribute}`).pipe(O.getOrElse(A.empty<string>));
              if (Str.isEmpty(value) || (A.isReadonlyArrayNonEmpty(domain) && !A.contains(domain, value))) {
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
        if (!MutableHashSet.has(elementNameSet, parent) || isObsolete(findElementDfn(parent))) {
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
  const attributeEqualityTags = A.sort(R.keys(classification.attributeEqualities), Order.String);
  const requiredAttributeEqualityTags = ["map"];
  if (!jsonEqual(attributeEqualityTags, requiredAttributeEqualityTags)) {
    failGeneration(
      `HTML generator requires an exact attribute-equality inventory; expected ${encodeJson(requiredAttributeEqualityTags)}, received ${encodeJson(attributeEqualityTags)}`
    );
  }
  for (const [tag, equalities] of R.toEntries(classification.attributeEqualities)) {
    const modeledAttributes = modeledAttributesFor(tag);
    if (A.length(equalities) !== 1 || equalities[0]?.left !== "id" || equalities[0]?.right !== "name") {
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
  const htmlIdValueAttributeInventory = A.sort(htmlIdValueAttrs, Order.String);
  const requiredHtmlIdValueAttributeInventory = ["map/name"];
  if (!jsonEqual(htmlIdValueAttributeInventory, requiredHtmlIdValueAttributeInventory)) {
    failGeneration(
      `HTML generator requires an exact HTML id-value attribute inventory; expected ${encodeJson(requiredHtmlIdValueAttributeInventory)}, received ${encodeJson(htmlIdValueAttributeInventory)}`
    );
  }
  for (const key of A.appendAll(classification.idReferenceAttributes, classification.idReferenceListAttributes)) {
    const [tag, attribute, ...unexpected] = Str.split("/")(key);
    if (
      tag === undefined ||
      attribute === undefined ||
      A.isReadonlyArrayNonEmpty(unexpected) ||
      !MutableHashSet.has(elementNameSet, tag) ||
      !MutableHashSet.has(modeledAttributesFor(tag), attribute)
    ) {
      failGeneration(`HTML generator id-reference inventory references unknown ${key}`);
    }
  }
  const uniqueAttributeTags = A.sort(R.keys(classification.uniqueAttributes), Order.String);
  const requiredUniqueAttributeTags = ["map"];
  if (!jsonEqual(uniqueAttributeTags, requiredUniqueAttributeTags)) {
    failGeneration(
      `HTML generator requires an exact tree-unique attribute inventory; expected ${encodeJson(requiredUniqueAttributeTags)}, received ${encodeJson(uniqueAttributeTags)}`
    );
  }
  for (const [tag, attributes] of R.toEntries(classification.uniqueAttributes)) {
    if (!jsonEqual(A.sort(attributes, Order.String), ["name"])) {
      failGeneration(`HTML generator requires <${tag}> tree-unique attributes to be exactly ["name"]`);
    }
    const modeledAttributes = modeledAttributesFor(tag);
    for (const attribute of attributes) {
      if (!MutableHashSet.has(modeledAttributes, attribute)) {
        failGeneration(`HTML generator tree-unique attribute for <${tag}> references unknown ${attribute}`);
      }
    }
  }
  const numericRelationshipTags = A.sort(R.keys(classification.numericAttributeRelationships), Order.String);
  const requiredNumericRelationshipTags = ["input", "meter", "progress", "textarea"];
  if (!jsonEqual(numericRelationshipTags, requiredNumericRelationshipTags)) {
    failGeneration(
      `HTML generator requires an exact numeric-relationship inventory; expected ${encodeJson(requiredNumericRelationshipTags)}, received ${encodeJson(numericRelationshipTags)}`
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
    if (A.isReadonlyArrayEmpty(relationships)) {
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
  for (const [label, adjustments] of A.make(
    Tuple.make("SVG element", classification.svgElementNameAdjustments),
    Tuple.make("SVG attribute", classification.svgAttributeNameAdjustments),
    Tuple.make("MathML attribute", classification.mathMlAttributeNameAdjustments)
  )) {
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
    if (
      isClassifiedAs(spaceSeparatedTokenAttrs, el, attr) &&
      O.isSome(valsOption) &&
      A.isReadonlyArrayNonEmpty(valsOption.value)
    ) {
      const uniq = A.fromIterable(MutableHashSet.fromIterable(valsOption.value));
      return {
        runtime: optionalRuntime(`makeSpaceSeparatedTokenList(${encodeJson(uniq)})`),
        type: "O.Option<string>",
        encoded: "string",
      };
    }
    if (O.isSome(valsOption) && A.isReadonlyArrayNonEmpty(valsOption.value)) {
      const uniq = A.fromIterable(MutableHashSet.fromIterable(valsOption.value));
      const union = literalUnion(uniq);
      if (isClassifiedAs(caseSensitiveKeywordAttrs, el, attr)) {
        const schema = A.length(uniq) === 1 ? `S.Literal(${encodeJson(uniq[0])})` : `S.Literals(${encodeJson(uniq)})`;
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
        runtime: optionalRuntime(`makeAsciiCaseInsensitiveEnumerated(${encodeJson(uniq)})`),
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
  const specificBodies = (
    el: string
  ): {
    encoded: string;
    runtime: string;
    type: string;
  } => {
    const current = MutableHashMap.get(currentElemAttrs, el).pipe(O.getOrElse(() => MutableHashSet.empty<string>()));
    const obsolete = MutableHashMap.get(obsoleteElemAttrs, el).pipe(O.getOrElse(() => MutableHashSet.empty<string>()));
    const attrs = A.sort(MutableHashSet.fromIterable(A.appendAll(current, obsolete)), Order.String);
    if (A.isReadonlyArrayEmpty(attrs)) return { encoded: "", runtime: "", type: "" };
    const fields = A.map(attrs, (attr) => Tuple.make(attr, valueSchema(el, attr)));
    return {
      runtime: pipe(
        fields,
        A.map(([attr, spec]) => `${encodeJson(attr)}: ${spec.runtime}`),
        A.join(", ")
      ),
      type: pipe(
        fields,
        A.map(([attr, spec]) => `readonly ${encodeJson(attr)}: ${spec.type}`),
        A.join("; ")
      ),
      encoded: pipe(
        fields,
        A.map(([attr, spec]) => `readonly ${encodeJson(attr)}?: ${spec.encoded}`),
        A.join("; ")
      ),
    };
  };

  const interfaceOf = (name: string, obsolete: boolean): string =>
    MutableHashMap.get(interfaceByName, name).pipe(
      O.getOrElse(() => obsoleteInterfaces[name] ?? (obsolete ? "HTMLUnknownElement" : "HTMLElement"))
    );

  const els: ReadonlyArray<El> = pipe(
    elementNames,
    A.sort(Order.String),
    A.map((tag): El => {
      const d = findElementDfn(tag);
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
      const currentAttributes = pipe(
        MutableHashMap.get(currentElemAttrs, tag),
        O.getOrElse(() => MutableHashSet.empty<string>()),
        A.sort(Order.String)
      );
      const obsoleteAttributes = pipe(
        MutableHashMap.get(obsoleteElemAttrs, tag),
        O.getOrElse(() => MutableHashSet.empty<string>()),
        A.sort(Order.String)
      );
      return {
        tag,
        cls: className(tag),
        attributeEqualities: classification.attributeEqualities[tag] ?? A.empty(),
        attributeRequirements: classification.attributeRequirements[tag] ?? A.empty(),
        encoded,
        obsolete,
        kind,
        iface: interfaceOf(tag, obsolete),
        categories: contentModel[tag]?.categories ?? A.empty(),
        children: contentModel[tag]?.children ?? A.empty(),
        conditionalCategories: classification.conditionalCategories[tag] ?? A.empty(),
        currentAttributes,
        numericAttributeRelationships: classification.numericAttributeRelationships[tag] ?? A.empty(),
        obsoleteAttributes,
        rules: classification.conformanceRules[tag] ?? ReviewedConformanceRules.make({}),
        childSequencePattern: classification.childSequencePatterns[tag],
        childGrammar: classification.specialChildGrammars[tag],
        runtime,
        textMode,
        type,
        uniqueAttributes: classification.uniqueAttributes[tag] ?? A.empty(),
      };
    })
  );

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
    const runtimeFields = pipe(
      ["    ...GlobalAttributes,", e.runtime !== "" ? `    ${e.runtime},` : "", childField(e.kind)],
      A.filter(Str.isNonEmpty),
      A.join("\n")
    );
    const typeFields = (encoded: boolean): string =>
      pipe(
        [
          `    readonly _tag: "${e.tag}";`,
          encoded ? (e.encoded !== "" ? `    ${e.encoded};` : "") : e.type !== "" ? `    ${e.type};` : "",
          childTypeField(e.kind, encoded),
        ],
        A.filter(Str.isNonEmpty),
        A.join("\n")
      );
    return `/**
 * ${desc}
 *
 * **Example** (Construct the ${e.cls} node)
 *
 * \`\`\`ts
 * import { ${e.cls} } from "@beep/html/Html.model"
 *
 * const node = ${e.cls}.make(${exampleArgs(e.kind)})
 * node._tag // => "${e.tag}"
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
  $I.annote("${e.cls}", { description: ${encodeJson(desc)} })
) {}
/**
 * Companion namespace for {@link ${e.cls}}.
 *
 * **Example** (Encoded shape of ${e.cls})
 *
 * \`\`\`ts
 * import { ${e.cls} } from "@beep/html/Html.model"
 *
 * const encoded: ${e.cls}.Encoded = ${exampleEncoded(e.tag, e.kind)}
 * encoded._tag // => "${e.tag}"
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
 * **Example** (Construct the ${cls} node)
 *
 * \`\`\`ts
 * import { ${cls} } from "@beep/html/Html.model"
 *
 * const node = ${cls}.make(${exampleArgs("normal")})
 * node._tag // => "${tag}"
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export class ${cls} extends S.TaggedClass<${cls}>($I\`${cls}\`)(
  "${tag}",
  { children: HtmlChildren },
  $I.annote("${cls}", { description: ${encodeJson(desc)} })
) {}
/**
 * Companion namespace for {@link ${cls}}.
 *
 * **Example** (Encoded shape of ${cls})
 *
 * \`\`\`ts
 * import { ${cls} } from "@beep/html/Html.model"
 *
 * const encoded: ${cls}.Encoded = ${exampleEncoded(tag, "normal")}
 * encoded._tag // => "${tag}"
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
 * **Example** (Construct a Document)
 *
 * \`\`\`ts
 * import { Document } from "@beep/html/Html.model"
 *
 * const document = Document.make({ children: [] })
 * document._tag // => "#document"
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
 * **Example** (Encoded shape of Document)
 *
 * \`\`\`ts
 * import type { Document } from "@beep/html/Html.model"
 *
 * const document: Document.Encoded = { _tag: "#document", children: [] }
 * document._tag // => "#document"
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
 * **Example** (Check a ForeignNamespace value)
 *
 * \`\`\`ts
 * import { ForeignNamespace } from "@beep/html/Html.model"
 *
 * ForeignNamespace.is.svg("svg") // => true
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
 * **Example** (Annotate a ForeignNamespace value)
 *
 * \`\`\`ts
 * import type { ForeignNamespace } from "@beep/html/Html.model"
 *
 * const namespace: ForeignNamespace = "svg"
 * namespace // => "svg"
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export type ForeignNamespace = typeof ForeignNamespace.Type;

/**
 * An opaque SVG or MathML element carried inside the HTML AST.
 *
 * **Gotchas**
 *
 * This package validates the foreign node's serializable shape but does not
 * model the complete SVG or MathML vocabularies.
 *
 * **Example** (Construct a ForeignElement)
 *
 * \`\`\`ts
 * import { ForeignElement } from "@beep/html/Html.model"
 *
 * const svg = ForeignElement.make({ namespace: "svg", name: "svg", children: [] })
 * svg.name // => "svg"
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
 * **Example** (Encoded shape of ForeignElement)
 *
 * \`\`\`ts
 * import type { ForeignElement } from "@beep/html/Html.model"
 *
 * const svg: ForeignElement.Encoded = {
 *   _tag: "#foreign",
 *   namespace: "svg",
 *   name: "svg",
 *   children: []
 * }
 * svg.name // => "svg"
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

  const childMembers = pipe(
    els,
    A.map((e) => e.cls),
    A.appendAll(["ForeignElement", "Text", "Comment"])
  );
  const rootMembers = A.appendAll(childMembers, ["Document", "Fragment"]);
  const unionMembers = A.append(rootMembers, "Doctype");

  const categoryUnion = (name: string, cat: string): string => {
    const matching = A.filter(els, (e) => A.contains(e.categories, cat));
    if (A.isReadonlyArrayEmpty(matching)) return "";
    const members = A.map(matching, (e) => e.cls);
    const types = pipe(
      members,
      A.map((m) => `${m}.Type`),
      A.join(" | ")
    );
    const encodeds = pipe(
      members,
      A.map((m) => `${m}.Encoded`),
      A.join(" | ")
    );
    const representative = pipe(
      matching,
      A.head,
      O.getOrElse(() => failGeneration(`HTML generator category ${cat} has no representative`))
    );
    return `/**
 * Advisory sub-union of elements in the "${cat}" content category. Non-normative
 * (derived from the WHATWG element index); see \`data/SOURCES.md\`.
 *
 * **Example** (Match ${representative.cls} against ${name})
 *
 * \`\`\`ts
 * import { ${representative.cls}, ${name} } from "@beep/html/Html.model"
 * import * as S from "effect/Schema"
 *
 * S.is(${name})(${representative.cls}.make(${exampleArgs(representative.kind)})) // => true
 * \`\`\`
 *
 * @category schemas
 * @since 0.0.0
 */
export const ${name} = taggedUnion<${types}, ${encodeds}>(
  "${name}",
  "Advisory ${cat}-content element union.",
  [${A.join(members, ", ")}]
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
 * **Example** (Check an empty HtmlChildren list)
 *
 * \`\`\`ts
 * import { HtmlChildren } from "@beep/html/Html.model"
 * import * as S from "effect/Schema"
 *
 * S.is(HtmlChildren)([]) // => true
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
 * **Example** (Annotate an HtmlChildren value)
 *
 * \`\`\`ts
 * import type { HtmlChildren } from "@beep/html/Html.model"
 *
 * const children: HtmlChildren = []
 * children.length // => 0
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export type HtmlChildren = typeof HtmlChildren.Type;
/**
 * Companion namespace for {@link HtmlChildren}.
 *
 * **Example** (Annotate an HtmlChildren.Type value)
 *
 * \`\`\`ts
 * import type { HtmlChildren } from "@beep/html/Html.model"
 *
 * const children: HtmlChildren.Type = []
 * children.length // => 0
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
 * **Example** (Match a text node against HtmlChild)
 *
 * \`\`\`ts
 * import { HtmlChild } from "@beep/html/Html.model"
 * import { Text } from "@beep/html/Html.nodes"
 * import * as S from "effect/Schema"
 *
 * S.is(HtmlChild)(Text.make({ value: "hello" })) // => true
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export const HtmlChild = taggedUnion<HtmlChild.Type, HtmlChild.Encoded>(
  "HtmlChild",
  "Nodes valid as element or fragment children.",
  [${A.join(childMembers, ", ")}]
);

/**
 * Companion namespace for {@link HtmlChild}.
 *
 * **Example** (Encoded shape of HtmlChild)
 *
 * \`\`\`ts
 * import type { HtmlChild } from "@beep/html/Html.model"
 *
 * const child: HtmlChild.Encoded = { _tag: "#text", value: "hello" }
 * child._tag // => "#text"
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace HtmlChild {
  /** @since 0.0.0 */
  export type Type =
${pipe(
  childMembers,
  A.map((m) => `    | ${m}.Type`),
  A.join("\n")
)};
  /** @since 0.0.0 */
  export type Encoded =
${pipe(
  childMembers,
  A.map((m) => `    | ${m}.Encoded`),
  A.join("\n")
)};
}

/**
 * Discriminated union of serializable HTML roots.
 *
 * **Example** (Match a fragment against HtmlRoot)
 *
 * \`\`\`ts
 * import { Fragment, HtmlRoot } from "@beep/html/Html.model"
 * import * as S from "effect/Schema"
 *
 * S.is(HtmlRoot)(Fragment.make({ children: [] })) // => true
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export const HtmlRoot = taggedUnion<HtmlRoot.Type, HtmlRoot.Encoded>(
  "HtmlRoot",
  "HTML document, fragment, element, or child-node root.",
  [${A.join(rootMembers, ", ")}]
);

/**
 * Companion namespace for {@link HtmlRoot}.
 *
 * **Example** (Encoded shape of HtmlRoot)
 *
 * \`\`\`ts
 * import type { HtmlRoot } from "@beep/html/Html.model"
 *
 * const root: HtmlRoot.Encoded = { _tag: "#fragment", children: [] }
 * root._tag // => "#fragment"
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace HtmlRoot {
  /** @since 0.0.0 */
  export type Type =
${pipe(
  rootMembers,
  A.map((m) => `    | ${m}.Type`),
  A.join("\n")
)};
  /** @since 0.0.0 */
  export type Encoded =
${pipe(
  rootMembers,
  A.map((m) => `    | ${m}.Encoded`),
  A.join("\n")
)};
}

/**
 * Discriminated union of every HTML AST node — all ${A.length(els)} elements plus the
 * text, comment, foreign, doctype, document, and fragment node kinds.
 *
 * **Example** (Match an anchor against HtmlNode)
 *
 * \`\`\`ts
 * import { A, HtmlNode } from "@beep/html/Html.model"
 * import * as S from "effect/Schema"
 *
 * S.is(HtmlNode)(A.make({ children: [] })) // => true
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export const HtmlNode = taggedUnion<HtmlNode.Type, HtmlNode.Encoded>(
  "HtmlNode",
  "Discriminated union of all HTML AST nodes.",
  [${A.join(unionMembers, ", ")}]
);
/**
 * Companion namespace for {@link HtmlNode}.
 *
 * **Example** (Build an HtmlNode.Type value)
 *
 * \`\`\`ts
 * import { A } from "@beep/html/Html.model"
 * import type { HtmlNode } from "@beep/html/Html.model"
 *
 * const node: HtmlNode.Type = A.make({ children: [] })
 * node._tag // => "a"
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace HtmlNode {
  /** @since 0.0.0 */
  export type Type =
${pipe(
  unionMembers,
  A.map((m) => `    | ${m}.Type`),
  A.join("\n")
)};
  /** @since 0.0.0 */
  export type Encoded =
${pipe(
  unionMembers,
  A.map((m) => `    | ${m}.Encoded`),
  A.join("\n")
)};
}`;

  const model = pipe(
    [
      header,
      containerNode("Fragment", "#fragment", "A document fragment node (a detached group of children)."),
      documentNode,
      foreignNode,
      ...A.map(els, elementBlock),
      unionBlock,
      ...pipe(
        CATEGORIES,
        A.map(([n, c]) => categoryUnion(n, c)),
        A.filter(Str.isNonEmpty)
      ),
    ],
    A.join("\n\n")
  );

  const metaEntries = pipe(
    els,
    A.map((e) => {
      const conformance = e.obsolete ? "non-conforming" : "conforming";
      const childSequencePattern =
        e.childSequencePattern === undefined ? "" : ` childSequencePattern: ${encodeJson(e.childSequencePattern)},`;
      const childGrammar = e.childGrammar === undefined ? "" : ` childGrammar: ${encodeJson(e.childGrammar)},`;
      const currentAttributes = A.isReadonlyArrayEmpty(e.currentAttributes)
        ? "HTML_GLOBAL_ATTRIBUTE_NAMES"
        : `[...HTML_GLOBAL_ATTRIBUTE_NAMES, ...${encodeJson(e.currentAttributes)}]`;
      return `  "${e.tag}": { tag: "${e.tag}", interface: "${e.iface}", conformance: "${conformance}", void: ${e.kind === "void"}, rawText: ${e.textMode === "raw-text"}, textMode: "${e.textMode}", categories: ${encodeJson(e.categories)}, children: ${encodeJson(e.children)}, currentAttributes: ${currentAttributes}, obsoleteAttributes: ${encodeJson(e.obsoleteAttributes)}, conditionalCategories: ${encodeJson(e.conditionalCategories)}, attributeEqualities: ${encodeJson(e.attributeEqualities)}, attributeRequirements: ${encodeJson(e.attributeRequirements)}, numericAttributeRelationships: ${encodeJson(e.numericAttributeRelationships)}, rules: ${encodeJson(e.rules)}, uniqueAttributes: ${encodeJson(e.uniqueAttributes)},${childSequencePattern}${childGrammar} },`;
    }),
    A.join("\n")
  );

  const tagValues = encodeJson(A.map(els, (element) => element.tag));
  const categoryValues = encodeJson(
    A.sort(MutableHashSet.fromIterable(A.flatMap(els, (element) => element.categories)), Order.String)
  );
  const contentTokenValues = encodeJson(
    A.sort(MutableHashSet.fromIterable(A.flatMap(els, (element) => element.children)), Order.String)
  );
  const booleanAttributeValues = encodeJson(A.sort(booleanAttrs, Order.String));
  const attributeSyntaxValues = encodeJson(
    A.sort(MutableHashSet.fromIterable(R.values(classification.attributeSyntaxes)), Order.String)
  );
  const attributeSyntaxes = encodeJson(classification.attributeSyntaxes);
  const childGrammarValues = encodeJson(
    A.sort(MutableHashSet.fromIterable(R.values(classification.specialChildGrammars)), Order.String)
  );
  const svgElementNameAdjustments = encodeJson(classification.svgElementNameAdjustments);
  const svgAttributeNameAdjustments = encodeJson(classification.svgAttributeNameAdjustments);
  const mathMlAttributeNameAdjustments = encodeJson(classification.mathMlAttributeNameAdjustments);
  const xmlAttributeNames = encodeJson(A.sort(classification.xmlAttributeNames, Order.String));
  const globalAttributeNames = encodeJson(A.sort(globalKeys, Order.String));
  const readonlyArrayRecord = (record: Readonly<Record<string, ReadonlyArray<string>>>): string => `{
${pipe(
  R.toEntries(record),
  A.map(([key, values]) => `  ${encodeJson(key)}: Object.freeze(${encodeJson(values)}),`),
  A.join("\n")
)}
}`;
  const autocompleteFieldGroups = readonlyArrayRecord(classification.autocompleteFieldGroups);
  const autocompleteInputStateGroups = readonlyArrayRecord(classification.autocompleteInputStateGroups);
  const inputAttributeApplicability = `{
${pipe(
  R.toEntries(classification.inputAttributeApplicability),
  A.map(
    ([state, attributes]) => `  ${encodeJson(state)}: freezeConditionalInputAttributeNames(${encodeJson(attributes)}),`
  ),
  A.join("\n")
)}
}`;
  const autocompleteContactFields = encodeJson(classification.autocompleteContactFields);
  const buttonSubmitOnlyAttributes = encodeJson(classification.buttonSubmitOnlyAttributes);
  const inputStateNames = encodeJson(inputStates);
  const conditionalInputAttributeNames = encodeJson(conditionalInputAttributes);
  const iconLinkRelations = encodeJson(classification.iconLinkRelations);
  const idReferenceAttributes = encodeJson(classification.idReferenceAttributes);
  const idReferenceListAttributes = encodeJson(classification.idReferenceListAttributes);
  const contentTokenExpansions = `{
${pipe(
  R.toEntries(classification.contentTokenExpansions),
  A.map(([token, values]) => `  ${encodeJson(token)}: Object.freeze(${encodeJson(values)}),`),
  A.join("\n")
)}
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
import { flow, Result } from "effect";
import * as R from "effect/Record";
import * as S from "effect/Schema";

// WHATWG's tokenizer-lowercased attribute and event names are normative.

const $I = $HtmlId.create("Html.meta");

/**
 * Exact generated HTML element-tag domain.
 *
 * **Example** (Check an HtmlTag value)
 *
 * \`\`\`ts
 * import { HtmlTag } from "@beep/html/Html.meta"
 *
 * HtmlTag.is.div("div") // => true
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
 * **Example** (Annotate an HtmlTag value)
 *
 * \`\`\`ts
 * import type { HtmlTag } from "@beep/html/Html.meta"
 *
 * const tag: HtmlTag = "div"
 * tag // => "div"
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export type HtmlTag = typeof HtmlTag.Type;

/**
 * Advisory content-category values emitted by the WHATWG element index.
 *
 * **Example** (Check an HtmlCategory value)
 *
 * \`\`\`ts
 * import { HtmlCategory } from "@beep/html/Html.meta"
 *
 * HtmlCategory.is.flow("flow") // => true
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
 * **Example** (Annotate an HtmlCategory value)
 *
 * \`\`\`ts
 * import type { HtmlCategory } from "@beep/html/Html.meta"
 *
 * const category: HtmlCategory = "flow"
 * category // => "flow"
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export type HtmlCategory = typeof HtmlCategory.Type;

/**
 * Content-model tokens emitted by the pinned WHATWG element index.
 *
 * **Example** (Check an HtmlContentToken value)
 *
 * \`\`\`ts
 * import { HtmlContentToken } from "@beep/html/Html.meta"
 *
 * HtmlContentToken.is.flow("flow") // => true
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
 * **Example** (Annotate an HtmlContentToken value)
 *
 * \`\`\`ts
 * import type { HtmlContentToken } from "@beep/html/Html.meta"
 *
 * const token: HtmlContentToken = "flow"
 * token // => "flow"
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
 * **Example** (Check an HtmlChildGrammar value)
 *
 * \`\`\`ts
 * import { HtmlChildGrammar } from "@beep/html/Html.meta"
 *
 * HtmlChildGrammar.is.table("table") // => true
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
 * **Example** (Annotate an HtmlChildGrammar value)
 *
 * \`\`\`ts
 * import type { HtmlChildGrammar } from "@beep/html/Html.meta"
 *
 * const grammar: HtmlChildGrammar = "table"
 * grammar // => "table"
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export type HtmlChildGrammar = typeof HtmlChildGrammar.Type;

/**
 * One attribute-dependent content-category membership rule.
 *
 * **Example** (Build a conditional category rule)
 *
 * \`\`\`ts
 * import { HtmlConditionalCategoryRule } from "@beep/html/Html.meta"
 *
 * const rule = HtmlConditionalCategoryRule.make({
 *   attribute: "href",
 *   category: "interactive",
 *   condition: "present"
 * })
 * rule.category // => "interactive"
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
 * **Example** (Look up an SVG element-name adjustment)
 *
 * \`\`\`ts
 * import { SVG_ELEMENT_NAME_ADJUSTMENTS } from "@beep/html/Html.meta"
 *
 * SVG_ELEMENT_NAME_ADJUSTMENTS.lineargradient // => "linearGradient"
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
 * **Example** (Look up an SVG attribute-name adjustment)
 *
 * \`\`\`ts
 * import { SVG_ATTRIBUTE_NAME_ADJUSTMENTS } from "@beep/html/Html.meta"
 *
 * SVG_ATTRIBUTE_NAME_ADJUSTMENTS.viewbox // => "viewBox"
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
 * **Example** (Look up a MathML attribute-name adjustment)
 *
 * \`\`\`ts
 * import { MATHML_ATTRIBUTE_NAME_ADJUSTMENTS } from "@beep/html/Html.meta"
 *
 * MATHML_ATTRIBUTE_NAME_ADJUSTMENTS.definitionurl // => "definitionURL"
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
 * **Example** (Check a foreign XML attribute name)
 *
 * \`\`\`ts
 * import { XML_FOREIGN_ATTRIBUTE_NAMES } from "@beep/html/Html.meta"
 *
 * XML_FOREIGN_ATTRIBUTE_NAMES.includes("xlink:href") // => true
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
 * **Example** (Check a global attribute name)
 *
 * \`\`\`ts
 * import { HTML_GLOBAL_ATTRIBUTE_NAMES } from "@beep/html/Html.meta"
 *
 * HTML_GLOBAL_ATTRIBUTE_NAMES.includes("inert") // => true
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
 * **Example** (Expand a content-model token)
 *
 * \`\`\`ts
 * import { HTML_CONTENT_TOKEN_EXPANSIONS } from "@beep/html/Html.meta"
 *
 * HTML_CONTENT_TOKEN_EXPANSIONS["option element inner content elements"] // => ["phrasing"]
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
 * **Example** (Read an autocomplete field group)
 *
 * \`\`\`ts
 * import { HTML_AUTOCOMPLETE_FIELD_GROUPS } from "@beep/html/Html.meta"
 *
 * HTML_AUTOCOMPLETE_FIELD_GROUPS.password.includes("new-password") // => true
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
 * **Example** (Read an autocomplete input-state group)
 *
 * \`\`\`ts
 * import { HTML_AUTOCOMPLETE_INPUT_STATE_GROUPS } from "@beep/html/Html.meta"
 *
 * HTML_AUTOCOMPLETE_INPUT_STATE_GROUPS.email.includes("username") // => true
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
 * **Example** (Check an autocomplete contact field)
 *
 * \`\`\`ts
 * import { HTML_AUTOCOMPLETE_CONTACT_FIELDS } from "@beep/html/Html.meta"
 *
 * HTML_AUTOCOMPLETE_CONTACT_FIELDS.includes("email") // => true
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const HTML_AUTOCOMPLETE_CONTACT_FIELDS: ReadonlyArray<string> = Object.freeze(${autocompleteContactFields});

/**
 * Exact generated domain of HTML input type states.
 *
 * **Example** (Check an input state)
 *
 * \`\`\`ts
 * import { HtmlInputStateName } from "@beep/html/Html.meta"
 *
 * HtmlInputStateName.is.file("file") // => true
 * \`\`\`
 *
 * @see {@link https://html.spec.whatwg.org/multipage/input.html#states-of-the-type-attribute | WHATWG input type states} for the normative state inventory.
 * @category models
 * @since 0.0.0
 */
export const HtmlInputStateName = LiteralKit(${inputStateNames}).pipe(
  $I.annoteSchema("HtmlInputStateName", {
    description: "Exact generated domain of HTML input type states.",
  })
);

/**
 * Runtime input-state name accepted by {@link HtmlInputStateName}.
 *
 * @category models
 * @since 0.0.0
 */
export type HtmlInputStateName = typeof HtmlInputStateName.Type;

/**
 * Exact generated domain of conditionally applicable input attributes.
 *
 * **Example** (Check a conditional input attribute)
 *
 * \`\`\`ts
 * import { HtmlConditionalInputAttributeName } from "@beep/html/Html.meta"
 *
 * HtmlConditionalInputAttributeName.is.accept("accept") // => true
 * \`\`\`
 *
 * @see {@link https://html.spec.whatwg.org/multipage/input.html#input-type-attr-summary | WHATWG input attribute summary} for state-specific applicability.
 * @category models
 * @since 0.0.0
 */
export const HtmlConditionalInputAttributeName = LiteralKit(${conditionalInputAttributeNames}).pipe(
  $I.annoteSchema("HtmlConditionalInputAttributeName", {
    description: "Exact generated domain of conditionally applicable input attributes.",
  })
);

/**
 * Runtime conditional input-attribute name accepted by {@link HtmlConditionalInputAttributeName}.
 *
 * @category models
 * @since 0.0.0
 */
export type HtmlConditionalInputAttributeName = typeof HtmlConditionalInputAttributeName.Type;

const freezeConditionalInputAttributeNames = <
  const Names extends ReadonlyArray<HtmlConditionalInputAttributeName>,
>(names: Names): Readonly<Names> => Object.freeze(names);

/**
 * Exact conditional attribute applicability for every input type state.
 *
 * **Example** (Read input attribute applicability)
 *
 * \`\`\`ts
 * import { HTML_INPUT_ATTRIBUTE_APPLICABILITY } from "@beep/html/Html.meta"
 *
 * HTML_INPUT_ATTRIBUTE_APPLICABILITY.file.includes("accept") // => true
 * \`\`\`
 *
 * @invariant Every standard input state occurs exactly once and every value belongs to {@link HtmlConditionalInputAttributeName}.
 * @category constants
 * @since 0.0.0
 */
export const HTML_INPUT_ATTRIBUTE_APPLICABILITY = Object.freeze(
  ${inputAttributeApplicability}
) satisfies Readonly<Record<HtmlInputStateName, ReadonlyArray<HtmlConditionalInputAttributeName>>>;

/**
 * Conditional input attributes covered by the applicability table.
 *
 * **Example** (Check a conditional input attribute)
 *
 * \`\`\`ts
 * import { HTML_CONDITIONAL_INPUT_ATTRIBUTE_NAMES } from "@beep/html/Html.meta"
 *
 * HTML_CONDITIONAL_INPUT_ATTRIBUTE_NAMES.includes("autocomplete") // => true
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const HTML_CONDITIONAL_INPUT_ATTRIBUTE_NAMES: ReadonlyArray<HtmlConditionalInputAttributeName> = Object.freeze(
  ${conditionalInputAttributeNames}
);

/**
 * Button attributes permitted only for effective submit buttons.
 *
 * **Example** (Check a submit-only button attribute)
 *
 * \`\`\`ts
 * import { HTML_BUTTON_SUBMIT_ONLY_ATTRIBUTES } from "@beep/html/Html.meta"
 *
 * HTML_BUTTON_SUBMIT_ONLY_ATTRIBUTES.includes("formaction") // => true
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
 * **Example** (Check an icon link relation)
 *
 * \`\`\`ts
 * import { HTML_ICON_LINK_RELATIONS } from "@beep/html/Html.meta"
 *
 * HTML_ICON_LINK_RELATIONS.includes("apple-touch-icon") // => true
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const HTML_ICON_LINK_RELATIONS: ReadonlyArray<string> = Object.freeze(${iconLinkRelations});

/**
 * Element/attribute keys using the HTML ID-reference-list microsyntax.
 *
 * **Example** (Check an ID-reference-list attribute)
 *
 * \`\`\`ts
 * import { HTML_ID_REFERENCE_LIST_ATTRIBUTES } from "@beep/html/Html.meta"
 *
 * HTML_ID_REFERENCE_LIST_ATTRIBUTES.includes("output/for") // => true
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
 * **Example** (Check an ID-reference attribute)
 *
 * \`\`\`ts
 * import { HTML_ID_REFERENCE_ATTRIBUTES } from "@beep/html/Html.meta"
 *
 * HTML_ID_REFERENCE_ATTRIBUTES.includes("button/commandfor") // => true
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const HTML_ID_REFERENCE_ATTRIBUTES: ReadonlyArray<string> = Object.freeze(${idReferenceAttributes});

/**
 * Text parsing and serialization mode of an HTML element.
 *
 * **Example** (Check an HtmlTextMode value)
 *
 * \`\`\`ts
 * import { HtmlTextMode } from "@beep/html/Html.meta"
 *
 * HtmlTextMode.is.rcdata("rcdata") // => true
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
 * **Example** (Annotate an HtmlTextMode value)
 *
 * \`\`\`ts
 * import type { HtmlTextMode } from "@beep/html/Html.meta"
 *
 * const mode: HtmlTextMode = "normal"
 * mode // => "normal"
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export type HtmlTextMode = typeof HtmlTextMode.Type;

/**
 * Authoritative generated domain of HTML boolean attribute names.
 *
 * **Example** (Check a boolean attribute name)
 *
 * \`\`\`ts
 * import { HtmlBooleanAttributeName } from "@beep/html/Html.meta"
 *
 * HtmlBooleanAttributeName.is.disabled("disabled") // => true
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
 * **Example** (Decode a boolean attribute name)
 *
 * \`\`\`ts
 * import { HtmlBooleanAttributeName } from "@beep/html/Html.meta"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownResult(HtmlBooleanAttributeName)("disabled")
 * if (Result.isSuccess(decoded)) {
 *   const name: HtmlBooleanAttributeName = decoded.success
 *   name // => "disabled"
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
 * **Example** (Check an HtmlAttributeSyntax value)
 *
 * \`\`\`ts
 * import { HtmlAttributeSyntax } from "@beep/html/Html.meta"
 *
 * HtmlAttributeSyntax.is.srcset("srcset") // => true
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
 * **Example** (Annotate an HtmlAttributeSyntax value)
 *
 * \`\`\`ts
 * import type { HtmlAttributeSyntax } from "@beep/html/Html.meta"
 *
 * const syntax: HtmlAttributeSyntax = "srcset"
 * syntax // => "srcset"
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
 * **Example** (Look up an attribute microsyntax)
 *
 * \`\`\`ts
 * import { HTML_ATTRIBUTE_SYNTAXES } from "@beep/html/Html.meta"
 *
 * HTML_ATTRIBUTE_SYNTAXES["link/sizes"] // => "icon-sizes"
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
 * **Example** (Build an attribute equality)
 *
 * \`\`\`ts
 * import { HtmlAttributeEquality } from "@beep/html/Html.meta"
 *
 * const equality = HtmlAttributeEquality.make({
 *   left: "id",
 *   message: "id must equal name",
 *   right: "name"
 * })
 * equality.right // => "name"
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
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("HtmlAttributeValueConstraint", {
    description: "Generated relationship constraint over an HTML attribute value.",
  })
);

const HtmlAttributeRequirementPredicate = S.Union([
  S.TaggedStruct("attributeContainsToken", { attribute: S.String, value: S.String }),
  S.TaggedStruct("attributeEquals", { attribute: S.String, value: S.String }),
  S.TaggedStruct("attributeEqualsOrMissing", { attribute: S.String, value: S.String }),
  S.TaggedStruct("attributePresent", { attribute: S.String }),
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("HtmlAttributeRequirementPredicate", {
    description: "Generated predicate controlling when an HTML attribute requirement applies.",
  })
);

/**
 * Generated conditional requirement or exclusion for HTML attributes.
 *
 * **Example** (Build an attribute requirement)
 *
 * \`\`\`ts
 * import { HtmlAttributeRequirement } from "@beep/html/Html.meta"
 *
 * const requirement = HtmlAttributeRequirement.make({
 *   message: "target requires href",
 *   required: [["href"]],
 *   when: { _tag: "attributePresent", attribute: "target" }
 * })
 * requirement.required[0] // => ["href"]
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
 * **Example** (Build a numeric attribute relationship)
 *
 * \`\`\`ts
 * import { HtmlNumericAttributeRelationship } from "@beep/html/Html.meta"
 *
 * const relationship = HtmlNumericAttributeRelationship.make({
 *   left: "value",
 *   message: "value must not exceed max",
 *   right: "max",
 *   rightDefault: 1
 * })
 * relationship.right // => "max"
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
 * **Example** (Build a forbidden-descendants rule)
 *
 * \`\`\`ts
 * import { HtmlForbiddenDescendants } from "@beep/html/Html.meta"
 *
 * const rule = HtmlForbiddenDescendants.make({
 *   attributes: [],
 *   categories: [],
 *   tags: ["dfn"]
 * })
 * rule.tags[0] // => "dfn"
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
 * **Example** (Build a forbidden named-ancestor rule)
 *
 * \`\`\`ts
 * import { HtmlForbiddenNamedAncestor } from "@beep/html/Html.meta"
 *
 * const rule = HtmlForbiddenNamedAncestor.make({
 *   attributes: ["aria-label", "aria-labelledby", "title"],
 *   tag: "form"
 * })
 * rule.tag // => "form"
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
 * **Example** (Build a document visibility limit)
 *
 * \`\`\`ts
 * import { HtmlDocumentVisibilityLimit } from "@beep/html/Html.meta"
 *
 * const rule = HtmlDocumentVisibilityLimit.make({ maximum: 1, unlessAttribute: "hidden" })
 * rule.maximum // => 1
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
 * **Example** (Build element conformance rules)
 *
 * \`\`\`ts
 * import { HtmlElementConformanceRules } from "@beep/html/Html.meta"
 *
 * const rules = HtmlElementConformanceRules.make({ permittedAncestors: ["body", "html"] })
 * rules.permittedAncestors // => ["body", "html"]
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
 * **Example** (Match ELEMENT_META against HtmlElementMeta)
 *
 * \`\`\`ts
 * import { ELEMENT_META, HtmlElementMeta } from "@beep/html/Html.meta"
 * import * as S from "effect/Schema"
 *
 * S.is(HtmlElementMeta)(ELEMENT_META.div) // => true
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
  Result.getOrThrow(S.decodeResult(HtmlElementMeta)(value));

/**
 * Metadata for every generated HTML element, keyed by tag name.
 *
 * **Example** (Read metadata for div)
 *
 * \`\`\`ts
 * import { ELEMENT_META } from "@beep/html/Html.meta"
 *
 * ELEMENT_META.div.interface // => "HTMLDivElement"
 * \`\`\`
 *
 * @category models
 * @since 0.0.0
 */
export const ELEMENT_META: Readonly<Record<HtmlTag, HtmlElementMeta>> = Object.freeze(
  R.map(elementMetaSource, flow(decodeElementMeta, freezeElementMeta))
);
`;

  const conforming = pipe(
    els,
    A.filter((e) => !e.obsolete),
    A.length
  );
  return {
    model: markRunnableExampleFences(model),
    meta: markRunnableExampleFences(meta),
    conforming,
    total: A.length(els),
  };
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

  const readJson = Effect.fn("HtmlGenerator.readJson")(function* <Schema extends S.Top>(schema: Schema, rel: string) {
    const source = yield* fs.readFileString(path.join(dataDir, rel));
    return yield* S.decodeEffect(S.fromJsonString(schema), {
      errors: "all",
      onExcessProperty: "error",
    })(source).pipe(
      Effect.mapError((cause) =>
        HtmlGenerationError.make({
          cause,
          message: `HTML generator could not decode ${rel}`,
        })
      )
    );
  });

  const dfnsDoc = yield* readJson(DfnsDoc, "webref/dfns-html.json");
  const elementsDoc = yield* readJson(ElementsDoc, "webref/elements-html.json");
  const cmDoc = yield* readJson(ContentModelDoc, "whatwg/content-model.json");
  const classification = yield* readJson(Classification, "overrides/classification.json");
  const obsDoc = yield* readJson(ObsoleteInterfacesDoc, "overrides/obsolete-interfaces.json");
  const languageSubtagRegistrySource = yield* fs.readFileString(
    path.join(dataDir, "iana/language-subtag-registry.txt")
  );
  const crypto = yield* Crypto.Crypto;
  const registryHash = Encoding.encodeHex(
    yield* crypto.digest("SHA-256", new TextEncoder().encode(languageSubtagRegistrySource)).pipe(
      Effect.mapError((cause) =>
        HtmlGenerationError.make({
          cause,
          message: "HTML generator could not hash the IANA language-subtag registry",
        })
      )
    )
  );
  if (registryHash !== IANA_LANGUAGE_SUBTAG_REGISTRY_SHA256) {
    return yield* HtmlGenerationError.make({
      message: `IANA registry requires SHA-256 ${IANA_LANGUAGE_SUBTAG_REGISTRY_SHA256}; received ${registryHash}`,
    });
  }

  const { conforming, languageTagRegistry, meta, model, total } = yield* Effect.try({
    try: () => {
      const registry = parseLanguageSubtagRegistry(languageSubtagRegistrySource);
      return {
        ...buildModel({
          dfns: dfnsDoc.dfns,
          elements: elementsDoc.elements,
          contentModel: cmDoc.elements,
          classification,
          obsoleteInterfaces: obsDoc.interfaces,
        }),
        languageTagRegistry: buildLanguageTagRegistryModule(registry),
      };
    },
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
  yield* fs.makeDirectory(path.join(srcDir, "internal"), { recursive: true });
  yield* fs.writeFileString(path.join(srcDir, "internal/Html.language-tag-registry.generated.ts"), languageTagRegistry);

  yield* Effect.log(
    `generated ${total} elements (${conforming} conforming, ${total - conforming} obsolete) + 6 node kinds and IANA language-tag registry`
  );
});

const runtimeLayer = Layer.mergeAll(Logger.layer([Logger.consolePretty()]), NodeServices.layer);

const main = Effect.scoped(
  Layer.build(runtimeLayer).pipe(Effect.flatMap((context) => Effect.provide(program, context)))
);

if (import.meta.main) {
  NodeRuntime.runMain(main);
}
