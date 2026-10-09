import type { DependencyField, IntegrityHashBrand } from "../../npm/index.ts";
import { DependencySpecifier, IntegrityHash } from "../../npm/index.ts";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as HashSet from "effect/HashSet";
import * as MutableHashMap from "effect/MutableHashMap";
import * as S from "effect/Schema";
import { dual } from "effect/Function";
import type { BunExtension } from "../BunExtension.ts";
import { ImporterDependency } from "../ImporterDependency.ts";
import type { LockfileImporter } from "../LockfileImporter.ts";
import type { PnpmExtension } from "../PnpmExtension.ts";
import type { ResolvedPackage } from "../ResolvedPackage.ts";
import type { UnsupportedLockfileVersion } from "../UnsupportedLockfileVersion.ts";
import { WorkspaceDependency } from "../WorkspaceDependency.ts";
import * as A from "effect/Array";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as O from "@beep/utils/Option";

/**
 * The four dependency sections of a manifest, in a stable order — the shared
 * dependency-sections table. Each entry is both the
 * manifest field name to read and the `@effected/npm` `DependencyField` it maps
 * to, since the two coincide. Consumed by `extractWorkspaceDeps` and by the
 * pnpm/bun/npm importer builders.
 *
 * @internal
 */
export const DEP_TYPES = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"] as const;

/**
 * Coerce a raw lockfile integrity string to the `@effected/npm` `IntegrityHash`
 * brand, which recognizes the SRI (`<algo>-<base64>`), corepack (`<algo>.<hex>`)
 * and yarn (`<cachekey>/<hex>`) textual forms.
 *
 * Absence and corruption are treated differently, and the distinction is the
 * point. An *absent* integrity (input `undefined`) succeeds with `undefined`,
 * so the caller omits the field — a lockfile that records no integrity is
 * legitimate. A *present but unparseable* integrity fails through the same
 * validation channel the shape checks use ({@link validationFailure}), so
 * `Lockfile.parse` surfaces it as a `LockfileParseError` with
 * `stage: "validation"` rather than silently dropping a corrupt value. Never a
 * defect. yarn's `10c0/<hex>` cache checksums are a recognized form, so real
 * yarn/npm/pnpm/bun integrity all still parses; only genuine corruption fails.
 *
 * @internal
 */
export const toIntegrityHash = (
	raw: string | undefined,
): Effect.Effect<IntegrityHashBrand | undefined, ParseFailure> => {
	if (raw === undefined) return Effect.as(Effect.void, undefined);
	return S.decodeEffect(IntegrityHash)(raw).pipe(Effect.mapError(validationFailure));
};

const decodeSpecifier = S.decodeUnknownExit(DependencySpecifier.FromString);

/**
 * Split pnpm's peer-disambiguation suffix off a recorded string: the suffix is
 * the maximal TRAILING run of balanced parenthesized groups, found by scanning
 * back from the end, which is `@pnpm/dependency-path`'s own
 * `indexOfDepPathSuffix` rule. Handles both shapes pnpm records — a bare
 * version (`"1.0.0(effect@4.0.0)"`, importer entries) and a `name@version`
 * snapshot key (`"fdir@6.5.0(picomatch@4.0.4)"`) — and nested chains
 * (`"(a@1(b@2))(c@3)"`) as one suffix.
 *
 * pnpm suffixes a `file:` resolution exactly as it suffixes a registry
 * version whenever the package declares peers, directory and tarball alike
 * (`file:vendor/lib(react@18.3.1)`, measured against pnpm 12.6.0), so the rule
 * applies to protocol versions too. The one exception is `link:`, which pnpm
 * never suffixes, even when the target declares peers: a trailing group there
 * is path text and the string passes through untouched.
 *
 * A parenthesis INSIDE a path is followed by more path, so it is never part of
 * the trailing run (`file:vendor/a(b)/c(react@1.0.0)` splits after `c`). A path
 * that itself ENDS in a group is ambiguous, and it is read the way pnpm reads
 * it: pnpm writes `file:vendor/paren(lib)`'s `packages:` key as
 * `parenlib@file:vendor/paren`, so taking the group as suffix is what keeps the
 * snapshot joined to its own metadata. A string that is nothing but groups
 * yields an empty `plain`, and an unbalanced one passes through untouched.
 *
 * This is the single stripping implementation — do not hand-roll a
 * parenthesis split elsewhere.
 *
 * @internal
 */
export const splitPeerSuffix = (raw: string): { readonly plain: string; readonly peerSuffix?: string } => {
	if (raw.startsWith("link:") || !raw.endsWith(")")) return { plain: raw };
	let open = 1;
	for (let i = raw.length - 2; i >= 0; i--) {
		const char = raw[i];
		if (char === "(") open--;
		else if (char === ")") open++;
		else if (open === 0) return { plain: raw.slice(0, i + 1), peerSuffix: raw.slice(i + 1) };
	}
	return open === 0 ? { plain: "", peerSuffix: raw } : { plain: raw };
};

/**
 * Split a `name@version` key at the separator: the first `@` after a scoped
 * name's leading one. A package name holds no other `@`, while the version
 * part may (`file:../@scope/lib`), so the LAST `@` is the wrong boundary.
 * Returns `undefined` for a key with no separator after its first character
 * (`"@"`, `"@scope/"`, a bare name).
 *
 * @internal
 */
export const splitNameVersion = (key: string): { readonly name: string; readonly version: string } | undefined => {
	const at = key.indexOf("@", 1);
	if (at === -1) return undefined;
	return { name: key.slice(0, at), version: key.slice(at + 1) };
};

/**
 * Build one {@link ImporterDependency}, decoding the raw specifier string into
 * the `@effected/npm` `ClassifiedSpecifier` tagged union. Returns `undefined`
 * — a skip, never a throw — when the name is empty or the specifier does not
 * classify (e.g. an empty specifier), per the total-string-surgery discipline.
 *
 * A pnpm-recorded version is normalized through {@link splitPeerSuffix}: the
 * `version` field carries the plain version and the split-off peer chain lands
 * in `peerSuffix`. A version that is *only* a peer chain (empty plain part) is
 * treated as no concrete version — a skip of both fields, never a throw.
 *
 * @internal
 */
const buildImporterDependency = (
	name: string,
	specifier: string,
	depType: DependencyField,
	version: string | undefined,
): ImporterDependency | undefined => {
	if (name === "") return undefined;
	const exit = decodeSpecifier(specifier);
	if (Exit.isFailure(exit)) return undefined;
	const resolved = version !== undefined && version !== "" ? splitPeerSuffix(version) : undefined;
	return ImporterDependency.make({
		name,
		specifier: exit.value,
		depType,
		...(resolved !== undefined && resolved.plain !== ""
			? {
					version: resolved.plain,
					...O.getSomesStruct({ peerSuffix: O.fromUndefinedOr(resolved.peerSuffix) }),
				}
			: {}),
	});
};

/**
 * A single importer entry's four dependency sections, keyed by field name. The
 * value type `V` differs per format — pnpm records `{ specifier, version }`,
 * bun and npm record a bare specifier string — so the caller supplies a `read`
 * that projects a section value to a specifier and (pnpm-only) a version.
 *
 * @internal
 */
export type ImporterSections<V> = { readonly [K in DependencyField]?: Readonly<Record<string, V>> };

/**
 * Collect an importer's declared dependencies off the shared dependency-sections
 * table. Iterates {@link DEP_TYPES} in order, projecting each section value with
 * `read`; malformed rows are skipped (never thrown). Key-bearing intermediates
 * are the schema-decoded records, whose own-property `Object.entries` iteration
 * neither pollutes nor drops a `__proto__` key.
 *
 * @internal
 */
export const importerDependencies: {
	<V>(read: (value: V) => { readonly specifier: string; readonly version?: string }): (entry: ImporterSections<V>) => ReadonlyArray<ImporterDependency>;
	<V>(entry: ImporterSections<V>, read: (value: V) => { readonly specifier: string; readonly version?: string }): ReadonlyArray<ImporterDependency>;
} = dual(2, <V>(
	entry: ImporterSections<V>,
	read: (value: V) => { readonly specifier: string; readonly version?: string },
): ReadonlyArray<ImporterDependency> => {
	const deps: Array<ImporterDependency> = [];
	for (const field of DEP_TYPES) {
		const section = entry[field];
		if (section === undefined) continue;
		for (const [name, value] of R.toEntries(section)) {
			const { specifier, version } = read(value);
			const dep = buildImporterDependency(name, specifier, field, version);
			if (dep !== undefined) deps.push(dep);
		}
	}
	return deps;
});

/**
 * The two peer fields of a `ResolvedPackage`, always present. Spread
 * straight into `ResolvedPackage.make`.
 *
 * @internal
 */
export interface PeerDeclarations {
	readonly peerDependencies: Readonly<Record<string, string>>;
	readonly peerDependenciesMeta: Readonly<Record<string, { readonly optional: boolean }>>;
}

const EMPTY_PEERS: PeerDeclarations = { peerDependencies: {}, peerDependenciesMeta: {} };

/**
 * Normalize one format's peer declarations into the unified pair.
 *
 * Every format records the ranges the same way (a name→range map), but the
 * optional flag has two spellings: a `peerDependenciesMeta` object (pnpm, npm,
 * yarn Berry) and bun's `optionalPeers` array of names. Both are accepted and
 * collapse to `{ optional: boolean }` per peer, so a consumer reads one shape
 * regardless of which manager wrote the lockfile.
 *
 * Absence yields empty records, never `undefined` — an absent section means
 * "declares no peers", which is a fact, not a gap. Records are built with
 * `Object.fromEntries` (own-property semantics), so a `__proto__` peer name
 * neither pollutes nor drops.
 *
 * @internal
 */
export const peerDeclarations: {
	(meta: Readonly<Record<string, { readonly optional?: boolean }>> | undefined, optionalPeers?: ReadonlyArray<string> | undefined): (peers: Readonly<Record<string, string>> | undefined) => PeerDeclarations;
	(peers: Readonly<Record<string, string>> | undefined, meta: Readonly<Record<string, { readonly optional?: boolean }>> | undefined, optionalPeers?: ReadonlyArray<string> | undefined): PeerDeclarations;
} = dual((args) => args.length >= 2 && !A.isArray(args[1]), (
	peers: Readonly<Record<string, string>> | undefined,
	meta: Readonly<Record<string, { readonly optional?: boolean }>> | undefined,
	optionalPeers?: ReadonlyArray<string> | undefined,
): PeerDeclarations => {
	if (peers === undefined && meta === undefined && optionalPeers === undefined) return EMPTY_PEERS;
	const flags = MutableHashMap.empty<string, boolean>();
	if (meta !== undefined) {
		for (const [name, value] of R.toEntries(meta)) {
			MutableHashMap.set(flags, name, value?.optional === true);
		}
	}
	if (optionalPeers !== undefined) {
		for (const name of optionalPeers) MutableHashMap.set(flags, name, true);
	}
	return {
		peerDependencies: peers === undefined ? {} : R.fromEntries(R.toEntries(peers)),
		peerDependenciesMeta: R.fromEntries([...flags].map(([name, optional]) => [name, { optional }])),
	};
});

/**
 * The minimum lockfile-format version each gated format is parsed at.
 *
 * This is a deliberate narrowing of the supported input domain, not an
 * implementation detail: an older lockfile fails typed rather than parsing
 * into a model that cannot answer resolution questions. Note the gate is on
 * the **lockfile format version**, which is the only version a lockfile
 * records — the writing package manager's version is not recoverable from the
 * file, so no manager-version claim could be enforced here.
 *
 * @internal
 */
export const MINIMUM_LOCKFILE_VERSION = { pnpm: 9, npm: 3 } as const;

/**
 * Fail typed when a lockfile predates the supported format version.
 *
 * Routed through {@link validationFailure} rather than {@link framingFailure}:
 * the document was located perfectly well, so this is a shape judgement about
 * a located document, not a framing problem. The cause is a structured record
 * rather than an engine error, so a consumer can tell "your lockfile is too
 * old" from "your lockfile is malformed" without parsing a message.
 *
 * A version that is not a number at all (`lockfileVersion: "next"`) is not a
 * supported version either, and fails the same way.
 *
 * @internal
 */
export const requireLockfileVersion: {
	(raw: string | number): (format: keyof typeof MINIMUM_LOCKFILE_VERSION) => Effect.Effect<void, ParseFailure>;
	(format: keyof typeof MINIMUM_LOCKFILE_VERSION, raw: string | number): Effect.Effect<void, ParseFailure>;
} = dual(2, (
	format: keyof typeof MINIMUM_LOCKFILE_VERSION,
	raw: string | number,
): Effect.Effect<void, ParseFailure> => {
	const minimum = MINIMUM_LOCKFILE_VERSION[format];
	const parsed = P.isNumber(raw) ? raw : Number.parseFloat(raw);
	if (Number.isFinite(parsed) && parsed >= minimum) return Effect.void;
	// Typed as the exported public shape, so the record a consumer narrows to
	// with `isUnsupportedLockfileVersion` and the record built here cannot
	// drift apart silently.
	const cause: UnsupportedLockfileVersion = {
		_tag: "UnsupportedLockfileVersion",
		format,
		lockfileVersion: raw,
		minimumSupported: minimum,
		message: `${format} lockfileVersion ${JSON.stringify(raw)} is not supported: @effected/lockfiles parses ${format} lockfileVersion ${minimum} and newer`,
	};
	return Effect.fail(validationFailure(cause));
});

/**
 * The pnpm version gate's own input: `lockfileVersion` and nothing else.
 *
 * The gate has to read the version *before* the shape decode, because the
 * shape it decodes against is the shape of a supported version. `importers` is
 * a required key in the lockfile shape and a pre-v9 single-project lockfile has
 * none — it records its dependencies at the top level — so a shape-first order
 * reports a lockfile we reject for being too old as merely malformed instead.
 *
 * @internal
 */
const PnpmVersionProbe = S.Struct({
	lockfileVersion: S.Union([S.String, S.Finite]),
});

/**
 * Gate a located pnpm document (lockfile or env preamble) on its format
 * version: decode {@link PnpmVersionProbe}, then {@link requireLockfileVersion}.
 * Call it BEFORE the shape decode, for the reason the probe documents.
 *
 * Succeeds with the gated version as the model spells it (`String` of the
 * recorded value), for a caller that reports a version without decoding the
 * rest of the document.
 *
 * @internal
 */
export const gatePnpmVersion = (document: unknown): Effect.Effect<string, ParseFailure> =>
	S.decodeUnknownEffect(PnpmVersionProbe)(document).pipe(
		Effect.mapError(validationFailure),
		Effect.flatMap((probe) =>
			requireLockfileVersion("pnpm", probe.lockfileVersion).pipe(Effect.as(String(probe.lockfileVersion))),
		),
	);

/**
 * Why the lockfile document could not be located in a YAML stream.
 *
 * @internal
 */
export type FramingReason = "noLockfileDocument" | "noImporters" | "unexpectedDocuments";

/**
 * A text- or shape-level failure: the content is not well-formed, or it does
 * not have the format's expected shape. Carries the delegated engine's error.
 *
 * @internal
 */
export interface ContentFailure {
	readonly stage: "syntax" | "validation";
	readonly cause: unknown;
}

/**
 * A framing failure: the text parsed, but the stream does not carry exactly
 * one locatable lockfile document. Purely synthetic — there is no foreign
 * throwable to wrap, so it carries typed fields instead of a `cause`.
 *
 * @internal
 */
export interface FramingFailure {
	readonly stage: "framing";
	readonly reason: FramingReason;
	readonly documents: number;
}

/**
 * The raw failure record a per-format transform fails with. `Lockfile.parse`
 * materializes it into the public `LockfileParseError` / `LockfileFramingError`
 * (which live in `Lockfile.ts`, a module the internals must not import —
 * `noImportCycles`).
 *
 * @internal
 */
export type ParseFailure = ContentFailure | FramingFailure;

/** @internal */
export const syntaxFailure = (cause: unknown): ParseFailure => ({ stage: "syntax", cause });

/** @internal */
export const validationFailure = (cause: unknown): ParseFailure => ({ stage: "validation", cause });

/** @internal */
export const framingFailure: {
	(documents: number): (reason: FramingReason) => ParseFailure;
	(reason: FramingReason, documents: number): ParseFailure;
} = dual(2, (reason: FramingReason, documents: number): ParseFailure => ({
	stage: "framing",
	reason,
	documents,
}));

/**
 * The field bundle a per-format transform produces and `Lockfile.parse`
 * constructs the `Lockfile` from.
 *
 * @internal
 */
export interface LockfileFields {
	readonly lockfileVersion: string;
	readonly packages: ReadonlyArray<ResolvedPackage>;
	readonly workspaceDependencies: ReadonlyArray<WorkspaceDependency>;
	readonly importers: ReadonlyArray<LockfileImporter>;
	readonly extension?: PnpmExtension | BunExtension;
}

/**
 * Common dependency-map shape of a single workspace entry, shared across all
 * four formats.
 *
 * @internal
 */
export interface WorkspaceEntry {
	readonly dependencies?: Readonly<Record<string, string>>;
	readonly devDependencies?: Readonly<Record<string, string>>;
	readonly peerDependencies?: Readonly<Record<string, string>>;
	readonly optionalDependencies?: Readonly<Record<string, string>>;
}

/**
 * Whether the specifier is a workspace, link or file reference
 * (`"workspace:*"`, `"link:../foo"`, `"file:../bar"`).
 *
 * @internal
 */
export const isWorkspaceSpecifier = (specifier: string): boolean =>
	specifier.startsWith("workspace:") || specifier.startsWith("link:") || specifier.startsWith("file:");

/**
 * Extract inter-workspace dependency edges: for every workspace entry and
 * dependency type, emit an edge for each dependency whose name is itself a
 * workspace.
 *
 * **Details**
 *
 * Workspace names are an immutable `HashSet` of strings, used only for
 * membership checks. Edges retain workspace-entry, dependency-type and
 * dependency-map traversal order. Key-bearing intermediates use maps and
 * hash sets: lockfile keys are attacker-adjacent strings (`__proto__`,
 * `constructor`) and must never be assigned onto plain objects here.
 *
 * @internal
 */
export const extractWorkspaceDeps: {
	(workspaces: ReadonlyMap<string, WorkspaceEntry>, workspaceNames: HashSet.HashSet<string>): ReadonlyArray<WorkspaceDependency>;
	(workspaceNames: HashSet.HashSet<string>): (workspaces: ReadonlyMap<string, WorkspaceEntry>) => ReadonlyArray<WorkspaceDependency>;
} = dual(2, (
	workspaces: ReadonlyMap<string, WorkspaceEntry>,
	workspaceNames: HashSet.HashSet<string>,
): ReadonlyArray<WorkspaceDependency> => {
	const deps: Array<WorkspaceDependency> = [];
	for (const [from, entry] of workspaces) {
		for (const depType of DEP_TYPES) {
			const depMap = entry[depType];
			if (depMap === undefined) continue;
			for (const [name, constraint] of R.toEntries(depMap)) {
				if (HashSet.has(workspaceNames, name)) {
					deps.push(WorkspaceDependency.make({ from, to: name, depType, constraint }));
				}
			}
		}
	}
	return deps;
});
