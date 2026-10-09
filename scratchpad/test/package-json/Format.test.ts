// @effect-diagnostics nodeBuiltinImport:skip-file
// Formatting surface: indent modes (spaces / "tab" / "preserve"), the
// sort-package-json@4.0.0 canonical top-level key order, map alphabetization,
// and byte parity against frozen sort-package-json output for real manifests
// from this repository (see fixtures/README.md for provenance).

import { readFileSync } from "node:fs";
import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { Package } from "../../effected/package-json/Package.ts";

const minimal = { name: "my-pkg", version: "1.0.0" };

const decodeAndRender = (raw: Record<string, unknown>, options?: Parameters<Package["toJsonString"]>[0]) =>
	Effect.map(Package.decode(raw), (pkg) => pkg.toJsonString(options));

describe("PackageFormatOptions.indent", () => {
	it.effect("a number indents with that many spaces", () =>
		Effect.gen(function* () {
			const json = yield* decodeAndRender(minimal, { indent: 4 });
			assert.isTrue(json.includes('\n    "name"'));
		}),
	);

	it.effect('"tab" indents with real tabs', () =>
		Effect.gen(function* () {
			const json = yield* decodeAndRender(minimal, { indent: "tab" });
			assert.isTrue(json.includes('\n\t"name"'));
			assert.isFalse(json.includes("  "));
		}),
	);

	it.effect('"preserve" reuses tab indentation detected from sourceText', () =>
		Effect.gen(function* () {
			const source = '{\n\t"name": "my-pkg",\n\t"version": "1.0.0"\n}\n';
			const json = yield* decodeAndRender(minimal, { indent: "preserve", sourceText: source });
			assert.isTrue(json.includes('\n\t"name"'));
		}),
	);

	it.effect('"preserve" reuses a space-count indentation detected from sourceText', () =>
		Effect.gen(function* () {
			const source = '{\n    "name": "my-pkg",\n    "version": "1.0.0"\n}\n';
			const json = yield* decodeAndRender(minimal, { indent: "preserve", sourceText: source });
			assert.isTrue(json.includes('\n    "name"'));
			assert.isFalse(json.includes("\t"));
		}),
	);

	it.effect('"preserve" without sourceText falls back to the two-space default', () =>
		Effect.gen(function* () {
			const json = yield* decodeAndRender(minimal, { indent: "preserve" });
			assert.isTrue(json.includes('\n  "name"'));
		}),
	);

	it.effect('"preserve" with an unindented source falls back to the two-space default', () =>
		Effect.gen(function* () {
			const json = yield* decodeAndRender(minimal, {
				indent: "preserve",
				sourceText: '{"name":"my-pkg","version":"1.0.0"}',
			});
			assert.isTrue(json.includes('\n  "name"'));
		}),
	);

	it.effect("sourceText is ignored when indent is explicit", () =>
		Effect.gen(function* () {
			const source = '{\n\t"name": "my-pkg",\n\t"version": "1.0.0"\n}\n';
			const json = yield* decodeAndRender(minimal, { indent: 2, sourceText: source });
			assert.isTrue(json.includes('\n  "name"'));
			assert.isFalse(json.includes("\t"));
		}),
	);
});

describe("canonical top-level key order (sort-package-json@4.0.0)", () => {
	it.effect("places packageManager before engines and devEngines", () =>
		Effect.gen(function* () {
			const json = yield* decodeAndRender({
				...minimal,
				devEngines: { packageManager: { name: "pnpm" } },
				engines: { node: ">=24" },
				packageManager: "pnpm@10.0.0",
			});
			const keys = Object.keys(JSON.parse(json) as Record<string, unknown>);
			assert.isBelow(keys.indexOf("packageManager"), keys.indexOf("engines"));
			assert.isBelow(keys.indexOf("engines"), keys.indexOf("devEngines"));
		}),
	);

	it.effect("places sideEffects after author/contributors and before type", () =>
		Effect.gen(function* () {
			const json = yield* decodeAndRender({
				...minimal,
				type: "module",
				sideEffects: false,
				author: "C. Spencer Beggs",
			});
			const keys = Object.keys(JSON.parse(json) as Record<string, unknown>);
			assert.isBelow(keys.indexOf("author"), keys.indexOf("sideEffects"));
			assert.isBelow(keys.indexOf("sideEffects"), keys.indexOf("type"));
		}),
	);

	it.effect("places publishConfig after os/cpu, near the end of the known keys", () =>
		Effect.gen(function* () {
			const json = yield* decodeAndRender({
				...minimal,
				publishConfig: { access: "public" },
				cpu: ["arm64"],
				os: ["darwin"],
			});
			const keys = Object.keys(JSON.parse(json) as Record<string, unknown>);
			assert.isBelow(keys.indexOf("os"), keys.indexOf("cpu"));
			assert.isBelow(keys.indexOf("cpu"), keys.indexOf("publishConfig"));
		}),
	);

	it.effect("appends unknown public keys alphabetically, then _-prefixed keys", () =>
		Effect.gen(function* () {
			const json = yield* decodeAndRender({
				...minimal,
				zebra: 1,
				aardvark: 2,
				_meta: 3,
				pnpm: { overrides: {} },
			});
			const keys = Object.keys(JSON.parse(json) as Record<string, unknown>);
			// `pnpm` is a known key; the unknowns follow it: public sorted, then private.
			assert.isBelow(keys.indexOf("pnpm"), keys.indexOf("aardvark"));
			assert.isBelow(keys.indexOf("aardvark"), keys.indexOf("zebra"));
			assert.isBelow(keys.indexOf("zebra"), keys.indexOf("_meta"));
		}),
	);

	it.effect("alphabetizes scripts, engines and object-form bin entries", () =>
		Effect.gen(function* () {
			const json = yield* decodeAndRender({
				...minimal,
				scripts: { test: "vitest", build: "tsc", lint: "biome check" },
				engines: { pnpm: ">=10", node: ">=24" },
				bin: { zzz: "./z.js", aaa: "./a.js" },
			});
			const parsed = JSON.parse(json) as {
				scripts: Record<string, string>;
				engines: Record<string, string>;
				bin: Record<string, string>;
			};
			assert.deepStrictEqual(Object.keys(parsed.scripts), ["build", "lint", "test"]);
			assert.deepStrictEqual(Object.keys(parsed.engines), ["node", "pnpm"]);
			assert.deepStrictEqual(Object.keys(parsed.bin), ["aaa", "zzz"]);
		}),
	);

	it.effect("strips a defaulted empty scripts map like the dependency maps", () =>
		Effect.gen(function* () {
			const json = yield* decodeAndRender(minimal);
			const parsed = JSON.parse(json) as Record<string, unknown>;
			assert.isFalse("scripts" in parsed);
			assert.isFalse("dependencies" in parsed);
		}),
	);
});

describe("people-field wire form survives the strict format path", () => {
	it.effect("string-form author is not rewritten to object form", () =>
		Effect.gen(function* () {
			const json = yield* decodeAndRender(
				{ ...minimal, author: "Ann Lee <ann@x.dev> (https://x.dev)" },
				{ newline: false },
			);
			assert.strictEqual(
				json,
				'{\n  "name": "my-pkg",\n  "version": "1.0.0",\n  "author": "Ann Lee <ann@x.dev> (https://x.dev)"\n}',
			);
		}),
	);

	it.effect("mixed-form contributors each keep their own encoding", () =>
		Effect.gen(function* () {
			const json = yield* decodeAndRender(
				{ ...minimal, contributors: ["Bo <bo@x.dev>", { name: "Cy", role: "reviewer" }] },
				{ newline: false },
			);
			const parsed = JSON.parse(json) as { contributors: ReadonlyArray<unknown> };
			assert.deepStrictEqual(parsed.contributors, ["Bo <bo@x.dev>", { name: "Cy", role: "reviewer" }]);
		}),
	);

	it.effect("unknown keys on an object-form author are not dropped", () =>
		Effect.gen(function* () {
			const json = yield* decodeAndRender({ ...minimal, author: { name: "Dee", twitter: "@dee" } }, { newline: false });
			const parsed = JSON.parse(json) as { author: Record<string, unknown> };
			assert.deepStrictEqual(parsed.author, { name: "Dee", twitter: "@dee" });
		}),
	);

	it.effect("editing another field leaves the string author encoding alone", () =>
		Effect.gen(function* () {
			// The consumer's actual flow: read, change something unrelated, write.
			const pkg = yield* Package.decode({ ...minimal, author: "Ann Lee <ann@x.dev>" });
			const bumped = yield* Package.setVersion(pkg, "1.1.0");
			const parsed = JSON.parse(bumped.toJsonString()) as Record<string, unknown>;
			assert.strictEqual(parsed.version, "1.1.0");
			assert.strictEqual(parsed.author, "Ann Lee <ann@x.dev>");
		}),
	);

	it.effect("a manifest with a string author round-trips byte-identically", () =>
		Effect.gen(function* () {
			const source = '{\n\t"name": "my-pkg",\n\t"version": "1.0.0",\n\t"author": "Ann Lee <ann@x.dev>"\n}\n';
			const raw = JSON.parse(source) as Record<string, unknown>;
			const output = yield* decodeAndRender(raw, { indent: "preserve", sourceText: source });
			assert.strictEqual(output, source);
		}),
	);
});

describe("byte parity with sort-package-json@4.0.0 on real manifests", () => {
	const fixtures = ["root", "package-json", "semver", "toml", "workspaces"] as const;

	const read = (name: string): string => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

	for (const name of fixtures) {
		it.effect(`${name}.input.json round-trips byte-identically with indent: "preserve"`, () =>
			Effect.gen(function* () {
				const input = read(`${name}.input.json`);
				const expected = read(`${name}.expected.json`);
				const raw = JSON.parse(input) as Record<string, unknown>;
				const output = yield* decodeAndRender(raw, { indent: "preserve", sourceText: input });
				assert.strictEqual(output, expected);
			}),
		);
	}

	it.effect('tab-indented sources produce identical output via indent: "tab"', () =>
		Effect.gen(function* () {
			const input = read("root.input.json");
			const raw = JSON.parse(input) as Record<string, unknown>;
			const viaPreserve = yield* decodeAndRender(raw, { indent: "preserve", sourceText: input });
			const viaTab = yield* decodeAndRender(raw, { indent: "tab" });
			assert.strictEqual(viaTab, viaPreserve);
		}),
	);
});
