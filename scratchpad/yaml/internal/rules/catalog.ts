/**
 * Built-in lint rule catalog: the ordered rule array the facade exposes as
 * `YamlLint.builtins`, and the per-rule options schemas the config layer
 * validates against.
 *
 * Aggregates values (an array and a map) — not a re-export barrel. Rules
 * accrete here batch by batch; `indentation` lands last by design.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import type { Schema } from "effect";
import { HashMap } from "effect";
import type { YamlRule } from "../../YamlLintRule.ts";
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

// ONE ordered source of rule/options-schema pairs: deriving both exports
// from it makes a schema-less built-in unrepresentable — a rule registered
// in one list only would otherwise validate as a CUSTOM rule with opaque
// options, and a typo'd option would decode silently.
const catalog: ReadonlyArray<readonly [YamlRule, Schema.Top]> = [
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
 * The built-in rules, in catalog order (`parse-validity` is rule `#1`).
 *
 * **Gotchas**
 *
 * Always derive this array and {@link builtinOptionsSchemas} from the same
 * `catalog` tuple list. A rule registered in one list only would validate
 * as a custom rule with opaque options. `parse-validity` is index 0;
 * `indentation` is last by design.
 *
 * **Example** (parse-validity is first; every builtin has a schema)
 *
 * ```ts
 * import { YamlLint } from "@beep/scratchpad/yaml"
 *
 * console.log(YamlLint.builtins[0]?.id) // "parse-validity"
 * console.log(YamlLint.builtins.some((rule) => rule.id === "indentation")) // true
 * ```
 *
 * @see {@link YamlLint.builtins} for the public alias of this array.
 * @internal
 * @category constants
 * @since 0.0.0
 */
export const builtinRules: ReadonlyArray<YamlRule> = catalog.map(([rule]) => rule);

/**
 * Per-rule options schemas — the rule-aware half of config validation.
 *
 * **Gotchas**
 *
 * Pairing with {@link builtinRules} makes a schema-less built-in
 * unrepresentable. Adding a rule to only one export would silently accept
 * any options as if it were a custom rule.
 *
 * **Example** (Built-in option typos fail at config construction)
 *
 * ```ts
 * import { YamlLintConfig } from "@beep/scratchpad/yaml"
 *
 * let rejected = false
 * try {
 *   YamlLintConfig.make({ rules: { "line-length": { maxx: 80 } } })
 * } catch {
 *   rejected = true
 * }
 * console.log(rejected) // true
 * ```
 *
 * @see {@link builtinRules} for the paired ordered rule list.
 * @internal
 * @category constants
 * @since 0.0.0
 */
export const builtinOptionsSchemas: HashMap.HashMap<string, Schema.Top> = HashMap.fromIterable(
	catalog.map(([rule, options]) => [rule.id, options] as const),
);
