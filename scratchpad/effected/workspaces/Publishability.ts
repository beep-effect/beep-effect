// Whether a workspace package is publishable, and where to.
//
// A service rather than a function precisely so it is swappable: standard npm
// semantics are the default, and an organization with its own publish rules
// replaces the layer with `Layer.succeed` instead of forking the package.

import { Context, Effect, Layer, Schema } from "effect";
import type { WorkspacePackage } from "./WorkspacePackage.ts";

/** The public npm registry, used when `publishConfig.registry` says nothing. */
const DEFAULT_REGISTRY = "https://registry.npmjs.org/";

/**
 * A resolved publish destination for a workspace package.
 *
 * @public
 */
export class PublishTarget extends Schema.Class<PublishTarget>("PublishTarget")({
	/** The package name being published. */
	name: Schema.NonEmptyString,
	/** The registry URL. */
	registry: Schema.NonEmptyString,
	/** The directory to publish, relative to the package root; `"."` for the root itself. */
	directory: Schema.String,
	/** Scoped-package visibility. */
	access: Schema.Literals(["public", "restricted"]),
	/** Whether to publish with a provenance attestation. */
	provenance: Schema.Boolean.pipe(
		Schema.withDecodingDefaultKey(Effect.succeed(false)),
		Schema.withConstructorDefault(Effect.succeed(false)),
	),
}) {}

/**
 * The {@link PublishabilityDetector} service shape.
 *
 * @remarks
 * The error channel is deliberately `never`: every consumer of the service —
 * a release planner iterating a whole workspace — treats "does this publish"
 * as a total question, so an overriding layer whose lookup can fail must
 * **degrade or die**. Fold a recoverable failure into a safe answer (usually
 * the empty target list), or `Effect.orDie` it into the defect channel; it
 * cannot widen the channel the contract declares. See
 * {@link PublishabilityDetector} for the adapter an overriding consumer
 * writes.
 *
 * @public
 */
export interface PublishabilityDetectorShape {
	/**
	 * The publish targets for a package; empty means it does not publish.
	 *
	 * @remarks
	 * `VersioningStrategy.detect` probes a whole workspace by invoking this
	 * concurrently — up to ten packages in flight at once, in no guaranteed
	 * order. An overriding implementation backed by shared mutable state or a
	 * rate-limited client must tolerate that interleaving itself; the caller
	 * does not serialize on its behalf.
	 */
	readonly detect: (pkg: WorkspacePackage) => Effect.Effect<ReadonlyArray<PublishTarget>>;
}

/**
 * Decides whether a workspace package publishes, and to where.
 *
 * @remarks
 * The default layer implements standard npm semantics: a `private` package with
 * no `publishConfig.access` publishes nowhere; an explicit
 * `publishConfig.access` overrides `private`; anything else publishes to the
 * public registry with defaults.
 *
 * Those are *npm's* semantics, not necessarily yours. Swap the layer:
 *
 * @example
 * ```ts
 * import { PublishabilityDetector, PublishTarget } from "./index.ts";
 * import { Effect, Layer } from "effect";
 *
 * const internalOnly = Layer.succeed(PublishabilityDetector, {
 *   detect: (pkg) =>
 *     Effect.succeed(
 *       pkg.name.startsWith("@acme/")
 *         ? [PublishTarget.make({
 *             name: pkg.name,
 *             registry: "https://npm.acme.internal/",
 *             directory: ".",
 *             access: "restricted",
 *           })]
 *         : [],
 *     ),
 * });
 * ```
 *
 * @example
 * The shape's error channel is `never` — **degrade or die**. An override
 * backed by something fallible (a policy service, a registry probe) folds its
 * failure structurally over `{ readonly message: string }` — matching every
 * `Error`, every Effect schema error class, and anything else carrying a
 * message — and either degrades to a safe answer or dies:
 *
 * ```ts
 * import { PublishabilityDetector, PublishTarget } from "./index.ts";
 * import { Effect, Layer } from "effect";
 *
 * declare const lookupPolicy: (
 *   name: string,
 * ) => Effect.Effect<ReadonlyArray<PublishTarget>, { readonly message: string }>;
 *
 * const fromPolicyService = Layer.succeed(PublishabilityDetector, {
 *   detect: (pkg) =>
 *     lookupPolicy(pkg.name).pipe(
 *       Effect.catch((error) =>
 *         Effect.die(new Error(`publishability policy lookup failed for ${pkg.name}: ${error.message}`)),
 *       ),
 *     ),
 * });
 * ```
 *
 * A lookup failure that should *not* abort the run degrades instead —
 * `Effect.catch(() => Effect.succeed([]))` reads as "unknown means
 * unpublishable" — but pick one deliberately; silently swallowing the failure
 * into a wrong "publishes to npm" answer is the one option the contract
 * forbids.
 *
 * @public
 */
export class PublishabilityDetector extends Context.Service<PublishabilityDetector, PublishabilityDetectorShape>()(
	"@effected/workspaces/PublishabilityDetector",
) {
	/**
	 * Standard npm publishing semantics, **as a value**. Pure — no filesystem,
	 * no platform services. Never publishes with provenance (`provenance: false`).
	 *
	 * @remarks
	 * Exposed as a shape and not only as a layer, because a consumer composing
	 * *around* these rules cannot reach them through a layer without
	 * re-entering the very tag it is replacing. A custom detector's pass-through
	 * branch calls `PublishabilityDetector.npm.detect(pkg)` directly.
	 *
	 * @example
	 * ```ts
	 * import { PublishabilityDetector } from "./index.ts";
	 * import { Effect, Layer } from "effect";
	 *
	 * // A policy that defers to npm semantics for everything it does not veto.
	 * const withVeto = Layer.succeed(PublishabilityDetector, {
	 *   detect: (pkg) =>
	 *     pkg.name.endsWith("-private")
	 *       ? Effect.succeed([])
	 *       : PublishabilityDetector.npm.detect(pkg),
	 * });
	 * ```
	 */
	static readonly npm: PublishabilityDetectorShape = {
		detect: (pkg: WorkspacePackage) =>
			Effect.sync(() => {
				const config = pkg.publishConfig;
				const access = config?.access;

				// Private and silent about access: npm will not publish it.
				if (pkg.private && access === undefined) return [] as ReadonlyArray<PublishTarget>;

				return [
					PublishTarget.make({
						name: pkg.name,
						registry: config?.registry ?? DEFAULT_REGISTRY,
						directory: config?.directory ?? ".",
						access: access ?? "public",
						provenance: false,
					}),
				];
			}),
	};

	/** Nothing publishes. */
	static readonly none: PublishabilityDetectorShape = {
		detect: () => Effect.succeed([] as ReadonlyArray<PublishTarget>),
	};

	/**
	 * {@link PublishabilityDetector.npm} as a layer.
	 *
	 * @remarks
	 * Named for its policy rather than called `layer`, deliberately. **No
	 * composite in this package provides a publishability detector**: one that
	 * quietly supplied npm semantics would hide the choice and, because
	 * `Layer.mergeAll` is last-wins, would let a naively-ordered override such
	 * as `Layer.mergeAll(myDetector, Workspaces.layer())` lose to the default in
	 * silence. For a service that decides whether a package publishes and to
	 * which registry, that silent revert is the worst available failure.
	 *
	 * The composites do not *require* a detector either — nothing inside them
	 * asks a publishability question, so their `R` stays `FileSystem | Path`.
	 * The requirement instead surfaces in the `R` of each operation that asks
	 * (`VersioningStrategy.detect`, e.g.): a program that asks and never wires
	 * a detector fails to compile where that operation's `R` must close — which
	 * can be far from the layer-wiring site — and a program that never asks
	 * never supplies a publish policy at all.
	 */
	static readonly layerNpm: Layer.Layer<PublishabilityDetector> = Layer.succeed(this, this.npm);

	/**
	 * {@link PublishabilityDetector.none} as a layer: a workspace where nothing
	 * publishes.
	 *
	 * @remarks
	 * For dry runs, and for a release tool whose configuration disables
	 * publishing wholesale — silk's changeset `mode: "none"` is exactly this.
	 */
	static readonly layerNone: Layer.Layer<PublishabilityDetector> = Layer.succeed(this, this.none);
}
