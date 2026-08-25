/**
 * Tagged errors for the packet-core event stream.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Goals/PacketCore/PacketCore.errors");

/**
 * Failure raised when a packet event stream cannot be read, decoded, or
 * safely appended to.
 *
 * **Details**
 *
 * The read path never raises this — unreadable or invalid events surface as
 * chain issues so checks stay advisory. The write path raises it: appending
 * to a stream with integrity issues or an unresolved fork would extend an
 * ambiguous chain, so the guarded writer refuses instead.
 *
 * **Example** (Create a stream error)
 *
 * ```ts
 * import { PacketStreamError } from "@beep/repo-cli/test/Goals"
 *
 * const error = PacketStreamError.new("demo", "stream is forked; repair before writing.")
 * console.log(error.packet)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PacketStreamError extends S.TaggedError<PacketStreamError>($I`PacketStreamError`)(
  "PacketStreamError",
  {
    packet: S.String,
    message: S.String,
  },
  $I.annoteError<PacketStreamError>("PacketStreamError", {
    description: "A packet event stream cannot be read, decoded, or safely appended to.",
  })
) {
  /**
   * Construct a stream error.
   *
   * @param packet - Packet slug whose stream failed.
   * @param message - Diagnostic message describing the failure.
   * @returns A typed stream error.
   * @category constructors
   * @since 0.0.0
   */
  static readonly new = (packet: string, message: string): PacketStreamError =>
    PacketStreamError.make({ packet, message });
}

/**
 * Failure raised when a compare-and-set append loses to a concurrent write.
 *
 * **Details**
 *
 * The writer's plan recorded an expected revision; by append time the folded
 * stream had moved past it. The failing append writes nothing itself, and no
 * projection or manifest edit happens until every planned append lands. In a
 * multi-event plan, events appended before the conflict remain — they extend
 * the valid linear chain (never a fork or corruption) — and the operator
 * re-plans against the moved tip.
 *
 * **Example** (Create a CAS conflict error)
 *
 * ```ts
 * import { PacketCasConflictError } from "@beep/repo-cli/test/Goals"
 *
 * const error = PacketCasConflictError.make({
 *   packet: "demo",
 *   expectedRevision: 1,
 *   actualRevision: 2,
 *   message: "stream moved from revision 1 to 2 during the transition.",
 * })
 * console.log(error.actualRevision)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PacketCasConflictError extends S.TaggedError<PacketCasConflictError>($I`PacketCasConflictError`)(
  "PacketCasConflictError",
  {
    packet: S.String,
    expectedRevision: S.Finite,
    actualRevision: S.Finite,
    message: S.String,
  },
  $I.annoteError<PacketCasConflictError>("PacketCasConflictError", {
    description: "A compare-and-set append lost to a concurrent write; the transition is refused whole.",
  })
) {}
