// The located workspace member: a package.json projection plus where it lives.
//
// Deliberately a TOLERANT projection rather than `@effected/package-json`'s
// `Package` — that model requires a `PackageName` and a strict `SemVer`, so a
// single member with a non-semver version would fail discovery for the whole
// repo. The strict model is one method away (`manifest()`), so nothing is
// duplicated semantically: `WorkspacePackage` is a *located member*, `Package`
// is a *decoded manifest*.

import { $ScratchpadId } from "@beep/identity/packages";
import { GlobPattern } from "../glob/index.ts";
import { WorkspaceManifest } from "../lockfiles/index.ts";
import { Package } from "../package-json/index.ts";
import type * as PlatformError from "effect/PlatformError";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as P from "effect/Predicate";
import * as R from "effect/Record";

const $I = $ScratchpadId.create("effected/workspaces/WorkspacePackage");

const JsonValue = S.fromJsonString(S.Unknown);

const EMPTY: Readonly<Record<string, string>> = R.fromEntries([]);

// The readonly empty default for `manifestRecord`, shared like the dependency-map
// default: construction sites and serialized values without the field decode to
// `{}` rather than failing or carrying `undefined`.
const EMPTY_MANIFEST: Readonly<Record<string, unknown>> = R.fromEntries([]);

/**
 * Projects the publication settings workspace tooling uses to choose a registry,
 * visibility, directory, and dist-tag.
 *
 * **Details**
 *
 * Deliberately narrow. `@effected/package-json` models `publishConfig` as an
 * open `Record<string, unknown>` for round-trip fidelity, which preserves every
 * key but types none of them; this is the typed projection of the handful that
 * decide *where, whether and as what* a package publishes. Unknown keys are
 * ignored, not rejected.
 *
 * **Example** (Choose scoped package visibility)
 *
 * ```ts
 * import { PublishConfig } from "@beep/scratchpad/effected/workspaces/WorkspacePackage";
 *
 * const config = PublishConfig.make({ access: "public", tag: "next" });
 * console.log(config.access, config.tag); // public next
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class PublishConfig extends S.Class<PublishConfig>($I`PublishConfig`)({
	/** Scoped-package visibility. Its presence overrides `private`. */
	access: S.optionalKey(S.Literals(["public", "restricted"])).annotateKey({ description: "Scoped-package visibility. Its presence overrides `private`." }),
	/** The registry to publish to. */
	registry: S.optionalKey(S.String).annotateKey({ description: "The registry to publish to." }),
	/** A subdirectory to publish instead of the package root. */
	directory: S.optionalKey(S.String).annotateKey({ description: "A subdirectory to publish instead of the package root." }),
	/**
	 * Whether workspace links point into `directory` during local development —
	 * pnpm symlinks the publish directory instead of the package root, so
	 * siblings resolve the built artifact they would install from the registry.
	 * Meaningful only alongside `directory`.
	 */
	linkDirectory: S.optionalKey(S.Boolean).annotateKey({ description: "Whether workspace links point into `directory` during local development — pnpm symlinks the publish directory instead of the package root, so siblings resolve the built artifact they would install from the registry. Meaningful only alongside `directory`." }),
	/** The dist-tag to publish under. */
	tag: S.optionalKey(S.String).annotateKey({ description: "The dist-tag to publish under." }),
}, $I.annote("PublishConfig", { description: "The `publishConfig` fields workspace tooling reads." })) {}

const DependencyMap = S.Record(S.String, S.String).pipe(
	S.withDecodingDefaultKey(Effect.succeed(EMPTY)),
	S.withConstructorDefault(Effect.succeed(EMPTY)),
);

/**
 * The result of comparing two {@link WorkspacePackage} dependency snapshots.
 *
 * **Details**
 *
 * Comparison runs across all four dependency kinds combined, so a dependency
 * that moves between kinds at the same version does not appear in the diff.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface DependencyDiff {
	/** Present in the receiver, absent from the other. */
	readonly added: Record<string, string>;
	/** Present in the other, absent from the receiver. */
	readonly removed: Record<string, string>;
	/** Present in both at different specifiers: `from` is the other package's, `to` the receiver's. */
	readonly changed: Record<string, { readonly from: string; readonly to: string }>;
}

/**
 * Raised when a workspace member's `package.json` cannot be read or decoded
 * into the strict `@effected/package-json` `Package` model.
 *
 * **Details**
 *
 * Discovery itself never raises this — it uses the tolerant projection. Only
 * `WorkspacePackage.manifest` does, so opting into the strict model is an
 * explicit, individually recoverable step.
 *
 * **Example** (Identify a manifest read failure)
 *
 * ```ts
 * import { WorkspaceManifestError } from "@beep/scratchpad/effected/workspaces/WorkspacePackage";
 *
 * const error = WorkspaceManifestError.make({
 *   packageJsonPath: "/repo/packages/utils/package.json",
 *   kind: "read",
 *   cause: new Error("File unavailable"),
 * });
 * console.log(error.kind); // read
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class WorkspaceManifestError extends S.TaggedError<WorkspaceManifestError>($I`WorkspaceManifestError`)("WorkspaceManifestError", {
	/** Absolute path to the `package.json` that failed. */
	packageJsonPath: S.String.annotateKey({ description: "Absolute path to the `package.json` that failed." }),
	/** Whether the file could not be read, or read but not decoded. */
	kind: S.Literals(["read", "decode"]).annotateKey({ description: "Whether the file could not be read, or read but not decoded." }),
	/** The originating failure, preserved rather than flattened to a string. */
	cause: S.Defect().annotateKey({ description: "The originating failure, preserved rather than flattened to a string." }),
}, $I.annote("WorkspaceManifestError", { description: "Raised when a workspace member's `package.json` cannot be read or decoded into the strict `@effected/package-json` `Package` model." })) {
	/**
	 * Renders the path and failure kind into a one-line message.
	 *
	 * **Example** (Render the failing manifest path)
	 *
	 * ```ts
	 * import { WorkspaceManifestError } from "@beep/scratchpad/effected/workspaces/WorkspacePackage";
	 *
	 * const error = WorkspaceManifestError.make({
	 *   packageJsonPath: "/repo/packages/utils/package.json",
	 *   kind: "read",
	 *   cause: new Error("File unavailable"),
	 * });
	 * console.log(error.message); // Failed to read package.json at /repo/packages/utils/package.json
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	override get message(): string {
		return `Failed to ${this.kind} package.json at ${this.packageJsonPath}`;
	}
}

/**
 * A single package inside a workspace: the discovery-relevant slice of its
 * `package.json` plus its filesystem location.
 *
 * **Details**
 *
 * Produced by `WorkspaceDiscovery` for every directory the `packages:` patterns
 * enumerate. The root package is always present with `relativePath` `"."`.
 *
 * **Example** (Construct and inspect a workspace package)
 *
 * ```ts
 * import { WorkspacePackage } from "@beep/scratchpad/effected/workspaces/WorkspacePackage";
 *
 * const pkg = WorkspacePackage.make({
 *   name: "@my-org/utils",
 *   path: "/repo/packages/utils",
 *   packageJsonPath: "/repo/packages/utils/package.json",
 *   relativePath: "packages/utils",
 *   workspaceRoot: "/repo",
 *   version: "1.0.0",
 * });
 *
 * console.log(pkg.isRootWorkspace, pkg.unscopedName, pkg.workspaceRoot); // false utils /repo
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class WorkspacePackage extends S.Class<WorkspacePackage>($I`WorkspacePackage`)({
	/** The package name. */
	name: S.NonEmptyString.annotateKey({ description: "The package name." }),
	/**
  * The raw `version` string — deliberately not semver-validated — or absent
  * when the manifest declares none.
  *
  * **Gotchas**
  *
  * pnpm accepts a version-less private package, and a private monorepo root
  * without a `version` is the ordinary shape, so discovery carries the field
  * exactly as the manifest has it: a non-empty string when present, verbatim
  * and un-validated, absent when the key is absent — never a `"0.0.0"`
  * placeholder and never a present `undefined` key. **Only ABSENCE is
  * tolerated**: a `version` that is present but not a string, or present and
  * `""`, fails discovery as `invalidShape` on both surfaces. `""` in
  * particular is not a pnpm shape and would resolve `workspace:^` to a bare
  * `"^"`.
  * Anything that needs a concrete version (`WorkspaceResolver.versionOf`,
  * a release tag) answers the absence itself rather than inventing one.
  */
	version: S.optionalKey(S.String).annotateKey({ description: "The raw `version` string — deliberately not semver-validated — or absent when the manifest declares none." }),
	/** Absolute path to the package directory. */
	path: S.NonEmptyString.annotateKey({ description: "Absolute path to the package directory." }),
	/** Absolute path to the package's `package.json`. */
	packageJsonPath: S.NonEmptyString.annotateKey({ description: "Absolute path to the package's `package.json`." }),
	/** POSIX path relative to the workspace root; `"."` for the root package. */
	relativePath: S.String.annotateKey({ description: "POSIX path relative to the workspace root; `\".\"` for the root package." }),
	/**
  * Absolute path to the workspace root this package was discovered under.
  *
  * **Details**
  *
  * Carried, not derived: `WorkspaceDiscovery` resolves the root before
  * enumerating, so every package arrives with it and consumers need no
  * per-package root arithmetic over `relativePath`.
  *
  * For the root package this equals `path`, and `relativePath` is `"."`.
  */
	workspaceRoot: S.NonEmptyString.annotateKey({ description: "Absolute path to the workspace root this package was discovered under." }),
	/** Whether the package is marked private. */
	private: S.Boolean.pipe(
		S.withDecodingDefaultKey(Effect.succeed(false)),
		S.withConstructorDefault(Effect.succeed(false)),
	).annotateKey({ description: "Whether the package is marked private." }),
	/** Production dependencies. */
	dependencies: DependencyMap.annotateKey({ description: "Production dependencies." }),
	/** Development dependencies. */
	devDependencies: DependencyMap.annotateKey({ description: "Development dependencies." }),
	/** Peer dependencies. */
	peerDependencies: DependencyMap.annotateKey({ description: "Peer dependencies." }),
	/** Optional dependencies. */
	optionalDependencies: DependencyMap.annotateKey({ description: "Optional dependencies." }),
	/** The `publishConfig` block, when present. */
	publishConfig: S.optionalKey(PublishConfig).annotateKey({ description: "The `publishConfig` block, when present." }),
	/**
  * The package's `package.json` as read — tolerant access to every field
  * outside the typed discovery slice (`scripts`, `exports`, …) without a
  * second file read.
  *
  * **Details**
  *
  * Values are `unknown` and exactly what discovery parsed; nothing here is
  * validated beyond being a record. For the strict typed model use
  * `manifest()`, which deliberately **re-reads** the file — a point-in-time
  * refresh this captured record cannot provide. Defaults to `{}` for
  * values constructed or decoded without the field.
  */
	manifestRecord: S.Record(S.String, S.Unknown).pipe(
		S.withDecodingDefaultKey(Effect.succeed(EMPTY_MANIFEST)),
		S.withConstructorDefault(Effect.succeed(EMPTY_MANIFEST)),
	).annotateKey({ description: "The package's `package.json` as read — tolerant access to every field outside the typed discovery slice (`scripts`, `exports`, …) without a second file read." }),
}, $I.annote("WorkspacePackage", { description: "A single package inside a workspace: the discovery-relevant slice of its `package.json` plus its filesystem location." })) {
	/**
	 * Whether this is the workspace root package.
	 *
	 * **Example** (Recognize the workspace root)
	 *
	 * ```ts
	 * import { WorkspacePackage } from "@beep/scratchpad/effected/workspaces/WorkspacePackage";
	 *
	 * const pkg = WorkspacePackage.make({
	 *   name: "@my-org/utils",
	 *   path: "/repo/packages/utils",
	 *   packageJsonPath: "/repo/packages/utils/package.json",
	 *   relativePath: ".",
	 *   workspaceRoot: "/repo",
	 * });
	 * console.log(pkg.isRootWorkspace); // true
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	get isRootWorkspace(): boolean {
		return this.relativePath === ".";
	}

	/**
	 * Whether the package is publishable in principle (not marked private).
	 *
	 * **Example** (Inspect a private package)
	 *
	 * ```ts
	 * import { WorkspacePackage } from "@beep/scratchpad/effected/workspaces/WorkspacePackage";
	 *
	 * const pkg = WorkspacePackage.make({
	 *   name: "@my-org/utils",
	 *   path: "/repo/packages/utils",
	 *   packageJsonPath: "/repo/packages/utils/package.json",
	 *   relativePath: "packages/utils",
	 *   workspaceRoot: "/repo",
	 *   private: true,
	 * });
	 * console.log(pkg.isPublic); // false
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	get isPublic(): boolean {
		return !this.private;
	}

	/**
	 * The npm scope (`@org`), or `Option.none()` for an unscoped name.
	 *
	 * **Example** (Read a scoped package name)
	 *
	 * ```ts
	 * import { WorkspacePackage } from "@beep/scratchpad/effected/workspaces/WorkspacePackage";
	 * import * as O from "effect/Option";
	 *
	 * const pkg = WorkspacePackage.make({
	 *   name: "@my-org/utils",
	 *   path: "/repo/packages/utils",
	 *   packageJsonPath: "/repo/packages/utils/package.json",
	 *   relativePath: "packages/utils",
	 *   workspaceRoot: "/repo",
	 * });
	 * console.log(O.getOrElse(pkg.scope, () => "unscoped")); // @my-org
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	get scope(): O.Option<string> {
		const match = /^(@[^/]+)\//.exec(this.name);
		return O.fromUndefinedOr(match?.[1]);
	}

	/**
	 * The name with any scope stripped.
	 *
	 * **Example** (Strip a package scope)
	 *
	 * ```ts
	 * import { WorkspacePackage } from "@beep/scratchpad/effected/workspaces/WorkspacePackage";
	 *
	 * const pkg = WorkspacePackage.make({
	 *   name: "@my-org/utils",
	 *   path: "/repo/packages/utils",
	 *   packageJsonPath: "/repo/packages/utils/package.json",
	 *   relativePath: "packages/utils",
	 *   workspaceRoot: "/repo",
	 * });
	 * console.log(pkg.unscopedName); // utils
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	get unscopedName(): string {
		const slash = this.name.indexOf("/");
		return this.name.startsWith("@") && slash !== -1 ? this.name.slice(slash + 1) : this.name;
	}

	/**
	 * Every dependency, merged across the four kinds.
	 *
	 * **Details**
	 *
	 * Precedence on a name declared in several kinds runs
	 * `dependencies` \> `devDependencies` \> `peerDependencies` \>
	 * `optionalDependencies`.
	 *
	 * **Example** (Observe dependency kind precedence)
	 *
	 * ```ts
	 * import { WorkspacePackage } from "@beep/scratchpad/effected/workspaces/WorkspacePackage";
	 *
	 * const pkg = WorkspacePackage.make({
	 *   name: "@my-org/utils",
	 *   path: "/repo/packages/utils",
	 *   packageJsonPath: "/repo/packages/utils/package.json",
	 *   relativePath: "packages/utils",
	 *   workspaceRoot: "/repo",
	 *   dependencies: { shared: "^2.0.0" },
	 *   devDependencies: { shared: "^1.0.0" },
	 * });
	 * console.log(pkg.allDependencies.shared); // ^2.0.0
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	get allDependencies(): Record<string, string> {
		return R.fromEntries([
			...R.toEntries(this.optionalDependencies),
			...R.toEntries(this.peerDependencies),
			...R.toEntries(this.devDependencies),
			...R.toEntries(this.dependencies),
		]);
	}

	/**
	 * Whether `name` is a production dependency.
	 *
	 * **Example** (Check dependencies membership)
	 *
	 * ```ts
	 * import { WorkspacePackage } from "@beep/scratchpad/effected/workspaces/WorkspacePackage";
	 *
	 * const pkg = WorkspacePackage.make({
	 *   name: "@my-org/utils",
	 *   path: "/repo/packages/utils",
	 *   packageJsonPath: "/repo/packages/utils/package.json",
	 *   relativePath: "packages/utils",
	 *   workspaceRoot: "/repo",
	 *   dependencies: { shared: "^1.0.0" },
	 * });
	 * console.log(pkg.hasDependency("shared"), pkg.hasDependency("missing")); // true false
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	hasDependency(name: string): boolean {
		return R.has(this.dependencies, name);
	}

	/**
	 * Whether `name` is a development dependency.
	 *
	 * **Example** (Check devDependencies membership)
	 *
	 * ```ts
	 * import { WorkspacePackage } from "@beep/scratchpad/effected/workspaces/WorkspacePackage";
	 *
	 * const pkg = WorkspacePackage.make({
	 *   name: "@my-org/utils",
	 *   path: "/repo/packages/utils",
	 *   packageJsonPath: "/repo/packages/utils/package.json",
	 *   relativePath: "packages/utils",
	 *   workspaceRoot: "/repo",
	 *   devDependencies: { shared: "^1.0.0" },
	 * });
	 * console.log(pkg.hasDevDependency("shared"), pkg.hasDevDependency("missing")); // true false
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	hasDevDependency(name: string): boolean {
		return R.has(this.devDependencies, name);
	}

	/**
	 * Whether `name` is a peer dependency.
	 *
	 * **Example** (Check peerDependencies membership)
	 *
	 * ```ts
	 * import { WorkspacePackage } from "@beep/scratchpad/effected/workspaces/WorkspacePackage";
	 *
	 * const pkg = WorkspacePackage.make({
	 *   name: "@my-org/utils",
	 *   path: "/repo/packages/utils",
	 *   packageJsonPath: "/repo/packages/utils/package.json",
	 *   relativePath: "packages/utils",
	 *   workspaceRoot: "/repo",
	 *   peerDependencies: { shared: "^1.0.0" },
	 * });
	 * console.log(pkg.hasPeerDependency("shared"), pkg.hasPeerDependency("missing")); // true false
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	hasPeerDependency(name: string): boolean {
		return R.has(this.peerDependencies, name);
	}

	/**
	 * Whether `name` is an optional dependency.
	 *
	 * **Example** (Check optionalDependencies membership)
	 *
	 * ```ts
	 * import { WorkspacePackage } from "@beep/scratchpad/effected/workspaces/WorkspacePackage";
	 *
	 * const pkg = WorkspacePackage.make({
	 *   name: "@my-org/utils",
	 *   path: "/repo/packages/utils",
	 *   packageJsonPath: "/repo/packages/utils/package.json",
	 *   relativePath: "packages/utils",
	 *   workspaceRoot: "/repo",
	 *   optionalDependencies: { shared: "^1.0.0" },
	 * });
	 * console.log(pkg.hasOptionalDependency("shared"), pkg.hasOptionalDependency("missing")); // true false
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	hasOptionalDependency(name: string): boolean {
		return R.has(this.optionalDependencies, name);
	}

	/**
	 * Whether `name` appears in any of the four dependency kinds.
	 *
	 * **Example** (Check peerDependencies membership)
	 *
	 * ```ts
	 * import { WorkspacePackage } from "@beep/scratchpad/effected/workspaces/WorkspacePackage";
	 *
	 * const pkg = WorkspacePackage.make({
	 *   name: "@my-org/utils",
	 *   path: "/repo/packages/utils",
	 *   packageJsonPath: "/repo/packages/utils/package.json",
	 *   relativePath: "packages/utils",
	 *   workspaceRoot: "/repo",
	 *   peerDependencies: { shared: "^1.0.0" },
	 * });
	 * console.log(pkg.hasAnyDependencyOn("shared"), pkg.hasAnyDependencyOn("missing")); // true false
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	hasAnyDependencyOn(name: string): boolean {
		return (
			this.hasDependency(name) ||
			this.hasDevDependency(name) ||
			this.hasPeerDependency(name) ||
			this.hasOptionalDependency(name)
		);
	}

	/**
	 * The declared specifier for `name`, searched across all four kinds.
	 *
	 * **Example** (Find an optional dependency specifier)
	 *
	 * ```ts
	 * import { WorkspacePackage } from "@beep/scratchpad/effected/workspaces/WorkspacePackage";
	 * import * as O from "effect/Option";
	 *
	 * const pkg = WorkspacePackage.make({
	 *   name: "@my-org/utils",
	 *   path: "/repo/packages/utils",
	 *   packageJsonPath: "/repo/packages/utils/package.json",
	 *   relativePath: "packages/utils",
	 *   workspaceRoot: "/repo",
	 *   optionalDependencies: { native: "^1.0.0" },
	 * });
	 * console.log(O.getOrElse(pkg.dependencyVersion("native"), () => "missing")); // ^1.0.0
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	dependencyVersion(name: string): O.Option<string> {
		return R.get(this.dependencies, name).pipe(
			O.orElse(() => R.get(this.devDependencies, name)),
			O.orElse(() => R.get(this.peerDependencies, name)),
			O.orElse(() => R.get(this.optionalDependencies, name)),
		);
	}

	/**
	 * Whether any dependency name (across all four kinds) matches the glob
	 * `pattern`, using `@effected/glob`.
	 *
	 * **Gotchas**
	 *
	 * A `GlobPattern` is total and free to test. A `string` is compiled on every
	 * call and an **uncompilable** literal throws: a glob written into a call
	 * site is developer wiring, not untrusted input, so it belongs in the defect
	 * channel rather than widening the typed channel every caller must branch
	 * on. Compile once with `GlobPattern.compile` and pass the result when
	 * testing many packages.
	 *
	 * **Example** (Match a dependency name with a glob)
	 *
	 * ```ts
	 * import { WorkspacePackage } from "@beep/scratchpad/effected/workspaces/WorkspacePackage";
	 *
	 * const pkg = WorkspacePackage.make({
	 *   name: "@my-org/utils",
	 *   path: "/repo/packages/utils",
	 *   packageJsonPath: "/repo/packages/utils/package.json",
	 *   relativePath: "packages/utils",
	 *   workspaceRoot: "/repo",
	 *   dependencies: { "@my-org/core": "workspace:*" },
	 * });
	 * console.log(pkg.matchesDependency("@my-org/*")); // true
	 * ```
	 *
	 * @param pattern - A compiled pattern, or a source string to compile.
	 * @category predicates
	 * @since 0.0.0
	 */
	matchesDependency(pattern: GlobPattern | string): boolean {
		const compiled = P.isString(pattern) ? GlobPattern.make({ source: pattern }) : pattern;
		return R.keys(this.allDependencies).some((dependency) => compiled.matches(dependency));
	}

	/**
	 * Compare this package's dependencies against `other`'s, treating `other` as
	 * the baseline: what this package added, removed or re-specified.
	 *
	 * **Example** (Compare changed dependency specifiers)
	 *
	 * ```ts
	 * import { WorkspacePackage } from "@beep/scratchpad/effected/workspaces/WorkspacePackage";
	 *
	 * const pkg = WorkspacePackage.make({
	 *   name: "@my-org/utils",
	 *   path: "/repo/packages/utils",
	 *   packageJsonPath: "/repo/packages/utils/package.json",
	 *   relativePath: "packages/utils",
	 *   workspaceRoot: "/repo",
	 *   dependencies: { shared: "^2.0.0" },
	 * });
	 * const baseline = WorkspacePackage.make({
	 *   name: pkg.name,
	 *   path: pkg.path,
	 *   packageJsonPath: pkg.packageJsonPath,
	 *   relativePath: pkg.relativePath,
	 *   workspaceRoot: pkg.workspaceRoot,
	 *   dependencies: { shared: "^1.0.0" },
	 * });
	 * const diff = pkg.dependencyDiff(baseline);
	 * console.log(diff.changed.shared?.from, diff.changed.shared?.to); // ^1.0.0 ^2.0.0
	 * ```
	 *
	 * @param other - The package to compare against.
	 * @category utilities
	 * @since 0.0.0
	 */
	dependencyDiff(other: WorkspacePackage): DependencyDiff {
		const mine = this.allDependencies;
		const theirs = other.allDependencies;
		const added: Array<readonly [string, string]> = [];
		const removed: Array<readonly [string, string]> = [];
		const changed: Array<readonly [string, { readonly from: string; readonly to: string }]> = [];

		for (const [name, version] of R.toEntries(mine)) {
			if (!R.has(theirs, name)) added.push([name, version]);
			else {
				const previous = O.getOrUndefined(R.get(theirs, name));
				if (previous !== undefined && previous !== version) changed.push([name, { from: previous, to: version }]);
			}
		}
		for (const [name, version] of R.toEntries(theirs)) {
			if (!R.has(mine, name)) removed.push([name, version]);
		}
		return { added: R.fromEntries(added), removed: R.fromEntries(removed), changed: R.fromEntries(changed) };
	}

	/**
	 * Project to `@effected/lockfiles`' `WorkspaceManifest` — the input shape of
	 * `LockfileIntegrity.compare`. Total.
	 *
	 * **Example** (Project dependencies for lockfile comparison)
	 *
	 * ```ts
	 * import { WorkspacePackage } from "@beep/scratchpad/effected/workspaces/WorkspacePackage";
	 *
	 * const pkg = WorkspacePackage.make({
	 *   name: "@my-org/utils",
	 *   path: "/repo/packages/utils",
	 *   packageJsonPath: "/repo/packages/utils/package.json",
	 *   relativePath: "packages/utils",
	 *   workspaceRoot: "/repo",
	 *   dependencies: { shared: "^2.0.0" },
	 * });
	 * const manifest = pkg.toWorkspaceManifest();
	 * console.log(manifest.name, manifest.dependencies?.shared); // @my-org/utils ^2.0.0
	 * ```
	 *
	 * @category mapping
	 * @since 0.0.0
	 */
	toWorkspaceManifest(): WorkspaceManifest {
		return WorkspaceManifest.make({
			name: this.name,
			dependencies: this.dependencies,
			devDependencies: this.devDependencies,
			peerDependencies: this.peerDependencies,
			optionalDependencies: this.optionalDependencies,
		});
	}

	/**
	 * Read and decode this package's `package.json` into the strict
	 * `@effected/package-json` `Package` model — the bridge from the
	 * tolerant discovery projection to the fully typed manifest.
	 *
	 * **Details**
	 *
	 * Fails with {@link WorkspaceManifestError} (`kind: "read"` or `"decode"`) and
	 * requires core `FileSystem`.
	 *
	 * **Example** (Construct a strict manifest read)
	 *
	 * ```ts
	 * import { WorkspacePackage } from "@beep/scratchpad/effected/workspaces/WorkspacePackage";
	 * import * as Effect from "effect/Effect";
	 *
	 * const pkg = WorkspacePackage.make({
	 *   name: "@my-org/utils",
	 *   path: "/repo/packages/utils",
	 *   packageJsonPath: "/repo/packages/utils/package.json",
	 *   relativePath: "packages/utils",
	 *   workspaceRoot: "/repo",
	 * });
	 * const program = WorkspacePackage.manifest(pkg);
	 * console.log(Effect.isEffect(program)); // true
	 * ```
	 *
	 * @category parsing
	 * @since 0.0.0
	 */
	static readonly manifest = Effect.fn("WorkspacePackage.manifest")(function* (self: WorkspacePackage) {
		const fs = yield* FileSystem.FileSystem;
		const content = yield* fs
			.readFileString(self.packageJsonPath)
			.pipe(
				Effect.mapError(
					(cause: PlatformError.PlatformError) =>
						WorkspaceManifestError.make({ packageJsonPath: self.packageJsonPath, kind: "read", cause }),
				),
			);
		const raw = yield* S.decodeEffect(JsonValue)(content).pipe(Effect.mapError((cause) => WorkspaceManifestError.make({ packageJsonPath: self.packageJsonPath, kind: "decode", cause })));
		return yield* Package.decode(raw).pipe(
			Effect.mapError(
				(cause) => WorkspaceManifestError.make({ packageJsonPath: self.packageJsonPath, kind: "decode", cause }),
			),
		);
	});

	/**
	 * Constructs a strict manifest read for this package; the instance form of
	 * `WorkspacePackage.manifest`.
	 *
	 * **Example** (Construct an instance manifest read)
	 *
	 * ```ts
	 * import { WorkspacePackage } from "@beep/scratchpad/effected/workspaces/WorkspacePackage";
	 * import * as Effect from "effect/Effect";
	 *
	 * const pkg = WorkspacePackage.make({
	 *   name: "@my-org/utils",
	 *   path: "/repo/packages/utils",
	 *   packageJsonPath: "/repo/packages/utils/package.json",
	 *   relativePath: "packages/utils",
	 *   workspaceRoot: "/repo",
	 * });
	 * const program = pkg.manifest();
	 * console.log(Effect.isEffect(program)); // true
	 * ```
	 *
	 * @category parsing
	 * @since 0.0.0
	 */
	manifest(): Effect.Effect<Package, WorkspaceManifestError, FileSystem.FileSystem> {
		return WorkspacePackage.manifest(this);
	}
}
