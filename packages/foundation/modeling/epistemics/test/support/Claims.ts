import { makeClaimArrows } from "@beep/epistemics/ClaimCore";
import { makeClaimCore } from "@beep/epistemics/ClaimCore.schema";
import { $EpistemicsId } from "@beep/identity/packages";
import { ActivityId } from "@beep/schema/ContentHash";
import * as DateTime from "effect/DateTime";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { ClaimId } from "@beep/epistemics/ClaimCore.schema";

const $I = $EpistemicsId.create("test/support/Claims");
const Proposition = S.Struct({ subject: S.Int, text: S.NonEmptyString });

/**
 * The synthetic owner's complete claim vocabulary.
 *
 * **Example** (Inspect a core field)
 * ```ts
 * import { Claims } from "./Claims"
 * console.log(Claims.ClaimCore.fields.logicalKey)
 * ```
 * @category testing
 * @since 0.0.0
 */
export const Claims = makeClaimCore({
  $I,
  proposition: Proposition,
  ids: {
    logicalKey: (p) => `subject:${p.subject}`,
    scope: S.NonEmptyString,
    principal: S.NonEmptyString,
    action: S.NonEmptyString,
    revision: S.NonEmptyString,
  },
});

/**
 * The synthetic owner's branded immutable core.
 *
 * **Example** (Inspect the proposition codec)
 * ```ts
 * import { Core } from "./Claims"
 * console.log(Core.fields.proposition)
 * ```
 * @category testing
 * @since 0.0.0
 */
export class Core extends S.Opaque<Core, { readonly brand: unique symbol }>()(Claims.ClaimCore) {}

/**
 * Checked arrows bound to the synthetic owner.
 *
 * **Example** (Inspect minting)
 * ```ts
 * import { arrows } from "./Claims"
 * console.log(typeof arrows.mint)
 * ```
 * @category testing
 * @since 0.0.0
 */
export const arrows = makeClaimArrows(Claims);

/**
 * Explicit synthetic claim generation activity.
 *
 * **Example** (Read the generation id)
 * ```ts
 * import { activity } from "./Claims"
 * console.log(activity)
 * ```
 * @category testing
 * @since 0.0.0
 */
export const activity = ActivityId.make(`sha256:${Str.repeat(64)("a")}`);

/**
 * Construct explicit creation facts for synthetic law cases.
 *
 * **Example** (Read a fixture subject)
 * ```ts
 * import { coreAt } from "./Claims"
 * console.log(coreAt({ at: 1 }).proposition.subject)
 * ```
 * @category testing
 * @since 0.0.0
 */
export const coreAt = ({
  at,
  subject = 1,
  scope = "fixture",
  parents = HashSet.empty<ClaimId>(),
  supersedes = O.none(),
}: {
  readonly at: number;
  readonly subject?: number;
  readonly scope?: string;
  readonly parents?: HashSet.HashSet<ClaimId>;
  readonly supersedes?: O.Option<ClaimId>;
}) =>
  Core.make({
    proposition: { subject, text: `subject ${subject}` },
    logicalKey: `subject:${subject}`,
    supportAtCreation: HashSet.empty(),
    derivedFrom: parents,
    supersedes,
    generatedBy: activity,
    assertedBy: Claims.AgentRef.cases.Person.make({ principal: "fixture" }),
    valid: { _tag: "Unknown" },
    knowledgeStart: DateTime.makeUnsafe(at),
    scope,
  });
