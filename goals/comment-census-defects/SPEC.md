# Comment Census Defects Spec

## Objective

Every defect the 2026-11-21 census exposed is fixed, with the misleading comment corrected or removed in the same change. Graduated from `explorations/comment-law`; the per-row evidence is in the out-of-repo ledger and the exploration's `research/` verify notes.

## Non-Goals

- Bulk comment deletion.
- The excuse families that need a design change (`comment-law-sweep` files them).

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/drivers/nlp-mcp/src/Streaming/DatasetLoader.ts` (drifted host guard; import `@beep/schema` SafeRemoteHost).
- `packages/foundation/modeling/yaml` (formatter drops an escaped comment though the document carries one).
- `packages/drivers/git/src/Git.ts` (an error arm called unreachable is reachable).
- `packages/tooling/policy-pack/lint-rules/src/rules/no-manual-effect-runtime-in-tests.ts` (budget allows about 529 new violations) and the low local coverage floors.
- `packages/drivers/wink` (entity spans for repeated mentions), `apps/oip-web` (dead nav anchors), `packages/tooling/library/repo-workspaces/test/integration/node-sync.int.test.ts` (resolves a missing directory), the onnx tensor check in `Files/internal/MatchPerson.onnx.ts`, the EPERM case in the process probe.

## Constraints

- One defect per PR unless two share a file; each fix ships a regression test that fails before it.
- Re-verify each defect against `origin/main` before fixing; drop it with a note if already fixed.
- At most three open PRs.

## Acceptance Criteria

- [ ] Each listed defect is fixed with a failing-then-passing test, or recorded as not reproducible with evidence.
- [ ] The comment that hid each defect is corrected or removed.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/comment-census-defects/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/comment-census-defects/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/comment-census-defects` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add comment-census-defects --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug comment-census-defects`; add a `kind: decision` file there, never edit this block._

### Fix each census defect with a failing test first, 2026-11-22

Graduation, align round 2: the defects found under comments are fixed now in small PRs, in parallel with the gate, each re-verified on origin/main first. Source: explorations/comment-law/DECISIONS.md.

Lane explore/comment-law

Reverse: Revert the fix PR.

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
