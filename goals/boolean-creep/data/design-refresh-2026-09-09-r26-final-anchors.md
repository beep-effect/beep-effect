# Round 26 final source-anchor reconciliation

## Scope

- Frozen checkout: `3330f9881a50c96d3f2ec0fcad76f0f7a09027e4`.
- Audited corpus main: `52fcc8d1353db9481ef9edb6cc9619500f95568d`.
- Compared the `r26-drivers-s-z`, `r26-cli-commands-r-z`, and
  `r26-cli-yeet` completion notes with the current canonical inventory, live
  source, and `data/main-52fcc8d-citation-refresh.json`.
- This is an anchor/scope audit. It does not revise qualification, perform P3,
  or mutate inventory, designs, source, tests, or Git state.

## Anchor convention used

The inventory contract allows either the declaration line or the first Boolean
member line. A canonical declaration anchor remains correct when later fields
move. A completion note that reports a first-field line therefore does not by
itself prove canonical drift. I recommend retaining declaration anchors for
named classes, schemas, type aliases, and named helpers already anchored that
way. A line that points inside an unrelated preceding expression needs repair.

## Drivers S-Z completion notes

| Record/symbol | Completion observation | Merged source | Decision |
| --- | --- | --- | --- |
| `wink-token-to-ai-flags` / `tokenToAi` | 121 to 123 | Declaration is line 123 | Already covered by `main-52fcc8d-citation-refresh.json`; no further change. |
| `xai-sse-done-payload` / `XAiServerSentEvent.done` | First Boolean at 387; inventory had 390/384 | Class declaration 384; `data` 386; `done` 387 | Keep canonical primary line 384. It is the exact named schema declaration, not stale drift. |
| `venice-sse-done-payload` / `VeniceAIServerSentEvent.done` | First Boolean was 654 at the pre-merge source | Class declaration 649; `data` spans 651-654; `done` is now 655 | Keep canonical primary line 649. The 648 to 649 declaration shift was already applied by the main citation refresh. Do not replace the stable declaration anchor with field line 655. |
| `xai-websocket-message-binary` / `XAiWebSocketEvent.isBinary` | First field at 474; inventory 469 | Union schema declaration 469; generated member fields begin 470; `isBinary` 474 | Keep canonical primary line 469. This is the declaration for the complete mapped union; 474 is only the nested optional Boolean field. |
| `r26-drivers-s-z-xai-request-payload-probes` / `addRequestBody.unexpectedPayload` | Full expansion starts at `hasRequestPayload` 321; old narrower predicate starts 330 | Predicate declarations are 321, 330, 333, and 336 | Raw D1 row already uses line 321. No canonical record exists and no anchor action is needed. The functions are callable predicates, so the raw row should not be promoted into a stored-state design. |
| `r3-drivers-arch-uspto-download-host-probes` | `isSameUsptoHost` is 231; pair begins at 152 | `isDownloadOptionRecord` 152; `isSameUsptoHost` 231 | Keep canonical line 152. It anchors the first predicate in the declared member pair. |

The other raw S-Z row, `r26-drivers-s-z-uspto-api-url-checks`, is already D1
at `Uspto.config.ts:35`; its source did not move in the `52fcc8d` merge.

### Venice and xAI evidence cites

The current primary anchors are settled above. Two evidence notes span
two-arm expressions, so their single-line cites should be interpreted as entry
points rather than as field anchors:

- xAI `parseSseData` begins its terminal/data branch at
  `XAi.service.ts:588`; the terminal constructor is 589 and the data constructor
  is 592. Canonical E3 line 591 sits in the data arm. If the parent is already
  normalizing evidence entry points, use 588; otherwise this is not a
  source-drift correction and need not block integration.
- Venice `parseSseData` begins its branch at
  `VeniceAI.service.ts:1899`; constructors are at 1900 and 1904. Canonical E3
  1900 is the terminal constructor. Line 1899 is the more complete branch
  entry, but again this is citation precision rather than merge drift.

The xAI reader at `XAiLanguageModel.service.ts:210`, Venice reader at
`VeniceAiLanguageModel.service.ts:215`, and xAI WebSocket writers at
`XAi.service.ts:703-718` are unchanged by the merged main.

## CLI commands R-Z completion notes

The following apparent shifts are declaration-versus-first-field differences
and require no canonical correction:

| Canonical record | Canonical declaration | First Boolean/member noted by scanner | Decision |
| --- | --- | --- | --- |
| `worktree-porcelain-accumulator` and its detached/branch companion | `Worktree.schemas.ts:360` | `detached` 364 | Keep 360. |
| `runners-bake-freshness` | `Runners.schemas.ts:304` | `lockfileMatches` 313 | Keep 304. Its E4 source was separately refreshed to `Runners.service.ts:762`; `fresh` is 785. |
| `runners-bake-cli-mode` | `Runners.command.ts:93` | `plan` 94 | Keep 93. |
| `worktree-doctor-entry-facts` and detached/branch companion | `Worktree.command.ts:227` | `detached` 231 | Keep 227. |
| `worktree-removal-mode` | `Worktree.schemas.ts:304` | `archive` 310 | Keep 304. |
| `sync-data-target-selection` | `SyncDataToTs.command.ts:61` | `all` 63 | Keep 61. |
| `r26-cli-commands-r-z-conflict-derivation` | `Fleet.service.ts:1088` | `probeFailed` 1092 | Keep the current designer-corrected declaration anchor 1088. |
| `r26-cli-commands-r-z-worktree-removal-receipt-branch-deleted` | `Worktree.schemas.ts:347` | `branchDeleted` 353 | Keep the current declaration anchor 347. |

Two completion-note anchors are genuinely stale and are absent from
`main-52fcc8d-citation-refresh.json` because their files did not change between
the old and new main commits:

1. `worktree-residue-reason-flags`: canonical line 243 points into the preceding
   archive-plan callback. `residueReasonMatcher` now begins at
   `Worktree.service.ts:265`; proposed correction is **243 to 265**.
2. `r3-tooling-bun-report-drift-flags`: canonical line 540 is the `onSome`
   branch inside `target`, not the named helper or either Boolean. The helper
   declaration is 538 and the first listed Boolean local, `hasDrift`, is 556.
   For the existing sibling-local convention, proposed correction is
   **540 to 556**. Line 538 is an allowed declaration alternative, but 556 is
   the precise first-member anchor reported by the Round 26 lane.

The completion note's `runWorktreeRemove.options` shift should not be repaired
from 797 to 802/804. Canonical record `r3-tooling-worktree-remove-options`
describes the anonymous options parameter at `Worktree.command.ts:802-806`.
Function flag parameters are outside the campaign net. Recommend withdrawing
that canonical D1 record and retaining a scope-withdrawal receipt instead of
updating its line. `WorktreeRemovalRequest` at `Worktree.schemas.ts:304-318`
remains the real named carrier and is separately qualified.

The raw VersionSync `hasDrift/categories`, worktree-reap
`applied/retiredCount`, and worktree-doctor `clean/changeCount` rows also do not
need anchor admission. Their required array/numeric scalars do not become
sibling Boolean members by applying empty/nonempty or zero/nonzero predicates;
their eligibility dispositions are recorded in the dedicated Round 26 audits.

## Yeet portfolio candidate

`r26-cli-yeet-portfolio-staged-deletion` must be excluded rather than admitted.
At `PortfolioIndexGuard.ts:136-142`, `staged` and `stagedDeletion` occur only in
the anonymous input type of the exported function
`portfolioIndexPublishDisposition`. This is exactly an anonymous function flag
parameter, which the sweep contract excludes entirely.

The sole product call at lines 219-238 computes those temporary inputs from the
publish intent and staged-deletion query. The function immediately returns the
already-modeled `PortfolioIndexPublishDisposition` literal at lines 143-146;
no Boolean pair is stored, encoded, persisted, returned, or carried onward.
The implication observed by the raw writer remains true but does not override
the scope exclusion.

Proposed parent action:

- Do not admit `r26-cli-yeet-portfolio-staged-deletion`.
- Preserve the raw row in a scope-withdrawal receipt that cites
  `PortfolioIndexGuard.ts:136-142` and the packet's function-parameter
  exclusion.
- Do not create a design or a replacement Boolean record; the output literal
  already owns the disposition domain.

The `r26-cli-yeet.execution.json` completion summary contains no numeric line
drift. Its `ciParity`, `PrCloseoutReport.retriggeredGreptile`, optional
`YeetStatusRemote.isDraft`, and extra `YeetMergeReadyEncoded` observations are
carrier-completeness notes, not stale citation reports. The main citation
refresh already covers the Yeet files that actually shifted between the two
main commits.

## Proposed parent corrections

| ID | Action |
| --- | --- |
| `worktree-residue-reason-flags` | Update primary line 243 to 265. |
| `r3-tooling-bun-report-drift-flags` | Update primary line 540 to 556. |
| `r3-tooling-worktree-remove-options` | Withdraw as an excluded anonymous function-parameter record; do not line-refresh it. |
| `r26-cli-yeet-portfolio-staged-deletion` | Do not admit; preserve a scope-withdrawal receipt. |
| `xai-sse-done-payload` | Keep primary declaration line 384. Optional evidence-entry precision: E3 591 to branch entry 588. |
| `venice-sse-done-payload` | Keep primary declaration line 649. Optional evidence-entry precision: E3 1900 to branch entry 1899. |
| `xai-websocket-message-binary` | Keep primary declaration line 469. |

All remaining completion-note line observations are either already present in
`main-52fcc8d-citation-refresh.json`, already reflected in the current
canonical record, or are deliberate declaration anchors requiring no change.

## Verification

- Confirmed the assigned checkout and corpus identities with `git rev-parse`.
- Read the three Round 26 execution summaries, their JSONL reports, the current
  canonical rows, and the complete relevant source declarations.
- Checked every named ID against
  `data/main-52fcc8d-citation-refresh.json` before proposing an additional
  correction.
- No source, design, inventory, status, test, dependency, generated, or Git
  file was modified. Only this audit handoff was created.
