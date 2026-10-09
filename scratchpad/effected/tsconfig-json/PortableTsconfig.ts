// The portable-tsconfig filter — projects a `ResolvedTsconfig` or a
// bare `CompilerOptions.Type` down to the small, machine-independent
// slice of compilerOptions that a virtual TypeScript environment (Twoslash,
// API Extractor, an in-memory language service) can safely reuse: no absolute
// paths, no emit artifacts, no file-selection surface.
//
// This module is already string-level (CompilerOptions decodes TS's numeric
// enums to canonical lowercase strings — see CompilerOptions.ts and
// TsEnumCodec.ts), the
// filter here is exactly three things: a key allow-list, two forced flags,
// and a `$schema` stamp. No enum conversion is needed or performed.
//
// ALLOW-LIST, NOT DENY-LIST: only the keys named below
// ever reach the output. An option this package does not yet know about —
// including every unknown/future passthrough key `CompilerOptions.Type`
// preserves for forward tolerance — is silently dropped here. A portable
// config is deliberately a strict subset of "everything the source config
// said"; growing it is an explicit, reviewed addition to the allow-list
// below, never an accident of "we didn't exclude it."
//
// The allow-list has two tiers. The unconditional one below is safe for every
// consumer. The second is a single opt-in key, `types`, which is portable but
// resolution-dependent — see OPT_IN_TYPES_OPTION for why that distinction
// exists and why it does not default on. (Virtual TypeScript environments lost
// their Node globals when `types` was left unclassified.)

import * as P from "effect/Predicate";
import type { CompilerOptions } from "./CompilerOptions.ts";
import type { ResolvedTsconfig } from "./ResolvedTsconfig.ts";
import * as A from "effect/Array";
import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effected/tsconfig-json/PortableTsconfig");

const TSCONFIG_SCHEMA_URL = "https://json.schemastore.org/tsconfig";

// ── The allow-list ──────────────────────────
//
// Preserved = affects what the type checker accepts/reports, independent of
// any file path or emitted artifact. Excluded = emit destination, absolute/
// machine-specific paths, file selection, build/project-reference
// orchestration, or CLI diagnostics formatting — none of which a virtual
// environment driving its own file set and its own emit (or non-emit) should
// inherit from the source config.
//
// Three groups below are judgment calls: `importHelpers` / `downlevelIteration` /
// `preserveConstEnums` are carried even though they shape emitted JS, because
// a Twoslash-style
// virtual environment can still execute emitted code; `newLine` and
// `maxNodeModuleJsDepth` are excluded despite touching neither path nor emit
// destination, because the former is pure output formatting and the latter is
// an obscure checking-depth tuning knob, not a type-semantics switch a
// portable config needs to travel with.

/**
 * Boolean `compilerOptions` preserved in a {@link (PortableTsconfig:interface)}: the
 * strict family, module/interop semantics, checking-depth and lib controls,
 * and language-feature switches — every one type-checking behavior, none of
 * them naming a path or producing a build artifact.
 */
const PRESERVED_BOOLEAN_OPTIONS = [
	// strict family
	"strict",
	"noImplicitAny",
	"strictNullChecks",
	"strictFunctionTypes",
	"strictBindCallApply",
	"strictPropertyInitialization",
	"strictBuiltinIteratorReturn",
	"noImplicitThis",
	"useUnknownInCatchVariables",
	"alwaysStrict",
	"noUnusedLocals",
	"noUnusedParameters",
	"exactOptionalPropertyTypes",
	"noImplicitReturns",
	"noFallthroughCasesInSwitch",
	"noUncheckedIndexedAccess",
	"noImplicitOverride",
	"noPropertyAccessFromIndexSignature",
	"allowUnusedLabels",
	"allowUnreachableCode",
	"noUncheckedSideEffectImports",
	// module / interop semantics
	"allowJs",
	"checkJs",
	"resolveJsonModule",
	"allowArbitraryExtensions",
	"allowImportingTsExtensions",
	"rewriteRelativeImportExtensions",
	"resolvePackageJsonExports",
	"resolvePackageJsonImports",
	"allowSyntheticDefaultImports",
	"esModuleInterop",
	"preserveSymlinks",
	"allowUmdGlobalAccess",
	"verbatimModuleSyntax",
	"isolatedModules",
	"isolatedDeclarations",
	"erasableSyntaxOnly",
	"forceConsistentCasingInFileNames",
	"useDefineForClassFields",
	// checking-depth / lib controls
	"noLib",
	"skipDefaultLibCheck",
	"skipLibCheck",
	"noCheck",
	// language-feature / decorator semantics
	"experimentalDecorators",
	"emitDecoratorMetadata",
	// carried for virtual-JS-execution environments (judgment call — see above)
	"importHelpers",
	"downlevelIteration",
	"preserveConstEnums",
] as const;

/**
 * Enum-valued `compilerOptions` preserved in a {@link (PortableTsconfig:interface)}: the
 * target/module/moduleResolution/jsx/lib family plus `moduleDetection` and
 * `ignoreDeprecations`. `newLine` is deliberately excluded — pure emit
 * formatting, no bearing on type-checking behavior.
 */
const PRESERVED_ENUM_OPTIONS = [
	"target",
	"module",
	"moduleResolution",
	"jsx",
	"moduleDetection",
	"lib",
	"ignoreDeprecations",
] as const;

/**
 * Plain-string `compilerOptions` preserved in a {@link (PortableTsconfig:interface)}: the
 * jsx factory/namespace family. None of these name a filesystem path.
 */
const PRESERVED_STRING_OPTIONS = ["jsxFactory", "jsxFragmentFactory", "jsxImportSource", "reactNamespace"] as const;

const PRESERVED_OPTIONS: ReadonlyArray<string> = [
	...PRESERVED_BOOLEAN_OPTIONS,
	...PRESERVED_ENUM_OPTIONS,
	...PRESERVED_STRING_OPTIONS,
];

// ── The opt-in tier: portable, but resolution-dependent ────────────────────
//
// `types` is the one classified option that is portable by the criterion above
// — it holds package NAMES, never a path — yet is still not carried by
// default, because portability and *resolvability* are two different axes and
// the allow-list above only models the first. Emitting `types: ["node"]` makes
// tsc DEMAND that `@types/node` be resolvable; in a virtual environment with
// no `node_modules` that is a hard error, where omitting the key lets TS
// auto-include whatever `@types` the environment happens to have and never
// error. Dropping it therefore trades a loud cannot-find-type-definition
// failure for a silent missing-globals one — better for the environment that
// materializes nothing, worse for the one that materializes `@types` and needs
// to know which ones this config's type-checking assumed.
//
// Neither default serves both, so the caller picks: `includeTypes` carries the
// information for consumers that can satisfy it. `typeRoots` stays dropped
// under the opt-in as well — it names filesystem directories, absolute when
// they arrive on a `ResolvedTsconfig` and relative to the source config when
// they arrive on a bare options bag, and meaningful in either form only on the
// machine and at the config location they came from. It fails the portability
// criterion outright, opt-in or not.
const OPT_IN_TYPES_OPTION = "types";

// ── Structural discrimination (ResolvedTsconfig | CompilerOptions.Type) ─────

/**
 * A `ResolvedTsconfig` carries a string `configPath`, an array `extendedPaths`
 * AND an object `compilerOptions`; a bare `CompilerOptions.Type` never carries
 * all three. Every conjunct is required — `CompilerOptions.Type`'s passthrough
 * index signature tolerates any unrecognized key, so a hostile config file can
 * plant a string `configPath` and even an array `extendedPaths` as passthrough
 * keys on a bare options bag (reachable from forward tolerance). The
 * `compilerOptions` conjunct is what makes the discrimination TOTAL: `make`
 * only branches into `input.compilerOptions` when that value is a non-null
 * object it can safely index, so no crafted bag can steer the filter into a
 * `TypeError` at the `source[key]` loop below. (A bag that fakes all three is
 * then read exactly like a `ResolvedTsconfig` — its `compilerOptions` object
 * is filtered, which is the safe outcome.)
 */
const isResolvedTsconfig = (input: ResolvedTsconfig | CompilerOptions.Type): input is ResolvedTsconfig =>
	P.isString(input.configPath) &&
	A.isArray(input.extendedPaths) &&
	P.isObjectOrArray(input.compilerOptions);

// ── The filter ────────────────────────────────────────────────────────────

/**
 * A portable, JSON-serializable tsconfig.json (compilerOptions-only), for
 * virtual TypeScript environments that control their own file paths and emit
 * settings externally. Carries only knowably-portable options: no absolute or
 * machine-specific paths, and no emit or file-selection surface.
 *
 * @public
 */
const PortableTsconfigData = S.Struct({
	/** The tsconfig JSON Schema URL, stamped for IDE support. */
	$schema: S.Literal(TSCONFIG_SCHEMA_URL).annotateKey({ description: "The tsconfig JSON Schema URL." }),
	/** The allow-listed, forced-flag-applied compiler options. */
	compilerOptions: S.Record(S.String, S.Unknown).annotateKey({ description: "Allow-listed options with forced portable flags." }),
}).annotate($I.annote("PortableTsconfig", {
	description: "A portable compiler-options-only tsconfig for virtual TypeScript environments.",
}));

/**
 * Options for {@link (PortableTsconfig:class).make}.
 *
 * @public
 */
export const PortableTsconfigOptions = S.Struct({
	/**
	 * Carry `types` (an array of `@types` package NAMES) onto the portable
	 * shape when the source declares it. Defaults to `false`.
	 *
	 * Opt in when the consuming environment can resolve those packages — it
	 * materializes `@types` into its virtual filesystem, or type-checks against
	 * a real `node_modules`. Leaving it off keeps the permissive default, where
	 * TypeScript auto-includes whatever `@types` the environment happens to
	 * have and never errors on a missing one.
	 *
	 * `typeRoots` is NOT carried under this flag: it names filesystem
	 * directories, which are machine-specific and config-location-dependent,
	 * so they are never portable.
	 */
	includeTypes: S.optionalKey(S.Boolean).annotateKey({ description: "Carry types package names when the consumer can resolve them; defaults to false." }),
}).annotate($I.annote("PortableTsconfigOptions", {
	description: "Opt-ins for resolution-dependent portable compiler options.",
}));

/** The schema-derived portable projection options. @public */
export type PortableTsconfigOptions = typeof PortableTsconfigOptions.Type;

// Implementation of PortableTsconfig.make; the public contract lives on the static.
const make = (
	input: ResolvedTsconfig | CompilerOptions.Type,
	options?: PortableTsconfigOptions & S.MakeOptions,
): PortableTsconfig => {
	const source: Record<string, unknown> = isResolvedTsconfig(input) ? input.compilerOptions : input;
	const compilerOptions: Record<string, unknown> = {};
	for (const key of PRESERVED_OPTIONS) {
		const value = source[key];
		if (value !== undefined) compilerOptions[key] = value;
	}
	if (options?.includeTypes === true) {
		const types = source[OPT_IN_TYPES_OPTION];
		if (types !== undefined) compilerOptions[OPT_IN_TYPES_OPTION] = types;
	}
	compilerOptions.composite = false;
	compilerOptions.noEmit = true;
	return { $schema: TSCONFIG_SCHEMA_URL, compilerOptions };
};

/**
 * The portable-tsconfig filter: {@link (PortableTsconfig:class).make}
 * narrows a resolved or bare compiler-options object to the allow-listed,
 * machine-independent subset described on {@link (PortableTsconfig:interface)}.
 *
 * @public
 */
export class PortableTsconfig extends S.Opaque<PortableTsconfig>()(PortableTsconfigData) {

	/**
	 * Project a {@link (ResolvedTsconfig:interface)} or a bare
	 * `CompilerOptions.Type` down to a {@link (PortableTsconfig:interface)}:
	 * copy only the allow-listed type-semantics options, force
	 * `composite: false` and `noEmit: true` regardless of what the source
	 * declared, and stamp `$schema`. Every other key — including every
	 * unknown passthrough key the source preserved for forward tolerance —
	 * is dropped; this is an allow-list, not a deny-list, so an option this
	 * package does not yet classify never leaks onto the portable shape by
	 * accident.
	 *
	 * `types` is the one deliberate exception, and it is opt-in rather than
	 * unclassified: it is portable (package names, not paths) but carrying it
	 * makes TypeScript demand those packages be resolvable, which a virtual
	 * environment with no `node_modules` cannot satisfy. Pass
	 * {@link PortableTsconfigOptions.includeTypes} when the consumer
	 * materializes `@types`; leave it off for the permissive default. Related
	 * `typeRoots` is never carried — machine-specific,
	 * config-location-dependent directories.
	 *
	 * @param input - The resolved config, or a bare compiler-options bag.
	 * @param options - Opt-ins for options that are portable but
	 * resolution-dependent. Omitted means the strict, always-safe subset.
	 */
	static override readonly make = make;
}
