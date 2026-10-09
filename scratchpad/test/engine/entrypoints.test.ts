import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assert, describe, it } from "@effect/vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = resolve(ROOT, "src");
const BUILT = resolve(ROOT, "dist", "dev", "pkg");

/**
 * Every static RUNTIME import specifier in a module: `import type` and
 * `export type` declarations are erased at build time and skipped, a dynamic
 * `import()` is not a static import, and a bare package counts.
 */
const runtimeImportsOf = (file: string): ReadonlyArray<string> => {
	const source = readFileSync(file, "utf8");
	return [...source.matchAll(/^\s*(import|export)\s+(type\s+)?[^;]*?\bfrom\s+"([^"]+)"/gms)]
		.filter((match) => match[2] === undefined)
		.map((match) => match[3] ?? "");
};

/** Every module reachable from an entrypoint through static runtime imports, with the bare packages it loads. */
const runtimeGraphOf = (entry: string, extension: ".ts" | ".js") => {
	const modules = new Set<string>();
	const packages = new Set<string>();
	const queue = [entry];
	while (queue.length > 0) {
		const file = queue.pop();
		if (file === undefined || modules.has(file)) continue;
		modules.add(file);
		for (const specifier of runtimeImportsOf(file)) {
			if (specifier.startsWith(".")) queue.push(resolve(dirname(file), specifier.replace(/\.js$/, extension)));
			else packages.add(specifier);
		}
	}
	return { modules, packages };
};

const relative = (root: string, modules: ReadonlySet<string>) =>
	[...modules].map((file) => file.slice(root.length + 1)).sort();

describe("./guard loads nothing before its guards listen", () => {
	it("./guard statically reaches only ProcessGuard, and no package at all", () => {
		const { modules, packages } = runtimeGraphOf(resolve(SRC, "guard.ts"), ".ts");
		assert.deepStrictEqual(relative(SRC, modules), ["ProcessGuard.ts", "guard.ts"]);
		assert.deepStrictEqual([...packages], []);
	});

	it("the built ./guard reaches only ProcessGuard.js, and no package at all", () => {
		const entry = resolve(BUILT, "guard.js");
		assert.isTrue(existsSync(entry), "build:dev must have emitted dist/dev/pkg/guard.js");
		const { modules, packages } = runtimeGraphOf(entry, ".js");
		assert.deepStrictEqual(relative(BUILT, modules), ["ProcessGuard.js", "guard.js"]);
		assert.deepStrictEqual([...packages], []);
	});

	it("positive control: the walker sees the main entry's runtime import of effect", () => {
		const { modules, packages } = runtimeGraphOf(resolve(SRC, "index.ts"), ".ts");
		assert.isTrue([...modules].some((file) => file.endsWith("Distribution.ts")));
		assert.include([...packages], "effect");
	});

	it("the main entry never reaches the guard (it stays a subpath of its own)", () => {
		const { modules } = runtimeGraphOf(resolve(SRC, "index.ts"), ".ts");
		assert.isFalse([...modules].some((file) => file.endsWith("ProcessGuard.ts")));
	});
});
