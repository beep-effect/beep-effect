# Agent Rating Critique Fixes Spec

## Objective

Land the 2026-10-21 repository rating (overall 8/10;
[`research/repository-rating.md`](./research/repository-rating.md)) as
durable, citable evidence, then execute its deductions as scored fix phases
until a re-rating under the same rubric shows the targeted dimensions
improved. The rating is the baseline; this packet is the fix programme.

## Non-Goals

- Fixing every deduction in the packet-landing PR. That PR (P0) ships only
  the packet and the rating. Each fix phase is its own reviewed PR.
- Re-litigating the scores without new evidence. A score changes only via
  the P4 re-rating protocol (same dimensions, same counting commands).
- Changing the S11 merge-over-red policy unilaterally. S11 is an operator
  ruling (2026-10-09/2026-10-13); P2 records a recommendation and evidence.
  Tightening or removing it is an operator decision.
- Weakening any gate to raise a score. Removing a silent-green hole may
  turn packages red; that is the fix working, and the reds get owners.
- New paid services, quota purchases, or plan changes (money: operator).

## Source Hierarchy

1. Operator instruction creating this packet (export the rating; bootstrap
   a canonical packet; ship it from a worktree to mergeable).
2. `AGENTS.md` (repo laws) and `standards/ARCHITECTURE.md`.
3. [`research/repository-rating.md`](./research/repository-rating.md) —
   the scored baseline. Every fix cites a section (§1–§11).
4. This `SPEC.md`, then `PLAN.md`, then `GOAL.md`.

## Target Surfaces

- P0 (this packet): `goals/agent-rating-critique-fixes/**` only, plus the
  generated `goals/INDEX.md` projection.
- P1: `AGENTS.md` (pin dedup), `docs/runbooks/agent-pools.md`,
  the graft skill (retired 2026-10-28), `README.md` (stale model names),
  skill frontmatter under `.agents/skills/`, root `vitest.config.ts`.
- P2: `.github/workflows/check.yml` + `.oxlintrc.json` + `biome.jsonc`
  (warn-only promotion candidates), S11 evidence note in `AGENTS.md`
  (operator-gated), per-package coverage floors, `passWithNoTests`
  occurrences in package manifests / `vitest.shared.ts`.
- P3: `packages/foundation/modeling/html/src/Html.model.ts`,
  `packages/tooling/tool/cli/src/commands/Corpus/internal/RestorationTransformations.ts`,
  `packages/tooling/library/repo-utils/src/JSDoc/JSDoc.ts`,
  `packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts`,
  generated registries under `src/generated` / `src/_generated`.
- P4: this packet (`history/reflections/`, `proposedCloseout` in
  `ops/manifest.json`), re-rating report.

## Constraints

- Every fix PR cites the rating section it addresses and the counting
  command that will prove the delta (same command as the baseline).
- Package-touching phases run
  `bun run beep quality package-verify <@beep/package>` before handoff
  (`--quick` only where the surface justifies it).
- `AGENTS.md` edits stay lean: it is the prompt-cache prefix. P1 must
  reduce its byte count, never grow it.
- Docs wrap at 100 columns. `GOAL.md` stays ≤ 4,000 characters.
- No hand-editing generated scripts blocks; use
  `bun run beep lint package-scripts --write` where a manifest changes.

## Acceptance Criteria

### P0 — packet lands (this PR)

- [ ] `research/repository-rating.md` contains all 11 scored dimensions,
      each with at least one (+) and one (−) item citing a repo path, plus
      the Disclosure section.
- [ ] Packet validates: `bun run beep goals doctor` reports no new
      findings for this slug; `jq` parses `ops/manifest.json`;
      `git diff --check` passes; `GOAL.md` ≤ 4,000 chars.
- [ ] PR driven to mergeable via Yeet (required checks green or S11-free
      attribution, zero unresolved threads, review window elapsed).

### P1 — cheap wins (target: Agent 7→8, Documentation 7→8)

- [ ] Model pins stated once in `AGENTS.md` (one manifest table); the
      duplicated volume-pool prose in `docs/runbooks/agent-pools.md` is
      deleted or replaced by a citation. `AGENTS.md` byte count decreases.
- [ ] Zero stale model names: `rg -P 'claude-opus-5(?!-5)(?!\w)|gpt-5\.6|grok-4\.6'`
      (the look-aheads skip the current `claude-opus-5-5` pins and still
      match the bare `claude-opus-5` and `claude-opus-5-thinking-high`)
      over `AGENTS.md`, `.agents/skills/`, `docs/runbooks/`, `README.md`
      returns only historical/provenance records that name their date,
      the `AGENTS.md` prohibition line and its tool-owned `superseded:` list.
- [ ] Every `.agents/skills/*/SKILL.md` carries the frontmatter keys
      `AGENTS.md` requires, or the law is amended with a Decision Log
      entry. `bun run beep skills update --check` passes.
- [ ] Root `vitest.config.ts` globs include depth-5 packages; a bare root
      `vitest` run discovers the 51 previously missed configs (count
      proven by listing projects before/after).

### P2 — silent-green and gate honesty (target: Testing 8.5→9+)

- [ ] `passWithNoTests` removed from every package that has
      `test/**/*.test.*` files; the remaining set is enumerated in the PR
      with a reason per package. A deleted-suite canary fails loudly.
- [ ] At least the packages covering the rating's sampled floors set
      absolute vitest thresholds, or the coverage baseline records why
      fail-on-drop suffices per package.
- [ ] Warn-only lint rules and non-required CI lanes from §7 are either
      promoted to required or listed in an exception ledger with a
      removal condition. S11 recommendation recorded for the operator.

### P3 — maintainability (target: 6.5→7.5, DX 6→7)

- [ ] No handwritten `src` file exceeds 2,500 lines among the four named
      mega-files; splits keep public subpaths stable (or ship a major
      changeset where they cannot).
- [ ] Generated registries (`*.gen.ts`, `src/generated/**`,
      `src/_generated/**`) are excluded from graft/search size audits by
      relocation or by tooling config, with the before/after byte counts
      recorded.
- [ ] Each split package passes `bun run beep quality package-verify`.

### P4 — re-rate and close

- [ ] Re-rating under the identical rubric lands as
      `research/re-rating-YYYY-MM-DD.md`; overall ≥ 8.5 or each missed
      target carries a named follow-up packet.
- [ ] Closeout reflection in `history/reflections/`;
      `bun run beep lint reflection-artifacts` passes; the final fix-wave PR
      records `proposedCloseout` (`completed-retained`) in `ops/manifest.json`
      and operative status stays `active` until
      `bun run beep goals completion refresh` verifies the merge.

## Verification Matrix

| Claim | Command / evidence |
| --- | --- |
| Rating verbatim, Disclosure-corrected | `rg -c "^## " research/repository-rating.md` = 15 |
| Manifest valid | `jq . ops/manifest.json`; `bun run beep goals doctor` |
| Launcher size | `test "$(wc -m < GOAL.md)" -le 4000` |
| Whitespace/wrap | `git diff --check`; `awk 'length>100'` over packet md |
| Stale pins gone (P1) | `rg` counts in Acceptance P1, before/after |
| Silent-green closed (P2) | canary: delete a suite in a scratch pkg; run must fail |
| Mega-files split (P3) | `wc -l` on the four named files, before/after |

## Stop Conditions

- A fix requires changing a public API, schema, or the S11 policy: record
  the decision and reversal in the Decision Log; S11 itself stops for the
  operator (it is their ruling, not a code bug).
- A re-rating count cannot be reproduced with the baseline command:
  stop, fix the counting method in both reports, never silently re-base.
- Any spend (purchases, paid endpoints, quota top-ups): operator only.

## Decision Log

| Date | Decision | Reason | How to reverse |
| --- | --- | --- | --- |
| 2026-10-21 | D1: One packet, phased fix PRs; P0 ships evidence only. | The operator asked for the review exported and a canonical packet shipped to mergeable. Bundling code fixes would make the evidence PR unreviewable. | Split phases into successor packets; keep this one as the evidence anchor. |
| 2026-10-21 | D2: Overall = mean of 11 dimensions (87.5/11 ≈ 8). | Transparent, reproducible from the scorecard; avoids hidden weighting. | Re-weight in a re-rating with the weights stated up front. |
| 2026-10-21 | D3: S11 is a recommendation item, not a fix item. | S11 is a standing operator ruling; agents record friction, operators rule. | Operator ruling replaces S11; then delete this row's rationale. |
| 2026-10-21 | D4: Maintainability/security scores are orchestrator-verified, disclosed in the rating. | The audit synthesis was truncated; hiding that would overstate the evidence. | Supersede with a full re-rating at P4. |
| 2026-10-21 | D5: Review corrections from PR #1996's reviewer pass. The landed rating is amended only through corrections recorded in its Disclosure (the §10 Firecrawl row removed, the launch-failure note re-described); the P1 stale-name regex excludes the current `claude-opus-5-5` pins and its acceptance allows the `AGENTS.md` prohibition line and superseded list; the `passWithNoTests` surface moves from P1 to P2 so the phase surfaces do not overlap. | The Firecrawl file does not exist in the tree; the launch failure was an availability failure misread as a stale pin; the `\b` regex matched every current pin, so the P1 box could never be checked honestly; P2 acceptance and the PLAN P2 row already own `passWithNoTests`. | Restore the pre-correction text of the rating, SOURCES.md and SPEC.md from this PR's head before the fix commit (2c8293dea5) and drop this row; or re-rate at P4 with the corrected baseline. |
| 2026-10-21 | D6: Closeout is declared, not flipped: the final PR records `proposedCloseout` (`completed-retained`) in `ops/manifest.json` and operative status stays `active` until `bun run beep goals completion refresh` verifies the merge (GOAL done line, PLAN P4 exit, SPEC P4 surface and acceptance aligned). P0 exits only once its PR is merged to `main`. | A proposal never reports achievement; the canonical closeout template and PLAN's closeout checklist already required `proposedCloseout`, and a P0 exit on 'mergeable' let P1 start on a branch without the rating (review threads on #1996). | Restore the pre-correction text from this PR's head e6bdbd08aa and drop this row. |

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
