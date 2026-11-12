# Lane Cockpit Spike Spec

## Objective

A lab app named `lane-cockpit` under `apps/labs/` draws this repository's live
session lanes full-screen in a terminal: blocked lanes first, age on every
row, a detail pane for the selected lane, keyboard navigation and a text
filter. It reads `bun run beep session open --json` and writes nothing.

The spike then answers one question with evidence: does the operator use it?
The verdict, keep or kill, is recorded as a decision file. Both verdicts
complete the goal.

Shaped pitch, including the fat-marker frame and the data flow:
[`BRIEF.md`](../../explorations/textjs-console-ui/BRIEF.md) in the source
exploration. Grilling record:
[`DECISIONS.md`](../../explorations/textjs-console-ui/DECISIONS.md).

## Non-Goals

- No writes: no messaging a session, no ledger notes, no lane retirement.
- No `@textjs/app`: no App Router, no `text run`, no `text mcp`.
- No agent frame reading. Agents keep the `--json` output.
- No DevTools-console target and no embed.
- No reuse of, or change to, `@beep/ui`.
- No new `@beep/repo-cli` command or export.
- No second panel. Reds, merge gate and fleet headroom wait for the keep test.
- No promotion out of `apps/labs/`.
- No port of Text.js internals. The renderer is a dependency here; ports are
  the gated `agent-frame-protocol` candidate in the exploration's map.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards, in particular
   `standards/architecture/15-lab-apps.md`.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files, and the source
   exploration under `explorations/textjs-console-ui/`.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- A new lab app named `lane-cockpit`, created under `apps/labs/` with
  `bun run beep create-package`.
- The root lockfile and the lab's own manifest, for the one new dependency.
- This packet.

Nothing else. If the work appears to need a change in `@beep/repo-cli`,
`@beep/cli-kit` or `@beep/ui`, that is the circuit breaker, not scope growth.

## Constraints

- **Appetite.** One working day of agent time. Circuit breaker: if two hours
  in there is no frame drawn from real ledger data, stop, record why as a
  decision file, and close as killed.
- **Design order.** Schema, then service contract, then implementation. The
  schema is the decoded `session open --json` report; the service is a
  `Context.Service` that yields the current lanes; the board is the last
  thing written.
- **Boundary.** The board component takes decoded rows as props. Polling, the
  subprocess and decoding live outside it in Effect. No timer runs inside a
  component, because Text.js uses real timers and has no fake clock.
- **Dependency.** `@textjs/react` only, exact-pinned at `1.6.1`, in the lab's
  manifest. No upgrade during the spike. Upstream is MIT; nothing is vendored.
- **Data seam.** Read `bun run beep session open --json`. `SessionLedger` has
  no public export outside the `@beep/repo-cli/test/Session` test-kit, and the
  spike does not add one.
- **Tests.** `@effect/vitest`, per the code law for labs. The first hour
  proves `render` from `@textjs/react/testing` under the repo's Vitest; only
  `bun test` has been run so far. If it cannot run there, record the finding
  and treat it as the circuit breaker.
- **Styling.** Typed props, not `className` cell utilities, so `lint:shadcn`
  does not read them as Tailwind.
- **State.** Plain React state at the edge is acceptable. `@effect/atom-react`
  on this reconciler is untested; spend one hour on it at most.
- **Staleness.** Every row shows its age. A stale row is never hidden or
  styled to look current. Cleaning the ledger is not this work.
- **Runtime.** Bun. The lab is a terminal program, not a dev server; portless
  does not apply to it.

## Acceptance Criteria

- [ ] The lab exists, is listed by `bun run beep labs list`, and starts with
      one command into a full-screen board of this repository's live lanes.
- [ ] Rows order blocked first, then by age of the last note; each row shows
      lane, state, PR if any, age and a truncated next step.
- [ ] Arrow keys move the selection, `/` filters by text, Enter expands the
      selected lane, one key copies its checkout path and one its PR link,
      `q` quits and restores the terminal.
- [ ] Frame tests over fixture rows cover ordering, selection, filter, an
      empty ledger and a ledger with corrupt rows, and pass without a browser.
- [ ] The decoded report is a schema, and a malformed report renders an error
      state instead of crashing.
- [ ] `bun run beep quality package-verify` passes for the lab.
- [ ] The keep test ran for one working day and its verdict is a decision
      file. On kill, the lab is removed with `bun run beep delete-package`
      in the closing PR.
- [ ] The source exploration's `MAP.md` gate for `operator-cockpit` is marked
      fired or lapsed to match the verdict.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/lane-cockpit-spike/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/lane-cockpit-spike/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/lane-cockpit-spike` | Passes |
| Lab registered | `bun run beep labs list` | Lists the lab |
| Lab quality | `bun run beep quality package-verify` on the lab | Passes |
| Frame tests | The lab's test script | Passes, no browser started |
| Real data | One manual run against the live ledger, frame text pasted into a checkpoint file | Rows match `bun run beep session open` |
| Keep test | Decision file with the operator's verdict after one working day | Present |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add lane-cockpit-spike --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug lane-cockpit-spike`; add a `kind: decision` file there, never edit this block._

### Appetite: a one-day spike with a two-hour circuit breaker, 2026-11-10

One working day of agent time, then a keep-or-kill call. If two hours in no frame is drawn from real ledger data, stop and close as killed. See explorations/textjs-console-ui/DECISIONS.md, Q2.

Reverse: Reopen the exploration at shape and set a larger appetite.

### Data seam: read session open --json, no new export, 2026-11-10

SessionLedger is reachable only through the @beep/repo-cli/test/Session test-kit. The spike polls the --json report and decodes it with a schema. Answered from the package exports map. See explorations/textjs-console-ui/DECISIONS.md, data seam.

Reverse: If the cockpit is kept, the follow-on goal decides a proper public export.

### Dependency: @textjs/react only, exact-pinned at 1.6.1, 2026-11-10

Upstream is eight days old with one author. Take the renderer only (7 packages, no Vite, no zod); Effect keeps services, schemas and CLI. Rejected: the full @textjs/app stack; ideas only. See explorations/textjs-console-ui/DECISIONS.md, Q3.

Reverse: Delete the lab; no other workspace depends on it.

### First panel: the live lanes board, 2026-11-10

Every live session from the session ledger with lane, branch, PR, state, next step and age. Rejected for the spike: reds and inbox (mostly stale readings on 2026-11-10), merge gate queue (GitHub budget), fleet headroom. See explorations/textjs-console-ui/DECISIONS.md, Q4.

Reverse: Swap the panel in a follow-on goal; nothing else depends on it.

### Home: a lab app under apps/labs, 2026-11-10

Labs carry the full code law without docgen, coverage ratchet, changesets or storybook, and one command deletes them. This keeps the pinned dependency out of @beep/repo-cli. Answered from standards/architecture/15-lab-apps.md. See explorations/textjs-console-ui/DECISIONS.md, spike home.

Reverse: Run delete-package on the lab.

### Interaction: read and drill down, no writes, 2026-11-10

Arrow keys, a filter, expand, copy path, copy PR link. A throwaway must not be able to damage a live lane. See explorations/textjs-console-ui/DECISIONS.md, Q5.

Reverse: Add actions in the gated cockpit-actions candidate after the keep test.

### Keep test: one working day of operator use, 2026-11-10

The board stays open in a terminal pane for a working day and the operator reaches for it before rerunning session open. Usage is the evidence; agent-built proof alone is not. See explorations/textjs-console-ui/DECISIONS.md, Q6.

Reverse: Record a different verdict rule as a new decision file before P4.

### Use: an operator cockpit, not a test tier or console companion, 2026-11-10

The surface is a full-screen terminal cockpit over operator state. A cell grid is chosen because an agent can build and check it with text-frame assertions at unit-test cost. Rejected: a text-frame UI test tier, a pattern port only, parking. See explorations/textjs-console-ui/DECISIONS.md, Q1.

Reverse: Kill the goal; the exploration keeps the rejected options on record.

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
