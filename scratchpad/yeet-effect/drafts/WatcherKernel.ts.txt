/**
 * Process-identity services.
 *
 * The bash system trusts `/proc/<pid>/stat` for three facts: the exact process
 * generation (pid + boot-relative starttime, field 22), the run state
 * (field 3; `T`/`t` = frozen counts as dead for takeover), and the ppid chain
 * for ancestry. These become one small `ProcessInspector` contract with a live
 * /proc layer and a transactional simulated table for tests.
 */
import { Context, Effect, FileSystem, Layer, TxHashMap } from "effect"
import * as O from "effect/Option"

// ---------------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------------

export interface ProcessSnapshot {
  readonly start: string
  readonly state: string
  readonly ppid: number
}

export class ProcessInspector extends Context.Service<ProcessInspector, {
  readonly snapshot: (pid: number) => Effect.Effect<O.Option<ProcessSnapshot>>
}>()("yeet/ProcessInspector") {}

/**
 * TERM→KILL escalation against the exact process group.
 *
 * Mirrors the bash `terminate_spawned_fixer` contract: `expectedStart` of
 * `None` refuses to signal a live leader (returns false) and succeeds only if
 * the leader is already gone; `Some(start)` refuses when the observed leader
 * generation differs while the group still exists, and otherwise escalates
 * TERM→KILL, returning false when the group survives both.
 */
export class ProcessSupervisor extends Context.Service<ProcessSupervisor, {
  readonly terminateExactGroup: (
    group: number,
    expectedStart: O.Option<string>
  ) => Effect.Effect<boolean>
}>()("yeet/ProcessSupervisor") {}

export const isFrozenState = (state: string): boolean => state === "T" || state === "t"

/** Walk the ppid chain (max 64 hops), mirroring `proc_has_ancestor`. */
export const hasAncestor = Effect.fnUntraced(function*(pid: number, ancestor: number) {
  const inspector = yield* ProcessInspector
  let current = pid
  for (let depth = 0; current > 1 && depth < 64; depth += 1) {
    if (current === ancestor) return true
    const snapshot = yield* inspector.snapshot(current)
    if (O.isNone(snapshot)) return false
    const parent = snapshot.value.ppid
    if (parent === current || parent <= 0) return false
    current = parent
    void depth
  }
  return current === ancestor
})

// ---------------------------------------------------------------------------
// Live /proc layer
// ---------------------------------------------------------------------------

/** Parse `/proc/<pid>/stat`: fields after the last `)` — state, ppid, ..., starttime (20th). */
export const parseProcStat = (content: string): O.Option<ProcessSnapshot> => {
  const closing = content.lastIndexOf(")")
  if (closing < 0) return O.none()
  const rest = content.slice(closing + 1).trim().split(/\s+/)
  const state = rest[0]
  const ppid = Number(rest[1])
  const start = rest[19]
  if (state === undefined || start === undefined || Number.isNaN(ppid)) return O.none()
  return O.some({ start, state, ppid })
}

export const ProcessInspectorLive: Layer.Layer<ProcessInspector, never, FileSystem.FileSystem> = Layer.effect(
  ProcessInspector
)(
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    return {
      snapshot: (pid) =>
        fs.readFileString(`/proc/${pid}/stat`).pipe(
          Effect.map(parseProcStat),
          Effect.catch(() => Effect.succeedNone)
        )
    }
  })
)

// ---------------------------------------------------------------------------
// Simulated process table (tests)
// ---------------------------------------------------------------------------

export interface SimProcess {
  readonly start: string
  readonly state: string
  readonly ppid: number
  /** Survives TERM and KILL — models the bash "group survived" fail-closed path. */
  readonly immortal: boolean
}

export interface SimProcessesShape {
  readonly table: TxHashMap.TxHashMap<number, SimProcess>
  readonly register: (pid: number, process: Partial<SimProcess> & { readonly start: string }) => Effect.Effect<void>
  readonly kill: (pid: number) => Effect.Effect<void>
  readonly freeze: (pid: number) => Effect.Effect<void>
}

export class SimProcesses extends Context.Service<SimProcesses, SimProcessesShape>()("yeet/SimProcesses") {}

export const makeSimProcesses: Effect.Effect<SimProcessesShape> = Effect.gen(function*() {
  const table = yield* TxHashMap.empty<number, SimProcess>()
  const register: SimProcessesShape["register"] = (pid, process) =>
    TxHashMap.set(table, pid, {
      state: process.state ?? "S",
      ppid: process.ppid ?? 1,
      immortal: process.immortal ?? false,
      start: process.start
    })
  const kill: SimProcessesShape["kill"] = (pid) => TxHashMap.remove(table, pid)
  const freeze: SimProcessesShape["freeze"] = (pid) =>
    Effect.tx(TxHashMap.modifyAt(
      table,
      pid,
      O.map((process) => ({ ...process, state: "T" }))
    ))
  return { table, register, kill, freeze }
})

export const SimProcessesLayer: Layer.Layer<SimProcesses> = Layer.effect(SimProcesses)(makeSimProcesses)

export const makeSimInspector = (sim: SimProcessesShape): Context.Service.Shape<typeof ProcessInspector> => ({
  snapshot: (pid) =>
    TxHashMap.get(sim.table, pid).pipe(
      Effect.map(O.map((process) => ({ start: process.start, state: process.state, ppid: process.ppid })))
    )
})

/**
 * Simulated group termination: the group is the leader plus every process
 * whose ppid points at it. Immortal members make the group survive TERM+KILL.
 */
export const makeSimSupervisor = (sim: SimProcessesShape): Context.Service.Shape<typeof ProcessSupervisor> => ({
  terminateExactGroup: (group, expectedStart) =>
    Effect.tx(Effect.gen(function*() {
      const leader = yield* TxHashMap.get(sim.table, group)
      if (O.isNone(expectedStart)) {
        return O.isNone(leader)
      }
      if (O.isNone(leader)) return true
      if (leader.value.start !== expectedStart.value) return false
      if (leader.value.immortal) return false
      yield* TxHashMap.remove(sim.table, group)
      const entries = yield* TxHashMap.entries(sim.table)
      for (const [pid, process] of entries) {
        if (process.ppid === group && !process.immortal) {
          yield* TxHashMap.remove(sim.table, pid)
        }
      }
      return true
    }))
})

export const SimProcessInspectorLayer: Layer.Layer<ProcessInspector, never, SimProcesses> = Layer.effect(
  ProcessInspector
)(Effect.map(SimProcesses, makeSimInspector))

export const SimProcessSupervisorLayer: Layer.Layer<ProcessSupervisor, never, SimProcesses> = Layer.effect(
  ProcessSupervisor
)(Effect.map(SimProcesses, makeSimSupervisor))
