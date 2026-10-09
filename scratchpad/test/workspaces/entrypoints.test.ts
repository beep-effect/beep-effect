// @effect-diagnostics nodeBuiltinImport:skip-file
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assert, describe, it } from "@effect/vitest";
import { SourceBoundary } from "../../effected/workspaces/testing.ts";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "../../effected/workspaces");

/** Every relative import of a module, resolved to its source path. */
const importsOf = (file: string): ReadonlyArray<string> =>
	SourceBoundary.importSpecifiers(readFileSync(file, "utf8"))
		.filter((specifier) => specifier.startsWith("."))
		.map((specifier) => resolve(dirname(file), specifier.replace(/\.js$/, ".ts")));

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

const TESTING_ONLY =
	/effected\/workspaces\/(testing|SourceBoundary|LayerPolicy|WorkspaceLayering|PackedInstall|internal\/sourceText|internal\/packedInstallPlan)\.ts$/;

describe("entrypoint boundary", () => {
	it("nothing reachable from `.` belongs to ./testing", () => {
		const offenders = [...reachableFrom(resolve(SRC, "index.ts"))].filter((file) => TESTING_ONLY.test(file));
		assert.deepStrictEqual(offenders, [], "repo-shape checks belong behind ./testing");
	});

	it("nothing reachable from `.` is ./node-sync", () => {
		const offenders = [...reachableFrom(resolve(SRC, "index.ts"))].filter((file) => /effected\/workspaces\/node-sync\.ts$/.test(file));
		assert.deepStrictEqual(offenders, []);
	});

	it("positive control: ./testing DOES reach its modules", () => {
		const reachable = [...reachableFrom(resolve(SRC, "testing.ts"))];
		assert.isAbove(reachable.length, 1, "the walker must actually resolve imports");
		for (const module of [
			"SourceBoundary",
			"internal/sourceText",
			"LayerPolicy",
			"WorkspaceLayering",
			"PackedInstall",
			"internal/packedInstallPlan",
		]) {
			assert.isTrue(
				reachable.some((file) => file.endsWith(`effected/workspaces/${module}.ts`)),
				module,
			);
		}
	});

	it("the walker resolves the main entry's modules, or it proves nothing", () => {
		assert.isTrue(
			[...reachableFrom(resolve(SRC, "index.ts"))].some((file) => /effected\/workspaces\/WorkspaceDiscovery\.ts$/.test(file)),
		);
	});
});
