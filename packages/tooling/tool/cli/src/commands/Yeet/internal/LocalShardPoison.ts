/**
 * Local proof-shard poison-pill lifecycle.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { DateTime, Effect } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { writeYeetAckReceipt, YeetAckFixResolution, YeetAckReceipt } from "./Ack.ts";
import {
  appendYeetInboxRowOnce,
  YeetLocalShardFailedRow,
  YeetLocalShardFailureCapsule,
  yeetLocalShardFailedRowId,
} from "./Inbox.ts";
import { loadYeetInboxView } from "./InboxView.ts";
import type { FileSystem, Path } from "effect";
import type { YeetCommandError } from "../Yeet.errors.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/LocalShardPoison");

/**
 * Result coordinates for one named local proof shard.
 *
 * **Example** (Describe a failed package check)
 *
 * ```ts
 * import { YeetLocalShardOutcome } from "@beep/repo-cli/test/Yeet"
 *
 * const outcome = YeetLocalShardOutcome.make({
 *   command: "bun run beep:check", exitCode: 1, headSha: "abc123", shard: "package:@beep/demo:check"
 * })
 * console.log(outcome.exitCode) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetLocalShardOutcome extends S.Class<YeetLocalShardOutcome>($I`YeetLocalShardOutcome`)(
  {
    command: S.NonEmptyString,
    exitCode: S.Finite,
    headSha: S.NonEmptyString,
    shard: S.NonEmptyString,
  },
  $I.annote("YeetLocalShardOutcome", {
    description: "Result coordinates for one named local proof shard on one repository head.",
  })
) {}

/**
 * Persist a failed local shard as a P0 row, or clear matching poison rows after success.
 *
 * **Details**
 *
 * Failure rows are immutable and deduplicated by head, shard, and command. A
 * successful rerun acknowledges every still-open row for the same shard with
 * the current head SHA, including poison inherited from an older head.
 *
 * **Example** (Build the update effect)
 *
 * ```ts
 * import { recordYeetLocalShardOutcome, YeetLocalShardOutcome } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const update = recordYeetLocalShardOutcome("/repo", YeetLocalShardOutcome.make({
 *   command: "bun run beep:check", exitCode: 0, headSha: "abc123", shard: "full:check"
 * }))
 * console.log(Effect.isEffect(update)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const recordYeetLocalShardOutcome = Effect.fn("Yeet.recordYeetLocalShardOutcome")(function* (
  repoRoot: string,
  outcome: YeetLocalShardOutcome
): Effect.fn.Return<void, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const observedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  if (outcome.exitCode !== 0) {
    const capsule = YeetLocalShardFailureCapsule.make(outcome);
    yield* appendYeetInboxRowOnce(
      repoRoot,
      YeetLocalShardFailedRow.make({
        capsule,
        checkout: repoRoot,
        id: yeetLocalShardFailedRowId(capsule),
        severity: "P0",
        ts: observedAt,
      })
    );
    return;
  }

  const inbox = yield* loadYeetInboxView(repoRoot);
  const matching = A.filter(
    inbox.entries,
    (entry) => entry.row.kind === "local-shard-failed" && entry.row.capsule.shard === outcome.shard && !entry.ack.acked
  );
  yield* Effect.forEach(
    matching,
    (entry) =>
      writeYeetAckReceipt(
        repoRoot,
        YeetAckReceipt.make({
          ackedAt: observedAt,
          id: entry.row.id,
          resolution: YeetAckFixResolution.make({ sha: outcome.headSha }),
        })
      ),
    { discard: true }
  );
});
