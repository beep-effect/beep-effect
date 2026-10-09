import { assert, describe, it } from "@effect/vitest";
import * as O from "effect/Option";
import { LockfileFormat, filenameFor, filenamesFor, fromFilename } from "../../effected/lockfiles/LockfileFormat.ts";

describe("LockfileFormat", () => {
	it("names the four supported formats", () => {
		assert.deepStrictEqual([...LockfileFormat.literals], ["bun", "npm", "pnpm", "yarn"]);
	});

	describe("filenameFor", () => {
		it("maps every format to its conventional filename", () => {
			assert.strictEqual(filenameFor("bun"), "bun.lock");
			assert.strictEqual(filenameFor("npm"), "package-lock.json");
			assert.strictEqual(filenameFor("pnpm"), "pnpm-lock.yaml");
			assert.strictEqual(filenameFor("yarn"), "yarn.lock");
		});
	});

	describe("filenamesFor", () => {
		it("pins the full table — genuine lockfile spellings only, primary first", () => {
			// npm honours npm-shrinkwrap.json; bun has shipped two formats (the
			// current text bun.lock and the older binary bun.lockb). Workspace-config
			// extras (pnpm-workspace.yaml, .pnpmfile.cjs, yarn PnP files) are a
			// consumer's cache policy and must never appear here.
			assert.deepStrictEqual(filenamesFor("bun"), ["bun.lock", "bun.lockb"]);
			assert.deepStrictEqual(filenamesFor("npm"), ["package-lock.json", "npm-shrinkwrap.json"]);
			assert.deepStrictEqual(filenamesFor("pnpm"), ["pnpm-lock.yaml"]);
			assert.deepStrictEqual(filenamesFor("yarn"), ["yarn.lock"]);
		});

		it("keeps filenameFor as the first element for every format — one source of truth", () => {
			for (const format of LockfileFormat.literals) {
				assert.strictEqual(filenameFor(format), filenamesFor(format)[0]);
			}
		});
	});

	describe("fromFilename", () => {
		it("recognizes every conventional filename", () => {
			assert.deepStrictEqual(fromFilename("bun.lock"), O.some("bun"));
			assert.deepStrictEqual(fromFilename("package-lock.json"), O.some("npm"));
			assert.deepStrictEqual(fromFilename("pnpm-lock.yaml"), O.some("pnpm"));
			assert.deepStrictEqual(fromFilename("yarn.lock"), O.some("yarn"));
		});

		it("round-trips filenameFor for every format", () => {
			for (const format of LockfileFormat.literals) {
				assert.deepStrictEqual(fromFilename(filenameFor(format)), O.some(format));
			}
		});

		it("returns none for unknown names, paths and near-misses", () => {
			assert.isTrue(O.isNone(fromFilename("package.json")));
			// The filenamesFor alternates deliberately do not identify: bun.lockb is
			// a detection alternate, not a parse target (the format is binary).
			assert.isTrue(O.isNone(fromFilename("bun.lockb")));
			assert.isTrue(O.isNone(fromFilename("npm-shrinkwrap.json")));
			assert.isTrue(O.isNone(fromFilename("some/dir/pnpm-lock.yaml")));
			assert.isTrue(O.isNone(fromFilename("PNPM-LOCK.YAML")));
			assert.isTrue(O.isNone(fromFilename("")));
		});
	});
});
