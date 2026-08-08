/**
 * Epistemic fixture-key value schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $EpistemicDomainId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $EpistemicDomainId.create("values/EpistemicFixtureKey/EpistemicFixtureKey.model");

/**
 * Stable non-empty fixture/reference key used by epistemic fixtures and projections.
 *
 * **Example** (Make fixture key from string)
 *
 * ```ts
 * import { EpistemicFixtureKey } from "@beep/epistemic-domain"
 *
 * const fixtureKey = EpistemicFixtureKey.make("claim.patentability")
 * console.log(fixtureKey)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EpistemicFixtureKey = S.NonEmptyString.pipe(
  $I.annoteSchema("EpistemicFixtureKey", {
    description: "Stable non-empty fixture/reference key used by epistemic fixtures and projections.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link EpistemicFixtureKey}.
 *
 * **Example** (Type a fixture key value)
 *
 * ```ts
 * import { EpistemicFixtureKey } from "@beep/epistemic-domain"
 * import type { EpistemicFixtureKey as EpistemicFixtureKeyValue } from "@beep/epistemic-domain"
 *
 * const fixtureKey: EpistemicFixtureKeyValue = EpistemicFixtureKey.make("claim.patentability")
 * console.log(fixtureKey)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EpistemicFixtureKey = typeof EpistemicFixtureKey.Type;
