import { $LockfilesId } from "@beep/identity/packages";
import { DependencySpecifier } from "@beep/npm-spec/DependencySpecifier";
import { IntegrityHash } from "@beep/npm-spec/IntegrityHash";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { dual, flow } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { BunExtension } from "../BunExtension.ts";
import { LockfileImporter } from "../LockfileImporter.ts";
import { PnpmExtension } from "../PnpmExtension.ts";
import { ResolvedPackage } from "../ResolvedPackage.ts";
import { WorkspaceDependency } from "../WorkspaceDependency.ts";
import type { DependencyField } from "@beep/npm-spec/DependencySection";
import type { IntegrityHashBrand } from "@beep/npm-spec/IntegrityHash";
import type { ImporterDependency } from "../ImporterDependency.ts";
import type { UnsupportedLockfileVersion } from "../UnsupportedLockfileVersion.ts";

const $I = $LockfilesId.create("internal/shared");

/**
 * The four dependency sections of a manifest, in a stable order — the shared
 * dependency-sections table. Each entry is both the
 * manifest field name to read and the `@effected/npm` `DependencyField` it maps
 * to, since the two coincide. Consumed by `extractWorkspaceDeps` and by the
 * pnpm/bun/npm importer builders.
 *
 * **Example** (Inspect dependency section order)
 *
 * ```ts
 * import { DEP_TYPES } from "@beep/lockfiles/internal/shared";
 *
 * console.log(DEP_TYPES.join(", ")) // dependencies, devDependencies, peerDependencies, optionalDependencies
 * ```
 *
 * @internal
 * @category constants
 * @since 0.0.0
 */
export const DEP_TYPES = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"] as const;

/**
 * Coerce a raw lockfile integrity string to the `@effected/npm` `IntegrityHash`
 * brand, which recognizes the SRI (`<algo>-<base64>`), corepack (`<algo>.<hex>`)
 * and yarn (`<cachekey>/<hex>`) textual forms.
 *
 * **Details**
 *
 * Absence and corruption are treated differently, and the distinction is the
 * point. An *absent* integrity (input `undefined`) succeeds with
 * `Option.none()`, so the caller omits the field — a lockfile that records no integrity is
 * legitimate. A *present but unparseable* integrity fails through the same
 * validation channel the shape checks use ({@link validationFailure}), so
 * `Lockfile.parse` surfaces it as a `LockfileParseError` with
 * `stage: "validation"` rather than silently dropping a corrupt value. Never a
 * defect. yarn's `10c0/<hex>` cache checksums are a recognized form, so real
 * yarn/npm/pnpm/bun integrity all still parses; only genuine corruption fails.
 *
 * **Example** (Preserve absent integrity)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import { toIntegrityHash } from "@beep/lockfiles/internal/shared";
 *
 * import * as O from "effect/Option";
 *
 * console.log(O.isNone(Effect.runSync(toIntegrityHash(undefined)))) // true
 * ```
 *
 * @internal
 * @category decoding
 * @since 0.0.0
 */
export const toIntegrityHash = (raw: string | undefined): Effect.Effect<O.Option<IntegrityHashBrand>, ParseFailure> =>
  raw === undefined
    ? Effect.succeedNone
    : Result.match(decodeIntegrityHash(raw), {
        onFailure: flow(validationFailure, Effect.fail),
        onSuccess: Effect.succeedSome,
      });

const decodeIntegrityHash = S.decodeResult(IntegrityHash);

const decodeSpecifier = S.decodeUnknownExit(DependencySpecifier.FromString);

/**
 * **Example** (Validate a split peer suffix)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { PeerSuffixSplit } from "@beep/lockfiles/internal/shared";
 *
 * console.log(S.is(PeerSuffixSplit)({ plain: "1.0.0", peerSuffix: "(effect@4.0.0)" })) // true
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export class PeerSuffixSplit extends S.Opaque<PeerSuffixSplit, { readonly brand: unique symbol }>()(
  S.Struct({
    plain: S.String.pipe(
      $I.annoteKey("PeerSuffixSplit.plain", {
        description: "The recorded string with its trailing peer groups removed; empty when it is only groups",
      })
    ),
    peerSuffix: S.optionalKey(S.String).pipe(
      $I.annoteKey("PeerSuffixSplit.peerSuffix", {
        description: "The raw trailing run of balanced parenthesized peer groups, present only when recorded",
      })
    ),
  }).pipe(
    $I.annoteSchema("PeerSuffixSplit", {
      description: "A recorded pnpm version or key split at its peer-disambiguation suffix",
    })
  )
) {}

/**
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PeerSuffixSplit {
  /**
   * The plain, unbranded encoded shape of a {@link PeerSuffixSplit}.
   *
   * @internal
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof PeerSuffixSplit.Encoded;
}

/**
 * Where the maximal trailing run of balanced parenthesized groups starts, for
 * a string that ends in `)`: scanning back from the end, the first character
 * outside every group ends the plain part. `0` when the string is nothing but
 * groups; `None` when the groups do not balance.
 *
 * @internal
 */
const trailingGroupsStart = (raw: string): O.Option<number> => {
  let open = 1;
  for (let index = raw.length - 2; index >= 0; index--) {
    const char = raw[index];
    if (char === "(") open--;
    else if (char === ")") open++;
    else if (open === 0) return O.some(index + 1);
  }
  return open === 0 ? O.some(0) : O.none();
};

/**
 * Split pnpm's peer-disambiguation suffix off a recorded string: the suffix is
 * the maximal TRAILING run of balanced parenthesized groups, found by scanning
 * back from the end, which is `@pnpm/dependency-path`'s own
 * `indexOfDepPathSuffix` rule. Handles both shapes pnpm records — a bare
 * version (`"1.0.0(effect@4.0.0)"`, importer entries) and a `name@version`
 * snapshot key (`"fdir@6.5.0(picomatch@4.0.4)"`) — and nested chains
 * (`"(a@1(b@2))(c@3)"`) as one suffix.
 *
 * **Details**
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
 * **Example** (Separate a peer chain from its version)
 *
 * ```ts
 * import { splitPeerSuffix } from "@beep/lockfiles/internal/shared";
 *
 * const split = splitPeerSuffix("1.0.0(effect@4.0.0)");
 * console.log(split.plain) // 1.0.0
 * console.log(split.peerSuffix) // (effect@4.0.0)
 * ```
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const splitPeerSuffix = (raw: string): PeerSuffixSplit.Encoded =>
  Str.startsWith("link:")(raw) || !Str.endsWith(")")(raw)
    ? { plain: raw }
    : O.match(trailingGroupsStart(raw), {
        onNone: () => ({ plain: raw }),
        onSome: (start) => ({ plain: Str.slice(0, start)(raw), peerSuffix: Str.slice(start)(raw) }),
      });

/**
 * **Example** (Validate a split identity)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { NameVersion } from "@beep/lockfiles/internal/shared";
 *
 * console.log(S.is(NameVersion)({ name: "@scope/lib", version: "1.2.3" })) // true
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export class NameVersion extends S.Opaque<NameVersion, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.String.pipe(
      $I.annoteKey("NameVersion.name", { description: "The package name before the separating `@`" })
    ),
    version: S.String.pipe(
      $I.annoteKey("NameVersion.version", { description: "Everything after the separating `@`, verbatim" })
    ),
  }).pipe($I.annoteSchema("NameVersion", { description: "A lockfile `name@version` key split at its separator" }))
) {}

/**
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export declare namespace NameVersion {
  /**
   * The plain, unbranded encoded shape of a {@link NameVersion}.
   *
   * @internal
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof NameVersion.Encoded;
}

/**
 * Split a `name@version` key at the separator: the first `@` after a scoped
 * name's leading one. A package name holds no other `@`, while the version
 * part may (`file:../@scope/lib`), so the LAST `@` is the wrong boundary.
 * Returns `Option.none()` for a key with no separator after its first
 * character (`"@"`, `"@scope/"`, a bare name).
 *
 * **Example** (Split a scoped package identity)
 *
 * ```ts
 * import { splitNameVersion } from "@beep/lockfiles/internal/shared";
 *
 * import * as O from "effect/Option";
 *
 * console.log(O.getOrThrow(splitNameVersion("@scope/lib@1.2.3")).name) // @scope/lib
 * ```
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const splitNameVersion = (key: string): O.Option<NameVersion.Encoded> =>
  O.map(Str.indexOf("@")(Str.slice(1)(key)), (index) => ({
    name: Str.slice(0, index + 1)(key),
    version: Str.slice(index + 2)(key),
  }));

/**
 * The install name a bun `packages` key records: the last path segment,
 * joined to the one before it when that one is a scope, or `None` when the
 * last segment is empty.
 *
 * **Details**
 *
 * bun keys a nested install `<parent-key>/<name>`, and a scoped name spans
 * two segments, so `"a/@scope/b"` installs `@scope/b` and `"a/b"` installs
 * `b`. A key ending in `/` names no install position, so it yields `None` and
 * the bun parser skips that row as malformed.
 *
 * **Example** (Read the install name of a nested scoped key)
 *
 * ```ts
 * import { installNameOf } from "@beep/lockfiles/internal/shared";
 * import * as O from "effect/Option";
 *
 * console.log(O.getOrUndefined(installNameOf("string-width-cjs/@scope/inner"))) // @scope/inner
 * console.log(O.isNone(installNameOf("string-width-cjs/"))) // true
 * ```
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const installNameOf = (key: string): O.Option<string> => {
  const segments = Str.split("/")(key);
  return O.map(O.liftPredicate(A.lastNonEmpty(segments), Str.isNonEmpty), (last) =>
    O.match(O.filter(A.get(segments, A.length(segments) - 2), Str.startsWith("@")), {
      onNone: () => last,
      onSome: (scope) => `${scope}/${last}`,
    })
  );
};

/**
 * The `version` and `peerSuffix` fields a recorded pnpm importer version
 * contributes: none for an absent or empty version, and none for a version
 * that is *only* a peer chain (no concrete version).
 *
 * @internal
 */
const recordedVersion = (version: string | undefined): { readonly version?: string; readonly peerSuffix?: string } => {
  const resolved = splitPeerSuffix(version ?? "");
  return resolved.plain === ""
    ? {}
    : { version: resolved.plain, ...O.getSomesStruct({ peerSuffix: O.fromUndefinedOr(resolved.peerSuffix) }) };
};

type ImporterDependencyInput = Omit<ImporterDependency, "brand">;

/**
 * Build one {@link ImporterDependency}, decoding the raw specifier string into
 * the `@effected/npm` `ClassifiedSpecifier` tagged union. Returns
 * `Option.none()` — a skip, never a throw — when the name is empty or the specifier does not
 * classify (e.g. an empty specifier), per the total-string-surgery discipline.
 *
 * **Details**
 *
 * A pnpm-recorded version is normalized through {@link splitPeerSuffix}: the
 * `version` field carries the plain version and the split-off peer chain lands
 * in `peerSuffix`. A version that is *only* a peer chain (empty plain part) is
 * treated as no concrete version — a skip of both fields, never a throw.
 *
 * The entry is a plain constructor input, not an admitted record:
 * `LockfileImporter.make` validates it once, so a dependency is never walked
 * twice on the parse path (W3-g).
 *
 * @internal
 */
const buildImporterDependency: {
  (
    name: string,
    specifier: string,
    depType: DependencyField,
    version: string | undefined
  ): O.Option<ImporterDependencyInput>;
  (
    specifier: string,
    depType: DependencyField,
    version: string | undefined
  ): (name: string) => O.Option<ImporterDependencyInput>;
} = dual(
  4,
  (
    name: string,
    specifier: string,
    depType: DependencyField,
    version: string | undefined
  ): O.Option<ImporterDependencyInput> =>
    name === ""
      ? O.none()
      : O.map(
          Exit.getSuccess(decodeSpecifier(specifier)),
          (classified): ImporterDependencyInput => ({
            name,
            specifier: classified,
            depType,
            ...recordedVersion(version),
          })
        )
);

/**
 * A single importer entry's four dependency sections, keyed by field name. The
 * value type `V` differs per format — pnpm records `{ specifier, version }`,
 * bun and npm record a bare specifier string — so the caller supplies a `read`
 * that projects a section value to a specifier and (pnpm-only) a version.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type ImporterSections<V> = { readonly [K in DependencyField]?: Readonly<Record<string, V>> };

/**
 * Collect an importer's declared dependencies off the shared dependency-sections
 * table. Iterates {@link DEP_TYPES} in order, projecting each section value with
 * `read`; malformed rows are skipped (never thrown). Key-bearing intermediates
 * are the schema-decoded records, whose own-property `Object.entries` iteration
 * neither pollutes nor drops a `__proto__` key.
 *
 * **Example** (Collect a declared runtime dependency)
 *
 * ```ts
 * import { importerDependencies } from "@beep/lockfiles/internal/shared";
 *
 * const deps = importerDependencies({ dependencies: { react: "^18.0.0" } }, (specifier) => ({ specifier }));
 * console.log(deps.length) // 1
 * ```
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const importerDependencies: {
  <V>(
    read: (value: V) => { readonly specifier: string; readonly version?: string }
  ): (entry: ImporterSections<V>) => ReadonlyArray<ImporterDependencyInput>;
  <V>(
    entry: ImporterSections<V>,
    read: (value: V) => { readonly specifier: string; readonly version?: string }
  ): ReadonlyArray<ImporterDependencyInput>;
} = dual(
  2,
  <V>(
    entry: ImporterSections<V>,
    read: (value: V) => { readonly specifier: string; readonly version?: string }
  ): ReadonlyArray<ImporterDependencyInput> =>
    A.flatMap(DEP_TYPES, (field) =>
      A.flatMap(R.toEntries(entry[field] ?? {}), ([name, value]) => {
        const { specifier, version } = read(value);
        return O.toArray(buildImporterDependency(name, specifier, field, version));
      })
    )
);

/**
 * The two peer fields of a `ResolvedPackage`, always present. Spread
 * straight into `ResolvedPackage.make`.
 *
 * **Example** (Validate normalized peer fields)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { PeerDeclarations } from "@beep/lockfiles/internal/shared";
 *
 * console.log(S.is(PeerDeclarations)({ peerDependencies: {}, peerDependenciesMeta: {} })) // true
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export class PeerDeclarations extends S.Opaque<PeerDeclarations, { readonly brand: unique symbol }>()(
  S.Struct({
    peerDependencies: S.Record(S.String, S.String).pipe(
      $I.annoteKey("PeerDeclarations.peerDependencies", {
        description: "Declared peer dependencies keyed by package name",
      })
    ),
    peerDependenciesMeta: S.Record(
      S.String,
      S.Struct({
        optional: S.Boolean.pipe(
          $I.annoteKey("PeerDeclarations.peerDependenciesMeta.optional", {
            description: "Whether this peer dependency is optional",
          })
        ),
      })
    ).pipe(
      $I.annoteKey("PeerDeclarations.peerDependenciesMeta", {
        description: "Optionality metadata keyed by peer dependency name",
      })
    ),
  }).pipe(
    $I.annoteSchema("PeerDeclarations", {
      description: "Normalized peer ranges and optional flags shared by all lockfile formats",
    })
  )
) {}

/**
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PeerDeclarations {
  /**
   * The plain, unbranded encoded shape of a {@link PeerDeclarations}.
   *
   * @internal
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof PeerDeclarations.Encoded;
}

const EMPTY_PEERS: PeerDeclarations.Encoded = { peerDependencies: {}, peerDependenciesMeta: {} };

/**
 * Collapse both optional-peer spellings into one `{ optional }` flag per peer:
 * meta entries first, then bun's `optionalPeers` names, which always mark a
 * peer optional. Map-backed until the last step, so a `__proto__` peer name
 * neither pollutes nor drops.
 *
 * @internal
 */
const optionalFlags = (
  meta: Readonly<Record<string, { readonly optional?: boolean }>> | undefined,
  optionalPeers: ReadonlyArray<string> | undefined
): Readonly<Record<string, { readonly optional: boolean }>> => {
  const flags = MutableHashMap.fromIterable<string, boolean>(
    A.map(R.toEntries(meta ?? {}), ([name, value]) => [name, value?.optional === true] as const)
  );
  for (const name of optionalPeers ?? []) MutableHashMap.set(flags, name, true);
  return flags.pipe(
    A.fromIterable,
    A.map(([name, optional]) => [name, { optional }] as const),
    R.fromEntries
  );
};

/**
 * Normalize one format's peer declarations into the unified pair.
 *
 * **Details**
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
 * **Gotchas**
 *
 * Data-first calls pass all three arguments, using `undefined` for absent
 * optional peer names. Data-last calls pass metadata and optional peer names
 * before receiving the peer ranges, so the call forms are unambiguous by arity.
 *
 * **Example** (Normalize peer declarations in a pipeline)
 *
 * ```ts
 * import { pipe } from "effect/Function";
 * import { peerDeclarations } from "@beep/lockfiles/internal/shared";
 *
 * const peers = pipe({ react: "^18" }, peerDeclarations(undefined, ["react"]));
 * console.log(peers.peerDependenciesMeta.react?.optional) // true
 * ```
 *
 * @internal
 * @category normalization
 * @since 0.0.0
 */
export const peerDeclarations: {
  (
    meta: Readonly<Record<string, { readonly optional?: boolean }>> | undefined,
    optionalPeers: ReadonlyArray<string> | undefined
  ): (peers: Readonly<Record<string, string>> | undefined) => PeerDeclarations.Encoded;
  (
    peers: Readonly<Record<string, string>> | undefined,
    meta: Readonly<Record<string, { readonly optional?: boolean }>> | undefined,
    optionalPeers: ReadonlyArray<string> | undefined
  ): PeerDeclarations.Encoded;
} = dual(
  3,
  (
    peers: Readonly<Record<string, string>> | undefined,
    meta: Readonly<Record<string, { readonly optional?: boolean }>> | undefined,
    optionalPeers: ReadonlyArray<string> | undefined
  ): PeerDeclarations.Encoded =>
    peers === undefined && meta === undefined && optionalPeers === undefined
      ? EMPTY_PEERS
      : {
          peerDependencies: R.fromEntries(R.toEntries(peers ?? {})),
          peerDependenciesMeta: optionalFlags(meta, optionalPeers),
        }
);

/**
 * The minimum lockfile-format version each gated format is parsed at.
 *
 * **Details**
 *
 * This is a deliberate narrowing of the supported input domain, not an
 * implementation detail: an older lockfile fails typed rather than parsing
 * into a model that cannot answer resolution questions. Note the gate is on
 * the **lockfile format version**, which is the only version a lockfile
 * records — the writing package manager's version is not recoverable from the
 * file, so no manager-version claim could be enforced here.
 *
 * **Example** (Inspect supported format floors)
 *
 * ```ts
 * import { MINIMUM_LOCKFILE_VERSION } from "@beep/lockfiles/internal/shared";
 *
 * console.log(MINIMUM_LOCKFILE_VERSION.pnpm) // 9
 * console.log(MINIMUM_LOCKFILE_VERSION.npm) // 3
 * ```
 *
 * @internal
 * @category constants
 * @since 0.0.0
 */
export const MINIMUM_LOCKFILE_VERSION = { pnpm: 9, npm: 3 } as const;

const VersionMessage = S.fromJsonString(S.Union([S.String, S.Finite])).pipe(
  $I.annoteSchema("VersionMessage", {
    description: "JSON scalar rendering of a recorded string or finite number",
  })
);
const encodeVersionMessage = S.encodeResult(VersionMessage);

/**
 * Fail typed when a lockfile predates the supported format version.
 *
 * **Details**
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
 * **Example** (Accept the supported pnpm format)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import { requireLockfileVersion } from "@beep/lockfiles/internal/shared";
 *
 * console.log(Effect.runSync(requireLockfileVersion("pnpm", 9))) // undefined
 * ```
 *
 * @internal
 * @category validation
 * @since 0.0.0
 */
export const requireLockfileVersion: {
  (raw: string | number): (format: keyof typeof MINIMUM_LOCKFILE_VERSION) => Effect.Effect<void, ParseFailure>;
  (format: keyof typeof MINIMUM_LOCKFILE_VERSION, raw: string | number): Effect.Effect<void, ParseFailure>;
} = dual(
  2,
  (format: keyof typeof MINIMUM_LOCKFILE_VERSION, raw: string | number): Effect.Effect<void, ParseFailure> => {
    const minimum = MINIMUM_LOCKFILE_VERSION[format];
    const parsed = P.isNumber(raw) ? raw : Number.parseFloat(raw);
    if (Number.isFinite(parsed) && parsed >= minimum) return Effect.void;
    // decision: version-cause-leaf-module
    const cause: UnsupportedLockfileVersion = {
      _tag: "UnsupportedLockfileVersion",
      format,
      lockfileVersion: raw,
      minimumSupported: minimum,
      message: `${format} lockfileVersion ${Result.getOrElse(encodeVersionMessage(raw), () => "null")} is not supported: @effected/lockfiles parses ${format} lockfileVersion ${minimum} and newer`,
    };
    return Effect.fail(validationFailure(cause));
  }
);

/**
 * The pnpm version gate's own input: `lockfileVersion` and nothing else.
 *
 * **Details**
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
  lockfileVersion: S.Union([S.String, S.Finite]).pipe(
    $I.annoteKey("PnpmVersionProbe.lockfileVersion", {
      description:
        "Recorded format version, preserved verbatim; a non-finite number fails boundary validation before the gate",
    })
  ),
}).pipe(
  $I.annoteSchema("PnpmVersionProbe", {
    description: "Version-only pnpm boundary read before decoding the supported importer-map shape",
  })
);

/**
 * Gate a located pnpm document (lockfile or env preamble) on its format
 * version: decode {@link PnpmVersionProbe}, then {@link requireLockfileVersion}.
 * Call it BEFORE the shape decode, for the reason the probe documents.
 *
 * **Details**
 *
 * Succeeds with the gated version as the model spells it (`String` of the
 * recorded value), for a caller that reports a version without decoding the
 * rest of the document.
 *
 * **Example** (Read a supported format version)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import { gatePnpmVersion } from "@beep/lockfiles/internal/shared";
 *
 * console.log(Effect.runSync(gatePnpmVersion({ lockfileVersion: 9 }))) // 9
 * ```
 *
 * @internal
 * @category validation
 * @since 0.0.0
 */
export const gatePnpmVersion = (document: unknown): Effect.Effect<string, ParseFailure> =>
  S.decodeUnknownEffect(PnpmVersionProbe)(document).pipe(
    Effect.mapError(validationFailure),
    Effect.flatMap((probe) =>
      requireLockfileVersion("pnpm", probe.lockfileVersion).pipe(Effect.as(String(probe.lockfileVersion)))
    )
  );

/**
 * Why the lockfile document could not be located in a YAML stream.
 *
 * **Example** (Recognize a framing reason)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { FramingReason } from "@beep/lockfiles/internal/shared";
 *
 * console.log(S.is(FramingReason)("noImporters")) // true
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const FramingReason = LiteralKit(["noLockfileDocument", "noImporters", "unexpectedDocuments"]).pipe(
  $I.annoteSchema("FramingReason", { description: "Reasons a parsed YAML stream has no unique lockfile document" })
);
/**
 * Decoded representation of {@link FramingReason} for internal parser composition.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type FramingReason = typeof FramingReason.Type;

/**
 * A text-level failure: the content is not well-formed. Carries the delegated
 * engine's error.
 *
 * **Example** (Validate a syntax failure record)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { SyntaxFailure } from "@beep/lockfiles/internal/shared";
 *
 * console.log(S.is(SyntaxFailure)({ stage: "syntax", cause: "invalid YAML" })) // true
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export class SyntaxFailure extends S.Opaque<SyntaxFailure, { readonly brand: unique symbol }>()(
  S.Struct({
    stage: S.tag("syntax").pipe(
      $I.annoteKey("SyntaxFailure.stage", { description: "Parser stage at which this failure occurred" })
    ),
    cause: S.Unknown.pipe(
      $I.annoteKey("SyntaxFailure.cause", {
        description: "Original engine throwable, retained without narrowing",
      })
    ),
  }).pipe(
    $I.annoteSchema("SyntaxFailure", {
      description: "Syntax failure preserving the original engine throwable without transformation",
    })
  )
) {}

/**
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SyntaxFailure {
  /**
   * The plain, unbranded encoded shape of a {@link SyntaxFailure}.
   *
   * @internal
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof SyntaxFailure.Encoded;
}

/**
 * A shape-level failure: the content parsed, but it does not have the
 * format's expected shape. Carries the schema or structured cause.
 *
 * **Example** (Validate a shape failure record)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { ValidationFailure } from "@beep/lockfiles/internal/shared";
 *
 * console.log(S.is(ValidationFailure)({ stage: "validation", cause: "invalid shape" })) // true
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export class ValidationFailure extends S.Opaque<ValidationFailure, { readonly brand: unique symbol }>()(
  S.Struct({
    stage: S.tag("validation").pipe(
      $I.annoteKey("ValidationFailure.stage", { description: "Parser stage at which this failure occurred" })
    ),
    cause: S.Unknown.pipe(
      $I.annoteKey("ValidationFailure.cause", {
        description: "Structural validation cause, retained without narrowing",
      })
    ),
  }).pipe(
    $I.annoteSchema("ValidationFailure", {
      description: "Shape-validation failure preserving the schema or structured cause without transformation",
    })
  )
) {}

/**
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ValidationFailure {
  /**
   * The plain, unbranded encoded shape of a {@link ValidationFailure}.
   *
   * @internal
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof ValidationFailure.Encoded;
}

/**
 * A text- or shape-level failure: the content is not well-formed, or it does
 * not have the format's expected shape.
 *
 * **Example** (Validate a syntax failure record)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { ContentFailure } from "@beep/lockfiles/internal/shared";
 *
 * console.log(S.is(ContentFailure)({ stage: "syntax", cause: "invalid YAML" })) // true
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const ContentFailure = S.Union([SyntaxFailure, ValidationFailure]).pipe(
  $I.annoteSchema("ContentFailure", {
    description: "Syntax or validation failure preserving the original engine throwable without transformation",
  })
);
/**
 * Decoded representation of {@link ContentFailure} for internal parser composition.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type ContentFailure = typeof ContentFailure.Type;

/**
 * A framing failure: the text parsed, but the stream does not carry exactly
 * one locatable lockfile document. Purely synthetic — there is no foreign
 * throwable to wrap, so it carries typed fields instead of a `cause`.
 *
 * **Example** (Validate a missing-document failure)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { FramingFailure } from "@beep/lockfiles/internal/shared";
 *
 * console.log(S.is(FramingFailure)({ stage: "framing", reason: "noLockfileDocument", documents: 0 })) // true
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export class FramingFailure extends S.Opaque<FramingFailure, { readonly brand: unique symbol }>()(
  S.Struct({
    stage: S.tag("framing").pipe(
      $I.annoteKey("FramingFailure.stage", { description: "Parser stage at which this failure occurred" })
    ),
    reason: FramingReason.pipe(
      $I.annoteKey("FramingFailure.reason", {
        description: "Reason a lockfile document could not be uniquely located",
      })
    ),
    documents: S.Finite.pipe(
      $I.annoteKey("FramingFailure.documents", { description: "Number of parsed documents in the YAML stream" })
    ),
  }).pipe(
    $I.annoteSchema("FramingFailure", {
      description: "Synthetic document-framing failure with a reason and the parsed document count",
    })
  )
) {}

/**
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export declare namespace FramingFailure {
  /**
   * The plain, unbranded encoded shape of a {@link FramingFailure}.
   *
   * @internal
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof FramingFailure.Encoded;
}

/**
 * The raw failure record a per-format transform fails with. `Lockfile.parse`
 * materializes it into the public `LockfileParseError` / `LockfileFramingError`
 * (which live in `Lockfile.ts`, a module the internals must not import —
 * `noImportCycles`).
 *
 * **Example** (Recognize a parser failure by stage)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { ParseFailure } from "@beep/lockfiles/internal/shared";
 *
 * console.log(S.is(ParseFailure)({ stage: "validation", cause: "invalid shape" })) // true
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const ParseFailure = S.Union([SyntaxFailure, ValidationFailure, FramingFailure]).pipe(
  S.toTaggedUnion("stage"),
  $I.annoteSchema("ParseFailure", {
    description: "Parser failure discriminated by syntax, validation or framing stage",
  })
);
/**
 * Decoded representation of {@link ParseFailure} for internal parser composition.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type ParseFailure = typeof ParseFailure.Type;

/**
 * Preserves a syntax parser cause in the shared failure channel.
 *
 * **Example** (Wrap a syntax cause)
 *
 * ```ts
 * import { syntaxFailure } from "@beep/lockfiles/internal/shared";
 *
 * console.log(syntaxFailure("invalid YAML").stage) // syntax
 * ```
 *
 * @internal
 * @category errors
 * @since 0.0.0
 */
export const syntaxFailure = (cause: unknown): ParseFailure => SyntaxFailure.make({ cause });

/**
 * Preserves a shape-validation cause in the shared failure channel.
 *
 * **Example** (Wrap a shape validation cause)
 *
 * ```ts
 * import { validationFailure } from "@beep/lockfiles/internal/shared";
 *
 * console.log(validationFailure("invalid shape").stage) // validation
 * ```
 *
 * @internal
 * @category errors
 * @since 0.0.0
 */
export const validationFailure = (cause: unknown): ParseFailure => ValidationFailure.make({ cause });

/**
 * Records why a parsed stream has no uniquely locatable lockfile document.
 *
 * **Example** (Report an unexpected document count)
 *
 * ```ts
 * import { framingFailure } from "@beep/lockfiles/internal/shared";
 *
 * console.log(framingFailure("unexpectedDocuments", 2).stage) // framing
 * ```
 *
 * @internal
 * @category errors
 * @since 0.0.0
 */
export const framingFailure: {
  (documents: number): (reason: FramingReason) => ParseFailure;
  (reason: FramingReason, documents: number): ParseFailure;
} = dual(2, (reason: FramingReason, documents: number): ParseFailure => FramingFailure.make({ reason, documents }));

/**
 * The field bundle a per-format transform produces and `Lockfile.parse`
 * constructs the `Lockfile` from.
 *
 * **Example** (Validate an empty normalized field bundle)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { LockfileFields } from "@beep/lockfiles/internal/shared";
 *
 * console.log(S.is(LockfileFields)({ lockfileVersion: "9", packages: [], workspaceDependencies: [], importers: [] })) // true
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export class LockfileFields extends S.Opaque<LockfileFields, { readonly brand: unique symbol }>()(
  S.Struct({
    lockfileVersion: S.String.pipe(
      $I.annoteKey("LockfileFields.lockfileVersion", {
        description: "Recorded format version, preserved verbatim before gating or string conversion",
      })
    ),
    packages: S.Array(ResolvedPackage).pipe(
      $I.annoteKey("LockfileFields.packages", { description: "Resolved package entries in lockfile traversal order" })
    ),
    workspaceDependencies: S.Array(WorkspaceDependency).pipe(
      $I.annoteKey("LockfileFields.workspaceDependencies", {
        description: "Inter-workspace dependency edges in workspace and dependency-section traversal order",
      })
    ),
    importers: S.Array(LockfileImporter).pipe(
      $I.annoteKey("LockfileFields.importers", { description: "Workspace importer entries recorded by the lockfile" })
    ),
    extension: S.optionalKey(S.Union([PnpmExtension, BunExtension])).pipe(
      $I.annoteKey("LockfileFields.extension", { description: "Optional format-specific extension fields" })
    ),
  }).pipe(
    $I.annoteSchema("LockfileFields", {
      description: "Plain field bundle normalized by a format parser before constructing the public Lockfile",
    })
  )
) {}

/**
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export declare namespace LockfileFields {
  /**
   * The plain, unbranded encoded shape of a {@link LockfileFields}.
   *
   * @internal
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof LockfileFields.Encoded;
}

/**
 * Common dependency-map shape of a single workspace entry, shared across all
 * four formats.
 *
 * **Example** (Validate optional dependency sections)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { WorkspaceEntry } from "@beep/lockfiles/internal/shared";
 *
 * console.log(S.is(WorkspaceEntry)({ dependencies: { react: "^18" } })) // true
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export class WorkspaceEntry extends S.Opaque<WorkspaceEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    dependencies: S.optionalKey(S.Record(S.String, S.String)).pipe(
      $I.annoteKey("WorkspaceEntry.dependencies", {
        description: "Declared runtime dependencies keyed by package name",
      })
    ),
    devDependencies: S.optionalKey(S.Record(S.String, S.String)).pipe(
      $I.annoteKey("WorkspaceEntry.devDependencies", {
        description: "Declared development dependencies keyed by package name",
      })
    ),
    peerDependencies: S.optionalKey(S.Record(S.String, S.String)).pipe(
      $I.annoteKey("WorkspaceEntry.peerDependencies", {
        description: "Declared peer dependencies keyed by package name",
      })
    ),
    optionalDependencies: S.optionalKey(S.Record(S.String, S.String)).pipe(
      $I.annoteKey("WorkspaceEntry.optionalDependencies", {
        description: "Declared optional dependencies keyed by package name",
      })
    ),
  }).pipe(
    $I.annoteSchema("WorkspaceEntry", {
      description: "Optional dependency sections of a workspace entry shared across the four formats",
    })
  )
) {}

/**
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export declare namespace WorkspaceEntry {
  /**
   * The plain, unbranded encoded shape of a {@link WorkspaceEntry}.
   *
   * @internal
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof WorkspaceEntry.Encoded;
}

/**
 * Whether the specifier is a workspace, link or file reference
 * (`"workspace:*"`, `"link:../foo"`, `"file:../bar"`).
 *
 * **Example** (Recognize local dependency protocols)
 *
 * ```ts
 * import { isWorkspaceSpecifier } from "@beep/lockfiles/internal/shared";
 *
 * console.log(isWorkspaceSpecifier("workspace:*")) // true
 * console.log(isWorkspaceSpecifier("^1.0.0")) // false
 * ```
 *
 * @internal
 * @category predicates
 * @since 0.0.0
 */
export const isWorkspaceSpecifier = (specifier: string): boolean =>
  A.some(LOCAL_PROTOCOLS, (protocol) => Str.startsWith(protocol)(specifier));

const LOCAL_PROTOCOLS = ["workspace:", "link:", "file:"] as const;

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
 * **Example** (Extract an inter-workspace edge)
 *
 * ```ts
 * import * as MutableHashMap from "effect/MutableHashMap";
 * import * as HashSet from "effect/HashSet";
 * import { extractWorkspaceDeps } from "@beep/lockfiles/internal/shared";
 *
 * const workspaces = MutableHashMap.fromIterable([["app", { dependencies: { lib: "workspace:*" } }]]);
 * const edges = extractWorkspaceDeps(workspaces, HashSet.fromIterable(["app", "lib"]));
 * console.log(edges.length) // 1
 * ```
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const extractWorkspaceDeps: {
  (
    workspaces: MutableHashMap.MutableHashMap<string, WorkspaceEntry.Encoded>,
    workspaceNames: HashSet.HashSet<string>
  ): ReadonlyArray<WorkspaceDependency>;
  (
    workspaceNames: HashSet.HashSet<string>
  ): (workspaces: MutableHashMap.MutableHashMap<string, WorkspaceEntry.Encoded>) => ReadonlyArray<WorkspaceDependency>;
} = dual(
  2,
  (
    workspaces: MutableHashMap.MutableHashMap<string, WorkspaceEntry.Encoded>,
    workspaceNames: HashSet.HashSet<string>
  ): ReadonlyArray<WorkspaceDependency> =>
    A.flatMap(A.fromIterable(workspaces), ([from, entry]) =>
      A.flatMap(DEP_TYPES, (depType) =>
        A.flatMap(R.toEntries(entry[depType] ?? {}), ([name, constraint]) =>
          HashSet.has(workspaceNames, name) ? [WorkspaceDependency.make({ from, to: name, depType, constraint })] : []
        )
      )
    )
);

/**
 * One lockfile dependency section: dependency name to recorded string.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type DependencyMap = Readonly<Record<string, string>>;

/**
 * The non-empty dependency names recorded across `sections`, in section and
 * key order, each once.
 *
 * **Example** (Collect edge names across sections)
 *
 * ```ts
 * import { sectionNames } from "@beep/lockfiles/internal/shared";
 *
 * console.log([...sectionNames([{ a: "1", "": "2" }, undefined, { a: "3", b: "4" }])]) // ["a", "b"]
 * ```
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const sectionNames = (
  sections: ReadonlyArray<DependencyMap | undefined>
): MutableHashSet.MutableHashSet<string> => {
  const names = MutableHashSet.empty<string>();
  for (const section of sections) if (section !== undefined) addSectionNames(names, section);
  return names;
};

const addSectionNames = (names: MutableHashSet.MutableHashSet<string>, section: DependencyMap): void => {
  for (const name of R.keys(section)) if (name !== "") MutableHashSet.add(names, name);
};

/**
 * Resolve each name to the first instance id the lockfile actually records,
 * composing one candidate per prefix in order — the compose-then-verify step
 * the npm and bun walks share. A name with no recorded candidate is omitted,
 * never guessed.
 *
 * **Details**
 *
 * Map-backed until the last step: `R.fromEntries` defines own data
 * properties, so a `__proto__` dependency name neither pollutes nor drops.
 *
 * **Example** (Take the deepest recorded candidate)
 *
 * ```ts
 * import * as MutableHashSet from "effect/MutableHashSet";
 * import { resolveByCandidates } from "@beep/lockfiles/internal/shared";
 *
 * const known = MutableHashSet.fromIterable(["a/x", "x"]);
 * const compose = (prefix: string, name: string) => (prefix === "" ? name : `${prefix}/${name}`);
 * console.log(resolveByCandidates(["x", "y"], ["a", ""], compose, known)) // { x: "a/x" }
 * ```
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const resolveByCandidates: {
  (
    names: Iterable<string>,
    prefixes: ReadonlyArray<string>,
    compose: (prefix: string, name: string) => string,
    known: MutableHashSet.MutableHashSet<string>
  ): Record<string, string>;
  (
    prefixes: ReadonlyArray<string>,
    compose: (prefix: string, name: string) => string,
    known: MutableHashSet.MutableHashSet<string>
  ): (names: Iterable<string>) => Record<string, string>;
} = dual(
  4,
  (
    names: Iterable<string>,
    prefixes: ReadonlyArray<string>,
    compose: (prefix: string, name: string) => string,
    known: MutableHashSet.MutableHashSet<string>
  ): Record<string, string> => {
    const edges = MutableHashMap.empty<string, string>();
    for (const name of names) {
      for (const prefix of prefixes) {
        const candidate = compose(prefix, name);
        if (MutableHashSet.has(known, candidate)) {
          MutableHashMap.set(edges, name, candidate);
          break;
        }
      }
    }
    return R.fromEntries(edges);
  }
);

/**
 * Every proper prefix of a slash-separated path that ends just before one of
 * its slashes, shortest first: `"a/b/c"` yields `["a", "a/b"]`. The key
 * splitting both the bun parent-key walk and the npm directory walk read
 * their ancestors from.
 *
 * **Example** (List a path's ancestors)
 *
 * ```ts
 * import { slashPrefixes } from "@beep/lockfiles/internal/shared";
 *
 * console.log(slashPrefixes("@acme/lib/react")) // ["@acme", "@acme/lib"]
 * ```
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const slashPrefixes = (path: string): ReadonlyArray<string> => {
  const segments = Str.split("/")(path);
  const prefixes: Array<string> = [];
  let prefix = A.headNonEmpty(segments);
  for (const segment of A.tailNonEmpty(segments)) {
    prefixes.push(prefix);
    prefix = `${prefix}/${segment}`;
  }
  return prefixes;
};

/**
 * The workspace entry a dependency-section bundle contributes: each of the
 * four sections that is present, the rest omitted.
 *
 * **Example** (Keep only the recorded sections)
 *
 * ```ts
 * import { workspaceEntryOf } from "@beep/lockfiles/internal/shared";
 *
 * console.log(workspaceEntryOf({ dependencies: { lib: "workspace:*" } })) // { dependencies: { lib: "workspace:*" } }
 * ```
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const workspaceEntryOf = (sections: WorkspaceEntry.Encoded): WorkspaceEntry.Encoded =>
  O.getSomesStruct({
    dependencies: O.fromUndefinedOr(sections.dependencies),
    devDependencies: O.fromUndefinedOr(sections.devDependencies),
    peerDependencies: O.fromUndefinedOr(sections.peerDependencies),
    optionalDependencies: O.fromUndefinedOr(sections.optionalDependencies),
  });

/**
 * One instance's outgoing edges, split: those that could be named, and those
 * the lockfile records but this model could not name.
 *
 * **Example** (Validate split edges)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { ResolvedEdges } from "@beep/lockfiles/internal/shared";
 *
 * console.log(S.is(ResolvedEdges)({ resolved: { react: "react@18.3.1" }, unresolvedEdges: [] })) // true
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export class ResolvedEdges extends S.Opaque<ResolvedEdges, { readonly brand: unique symbol }>()(
  S.Struct({
    resolved: S.Record(S.String, S.String).pipe(
      $I.annoteKey("ResolvedEdges.resolved", {
        description: "Resolved instance ids keyed by dependency name",
      })
    ),
    unresolvedEdges: S.Array(S.String).pipe(
      $I.annoteKey("ResolvedEdges.unresolvedEdges", {
        description: "Unresolved dependency names in ascending UTF-16 order",
      })
    ),
  }).pipe(
    $I.annoteSchema("ResolvedEdges", {
      description: "Resolved instance ids by dependency name and the sorted names of edges that could not be resolved",
    })
  )
) {}

/**
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ResolvedEdges {
  /**
   * The plain, unbranded encoded shape of a {@link ResolvedEdges}.
   *
   * @internal
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof ResolvedEdges.Encoded;
}

/**
 * Split per-edge resolutions into {@link ResolvedEdges}: a named edge lands in
 * `resolved` (a later section's answer for the same name wins), an unnamed
 * one in the sorted, de-duplicated `unresolvedEdges`. Empty names are
 * skipped, never thrown on.
 *
 * **Example** (Partition two recorded edges)
 *
 * ```ts
 * import * as O from "effect/Option";
 * import { partitionEdges } from "@beep/lockfiles/internal/shared";
 *
 * const edges = partitionEdges([["a", O.some("a@1")], ["b", O.none()]]);
 * console.log(edges.unresolvedEdges) // ["b"]
 * ```
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const partitionEdges = (
  resolutions: ReadonlyArray<readonly [string, O.Option<string>]>
): ResolvedEdges.Encoded => {
  const edges = MutableHashMap.empty<string, string>();
  const unnameable = MutableHashSet.empty<string>();
  for (const [name, target] of resolutions) {
    if (name === "") continue;
    if (O.isSome(target)) MutableHashMap.set(edges, name, target.value);
    else MutableHashSet.add(unnameable, name);
  }
  return { resolved: R.fromEntries(edges), unresolvedEdges: A.sort(unnameable, Order.String) };
};

/**
 * A package entry's resolution metadata as pnpm records it, permissive: only
 * the optional `integrity` text is read.
 *
 * **Example** (Validate a resolution record)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { PackageResolution } from "@beep/lockfiles/internal/shared";
 *
 * console.log(S.is(PackageResolution)({ integrity: "sha512-AAAA" })) // true
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export class PackageResolution extends S.Opaque<PackageResolution, { readonly brand: unique symbol }>()(
  S.Struct({
    integrity: S.optionalKey(S.String).pipe(
      $I.annoteKey("PackageResolution.integrity", { description: "Recorded subresource integrity hash" })
    ),
  }).pipe(
    $I.annoteSchema("PackageResolution", {
      description: "A permissive package resolution carrying its optional recorded integrity",
    })
  )
) {}
