import { $ScratchpadId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effected/engine/Distribution");

/**
 * The carrier package a tool's bins were installed through.
 *
 * @remarks
 * A carrier (`@scope/plugin`) re-exposes its front ends' bins and passes its
 * own identity down to each front end's `main`. A plain struct rather than a
 * `Schema.Class`, because it travels in JSON envelopes as a plain object and
 * is compared structurally.
 *
 * @public
 */
export const Distribution = S.Struct({
	name: S.String.annotateKey({ description: "The carrier package that installed and re-exposes the tool's bins" }),
	version: S.String.annotateKey({ description: "The version of the carrier package that installed the tool's bins" }),
}).pipe($I.annoteSchema("Distribution", { description: "The carrier package a tool's bins were installed through." }));

/**
 * A decoded {@link (Distribution:variable)}.
 *
 * @public
 */
export type Distribution = typeof Distribution.Type;

/**
 * The `distribution` field of a machine-readable envelope: `null` when the
 * front end was installed directly rather than through a carrier.
 *
 * @public
 */
export const DistributionField = S.NullOr(Distribution);

/**
 * The carrier this run was installed through, read anywhere without
 * appearing in `R`.
 *
 * @remarks
 * A `Context.Reference`, not a `Context.Service`: it carries its own default
 * (`Option.none()`), so a direct install needs no provision at all. A front
 * end's `main` provides it once, at the top of the program, with
 * `Effect.provideService(CurrentDistribution, Option.fromNullishOr(options.distribution))`.
 *
 * @public
 */
export const CurrentDistribution: Context.Reference<O.Option<Distribution>> = Context.Reference(
	$I`CurrentDistribution`,
	{ defaultValue: () => O.none() },
);

/**
 * The `via <name> <version>` suffix (prefixed with a space) a `--version`
 * line or a startup log line appends, or `""` for a direct install.
 *
 * @public
 */
export const distributionSuffix = (distribution: O.Option<Distribution>): string =>
	O.match(distribution, {
		onNone: () => "",
		onSome: ({ name, version }) => ` via ${name} ${version}`,
	});
