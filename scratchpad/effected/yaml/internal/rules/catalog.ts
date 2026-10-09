// The built-in rule catalog: the ordered rule array the facade
// exposes as `YamlLint.builtins`, and the per-rule options schemas the
// config layer validates against. Aggregates VALUES (an array and a map) —
// not a re-export barrel; rules are imported from their own modules.
//
// Rules accrete here batch by batch; `indentation` lands last (see the
// design doc).

import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import type * as S from "effect/Schema";
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
const catalog: ReadonlyArray<readonly [YamlRule, S.Codec<unknown, unknown>]> = [
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

const optionsEntries: Array<[string, S.Codec<unknown, unknown>]> = catalog.map(([rule, options]) => [rule.id, options]);
const optionsById = HashMap.fromIterable(optionsEntries);

/** Per-rule options schemas — the rule-aware half of config validation. */
export const builtinOptionsSchemas: ReadonlyMap<string, S.Codec<unknown, unknown>> = {
	size: HashMap.size(optionsById),
	get: (id) => O.getOrUndefined(HashMap.get(optionsById, id)),
	has: (id) => HashMap.has(optionsById, id),
	// Retain catalog order for the existing ReadonlyMap iteration contract.
	*entries(): Generator<[string, S.Codec<unknown, unknown>], undefined> {
		for (const [id, options] of optionsEntries) yield [id, options];
		return undefined;
	},
	*keys(): Generator<string, undefined> {
		for (const [id] of optionsEntries) yield id;
		return undefined;
	},
	*values(): Generator<S.Codec<unknown, unknown>, undefined> {
		for (const [, options] of optionsEntries) yield options;
		return undefined;
	},
	[Symbol.iterator]() {
		return this.entries();
	},
	forEach(callbackfn, thisArg) {
		for (const [id, options] of optionsEntries) callbackfn.call(thisArg, options, id, this);
	},
};
