/**
 * Hook decision kernel — the pure-Effect port of `.claude/hooks/yeet-inbox.sh`.
 *
 * Observations (process liveness, clock) are gathered outside transactions;
 * every state mutation is a generation-fenced `Effect.tx` CAS, mirroring the
 * bash `jq select(.generationId == $expected) | ... | mv -f` idiom.
 */
import {
  Clock,
  Context,
  Effect,
  Layer,
  TxHashMap,
  TxQueue,
  TxRef,
  TxSemaphore
} from "effect";
import * as A from "effect/Array";
import * as O from "@beep/utils/Option";
import {
  ackActiveAt,
  BlockStop, CheckoutMutatingTool,
  ContextOut,
  Deny,
  EmptyStop,
  type HookDecision,
  type HookRequest,
  type InboxRow,
  isNewWorkCommand,
  isValidRowId,
  leaseStatus, NewWorkLaunchTool,
  type PrLease,
  renderContext,
  rowLabel,
  rowLiveness,
  sessionKey,
  type SessionState,
  type Severity,
  Silence,
  Tail
} from "./Domain.ts";
import {emptySessionState, rowDetail} from "./Domain.ts";
import {
  InboxState,
  type InboxStateShape,
  makeMutexCell,
  type MutexCell,
  YeetConfig
} from "./InboxState.ts";
import {hasAncestor, isFrozenState, ProcessInspector} from "./Processes.ts";

// ---------------------------------------------------------------------------
// Row filtering
// ---------------------------------------------------------------------------

const activeAckIds = Effect.fnUntraced(function* (state: InboxStateShape, nowMillis: number) {
  const entries = yield* TxHashMap.entries(state.acks);
  const active = new Set<string>();
  for (const [id, ack] of entries) {
    if (ackActiveAt(ack, nowMillis)) active.add(id);
  }
  return active;
});

const firstObservationById = (rows: ReadonlyArray<InboxRow>): Array<InboxRow> => {
  const seen = new Set<string>();
  const out: Array<InboxRow> = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
};

/** Main entries pipeline: valid id, first observation per id, unacked, not superseded. */
const liveEntries = Effect.fnUntraced(function* (state: InboxStateShape, nowMillis: number) {
  const rows = yield* TxRef.get(state.rows);
  const wave = yield* TxRef.get(state.wave);
  const acks = yield* activeAckIds(state, nowMillis);
  return firstObservationById(rows.filter((row) => isValidRowId(row.id)))
    .filter((row) => !acks.has(row.id))
    .filter((row) => rowLiveness(row, wave) !== "superseded");
});

/** Stop-path P0 rows: like the bash `unacked_stop_p0_rows` — no id-validity filter. */
const stopP0Rows = Effect.fnUntraced(function* (state: InboxStateShape, nowMillis: number) {
  const rows = yield* TxRef.get(state.rows);
  const wave = yield* TxRef.get(state.wave);
  const acks = yield* activeAckIds(state, nowMillis);
  return firstObservationById(rows.filter((row) => row.severity === "P0"))
    .filter((row) => !acks.has(row.id))
    .filter((row) => rowLiveness(row, wave) !== "superseded");
});

// ---------------------------------------------------------------------------
// Session state
// ---------------------------------------------------------------------------

const getSession = (state: InboxStateShape, key: string) =>
  TxHashMap.get(state.sessions, key).pipe(Effect.map(O.getOrElse(() => emptySessionState)));

const updateSession = (
  state: InboxStateShape,
  key: string,
  update: (session: SessionState) => SessionState
) =>
  Effect.tx(Effect.gen(function* () {
    const session = yield* getSession(state, key);
    yield* TxHashMap.set(state.sessions, key, update(session));
  }));

const markSeen = (state: InboxStateShape, key: string, ids: ReadonlyArray<string>) =>
  updateSession(state, key, (session) => ({
    ...session,
    seenIds: A.dedupe([...session.seenIds, ...ids])
  }));

const unseenFor = (
  entries: ReadonlyArray<InboxRow>,
  severities: ReadonlyArray<Severity>,
  session: SessionState
): Array<InboxRow> =>
  entries.filter((row) => severities.includes(row.severity) && !session.seenIds.includes(row.id));

// ---------------------------------------------------------------------------
// Lease observation
// ---------------------------------------------------------------------------

export interface LeaseObservation {
  readonly lease: PrLease;
  readonly ownerAlive: boolean;
  readonly ownerFrozen: boolean;
  readonly ownerStale: boolean;
  readonly ownedByCurrent: boolean;
  readonly originStart: O.Option<string>;
}

/** Observe the current active/claiming lease; retired or absent → None. */
const observeLease = Effect.fnUntraced(function* (state: InboxStateShape, request: HookRequest) {
  const inspector = yield* ProcessInspector;
  const leaseOpt = yield* Effect.tx(TxRef.get(state.lease));
  if (O.isNone(leaseOpt)) return O.none<LeaseObservation>();
  const lease = leaseOpt.value;
  const status = leaseStatus(lease);
  if (status !== "active" && status !== "claiming") return O.none<LeaseObservation>();

  const config = yield* YeetConfig;
  const nowMillis = yield* Clock.currentTimeMillis;
  const ownerSnapshot = yield* inspector.snapshot(lease.pid);
  const originSnapshot = yield* inspector.snapshot(request.originPid);
  const originStart = O.map(originSnapshot, (snapshot) => snapshot.start);
  const ownerAlive = O.isSome(ownerSnapshot) && ownerSnapshot.value.start === lease.procStart;
  const ownerFrozen = O.isSome(ownerSnapshot) && isFrozenState(ownerSnapshot.value.state);
  const ownerStale = nowMillis - lease.refreshedAtMillis >= config.staleMillis;
  const currentKey = sessionKey(request);
  const ownedByCurrent = lease.sessionId === currentKey
    || (lease.pid === request.originPid && O.isSome(originStart) && lease.procStart === originStart.value)
    || (ownerAlive && (yield* hasAncestor(lease.pid, request.originPid)));

  return O.some<LeaseObservation>({
    lease,
    ownerAlive,
    ownerFrozen,
    ownerStale,
    ownedByCurrent,
    originStart
  });
});

/** Bash `mutex_recovery_allowed`: absent or retired lease, or an exactly-dead owner. */
const mutexRecoveryAllowed = Effect.fnUntraced(function* (state: InboxStateShape) {
  const inspector = yield* ProcessInspector;
  const leaseOpt = yield* Effect.tx(TxRef.get(state.lease));
  if (O.isNone(leaseOpt)) return true;
  const lease = leaseOpt.value;
  const status = leaseStatus(lease);
  if (status === "retired") return true;
  if (status !== "active" && status !== "claiming") return false;
  const snapshot = yield* inspector.snapshot(lease.pid);
  if (O.isNone(snapshot)) return true;
  if (snapshot.value.start === lease.procStart) {
    return snapshot.value.state === "Z" || snapshot.value.state === "X" || snapshot.value.state === "x";
  }
  return true;
});

// ---------------------------------------------------------------------------
// Lease refresh / takeover / retirement (generation-fenced CAS transactions)
// ---------------------------------------------------------------------------

const casLease = (
  state: InboxStateShape,
  expectedGeneration: string,
  update: (lease: PrLease) => PrLease
) =>
  Effect.tx(Effect.gen(function* () {
    const leaseOpt = yield* TxRef.get(state.lease);
    if (O.isNone(leaseOpt)) return false;
    const lease = leaseOpt.value;
    const status = leaseStatus(lease);
    if (lease.generationId !== expectedGeneration || (status !== "active" && status !== "claiming")) {
      return false;
    }
    yield* TxRef.set(state.lease, O.some(update(lease)));
    return true;
  }));

const refreshOrTakeoverLease = Effect.fnUntraced(function* (state: InboxStateShape, request: HookRequest) {
  const observation = yield* observeLease(state, request);
  if (O.isNone(observation)) return;
  const {
    lease,
    ownedByCurrent,
    ownerAlive,
    ownerFrozen,
    ownerStale,
    originStart
  } = observation.value;
  const nowMillis = yield* Clock.currentTimeMillis;
  const currentKey = sessionKey(request);
  const asOwner = (next: PrLease): PrLease => ({
    ...next,
    sessionId: currentKey,
    pid: request.originPid,
    procStart: O.getOrElse(originStart, () => ""),
    refreshedAtMillis: nowMillis,
    status: O.some("active")
  });
  if (ownedByCurrent) {
    yield* casLease(state, lease.generationId, asOwner);
  } else if (ownerStale && (!ownerAlive || ownerFrozen)) {
    yield* casLease(state, lease.generationId, (current) =>
      asOwner({
        ...current,
        generationId: `${currentKey}-${nowMillis}`,
        takeoverOf: O.some(lease.generationId),
        takeoverReason: O.some("stale-dead-or-frozen")
      }));
  }
});

/** Drain the retirement queue; non-consumable requests (claiming lease) stay queued. */
const applyRetirementRequests = (state: InboxStateShape, nowMillis: number) =>
  Effect.tx(Effect.gen(function* () {
    const size = yield* TxQueue.size(state.retirements);
    if (size === 0) return;
    const requests = yield* TxQueue.clear(state.retirements);
    for (const request of requests) {
      const leaseOpt = yield* TxRef.get(state.lease);
      if (O.isNone(leaseOpt)) continue;
      const lease = leaseOpt.value;
      const status = leaseStatus(lease);
      if (lease.generationId !== request.generationId || status === "retired") continue;
      if (status !== "active") {
        yield* TxQueue.offer(state.retirements, request);
        continue;
      }
      if (lease.headSha !== request.headSha || lease.prNumber !== request.prNumber) {
        yield* TxQueue.offer(state.retirements, request);
        continue;
      }
      yield* TxRef.set(
        state.lease,
        O.some({
          ...O.getSomesStruct({
            ...lease,
            status: O.some("retired" as const),
            retiredAtMillis: O.some(nowMillis),
            refreshedAtMillis: O.some(nowMillis),
            retireReason: O.some(`requested:${request.reason}`)
          }),
        })
      );
    }
  }));

// ---------------------------------------------------------------------------
// Mutex with wedge recovery
// ---------------------------------------------------------------------------

const acquireCell = Effect.fnUntraced(function* (cell: MutexCell, waitMillis: number, holder: string) {
  const acquired = yield* TxSemaphore.acquire(cell.semaphore).pipe(Effect.timeoutOption(waitMillis));
  if (O.isNone(acquired)) return false;
  yield* Effect.tx(TxRef.set(cell.holder, O.some(holder)));
  return true;
});

const releaseCell = (cell: MutexCell) =>
  Effect.tx(Effect.gen(function* () {
    yield* TxRef.set(cell.holder, O.none());
    yield* TxSemaphore.release(cell.semaphore);
  }));

/**
 * Acquire the checkout mutex, wedge-recovering once when the lease owner is
 * dead/retired — the STM equivalent of the lock-file inode replacement.
 */
const acquireMutex = Effect.fnUntraced(function* (state: InboxStateShape, request: HookRequest) {
  const config = yield* YeetConfig;
  const holderTag = `${sessionKey(request)} (${request.event})`;
  const cell = yield* Effect.tx(TxRef.get(state.mutex));
  if (yield* acquireCell(cell, config.mutexWaitMillis, holderTag)) {
    return O.some(cell);
  }
  if (!(yield* mutexRecoveryAllowed(state))) return O.none<MutexCell>();
  const fresh = yield* makeMutexCell;
  yield* Effect.tx(Effect.gen(function* () {
    const current = yield* TxRef.get(state.mutex);
    if (current === cell) yield* TxRef.set(state.mutex, fresh);
  }));
  const replacement = yield* Effect.tx(TxRef.get(state.mutex));
  if (yield* acquireCell(replacement, config.mutexWaitMillis, holderTag)) {
    return O.some(replacement);
  }
  return O.none<MutexCell>();
});

const mutexHolderDescription = Effect.fnUntraced(function* (state: InboxStateShape) {
  const cell = yield* Effect.tx(TxRef.get(state.mutex));
  const holder = yield* Effect.tx(TxRef.get(cell.holder));
  return O.getOrElse(holder, () => "unknown holder");
});

// ---------------------------------------------------------------------------
// Busy-path decisions (mutex unavailable)
// ---------------------------------------------------------------------------

const busyPath = Effect.fnUntraced(function* (state: InboxStateShape, request: HookRequest) {
  const holder = yield* mutexHolderDescription(state);
  if (request.event === "Stop" || request.event === "SubagentStop") {
    const nowMillis = yield* Clock.currentTimeMillis;
    const rows = yield* Effect.tx(stopP0Rows(state, nowMillis));
    if (rows.length === 0) return new EmptyStop();
    return new BlockStop({
      reason: "Fix this now. The checkout has unacknowledged Yeet inbox work:\n" +
        rows.map((row) => `- ${rowLabel(row)}`).join("\n")
    });
  }
  if (request.event !== "PreToolUse") return new Silence();
  const mutating = request.toolName !== undefined && CheckoutMutatingTool.is(request.toolName);
  if (!mutating) {
    return new ContextOut({
      event: request.event,
      context:
        `[lease-mutex-busy] Checkout ownership state is temporarily busy, but this context-only tool remains available. Mutex holder: ${holder}.`
    });
  }
  const observation = yield* observeLease(state, request);
  if (O.isSome(observation) && !observation.value.ownedByCurrent) {
    return new Deny({
      event: request.event,
      reason:
        `[lease-mutex-busy] Published PR ownership cannot be verified while its mutex is busy. Retry this checkout-mutating tool after the active ownership generation settles. Mutex holder: ${holder}.`
    });
  }
  return new Silence();
});

// ---------------------------------------------------------------------------
// Kernel
// ---------------------------------------------------------------------------

export class HookKernel extends Context.Service<HookKernel, {
  readonly handle: (request: HookRequest) => Effect.Effect<HookDecision>
}>()("yeet/HookKernel") {
}

const dispatch = Effect.fnUntraced(function* (state: InboxStateShape, request: HookRequest) {
  const nowMillis = yield* Clock.currentTimeMillis;
  const key = sessionKey(request);
  const entries = yield* Effect.tx(liveEntries(state, nowMillis));
  const session = yield* Effect.tx(getSession(state, key));
  const firstP0 = entries.find((row) => row.severity === "P0");

  if (firstP0 === undefined) {
    yield* updateSession(state, key, (current) => ({
      ...current,
      incidentId: O.none()
    }));
  }

  yield* applyRetirementRequests(state, nowMillis);
  yield* refreshOrTakeoverLease(state, request);

  const mutating = request.event === "PreToolUse"
    && request.toolName !== undefined
    && CheckoutMutatingTool.is(request.toolName);

  const observationAfter = yield* observeLease(state, request);
  if (mutating && O.isSome(observationAfter) && !observationAfter.value.ownedByCurrent) {
    const lease = observationAfter.value.lease;
    return new Deny({
      event: request.event,
      reason:
        `[lease-nonowner] Published PR ownership belongs to session ${lease.sessionId} (pid ${lease.pid}). This session lost lease generation ${lease.generationId} and is fenced from checkout-mutating tools.`
    });
  }

  const emitContext = Effect.fnUntraced(function* (selected: ReadonlyArray<InboxRow>) {
    if (selected.length === 0) return new Silence();
    yield* markSeen(state, key, selected.map((row) => row.id));
    return new ContextOut({
      event: request.event,
      context: renderContext(selected)
    });
  });

  if (request.harness === "grok" || request.event === "GrokTail") {
    return new Tail({
      lines: entries.length === 0
        ? ["[yeet] inbox clear"]
        : ["[yeet] inbox", ...entries.map((row) => `- ${rowDetail(row)}`)]
    });
  }

  switch (request.event) {
    case "SessionStart":
      return yield* emitContext(unseenFor(entries, ["P0", "P1", "P2"], session));
    case "UserPromptSubmit":
      return yield* emitContext(unseenFor(entries, ["P0", "P1"], session));
    case "PreToolUse": {
      if (firstP0 === undefined) {
        return yield* emitContext(unseenFor(entries, ["P1"], session));
      }
      const context = renderContext([firstP0]);
      const newWork = (request.toolName !== undefined && NewWorkLaunchTool.is(request.toolName))
        || (O.isSome(request.toolName) && request.toolName.value === "Bash"
          && O.isSome(request.toolCommand)
          && isNewWorkCommand(request.toolCommand.value));
      if (newWork) {
        if (O.isSome(session.incidentId) && session.incidentId.value !== firstP0.id) {
          yield* updateSession(state, key, (current) => ({
            ...current,
            incidentId: O.some(firstP0.id)
          }));
        }
        return new Deny({
          event: request.event,
          reason:
            `[p0-new-work] Unacknowledged P0 work keeps this checkout in incident mode; starting unrelated Agent/Task/spawn_agent or workspace/bootstrap work is blocked until ACK.\n${context}`
        });
      }
      if (mutating && (O.isSome(session.incidentId) && session.incidentId.value !== firstP0.id)) {
        yield* updateSession(state, key, (current) => ({
          ...current,
          incidentId: O.some(firstP0.id)
        }));
        return new Deny({
          event: request.event,
          reason: `[p0-attention] The first checkout-mutating tool after a new P0 is interrupted once.\n${context}`
        });
      }
      return new ContextOut({event: request.event, context});
    }
    case "Stop":
    case "SubagentStop": {
      if (firstP0 !== undefined) {
        return new BlockStop({reason: renderContext(entries)});
      }
      return new EmptyStop();
    }
    default:
      return new Silence();
  }
});

export const makeHookKernel: Effect.Effect<
  Context.Service.Shape<typeof HookKernel>,
  never,
  InboxState | ProcessInspector | YeetConfig
> = Effect.gen(function* () {
  const state = yield* InboxState;
  const services = yield* Effect.context<ProcessInspector | YeetConfig>();
  const handle = (request: HookRequest): Effect.Effect<HookDecision> =>
    Effect.gen(function* () {
      const acquired = yield* acquireMutex(state, request);
      if (O.isNone(acquired)) {
        return yield* busyPath(state, request);
      }
      return yield* dispatch(state, request).pipe(Effect.ensuring(releaseCell(acquired.value)));
    }).pipe(Effect.provideContext(services));
  return {handle};
});

export const HookKernelLayer: Layer.Layer<
  HookKernel,
  never,
  InboxState | ProcessInspector | YeetConfig
> = Layer.effect(HookKernel)(makeHookKernel);
