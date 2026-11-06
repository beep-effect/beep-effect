/**
 * Offline owner transitions and strict prerequisite qualification.
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { FinalCheckGate } from "./FinalCheck.schemas.ts";
import { finalCheckRefusal } from "./FinalCheck.ts";
import { decideMergeGate, MergeGateInput, MergeGateOptions, MergeGateRead } from "./MergeGate.ts";
import {
  OwnerCheckpointBinding,
  OwnerCheckpointCommand,
  OwnerCheckpointDelivery,
  OwnerCheckpointError,
  OwnerCheckpointIntent,
  OwnerCheckpointMutation,
  OwnerCheckpointOutbox,
  OwnerCheckpointRecord,
  OwnerCheckpointState,
} from "./OwnerCheckpoint.schemas.ts";
import type { Sha256Hex } from "@beep/schema";
import type {
  OwnerCheckpointEvidence,
  OwnerCheckpointPolicy,
  OwnerCheckpointRequest,
  OwnerCheckpointSnapshot,
} from "./OwnerCheckpoint.schemas.ts";

const refuse = (reason: OwnerCheckpointError["reason"]) => OwnerCheckpointError.make({ reason });
const sameBinding = (a: OwnerCheckpointBinding, b: OwnerCheckpointBinding): boolean =>
  a.repository === b.repository &&
  a.prNumber === b.prNumber &&
  a.owner === b.owner &&
  a.head === b.head &&
  a.generation === b.generation;
const verifiedVercelRateLimit = (status: OwnerCheckpointSnapshot["statuses"][number]): boolean =>
  status.state === "failure" &&
  status.diagnostic._tag === "VercelBuildRateLimit" &&
  status.diagnostic.statusId === status.id &&
  status.diagnostic.context === status.context;

/**
 * Qualify upstream readiness without waiting on the check this release publishes.
 *
 * **Details**
 * Only the exact own check-run ID and matching native row from the configured App is removed. Another
 * same-name run remains subject to the strict gate. Classic statuses are checked
 * separately; only exact native vendor build-rate-limit evidence is exempted.
 * This is not a successful full merge-ready observation or server enforcement.
 *
 * **Example** (Inspect the offline prerequisite validator)
 * ```ts
 * import { qualifyOwnerCheckpointSnapshot } from "@beep/repo-cli/test/Yeet"
 * console.log(typeof qualifyOwnerCheckpointSnapshot) // "function"
 * ```
 * @param binding - Exact PR-specific owner binding.
 * @param snapshot - Finite snapshot decoded by a future trusted reader.
 * @param policy - Own App identity and maximum read age.
 * @param now - Authority clock at qualification.
 * @returns Strict upstream merge decision or a finite refusal.
 * @category policies
 * @since 0.0.0
 */
export const qualifyOwnerCheckpointSnapshot = Effect.fn("OwnerCheckpoint.qualifySnapshot")(function* (
  binding: OwnerCheckpointBinding,
  snapshot: OwnerCheckpointSnapshot,
  policy: OwnerCheckpointPolicy,
  now: DateTime.Utc
) {
  const read = snapshot.read;
  if (
    snapshot.repository !== binding.repository ||
    read.prNumber !== binding.prNumber ||
    read.headSha !== binding.head ||
    snapshot.state !== "open"
  )
    return yield* refuse("binding");
  const age = DateTime.toEpochMillis(now) - DateTime.toEpochMillis(read.readAt);
  if (age < 0 || age > policy.maxAgeMillis) return yield* refuse("freshness");
  const own = A.findFirst(read.checkRuns, (run) => run.id === snapshot.selfCheck.id);
  if (
    snapshot.selfCheck.applicationId !== policy.applicationId ||
    !O.exists(
      own,
      (run) =>
        run.name === policy.context &&
        snapshot.selfCheck.run.id === run.id &&
        snapshot.selfCheck.run.name === run.name &&
        snapshot.selfCheck.run.status === run.status &&
        snapshot.selfCheck.run.conclusion === run.conclusion
    )
  )
    return yield* refuse("evidence");
  const latest = A.reduce(
    snapshot.statuses,
    HashMap.empty<string, (typeof snapshot.statuses)[number]>(),
    (map, status) =>
      O.exists(HashMap.get(map, status.context), (current) => current.id >= status.id)
        ? map
        : HashMap.set(map, status.context, status)
  );
  if (
    A.some(
      latest.pipe(HashMap.values, A.fromIterable),
      (status) =>
        DateTime.toEpochMillis(status.updatedAt) > DateTime.toEpochMillis(read.readAt) ||
        (!verifiedVercelRateLimit(status) && status.state !== "success")
    )
  )
    return yield* refuse("gate");
  const upstream = MergeGateRead.make({
    ...read,
    requiredContexts: O.map(read.requiredContexts, (names) => A.filter(names, (name) => name !== policy.context)),
    checkRuns: A.filter(read.checkRuns, (run) => run.id !== snapshot.selfCheck.id),
  });
  const decision = decideMergeGate(
    MergeGateInput.make({
      read: upstream,
      options: MergeGateOptions.make({ wantSha: binding.head, now, tolerate: [], forceWindow: false, relaxed: false }),
    })
  );
  if (decision._tag !== "merge") return yield* refuse("gate");
  return decision;
});

/**
 * Validate finalized, exact-head upstream observer and fresh premerge evidence.
 *
 * **Details**
 * The unactivated caller must authenticate the owner and verify referenced raw
 * receipt hashes before constructing this DTO. A digest field alone proves no
 * authenticity. Final-check policy remains the retained policy, including named
 * skips; this validator never upgrades a skip to executed proof.
 *
 * **Example** (Inspect evidence qualification)
 * ```ts
 * import { qualifyOwnerCheckpointEvidence } from "@beep/repo-cli/test/Yeet"
 * console.log(typeof qualifyOwnerCheckpointEvidence) // "function"
 * ```
 * @param binding - Registered owner and head.
 * @param evidence - Finalized observer, final-check and fresh snapshot.
 * @param policy - Trusted App and freshness policy.
 * @param now - Authority clock.
 * @returns Fresh strict decision; all unknown evidence refuses.
 * @category policies
 * @since 0.0.0
 */
export const qualifyOwnerCheckpointEvidence = Effect.fn("OwnerCheckpoint.qualifyEvidence")(function* (
  binding: OwnerCheckpointBinding,
  evidence: OwnerCheckpointEvidence,
  policy: OwnerCheckpointPolicy,
  now: DateTime.Utc
) {
  if (O.isSome(finalCheckRefusal(O.some(evidence.finalCheck), binding.head))) return yield* refuse("evidence");
  if (
    !A.every(FinalCheckGate.literals, (gate) => A.some(evidence.finalCheck.steps, (step) => step.gate === gate)) ||
    A.some(
      evidence.finalCheck.steps,
      (step) =>
        step.status === "failed" ||
        (step.status === "skipped" && (step.reason === undefined || Str.trim(step.reason).length === 0))
    ) ||
    A.some(evidence.finalCheck.expectationRewrites, (rewrite) => rewrite.classification !== "follows-diff")
  )
    return yield* refuse("evidence");
  const startedAt = yield* Effect.fromOption(DateTime.make(evidence.finalCheck.startedAt), () => refuse("evidence"));
  const finishedAt = yield* Effect.fromOption(DateTime.make(evidence.finalCheck.finishedAt), () => refuse("evidence"));
  const started = DateTime.toEpochMillis(startedAt);
  const finished = DateTime.toEpochMillis(finishedAt);
  const finalized = DateTime.toEpochMillis(evidence.observer.finalizedAt);
  const observed = DateTime.toEpochMillis(evidence.observer.snapshot.read.readAt);
  const classic = DateTime.toEpochMillis(evidence.classic.read.readAt);
  if (
    started > finished ||
    finished > observed ||
    observed > finalized ||
    finalized > classic ||
    classic > DateTime.toEpochMillis(now)
  )
    return yield* refuse("evidence");
  yield* qualifyOwnerCheckpointSnapshot(binding, evidence.observer.snapshot, policy, now);
  return yield* qualifyOwnerCheckpointSnapshot(binding, evidence.classic, policy, now);
});

const mutation = (
  current: OwnerCheckpointRecord,
  state: OwnerCheckpointState,
  intent: OwnerCheckpointIntent,
  binding = current.binding
): OwnerCheckpointMutation => {
  const revision = current.revision + 1;
  return OwnerCheckpointMutation.make({
    record: OwnerCheckpointRecord.make({ binding, revision, state }),
    outbox: OwnerCheckpointOutbox.make({
      binding,
      revision,
      intent,
      delivery: OwnerCheckpointDelivery.cases.Pending.make({}),
    }),
  });
};

const releaseOwner = Effect.fnUntraced(function* (
  current: OwnerCheckpointRecord,
  releaseId: Sha256Hex,
  evidence: OwnerCheckpointEvidence,
  policy: OwnerCheckpointPolicy,
  now: DateTime.Utc
) {
  if (current.state._tag !== "Held") return yield* refuse("state");
  yield* qualifyOwnerCheckpointEvidence(current.binding, evidence, policy, now);
  return mutation(
    current,
    OwnerCheckpointState.cases.Released.make({ releaseId, evidenceDigest: evidence.digest }),
    OwnerCheckpointIntent.cases.CheckReleased.make({ releaseId })
  );
});
const synchronizeOwner = Effect.fnUntraced(function* (current: OwnerCheckpointRecord, head: string) {
  if (
    current.state._tag === "Merged" ||
    current.state._tag === "Claimed" ||
    current.state._tag === "Uncertain" ||
    current.binding.generation >= Number.MAX_SAFE_INTEGER - 1
  )
    return yield* refuse("state");
  if (head === current.binding.head) return yield* refuse("state");
  return mutation(
    current,
    OwnerCheckpointState.cases.Held.make({ reason: "synchronized" }),
    OwnerCheckpointIntent.cases.CheckHeld.make({}),
    OwnerCheckpointBinding.make({ ...current.binding, head, generation: current.binding.generation + 1 })
  );
});
const revokeOwner = Effect.fnUntraced(function* (current: OwnerCheckpointRecord) {
  if (current.state._tag === "Claimed" || current.state._tag === "Uncertain" || current.state._tag === "Merged")
    return yield* refuse("state");
  return mutation(
    current,
    OwnerCheckpointState.cases.Held.make({ reason: "revoked" }),
    OwnerCheckpointIntent.cases.CheckHeld.make({})
  );
});
const claimOwner = Effect.fnUntraced(function* (
  current: OwnerCheckpointRecord,
  claimId: Sha256Hex,
  snapshot: OwnerCheckpointSnapshot,
  policy: OwnerCheckpointPolicy,
  now: DateTime.Utc
) {
  if (current.state._tag !== "Released") return yield* refuse("state");
  yield* qualifyOwnerCheckpointSnapshot(current.binding, snapshot, policy, now);
  return mutation(
    current,
    OwnerCheckpointState.cases.Claimed.make({ releaseId: current.state.releaseId, claimId }),
    OwnerCheckpointIntent.cases.Merge.make({ claimId })
  );
});
const markUnknownOwner = Effect.fnUntraced(function* (current: OwnerCheckpointRecord, claimId: Sha256Hex) {
  if (current.state._tag !== "Claimed" || current.state.claimId !== claimId) return yield* refuse("state");
  return mutation(
    current,
    OwnerCheckpointState.cases.Uncertain.make({ releaseId: current.state.releaseId, claimId }),
    OwnerCheckpointIntent.cases.CheckHeld.make({})
  );
});
const confirmOwner = Effect.fnUntraced(function* (
  current: OwnerCheckpointRecord,
  claimId: Sha256Hex,
  mergeCommit: O.Option<string>
) {
  if ((current.state._tag !== "Claimed" && current.state._tag !== "Uncertain") || current.state.claimId !== claimId)
    return yield* refuse("state");
  return mutation(
    current,
    OwnerCheckpointState.cases.Merged.make({ claimId, mergeCommit }),
    OwnerCheckpointIntent.cases.CheckHeld.make({})
  );
});

/**
 * Decide one exact owner revision transition without any external side effect.
 *
 * **Details**
 * Repeated or concurrent commands fail their old revision assertion. A caller
 * recovers durable state instead of replaying a merge. Synchronization starts a
 * new generation; old outbox entries remain independently retained for audit.
 *
 * **Example** (Inspect the pure transition effect)
 * ```ts
 * import { transitionOwnerCheckpoint } from "@beep/repo-cli/test/Yeet"
 * console.log(typeof transitionOwnerCheckpoint) // "function"
 * ```
 * @param current - Durably read current record.
 * @param request - Authenticated exact revision assertion and domain command.
 * @param policy - Trusted App and freshness policy.
 * @param now - Authority clock.
 * @returns One atomic record and outbox mutation.
 * @category policies
 * @since 0.0.0
 */
export const transitionOwnerCheckpoint = Effect.fn("OwnerCheckpoint.transition")(function* (
  current: OwnerCheckpointRecord,
  request: OwnerCheckpointRequest,
  policy: OwnerCheckpointPolicy,
  now: DateTime.Utc
) {
  if (!sameBinding(current.binding, request.binding)) return yield* refuse("binding");
  if (current.revision >= Number.MAX_SAFE_INTEGER - 1) return yield* refuse("conflict");
  if (current.revision !== request.expectedRevision) return yield* refuse("conflict");
  return yield* OwnerCheckpointCommand.match(request.command, {
    Release: (command) => releaseOwner(current, command.releaseId, command.evidence, policy, now),
    Synchronize: (command) => synchronizeOwner(current, command.head),
    Revoke: () => revokeOwner(current),
    Claim: (command) => claimOwner(current, command.claimId, command.snapshot, policy, now),
    Unknown: (command) => markUnknownOwner(current, command.claimId),
    Confirm: (command) => confirmOwner(current, command.claimId, command.mergeCommit),
  });
});
