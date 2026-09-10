/**
 * Transactional inbox state — the STM heart of the port.
 *
 * Every file the bash system round-trips through jq becomes a transactional
 * value: NDJSON rows → TxRef<Array>, ack dir → TxHashMap, dispatch.json →
 * TxRef<Option>, pr-lease.json → TxRef<Option>, the retirement request dir →
 * TxQueue, per-session state files → TxHashMap, and the flock critical
 * section → a replaceable TxSemaphore (the TxRef wrapper is the moral
 * equivalent of the lock file's inode: wedge recovery swaps it).
 */
import { Context, Effect, TxHashMap, TxQueue, TxRef, TxSemaphore } from "effect"
import * as O from "effect/Option"
import type {
  AckReceipt,
  DispatchWave,
  InboxRow,
  PrLease,
  RetirementRequest,
  SessionState
} from "./Domain.ts"

export interface MutexCell {
  readonly semaphore: TxSemaphore.TxSemaphore
  readonly holder: TxRef.TxRef<O.Option<string>>
}

export interface InboxStateShape {
  readonly rows: TxRef.TxRef<ReadonlyArray<InboxRow>>
  readonly acks: TxHashMap.TxHashMap<string, AckReceipt>
  readonly wave: TxRef.TxRef<O.Option<DispatchWave>>
  readonly lease: TxRef.TxRef<O.Option<PrLease>>
  readonly retirements: TxQueue.TxQueue<RetirementRequest>
  readonly sessions: TxHashMap.TxHashMap<string, SessionState>
  /** Replaceable mutex cell — swap-on-wedge mirrors the lock-file inode replacement. */
  readonly mutex: TxRef.TxRef<MutexCell>
}

export class InboxState extends Context.Service<InboxState, InboxStateShape>()("yeet/InboxState") {}

export interface InboxSeed {
  readonly rows?: ReadonlyArray<InboxRow>
  readonly acks?: ReadonlyArray<AckReceipt>
  readonly wave?: DispatchWave
  readonly lease?: PrLease
  readonly retirements?: ReadonlyArray<RetirementRequest>
}

export const makeMutexCell: Effect.Effect<MutexCell> = Effect.gen(function*() {
  const semaphore = yield* TxSemaphore.make(1)
  const holder = yield* TxRef.make<O.Option<string>>(O.none())
  return { semaphore, holder }
})

export const makeInboxState = Effect.fnUntraced(function*(seed: InboxSeed = {}) {
  const rows = yield* TxRef.make<ReadonlyArray<InboxRow>>(seed.rows ?? [])
  const acks = yield* TxHashMap.fromIterable<string, AckReceipt>(
    (seed.acks ?? []).map((ack) => [ack.id, ack] as const)
  )
  const wave = yield* TxRef.make<O.Option<DispatchWave>>(O.fromNullishOr(seed.wave))
  const lease = yield* TxRef.make<O.Option<PrLease>>(O.fromNullishOr(seed.lease))
  const retirements = yield* TxQueue.unbounded<RetirementRequest>()
  if (seed.retirements !== undefined && seed.retirements.length > 0) {
    yield* TxQueue.offerAll(retirements, seed.retirements)
  }
  const sessions = yield* TxHashMap.empty<string, SessionState>()
  const mutex = yield* TxRef.make<MutexCell>(yield* makeMutexCell)
  return { rows, acks, wave, lease, retirements, sessions, mutex } satisfies InboxStateShape
})

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface YeetConfigShape {
  /** BEEP_YEET_LEASE_STALE_SECONDS (default 240s). */
  readonly staleMillis: number
  /** flock -w 1 equivalent. */
  readonly mutexWaitMillis: number
  /** Spawn registration poll: 20 attempts x 50ms in bash. */
  readonly registrationPollMillis: number
  readonly registrationPollAttempts: number
}

export class YeetConfig extends Context.Service<YeetConfig, YeetConfigShape>()("yeet/YeetConfig") {}

export const defaultYeetConfig: YeetConfigShape = {
  staleMillis: 240_000,
  mutexWaitMillis: 1_000,
  registrationPollMillis: 50,
  registrationPollAttempts: 20
}
