import { $ScratchpadId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effected/engine/Distribution");

/**
 * The carrier package a tool's bins were installed through.
 *
 * **Details**
 *
 * A carrier (`@scope/plugin`) re-exposes its front ends' bins and passes its
 * own identity down to each front end's `main`. A plain struct rather than a
 * `Schema.Class`, because it travels in JSON envelopes as a plain object and
 * is compared structurally.
 *
 * **Example** (Decode a carrier identity)
 *
 * ```ts
 * import { Distribution } from "@beep/scratchpad/effected/engine/Distribution"
 * import * as S from "effect/Schema"
 *
 * const carrier = S.decodeUnknownSync(Distribution)({ name: "@okfit/plugin", version: "0.5.1" })
 * console.log(carrier.name) // @okfit/plugin
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const Distribution = S.Struct({
	name: S.String.annotateKey({ description: "The carrier package that installed and re-exposes the tool's bins" }),
	version: S.String.annotateKey({ description: "The version of the carrier package that installed the tool's bins" }),
}).pipe($I.annoteSchema("Distribution", { description: "The carrier package a tool's bins were installed through." }));

/**
 * A decoded {@link (Distribution:variable)}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type Distribution = typeof Distribution.Type;

/**
 * The `distribution` field of a machine-readable envelope: `null` when the
 * front end was installed directly rather than through a carrier.
 *
 * **Example** (Validate a direct install)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { DistributionField } from "@beep/scratchpad/effected/engine/Distribution"
 *
 * console.log(S.is(DistributionField)(null)) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const DistributionField = S.NullOr(Distribution).pipe(
	$I.annoteSchema("DistributionField", {
		description:
			"The distribution field of a machine-readable envelope: null when the front end was installed directly rather than through a carrier.",
	}),
);

/**
 * A decoded nullable carrier field from a machine-readable envelope.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type DistributionField = typeof DistributionField.Type;

/**
 * The carrier this run was installed through, read anywhere without
 * appearing in `R`.
 *
 * **Details**
 *
 * A `Context.Reference`, not a `Context.Service`: it carries its own default
 * (`Option.none()`), so a direct install needs no provision at all. A front
 * end's `main` provides it once, at the top of the program, with
 * `Effect.provideService(CurrentDistribution, Option.fromNullishOr(options.distribution))`.
 *
 * **Example** (Read the default and provide a carrier)
 *
 * ```ts
 * import { CurrentDistribution } from "@beep/scratchpad/effected/engine/Distribution"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * console.log(O.isNone(Effect.runSync(CurrentDistribution))) // true
 * const provided = Effect.provideService(CurrentDistribution, CurrentDistribution, O.some({ name: "@okfit/plugin", version: "0.5.1" }))
 * console.log(O.isSome(Effect.runSync(provided))) // true
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export const CurrentDistribution: Context.Reference<O.Option<Distribution>> = Context.Reference(
	$I`CurrentDistribution`,
	{ defaultValue: () => O.none() },
);

/**
 * The `via <name> <version>` suffix (prefixed with a space) a `--version`
 * line or a startup log line appends, or `""` for a direct install.
 *
 * **Example** (Format direct and carrier installs)
 *
 * ```ts
 * import { distributionSuffix } from "@beep/scratchpad/effected/engine/Distribution"
 * import * as O from "effect/Option"
 *
 * console.log(distributionSuffix(O.none()) === "") // true
 * console.log(distributionSuffix(O.some({ name: "@okfit/plugin", version: "0.5.1" }))) //  via @okfit/plugin 0.5.1
 * ```
 *
 * @public
 * @category formatting
 * @since 0.0.0
 */
export const distributionSuffix = (distribution: O.Option<Distribution>): string =>
	O.match(distribution, {
		onNone: () => "",
		onSome: ({ name, version }) => ` via ${name} ${version}`,
	});
