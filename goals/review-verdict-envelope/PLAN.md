# Review Verdict Envelope Plan

## Status

Status: `pending`

## Binding Sequencing

P0 evidence runs first because S1 and S3 decide the form of the P3 amendment. P1 schema and P2
services do not depend on the spike results and may start while P0 waits on operator access, but
P2 never starts before P1's exit criteria hold: schema → `Context.Service` contract →
implementation. P3 needs both P0 (which amendment form) and P1 (the schema the amendment cites).

## Phases

| Phase | Status | Goal | Entry criteria | Exit criteria |
| --- | --- | --- | --- | --- |
| P0 Evidence | pending | Ask the attorney the one plain question (which app he lives in daily: Outlook, Word, Claude Code, or the Claude desktop app). Run S1 (Desktop Code tab pane placement and painting on Windows, throwaway sample mod) and S3 (Box connector via `$.mcp.call`: `get_file_content` + `get_preview_page` on a non-client test file) first, then S2 (Svg-wrapped PNG paints), S4 (`$.ui.selection` inside a pane), S6 (built-in Reply on selection), S8 (PDF copy in the Browser pane at `#page=N`), and the one-hour Claude for Word check (reaches practice-kg or Box?). | Operator access to the attorney's PC; non-client test files in hand; a sample mod chosen from Anthropic's samples. | `history/spikes-<YYYY-MM-DD>.md` holds the one-app answer, S1 and S3 go/no-go with evidence, and a result row for S2, S4, S6, S8 and the Word check. |
| P1 Schema | pending | In `@beep/law-practice-domain` `values/`: `SourceRef` (reuse the `DurableLocator` quote shape), `ReviewItem` tagged union by `kind` (six members), `ReviewItem`'s `claim-finding` member carries `claimId: CandidateClaimId`; `VerdictRow` (`itemId`, `batchId`, `verdict` via `LiteralKit`, optional `note`, `revision`, `recordedAt`, optional `lockedAt`). Domain decode/encode tests cover `claimId`, `recordedAt` and `batchId`. No service code. | None (can run in parallel with P0). | Schemas exported from the barrel with `$I` annotations and JSDoc; `ReviewVerdict.test.ts` green; `package-verify @beep/law-practice-domain` passes. |
| P2 Services + projector | pending | In `@beep/law-practice-use-cases`: `ReviewQueue` and `VerdictProjector` as `Context.Service` contracts (`.ports.ts`, typed errors including a locked-log write error), then Layer implementations. Projector: returns `ClaimDispositionProjection` values (not entities). `claim-finding` + `right` → `active` with the fixed confirm reason; `wrong` → `rejected` with the note, or the fixed reject reason when there is no note; `partly` → none (the claim returns to the queue). `resolvedAt` comes from `VerdictRow.recordedAt`; the caller supplies `resolvedBy`. Spike S5 is the verify. | P1 exit criteria met. | S5 round-trip test green (undo is a superseding revision, a write after lock fails, projection deterministic); `package-verify @beep/law-practice-use-cases` passes; changeset added. |
| P3 Handoff | pending | Deliver the amendment at `explorations/attorney-review-workspace/research/AMENDMENT-practice-claude-mod.md` (review-queue phase + D9 widening to Box read tools + `$.prompt.fill`) to the `practice-claude-mod` owner, citing the P1 schema. If S1 failed, rewrite it as the row-only fallback (verdict controls on answer rows, no pane) and reopen the exploration at `decompose`. | P0 S1/S3 results recorded; P1 schema merged or in this PR. | Delivery recorded in `README.md` (link or comment); the exploration's state matches the S1 outcome. No edit to the `practice-claude-mod` packet. |
| P4 Yeet: PR to mergeable | pending | Publish through Yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | P1–P3 content final. | Mergeable per `AGENTS.md`: no outstanding threads, review window elapsed, reds attributed. |
| P5 Close | pending | Write the closeout reflection and flip packet state. | P4 met. | Reflection under `history/reflections/`; `README.md` and manifest statuses updated in the same PR. |

## Dependencies

- **Cross-goal, upstream:** `practice-claude-mod` (graduated by the `claude-mods-law-practice`
  exploration, PR #1711) owns D8 (verdict JSONL), D9 (mod permission envelope), and D10
  (app-local schema). This goal promotes the schema out of the app under D10's second-consumer
  rule and never edits that packet.
- **Cross-goal, downstream:** `claim-element-graph`'s first goal emits `claim-finding`
  `ReviewItem`s instead of standalone tool output, once P1 lands.
- **In-repo:** `ClaimDisposition` in `@beep/epistemic-domain` (already a dependency of
  `@beep/law-practice-use-cases`).
- **Parallel work:** the amendment text is being written in the exploration in parallel; P3
  links it and does not copy it.

## Current Blockers

- P0 needs operator access to the attorney's PC and one answer from the attorney. P1 and P2 are
  unblocked.

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status`.

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Spike screenshots stay out of the repo; describe them in the report.

## Verification Commands

```sh
test "$(wc -m < goals/review-verdict-envelope/GOAL.md)" -le 4000
jq . goals/review-verdict-envelope/ops/manifest.json
rg -n "review-verdict-envelope|GOAL.md|agentLaunchers|packetAnchorDocument" goals/review-verdict-envelope
git diff --check -- goals/review-verdict-envelope
bun run beep goals doctor
bunx --bun vitest run packages/law-practice/domain/test/ReviewVerdict.test.ts
bunx --bun vitest run packages/law-practice/use-cases/test/ReviewVerdict.roundtrip.test.ts
bun run beep quality package-verify @beep/law-practice-domain
bun run beep quality package-verify @beep/law-practice-use-cases
bun run beep lint reflection-artifacts
```
