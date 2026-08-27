/**
 * key-duplicates: duplicate mapping keys, reported at every occurrence after
 * the first.
 *
 * Detection walks the composed AST with the same key identity the engine
 * uses (type and value — `!!int 1` never collides with `"1"`), on the lint
 * context's `uniqueKeys`-disabled compose so the policy is fully owned
 * here. No fix: dropping a pair changes what the document means.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Schema } from "effect";
import type { LintContext, YamlRule } from "../../YamlLintRule.ts";
import { YamlLintDiagnostic, YamlLintSeverity } from "../../YamlLintRule.ts";
import type { YamlNode } from "../../YamlNode.ts";
import { YamlMap, YamlScalar, YamlSeq } from "../../YamlNode.ts";
import { keyIdentity } from "../composer/block.ts";
import { positionAt } from "./util.ts";

/**
 * Options for `key-duplicates` (severity only — duplicates are duplicates).
 *
 * **Example** (Enable as an error)
 *
 * ```ts
 * import { YamlLintConfig } from "@beep/scratchpad/yaml"
 *
 * const config = YamlLintConfig.make({ rules: { "key-duplicates": "error" } })
 * console.log(config.rules["key-duplicates"]) // "error"
 * ```
 *
 * @see {@link keyDuplicates} for the rule that consumes these options.
 * @internal
 * @category schemas
 * @since 0.0.0
 */
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

/**
 * Duplicate mapping keys anywhere in the document.
 *
 * **Gotchas**
 *
 * Lint composes with `uniqueKeys` disabled so this rule owns duplicate
 * policy. Duplicate keys never appear under {@link parseValidity}. Identity
 * is {@link keyIdentity}: `!!int 1` and `"1"` do not collide. Disabling
 * this rule means duplicates are allowed.
 *
 * **Example** (Duplicate `a:` vs non-colliding `1` / `"1"`)
 *
 * ```ts
 * import { YamlLint, YamlLintConfig } from "@beep/scratchpad/yaml"
 *
 * const config = YamlLintConfig.make({ rules: { "key-duplicates": "error" } })
 * const dup = YamlLint.run("a: 1\na: 2\n", YamlLint.builtins, config)
 * console.log(dup.some((d) => d.rule === "key-duplicates")) // true
 *
 * const typed = YamlLint.run("1: a\n\"1\": b\n", YamlLint.builtins, config)
 * console.log(typed.every((d) => d.rule !== "key-duplicates")) // true
 * ```
 *
 * @see {@link keyIdentity} for the type-and-value identity this rule uses.
 * @see {@link parseValidity} for the engine-error bridge that does not own this policy.
 * @internal
 * @category validation
 * @since 0.0.0
 */
export const keyDuplicates: YamlRule = {
	id: "key-duplicates",
	check: (ctx) => {
		const out: Array<YamlLintDiagnostic> = [];
		walk(ctx.document.contents, ctx.text, out, ctx);
		return out;
	},
};
