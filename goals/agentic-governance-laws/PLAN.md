# Agentic Governance Laws Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | pending | Mostly paid by the exploration: re-verify the four scan paths and the TierGate surface against the live tree, decide the legitimate-zero boundary, and choose the first ceiling declaration site. | Scan-path table in `SPEC.md` re-confirmed at current HEAD; the zero-vs-vacuous boundary is written down; the declaration site is chosen with evidence and recorded as a dated `SPEC.md` decision entry. |
| P1 Implement | pending | Schema → Effect `Context.Service` contract → implementation, in that order. Ceiling schema and `StopReason` first; standards statements and scanner assertions after. | `declaredCeiling` + min-composed effective authority and the `StopReason` `LiteralKit` exist ahead of any consumer; the three law statements and the Q6 sentence land in one `standards/` edit; each of the four scan paths asserts its own coverage. |
| P2 Verify | pending | Prove each law by violating it. | The vacuous-glob fixture makes its scanner fail; each `StopReason` member is reachable and recorded by a cap fixture; `effect-fn.test.ts:258`'s legitimate zero still passes; `bun run beep yeet repair` then `... verify` are green. |
| P3 Yeet: PR to mergeable | pending | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | pending | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

## Sequencing Notes

- **The `LawScan` code fix is not this packet's first slice.** It lands in the
  exploration's amendment-application PR stage; P1 cites the landed fix as the
  enforceability proof for law 3 and ships the fixture. If that fix has not
  landed when P1 starts, state the law and ship the fixture anyway — the
  fixture is what makes the law falsifiable — and record the dependency.
- **Design order is not negotiable.** `StopReason` and the ceiling schema are
  written before any service that consumes them, and before any scanner.
- **Rule 5 needs no scanner to be true.** It holds by construction because the
  clamp comes from the consuming context. Any scan for schema-bypassing
  declaration sites is belt-and-suspenders lint and is the last thing built,
  never the first.
- **Cut line.** Appetite is medium and bounded to one short PR ladder. If it
  sprawls, the surviving slice is the standards statements plus the vacuity
  fixture; the ceiling schema and caps follow in a second PR rather than
  stretching the first.

## P4 Closeout Checklist

Before marking the packet closed (and `status` → `completed-retained` / `complete`):

1. Write a closeout reflection via the `/reflect` skill (or copy
   `_template/history/reflections/_TEMPLATE.md`) to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Critique the repo **tooling**
   (what worked, what didn't, what was frustrating, what you wished existed), the
   **implementation** (improvement opportunities), and the **goal/prompt** (would
   you revise it to be clearer/easier/more efficient?). Capture TODOs worth
   codifying. Its YAML frontmatter must validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts` (this packet has
   `reflectionRequired: true`, so a missing/invalid reflection blocks closeout).
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status`.

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes; the
  first ceiling declaration site arrives as a new dated decision entry there.
- Keep this plan current; archive old run outputs under `history/`.
- Friction is a first-class output: record receipts in the exploration's
  `research/OPPORTUNITIES.md` at the moment friction happens, not at closeout.

## Verification Commands

```sh
test "$(wc -m < goals/agentic-governance-laws/GOAL.md)" -le 4000
jq . goals/agentic-governance-laws/ops/manifest.json
rg -n "agentic-governance-laws|GOAL.md|agentLaunchers|packetAnchorDocument" goals/agentic-governance-laws
git diff --check -- goals/agentic-governance-laws
```
