# Instance

- ID: `r27-boolean-state-foundation-spinner-state`
- Source: `8f266b878445ca8a7f751f9248da428a4dde39a1`
- Corpus: `origin/main@663904610cce2a38c06b0619a8c414646b69361c`
- Owner: `packages/foundation/ui-system/ui/src/hooks/useSpinner.ts:36`, `SpinnerState`
- Members: `runOnce`, `timeout`, `interval`; stored, internal, Tier 1C.
- Source adjudication: `data/design-refresh-2026-09-09-r27-boolean-ui-carriers.md`.
- P2 proposal only; no implementation or independent review is claimed.

# Current shape

`SpinnerState` at `useSpinner.ts:36–40` combines one Boolean with two
actual `number | undefined` timer handles. The initial value at 51 is
`{ runOnce: true, timeout: undefined, interval: undefined }`.
The command atom at 68 reads the current state once at 73. Stop clears
its timers and restores the initial value at 77–79. Start clears its
current timers at 82, performs an immediate callback only when `runOnce`
is true at 84, schedules a 300 ms timeout at 88, and stores that timeout
with the previous `runOnce` value at 97–101. The timeout creates a
50 ms interval and stores only that interval with `runOnce: false` at
89–94. The first interval tick occurs 50 ms after the delay expires;
the delay callback itself does not execute `run`.

`spinnerStateAtom` at 66 is scoped through `Atom.family` and `useId`
at 169. `spinnerCleanupAtom` at 109 registers a finalizer that reads the
latest state with `get.once` at 111. **Both** the state and cleanup atoms
are mounted at 179–180. The source comment at 172–178 records an actual
idle-TTL leak caused by dropping the state mount; preserve those mounts.

# Cardinality gap

The finite quotient is `2 × 2 × 2 = 8`: Boolean run-once plus actual
absence/presence of two timer payloads. Four states are produced:

| State | `runOnce` | `timeout` | `interval` | Witness |
| --- | --- | --- | --- | --- |
| idle | true | undefined | undefined | initial/stop, 51–55 and 79 |
| initial-delay | true | number | undefined | start from idle or initial-delay, 84–101 |
| repeat-delay | false | number | undefined | start again after reaching repeating, 90–101 |
| repeating | false | undefined | number | timeout callback, 88–94 |

Every numeric timer handle is retained, including zero; this is presence,
not zero/nonzero. Both timer handles present, idle without run-once, and
an interval with run-once true are not produced. `repeat-delay` cannot
be collapsed with `initial-delay`: another start in the former suppresses
the immediate callback, while another start in the latter performs it.

# Target schema

Keep the private state owner in `hooks/useSpinner.ts`. Reuse its `$I`
composer and the existing `@beep/schema` dependency. Define the finite
domain once and let the kit build the private case schemas:

```ts
const SpinnerPhase = LiteralKit(["idle", "initial-delay", "repeat-delay", "repeating"]).pipe(
  $I.annoteSchema("SpinnerPhase", {
    description: "Idle, initial hold, restarted hold, or active repetition.",
  })
)
type SpinnerPhase = typeof SpinnerPhase.Type

const SpinnerState = SpinnerPhase.toTaggedUnion("phase")({
  idle: {},
  "initial-delay": { timeout: S.Number },
  "repeat-delay": { timeout: S.Number },
  repeating: { interval: S.Number },
}).pipe(
  $I.annoteSchema("SpinnerState", {
    description: "One spinner phase owning only its active browser timer.",
  })
)
type SpinnerState = typeof SpinnerState.Type
```

The kit's case structs are sufficient for this private transient union;
there is no parallel interface or object with optional case fields.
Construct with the exact case schema, for example
`SpinnerState.cases["initial-delay"].make({ timeout })`, omitting the
`S.tag`-defaulted discriminator input.
Use `.match`, `.guards`, or `.isAnyOf` from this union for phase dispatch.
Do not add `runOnce` getters, cached timer-presence flags, or a second
Boolean state atom. Timer IDs stay browser-number payloads; no narrower
positive/integer schema or opaque token conversion is needed.

Keep command tags and callback signatures at 42–49 and 165–194 exactly.
The callback-bearing `SpinnerCommand` is an operational interface, not
the state being modeled. Keep the two schedule values and their existing
schedule construction untouched.

The transition table is exact:

| Command/event | From | Timer action and callback | To |
| --- | --- | --- | --- |
| start | idle | no timer to clear; call `run`; schedule delay | initial-delay(new timeout) |
| start | initial-delay | clear old timeout; call `run`; schedule delay | initial-delay(new timeout) |
| start | repeat-delay | clear old timeout; no immediate callback; schedule delay | repeat-delay(new timeout) |
| start | repeating | clear old interval; no immediate callback; schedule delay | repeat-delay(new timeout) |
| timeout fires | either delay | create interval without immediate callback | repeating(new interval) |
| stop | any | clear owned timer, if any | idle |
| unmount/finalize | any | read latest state, clear owned timer | no new state write |

Preserve clear-before-callback-before-scheduling order. Do not add
generation tokens, async scheduling, cancellation policy, changed exception
handling, or reentrant-callback repairs while replacing this carrier.

# Migration inventory

- `packages/foundation/ui-system/ui/src/hooks/useSpinner.ts:7–12`: add the
  narrow LiteralKit import; reuse Schema, Atom, and `$I` already in scope.
- `useSpinner.ts:36–40`: replace the private type with the phase and union.
- `useSpinner.ts:51–55`: construct the idle case; every reset reuses it.
- `useSpinner.ts:57–64`: match the union and clear exactly the timeout,
  interval, or no timer. The same helper remains shared by stop/start/cleanup.
- `useSpinner.ts:66`: keep the same family key, atom lifetime, and initial value.
- `useSpinner.ts:77–101`: implement the table through schema-derived
  dispatch while preserving callback and timer ordering.
- `useSpinner.ts:109–113,169–180`: retain the cleanup finalizer's latest
  `get.once`, the per-hook scope, and **both** mounts. Do not add TTL,
  keep-alive, or service/runtime changes.
- `useSpinner.ts:182–194`: retain public `up(params?)`, `down(params?)`,
  and `stop()` behavior and closure payloads.
- `packages/foundation/ui-system/ui/src/hooks/useNumberInput.ts:17,845`:
  sole executable source caller; no signature migration. Preserve start
  handlers at 858–874 and release/leave/touch-end stops at 985–1000.
- `packages/foundation/ui-system/ui/src/hooks/index.ts:18`: retains the
  exported number-input hook. `package.json:108`/130 expose hook subpaths.
  The private state is not exported; no new export is needed for its tests.

Graft found the caller at `useNumberInput.ts:845`; exhaustive TypeScript,
TSX, and MDX symbol/subpath searches across packages/apps and the repository
found no executable caller of `useNumberInput` beyond its own documentation
example. `test/hooks.test.ts` and `test/schema-parity.test.ts` import
number-input helpers, not the hook. This is a current in-repo finding,
not proof that the public hook has no external consumers.

# Guard-deletion accounting

- Delete the two independent `!== undefined` checks at 58/61; an exhaustive
  state match owns the only active handle.
- Delete `runOnce` from the stored shape, initial value, callback write,
  and start write at 38, 53, 92, and 99.
- Replace the phase-reconstruction `if (state.runOnce)` at 84 with the
  initial-capable union cases; it is no longer a separately stored truth.
- Delete timer sibling clearing assignments at 52/54, 93, and 98; absent
  handles are absent structurally. Timer clearing itself remains required.

No lifecycle cleanup, TTL protection, or command side effect counts as a
guard to delete. The type removes impossible timer/phase combinations;
the legitimate transition dispatch remains.

# Encoded-side impact

None. Timer handles and the private atom state are not persisted or sent
over a wire. Public hook callback arguments and results remain unchanged.
No option codec, storage migration, package export, or dependency change
is required. `@beep/schema` is already declared at `package.json:29`.

# Test impact

Add focused React hook coverage using a fresh Atom registry and controlled
browser timers; exercise the public `useSpinner` controls or a local test
component rather than exporting private state. Cover all four states and
the full transition table, including both start-during-delay cases, direction
changes after repeating, stop before delay, stop during repeat, and zero-valued
timer handles. Assert immediate callback count, 300 ms delay, first repeat
at 350 ms, 50 ms cadence, and the exact handle cleared. A timer advance
past the registry's configured idle TTL while still mounted must leave
stop effective. Unmount from either delay and from repeating must prevent
later callbacks; remount must begin idle and scopes must remain independent.

No current spinner hook test or story was found. Add a small portless
Storybook fixture through the actual `useNumberInput` hook, plus a public
spinner-control fixture where needed to exercise repeated-start without an
intervening stop. Use Atom state in new fixtures. Record actual mouse
press/hold/release/leave and supported touch-end paths, restart/direction
changes, a hold beyond the test registry TTL, and unmount during a hold.
Use slow real inputs and inspect event counts alongside the displayed
number. Keep modifier stepping, input focus, min/max disabled behavior,
and ARIA output from `useNumberInput` unchanged. Do not add a new pointer
cancel handler as part of this state migration.

Before implementation handoff, run the focused hook tests, existing
number-input helper tests, and `bun run beep quality package-verify @beep/ui`.
For the gesture milestone run the browser-qa-loop record → extract → judge
through the portless Storybook script and retain capture-green plus
`requiredCount: 0`. No package or browser tests were run for this P2 file.

# Risk

Tier 1C, atom-state migration. The main risks are merging the two delay
states, changing first-tick timing, treating handle zero as absence, or
losing the state mount that prevents the documented TTL leak. Keep the
union and all three timer consumers in one implementation change. The
public hook remains supported even though current app callers are absent.
