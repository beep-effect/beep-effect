/**
 * Grant-set construction errors.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $EpistemicDomainId } from "@beep/identity/packages";
import { TaggedErrorClass } from "@beep/schema";
import { PolicyRevision } from "../ExecutionGrant/index.ts";

const $I = $EpistemicDomainId.create("values/GrantSet/GrantSet.errors");

/**
 * A grant issued under one policy revision was offered to a set pinned to
 * another. Rejected rather than absorbed: every execution decision records the
 * set's revision, so admitting a foreign-revision grant would make that
 * recorded revision a lie about which policy actually authorized the action.
 *
 * @example
 * ```ts
 * import { GrantRevisionMismatch } from "@beep/epistemic-domain"
 * import { PolicyRevision } from "@beep/epistemic-domain"
 * import * as S from "effect/Schema"
 *
 * const error = GrantRevisionMismatch.between(
 *   S.decodeUnknownSync(PolicyRevision)("1.0.0"),
 *   S.decodeUnknownSync(PolicyRevision)("2.0.0")
 * )
 * console.log(error.grantRevision)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class GrantRevisionMismatch extends TaggedErrorClass<GrantRevisionMismatch>($I`GrantRevisionMismatch`)(
  "GrantRevisionMismatch",
  {
    setRevision: PolicyRevision,
    grantRevision: PolicyRevision,
  },
  $I.annote("GrantRevisionMismatch", {
    title: "Grant revision mismatch",
    description: "A grant's policy revision does not match the revision its grant set is pinned to.",
  })
) {
  /**
   * Build a {@link GrantRevisionMismatch} from the set's and grant's revisions.
   *
   * @example
   * ```ts
   * import { GrantRevisionMismatch, PolicyRevision } from "@beep/epistemic-domain"
   * import * as S from "effect/Schema"
   *
   * const error = GrantRevisionMismatch.between(
   *   S.decodeUnknownSync(PolicyRevision)("1.0.0"),
   *   S.decodeUnknownSync(PolicyRevision)("2.0.0")
   * )
   * console.log(error.setRevision)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static between(setRevision: PolicyRevision, grantRevision: PolicyRevision): GrantRevisionMismatch {
    return GrantRevisionMismatch.make({ setRevision, grantRevision });
  }
}
