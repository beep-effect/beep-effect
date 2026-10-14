import { assert, describe, it } from "@effect/vitest";
import { assertSuccess } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Str from "effect/String";
import { Yaml, YamlLint, YamlLintConfig } from "../../../effected/yaml/index.ts";
import { hyphenSpacing } from "../../../effected/yaml/internal/rules/hyphen-spacing.ts";

const config = YamlLintConfig.make({ rules: { "hyphen-spacing": "error" } });
const headers = ["|2", ">2", "|2-", "|-2", ">2-", ">-2", "|2+", "|+2", ">2+", ">+2"];
const properties = ["", "!!str ", "&ref ", "!!str &ref ", "&ref !!str "];

describe("hyphen relocation safety", () => {
	it("fixes outer hyphens before explicit-indent mapping values without changing decoded values", () => {
		for (const header of headers) {
			const body = header[0] === "|" ? "hello\nworld" : "hello world";
			const value = body + (Str.includes("-")(header) ? "" : Str.includes("+")(header) ? "\n\n" : "\n");
			for (const property of properties) {
				const input = `-   - item: ${property}${header}\n    hello\n    world\n\n`;
				const fixed = `- - item: ${property}${header}\n    hello\n    world\n\n`;
				const expected = [[{ item: value }]];
				const diagnostics = YamlLint.run(input, [hyphenSpacing], config);
				assert.strictEqual(diagnostics.length, 1);
				assert.isDefined(diagnostics[0]?.fix);
				assertSuccess(Yaml.parseResult(input), expected);
				const result = YamlLint.fix(input, [hyphenSpacing], config);
				assertSuccess(result, fixed);
				assertSuccess(Yaml.parseResult(result.success), expected);
			}
		}
	});

	it("withholds only fixes that move the explicit-indent scalar's parent hyphen", () => {
		for (const header of headers) {
			const body = header[0] === "|" ? "hello\nworld" : "hello world";
			const value = body + (Str.includes("-")(header) ? "" : Str.includes("+")(header) ? "\n\n" : "\n");
			for (const property of properties) {
				const nested = `-   - ${property}${header}\n      hello\n      world\n\n`;
				const nestedDiagnostics = YamlLint.run(nested, [hyphenSpacing], config);
				assert.strictEqual(nestedDiagnostics.length, 1);
				assert.isUndefined(nestedDiagnostics[0]?.fix);
				assertSuccess(Yaml.parseResult(nested), [[value]]);
				const nestedResult = YamlLint.fix(nested, [hyphenSpacing], config);
				assertSuccess(nestedResult, nested);
				assertSuccess(Yaml.parseResult(nestedResult.success), [[value]]);

				const direct = `-   ${property}${header}\n  hello\n  world\n\n`;
				const directDiagnostics = YamlLint.run(direct, [hyphenSpacing], config);
				assert.strictEqual(directDiagnostics.length, 1);
				assert.isDefined(directDiagnostics[0]?.fix);
				assertSuccess(Yaml.parseResult(direct), [value]);
				const directResult = YamlLint.fix(direct, [hyphenSpacing], config);
				assertSuccess(directResult, `- ${property}${header}\n  hello\n  world\n\n`);
				assertSuccess(Yaml.parseResult(directResult.success), [value]);
			}
		}
	});

	it("bounds token reads linearly for recovered deeply nested input", () => {
		const readsBySize: Array<number> = [];
		for (const size of [1024, 2048]) {
			const input = `${Str.repeat(size)("-   ")}x\n`;
			let reads = 0;
			let tokenCount = 0;
			const diagnostics = YamlLint.run(input, [{
				id: hyphenSpacing.id,
				check: (ctx) => {
					assert.isAbove(ctx.document.errors.length, 0);
					tokenCount = ctx.tokens.length;
					// Count deterministic token-array operations, excluding parsing.
					const tokens = new Proxy(ctx.tokens, {
						get: (target, key, receiver) => {
							reads++;
							return Reflect.get(target, key, receiver);
						},
					});
					return hyphenSpacing.check({ ...ctx, tokens }, {});
				},
			}], config);
			assert.strictEqual(diagnostics.length, size);
			assert.isTrue(A.every(diagnostics, (diagnostic) => diagnostic.fix !== undefined));
			assert.isAtMost(reads, 12 * tokenCount);
			readsBySize.push(reads);
		}
		assert.isAtMost(A.getUnsafe(readsBySize, 1), 2 * A.getUnsafe(readsBySize, 0));
	});
});
