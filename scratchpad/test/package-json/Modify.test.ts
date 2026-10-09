// The surgical mutator: `PackageJsonFormat.modify` / `modifyToString`.
//
// The contract under test is BYTE preservation: a tool that changes one field
// in someone else's manifest must not rewrite unrelated regions, so every
// input here is deliberately NOT canonically sorted — the keys are in an order
// the formatter would rewrite — and every assertion is exact-string equality
// against an expected text in which only the edited span differs. A repo that
// runs sort-package-json cannot catch a reorder (the reorder is a no-op
// there); these fixtures can.

import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { PackageJsonFormat, PackageJsonModifyError, PackageJsonSyntaxError } from "../../effected/package-json/PackageJsonFormat.ts";

// Keys deliberately out of canonical order: dependencies before name,
// devEngines before version, scripts unsorted.
const UNSORTED =
	"{\n" +
	'  "dependencies": {\n' +
	'    "zebra": "^1.0.0",\n' +
	'    "apple": "^2.0.0"\n' +
	"  },\n" +
	'  "name": "not-sorted",\n' +
	'  "devEngines": {\n' +
	'    "runtime": {\n' +
	'      "name": "node",\n' +
	'      "version": "24.9.1"\n' +
	"    }\n" +
	"  },\n" +
	'  "version": "0.1.0",\n' +
	'  "scripts": {\n' +
	'    "b": "two",\n' +
	'    "a": "one"\n' +
	"  },\n" +
	'  "packageManager": "pnpm@11.2.0"\n' +
	"}\n";

describe("PackageJsonFormat.modifyToString", () => {
	it.effect("replaces one top-level value and preserves every other byte", () =>
		Effect.gen(function* () {
			const output = yield* PackageJsonFormat.modifyToString(UNSORTED, ["packageManager"], "pnpm@11.3.0");
			assert.strictEqual(output, UNSORTED.replace('"pnpm@11.2.0"', '"pnpm@11.3.0"'));
		}),
	);

	it.effect("replaces a nested value and preserves every other byte", () =>
		Effect.gen(function* () {
			const output = yield* PackageJsonFormat.modifyToString(UNSORTED, ["devEngines", "runtime", "version"], "24.10.0");
			assert.strictEqual(output, UNSORTED.replace('"version": "24.9.1"', '"version": "24.10.0"'));
		}),
	);

	it.effect("inserts a missing key after the container's last key, matching the source indent", () =>
		Effect.gen(function* () {
			const source = '{\n    "private": true\n}\n';
			const output = yield* PackageJsonFormat.modifyToString(source, ["packageManager"], "pnpm@11.2.0");
			assert.strictEqual(output, '{\n    "private": true,\n    "packageManager": "pnpm@11.2.0"\n}\n');
		}),
	);

	it.effect("inserts with tab indentation when the source is tab-indented", () =>
		Effect.gen(function* () {
			const source = '{\n\t"private": true\n}\n';
			const output = yield* PackageJsonFormat.modifyToString(source, ["packageManager"], "pnpm@11.2.0");
			assert.strictEqual(output, '{\n\t"private": true,\n\t"packageManager": "pnpm@11.2.0"\n}\n');
		}),
	);

	it.effect("deletes a key (and its comma) when value is undefined", () =>
		Effect.gen(function* () {
			const source = '{\n  "name": "x",\n  "packageManager": "pnpm@11.2.0"\n}\n';
			const output = yield* PackageJsonFormat.modifyToString(source, ["packageManager"], undefined);
			assert.strictEqual(output, '{\n  "name": "x"\n}\n');
		}),
	);

	it.effect("preserves CRLF line endings in inserted content", () =>
		Effect.gen(function* () {
			const source = '{\r\n  "private": true\r\n}\r\n';
			const output = yield* PackageJsonFormat.modifyToString(source, ["packageManager"], "pnpm@11.2.0");
			assert.strictEqual(output, '{\r\n  "private": true,\r\n  "packageManager": "pnpm@11.2.0"\r\n}\r\n');
		}),
	);

	it.effect("preserves the absence of a trailing newline", () =>
		Effect.gen(function* () {
			const source = '{\n  "packageManager": "pnpm@11.2.0"\n}';
			const output = yield* PackageJsonFormat.modifyToString(source, ["packageManager"], "pnpm@11.3.0");
			assert.strictEqual(output, '{\n  "packageManager": "pnpm@11.3.0"\n}');
		}),
	);

	it.effect("passes a nonsemver version through untouched — the modify path never decodes", () =>
		Effect.gen(function* () {
			// "1.0" is legal for an unpublished root and rejected by every decode
			// in this package; the mutator must carry it anyway, or the tool
			// refuses the repos it exists to edit.
			const source = '{\n  "version": "1.0",\n  "packageManager": "pnpm@11.2.0"\n}\n';
			const output = yield* PackageJsonFormat.modifyToString(source, ["packageManager"], "pnpm@11.3.0");
			assert.strictEqual(output, '{\n  "version": "1.0",\n  "packageManager": "pnpm@11.3.0"\n}\n');
		}),
	);

	it.effect("fails with PackageJsonSyntaxError on invalid JSON", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(PackageJsonFormat.modifyToString("{ nope", ["a"], 1));
			if (!(S.is(PackageJsonSyntaxError)(error))) {
				return assert.fail(`expected PackageJsonSyntaxError, got ${error._tag}`);
			}
			assert.strictEqual(error.reason, "invalid-json");
		}),
	);

	it.effect("fails with PackageJsonSyntaxError on a non-object document", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(PackageJsonFormat.modifyToString("[1, 2]", ["a"], 1));
			if (!(S.is(PackageJsonSyntaxError)(error))) {
				return assert.fail(`expected PackageJsonSyntaxError, got ${error._tag}`);
			}
			assert.strictEqual(error.reason, "not-an-object");
		}),
	);

	it.effect("fails with PackageJsonModifyError when the path cannot be navigated", () =>
		Effect.gen(function* () {
			// `name` is a string; descending into it as an object is a mismatch.
			const error = yield* Effect.flip(PackageJsonFormat.modifyToString(UNSORTED, ["name", "sub"], 1));
			if (!(S.is(PackageJsonModifyError)(error))) {
				return assert.fail(`expected PackageJsonModifyError, got ${error._tag}`);
			}
			assert.deepStrictEqual(error.path, ["name", "sub"]);
			// The structured cause is the underlying JsoncModificationError.
			assert.strictEqual((error.cause as { readonly _tag?: string })._tag, "JsoncModificationError");
		}),
	);
});

describe("PackageJsonFormat.modify", () => {
	it.effect("returns no edits for a structural no-op", () =>
		Effect.gen(function* () {
			// Deleting a key that does not exist is a no-op, not an error.
			const edits = yield* PackageJsonFormat.modify(UNSORTED, ["doesNotExist"], undefined);
			assert.strictEqual(edits.length, 0);
		}),
	);

	it.effect("computes a single-span edit for a value replacement", () =>
		Effect.gen(function* () {
			const edits = yield* PackageJsonFormat.modify(UNSORTED, ["packageManager"], "pnpm@11.3.0");
			assert.strictEqual(edits.length, 1);
			const edit = edits[0];
			if (edit === undefined) {
				return assert.fail("expected exactly one edit");
			}
			assert.strictEqual(edit.content, '"pnpm@11.3.0"');
			assert.strictEqual(UNSORTED.slice(edit.offset, edit.offset + edit.length), '"pnpm@11.2.0"');
		}),
	);
});
