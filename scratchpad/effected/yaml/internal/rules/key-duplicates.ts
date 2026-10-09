// key-duplicates: duplicate mapping keys, reported at every
// occurrence AFTER the first. Detection walks the composed AST with the same
// key identity the engine's own duplicate check uses (type AND value — an
// `!!int 1` never collides with the string `"1"`), and runs on the lint
// context's uniqueKeys-disabled compose so the policy is fully owned here.
// No fix: dropping a pair changes what the document means.

import { $ScratchpadId } from "@beep/identity/packages";
import * as MutableHashSet from "effect/MutableHashSet";
import * as S from "effect/Schema";
import type { LintContext, YamlRule } from "../../YamlLintRule.ts";
import { YamlLintDiagnostic, YamlLintSeverity } from "../../YamlLintRule.ts";
import type { YamlNode } from "../../YamlNode.ts";
import { YamlMap, YamlScalar, YamlSeq } from "../../YamlNode.ts";
import { keyIdentity } from "../composer/block.ts";
import { positionAt } from "./util.ts";

const $I = $ScratchpadId.create("effected/yaml/internal/rules/key-duplicates");

/** Options for `key-duplicates` (severity only — duplicates are duplicates). */
export const keyDuplicatesOptions = S.Struct({
	severity: S.optionalKey(YamlLintSeverity).annotateKey({ description: "Reporting level for duplicate mapping-key findings, defaulting to `error`" }),
}).pipe($I.annoteSchema("keyDuplicatesOptions", { description: "Options for `key-duplicates` (severity only — duplicates are duplicates)." }));
export type keyDuplicatesOptions = typeof keyDuplicatesOptions.Type;

const walk = (node: YamlNode | null, text: string, out: Array<YamlLintDiagnostic>, ctx: LintContext): void => {
	if (node === null) return;
	if (S.is(YamlMap)(node)) {
		const seen = MutableHashSet.empty<string>();
		for (const pair of node.items) {
			if (S.is(YamlScalar)(pair.key)) {
				const id = keyIdentity(pair.key, text);
				if (MutableHashSet.has(seen, id)) {
					const pos = positionAt(ctx.lines, pair.key.offset);
					out.push(
						YamlLintDiagnostic.make({
							rule: "key-duplicates",
							severity: "error",
							message: `Duplicate key: ${String(pair.key.value)}`,
							offset: pair.key.offset,
							length: pair.key.length,
							line: pos.line,
							character: pos.character,
						}),
					);
				}
				MutableHashSet.add(seen, id);
			}
			walk(pair.key, text, out, ctx);
			walk(pair.value, text, out, ctx);
		}
		return;
	}
	if (S.is(YamlSeq)(node)) {
		for (const item of node.items) walk(item, text, out, ctx);
	}
};

/** Duplicate mapping keys anywhere in the document. */
export const keyDuplicates: YamlRule = {
	id: "key-duplicates",
	check: (ctx) => {
		const out: Array<YamlLintDiagnostic> = [];
		walk(ctx.document.contents, ctx.text, out, ctx);
		return out;
	},
};
