import * as A from "effect/Array";
import * as HashMap from "effect/HashMap";
import { colonSpacing, colonSpacingOptions } from "./colon-spacing.ts";
import { commentsSpacing, commentsSpacingOptions } from "./comments-spacing.ts";
import { documentEnd, documentEndOptions } from "./document-end.ts";
import { documentStart, documentStartOptions } from "./document-start.ts";
import { emptyLines, emptyLinesOptions } from "./empty-lines.ts";
import { eofNewline, eofNewlineOptions } from "./eof-newline.ts";
import { hyphenSpacing, hyphenSpacingOptions } from "./hyphen-spacing.ts";
import { indentation, indentationOptions } from "./indentation.ts";
import { keyDuplicates, keyDuplicatesOptions } from "./key-duplicates.ts";
import { lineLength, lineLengthOptions } from "./line-length.ts";
import { parseValidity, parseValidityOptions } from "./parse-validity.ts";
import { quotedStrings, quotedStringsOptions } from "./quoted-strings.ts";
import { trailingSpaces, trailingSpacesOptions } from "./trailing-spaces.ts";
import { truthy, truthyOptions } from "./truthy.ts";
import type * as S from "effect/Schema";
import type { YamlRule } from "../../YamlLintRule.ts";

const schemaPairedRuleCatalog: ReadonlyArray<readonly [YamlRule, S.Codec<unknown, unknown>]> = [
  [parseValidity, parseValidityOptions],
  [lineLength, lineLengthOptions],
  [trailingSpaces, trailingSpacesOptions],
  [emptyLines, emptyLinesOptions],
  [eofNewline, eofNewlineOptions],
  [documentStart, documentStartOptions],
  [documentEnd, documentEndOptions],
  [keyDuplicates, keyDuplicatesOptions],
  [quotedStrings, quotedStringsOptions],
  [truthy, truthyOptions],
  [commentsSpacing, commentsSpacingOptions],
  [colonSpacing, colonSpacingOptions],
  [hyphenSpacing, hyphenSpacingOptions],
  [indentation, indentationOptions],
];

/**
 * The built-in rules, in catalog order (parse-validity is rule `#1`).
 *
 * **Example** (Inspect the first built-in rule)
 *
 * ```ts
 * import { builtinRules } from "@beep/yaml/internal/rules/catalog";
 *
 * console.log(builtinRules[0]?.id); // parse-validity
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const builtinRules: ReadonlyArray<YamlRule> = A.map(schemaPairedRuleCatalog, ([rule]) => rule);

/**
 * Per-rule options schemas in catalog order, matching {@link builtinRules}.
 *
 * **Example** (Inspect the first options entry)
 *
 * ```ts
 * import { builtinOptionsEntries } from "@beep/yaml/internal/rules/catalog";
 *
 * console.log(builtinOptionsEntries[0]?.[0]); // parse-validity
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const builtinOptionsEntries: ReadonlyArray<readonly [string, S.Codec<unknown, unknown>]> = A.map(
  schemaPairedRuleCatalog,
  ([rule, options]) => [rule.id, options]
);

/**
 * Per-rule options schemas — the rule-aware half of config validation.
 *
 * **Details**
 *
 * The map and ordered rule list are derived from the same catalog, so every
 * built-in rule is registered with an options schema.
 *
 * **Example** (Find the colon-spacing options schema)
 *
 * ```ts
 * import { builtinOptionsSchemas } from "@beep/yaml/internal/rules/catalog";
 * import * as HashMap from "effect/HashMap";
 *
 * console.log(HashMap.has(builtinOptionsSchemas, "colon-spacing")); // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const builtinOptionsSchemas = HashMap.fromIterable(builtinOptionsEntries);
