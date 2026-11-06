/**
 * Inert merge boundary for an explicitly supplied offline-qualified owner claim.
 * No command, endpoint, running broker, App or automatic retry is registered.
 * @packageDocumentation
 * @since 0.0.0
 */
import { Repo } from "@beep/github/Repo";
import * as Clock from "effect/Clock";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { GithubRest } from "../../../internal/github/index.ts";
import {
  OwnerCheckpointCommand,
  OwnerCheckpointError,
  OwnerCheckpointHead,
  OwnerCheckpointMergeOutcome,
  OwnerCheckpointRequest,
} from "./OwnerCheckpoint.schemas.ts";
import { qualifyOwnerCheckpointSnapshot } from "./OwnerCheckpoint.ts";
import type {
  OwnerCheckpointBinding,
  OwnerCheckpointPolicy,
  OwnerCheckpointRecord,
  OwnerCheckpointSnapshot,
} from "./OwnerCheckpoint.schemas.ts";
import type { makeOwnerCheckpointStore } from "./OwnerCheckpoint.store.ts";

type Store = Effect.Success<ReturnType<typeof makeOwnerCheckpointStore>>;
const decodeHead = S.decodeUnknownResult(OwnerCheckpointHead);
const unknown = Effect.fnUntraced(function* (
  store: Store,
  record: OwnerCheckpointRecord,
  policy: OwnerCheckpointPolicy
) {
  const now = DateTime.makeUnsafe(yield* Clock.currentTimeMillis);
  if (record.state._tag !== "Claimed")
    return OwnerCheckpointMergeOutcome.cases.Uncertain.make({ recording: "pending" });
  const recorded = yield* store
    .apply(
      OwnerCheckpointRequest.make({
        binding: record.binding,
        expectedRevision: record.revision,
        command: OwnerCheckpointCommand.cases.Unknown.make({ claimId: record.state.claimId }),
      }),
      policy,
      now
    )
    .pipe(Effect.result);
  return OwnerCheckpointMergeOutcome.cases.Uncertain.make({
    recording: Result.isSuccess(recorded) ? "recorded" : "pending",
  });
});
const assertRepository = Effect.fnUntraced(function* (binding: OwnerCheckpointBinding) {
  const repo = yield* Repo;
  if (`${repo.owner}/${repo.repo}` !== binding.repository)
    return yield* OwnerCheckpointError.make({ reason: "binding" });
});

/**
 * Execute at most one expected-SHA merge after durable dispatch fencing.
 *
 * **Details**
 * The future isolated broker must authenticate the owner and provide fresh,
 * verified prerequisite metadata. Any uncertain native response is recorded as
 * uncertainty; failed diagnostic persistence leaves the prior dispatched intent
 * intact. No caller is wired to this function by this offline source slice.
 *
 * **Example** (Inspect the expected-head boundary)
 * ```ts
 * import { dispatchOwnerCheckpointMerge } from "@beep/repo-cli/test/Yeet"
 * console.log(typeof dispatchOwnerCheckpointMerge) // "function"
 * ```
 * @param store - Explicitly owned transactional store.
 * @param binding - Released exact PR, owner, generation and head.
 * @param revision - Claimed revision whose outbox has not been dispatched.
 * @param snapshot - Fresh verified upstream snapshot.
 * @param policy - Trusted own-check identity and freshness policy.
 * @returns Native result separated from durability of its result recording.
 * @category workflows
 * @since 0.0.0
 */
export const dispatchOwnerCheckpointMerge = Effect.fn("OwnerCheckpoint.dispatchMerge")(function* (
  store: Store,
  binding: OwnerCheckpointBinding,
  revision: number,
  snapshot: OwnerCheckpointSnapshot,
  policy: OwnerCheckpointPolicy
) {
  const now = DateTime.makeUnsafe(yield* Clock.currentTimeMillis);
  yield* assertRepository(binding);
  yield* qualifyOwnerCheckpointSnapshot(binding, snapshot, policy, now);
  const rest = yield* GithubRest;
  const live = yield* rest
    .pullRequest(binding.prNumber)
    .pipe(Effect.mapError(() => OwnerCheckpointError.make({ reason: "evidence" })));
  if (
    live.number !== binding.prNumber ||
    live.headSha !== binding.head ||
    live.state !== "open" ||
    live.merged ||
    live.draft
  )
    return yield* OwnerCheckpointError.make({ reason: "binding" });
  // Nothing may call merge before this durable fence. A crash afterward is
  // deliberately uncertain even if the HTTP request had not started yet.
  const record = yield* store.prepareDispatch(binding, revision);
  const result = yield* rest
    .mergePullRequest(binding.prNumber, { sha: binding.head, method: "squash" })
    .pipe(Effect.result);
  if (Result.isFailure(result) || !result.success.merged) return yield* unknown(store, record, policy);
  const commit = decodeHead(result.success.sha);
  if (Result.isFailure(commit) || record.state._tag !== "Claimed") return yield* unknown(store, record, policy);
  const confirmed = yield* store
    .apply(
      OwnerCheckpointRequest.make({
        binding,
        expectedRevision: revision,
        command: OwnerCheckpointCommand.cases.Confirm.make({
          claimId: record.state.claimId,
          mergeCommit: O.some(commit.success),
        }),
      }),
      policy,
      now
    )
    .pipe(Effect.result);
  return OwnerCheckpointMergeOutcome.cases.Confirmed.make({
    mergeCommit: O.some(commit.success),
    recording: Result.isSuccess(confirmed) ? "recorded" : "pending",
  });
});

/**
 * Reconcile an uncertain or claimed merge through readback only.
 *
 * **Details**
 * An OPEN response does not prove a timed-out merge request cannot complete;
 * it remains uncertain. The retained REST projection does not include a merge
 * commit SHA, so a readback-confirmed merge preserves that field as unknown.
 *
 * **Example** (Inspect recovery without redispatch)
 * ```ts
 * import { observeOwnerCheckpointMerge } from "@beep/repo-cli/test/Yeet"
 * console.log(typeof observeOwnerCheckpointMerge) // "function"
 * ```
 * @param store - Explicitly owned durable store.
 * @param binding - The original exact PR binding.
 * @param policy - Trusted checkpoint policy.
 * @returns Readback confirmation or continued uncertainty, never another merge.
 * @category workflows
 * @since 0.0.0
 */
export const observeOwnerCheckpointMerge = Effect.fn("OwnerCheckpoint.observeMerge")(function* (
  store: Store,
  binding: OwnerCheckpointBinding,
  policy: OwnerCheckpointPolicy
) {
  const now = DateTime.makeUnsafe(yield* Clock.currentTimeMillis);
  yield* assertRepository(binding);
  const current = yield* store.read(binding);
  if (
    O.isNone(current) ||
    current.value.binding.head !== binding.head ||
    current.value.binding.owner !== binding.owner ||
    current.value.binding.generation !== binding.generation ||
    (current.value.state._tag !== "Claimed" && current.value.state._tag !== "Uncertain")
  )
    return yield* OwnerCheckpointError.make({ reason: "state" });
  const rest = yield* GithubRest;
  const live = yield* rest.pullRequest(binding.prNumber).pipe(Effect.result);
  if (
    Result.isFailure(live) ||
    live.success.number !== binding.prNumber ||
    live.success.headSha !== binding.head ||
    !live.success.merged ||
    live.success.state !== "closed"
  )
    return OwnerCheckpointMergeOutcome.cases.Uncertain.make({
      recording: current.value.state._tag === "Uncertain" ? "recorded" : "pending",
    });
  const record = current.value;
  const claimId = current.value.state.claimId;
  const recorded = yield* store
    .apply(
      OwnerCheckpointRequest.make({
        binding,
        expectedRevision: record.revision,
        command: OwnerCheckpointCommand.cases.Confirm.make({ claimId, mergeCommit: O.none() }),
      }),
      policy,
      now
    )
    .pipe(Effect.result);
  return OwnerCheckpointMergeOutcome.cases.Confirmed.make({
    mergeCommit: O.none(),
    recording: Result.isSuccess(recorded) ? "recorded" : "pending",
  });
});
