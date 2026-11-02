/**
 * The unified lockfile model the four formats normalize into, its pure
 * `Lockfile.parse` entry point, and the typed parse and framing failures.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LockfilesId } from "@beep/identity/packages";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Match from "effect/Match";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { BunExtension } from "./BunExtension.ts";
import { parseBun } from "./internal/bun.ts";
import { parseNpm } from "./internal/npm.ts";
import { parsePnpm, resolveImporterLink, resolveLinkTarget } from "./internal/pnpm.ts";
import { FramingReason } from "./internal/shared.ts";
import { parseYarn } from "./internal/yarn.ts";
import { LockfileFormat } from "./LockfileFormat.ts";
import { LockfileImporter } from "./LockfileImporter.ts";
import { PnpmExtension } from "./PnpmExtension.ts";
import { ResolvedPackage } from "./ResolvedPackage.ts";
import { WorkspaceDependency } from "./WorkspaceDependency.ts";
import type { LockfileFields, ParseFailure } from "./internal/shared.ts";

const $I = $LockfilesId.create("Lockfile");

const EMPTY_IMPORTERS: ReadonlyArray<LockfileImporter> = [];

/**
 * Failure of `Lockfile.parse`: the given content is not a valid lockfile of
 * the requested format.
 *
 * **Details**
 *
 * - `format` — which format was being parsed.
 * - `stage` — `"syntax"` when the text itself failed to parse (YAML, JSON,
 *   JSONC), `"validation"` when the text parsed but did not have the
 *   format's expected shape.
 * - `cause` — the underlying jsonc/yaml/JSON/Schema error, preserved
 *   structurally.
 *
 * Malformed input always exits through this typed failure, never as a
 * defect. Parse takes content, not a path — the caller that did the IO owns
 * any path context.
 *
 * **Example** (Construct a syntax failure)
 *
 * ```ts
 * import { LockfileParseError } from "@beep/lockfiles/Lockfile";
 *
 * const error = LockfileParseError.make({ format: "npm", stage: "syntax", cause: "invalid JSON" });
 * console.log(error.stage); // syntax
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class LockfileParseError extends S.TaggedError<LockfileParseError, { readonly brand: unique symbol }>(
  $I`LockfileParseError`
)(
  "LockfileParseError",
  {
    /** The lockfile format that was being parsed. */
    format: LockfileFormat.pipe(
      $I.annoteKey("LockfileParseError.format", { description: "The lockfile format that was being parsed." })
    ),
    /** Whether the text itself failed to parse (`"syntax"`) or parsed but had the wrong shape (`"validation"`). */
    stage: S.Literals(["syntax", "validation"]).pipe(
      $I.annoteKey("LockfileParseError.stage", {
        description:
          'Whether the text itself failed to parse (`"syntax"`) or parsed but had the wrong shape (`"validation"`).',
      })
    ),
    /** The underlying engine or schema failure, preserved structurally. */
    cause: S.Defect().pipe(
      $I.annoteKey("LockfileParseError.cause", {
        description: "The underlying engine or schema failure, preserved structurally.",
      })
    ),
  },
  $I.annoteError<LockfileParseError>("LockfileParseError", {
    description: "Failure of `Lockfile.parse`: the given content is not a valid lockfile of the requested format.",
  })
) {
  /**
   * Summarizes the failed parsing stage for display.
   *
   * **Example** (Read the failure message)
   *
   * ```ts
   * import { LockfileParseError } from "@beep/lockfiles/Lockfile";
   *
   * const error = LockfileParseError.make({ format: "npm", stage: "syntax", cause: "invalid JSON" });
   * console.log(error.message); // Failed to parse npm lockfile: the content is not well-formed
   * ```
   *
   * @category formatting
   * @since 0.0.0
   */
  override get message(): string {
    return this.stage === "syntax"
      ? `Failed to parse ${this.format} lockfile: the content is not well-formed`
      : `Failed to parse ${this.format} lockfile: the content does not have the expected ${this.format} shape`;
  }
}

/**
 * Failure of `Lockfile.parse`: the content parsed as text, but no single
 * lockfile document could be located in it.
 *
 * **Details**
 *
 * `pnpm-lock.yaml` is a YAML **stream**. pnpm writes an env preamble document
 * ahead of the lockfile whenever the workspace declares `configDependencies`
 * or `devEngines.packageManager`, so the file holds two documents. The
 * lockfile is the last one — pnpm composes the preamble as a prefix — and a
 * parser that read only the first document would get the preamble: a document
 * that *validates*, yielding a lockfile with an empty workspace. This error
 * makes that case fail instead of succeeding quietly.
 *
 * - `format` — which format was being parsed.
 * - `documents` — how many YAML documents the stream carried.
 * - `reason`:
 *   - `"noLockfileDocument"` — the stream carries no lockfile document:
 *     empty content, or a pnpm stream whose lockfile position is empty. That
 *     includes an env preamble followed by an empty document unless the
 *     caller passes `configOnly`: pnpm writes those same bytes for a
 *     config-dependency-only workspace with no root `package.json` *and* for
 *     a workspace whose first install failed after its config dependencies
 *     were installed, so only the caller can say which it is. With
 *     `configOnly`, `Lockfile.parse` reads that stream as an empty lockfile
 *     versioned by the preamble; an empty lockfile position with no preamble
 *     fails either way.
 *   - `"noImporters"` — the located document declares no importers, so it
 *     describes no workspace. pnpm always records at least the root importer.
 *   - `"unexpectedDocuments"` — the stream carries more documents than the
 *     format's framing defines: several in a format that defines none
 *     (yarn), or more than the env preamble and the lockfile in a pnpm
 *     stream. Rather than silently picking one, parsing refuses to guess.
 *     `Lockfile.parse` and `PnpmEnvLockfile` share one pnpm splitter, so
 *     both enforce the same at-most-two limit.
 *
 * It carries typed fields rather than a `cause`: unlike
 * {@link LockfileParseError}, there is no underlying engine failure to wrap —
 * the text parsed fine.
 *
 * **Example** (Construct a framing failure)
 *
 * ```ts
 * import { LockfileFramingError } from "@beep/lockfiles/Lockfile";
 *
 * const error = LockfileFramingError.make({ format: "pnpm", reason: "noImporters", documents: 1 });
 * console.log(error.reason); // noImporters
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class LockfileFramingError extends S.TaggedError<LockfileFramingError, { readonly brand: unique symbol }>(
  $I`LockfileFramingError`
)(
  "LockfileFramingError",
  {
    /** The lockfile format that was being parsed. */
    format: LockfileFormat.pipe(
      $I.annoteKey("LockfileFramingError.format", { description: "The lockfile format that was being parsed." })
    ),
    /** Which framing check failed; see the class remarks for each. */
    reason: FramingReason.pipe(
      $I.annoteKey("LockfileFramingError.reason", {
        description: "Which framing check failed; see the class remarks for each.",
      })
    ),
    /** How many YAML documents the stream carried. */
    documents: S.Int.pipe(
      $I.annoteKey("LockfileFramingError.documents", { description: "How many YAML documents the stream carried." })
    ),
  },
  $I.annoteError<LockfileFramingError>("LockfileFramingError", {
    description:
      "Failure of `Lockfile.parse`: the content parsed as text, but no single lockfile document could be located in it.",
  })
) {
  /**
   * Summarizes the failed document-framing check for display.
   *
   * **Example** (Read the failure message)
   *
   * ```ts
   * import { LockfileFramingError } from "@beep/lockfiles/Lockfile";
   *
   * const error = LockfileFramingError.make({ format: "pnpm", reason: "noImporters", documents: 1 });
   * console.log(error.message); // Failed to parse pnpm lockfile: the lockfile document declares no importers, so it describes no workspace
   * ```
   *
   * @category formatting
   * @since 0.0.0
   */
  override get message(): string {
    const detail =
      this.reason === "noImporters"
        ? "the lockfile document declares no importers, so it describes no workspace"
        : this.reason === "unexpectedDocuments"
          ? this.format === "pnpm"
            ? `expected at most two YAML documents (an env preamble and the lockfile) but the content carries ${this.documents}`
            : `expected a single YAML document but the content carries ${this.documents}`
          : `the content carries no lockfile document (${this.documents} YAML document(s) found)`;
    return `Failed to parse ${this.format} lockfile: ${detail}`;
  }
}

/**
 * Materialize an internal {@link ParseFailure} record into the public error
 * union — the one mapping every public fallible boundary shares, so
 * `Lockfile.parse` and `PnpmEnvLockfile.packageManager` cannot disagree about
 * which failure is which.
 *
 * **Example** (Materialize a framing failure)
 *
 * ```ts
 * import { framingFailure } from "@beep/lockfiles/internal/shared";
 * import { materializeFailure } from "@beep/lockfiles/Lockfile";
 *
 * const error = materializeFailure("pnpm", framingFailure("noImporters", 1));
 * console.log(error._tag); // LockfileFramingError
 * ```
 *
 * @internal
 * @category error-handling
 * @since 0.0.0
 */
export const materializeFailure: {
  (failure: ParseFailure): (format: LockfileFormat) => LockfileParseError | LockfileFramingError;
  (format: LockfileFormat, failure: ParseFailure): LockfileParseError | LockfileFramingError;
} = dual(2, (format: LockfileFormat, failure: ParseFailure): LockfileParseError | LockfileFramingError =>
  failure.stage === "framing"
    ? LockfileFramingError.make({ format, reason: failure.reason, documents: failure.documents })
    : LockfileParseError.make({ format, stage: failure.stage, cause: failure.cause })
);

const dispatch: {
  (format: LockfileFormat, content: string, configOnly: boolean): Effect.Effect<LockfileFields, ParseFailure>;
  (content: string, configOnly: boolean): (format: LockfileFormat) => Effect.Effect<LockfileFields, ParseFailure>;
} = dual(
  3,
  (format: LockfileFormat, content: string, configOnly: boolean): Effect.Effect<LockfileFields, ParseFailure> =>
    Match.value(format).pipe(
      Match.when("bun", () => parseBun(content)),
      Match.when("npm", () => parseNpm(content)),
      Match.when("pnpm", () => parsePnpm(content, configOnly)),
      Match.when("yarn", () => parseYarn(content)),
      Match.exhaustive
    )
);

// A name mapped to the empty string is no name: the entry keeps its own.
const lookupName = (names: HashMap.HashMap<string, string>, key: string): O.Option<string> =>
  O.filter(HashMap.get(names, key), Str.isNonEmpty);

/**
 * The unified lockfile model all four formats normalize into.
 *
 * **Details**
 *
 * - `format` — which lockfile format produced the data.
 * - `lockfileVersion` — the lockfile format version string.
 * - `packages` — every resolved package.
 * - `workspaceDependencies` — inter-workspace dependency edges.
 * - `importers` — each workspace importer's declared dependencies
 *   ({@link LockfileImporter}), keyed by importer path. Populated by the pnpm,
 *   bun and npm parsers; always empty for yarn, which records no importers.
 * - `extension` — format-specific residue (`PnpmExtension` or
 *   `BunExtension`) when the format records any.
 *
 * For pnpm, `Lockfile.parse` emits the honest importer-path-keyed model
 * (workspace packages named by importer path, version `"0.0.0"`);
 * {@link Lockfile.withImporterNames} is the explicit, pure second stage
 * that rewrites those names once the caller has read the workspace
 * manifests. npm, yarn and bun lockfiles carry real names and need no
 * second stage.
 *
 * **Example** (Construct an empty normalized lockfile)
 *
 * ```ts
 * import { Lockfile } from "@beep/lockfiles/Lockfile";
 *
 * const lockfile = Lockfile.make({ format: "npm", lockfileVersion: "3", packages: [], workspaceDependencies: [] });
 * console.log(lockfile.format); // npm
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class Lockfile extends S.Class<Lockfile, { readonly brand: unique symbol }>($I`Lockfile`)(
  {
    format: LockfileFormat.pipe(
      $I.annoteKey("Lockfile.format", {
        description: "Lockfile format that produced the normalized data: bun, npm, pnpm or yarn Berry",
      })
    ),
    lockfileVersion: S.String.pipe(
      $I.annoteKey("Lockfile.lockfileVersion", { description: "Format version recorded by the lockfile" })
    ),
    packages: S.Array(ResolvedPackage).pipe(
      $I.annoteKey("Lockfile.packages", {
        description:
          "Resolved package instances, including workspace packages and separate instances for different peer contexts",
      })
    ),
    workspaceDependencies: S.Array(WorkspaceDependency).pipe(
      $I.annoteKey("Lockfile.workspaceDependencies", {
        description:
          "Directed dependency edges between workspace packages, carrying their declared constraints and dependency sections",
      })
    ),
    importers: S.Array(LockfileImporter).pipe(
      // The decoding default is the *encoded* empty array (a fresh `[]` literal,
      // which is assignable to the encoded side); the constructor default is the
      // decoded empty array. Both are empty, so the runtime value is identical.
      S.withDecodingDefaultKey(Effect.succeed([])),
      S.withConstructorDefault(Effect.succeed(EMPTY_IMPORTERS)),
      $I.annoteKey("Lockfile.importers", {
        description:
          "Workspace importers and their declared dependencies, identified by root-relative path; empty for yarn",
      })
    ),
    extension: S.optionalKey(S.Union([PnpmExtension, BunExtension])).pipe(
      $I.annoteKey("Lockfile.extension", {
        description: "Optional pnpm- or bun-specific metadata preserved alongside the normalized lockfile model",
      })
    ),
  },
  $I.annote("Lockfile", { description: "The unified lockfile model all four formats normalize into." })
) {
  /**
   * Lazily built name → packages index; deliberately outside the schema, never encodes.
   *
   * **Example** (Build the name index on lookup)
   *
   * ```ts
   * import { Lockfile } from "@beep/lockfiles/Lockfile";
   *
   * const lockfile = Lockfile.make({ format: "npm", lockfileVersion: "3", packages: [], workspaceDependencies: [] });
   * console.log(lockfile.packagesNamed("missing").length); // 0
   * ```
   *
   * @category utilities
   * @since 0.0.0
   */
  #nameIndex: MutableHashMap.MutableHashMap<string, ReadonlyArray<ResolvedPackage>> | undefined;

  /**
   * Lazily built importer-path → importer index; deliberately outside the schema, never encodes.
   *
   * **Example** (Build the importer index on lookup)
   *
   * ```ts
   * import { Lockfile } from "@beep/lockfiles/Lockfile";
   * import * as O from "effect/Option";
   *
   * const lockfile = Lockfile.make({ format: "npm", lockfileVersion: "3", packages: [], workspaceDependencies: [] });
   * console.log(O.isNone(lockfile.importer("."))); // true
   * ```
   *
   * @category utilities
   * @since 0.0.0
   */
  #importerIndex: MutableHashMap.MutableHashMap<string, LockfileImporter> | undefined;

  /**
   * Lazily built instance-id → package index; deliberately outside the schema, never encodes.
   *
   * **Example** (Build the instance index on lookup)
   *
   * ```ts
   * import { Lockfile } from "@beep/lockfiles/Lockfile";
   * import * as O from "effect/Option";
   *
   * const lockfile = Lockfile.make({ format: "npm", lockfileVersion: "3", packages: [], workspaceDependencies: [] });
   * console.log(O.isNone(lockfile.packageByInstanceId("missing"))); // true
   * ```
   *
   * @category utilities
   * @since 0.0.0
   */
  #instanceIndex: MutableHashMap.MutableHashMap<string, ResolvedPackage> | undefined;

  /**
   * Parse lockfile content of a known format into the unified model — the
   * package's only fallible boundary.
   *
   * **Example** (Parse npm lockfile text)
   *
   * ```ts
   * import { Lockfile } from "@beep/lockfiles/Lockfile";
   * import * as Effect from "effect/Effect";
   *
   * const lockfile = Effect.runSync(Lockfile.parse('{"lockfileVersion":3,"packages":{}}', { format: "npm" }));
   * console.log(lockfile.lockfileVersion); // 3
   * ```
   *
   * @param content - The lockfile text (this package does no IO; the caller
   *   reads the file).
   * @param options - `format` is the lockfile format to parse as.
   *   `configOnly` is the caller's assertion that the workspace has **no root
   *   `package.json`**, so a pnpm env preamble followed by an empty main
   *   document is a config-dependency-only workspace and reads as an empty
   *   lockfile versioned by the preamble. Without it that stream fails
   *   {@link LockfileFramingError} with `noLockfileDocument`, because the same
   *   bytes are also what an interrupted first install leaves behind. It
   *   loosens nothing else, and is ignored for non-pnpm formats.
   * @returns An `Effect` succeeding with the {@link Lockfile}, or failing
   *   with {@link LockfileParseError} (malformed text or the wrong shape) or
   *   {@link LockfileFramingError} (the text parsed, but no lockfile document
   *   could be located in the stream — see that error for why a
   *   multi-document `pnpm-lock.yaml` needs it).
   * @category parsing
   * @since 0.0.0
   */
  static readonly parse: {
    (
      content: string,
      options: { readonly format: LockfileFormat; readonly configOnly?: boolean | undefined }
    ): Effect.Effect<Lockfile, LockfileParseError | LockfileFramingError>;
    (options: {
      readonly format: LockfileFormat;
      readonly configOnly?: boolean | undefined;
    }): (content: string) => Effect.Effect<Lockfile, LockfileParseError | LockfileFramingError>;
  } = dual(
    2,
    Effect.fn("Lockfile.parse")(function* (
      content: string,
      options: { readonly format: LockfileFormat; readonly configOnly?: boolean | undefined }
    ) {
      const fields = yield* dispatch(options.format, content, options.configOnly === true).pipe(
        Effect.mapError((failure) => materializeFailure(options.format, failure))
      );
      return Lockfile.make({ ...fields, format: options.format });
    })
  );

  /**
   * Rewrite pnpm importer-path names to real package names — the explicit
   * second stage of pnpm parsing. Total and pure.
   *
   * **Details**
   *
   * Workspace packages whose `relativePath` appears in `names` are renamed;
   * dependency edge ends are rewritten through the same map. Entries not in
   * the map keep their path name, and non-pnpm lockfiles are unaffected (no
   * key matches). Versions are not touched — pnpm workspace packages keep
   * `"0.0.0"` (the lockfile does not record their real versions).
   *
   * **Example** (Name a pnpm workspace importer)
   *
   * ```ts
   * import { Lockfile } from "@beep/lockfiles/Lockfile";
   * import * as Effect from "effect/Effect";
   * import * as HashMap from "effect/HashMap";
   *
   * const lockfile = Effect.runSync(Lockfile.parse("lockfileVersion: '9.0'\nimporters:\n  packages/core: {}", { format: "pnpm" }));
   * const named = lockfile.withImporterNames(HashMap.fromIterable([["packages/core", "@acme/core"]]));
   * console.log(named.workspacePackages[0]?.name); // @acme/core
   * ```
   *
   * @param names - Importer path → real package name.
   * @returns A new {@link Lockfile} with names rewritten.
   * @category mapping
   * @since 0.0.0
   */
  withImporterNames(names: HashMap.HashMap<string, string>): Lockfile {
    const nameOf = (key: string, fallback: string): string => O.getOrElse(lookupName(names, key), () => fallback);
    const packages = A.map(this.packages, (pkg) =>
      pkg.isWorkspace && pkg.relativePath !== undefined ? pkg.withName(nameOf(pkg.relativePath, pkg.name)) : pkg
    );
    const workspaceDependencies = A.map(this.workspaceDependencies, (dep) =>
      dep.withEndpoints(nameOf(dep.from, dep.from), nameOf(dep.to, dep.to))
    );
    // Importers stay untouched: they are keyed by importer path, not by
    // package name, so a name-rewrite does not apply to them. `ResolvedPackage`,
    // `WorkspaceDependency` and `LockfileImporter` stay `S.Class` (W3-g bench
    // fallback), so this `make` keeps every unchanged entry by reference
    // instead of re-validating the whole lockfile.
    return Lockfile.make({
      format: this.format,
      lockfileVersion: this.lockfileVersion,
      packages,
      workspaceDependencies,
      importers: this.importers,
      ...O.getSomesStruct({ extension: O.fromUndefinedOr(this.extension) }),
    });
  }

  /**
   * Every resolved package with the given name — one entry per resolved
   * version. Backed by a lazily built index, so repeated lookups are O(1).
   *
   * **Example** (Look up an absent package)
   *
   * ```ts
   * import { Lockfile } from "@beep/lockfiles/Lockfile";
   *
   * const lockfile = Lockfile.make({ format: "npm", lockfileVersion: "3", packages: [], workspaceDependencies: [] });
   * console.log(lockfile.packagesNamed("effect").length); // 0
   * ```
   *
   * @param name - The package name to look up.
   * @returns The matching packages, empty when the name is not in the
   *   lockfile.
   * @category getters
   * @since 0.0.0
   */
  packagesNamed(name: string): ReadonlyArray<ResolvedPackage> {
    if (this.#nameIndex === undefined) {
      const index = MutableHashMap.empty<string, Array<ResolvedPackage>>();
      for (const pkg of this.packages) {
        const bucket = O.getOrUndefined(MutableHashMap.get(index, pkg.name));
        if (bucket === undefined) {
          MutableHashMap.set(index, pkg.name, [pkg]);
        } else {
          bucket.push(pkg);
        }
      }
      this.#nameIndex = index;
    }
    return O.getOrUndefined(MutableHashMap.get(this.#nameIndex, name)) ?? [];
  }

  /**
   * The importer at the given path — `"."` for the workspace root — or
   * `Option.none()` when the lockfile records no importer there. Backed by a
   * lazily built index, so repeated lookups are O(1). The index is a `MutableHashMap`,
   * so an attacker-adjacent path (`__proto__`, `constructor`) neither pollutes
   * nor collides.
   *
   * **Example** (Look up the root importer)
   *
   * ```ts
   * import { Lockfile } from "@beep/lockfiles/Lockfile";
   * import * as Effect from "effect/Effect";
   * import * as O from "effect/Option";
   *
   * const lockfile = Effect.runSync(Lockfile.parse('{"lockfileVersion":3,"packages":{"":{}}}', { format: "npm" }));
   * console.log(O.isSome(lockfile.importer("."))); // true
   * ```
   *
   * @param path - The importer path to look up.
   * @returns The matching {@link LockfileImporter}, or `Option.none()`.
   * @category getters
   * @since 0.0.0
   */
  importer(path: string): O.Option<LockfileImporter> {
    if (this.#importerIndex === undefined) {
      const index = MutableHashMap.empty<string, LockfileImporter>();
      for (const imp of this.importers) MutableHashMap.set(index, imp.path, imp);
      this.#importerIndex = index;
    }
    return MutableHashMap.get(this.#importerIndex, path);
  }

  /**
   * The resolved package with the given instance id, or `Option.none()` when
   * the lockfile records none. Backed by a lazily built index, so repeated
   * lookups are O(1) and a consumer that never walks edges pays nothing.
   *
   * **Details**
   *
   * `ResolvedPackage.instanceId` is what a resolved edge points at, so peer and
   * dependency resolution is a lookup through this index rather than a scan
   * over `packages`.
   *
   * The index is a `MutableHashMap`, so an instance id that collides with an `Object`
   * member name (`__proto__`, `constructor`) neither pollutes nor
   * false-matches, exactly as for {@link Lockfile.importer}.
   *
   * **Example** (Look up an absent package instance)
   *
   * ```ts
   * import { Lockfile } from "@beep/lockfiles/Lockfile";
   * import * as O from "effect/Option";
   *
   * const lockfile = Lockfile.make({ format: "npm", lockfileVersion: "3", packages: [], workspaceDependencies: [] });
   * console.log(O.isNone(lockfile.packageByInstanceId("missing"))); // true
   * ```
   *
   * @param instanceId - The instance id to look up.
   * @returns The matching {@link ResolvedPackage}, or `Option.none()`.
   * @category getters
   * @since 0.0.0
   */
  packageByInstanceId(instanceId: string): O.Option<ResolvedPackage> {
    if (this.#instanceIndex === undefined) {
      const index = MutableHashMap.empty<string, ResolvedPackage>();
      // First wins, so the answer is stable if a malformed lockfile repeats
      // an id rather than depending on iteration order.
      for (const pkg of this.packages) {
        if (!MutableHashMap.has(index, pkg.instanceId)) MutableHashMap.set(index, pkg.instanceId, pkg);
      }
      this.#instanceIndex = index;
    }
    return MutableHashMap.get(this.#instanceIndex, instanceId);
  }

  /**
   * The instance the workspace root resolves `name` to, or `Option.none()`
   * when the lockfile records none.
   *
   * **Details**
   *
   * This is "which `name` does the root get", the package a root `bin` or a
   * root import reaches, read the way each format records it:
   *
   * - bun keys a root install by its bare install name, so it is the instance
   *   whose id is `name`;
   * - npm keys it `node_modules/<name>`;
   * - pnpm records it on the root importer: the `"."` importer's dependency
   *   `name`, whose version and peer suffix compose the snapshot id (an
   *   aliased dependency records `<real>@<version>`, which is the id itself);
   * - yarn Berry records no importers, so it answers `Option.none()`.
   *
   * Under bun and npm the answer may be a workspace package (both key a
   * hoisted workspace link the same way); a caller that wants only registry
   * installs filters on `isWorkspace`. pnpm records a workspace root
   * dependency as `link:<path>`, which resolves to the workspace package
   * at that root-relative path, then a declared publish directory, then the
   * longest owning workspace importer under a `workspace:` specifier.
   * Other unmatched links stay unresolved. Only bun has a repo consumer today (repo-cli
   * `CatalogUsage` and `RootCatalog`); the pnpm branch is the one production
   * caller of `LockfileImporter#dependency`. An aliased bun install answers to its
   * alias, so compare `name` when the real package matters.
   *
   * **Example** (Read the root's resolved turbo)
   *
   * ```ts
   * import { Lockfile } from "@beep/lockfiles/Lockfile";
   * import * as Effect from "effect/Effect";
   * import * as O from "effect/Option";
   *
   * const lockfile = Effect.runSync(
   *   Lockfile.parse('{"lockfileVersion":1,"workspaces":{"":{}},"packages":{"turbo":["turbo@2.10.14","",{}]}}', { format: "bun" })
   * );
   * console.log(O.getOrUndefined(lockfile.rootPackage("turbo"))?.version); // 2.10.14
   * ```
   *
   * @param name - The install name to resolve from the workspace root.
   * @returns The resolved {@link ResolvedPackage}, or `Option.none()`.
   * @category getters
   * @since 0.0.0
   */
  rootPackage(name: string): O.Option<ResolvedPackage> {
    return LockfileFormat.match({
      bun: () => this.packageByInstanceId(name),
      npm: () => this.packageByInstanceId(`node_modules/${name}`),
      pnpm: () =>
        O.flatMap(
          O.flatMap(this.importer("."), (root) => root.dependency(name)),
          (dependency) =>
            O.flatMap(O.fromUndefinedOr(dependency.version), (version) => {
              if (Str.startsWith("link:")(version)) {
                return O.flatMap(resolveLinkTarget("", Str.slice(5)(version)), (target) =>
                  O.flatMap(
                    resolveImporterLink(target, P.isTagged("workspace")(dependency.specifier), {
                      instanceIds: MutableHashSet.fromIterable(A.map(this.workspacePackages, (pkg) => pkg.instanceId)),
                      importerPaths: MutableHashSet.fromIterable(
                        A.map(this.workspacePackages, (pkg) => pkg.instanceId)
                      ),
                      publishDirTargets: MutableHashMap.fromIterable(
                        R.toEntries(this.extension?._tag === "pnpm" ? (this.extension.publishDirTargets ?? {}) : {})
                      ),
                    }),
                    (instanceId) => this.packageByInstanceId(instanceId)
                  )
                );
              }
              const resolution = `${version}${dependency.peerSuffix ?? ""}`;
              // An aliased dependency records `<real>@<version>`, already the id.
              return O.orElse(this.packageByInstanceId(`${name}@${resolution}`), () =>
                this.packageByInstanceId(resolution)
              );
            })
        ),
      yarn: O.none<ResolvedPackage>,
    })(this.format);
  }

  /**
   * The workspace-local packages.
   *
   * **Example** (Count workspace-local packages)
   *
   * ```ts
   * import { Lockfile } from "@beep/lockfiles/Lockfile";
   *
   * const lockfile = Lockfile.make({ format: "npm", lockfileVersion: "3", packages: [], workspaceDependencies: [] });
   * console.log(lockfile.workspacePackages.length); // 0
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  get workspacePackages(): ReadonlyArray<ResolvedPackage> {
    return A.filter(this.packages, (pkg) => pkg.isWorkspace);
  }
}
