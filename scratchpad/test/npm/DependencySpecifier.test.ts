import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
	CatalogSpecifier,
	DependencySpecifier,
	DistTagSpecifier,
	InvalidDependencySpecifierError,
	RangeSpecifier,
	RawSpecifier,
	WorkspaceSpecifier,
} from "../../effected/npm/index.ts";

const isCatalogSpecifier = S.is(CatalogSpecifier);
const isWorkspaceSpecifier = S.is(WorkspaceSpecifier);

describe("DependencySpecifier schema", () => {
	const valid = [
		"^1.0.0",
		"~2.3.4",
		">=1.0.0 <2.0.0",
		"1.2.3",
		"*",
		"1.x",
		"latest",
		"next",
		"https://example.com/pkg.tgz",
		"git+https://github.com/user/repo.git",
		"git+ssh://git@github.com/user/repo.git",
		"github:u/r",
		"gist:abc",
		"bitbucket:u/r",
		"gitlab:u/r",
		"user/repo",
		"user/repo#branch",
		"file:../local-pkg",
		"npm:lodash@^4.0.0",
		"catalog:silk",
		"workspace:*",
	];

	it.effect("accepts every recognized specifier", () =>
		Effect.gen(function* () {
			for (const specifier of valid) {
				assert.strictEqual(yield* S.decodeEffect(DependencySpecifier)(specifier), specifier);
			}
		}),
	);

	it.effect("rejects garbage, unknown protocols and empty string", () =>
		Effect.gen(function* () {
			for (const specifier of ["!!garbage", "patch:lodash", ""]) {
				const error = yield* Effect.flip(S.decodeEffect(DependencySpecifier)(specifier));
				assert.strictEqual(error._tag, "SchemaError", specifier);
			}
		}),
	);
});

describe("DependencySpecifier.protocolOf", () => {
	const cases: ReadonlyArray<[string, string]> = [
		["^1.0.0", "range"],
		["1.x", "range"],
		["*", "range"],
		[">=1.0.0 <2.0.0", "range"],
		["latest", "tag"],
		["git+https://github.com/u/r.git", "git"],
		["github:u/r", "git"],
		["user/repo", "git"],
		["file:../x", "file"],
		["./local", "file"],
		["/absolute/path", "file"],
		["link:../x", "link"],
		["portal:../x", "portal"],
		["catalog:silk", "catalog"],
		["workspace:*", "workspace"],
		["https://x.com/a.tgz", "url"],
		["npm:lodash@^4", "npm"],
		["!!garbage", "unknown"],
	];

	it("classifies each specifier", () => {
		for (const [specifier, protocol] of cases) {
			assert.strictEqual(DependencySpecifier.protocolOf(specifier), protocol, specifier);
		}
	});

	it("isValid agrees with protocolOf, including bare paths", () => {
		assert.isTrue(DependencySpecifier.isValid("/absolute/path"));
		assert.strictEqual(DependencySpecifier.protocolOf("/absolute/path"), "file");
		assert.isTrue(DependencySpecifier.isValid("./local"));
		assert.strictEqual(DependencySpecifier.protocolOf("./local"), "file");
		assert.isFalse(DependencySpecifier.isValid("!!garbage"));
	});

	it("isRange decodes ranges purely (no tag, no protocol)", () => {
		assert.isTrue(DependencySpecifier.isRange("^1.0.0"));
		assert.isTrue(DependencySpecifier.isRange(">=1.0.0 <2.0.0"));
		assert.isFalse(DependencySpecifier.isRange("latest"));
		assert.isFalse(DependencySpecifier.isRange("workspace:*"));
		assert.isTrue(O.isSome(DependencySpecifier.parseRange("^1.0.0")));
		assert.isTrue(O.isNone(DependencySpecifier.parseRange("latest")));
	});
});

describe("DependencySpecifier.catalogNameOf", () => {
	it("is Some(name) for a named catalog", () => {
		assert.deepStrictEqual(DependencySpecifier.catalogNameOf("catalog:react18"), O.some("react18"));
		assert.deepStrictEqual(DependencySpecifier.catalogNameOf("catalog:build"), O.some("build"));
	});

	it("is None for the default catalog — bare and whitespace-only", () => {
		assert.isTrue(O.isNone(DependencySpecifier.catalogNameOf("catalog:")));
		assert.isTrue(O.isNone(DependencySpecifier.catalogNameOf("catalog:  ")));
	});

	it("is None for non-catalog input (only meaningful when isCatalog is true)", () => {
		assert.isTrue(O.isNone(DependencySpecifier.catalogNameOf("workspace:*")));
		assert.isTrue(O.isNone(DependencySpecifier.catalogNameOf("^1.0.0")));
		assert.isTrue(O.isNone(DependencySpecifier.catalogNameOf("")));
	});

	it.effect("agrees with FromString's CatalogSpecifier classification (one extraction, not two)", () =>
		Effect.gen(function* () {
			const decode = S.decodeUnknownEffect(DependencySpecifier.FromString);
			for (const specifier of ["catalog:", "catalog:react18"]) {
				const classified = yield* decode(specifier);
				assert.instanceOf(classified, CatalogSpecifier, specifier);
				assert.isTrue(isCatalogSpecifier(classified));
				assert.deepStrictEqual(
					classified.name,
					DependencySpecifier.catalogNameOf(specifier),
					specifier,
				);
			}
		}),
	);
});

describe("DependencySpecifier.resolveWorkspace", () => {
	it("projects the range modifiers against a concrete version", () => {
		assert.strictEqual(DependencySpecifier.resolveWorkspace("workspace:*", "1.2.3"), "1.2.3");
		assert.strictEqual(DependencySpecifier.resolveWorkspace("workspace:", "1.2.3"), "1.2.3");
		assert.strictEqual(DependencySpecifier.resolveWorkspace("workspace:^", "1.2.3"), "^1.2.3");
		assert.strictEqual(DependencySpecifier.resolveWorkspace("workspace:~", "1.2.3"), "~1.2.3");
	});

	it("passes a pinned range through unchanged", () => {
		assert.strictEqual(DependencySpecifier.resolveWorkspace("workspace:1.0.0", "1.2.3"), "1.0.0");
		assert.strictEqual(DependencySpecifier.resolveWorkspace("workspace:^2.0.0", "1.2.3"), "^2.0.0");
	});

	// pnpm publish semantics for the alias form: `"bar": "workspace:foo@*"`
	// publishes as `"bar": "npm:foo@1.5.0"` — the range modifier projects
	// against the TARGET package's version exactly like the plain form.
	it("projects an alias form (workspace:pkg@…) to pnpm's npm: publish alias", () => {
		assert.strictEqual(DependencySpecifier.resolveWorkspace("workspace:foo@*", "1.2.3"), "npm:foo@1.2.3");
		assert.strictEqual(DependencySpecifier.resolveWorkspace("workspace:foo@^", "1.2.3"), "npm:foo@^1.2.3");
		assert.strictEqual(DependencySpecifier.resolveWorkspace("workspace:foo@~", "1.2.3"), "npm:foo@~1.2.3");
		assert.strictEqual(DependencySpecifier.resolveWorkspace("workspace:foo@2.0.0", "1.2.3"), "npm:foo@2.0.0");
	});

	it("splits a scoped alias at the LAST @, keeping the scope's leading @", () => {
		assert.strictEqual(DependencySpecifier.resolveWorkspace("workspace:@scope/foo@*", "1.2.3"), "npm:@scope/foo@1.2.3");
		assert.strictEqual(
			DependencySpecifier.resolveWorkspace("workspace:@scope/foo@^", "1.2.3"),
			"npm:@scope/foo@^1.2.3",
		);
		assert.strictEqual(
			DependencySpecifier.resolveWorkspace("workspace:@scope/foo@^1.0.0", "1.2.3"),
			"npm:@scope/foo@^1.0.0",
		);
	});

	it("returns non-workspace input unchanged", () => {
		assert.strictEqual(DependencySpecifier.resolveWorkspace("^1.0.0", "1.2.3"), "^1.0.0");
		assert.strictEqual(DependencySpecifier.resolveWorkspace("catalog:", "1.2.3"), "catalog:");
	});
});

describe("DependencySpecifier.workspaceTargetOf", () => {
	it("extracts the target package name of an alias form", () => {
		assert.deepStrictEqual(DependencySpecifier.workspaceTargetOf("workspace:foo@*"), O.some("foo"));
		assert.deepStrictEqual(DependencySpecifier.workspaceTargetOf("workspace:foo@^1.0.0"), O.some("foo"));
		assert.deepStrictEqual(DependencySpecifier.workspaceTargetOf("workspace:@scope/foo@~"), O.some("@scope/foo"));
	});

	it("is None for the plain form and for non-workspace input", () => {
		assert.deepStrictEqual(DependencySpecifier.workspaceTargetOf("workspace:*"), O.none());
		assert.deepStrictEqual(DependencySpecifier.workspaceTargetOf("workspace:^1.0.0"), O.none());
		// A lone scoped name has its only `@` at index 0 — not the alias form.
		assert.deepStrictEqual(DependencySpecifier.workspaceTargetOf("workspace:@scope/foo"), O.none());
		assert.deepStrictEqual(DependencySpecifier.workspaceTargetOf("^1.0.0"), O.none());
		assert.deepStrictEqual(DependencySpecifier.workspaceTargetOf("catalog:"), O.none());
	});
});

describe("WorkspaceSpecifier#resolve", () => {
	it.effect("applies the same projection to the decoded range", () =>
		Effect.gen(function* () {
			const decode = S.decodeUnknownEffect(DependencySpecifier.FromString);
			const cases: ReadonlyArray<[string, string]> = [
				["workspace:*", "1.2.3"],
				["workspace:^", "^1.2.3"],
				["workspace:~", "~1.2.3"],
				["workspace:2.0.0", "2.0.0"],
				["workspace:foo@*", "npm:foo@1.2.3"],
				["workspace:@scope/foo@^", "npm:@scope/foo@^1.2.3"],
			];
			for (const [specifier, expected] of cases) {
				const classified = yield* decode(specifier);
				assert.instanceOf(classified, WorkspaceSpecifier, specifier);
				assert.isTrue(isWorkspaceSpecifier(classified));
				assert.strictEqual(classified.resolve("1.2.3"), expected, specifier);
				// The static and the instance method share one projection.
				assert.strictEqual(DependencySpecifier.resolveWorkspace(specifier, "1.2.3"), expected, specifier);
			}
		}),
	);
});

describe("DependencySpecifier.decode", () => {
	it.effect("returns the branded value for a valid specifier", () =>
		Effect.gen(function* () {
			assert.strictEqual(yield* DependencySpecifier.decode("^1.0.0"), "^1.0.0");
		}),
	);

	it.effect("fails with InvalidDependencySpecifierError for an empty string", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(DependencySpecifier.decode(""));
			assert.instanceOf(error, InvalidDependencySpecifierError);
			assert.strictEqual(error._tag, "InvalidDependencySpecifierError");
			assert.strictEqual(error.input, "");
		}),
	);
});

describe("DependencySpecifier.FromString", () => {
	it.effect("classifies each case and preserves the raw string", () =>
		Effect.gen(function* () {
			const decode = S.decodeUnknownEffect(DependencySpecifier.FromString);

			const defaultCatalog = yield* decode("catalog:");
			assert.instanceOf(defaultCatalog, CatalogSpecifier);
			assert.isTrue(isCatalogSpecifier(defaultCatalog));
			assert.strictEqual(defaultCatalog._tag, "catalog");
			assert.isTrue(O.isNone(defaultCatalog.name));
			assert.strictEqual(defaultCatalog.raw, "catalog:");

			const namedCatalog = yield* decode("catalog:react18");
			assert.isTrue(isCatalogSpecifier(namedCatalog));
			if (!isCatalogSpecifier(namedCatalog)) assert.fail("expected a CatalogSpecifier");
			assert.deepStrictEqual(namedCatalog.name, O.some("react18"));

			const ws = yield* decode("workspace:^1.2.3");
			assert.instanceOf(ws, WorkspaceSpecifier);
			assert.isTrue(isWorkspaceSpecifier(ws));
			assert.strictEqual(ws.range, "^1.2.3");

			const range = yield* decode("^1.0.0");
			assert.instanceOf(range, RangeSpecifier);

			const bareVersion = yield* decode("1.2.3");
			assert.instanceOf(bareVersion, RangeSpecifier);

			const tag = yield* decode("latest");
			assert.instanceOf(tag, DistTagSpecifier);

			for (const rawForm of [
				"file:../x",
				"link:../x",
				"portal:../pkg",
				"npm:lodash@^4",
				"git+https://github.com/u/r.git",
				"https://x.com/a.tgz",
			]) {
				const raw = yield* decode(rawForm);
				assert.instanceOf(raw, RawSpecifier, rawForm);
				assert.strictEqual(raw.raw, rawForm);
			}
		}),
	);

	it.effect("fails decoding an invalid specifier", () =>
		Effect.gen(function* () {
			for (const bad of ["", "!!garbage", "patch:lodash"]) {
				const error = yield* Effect.flip(S.decodeEffect(DependencySpecifier.FromString)(bad));
				assert.strictEqual(error._tag, "SchemaError", bad);
			}
		}),
	);

	it.effect.prop(
		"encode(decode(s)) === s for every recognized specifier (byte-for-byte round-trip)",
		[
			S.Literals([
				"catalog:",
				"catalog:react18",
				"workspace:*",
				"workspace:^1.2.3",
				"workspace:foo@*",
				"^1.0.0",
				"1.2.3",
				">=1.0.0 <2.0.0",
				"1.x",
				"latest",
				"next",
				"file:../local-pkg",
				"link:../x",
				"portal:../x",
				"npm:lodash@^4.0.0",
				"git+https://github.com/user/repo.git",
				"github:u/r",
				"https://example.com/pkg.tgz",
			]),
		],
		([specifier]) =>
			Effect.gen(function* () {
				const decoded = yield* S.decodeEffect(DependencySpecifier.FromString)(specifier);
				const encoded = yield* S.encodeUnknownEffect(DependencySpecifier.FromString)(decoded);
				assert.strictEqual(encoded, specifier);
			}),
	);
});
