/**
 * Fail-closed strict-tier resolution: an emitter context tag and any number
 * of tier requests in, one effective tier out.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { effectiveTier } from "../catalog/Catalog.behavior.ts";
import { stricterTier, TelemetryTier } from "../catalog/Catalog.literals.ts";
import { EmitterContext, StrictDesktop } from "../catalog/Catalog.models.ts";
import { StrictContextSource, StrictTierResolution } from "./StrictTier.schemas.ts";

const decodeContext = S.decodeUnknownOption(EmitterContext);
const decodeTier = S.decodeUnknownOption(TelemetryTier);

/**
 * The context a strict host assumes when it has no tag, or a tag that does
 * not decode: a self-claimed `StrictDesktop`, whose ceiling is `shape-only`.
 *
 * **Example** (Read the fail-closed context)
 *
 * ```ts import.meta.vitest name="Read the fail-closed context"
 * import { FailClosedEmitterContext } from "@beep/observability/strict"
 *
 * FailClosedEmitterContext._tag // => "StrictDesktop"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const FailClosedEmitterContext: StrictDesktop = StrictDesktop.make({ identitySource: "self-claimed" });

const requestedTierOrStrictest = (request: string): TelemetryTier =>
  O.getOrElse(decodeTier(request), () => TelemetryTier.Enum["shape-only"]);

/**
 * Resolves the effective tier of a strict host from its emitter context tag
 * and its tier requests (environment variables, flags).
 *
 * **Details**
 *
 * - No tag, or a tag that does not decode as an `EmitterContext`, resolves to
 *   {@link FailClosedEmitterContext}, so the ceiling is `shape-only`.
 * - The effective tier is the stricter of the context's ceiling and every
 *   present request, so a request only ever lowers the tier.
 * - A present request that is not a tier name counts as `shape-only`.
 *
 * **Example** (A request cannot raise an untagged host)
 *
 * ```ts import.meta.vitest name="A request cannot raise an untagged host"
 * import { resolveStrictTier } from "@beep/observability/strict"
 * import * as O from "effect/Option"
 *
 * resolveStrictTier(O.none(), [O.some("dev-verbose")]).tier // => "shape-only"
 * resolveStrictTier(O.none(), []).contextSource // => "fail-closed"
 * ```
 *
 * @param tagSource - The emitter context tag, if the host has one.
 * @param requests - Tier requests; `None` means the request was not made.
 * @returns The resolved context, its source and the effective tier.
 * @category combinators
 * @since 0.0.0
 */
export const resolveStrictTier: {
  (requests: ReadonlyArray<O.Option<string>>): (tagSource: O.Option<unknown>) => StrictTierResolution;
  (tagSource: O.Option<unknown>, requests: ReadonlyArray<O.Option<string>>): StrictTierResolution;
} = dual(2, (tagSource: O.Option<unknown>, requests: ReadonlyArray<O.Option<string>>): StrictTierResolution => {
  const tagged = O.flatMap(tagSource, decodeContext);
  const context = O.getOrElse(tagged, (): EmitterContext => FailClosedEmitterContext);
  return StrictTierResolution.make({
    context,
    contextSource: O.isSome(tagged) ? StrictContextSource.Enum.tagged : StrictContextSource.Enum["fail-closed"],
    tier: pipe(
      A.getSomes(requests),
      A.map(requestedTierOrStrictest),
      A.reduce(effectiveTier(context, TelemetryTier.Enum["dev-verbose"]), (tier, request) =>
        stricterTier(tier, request)
      )
    ),
  });
});
