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

- One defect per row below. Each was read in source on `a1b08269809`; re-verify on `origin/main` first.

| Defect | Where | Reproduce | Expected |
| --- | --- | --- | --- |
| Drifted SSRF guard | `packages/drivers/nlp-mcp/src/Streaming/DatasetLoader.ts` `isBlockedRemoteHost` | load `http://localhost./x`: the guard keeps the trailing dot and allows it | refused, as `@beep/schema` SafeRemoteHost (which strips dots) refuses it; import that guard |
| YAML formatter drops a comment | `packages/foundation/modeling/yaml/src/internal/composer/document.ts` (about line 796) | format a sequence followed by an escaped `# esc` comment line: the output loses the comment | the comment survives on the document's trailing comment field |
| Reachable "unreachable" arm | `packages/drivers/git/src/Git.ts` working-tree diff helper (comment about line 635) | working-tree diff with a missing caller-supplied `head` | fails `UnknownRefError`, a test pins it, and the comment is corrected |
| Stale runtime budget | `packages/tooling/policy-pack/lint-rules/src/rules/no-manual-effect-runtime-in-tests.ts` | 64 of 67 baseline rows match no `Effect.run*` or `ManagedRuntime` today | baseline cut to live rows, so the budget admits no new violation |
| Uncalibrated coverage floors | `vitest.config.ts` of `packages/shared/tables`, `packages/shared/domain`, `packages/tooling/test-kit/test-utils` | floors (lines 25 in tables) sit far below `standards/coverage.regression-baseline.jsonc` (100); tables names a missing `src/table/Table.ts` | floors raised to measured or removed in favour of the repo ratchet; glob fixed |
| Wrong entity spans | `packages/drivers/wink/src/WinkBackend.service.ts` (about line 56) | text with the same entity twice | each mention keeps its own span, taken from `its.span` as `WinkTools.service.ts` does |
| Dead nav anchors | `apps/oip-web/src/components/OipHomePage.tsx` with `OipContent.data.ts` | nav and hero link to `#matters` and `#press`; both sections are commented out | sections restored, or the links removed |
| Test resolves a missing directory | `packages/tooling/library/repo-workspaces/test/integration/node-sync.int.test.ts:22` | `cwd` climbs five levels and resolves a doubled packages segment | six levels; the test asserts the directory exists |
| Claimed tensor check | `packages/tooling/tool/cli/src/commands/Files/internal/MatchPerson.onnx.ts:119` | the comment says tensors are checked before graph construction; only a later `MISSING:` scan exists | a missing required tensor fails before construction, with a test |
| EPERM counted as gone | `packages/tooling/library/qa-capture/src/Collector.service.ts` `isPidAlive` (about line 280) | probe a live pid owned by another user: `kill(pid, 0)` throws EPERM, which `isPidAlive` turns into false | EPERM reads as alive, as `isProcessPidAlive` in `packages/tooling/tool/cli/src/internal/repo-run/ProcessIdentity.ts` already does, so a live collector's handle is never reclaimed |

## Constraints

- One defect per PR unless two share a file; each fix ships a regression test that fails before it.
- Re-verify each defect against `origin/main` before fixing; drop it with a note if already fixed.
- At most three open PRs.

## Acceptance Criteria

- [x] Each listed defect is fixed with a failing-then-passing test, or recorded as not reproducible with evidence.
- [x] The comment that hid each defect is corrected or removed.
- [x] No unrelated refactors or formatting churn.

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
