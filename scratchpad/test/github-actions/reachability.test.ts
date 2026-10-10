// @effect-diagnostics nodeBuiltinImport:skip-file
// The Azure confinement invariant, as a test rather than a promise.
//
// `@azure/storage-blob` is the only heavy dependency this package has, and the
// requirement is structural: a consumer that imports only `ActionOutputs` — a
// module that writes `::set-output::` to a file — must be unable to link a blob
// storage client. Three modules may import it (`ActionCache`, `Artifact` and
// `BlobStore.githubCache`, because the Actions-cache Twirp protocol hands back
// an Azure url), and nothing else may.
//
// So the claim is checked by walking the RUNTIME import graph of `src`. `import
// type` is skipped because it is erased. What this does not prove is that a
// downstream bundler drops an unreferenced module; that rests on
// `"sideEffects": false` (asserted below) plus the module-per-file output the
// builder emits. What it does prove is the part we control: no edge exists.

import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assert, describe, it } from "@effect/vitest";
import * as S from "effect/Schema";
import * as Result from "effect/Result";

const SideEffectsManifestJson = S.fromJsonString(S.Struct({ sideEffects: S.optionalKey(S.Unknown) }));
const DependenciesManifestJson = S.fromJsonString(S.Struct({
	dependencies: S.optionalKey(S.Record(S.String, S.String)),
	peerDependencies: S.optionalKey(S.Record(S.String, S.String)),
}));

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "effected", "github-actions");

/** Every runtime import/export specifier and literal builtin load, ignoring type-only imports. */
const runtimeSpecifiers = (source: string): ReadonlyArray<string> => {
	// Doc comments carry `@example` blocks with real import statements in them,
	// so comments come out first or the walker "finds" edges that exist only in
	// prose.
	//
	// LINE comments must go FIRST, and the ordering is load-bearing rather than
	// stylistic: prose containing a token like `@azure/*` opens a block comment
	// as far as a regex is concerned, so stripping blocks first deletes
	// everything from that word to the end of the next doc comment — imports
	// included — and reports a module that imports Azure as importing nothing.
	// It fails SILENTLY in the safe direction, which for a confinement test is
	// the worst direction there is.
	const code = source.replace(/(^|\n)\s*\/\/.*/g, "$1").replace(/\/\*[\s\S]*?\*\//g, "");
	const pattern = /(?:^|\n)\s*(?:import|export)\b([^;]*?)\bfrom\s*["']([^"']+)["']/g;
	const specifiers: Array<string> = [];
	for (const match of code.matchAll(pattern)) {
		const clause = match[1] ?? "";
		const specifier = match[2];
		if (specifier === undefined) continue;
		if (/^\s*type\b/.test(clause)) continue;
		specifiers.push(specifier);
	}
	const builtinPattern = /\bprocess\s*\.\s*getBuiltinModule\s*\(\s*["'](node:[^"']+)["']\s*\)/g;
	for (const match of code.matchAll(builtinPattern)) {
		const specifier = match[1];
		if (specifier !== undefined) specifiers.push(specifier);
	}
	return specifiers;
};

/** Runtime edges reachable from `entry`, stopping at lab sibling-module boundaries. */
const reachableRuntimeImports = (entry: string): ReadonlySet<string> => {
	const seen = new Set<string>();
	const bare = new Set<string>();
	const queue = [resolve(SRC, entry)];
	while (queue.length > 0) {
		const file = queue.pop();
		if (file === undefined || seen.has(file)) continue;
		seen.add(file);
		for (const specifier of runtimeSpecifiers(readFileSync(file, "utf8"))) {
			if (specifier.startsWith(".")) {
				const target = resolve(dirname(file), specifier.replace(/\.js$/, ".ts"));
				const labRelative = relative(SRC, target);
				if (labRelative.startsWith("../")) {
					// Upstream stopped at bare @effected/* edges. The lab represents
					// those same module boundaries with relative sibling entrypoints.
					bare.add(labRelative);
				} else {
					queue.push(target);
				}
			} else {
				bare.add(specifier);
			}
		}
	}
	return bare;
};

const reachesAzure = (entry: string): boolean =>
	[...reachableRuntimeImports(entry)].some((specifier) => specifier.startsWith("@azure/"));

/** The three modules the confinement rule permits, and only these three. */
const AZURE_MODULES = ["ActionCache.ts", "Artifact.ts", "BlobStore.githubCache.ts"];

/** Everything else a consumer can name. */
const LIGHT_MODULES = [
	"Action.ts",
	"ActionEnvironment.ts",
	"ActionInput.ts",
	"ActionLogger.ts",
	"ActionOutputs.ts",
	"ActionState.ts",
	"BlobEnvelope.ts",
	"BlobStore.ts",
	"BlobTransfer.ts",
	"CacheKey.ts",
	"ChildEnv.ts",
	"CheckDocument.ts",
	"CheckState.ts",
	"GitHubMarkdown.ts",
	"GitHubToken.ts",
	"ManagedDocument.ts",
	"ActionsIdentityToken.ts",
	"ActionsProvenance.ts",
	"DetachedProcess.ts",
	"DryRun.ts",
	"OidcTokenIssuer.ts",
	"PackageManagerInstaller.ts",
	"Secret.ts",
	"ToolInstaller.ts",
	"internal/actionsResults.ts",
	"internal/archiveCommands.ts",
	"internal/cacheService.ts",
	"internal/digest.ts",
	"internal/fsProbe.ts",
	"internal/jwt.ts",
	"internal/runner.ts",
	"internal/runnerFile.ts",
	"internal/sigv4.ts",
	"internal/spawn.ts",
	"internal/twirp.ts",
	"internal/unstubbed.ts",
];

describe("bundle reachability", () => {
	it("the three permitted modules DO reach @azure/storage-blob", () => {
		// The control. Without it every assertion below could pass because the
		// walker is broken rather than because the edge is absent — the classic
		// test that cannot fail.
		for (const entry of AZURE_MODULES) {
			assert.isTrue(reachesAzure(entry), `${entry} does not reach Azure — the walker is blind`);
		}
	});

	it("no other module reaches @azure/storage-blob", () => {
		for (const entry of LIGHT_MODULES) {
			assert.isFalse(reachesAzure(entry), `${entry} reaches @azure/storage-blob — the confinement has leaked`);
		}
	});

	it("the comment stripper removes prose and keeps code", () => {
		// The stripper is load-bearing the moment the scan depends on it, and a
		// blinded scan is a silent false green — so it gets its own discriminating
		// test rather than being trusted.
		const source = [
			'// import { BlockBlobClient } from "@azure/storage-blob";',
			"/**",
			" * A doc comment whose @example imports the client:",
			' * import { BlobClient } from "@azure/storage-blob";',
			" */",
			'import { Effect } from "effect";',
			'export { thing } from "./thing.ts";',
		].join("\n");
		assert.deepStrictEqual([...runtimeSpecifiers(source)], ["effect", "./thing.ts"]);
	});

	it("the stripper survives prose that opens a block comment", () => {
		// `@azure/*` in prose is a `/*` to a regex. Stripping blocks BEFORE lines
		// eats the real import that follows and reports nothing at all.
		const source = ["// Confined to @azure/* and nothing else.", 'import { Effect } from "effect";'].join("\n");
		assert.deepStrictEqual([...runtimeSpecifiers(source)], ["effect"]);
	});

	it("the light half reaches only effect and the kit packages it derives from", () => {
		// Exact edge sets, so a stray value import fails here rather than in a
		// consumer's bundle — and so a stripper that blinded the walker shows up as
		// an empty set rather than as a pass.
		assert.deepStrictEqual([...reachableRuntimeImports("ActionOutputs.ts")].sort(), [
			"../github-commands/index.ts",
			"@beep/identity/packages",
			"@beep/utils/Option",
			"effect/Console",
			"effect/Context",
			"effect/Effect",
			"effect/FileSystem",
			"effect/Layer",
			"effect/Option",
			"effect/Record",
			"effect/Schema",
		]);
		assert.deepStrictEqual([...reachableRuntimeImports("BlobEnvelope.ts")].sort(), [
			"@beep/identity/packages",
			"effect/Result",
			"effect/Schema",
		]);
		// `node:crypto` is the sanctioned import, and it is here because core
		// `Crypto` is RNG-only at beta.101 — no digest, no HMAC.
		// `@effected/walker` is the file walker under `matchingFiles`; its own
		// graph is `effect` and `@effected/glob`, both already here.
		assert.deepStrictEqual([...reachableRuntimeImports("CacheKey.ts")].sort(), [
			"../glob/index.ts",
			"../walker/index.ts",
			"@beep/identity/packages",
			"effect/Array",
			"effect/Effect",
			"effect/FileSystem",
			"effect/Function",
			"effect/HashSet",
			"effect/MutableHashSet",
			"effect/Option",
			"effect/Order",
			"effect/Path",
			"effect/Schema",
			"effect/Stream",
			"effect/String",
			"effect/encoding/Hex",
			"node:crypto",
		]);
		assert.deepStrictEqual([...reachableRuntimeImports("BlobStore.ts")].sort(), [
			"../github-commands/index.ts",
			"@beep/identity/packages",
			"@beep/utils/Option",
			"effect/Array",
			"effect/Config",
			"effect/Console",
			"effect/Context",
			"effect/DateTime",
			"effect/Effect",
			"effect/FileSystem",
			"effect/Function",
			"effect/Layer",
			"effect/Match",
			"effect/MutableHashMap",
			"effect/Option",
			"effect/Order",
			"effect/Record",
			"effect/Redacted",
			"effect/Result",
			"effect/Schema",
			"effect/Stream",
			"effect/String",
			"effect/encoding/Hex",
			"effect/http",
			"node:crypto",
		]);
		// The workflow-command protocol is not in this package any more: it lives in the pure
		// `@effected/github-commands` (which imports nothing, not even `effect`), and this package takes it as a peer. The
		// modules that write commands reach it as one bare import and nothing else.
		assert.deepStrictEqual(
			[...reachableRuntimeImports("ActionLogger.ts")].filter((name) => name.startsWith("../")),
			["../github-commands/index.ts"],
		);
		// The lab child-env helper uses Effect Record to build core's CommandOptions value.
		assert.deepStrictEqual([...reachableRuntimeImports("ChildEnv.ts")], ["effect/Record"]);
		// The default runtime does NOT reach Azure, and that is the reason the
		// cache, artifact and blob services are left out of it: folding them in
		// would put a blob-storage client in the bundle of every action that
		// merely sets an output.
		assert.deepStrictEqual([...reachableRuntimeImports("Action.ts")].sort(), [
			"../github-commands/index.ts",
			"@beep/identity/packages",
			"@beep/utils/Option",
			"@effect/platform-node",
			"effect/Array",
			"effect/Cause",
			"effect/Config",
			"effect/ConfigProvider",
			"effect/Console",
			"effect/Context",
			"effect/Effect",
			"effect/Exit",
			"effect/FileSystem",
			"effect/HashSet",
			"effect/Inspectable",
			"effect/Layer",
			"effect/LogLevel",
			"effect/Logger",
			"effect/Match",
			"effect/MutableHashMap",
			"effect/Option",
			"effect/Predicate",
			"effect/Record",
			"effect/References",
			"effect/Result",
			"effect/Schema",
			"effect/SchemaIssue",
			"effect/http",
		]);
	});

	it("the markdown engine is confined to the writer, on Azure's terms", () => {
		// `@effected/markdown` is the second-heaviest engine this package can
		// reach, and only the fluent writer earns it. The control comes first:
		// a blinded walker must fail here, not pass everything below.
		assert.isTrue(
			[...reachableRuntimeImports("GitHubMarkdown.ts")].includes("../markdown/index.ts"),
			"GitHubMarkdown does not reach the engine — the walker is blind",
		);
		for (const entry of LIGHT_MODULES.filter((module) => module !== "GitHubMarkdown.ts")) {
			assert.isFalse(
				[...reachableRuntimeImports(entry)].includes("../markdown/index.ts"),
				`${entry} reaches @effected/markdown — the writer confinement has leaked`,
			);
		}
		// Exact edge sets for the new modules, same discipline as the light half:
		// the vocabulary reaches nothing but effect (in particular NOT
		// `@effected/github`, whose conclusion set it mirrors structurally), and
		// the document modules reach the templates region engine and no more.
		assert.deepStrictEqual([...reachableRuntimeImports("CheckState.ts")].sort(), [
			"@beep/identity/packages",
			"@beep/schema/LiteralKit",
			"effect/Match",
			"effect/Schema",
		]);
		assert.deepStrictEqual([...reachableRuntimeImports("ManagedDocument.ts")].sort(), [
			"../templates/index.ts",
			"@beep/identity/packages",
			"@beep/utils/Option",
			"effect/Effect",
			"effect/Result",
			"effect/Schema",
			"effect/String",
		]);
		assert.deepStrictEqual([...reachableRuntimeImports("CheckDocument.ts")].sort(), [
			"../templates/index.ts",
			"@beep/identity/packages",
			"@beep/schema/LiteralKit",
			"@beep/utils/Option",
			"effect/Array",
			"effect/BigInt",
			"effect/Clock",
			"effect/Context",
			"effect/DateTime",
			"effect/Duration",
			"effect/Effect",
			"effect/HashMap",
			"effect/Latch",
			"effect/Layer",
			"effect/Match",
			"effect/Number",
			"effect/Option",
			"effect/Predicate",
			"effect/Ref",
			"effect/Result",
			"effect/Schema",
			"effect/Semaphore",
			"effect/String",
		]);
		assert.deepStrictEqual([...reachableRuntimeImports("GitHubMarkdown.ts")].sort(), [
			"../markdown/index.ts",
			"effect/Array",
			"effect/Function",
			"effect/Predicate",
			"effect/Record",
			"effect/Result",
			"effect/Schema",
			"effect/SchemaAST",
		]);
	});

	it("the @effected/npm edge is confined to the installer, on Azure's terms", () => {
		// `PackageManagerInstaller` consumes `@effected/npm`'s pin vocabulary and
		// is the ONLY module allowed to: the edge exists for one service a
		// consumer takes with one explicit layer line, and it must not ride into
		// the runtime or any light module's graph. The control comes first, so a
		// blinded walker fails here rather than passing everything below.
		assert.isTrue(
			[...reachableRuntimeImports("PackageManagerInstaller.ts")].includes("../npm/index.ts"),
			"PackageManagerInstaller does not reach @effected/npm — the walker is blind",
		);
		for (const entry of LIGHT_MODULES.filter((module) => module !== "PackageManagerInstaller.ts")) {
			assert.isFalse(
				[...reachableRuntimeImports(entry)].includes("../npm/index.ts"),
				`${entry} reaches @effected/npm — the installer confinement has leaked`,
			);
		}
		// The exact edge set: the pin vocabulary, effect, ToolInstaller's HTTP and
		// subprocess contracts, and the sanctioned node:crypto digest. In
		// particular the DEFAULT RUNTIME stays clear: `Action.ts`'s exact edge set
		// above is what pins `ActionRuntime.layer` never linking this module.
		assert.deepStrictEqual([...reachableRuntimeImports("PackageManagerInstaller.ts")].sort(), [
			"../npm/index.ts",
			"@beep/identity/packages",
			"@beep/utils/Option",
			"effect/Config",
			"effect/ConfigProvider",
			"effect/Context",
			"effect/Effect",
			"effect/FileSystem",
			"effect/Function",
			"effect/HashSet",
			"effect/Layer",
			"effect/Match",
			"effect/Option",
			"effect/Path",
			"effect/Predicate",
			"effect/Record",
			"effect/Result",
			"effect/Schedule",
			"effect/Schema",
			"effect/Stream",
			"effect/String",
			"effect/encoding/Base64",
			"effect/encoding/Hex",
			"effect/http",
			"effect/process",
			"node:crypto",
		]);
	});

	it("no shared internal helper reaches Azure", () => {
		// This is the specific mechanism the rule exists to prevent: the three
		// heavy modules share a Twirp client and a results-backend reader, and
		// hoisting their fifteen lines of Azure into either one would put the
		// client on the graph of everything that speaks the protocol.
		assert.deepStrictEqual([...reachableRuntimeImports("internal/actionsResults.ts")].sort(), [
			"effect/Effect",
			"effect/Function",
			"effect/Option",
			"effect/Predicate",
			"effect/Redacted",
			"effect/Result",
			"effect/Schema",
			"effect/encoding/Base64Url",
		]);
		assert.deepStrictEqual(
			[...reachableRuntimeImports("internal/twirp.ts")].sort(),
			[
			"@beep/utils/Option",
			"effect/Effect",
			"effect/Function",
			"effect/Predicate",
			"effect/Schedule",
			"effect/http",
		],
			"the Twirp client speaks HTTP and nothing heavier",
		);
		// The cache-entry choreography shared by `ActionCache` and
		// `BlobStore.githubCache` owns the three RPCs and NOT the Azure transfer
		// between them — that is the whole point of it being an internal.
		assert.deepStrictEqual([...reachableRuntimeImports("internal/cacheService.ts")].sort(), [
			"@beep/utils/Option",
			"effect/Effect",
			"effect/Function",
			"effect/Option",
			"effect/Predicate",
			"effect/Schedule",
			"effect/http",
		]);
		// `effect/process` is a type-only import there: the spawner
		// arrives as a value from the caller.
		assert.deepStrictEqual([...reachableRuntimeImports("internal/spawn.ts")].sort(), [
			"effect/Effect",
			"effect/Function",
			"effect/Stream",
		]);
		// The command-line half of every archiver call: `ChildProcess.make` is a
		// VALUE import there, and it is shared by `Artifact` (Azure) and
		// `ToolInstaller` (light) — exactly the kind of helper that must never
		// grow a heavier edge.
		assert.deepStrictEqual([...reachableRuntimeImports("internal/archiveCommands.ts")].sort(), ["effect/process"]);
		assert.deepStrictEqual([...reachableRuntimeImports("internal/digest.ts")].sort(), [
			"effect/Effect",
			"effect/Function",
			"effect/Stream",
			"effect/encoding/Hex",
			"node:crypto",
		]);
		assert.deepStrictEqual([...reachableRuntimeImports("internal/fsProbe.ts")].sort(), ["effect/Effect", "effect/Function", "effect/Predicate"]);
		assert.deepStrictEqual([...reachableRuntimeImports("internal/jwt.ts")].sort(), [
			"effect/Function",
			"effect/Result",
			"effect/Schema",
			"effect/encoding/Base64Url",
		]);
		assert.deepStrictEqual([...reachableRuntimeImports("internal/runner.ts")].sort(), [
			"effect/Effect",
			"effect/Function",
			"effect/Option",
		]);
		assert.deepStrictEqual([...reachableRuntimeImports("internal/runnerFile.ts")], []);
		assert.deepStrictEqual([...reachableRuntimeImports("internal/unstubbed.ts")].sort(), ["@beep/identity/packages", "effect/Effect", "effect/Schema"]);
	});

	it("the entry point reaches Azure, and that is correct", () => {
		// `src/index.ts` re-exports all three heavy modules, so of course it
		// reaches Azure. Asserting otherwise would be asserting the package does
		// not ship a cache. The property that matters is the one above: every light
		// module is reachable WITHOUT it.
		assert.isTrue(reachesAzure("index.ts"));
	});

	it("no module gathers the heavy three into a namespace object", () => {
		// The single easiest way to destroy this property: one
		// `export const Stores = { cache, artifact, blob }` makes every consumer of
		// any of them reachable to Azure, silently. The entry point re-exports
		// free-standing names, and no light module may import a heavy one.
		// Deliberately RAW source, not the stripped `code` the walker uses, and
		// that is safe in the direction that matters: this is a `notInclude`, so
		// a specifier appearing only in a comment fails the test — a spurious
		// ALARM, never a silent pass. Over-strict is the correct bias for a
		// confinement check.
		//
		// It sees only DIRECT imports, so a two-hop leak (light → mid → heavy)
		// would slip past it. That case is covered by the transitive
		// `assert.isFalse(reachesAzure(entry))` over the same LIGHT_MODULES
		// above — do not delete that test on the assumption this one subsumes it.
		for (const entry of LIGHT_MODULES) {
			const source = readFileSync(resolve(SRC, entry), "utf8");
			for (const heavy of ["./ActionCache.ts", "./Artifact.ts", "./BlobStore.githubCache.ts"]) {
				assert.notInclude(source, heavy, `${entry} imports ${heavy}`);
			}
		}
	});

	it("the package declares itself side-effect free", () => {
		// The other half of the mechanism: without this a bundler must assume
		// evaluating an unreferenced module matters, and keeps it.
		const manifest = Result.getOrThrowWith(
			S.decodeResult(SideEffectsManifestJson)(
				readFileSync(resolve(SRC, "package.json"), "utf8"),
			),
			(error) => error,
		);
		assert.strictEqual(manifest.sideEffects, false);
	});

	it("every runtime dependency is declared", () => {
		// A package you import but do not declare is how a peer closure rots.
		const manifest = Result.getOrThrowWith(
			S.decodeResult(DependenciesManifestJson)(readFileSync(resolve(SRC, "package.json"), "utf8")),
			(error) => error,
		);
		const declared = new Set([
			...Object.keys(manifest.dependencies ?? {}),
			...Object.keys(manifest.peerDependencies ?? {}),
		]);
		for (const specifier of reachableRuntimeImports("index.ts")) {
			if (specifier.startsWith("node:")) continue;
			const packageName = specifier.startsWith("../")
				? `@effected/${specifier.split("/")[1]}`
				: specifier.startsWith("@")
				? specifier.split("/").slice(0, 2).join("/")
				: specifier.split("/")[0];
			assert.isTrue(declared.has(packageName ?? specifier), `${specifier} is imported but not declared`);
		}
	});
});
