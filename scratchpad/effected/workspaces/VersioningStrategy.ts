// How a workspace assigns versions across its publishable packages, and what
// that implies for tagging.
//
// This is a value class with statics, not a service. Classification is a pure
// total fold over (publishable names, fixed groups) — there is nothing to swap
// and nothing to configure — and the kit-wide rule that a service shape carries
// only effectful members settles it. The one genuinely effectful
// entry point, `detect`, is a static over two services that already exist and
// already have their own test doubles.

import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as A from "effect/Array";
import * as MutableHashSet from "effect/MutableHashSet";
import * as Str from "effect/String";
import { PublishabilityDetector } from "./Publishability.ts";
import type { TagFormatOptions, TagStyle } from "./ReleaseTag.ts";
import { ReleaseTag } from "./ReleaseTag.ts";
import { WorkspaceDiscovery } from "./WorkspaceDiscovery.ts";

const $I = $ScratchpadId.create("effected/workspaces/VersioningStrategy");

/**
 * How a workspace assigns versions across its publishable packages.
 *
 * @remarks
 * - `single` — zero or one publishable package, so one tag names the release.
 * - `fixed-group` — every publishable package sits inside one group that
 *   versions in lockstep, so one tag still names the release.
 * - `independent` — publishable packages version separately, so a shared tag
 *   would be ambiguous and each package needs its own.
 *
 * @public
 */
export const VersioningStrategyType = LiteralKit(["single", "fixed-group", "independent"]).pipe($I.annoteSchema("VersioningStrategyType", { description: "How a workspace assigns versions across its publishable packages." }));

/**
 * The decoded type of {@link (VersioningStrategyType:variable)}.
 *
 * @public
 */
export type VersioningStrategyType = typeof VersioningStrategyType.Type;

/**
 * Arguments to {@link VersioningStrategy.classify}.
 *
 * **Example** (Check structural classification input)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { ClassifyOptions } from "./VersioningStrategy.ts";
 *
 * S.is(ClassifyOptions)({ packages: ["a", "b"], fixedGroups: [["a", "b"]] }); // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const ClassifyOptions = S.Struct({
	/** Publishable package names, in any order. Duplicates are collapsed. */
	packages: S.Array(S.String).annotateKey({ description: "Publishable package names, in any order; duplicates are collapsed." }),
	/**
	 * Groups of packages that version in lockstep.
	 *
	 * @remarks
	 * A **plain argument, deliberately.** Fixed groups are a release tool's
	 * concept — changesets writes them to `.changeset/config.json` — and a
	 * workspace-model package that read that file would be taking on one tool's
	 * schema and one tool's release policy. The caller reads its own tool's
	 * config and hands the groups in. Groups may name packages that are not
	 * publishable, or do not exist; only whether some single group covers the
	 * whole publishable set matters.
	 */
	fixedGroups: S.String.pipe(S.Array, S.Array, S.optionalKey).annotateKey({ description: "Groups of packages that version in lockstep." }),
}).pipe($I.annoteSchema("ClassifyOptions", { description: "Publishable package names and optional fixed groups used to classify a workspace." }));

/**
 * Structural arguments accepted by workspace versioning classification.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ClassifyOptions = typeof ClassifyOptions.Type;

/**
 * Arguments to {@link VersioningStrategy.detect}.
 *
 * @public
 */
export interface VersioningDetectOptions {
	/** See {@link ClassifyOptions.fixedGroups}. Defaults to none. */
	readonly fixedGroups?: ReadonlyArray<ReadonlyArray<string>>;
}

/**
 * One entry in a release batch: which package went out, at which version.
 *
 * **Details**
 * Deliberately structural and minimal — a caller passes whatever it already
 * has (a publish result, a changeset plan row) without projecting it into a
 * package-specific type first.
 *
 * **Example** (Check a release batch entry)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { PackageRelease } from "./VersioningStrategy.ts";
 *
 * S.is(PackageRelease)({ name: "@acme/cli", version: "1.2.3" }); // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const PackageRelease = S.Struct({
	/** The package that was released. */
	name: S.String.annotateKey({ description: "The package that was released." }),
	/** The version it was released at. */
	version: S.String.annotateKey({ description: "The version it was released at." }),
}).pipe($I.annoteSchema("PackageRelease", { description: "A structural release batch entry naming a package and its released version." }));

/**
 * A structural package name and version pair in a release batch.
 *
 * @category type-level
 * @since 0.0.0
 */
export type PackageRelease = typeof PackageRelease.Type;

/**
 * How a workspace versions, and the tagging that follows from it.
 *
 * @remarks
 * Built either purely with {@link VersioningStrategy.classify}, or from a live
 * workspace with {@link VersioningStrategy.detect}.
 *
 * @example
 * ```ts
 * import { PublishabilityDetector, VersioningStrategy } from "./index.ts";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function* () {
 *   const strategy = yield* VersioningStrategy.detect({ fixedGroups: [["@acme/a", "@acme/b"]] });
 *   return strategy.tagsFor([{ name: "@acme/a", version: "1.2.3" }]).map((tag) => tag.value);
 * }).pipe(Effect.provide(PublishabilityDetector.layerNpm));
 * ```
 *
 * @public
 */
export class VersioningStrategy extends S.Class<VersioningStrategy>($I`VersioningStrategy`)({
	/** The classification. */
	type: VersioningStrategyType.annotateKey({ description: "The classification." }),
	/** The groups classification was performed against, as supplied. */
	fixedGroups: S.String.pipe(S.Array, S.Array).annotateKey({ description: "The groups classification was performed against, as supplied." }),
	/** The publishable package names, sorted and de-duplicated. */
	publishablePackages: S.Array(S.String).annotateKey({ description: "The publishable package names, sorted and de-duplicated." }),
}, $I.annote("VersioningStrategy", { description: "How a workspace versions, and the tagging that follows from it." })) {
	/**
	 * Whether a release needs one tag per package rather than one shared tag.
	 */
	get perPackageTags(): boolean {
		return this.type === "independent";
	}

	/** The tag style this strategy implies. */
	get tagStyle(): TagStyle {
		return this.perPackageTags ? "scoped" : "single";
	}

	/**
	 * Classify a workspace from its publishable package names and fixed groups.
	 *
	 * @remarks
	 * Pure and total — no IO, no error channel. `packages` is sorted and
	 * de-duplicated first, so a name listed twice cannot inflate a one-package
	 * repo into an independent one.
	 *
	 * @param options - The publishable package names and any fixed groups.
	 * @returns the classified {@link VersioningStrategy}.
	 */
	static classify(options: ClassifyOptions): VersioningStrategy {
		const fixedGroups = options.fixedGroups ?? [];
		const packages = A.sort(A.fromIterable(MutableHashSet.fromIterable(options.packages)), Str.Order);

		const type: VersioningStrategyType =
			packages.length <= 1
				? "single"
				: // Lockstep means ONE group covers the whole publishable set. Two groups
					// that cover it between them do not: those packages move separately.
					fixedGroups.some((group) => packages.every((name) => group.includes(name)))
					? "fixed-group"
					: "independent";

		return VersioningStrategy.make({ type, fixedGroups, publishablePackages: packages });
	}

	/**
	 * Classify the ambient workspace: enumerate its packages, keep the ones the
	 * {@link PublishabilityDetector} says publish somewhere, and classify those.
	 *
	 * @remarks
	 * The publishability question is asked through the service precisely so a
	 * consumer with its own rules — honouring a release tool's ignore list, say —
	 * swaps the layer instead of filtering afterwards.
	 *
	 * Requires `WorkspaceDiscovery` and `PublishabilityDetector` (for example
	 * `PublishabilityDetector.layerNpm`) in `R`, and fails with
	 * `WorkspaceDiscoveryFailure` when discovery does.
	 */
	static readonly detect = Effect.fn("VersioningStrategy.detect")(function* (options?: VersioningDetectOptions) {
		const discovery = yield* WorkspaceDiscovery;
		const publishability = yield* PublishabilityDetector;

		const packages = yield* discovery.listPackages;
		// `Effect.forEach` defaults to concurrency 1; this explicit bound is what
		// makes independent publishability checks overlap at all.
		const detected = yield* Effect.forEach(
			packages,
			(candidate) =>
				publishability.detect(candidate).pipe(
					Effect.map((targets) => ({
						name: candidate.name,
						publishable: targets.length > 0,
					})),
				),
			{ concurrency: 10 },
		);
		const publishable: Array<string> = [];
		for (const candidate of detected) {
			if (candidate.publishable) publishable.push(candidate.name);
		}

		return VersioningStrategy.classify({
			packages: publishable,
			// `exactOptionalPropertyTypes` is on: an explicit `undefined` does not
			// satisfy an optional property, so this spreads or it does not appear.
			...(options?.fixedGroups !== undefined && { fixedGroups: options.fixedGroups }),
		});
	});

	/**
	 * The tags a release of `releases` produces under this strategy.
	 *
	 * @remarks
	 * Under `independent` this is one {@link ReleaseTag} per release, in the
	 * order given. Under `single` and `fixed-group` it is exactly one shared tag
	 * carrying the **first** release's version — every release in a lockstep
	 * batch shares a version by construction, so the choice is only visible on a
	 * batch that should not exist. Whether a batch actually agreed is a property
	 * of that batch rather than of the workspace, so it stays the caller's
	 * one-line check rather than a field here.
	 *
	 * An empty batch produces no tags under either style.
	 *
	 * @param releases - The packages released and their versions.
	 * @param options - Tag formatting overrides, such as `versionPrefix`.
	 */
	tagsFor(releases: ReadonlyArray<PackageRelease>, options?: TagFormatOptions): ReadonlyArray<ReleaseTag> {
		if (releases.length === 0) return [];
		if (this.perPackageTags) {
			return releases.map((release) => ReleaseTag.scoped(release.name, release.version, options));
		}
		const first = releases[0];
		return first === undefined ? [] : [ReleaseTag.single(first.version, options)];
	}
}
