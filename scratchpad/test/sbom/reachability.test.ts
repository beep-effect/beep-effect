// @effect-diagnostics nodeBuiltinImport:skip-file
// The confinement invariant, as a test rather than a promise.
//
// This package is two independent capabilities in one: emitting an SBOM is pure
// computation over a manifest, and signing is network-bound cryptography
// against Fulcio and Rekor. A consumer that only wants an SBOM must not pull
// the Sigstore stack into its bundle — the failure the package this replaces
// shipped, where one consumer carried an eleven-line bundler ignore list for
// XML libraries it never invoked.
//
// So the claim is checked structurally, by walking the RUNTIME import graph of
// `src`. `import type` is skipped because it is erased. What this does not
// prove is that a downstream bundler drops an unreferenced module; that rests
// on `"sideEffects": false` (asserted below) plus the module-per-file output
// the builder emits. What it does prove is the part we control: no edge exists.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as S from "effect/Schema";
import * as Ts from "typescript";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "effected", "sbom");

const Manifest = S.Struct({
	sideEffects: S.optionalKey(S.Unknown),
	dependencies: S.optionalKey(S.Record(S.String, S.String)),
	peerDependencies: S.optionalKey(S.Record(S.String, S.String)),
});

/** Every runtime import or re-export, ignoring prose, string contents and type-only edges. */
const runtimeSpecifiers = (source: string): ReadonlyArray<string> => {
	// Vendored siblings expose a larger graph than upstream's bare package edges.
	// Parse declarations so an exported class's error message containing `from`
	// cannot become a phantom dependency, and comment tokens cannot hide imports.
	const file = Ts.createSourceFile("reachability.ts", source, Ts.ScriptTarget.Latest, true, Ts.ScriptKind.TS);
	const specifiers: Array<string> = [];
	for (const statement of file.statements) {
		if (!Ts.isImportDeclaration(statement) && !Ts.isExportDeclaration(statement)) continue;
		const specifier = statement.moduleSpecifier;
		if (specifier === undefined || !Ts.isStringLiteral(specifier)) continue;
		if (Ts.isImportDeclaration(statement)) {
			if (statement.importClause?.isTypeOnly === true) continue;
		} else {
			if (statement.isTypeOnly) continue;
		}
		specifiers.push(specifier.text);
	}
	return specifiers;
};

/** Runtime files and bare specifiers, including the lab's vendored sibling modules. */
const reachableImports = (entry: string): { readonly files: ReadonlySet<string>; readonly bare: ReadonlySet<string> } => {
	const seen = new Set<string>();
	const bare = new Set<string>();
	const queue = [resolve(SRC, entry)];
	while (queue.length > 0) {
		const file = queue.pop();
		if (file === undefined || seen.has(file)) continue;
		seen.add(file);
		for (const specifier of runtimeSpecifiers(readFileSync(file, "utf8"))) {
			if (specifier.startsWith(".")) {
				queue.push(resolve(dirname(file), specifier.replace(/\.js$/, ".ts")));
			} else {
				bare.add(specifier);
			}
		}
	}
	return { files: seen, bare };
};

/** Every bare (non-relative) specifier reachable at runtime from `entry`. */
const reachableBareImports = (entry: string): ReadonlySet<string> => reachableImports(entry).bare;

const reachesSigstore = (entry: string): boolean =>
	[...reachableBareImports(entry)].some((specifier) => specifier.startsWith("@sigstore/"));

/** Everything a consumer can reach without ever naming the signer. */
const PURE_MODULES = [
	"SbomDocument.ts",
	"Sbom.ts",
	"SbomMetadataSource.ts",
	"NtiaReport.ts",
	"InTotoStatement.ts",
	"SlsaProvenance.ts",
	"SigstoreBundle.ts",
	"IdentityToken.ts",
];

describe("bundle reachability", () => {
	it("the walker does not lose imports after a /*-bearing token in prose", () => {
		// The stripper's own regression test, self-contained rather than relying on
		// the real sources. Every other assertion here happens to discriminate only
		// because this package's prose contains `@sigstore/*` in a line comment;
		// reword those comments and the ordering bug becomes undetectable again,
		// with the suite still green. This fixture cannot be reworded away.
		//
		// The token must sit in a LINE comment. Inside a block comment a `/*` is
		// swallowed by its own container and cannot open anything, so a
		// block-comment fixture passes with or without the fix — a fixture that
		// proves nothing, which is the trap this test exists to avoid.
		const fixture = [
			"// Prose naming a scope like @sigstore/* and a glob like src/* here.",
			'import { Schema } from "effect";',
			"/** A real doc comment, whose close is the phantom comment's close. */",
			'import { License } from "../../effected/spdx/index.ts";',
			"export const x = [Schema, License];",
			"export class ReadError {",
			'  message = `Failed to read package.json from "${this.path}"`;',
			"}",
			'import type { Package } from "@effected/package-json";',
			'export type { Person } from "@effected/package-json";',
		].join("\n");
		assert.deepStrictEqual([...runtimeSpecifiers(fixture)], ["effect", "../../effected/spdx/index.ts"]);
	});

	it("the signer DOES reach @sigstore/*", () => {
		// The control. Without it, every assertion below could pass because the
		// walker is broken rather than because the edge is absent — the classic
		// test that cannot fail.
		assert.isTrue(reachesSigstore("SigstoreSigner.ts"));
	});

	it("no pure module reaches @sigstore/*", () => {
		for (const entry of PURE_MODULES) {
			assert.isFalse(reachesSigstore(entry), `${entry} reaches @sigstore/* — the signer's dependency has leaked`);
		}
	});

	it("the bundle VALUE is reachable without the signer", () => {
		// `SigstoreBundle` and `IdentityToken` are their own modules precisely so a
		// verifier — or anything that merely stores or forwards a bundle — can name
		// the shape without loading Fulcio's transport.
		assert.deepStrictEqual([...reachableBareImports("SigstoreBundle.ts")].sort(), ["@beep/identity/packages", "effect/Schema"]);
		assert.deepStrictEqual([...reachableBareImports("IdentityToken.ts")].sort(), [
			"@beep/identity/packages", "effect/Context", "effect/Effect", "effect/Layer", "effect/Predicate", "effect/Redacted", "effect/Schema",
		]);
	});

	it("the SBOM half reaches only effect and the kit packages it derives from", () => {
		// D9: upstream's bare @effected/spdx edge is a relative edge in the lab.
		// Check that sibling explicitly, alongside the complete external closure.
		for (const entry of ["Sbom.ts", "SbomMetadataSource.ts"]) {
			const { files } = reachableImports(entry);
			assert.isTrue(files.has(resolve(SRC, "..", "spdx", "index.ts")), `${entry} derives from the lab SPDX module`);
			assert.isFalse(
				files.has(resolve(SRC, "..", "package-json", "index.ts")),
				`${entry} must not drag package-json's runtime IO in`,
			);
		}
		assert.deepStrictEqual([...reachableBareImports("Sbom.ts")].sort(), [
			"@beep/identity/packages", "@beep/schema/LiteralKit", "effect/Array", "effect/Effect", "effect/FileSystem",
			"effect/Function", "effect/HashMap", "effect/HashSet", "effect/Match", "effect/MutableHashSet", "effect/Option",
			"effect/Order", "effect/Record", "effect/Result", "effect/Schema", "effect/SchemaIssue",
			"effect/SchemaTransformation", "effect/String",
		]);
		assert.deepStrictEqual(
			[...reachableBareImports("SbomMetadataSource.ts")].sort(),
			[
				"@beep/identity/packages", "@beep/schema/LiteralKit", "effect/Array", "effect/Effect", "effect/HashMap",
				"effect/HashSet", "effect/Match", "effect/MutableHashSet", "effect/Option", "effect/Record", "effect/Result",
				"effect/Schema", "effect/SchemaIssue", "effect/SchemaTransformation",
			],
			"SbomMetadataSource reads `Package` as a TYPE only — a value import would drag package-json's IO in",
		);
	});

	it("the statement and provenance models reach nothing but effect", () => {
		// This is what lets a VERIFIER depend on the shapes alone.
		for (const entry of ["InTotoStatement.ts", "SlsaProvenance.ts", "NtiaReport.ts"]) {
			const expected = entry === "InTotoStatement.ts"
				? ["@beep/identity/packages", "effect/Effect", "effect/Result", "effect/Schema"]
				: entry === "NtiaReport.ts"
					? ["@beep/identity/packages", "@beep/schema/LiteralKit", "effect/Schema", "effect/String"]
					: ["@beep/identity/packages", "effect/Schema"];
			assert.deepStrictEqual([...reachableBareImports(entry)].sort(), expected, entry);
		}
	});

	it("the entry point reaches the signer, and that is correct", () => {
		// `src/index.ts` re-exports `SigstoreSigner`, so of course it reaches
		// Sigstore. Asserting otherwise would be asserting the package does not
		// ship its own signer. The property that matters is the one above: the
		// pure modules are reachable WITHOUT it, so a bundler that sees only
		// `Sbom.generate` can drop the rest.
		assert.isTrue(reachesSigstore("index.ts"));
	});

	it("the package declares itself side-effect free", () => {
		// The other half of the mechanism: without this a bundler must assume
		// evaluating an unreferenced module matters, and keeps it.
		const manifest: unknown = JSON.parse(readFileSync(resolve(SRC, "package.json"), "utf8"));
		assertTrue(S.is(Manifest)(manifest));
		assert.strictEqual(manifest.sideEffects, false);
	});

	it("every runtime dependency is declared", () => {
		// A package you import but do not declare is how a peer closure rots.
		const manifest: unknown = JSON.parse(readFileSync(resolve(SRC, "package.json"), "utf8"));
		assertTrue(S.is(Manifest)(manifest));
		const declared = new Set([
			...Object.keys(manifest.dependencies ?? {}),
			...Object.keys(manifest.peerDependencies ?? {}),
		]);
		for (const specifier of reachableBareImports("index.ts")) {
			// A `node:` builtin is not a package and can never appear in a manifest.
			if (specifier.startsWith("node:")) continue;
			const packageName = specifier.startsWith("@")
				? specifier.split("/").slice(0, 2).join("/")
				: specifier.split("/")[0];
			assert.isTrue(declared.has(packageName ?? specifier), `${specifier} is imported but not declared`);
		}
	});

	it("no module reaches a namespace object that would collapse the split", () => {
		// The single easiest way to destroy this property is a convenience object
		// — `Sbom = { generate, sign }` — which makes every SBOM consumer reachable
		// to Fulcio's HTTP stack silently. The entry point re-exports free-standing
		// names; nothing may re-export the signer from a module a pure consumer
		// imports.
		// Deliberately RAW source, not the stripped `code` the walker uses, and
		// safe in the direction that matters: this is a `notInclude`, so a
		// specifier appearing only in a comment fails the test — a spurious
		// ALARM, never a silent pass. Over-strict is the correct bias here.
		//
		// It sees only DIRECT imports, so a two-hop leak (pure → mid → signer)
		// would slip past. That case is covered by the transitive
		// `reachesSigstore` assertions over the same PURE_MODULES above — do not
		// delete those on the assumption this one subsumes them.
		for (const entry of PURE_MODULES) {
			const source = readFileSync(resolve(SRC, entry), "utf8");
			assert.notInclude(source, "./SigstoreSigner.ts", `${entry} imports the signer module`);
		}
	});
});
