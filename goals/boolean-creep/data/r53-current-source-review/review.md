# R53 current-source drift review — REJECT

**Scope:** this review reconciles citations only. It does not admit inputs, launch a census or provider, or grant P3, implementation or campaign credit.

**R53 review binding:** the independent review ran at HEAD = origin/main = `50e9c4bc41bae20a916e75cdcaaa2c6df453bf6e` with input inventory SHA-256 `6e1026fd…df6f`. That binding is historical evidence for the R53 correction; it is not a claim about the current PR head.

**Post-merge rebind:** the branch merged origin/main `5214ecbed958d30d8447487cf29677fcdc02de8e`. At parent `451e2d51df`, the non-packet source tree equals that main commit, the corrected inventory hashes to `a957b778…e207`, and `bun goals/boolean-creep/ops/validate-inventory.ts` reports `inventory OK: 723 records, 723 unique ids`. The merge changed cited CLI sources, so citation admission remains blocked on the R54 exact-source audit; this structural validator receipt does not replace that review.

**Mapping base:** `cf97523f`. Prior reviewed source `7bd88007` is a packet commit whose non-packet tree equals `cf97523f`.

## Verdict

The author patch set is **rejected as submitted**. Its anchor re-anchors and withdrawals are correct. Its note and design citation edits, however, corrupt historical citations, edit the wrong files, leave lines half-edited, and omit conflicts. Its conflict detector is also incomplete.

I supply reviewer-corrected artifacts for the author's scope. They are **not sufficient for admission**.

## What is correct (approved)

**Anchors.** All 88 record/evidence re-anchors are approved.
- I mapped each one independently through git-diff hunks from cf97 to HEAD.
- Four diff algorithms agree on every anchor.
- The base text equals the head text, and the surrounding windows are equal.
- All 23 weak-anchor rows are relation-preserving moves: owner identity and the Boolean contract are unchanged between cf97 and HEAD.
- Nine of those anchors were already off-owner or off-fact at cf97. That is inherited debt, recorded in `ledger-inherited-debt.json` together with each owner's line at HEAD. It is not changed here.

**Withdrawals.** Both are approved.
- **`with-codec-statics-install-on-owned-schema`:** the owning file was deleted by the codec-statics retirement. The only surviving literal of the same shape, `withStatics.ts:45`, is already owned by `with-statics-attach-statics`, so re-anchoring onto it would duplicate that row's cluster and change the owner.
- **`r2-foundation-static-descriptors-mode`:** `descriptorForMode` and the mode type are gone. The HEAD installer passes descriptors through unchanged, so no Boolean literal owner survives.

**r26 (`activate-panel-reasons`).** The row is retained unchanged. At cf97, `PanelId.equals` was `dual(2, S.toEquivalence(schema))`, so the two-argument call is identical to `S.toEquivalence(PanelId)(a, b)`. The line, the owner and all three members are unchanged.

**Author candidate inventory.** Applying the author patch exactly reproduces `5f56fc7b…b335`: 723 rows, 108 qualified (15 reviewed + 93 designed), 615 disqualified, 0 applied. The packet validator passes on it, and fails on the current inventory (CF-1).

## Blocking defects

- **D1 — historical citations rewritten (11 notes).** These notes explicitly say their numbers refer to immutable main `3657f8f`. At `3657f8f`, those exact lines carry the cited objects. The builder rewrote them anyway. In two notes it falsified "locator moved from 2741 to 2752" into "moved from 2872 to 2752".
- **D2 — partial note edits.** Sibling citations in the same note were left stale. Examples: `125/128/131` and `404-407`, `:1211-1275`, `55-56`, and R39 "owner at" ranges whose record moved.
- **D3 — wrong file or not a citation.**
  - `Annotation464` was resolved to WebAnnotation.ts.
  - `schemas147-162` and `schemas137–150` were resolved to ai-sync/src/schemas.ts.
  - `React19.3.0` was rewritten to `React20.3.0`.
  - The real referents of the first three did not change.
- **D4 — pinned citations treated as current.** Designs bound to `0be1f13`, `93217d9`, `84058d6` or `ab77f10` cite lines that had already drifted before cf97 (22 lines across 6 files). Example: at `0be1f13`, `Quality.command.ts:774–794` is exactly `runGithubCheckLaneGroup`.
- **D5 — continuation tokens skipped.** The builder skipped `:NNN` continuation tokens, leaving 8 lines partially edited.
- **D6 — omitted conflicts.** `yeet-status-remote-check-phase.md:174` cites `yeet-settle.test.ts:903-920, 959, 1168`. Those lines moved, but the site was neither edited nor listed as a manual item.
- **D7 — incomplete detector.** My non-exhaustive sweep finds:
  - about 31 note moves and 25 unambiguous design moves that the report never lists;
  - cited lines whose content changed: GroupPane.tsx:108/133/143 and Status.ts:1472/1473;
  - 67 ambiguous-basename hits.
- **D8 — manual-item attribution.** 9 of the 13 manual items name the wrong file. Every item has a ruling in `manual-item-resolutions.json`:
  - 7 are non-conflicts;
  - 2 are valid moves (CreatePackage `validation1190-1414` → `1188-1412`);
  - 2 need authored updates (the deleted `@beep/schema` import in Html.conformance.ts);
  - `r32 WatchMode.ts1112–1116` was already out of range at cf97, so it is deferred and archived;
  - r26 is retained.

## Corrected artifacts (author scope only)

**`corrected/inventory-patch.json`** (candidate `a957b778…e207`; 723 / 108 / 615 / 0; the packet validator passes):
- the same 88 anchor moves and 2 withdrawals;
- 20 note fields corrected by these rules:
  - **R1:** tokens in historical or pinned-elsewhere clauses are never changed.
  - **R2:** present-tense tokens are updated in full when every endpoint maps byte-identically and range spans are preserved.
  - **R3:** span-changing ranges and changed lines are left unchanged and recorded in the ledger.

**`corrected/r53-design-patches.json`** with `corrected/r53-designs/*.after|.diff` (18 files):
- 49 author lines kept;
- 8 author lines completed;
- 4 lines added (omitted L174, the two manually resolved CreatePackage lines, and html-datalist `:81`);
- 22 author lines reverted, which leaves 9 author files untouched.

**Ledgers:**
- `coverage-218.json` — every conflict in the original report has a ruling; none is unresolved.
- `ledger-unflagged-citations.json` — proposed fixes, not applied and not exhaustive.
- `ledger-inherited-debt.json` — drift that predates R53, plus claims invalidated by the codec-statics retirement. These include html-img L64 "reuse the existing `@beep/schema`/SchemaUtils import" and r3-foundation L125 "preserve JSON decoding".

## Retained validation path

Commit `a71c727164` applied the reviewer-corrected subset. The repository retains everything needed to verify the landed bytes:

- `history/inventory/2026-10-01-pre-r53-source-refresh.jsonl` is the complete 725-row input with SHA-256 `6e1026fd7b98d89550cfa3ec448cb4de08b22eb4377c12c1bcd9bc8b3576df6f`.
- `data/inventory.jsonl` is the 723-row corrected result with SHA-256 `a957b7780afaa5dbe6f59628570e74d845e78bdf2ede485b0b4956496c9ce207`.
- `git diff 50e9c4bc41bae20a916e75cdcaaa2c6df453bf6e a71c727164 -- goals/boolean-creep` reconstructs every applied inventory and design change.
- `coverage-218.json` records a ruling for every conflict in the rejected author proposal. `manual-item-resolutions.json` records all 13 manual rulings.
- `ledger-unflagged-citations.json` and `ledger-inherited-debt.json` are the open blocking lists. They must be reconciled before input admission.
- `bun goals/boolean-creep/ops/validate-inventory.ts` validates source references and inventory structure against the checked-out source.

The private reviewer scripts and rejected intermediate patch are intentionally omitted. The committed archive, result, exact Git diff, coverage ledger, manual rulings, and open ledgers are the durable validation surface.
