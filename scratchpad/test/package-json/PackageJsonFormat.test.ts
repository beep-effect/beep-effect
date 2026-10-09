// Decode-free canonical sort and format, in both shapes a downstream host
// needs: `PackageJsonFormat.sortValue` (value→value) and
// `PackageJsonFormat.formatToString` (bytes→bytes). The cases named "call-site
// shape" mirror the `sort-package-json` call sites a consumer is replacing.

import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { Package } from "../../effected/package-json/Package.ts";
import type { PackageJsonSyntaxError } from "../../effected/package-json/PackageJsonFormat.ts";
import { PackageJsonFormat } from "../../effected/package-json/PackageJsonFormat.ts";
import { deliberatelyInvalid } from "./deliberatelyInvalid.ts";

const Json = S.fromJsonString(S.Unknown);

const format = (source: string, options?: Parameters<typeof PackageJsonFormat.formatToString>[1]): string => {
	const result = PackageJsonFormat.formatToString(source, options);
	assertTrue(Result.isSuccess(result), "expected formatting to succeed");
	return result.success;
};

const failure = (source: string): PackageJsonSyntaxError => {
	const result = PackageJsonFormat.formatToString(source);
	assertTrue(Result.isFailure(result), "expected formatting to fail");
	return result.failure;
};

describe("PackageJsonFormat.sortValue (value in, value out)", () => {
	it("orders keys canonically without a decode (call-site shape: sortPackageJson(pkg))", () => {
		const sorted = PackageJsonFormat.sortValue({ version: "1.0.0", private: true, name: "p" });
		assert.deepStrictEqual(Object.keys(sorted), ["name", "version", "private"]);
		assert.deepStrictEqual(sorted, { name: "p", version: "1.0.0", private: true });
	});

	it("alphabetizes dependency, script, engine and bin maps", () => {
		const sorted = PackageJsonFormat.sortValue({
			name: "p",
			scripts: { test: "vitest", build: "tsc" },
			dependencies: { zod: "1", axios: "2" },
		});
		assert.deepStrictEqual(Object.keys(sorted.scripts), ["build", "test"]);
		assert.deepStrictEqual(Object.keys(sorted.dependencies), ["axios", "zod"]);
	});

	it("accepts a version-less root and a private-only root", () => {
		assert.deepStrictEqual(PackageJsonFormat.sortValue({ private: true }), { private: true });
		assert.deepStrictEqual(PackageJsonFormat.sortValue({ workspaces: ["packages/*"], name: "root" }), {
			name: "root",
			workspaces: ["packages/*"],
		});
	});

	it("preserves string-form author by construction — it is never inspected", () => {
		const sorted = PackageJsonFormat.sortValue({ author: "Ann Lee <ann@x.dev> (https://x.dev)", name: "p" });
		assert.strictEqual(sorted.author, "Ann Lee <ann@x.dev> (https://x.dev)");
	});

	it("never adds or removes a key, empty maps included", () => {
		// The value path only reorders — that is what lets it return its input
		// type. Removing empty maps lives on `formatToString`, which returns a
		// string and so has no such obligation.
		assert.deepStrictEqual(PackageJsonFormat.sortValue({ name: "p", dependencies: {} }), {
			name: "p",
			dependencies: {},
		});
	});

	it("does not mutate its input", () => {
		const input = { version: "1.0.0", name: "p" };
		const sorted = PackageJsonFormat.sortValue(input);
		assert.deepStrictEqual(Object.keys(input), ["version", "name"]);
		assert.notStrictEqual(sorted, input);
	});

	it("shares nested values by reference rather than cloning", () => {
		const nested = { nested: true };
		const sorted = PackageJsonFormat.sortValue({ name: "p", custom: nested });
		assert.strictEqual(sorted.custom, nested);
	});

	it("returns a non-object unchanged rather than mangling it", () => {
		// Guards a mistyped `Json` union at a call site: an array must not become
		// an index-keyed object.
		const array = [1, 2];
		assert.strictEqual(PackageJsonFormat.sortValue(deliberatelyInvalid<never>(array)), array);
		assert.strictEqual(PackageJsonFormat.sortValue(deliberatelyInvalid<never>(null)), null);
		assert.strictEqual(PackageJsonFormat.sortValue(deliberatelyInvalid<never>("text")), "text");
	});

	it("agrees with PackageJsonFormat.formatToString on ordering", () => {
		const value = { version: "1.0.0", scripts: { b: "2", a: "1" }, name: "p" };
		const viaValue = `${JSON.stringify(PackageJsonFormat.sortValue(value), null, 2)}\n`;
		assert.strictEqual(format(JSON.stringify(value)), viaValue);
	});
});

describe("PackageJsonFormat.formatToString accepts any syntactically valid JSON object", () => {
	it("formats a private-only manifest (call-site shape: sortPackageJson(content))", () => {
		assert.strictEqual(format('{"private": true}'), '{\n  "private": true\n}\n');
	});

	it("formats a version-less root (the tolerant-read shape)", () => {
		assert.strictEqual(
			format('{"name": "root", "workspaces": ["packages/*"], "private": true}'),
			'{\n  "name": "root",\n  "private": true,\n  "workspaces": [\n    "packages/*"\n  ]\n}\n',
		);
	});

	it("formats an empty object", () => {
		assert.strictEqual(format("{}"), "{}\n");
	});

	it("formats a manifest whose values the model would reject", () => {
		// A malformed semver and a malformed packageManager integrity: both are
		// strict-decode failures, neither is a formatting concern.
		assert.strictEqual(
			format('{"version": "1.0", "packageManager": "pnpm@nope"}'),
			'{\n  "version": "1.0",\n  "packageManager": "pnpm@nope"\n}\n',
		);
	});

	it.effect("the strict path keeps its guarantees — this is a separate capability, not a flag", () =>
		Effect.gen(function* () {
			for (const input of [{ private: true }, { name: "root", workspaces: ["packages/*"] }]) {
				const result = yield* Effect.result(Package.decode(input));
				assert.isTrue(result._tag === "Failure", `expected ${(yield* S.encodeEffect(Json)(input))} to fail strict decode`);
			}
		}),
	);
});

describe("PackageJsonFormat.formatToString canonical ordering", () => {
	it("applies the canonical top-level key order", () => {
		const output = format('{"scripts": {"b": "2", "a": "1"}, "version": "1.0.0", "name": "p"}');
		assert.strictEqual(
			output,
			'{\n  "name": "p",\n  "version": "1.0.0",\n  "scripts": {\n    "a": "1",\n    "b": "2"\n  }\n}\n',
		);
	});

	it("agrees with the strict path on a fully valid manifest", () => {
		const source =
			'{\n  "version": "1.0.0",\n  "name": "p",\n  "dependencies": {\n    "b": "1",\n    "a": "2"\n  }\n}\n';
		const tolerant = format(source);
		const strict = Effect.runSync(
			Effect.map(Package.decode(JSON.parse(source)), (pkg) =>
				pkg.toJsonString({ indent: "preserve", sourceText: source }),
			),
		);
		assert.strictEqual(tolerant, strict);
	});
});

describe("PackageJsonFormat.formatToString preserves what it does not format", () => {
	it("leaves string-form author shorthand as a string", () => {
		assert.strictEqual(
			format('{"name": "p", "author": "Ann Lee <ann@x.dev> (https://x.dev)"}'),
			'{\n  "name": "p",\n  "author": "Ann Lee <ann@x.dev> (https://x.dev)"\n}\n',
		);
	});

	it("keeps empty dependency maps, which the strict path strips", () => {
		// The strict path strips these because the model materializes absent maps
		// as empty ones; here the key is one the author actually wrote.
		assert.strictEqual(format('{"name": "p", "dependencies": {}}'), '{\n  "name": "p",\n  "dependencies": {}\n}\n');
	});

	it("strips empty maps on request", () => {
		assert.strictEqual(format('{"name": "p", "dependencies": {}}', { stripEmpty: true }), '{\n  "name": "p"\n}\n');
	});

	it("keeps unknown fields and unusual value shapes", () => {
		assert.strictEqual(
			format('{"name": "p", "customTool": {"nested": [1, null, false]}}'),
			'{\n  "name": "p",\n  "customTool": {\n    "nested": [\n      1,\n      null,\n      false\n    ]\n  }\n}\n',
		);
	});
});

describe("PackageJsonFormat.formatToString indentation", () => {
	it("preserves tab indentation by default", () => {
		assert.strictEqual(format('{\n\t"name": "p"\n}\n'), '{\n\t"name": "p"\n}\n');
	});

	it("preserves a four-space indentation by default", () => {
		assert.strictEqual(
			format('{\n    "name": "p",\n    "private": true\n}\n'),
			'{\n    "name": "p",\n    "private": true\n}\n',
		);
	});

	it("falls back to two spaces for a single-line source", () => {
		assert.strictEqual(format('{"name":"p"}'), '{\n  "name": "p"\n}\n');
	});

	it("honors an explicit indent over the source", () => {
		assert.strictEqual(format('{\n\t"name": "p"\n}\n', { indent: 4 }), '{\n    "name": "p"\n}\n');
	});

	it("omits the trailing newline on request", () => {
		assert.strictEqual(format('{"name": "p"}', { newline: false }), '{\n  "name": "p"\n}');
	});

	it("leaves key order alone when sorting is off", () => {
		assert.strictEqual(
			format('{"version": "1.0.0", "name": "p"}', { sort: false }),
			'{\n  "version": "1.0.0",\n  "name": "p"\n}\n',
		);
	});

	it("is idempotent", () => {
		const once = format('{"version":"1.0.0","name":"p","scripts":{"b":"2","a":"1"}}');
		assert.strictEqual(format(once), once);
	});
});

describe("PackageJsonFormat.formatToString syntactic failures", () => {
	it("fails invalid-json on malformed text", () => {
		const error = failure('{"name": ');
		assert.strictEqual(error._tag, "PackageJsonSyntaxError");
		assert.strictEqual(error.reason, "invalid-json");
		assert.isDefined(error.cause);
		assert.strictEqual(error.message, "package.json text is not valid JSON");
	});

	it("fails not-an-object on a JSON array, scalar or null", () => {
		for (const source of ["[]", '"text"', "42", "null"]) {
			const error = failure(source);
			assert.strictEqual(error.reason, "not-an-object", `expected ${source} to be rejected`);
		}
	});

	it("lifts into an Effect through Effect.fromResult", () =>
		assert.strictEqual(
			PackageJsonFormat.formatToString('{"name": "p"}').pipe(Effect.fromResult, Effect.runSync),
			'{\n  "name": "p"\n}\n',
		));
});
