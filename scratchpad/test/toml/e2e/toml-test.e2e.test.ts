// @effect-diagnostics nodeBuiltinImport:skip-file
// The toml-test compliance gate: one test per vendored corpus case, no skip
// list. Every valid pair must decode to its tagged expected value; every
// invalid file must fail through the typed error channel (TomlParseError,
// any code) — never as a defect, crash or hang.
//
// Fixtures are read as raw bytes (utf8, NO newline normalization): several
// cases deliberately carry CRLF / lone-CR bytes — in both directions, valid
// CRLF documents and invalid bare-CR ones — protected by a scoped
// .gitattributes in the fixture tree.

import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { Toml, TomlParseError } from "../../../effected/toml/Toml.ts";
import { assertMatchesTagged } from "./taggedJson.ts";
import { expectFailure } from "../expectFailure.ts";

const TaggedJson = S.fromJsonString(S.Unknown);

const CORPUS_DIR = resolve(import.meta.dirname, "../fixtures/toml-test");

// Counts recorded in the fixture README — guards against a silently-empty walk.
const README_VALID_COUNT = 214;
const README_INVALID_COUNT = 467;

/** All `.toml` files under `root`, as sorted paths relative to `root`. */
function walkTomlFiles(root: string): ReadonlyArray<string> {
	return readdirSync(root, { recursive: true, encoding: "utf8" })
		.filter((entry) => entry.endsWith(".toml"))
		.map((entry) => entry.replaceAll("\\", "/"))
		.sort();
}

const validCases = walkTomlFiles(join(CORPUS_DIR, "valid"));
const invalidCases = walkTomlFiles(join(CORPUS_DIR, "invalid"));

describe("toml-test compliance", () => {
	it("discovers the full vendored corpus", () => {
		assert.isAtLeast(validCases.length, README_VALID_COUNT, "valid corpus walk came up short");
		assert.isAtLeast(invalidCases.length, README_INVALID_COUNT, "invalid corpus walk came up short");
	});

	describe("valid", () => {
		for (const relPath of validCases) {
			it.effect(relPath, () =>
				Effect.gen(function* () {
					const source = readFileSync(join(CORPUS_DIR, "valid", relPath), "utf8");
					const expected = yield* S.decodeEffect(TaggedJson)(
						readFileSync(join(CORPUS_DIR, "valid", relPath.replace(/\.toml$/, ".json")), "utf8"),
					);
					const actual = yield* Toml.parse(source);
					assertMatchesTagged(actual, expected, "$");
				}),
			);
		}
	});

	describe("invalid", () => {
		for (const relPath of invalidCases) {
			it.effect(relPath, () =>
				Effect.gen(function* () {
					const source = readFileSync(join(CORPUS_DIR, "invalid", relPath), "utf8");
					const error = yield* expectFailure(Toml.parse(source));
					assert.instanceOf(error, TomlParseError);
				}),
			);
		}
	});
});
