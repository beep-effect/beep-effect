# Ingestion Secret Scrub Plan

## Status

Status: `pending` — P0 consolidation and fixtures are the next authorized work.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Pattern-bank consolidation audit | pending | Audit `AiMetricsRedactionResult` and `CauseRedaction` rule-by-rule; deduplicate and assign one canonical owner/version; build synthetic hit, near-miss, placeholder, coverage-gap, and residue fixtures. | Both banks and consumers are accounted for; one versioned bank contract and fixture matrix are recorded; contradictions block P1. |
| P1 Implement | pending | Add the smallest Effect-first/schema-first file-processing scrub transform, no-raw-match evidence projection, coverage/residue contract, retention behavior, and one real prompt-boundary gate. | Supported inputs sanitize with correct proof; blocked/unknown states cannot reach prompts; no raw canary enters observable or persisted output. |
| P2 Verify | pending | Run fixture, bank-version, canary-absence, prompt-gate, retention, focused package, and repo proof. | Every `SPEC.md` acceptance item is green or a reproducible blocker is archived without weakening confidentiality/fail-closed rules. |
| P3 Close | pending | Drive the PR to mergeable through Yeet, write the closeout reflection, archive non-secret proof, and synchronize packet state. | Yeet/GitHub reports mergeable; reflection lint passes; README, PLAN, and manifest match the evidence. |

## P0 Audit Contract

- Inventory every rule/category and consumer in
  `packages/tooling/library/ai-metrics/src/privacy.ts` and
  `packages/foundation/capability/observability/src/CauseRedaction.ts`.
- Record duplicates, overlaps, category conflicts, ordering assumptions,
  placeholder behavior, and detection gaps.
- Select one canonical owner and stable bank-version identifier; both ingestion
  and observability must consume it rather than fork it.
- Build only synthetic fixtures: supported hits, near-misses, placeholders,
  overlap/partial forms, unknown coverage, and secret-shaped residue.
- Give every fixture exact sanitized output, category/count, coverage/residue,
  `safeForPrompt`, evidence, and persistence/log absence expectations.

## P3 Closeout Checklist

Before marking the packet closed (`status` to `completed-retained`):

1. Write `history/reflections/<YYYY-MM-DD>-<agent>.md` via `/reflect`, covering
   tooling, implementation, and goal/prompt quality.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md`, this plan, and `ops/manifest.json` with final evidence.
4. Confirm Yeet/GitHub mergeability and archive only non-secret proof.

## Execution Notes

- P0 is a hard gate. Do not add a third bank or freeze public contracts before
  the inventory and fixtures exist.
- Preserve unrelated worktree changes and keep `SPEC.md` normative.
- Never archive raw secret/canary values in packet evidence; record scan method,
  counts, categories, and pass/fail only.
- Injection, PII/OOXML, sanitizer, fetch, resolver, and vault work stay gated.

## Verification Commands

```sh
test "$(wc -m < goals/ingestion-secret-scrub/GOAL.md)" -le 4000
jq . goals/ingestion-secret-scrub/ops/manifest.json
rg -n "ingestion-secret-scrub|GOAL.md|agentLaunchers|packetAnchorDocument" goals/ingestion-secret-scrub
git diff --check -- goals/ingestion-secret-scrub explorations/ingestion-security-secret-governance explorations/ATLAS.md
bun run beep yeet verify
bun run beep lint reflection-artifacts
```
