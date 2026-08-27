// The built-in rule catalog (#129): the ordered rule array the facade
// exposes as `YamlLint.builtins`, and the per-rule options schemas the
// config layer validates against. Aggregates VALUES (an array and a map) —
// not a re-export barrel; rules are imported from their own modules.
//
// Rules accrete here batch by batch; `indentation` lands last (see the
// design doc).

import type { Schema } from "effect";
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

/** The built-in rules, in catalog order (parse-validity is rule `#1`). */
export const builtinRules: ReadonlyArray<YamlRule> = catalog.map(([rule]) => rule);

/** Per-rule options schemas — the rule-aware half of config validation. */
export const builtinOptionsSchemas: ReadonlyMap<string, Schema.Top> = new Map(
	catalog.map(([rule, options]) => [rule.id, options] as const),
);
