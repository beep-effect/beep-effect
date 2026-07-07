/**
 * Dependency profile and fan value model definitions.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoUtilsId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $RepoUtilsId.create("JSDoc/models/DependencyProfile.model");

/**
 * Fan-in / fan-out intensity classification.
 *
 * @example
 * ```ts
 * import { FanValue } from "@beep/repo-utils/JSDoc/models/DependencyProfile.model"
 *
 * const fan = FanValue.Enum.high
 * console.log(FanValue.is.high(fan))
 * ```
 * @category models
 * @since 0.0.0
 */
export const FanValue = LiteralKit(["low", "medium", "high"]).pipe(
  $I.annoteSchema("FanValue", {
    description: "Relative fan-in/fan-out intensity used by JSDoc category dependency-profile metadata.",
  })
);

/**
 * Inferred type for {@link FanValue}.
 *
 * @example
 * ```ts
 * import type { FanValue } from "@beep/repo-utils/JSDoc/models/DependencyProfile.model"
 *
 * type Example = FanValue
 * const accept = <A extends Example>(value: A): A => value
 * console.log(accept)
 * ```
 * @category models
 * @since 0.0.0
 */
export type FanValue = typeof FanValue.Type;

/**
 * Dependency direction profile. Used to validate classifications:
 * if something classified as domain logic has high fan-out, that is a
 * misclassification signal.
 *
 * @example
 * ```ts
 * import { DependencyProfile } from "@beep/repo-utils/JSDoc/models/DependencyProfile.model"
 *
 * const profile = DependencyProfile.make({
 *   typicalFanIn: "high",
 *   typicalFanOut: "low"
 * })
 * console.log(profile.typicalFanOut)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DependencyProfile extends S.Class<DependencyProfile>($I`DependencyProfile`)(
  {
    /** How many other categories typically depend on this one */
    typicalFanIn: FanValue.annotateKey({
      description: "How many other categories typically depend on this one",
    }),
    /** How many other categories this one typically depends on */
    typicalFanOut: FanValue.annotateKey({
      description: "How many other categories this one typically depends on",
    }),
  },
  $I.annote("DependencyProfile", {
    description:
      "Dependency direction profile. Used to validate classifications: if something classified as domain logic has high fan-out, that is a misclassification signal.",
  })
) {}
