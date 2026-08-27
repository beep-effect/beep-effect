// key-duplicates (#129): duplicate mapping keys, reported at every
// occurrence AFTER the first. Detection walks the composed AST with the same
// key identity the engine's own duplicate check uses (type AND value — an
// `!!int 1` never collides with the string `"1"`), and runs on the lint
// context's uniqueKeys-disabled compose so the policy is fully owned here.
// No fix: dropping a pair changes what the document means.

import { Schema } from "effect";
import type { LintContext, YamlRule } from "../../YamlLintRule.ts";
import { YamlLintDiagnostic, YamlLintSeverity } from "../../YamlLintRule.ts";
import type { YamlNode } from "../../YamlNode.ts";
import { YamlMap, YamlScalar, YamlSeq } from "../../YamlNode.ts";
import { keyIdentity } from "../composer/block.ts";
import { positionAt } from "./util.ts";

/** Options for `key-duplicates` (severity only — duplicates are duplicates). */
export const keyDuplicatesOptions = Schema.Struct({
	severity: Schema.optionalKey(YamlLintSeverity),
});

const walk = (node: YamlNode | null, text: string, out: Array<YamlLintDiagnostic>, ctx: LintContext): void => {
	if (node === null) return;
	if (node instanceof YamlMap) {
		const seen = new Set<string>();
		for (const pair of node.items) {
			if (pair.key instanceof YamlScalar) {
				const id = keyIdentity(pair.key, text);
				if (seen.has(id)) {
					const pos = positionAt(ctx.lines, pair.key.offset);
					out.push(
						new YamlLintDiagnostic({
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
				seen.add(id);
			}
			walk(pair.key, text, out, ctx);
			walk(pair.value, text, out, ctx);
		}
		return;
	}
	if (node instanceof YamlSeq) {
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
