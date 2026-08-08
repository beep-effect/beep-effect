/**
 * Canonical repository JSDoc category taxonomy.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoUtilsId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { A, Str } from "@beep/utils";
import { Match, pipe, Result, SchemaGetter } from "effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";

// cspell:ignore dtos
const $I = $RepoUtilsId.create("schemas/JSDocCategories");

/**
 * Closed set of canonical `@category` values accepted by repo docgen checks.
 *
 * **Example** (Import canonical categories set)
 *
 * ```ts
 * import { CANONICAL_JSDOC_CATEGORIES } from "@beep/repo-utils/schemas/JSDocCategories"
 * const categories = CANONICAL_JSDOC_CATEGORIES
 * console.log(categories)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const CANONICAL_JSDOC_CATEGORIES = [
  "models",
  "schemas",
  "type-level",
  "constructors",
  "factories",
  "destructors",
  "combinators",
  "predicates",
  "guards",
  "refinements",
  "assertions",
  "getters",
  "setters",
  "mapping",
  "filtering",
  "folding",
  "sequencing",
  "concurrency",
  "resource-management",
  "error-handling",
  "utilities",
  "layers",
  "aggregates",
  "entities",
  "value-objects",
  "domain-events",
  "policies",
  "specifications",
  "identifiers",
  "entity-ids",
  "type-ids",
  "symbols",
  "errors",
  "use-cases",
  "commands",
  "queries",
  "events",
  "workflows",
  "processes",
  "schedulers",
  "protocols",
  "ports",
  "services",
  "handlers",
  "endpoints",
  "clients",
  "adapters",
  "repositories",
  "projections",
  "read-models",
  "tables",
  "validation",
  "parsing",
  "encoding",
  "decoding",
  "serialization",
  "codecs",
  "formatting",
  "normalization",
  "dtos",
  "mappers",
  "components",
  "hooks",
  "providers",
  "themes",
  "tokens",
  "forms",
  "atoms",
  "tools",
  "tool-schemas",
  "cli-commands",
  "configuration",
  "constants",
  "observability",
  "diagnostics",
  "fixtures",
  "testing",
  "streams",
  "resources",
  "interop",
] as const;

/**
 * Canonical category literal schema used by `@category` JSDoc tags.
 *
 * **Example** (Access validation category enum)
 *
 * ```ts
 * import { JSDocCategory } from "@beep/repo-utils/schemas/JSDocCategories"
 * const category = JSDocCategory.Enum.validation
 * console.log(category)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const JSDocCategory = LiteralKit(CANONICAL_JSDOC_CATEGORIES).pipe(
  $I.annoteSchema("JSDocCategory", {
    description: "Canonical category literal used by @category JSDoc tags.",
  })
);

/**
 * Canonical category literal used by `@category` JSDoc tags.
 *
 * **Example** (Annotate category type literal)
 *
 * ```ts
 * import type { JSDocCategory } from "@beep/repo-utils/schemas/JSDocCategories"
 * const category: JSDocCategory = "validation"
 * console.log(category)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type JSDocCategory = typeof JSDocCategory.Type;

/**
 * Normalization status for an observed `@category` value.
 *
 * **Example** (Import normalization status value)
 *
 * ```ts
 * import { JSDocCategoryNormalizationStatus } from "@beep/repo-utils/schemas/JSDocCategories"
 * const status = JSDocCategoryNormalizationStatus
 * console.log(status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const JSDocCategoryNormalizationStatus = LiteralKit(["canonical", "alias", "rejected", "unknown"]).pipe(
  $I.annoteSchema("JSDocCategoryNormalizationStatus", {
    description: "Normalization status for an observed @category value.",
  })
);
/**
 * Normalization status for an observed `@category` value.
 *
 * **Example** (Assign canonical status type)
 *
 * ```ts
 * import type { JSDocCategoryNormalizationStatus } from "@beep/repo-utils/schemas/JSDocCategories"
 * const status: JSDocCategoryNormalizationStatus = "canonical"
 * console.log(status)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type JSDocCategoryNormalizationStatus = typeof JSDocCategoryNormalizationStatus.Type;

/**
 * Normalized interpretation of a single `@category` tag value.
 *
 * **Example** (Normalize DomainModel category)
 *
 * ```ts
 * import { normalizeJSDocCategory } from "@beep/repo-utils/schemas/JSDocCategories"
 * const normalized = normalizeJSDocCategory("DomainModel")
 * console.log(normalized)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocCategoryNormalization extends S.Class<JSDocCategoryNormalization>($I`JSDocCategoryNormalization`)(
  {
    original: S.String,
    normalized: S.String,
    status: JSDocCategoryNormalizationStatus,
    canonical: S.optionalKey(S.String),
    message: S.optionalKey(S.String),
  },
  $I.annote("JSDocCategoryNormalization", {
    description: "Normalized interpretation of a single @category tag value.",
  })
) {}

const JSDOC_CATEGORY_ALIASES: Readonly<Record<string, JSDocCategory>> = {
  accessor: "getters",
  accessors: "getters",
  adapter: "adapters",
  checker: "predicates",
  checkers: "predicates",
  cli: "cli-commands",
  constant: "constants",
  "creating-effect": "constructors",
  "creating-effects": "constructors",
  "cross-cutting": "utilities",
  "domain-logic": "services",
  "domain-model": "models",
  element: "utilities",
  elements: "utilities",
  "entity-constructor": "constructors",
  "entity-constructors": "constructors",
  "entity-field": "models",
  "entity-fields": "models",
  "entity-id": "entity-ids",
  "entity-reference": "identifiers",
  "entity-references": "identifiers",
  exception: "errors",
  exceptions: "errors",
  factory: "factories",
  guard: "guards",
  helper: "utilities",
  helpers: "utilities",
  layer: "layers",
  model: "models",
  parser: "parsing",
  parsers: "parsing",
  port: "ports",
  "port-contract": "ports",
  printer: "formatting",
  printers: "formatting",
  react: "components",
  "resource-management-finalization": "resource-management",
  schema: "schemas",
  service: "services",
  symbol: "symbols",
  theme: "themes",
  "tool-schema": "tool-schemas",
  type: "type-level",
  types: "type-level",
  "type-id": "type-ids",
  "use-case": "use-cases",
  usecase: "use-cases",
  util: "utilities",
  utility: "utilities",
};

const JSDOC_CATEGORY_REJECTED_VALUES: Readonly<Record<string, string>> = {
  core: "Use a semantic role such as `models`, `services`, or `utilities` instead of a catch-all bucket.",
  exports: "Re-exports are graph edges; category the exported symbol itself instead.",
  generated: "Generated status belongs in source metadata, not in @category.",
  module: "Modules are graph nodes; category the exported symbol itself instead.",
  modules: "Modules are graph nodes; category the exported symbol itself instead.",
  presentation: "Use a UI or boundary role such as `components`, `hooks`, `forms`, or `endpoints`.",
  "re-export": "Re-exports are graph edges; category the exported symbol itself instead.",
  "re-exports": "Re-exports are graph edges; category the exported symbol itself instead.",
};

const canonicalCategoryOption = (value: string): O.Option<JSDocCategory> =>
  A.findFirst(JSDocCategory.Options, (category) => category === value);

const aliasedCategoryOption = (value: string): O.Option<JSDocCategory> => R.get(JSDOC_CATEGORY_ALIASES, value);

const rejectedCategoryMessageOption = (value: string): O.Option<string> => R.get(JSDOC_CATEGORY_REJECTED_VALUES, value);

const MAX_JSDOC_CATEGORY_LENGTH = 128;

type CategoryCharacterKind = "digit" | "lower" | "separator" | "upper";

const charCodeAt = (value: string): number => value.charCodeAt(0);

const isUpperAscii = (value: string): boolean => {
  const code = charCodeAt(value);
  return code >= 65 && code <= 90;
};

const isLowerAscii = (value: string): boolean => {
  const code = charCodeAt(value);
  return code >= 97 && code <= 122;
};

const isDigitAscii = (value: string): boolean => {
  const code = charCodeAt(value);
  return code >= 48 && code <= 57;
};

const lowerAscii = (value: string): string =>
  isUpperAscii(value) ? String.fromCharCode(charCodeAt(value) + 32) : value;

const appendCategorySeparator = (output: string): string =>
  output === "" || Str.endsWith("-")(output) ? output : `${output}-`;

/**
 * Normalize free-form category text to the repo slug key format.
 *
 * **Example** (Slugify free-form category text)
 *
 * ```ts
 * import { normalizeJSDocCategoryKey } from "@beep/repo-utils/schemas/JSDocCategories"
 * const key = normalizeJSDocCategoryKey("Resource Management & Finalization")
 * console.log(key)
 * ```
 *
 * @param value - Free-form category text read from a JSDoc `@category` tag.
 * @returns The normalized kebab-case lookup key.
 * @category normalization
 * @since 0.0.0
 */
export const normalizeJSDocCategoryKey = (value: string): string => {
  const characters = A.fromIterable(Str.trim(value));
  let output = "";
  let previousKind: CategoryCharacterKind = "separator";

  for (let index = 0; index < characters.length; index += 1) {
    const character = pipe(
      A.get(characters, index),
      O.getOrElse(() => "")
    );
    const next = pipe(
      A.get(characters, index + 1),
      O.getOrElse(() => "")
    );

    if (isUpperAscii(character) || isLowerAscii(character) || isDigitAscii(character)) {
      const currentKind: CategoryCharacterKind = Match.value(character).pipe(
        Match.when(isDigitAscii, () => "digit" as const),
        Match.when(isUpperAscii, () => "upper" as const),
        Match.orElse(() => "lower" as const)
      );
      const startsNewWord =
        currentKind === "upper" &&
        output !== "" &&
        !Str.endsWith("-")(output) &&
        (previousKind === "lower" || previousKind === "digit" || (previousKind === "upper" && isLowerAscii(next)));

      output = `${startsNewWord ? appendCategorySeparator(output) : output}${lowerAscii(character)}`;
      previousKind = currentKind;
      continue;
    }

    output = appendCategorySeparator(output);
    previousKind = "separator";
  }

  return Str.replace(/-$/u, "")(output);
};

/**
 * Check whether a string is already a canonical category slug.
 *
 * **Example** (Check tool-schemas is canonical)
 *
 * ```ts
 * import { isCanonicalJSDocCategory } from "@beep/repo-utils/schemas/JSDocCategories"
 * const isCanonical = isCanonicalJSDocCategory("tool-schemas")
 * console.log(isCanonical)
 * ```
 *
 * @param value - Candidate category slug to check.
 * @returns True when the value is in the canonical category set.
 * @category predicates
 * @since 0.0.0
 */
export const isCanonicalJSDocCategory: (value: string) => value is JSDocCategory = S.is(JSDocCategory);

/**
 * Normalize and classify a single observed `@category` value.
 *
 * **Example** (Normalize ToolSchemas category)
 *
 * ```ts
 * import { normalizeJSDocCategory } from "@beep/repo-utils/schemas/JSDocCategories"
 * const normalized = normalizeJSDocCategory("ToolSchemas")
 * console.log(normalized)
 * ```
 *
 * @param value - Observed category text from a JSDoc block.
 * @returns The normalized category key, status, canonical value, and optional diagnostic message.
 * @category normalization
 * @since 0.0.0
 */
const normalizeJSDocCategoryInput = (value: string): JSDocCategoryNormalization => {
  const original = Str.trim(value);

  if (Str.length(original) > MAX_JSDOC_CATEGORY_LENGTH) {
    return JSDocCategoryNormalization.make({
      original: `${Str.slice(0, MAX_JSDOC_CATEGORY_LENGTH)(original)}...`,
      normalized: "",
      status: "rejected",
      message: `@category value exceeds ${MAX_JSDOC_CATEGORY_LENGTH} characters.`,
    });
  }

  const normalized = normalizeJSDocCategoryKey(original);

  if (normalized === "") {
    return JSDocCategoryNormalization.make({
      original,
      normalized,
      status: "unknown",
      message: "Empty @category value.",
    });
  }

  const canonical = canonicalCategoryOption(normalized);

  if (O.isSome(canonical)) {
    if (original === canonical.value) {
      return JSDocCategoryNormalization.make({
        original,
        normalized,
        canonical: canonical.value,
        status: "canonical",
      });
    }

    return JSDocCategoryNormalization.make({
      original,
      normalized,
      canonical: canonical.value,
      status: "alias",
      message: `Use canonical @category ${canonical.value} instead of ${original}.`,
    });
  }

  const alias = aliasedCategoryOption(normalized);
  if (O.isSome(alias)) {
    return JSDocCategoryNormalization.make({
      original,
      normalized,
      canonical: alias.value,
      status: "alias",
      message: `Use canonical @category ${alias.value} instead of ${original}.`,
    });
  }

  const rejected = rejectedCategoryMessageOption(normalized);
  if (O.isSome(rejected)) {
    return JSDocCategoryNormalization.make({
      original,
      normalized,
      status: "rejected",
      message: rejected.value,
    });
  }

  return JSDocCategoryNormalization.make({
    original,
    normalized,
    status: "unknown",
    message: `Unknown @category value ${original}.`,
  });
};

const JSDocCategoryNormalizationFromString = S.String.pipe(
  S.decodeTo(JSDocCategoryNormalization, {
    decode: SchemaGetter.transform(normalizeJSDocCategoryInput),
    encode: SchemaGetter.forbidden(() => "JSDoc category normalization is decode-only."),
  }),
  $I.annoteSchema("JSDocCategoryNormalizationFromString", {
    description: "Decode-only normalization from free-form @category text to the canonical normalization result.",
  })
);

/**
 * Normalize and classify free-form `@category` text.
 *
 * **Example** (Log DomainModel status result)
 *
 * ```ts
 * import { normalizeJSDocCategory } from "@beep/repo-utils/schemas/JSDocCategories"
 *
 * const normalized = normalizeJSDocCategory("DomainModel")
 * console.log(normalized.status)
 * ```
 *
 * @param value - Free-form category text read from a JSDoc block.
 * @returns Canonical, alias, rejected, or unknown category normalization result.
 * @category normalization
 * @since 0.0.0
 */
export const normalizeJSDocCategory = (value: string): JSDocCategoryNormalization =>
  Result.getOrThrow(S.decodeUnknownResult(JSDocCategoryNormalizationFromString)(value));

/**
 * Return true when a category is canonical or accepted as a migration alias.
 *
 * **Example** (Accept DomainModel alias category)
 *
 * ```ts
 * import { isAcceptedJSDocCategory } from "@beep/repo-utils/schemas/JSDocCategories"
 * const accepted = isAcceptedJSDocCategory("DomainModel")
 * console.log(accepted)
 * ```
 *
 * @param value - Observed category text from a JSDoc block.
 * @returns True when the value is canonical or accepted as a migration alias.
 * @category predicates
 * @since 0.0.0
 */
export const isAcceptedJSDocCategory = (value: string): boolean =>
  pipe(normalizeJSDocCategory(value), (category) => category.status === "canonical" || category.status === "alias");
