# Patent Citation Candor Gate Plan

## Status

Status: `in-progress`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Re-verify the live surfaces against Lane A's inventory (`research/SOURCES.md` §4) and make the final gate-shape pick from the two doctrine-sanctioned shapes (emitted events, preferred, vs a contract promoted into `shared/use-cases`; `standards/ARCHITECTURE.md:632-636`) with an `architecture-guardian` check — app-level entrypoint composition is wiring only, never cross-slice orchestration. | Surfaces confirmed current; gate shape chosen and recorded in `SPEC.md`'s decision log together with the exact consumer/wiring files that shape writes; if the promoted-contract shape wins, an Exception Ledger entry and owner sign-off for `packages/shared/use-cases` exist before P2 starts. |
| P1 Rung 1: domain proof | complete | Schemas (`PatentCitationEvent`, `CandorDisposition`, application-identity union) → `CandorPolicy` contract → failing-then-green `CandorPolicy.test.ts` over in-memory layers. | All rung-1 acceptance criteria met; test green after first failing. |
| P2 Rung 2: durability + live gate | complete (scoped by decisions 10-11) | Ports/repo/layer on the `ExecutionLedger` precedent; the slice's first db-admin migration + PGlite test + `AcceptedProofManifest`; append-only IDS fact records; live filing-promotion consultation. | All rung-2 acceptance criteria met. |
| P3 Yeet: PR to mergeable | in-progress | Ship each rung through `bun run beep yeet publish --pr` and drive checks/review to mergeable. | Completion gate satisfied (PR mergeable, checks green, review clean). |
| P4 Close | complete | Closeout reflection, packet status/evidence updates, final readiness. | Packet status and evidence updated; a closeout reflection exists. |

Rung ordering is strict: P2 never starts before P1's test is green. The
budget circuit-breaker (drop `PatentFragmentLocator`, never the
observation-version binding or fail-closed predicate) applies inside P1.

## P4 Closeout Checklist

Before marking the packet closed (and `status` → `completed-retained`):

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
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Gated criteria (observation identity, quarantine producer, `CitationMention`
  handoff, release-capable gate vocabulary) are tracked in `SPEC.md`; check
  their owning goals' state at each phase start, but never block on them.

## Verification Commands

```sh
test "$(wc -m < goals/patent-citation-candor-gate/GOAL.md)" -le 4000
jq . goals/patent-citation-candor-gate/ops/manifest.json
rg -n "patent-citation-candor-gate|GOAL.md|agentLaunchers|packetAnchorDocument" goals/patent-citation-candor-gate
git diff --check -- goals/patent-citation-candor-gate
```
