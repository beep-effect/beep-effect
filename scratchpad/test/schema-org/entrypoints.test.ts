import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assert, describe, it } from "@effect/vitest";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "../src");

/** Every relative import specifier in a module, resolved to a source path. */
const importsOf = (file: string): ReadonlyArray<string> => {
	const source = readFileSync(file, "utf8");
	const specifiers = [...source.matchAll(/from\s+"(\.[^"]+)"/g)].map((match) => match[1] ?? "");
	return specifiers.map((specifier) => resolve(dirname(file), specifier.replace(/\.js$/, ".ts")));
};

/** Every module reachable from an entrypoint, transitively. */
const reachableFrom = (entry: string): ReadonlySet<string> => {
	const seen = new Set<string>();
	const queue = [entry];
	while (queue.length > 0) {
		const file = queue.pop();
		if (file === undefined || seen.has(file)) continue;
		seen.add(file);
		for (const next of importsOf(file)) queue.push(next);
	}
	return seen;
};

describe("entrypoint boundary", () => {
	/**
	 * The whole point of the two-entrypoint split: a consumer who only builds
	 * graphs must not pay for the vocabulary table. Review cannot enforce this —
	 * one convenience import from any node module would silently undo it, and
	 * nothing would fail — so it is asserted structurally.
	 */
	it("nothing reachable from `.` imports the vocabulary dataset", () => {
		const reachable = reachableFrom(resolve(SRC, "index.ts"));

		const offenders = [...reachable].filter((file) => /internal\/vocabulary\.ts$/.test(file));

		assert.deepStrictEqual(
			offenders,
			[],
			"a module reachable from the default entrypoint imports the vocabulary table, which defeats the split",
		);
	});

	it("nothing reachable from `.` imports Vocabulary or Conformance either", () => {
		const reachable = reachableFrom(resolve(SRC, "index.ts"));

		const offenders = [...reachable].filter((file) => /src\/(Vocabulary|Conformance)\.ts$/.test(file));

		assert.deepStrictEqual(offenders, [], "the validator and its data belong behind `./conformance`");
	});

	/**
	 * The positive control. Without it the two assertions above would pass just
	 * as well against a typo in the path regex, an empty reachable set, or a
	 * walker that silently resolves nothing.
	 */
	it("positive control: the conformance entrypoint DOES reach the dataset", () => {
		const reachable = reachableFrom(resolve(SRC, "conformance-entry.ts"));

		assert.isAbove(reachable.size, 1, "the walker must actually resolve imports");
		assert.isTrue(
			[...reachable].some((file) => /src\/Vocabulary\.ts$/.test(file)),
			"if this fails the walker is broken and the assertions above prove nothing",
		);
	});

	it("the walker sees the node modules from `.`, or it is proving nothing", () => {
		const reachable = reachableFrom(resolve(SRC, "index.ts"));

		for (const module of ["JsonLdDocument.ts", "NodeRef.ts", "TechArticle.ts", "SoftwareSourceCode.ts", "Thing.ts"]) {
			assert.isTrue(
				[...reachable].some((file) => file.endsWith(`/${module}`)),
				`${module} must be reachable from the default entrypoint`,
			);
		}
	});
});
