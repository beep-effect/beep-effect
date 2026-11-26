/**
 * What a release's git tag is called.
 *
 * **Details**
 *
 * A pure leaf: this module imports nothing from the rest of the package, and
 * nothing about git or GitHub. A tag NAME is a string-formatting concern, and
 * keeping it here rather than on a git-shaped service is what lets a release
 * planner compute its tags before it has decided to talk to anything.
 *
 * The default version prefix is "" uniformly, for scoped and unscoped tags
 * alike — strict SemVer. A tool that needs GitHub's `v<semver>` release-tag
 * convention passes `versionPrefix: "v"` explicitly. Git tag history is not an
 * API, so changing a default here would not rewrite a consumer's existing tags.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoWorkspacesId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $RepoWorkspacesId.create("ReleaseTag");

/**
 * **Details**
 *
 * `single` is the shape of a single-package repo and of a monorepo whose
 * publishable packages all version in lockstep; `scoped` is the shape of
 * independent versioning, where a shared tag would be ambiguous.
 *
 * **Example** (Recognize scoped release tagging)
 *
 * ```ts
 * import { TagStyle } from "@beep/repo-workspaces/ReleaseTag";
 * import * as S from "effect/Schema";
 * console.log(S.is(TagStyle)("scoped")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const TagStyle = LiteralKit(["single", "scoped"]).pipe(
  $I.annoteSchema("TagStyle", {
    description: "Whether one shared tag names a whole release, or one tag names each package.",
  })
);

/**
 * The decoded type of {@link (TagStyle:variable)}: `"single" | "scoped"`.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type TagStyle = typeof TagStyle.Type;

/**
 * Formatting knobs for {@link ReleaseTag.single} and {@link ReleaseTag.scoped}.
 *
 * **Example** (Check a version prefix override)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { TagFormatOptions } from "@beep/repo-workspaces/ReleaseTag";
 *
 * S.is(TagFormatOptions)({ versionPrefix: "v" }) // => true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class TagFormatOptions extends S.Opaque<TagFormatOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    /**
     * The prefix on the version segment.
     *
     * **Details**
     *
     * Defaults to `""` uniformly, for both {@link ReleaseTag.single} and
     * {@link ReleaseTag.scoped} — strict SemVer, deliberately chosen. Pass
     * `"v"` for the GitHub release-tag convention (`v1.2.3`), which tools such
     * as `actions/checkout`'s ref resolution and third-party changelog
     * generators expect.
     */
    versionPrefix: S.optionalKey(S.String).pipe(
      $I.annoteKey("TagFormatOptions.versionPrefix", {
        description: "The version segment prefix; defaults to an empty string when formatting.",
      })
    ),
  }).pipe(
    $I.annoteSchema("TagFormatOptions", {
      description: "Optional version prefix overrides for release tag formatting.",
    })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TagFormatOptions {
  /**
   * The plain, unbranded encoded shape of a {@link TagFormatOptions}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof TagFormatOptions.Encoded;
}

const VersionCore = S.Struct({
  major: S.Finite.pipe($I.annoteKey("VersionCore.major", { description: "The parsed major version segment." })),
  minor: S.Finite.pipe($I.annoteKey("VersionCore.minor", { description: "The parsed minor version segment." })),
  prerelease: S.Boolean.pipe(
    $I.annoteKey("VersionCore.prerelease", { description: "Whether the version carries a prerelease suffix." })
  ),
}).pipe(
  $I.annoteSchema("VersionCore", {
    description: "The numeric segments and prerelease presence needed to derive tracking aliases.",
  })
);
type VersionCore = typeof VersionCore.Type;

const NUMERIC_IDENTIFIER = /^(?:0|[1-9]\d*)$/;

const VersionText = S.String.check(
  S.isPattern(
    /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:0|[1-9]\d*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$(?![\s\S])/,
    $I.annote("VersionTextPattern", {
      message: "SemVer text",
      description:
        "A complete SemVer version with no leading zeros in numeric identifiers and valid non-empty prerelease and build identifiers.",
    })
  )
).pipe(
  $I.annoteSchema("VersionText", {
    description: "A complete SemVer version with valid prerelease and build identifiers.",
  })
);
const isVersionText = S.is(VersionText);

const versionCore = (version: string): VersionCore | undefined => {
  if (!isVersionText(version)) return undefined;
  const withoutBuild = O.match(Str.indexOf("+")(version), {
    onNone: () => version,
    onSome: (plus) => Str.slice(0, plus)(version),
  });
  const dash = Str.indexOf("-")(withoutBuild);
  const prerelease = O.isSome(dash);
  const core = O.match(dash, { onNone: () => withoutBuild, onSome: (at) => Str.slice(0, at)(withoutBuild) });

  const segments = Str.split(core, ".");

  return { major: Number(segments[0]), minor: Number(segments[1]), prerelease };
};

/**
 * **Example** (Check package-prefixed alias options)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { TrackingTagOptions } from "@beep/repo-workspaces/ReleaseTag";
 *
 * S.is(TrackingTagOptions)({ packageName: "@scope/pkg", precision: "major" }) // => true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class TrackingTagOptions extends S.Opaque<TrackingTagOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    /**
     * Prefix the alias with a package name, for a monorepo that namespaces its
     * tags: `@scope/pkg@v1`. Omit it for a single-package repo's bare `v1`.
     */
    packageName: S.optionalKey(S.String).pipe(
      $I.annoteKey("TrackingTagOptions.packageName", {
        description: "An optional package name prefix for tracking aliases.",
      })
    ),
    /**
     * Which aliases to derive. `"both"` (the default) gives `v1` and `v1.2`;
     * `"major"` gives only the broad `v1`.
     */
    precision: S.optionalKey(S.Literals(["major", "both"])).pipe(
      $I.annoteKey("TrackingTagOptions.precision", {
        description: "Derive only the major alias or both major and minor aliases; defaults to both during derivation.",
      })
    ),
    /**
     * Derive aliases for a prerelease version too. **Off by default, and you
     * almost certainly want it off** — see {@link TrackingTag.forVersion}.
     */
    includePrerelease: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("TrackingTagOptions.includePrerelease", {
        description: "Whether to derive aliases for prereleases; disabled by default during derivation.",
      })
    ),
  }).pipe(
    $I.annoteSchema("TrackingTagOptions", {
      description: "Optional package prefix, precision and prerelease policy for tracking alias derivation.",
    })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TrackingTagOptions {
  /**
   * The plain, unbranded encoded shape of a {@link TrackingTagOptions}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof TrackingTagOptions.Encoded;
}

/**
 * **Details**
 *
 * This is the GitHub Actions distribution convention: a consumer writes
 * `uses: owner/repo@v1` and receives whatever 1.x the repo last pointed `v1` at.
 *
 * **Deliberately not SemVer, and deliberately not a {@link (TagStyle:variable)}.**
 * A release tag names one immutable version; a tracking tag is an alias derived
 * *from* a version, carrying a truncated number that is not a version at all.
 * Folding it into `ReleaseTag` as a third style would put a mutable pointer and
 * an immutable name behind one type.
 *
 * Everything here is derivation, formatting and parsing. **Actually moving a
 * git tag is not this package's business** — a consumer does that through git,
 * and the deliberate omission is what keeps this module a pure leaf.
 *
 * **Example** (Derive stable tracking aliases with optional package prefixes)
 *
 * ```ts
 * import { TrackingTag } from "@beep/repo-workspaces/ReleaseTag";
 *
 * console.log(TrackingTag.forVersion("1.2.3").map((t) => t.value).join(", ")) // v1, v1.2
 * console.log(TrackingTag.forVersion("1.0.0-beta.3").length) // 0 — never float onto a beta
 * console.log(TrackingTag.forVersion("1.2.3", { packageName: "@acme/cli" }).map((tag) => tag.value).join(", ")) // @acme/cli@v1, @acme/cli@v1.2
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class TrackingTag extends S.Class<TrackingTag, { readonly brand: unique symbol }>($I`TrackingTag`)(
  {
    /**
     * The tag string exactly as it appears in git.
     */
    value: S.NonEmptyString.pipe(
      $I.annoteKey("TrackingTag.value", { description: "The tag string exactly as it appears in git." })
    ),
    /**
     * The package the alias namespaces; absent on a bare `v1`.
     */
    packageName: S.optionalKey(S.NonEmptyString).pipe(
      $I.annoteKey("TrackingTag.packageName", {
        description: "The package the alias namespaces; absent on a bare `v1`.",
      })
    ),
    /**
     * The major version the alias tracks.
     */
    major: S.Int.pipe($I.annoteKey("TrackingTag.major", { description: "The major version the alias tracks." })),
    /**
     * The minor version, on a `v1.2`-precision alias; absent on `v1`.
     */
    minor: S.optionalKey(S.Int).pipe(
      $I.annoteKey("TrackingTag.minor", {
        description: "The minor version, on a `v1.2`-precision alias; absent on `v1`.",
      })
    ),
  },
  $I.annote("TrackingTag", {
    description: "A floating alias tag — `v1`, `v1.2` — that a repo re-points at its newest matching release.",
  })
) {
  /**
   * Whether this alias tracks a whole major line, or one minor line inside it.
   *
   * **Example** (Inspect alias precision)
   *
   * ```ts
   * import { TrackingTag } from "@beep/repo-workspaces/ReleaseTag";
   * const tag = TrackingTag.make({ value: "v1.2", major: 1, minor: 2 });
   * console.log(tag.precision) // minor
   * ```
   *
   * @returns `"major"` for a `v1` alias, `"minor"` for a `v1.2` alias.
   * @category getters
   * @since 0.0.0
   */
  get precision(): "major" | "minor" {
    return this.minor === undefined ? "major" : "minor";
  }

  /**
   * The tracking tags a release of `version` should be pointed at.
   *
   * **Gotchas**
   *
   * **A prerelease derives nothing.** Anyone depending on `owner/repo@v1` is
   * asking for the newest *stable* 1.x, so re-pointing that alias at
   * `1.0.0-beta.3` would ship a prerelease to every such consumer with no
   * signal at all. `includePrerelease` exists for callers who genuinely mean
   * it — a prerelease-only distribution channel — and should be rare.
   *
   * **Total, never throwing.** A version that is not `X.Y.Z` derives nothing
   * rather than failing: this is a query about a version, not a validation of
   * one, and `WorkspacePackage.version` is deliberately tolerant, so odd
   * versions reach here routinely.
   *
   * 0.x versions DO derive aliases. Floating `v0` across 0.x minors is a real
   * hazard, but which aliases to publish is the caller's policy, decided where
   * the tags are moved — not something a derivation should quietly withhold.
   *
   * **Example** (Derive stable aliases and skip prereleases)
   *
   * ```ts
   * import { TrackingTag } from "@beep/repo-workspaces/ReleaseTag";
   * console.log(TrackingTag.forVersion("1.2.3").length) // 2
   * console.log(TrackingTag.forVersion("1.0.0-beta.3").length) // 0
   * ```
   *
   * @param version - The version being released.
   * @param options - Package prefix, precision and the prerelease override.
   * @returns The aliases, broadest first; empty when none apply.
   * @category constructors
   * @since 0.0.0
   */
  static readonly forVersion: {
    (version: string, options?: TrackingTagOptions.Encoded): ReadonlyArray<TrackingTag>;
    (options?: TrackingTagOptions.Encoded): (version: string) => ReadonlyArray<TrackingTag>;
  } = dual(
    (args) => P.isString(args[0]),
    (version: string, options?: TrackingTagOptions.Encoded): ReadonlyArray<TrackingTag> => {
      const packageName = options?.packageName;
      if (packageName !== undefined && !S.is(TrackingTag.fields.packageName)(packageName)) return [];
      return O.match(aliasableCore(version, options?.includePrerelease === true), {
        onNone: () => [],
        onSome: (core) => {
          const major = trackingTagOf(tagPrefix(packageName), `${core.major}`, { major: core.major });
          if (options?.precision === "major") return [major];
          return [
            major,
            trackingTagOf(tagPrefix(packageName), `${core.major}.${core.minor}`, {
              major: core.major,
              minor: core.minor,
            }),
          ];
        },
      });
    }
  );
}

const tagPrefix = (packageName: string | undefined): { readonly packageName?: string; readonly text: string } =>
  packageName === undefined ? { text: "" } : { packageName, text: `${packageName}@` };

const trackingTagOf = (
  prefix: { readonly packageName?: string; readonly text: string },
  suffix: string,
  fields: { readonly major: number; readonly minor?: number }
): TrackingTag =>
  TrackingTag.make({
    value: `${prefix.text}v${suffix}`,
    ...(prefix.packageName === undefined ? {} : { packageName: prefix.packageName }),
    ...fields,
  });

const aliasableCore = (version: string, includePrerelease: boolean): O.Option<VersionCore> =>
  O.filter(
    O.fromUndefinedOr(versionCore(version)),
    (core) =>
      S.is(TrackingTag.fields.major)(core.major) &&
      S.is(TrackingTag.fields.minor)(core.minor) &&
      (includePrerelease || !core.prerelease)
  );

const splitTag = (tag: string): { readonly packageName?: string; readonly rest: string } | undefined => {
  const found = Str.lastIndexOf("@")(tag);
  if (O.isNone(found)) return { rest: tag };
  const at = found.value;
  const packageName = Str.slice(0, at)(tag);
  const rest = Str.slice(at + 1)(tag);
  const scopeWithoutVersion = packageName === "" || rest === "";
  if (scopeWithoutVersion) return undefined;
  return { packageName, rest };
};

/**
 * Decide whether a tag string is a release tag, a tracking alias, or neither.
 *
 * **Details**
 *
 * The two families are told apart by **segment count**, not by the `v` prefix:
 * three numeric segments is a version (so `1.0.0` and `v1.0.0` are both release
 * tags), while one or two segments is a truncated alias. The `v` *is* required
 * on an alias — a bare `1` is neither valid SemVer nor the tracking convention,
 * and accepting it would make this function guess.
 *
 * The package prefix splits at the **last** `@`, so a leading npm scope
 * survives: `@scope/pkg@1.0.0` is package `@scope/pkg` at version `1.0.0`.
 *
 * Round-tripping is a tested property: every tag {@link ReleaseTag} and
 * {@link TrackingTag} format classifies back to the family that produced it,
 * with its fields intact.
 *
 * **Example** (Distinguish release tags from tracking aliases)
 *
 * ```ts
 * import { classifyTag } from "@beep/repo-workspaces/ReleaseTag";
 * console.log(classifyTag("@scope/pkg@1.0.0").kind) // release
 * console.log(classifyTag("v1").kind) // tracking
 * console.log(classifyTag("latest").kind) // unrecognized
 * ```
 *
 * @param tag - Any tag string.
 * @returns The classification.
 * @public
 * @category parsing
 * @since 0.0.0
 */
export const classifyTag = (tag: string): TagClassification => {
  const split = splitTag(tag);
  if (split === undefined) return UNRECOGNIZED;

  const { packageName, rest } = split;
  const hasV = Str.startsWith("v")(rest);
  const withoutV = hasV ? Str.slice(1)(rest) : rest;

  if (versionCore(withoutV) !== undefined) {
    return ReleaseTagClassification.make({
      tag: ReleaseTag.make({
        value: tag,
        ...(packageName === undefined ? {} : { packageName }),
        version: withoutV,
        style: packageName === undefined ? "single" : "scoped",
      }),
    });
  }

  if (!hasV) return UNRECOGNIZED;
  return O.match(aliasFields(withoutV), {
    onNone: () => UNRECOGNIZED,
    onSome: (fields) =>
      TrackingTagClassification.make({
        tag: TrackingTag.make({ value: tag, ...(packageName === undefined ? {} : { packageName }), ...fields }),
      }),
  });
};

const aliasFields = (alias: string): O.Option<{ readonly major: number; readonly minor?: number }> => {
  const segments = Str.split(alias, ".");
  if (segments.length > 2 || !A.every(segments, (segment) => NUMERIC_IDENTIFIER.test(segment))) return O.none();
  const major = Number(segments[0]);
  if (!S.is(TrackingTag.fields.major)(major)) return O.none();
  if (segments.length === 1) return O.some({ major });
  const minor = Number(segments[1]);
  return S.is(TrackingTag.fields.minor)(minor) ? O.some({ major, minor }) : O.none();
};

/**
 * **Details**
 *
 * `value` is the tag exactly as it appears in git; `version` stays **bare**
 * even when `value` carries a prefix, so a consumer comparing versions never
 * has to strip one back off.
 *
 * Formatting has **no error channel**: an empty version is rejected by
 * `Schema.NonEmptyString` when the value is constructed. A bad version
 * reaching these statics is developer wiring rather than untrusted input, so it
 * dies as a defect, the same posture as an uncompilable glob literal in
 * `WorkspacePackage.matchesDependency`.
 *
 * **Example** (Format shared and package-scoped release tags)
 *
 * ```ts
 * import { ReleaseTag } from "@beep/repo-workspaces/ReleaseTag";
 *
 * console.log(ReleaseTag.single("1.2.3").value) // 1.2.3
 * console.log(ReleaseTag.scoped("@acme/cli", "1.2.3").value) // @acme/cli@1.2.3
 * console.log(ReleaseTag.scoped("cli", "1.2.3").value) // cli@1.2.3
 * console.log(ReleaseTag.scoped("cli", "1.2.3", { versionPrefix: "v" }).value) // cli@v1.2.3
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class ReleaseTag extends S.Opaque<ReleaseTag, { readonly brand: unique symbol }>()(
  S.Struct({
    /**
     * The tag string exactly as it appears in git.
     */
    value: S.NonEmptyString.pipe(
      $I.annoteKey("ReleaseTag.value", { description: "The tag string exactly as it appears in git." })
    ),
    /**
     * The package the tag names; absent on a workspace-wide single tag.
     */
    packageName: S.optionalKey(S.NonEmptyString).pipe(
      $I.annoteKey("ReleaseTag.packageName", {
        description: "The package the tag names; absent on a workspace-wide single tag.",
      })
    ),
    /**
     * The version the tag names, without any prefix.
     */
    version: S.NonEmptyString.pipe(
      $I.annoteKey("ReleaseTag.version", { description: "The version the tag names, without any prefix." })
    ),
    /**
     * Which style produced it.
     */
    style: TagStyle.pipe($I.annoteKey("ReleaseTag.style", { description: "Which style produced it." })),
  }).pipe(
    $I.annoteSchema("ReleaseTag", { description: "A git tag naming a release, and the parts it was built from." })
  )
) {
  /**
   * One shared tag for a whole release: `1.2.3`.
   *
   * **Example** (Prefix a shared release tag)
   *
   * ```ts
   * import { ReleaseTag } from "@beep/repo-workspaces/ReleaseTag";
   * console.log(ReleaseTag.single("1.2.3", { versionPrefix: "v" }).value) // v1.2.3
   * ```
   *
   * @param version - The version being released. Must not be empty.
   * @param options - Formatting overrides.
   * @returns the single-style {@link ReleaseTag}.
   * @category constructors
   * @since 0.0.0
   */
  static readonly single: {
    (version: string, options?: TagFormatOptions.Encoded): ReleaseTag;
    (options?: TagFormatOptions.Encoded): (version: string) => ReleaseTag;
  } = dual(
    (args) => P.isString(args[0]),
    (version: string, options?: TagFormatOptions.Encoded): ReleaseTag => {
      const prefix = options?.versionPrefix ?? "";
      return ReleaseTag.make({
        value: `${prefix}${version}`,
        version,
        style: "single",
      });
    }
  );

  /**
   * A per-package tag: `<packageName>@<version>` — `@scope/pkg@1.2.3` for a
   * scoped name, `pkg@1.2.3` for an unscoped one, uniformly, unless
   * `options.versionPrefix` says otherwise.
   *
   * **Example** (Name a package release)
   *
   * ```ts
   * import { ReleaseTag } from "@beep/repo-workspaces/ReleaseTag";
   * console.log(ReleaseTag.scoped("@scope/pkg", "1.2.3").value) // @scope/pkg@1.2.3
   * ```
   *
   * @param packageName - The package being released. Must not be empty.
   * @param version - The version being released. Must not be empty.
   * @param options - Formatting overrides.
   * @category constructors
   * @since 0.0.0
   */
  static readonly scoped: {
    (packageName: string, version: string, options?: TagFormatOptions.Encoded): ReleaseTag;
    (version: string, options?: TagFormatOptions.Encoded): (packageName: string) => ReleaseTag;
  } = dual(
    (args) => P.isString(args[1]),
    (packageName: string, version: string, options?: TagFormatOptions.Encoded): ReleaseTag => {
      const prefix = options?.versionPrefix ?? "";
      return ReleaseTag.make({
        value: `${packageName}@${prefix}${version}`,
        packageName,
        version,
        style: "scoped",
      });
    }
  );
}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ReleaseTag {
  /**
   * The plain, unbranded encoded shape of a {@link ReleaseTag}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof ReleaseTag.Encoded;
}

/**
 * A tag {@link classifyTag} recognized as an immutable release tag.
 *
 * **Example** (Classify a release tag)
 *
 * ```ts
 * import { classifyTag } from "@beep/repo-workspaces/ReleaseTag";
 *
 * console.log(classifyTag("v1.2.3").kind) // release
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class ReleaseTagClassification extends S.Opaque<ReleaseTagClassification, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("release").pipe($I.annoteKey("TagClassification.kind", { description: "An immutable release tag." })),
    tag: ReleaseTag,
  }).pipe($I.annoteSchema("ReleaseTagClassification", { description: "A tag recognized as a release tag." }))
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ReleaseTagClassification {
  /**
   * The plain, unbranded encoded shape of a {@link ReleaseTagClassification}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof ReleaseTagClassification.Encoded;
}

/**
 * A tag {@link classifyTag} recognized as a floating tracking alias.
 *
 * **Example** (Classify a tracking alias)
 *
 * ```ts
 * import { classifyTag } from "@beep/repo-workspaces/ReleaseTag";
 *
 * console.log(classifyTag("v1").kind) // tracking
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class TrackingTagClassification extends S.Opaque<TrackingTagClassification, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("tracking").pipe($I.annoteKey("TagClassification.kind", { description: "A floating tracking alias." })),
    tag: TrackingTag.pipe($I.annoteKey("TagClassification.tag", { description: "The recognized tracking tag." })),
  }).pipe($I.annoteSchema("TrackingTagClassification", { description: "A tag recognized as a tracking alias." }))
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TrackingTagClassification {
  /**
   * The plain, unbranded encoded shape of a {@link TrackingTagClassification}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof TrackingTagClassification.Encoded;
}

/**
 * A tag outside both grammars {@link classifyTag} recognizes.
 *
 * **Example** (Classify an unrelated tag)
 *
 * ```ts
 * import { classifyTag } from "@beep/repo-workspaces/ReleaseTag";
 *
 * console.log(classifyTag("latest").kind) // unrecognized
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class UnrecognizedTagClassification extends S.Opaque<
  UnrecognizedTagClassification,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    kind: S.tag("unrecognized").pipe(
      $I.annoteKey("TagClassification.kind", { description: "A tag outside both supported grammars." })
    ),
  }).pipe($I.annoteSchema("UnrecognizedTagClassification", { description: "A tag outside both supported grammars." }))
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace UnrecognizedTagClassification {
  /**
   * The plain, unbranded encoded shape of a {@link UnrecognizedTagClassification}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof UnrecognizedTagClassification.Encoded;
}

const UNRECOGNIZED: UnrecognizedTagClassification = UnrecognizedTagClassification.make({});

/**
 * What an arbitrary tag string denotes.
 *
 * **Details**
 *
 * `unrecognized` is a real answer, not a failure: a repository's tags include
 * branches-turned-tags, `latest`, and whatever else humans wrote, and forcing
 * those into a bucket is exactly what a classifier must not do.
 *
 * **Example** (Recognize a classification)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { TagClassification, classifyTag } from "@beep/repo-workspaces/ReleaseTag";
 *
 * console.log(S.is(TagClassification)(classifyTag("v1"))) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const TagClassification = S.Union([
  ReleaseTagClassification,
  TrackingTagClassification,
  UnrecognizedTagClassification,
]).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("TagClassification", {
    description: "Whether an arbitrary tag denotes a release, a tracking alias, or neither.",
  })
);

/**
 * The structural result of classifying a tag string.
 *
 * @category type-level
 * @since 0.0.0
 */
export type TagClassification = typeof TagClassification.Type;
