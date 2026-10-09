# Stage 4: Effect Vitest reconciliation (2026-10-09)

Lane `rsc-v-vitest-canon`, branch `chore/rsc-v-vitest-canon`, owning clone
`beep-effect2`. Step 0 merged `origin/main` and the packet branch as authorized
by the resume ruling. The Stage 1 receipt is present. Sources remain read-only;
no source index, branch, stash or working file was changed.

## Preservation

Read-only exports live under `~/.cache/beep/rsc/v-preserve/2026-10-09/`.
Continuation's staged digest is `70f994b8e2208496`; detector-resources'
unstaged digest is `fed0fc65ff4f4548`. Both match Stage 1. Full export digests
follow. Empty pending diffs hash to SHA256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
The private `manifest.json` records full heads, both pending-diff digests and
untracked archive member lists for all 46 source worktrees.

| Worktree | Head | Export and SHA256 | Disposition and evidence |
| --- | --- | --- | --- |
| `effect-vitest-acp` | `09a8f7339788aadabce6933897d8c03ce65b2419` | No pending delta; retained branch ref `codex/effect-vitest-acp` at recorded head | Superseded: published via #1307 or its own merged PR; exact historical PR/head evidence in V-other-worktrees-and-detector-delta section 2. |
| `effect-vitest-agents-foundation` | `3194e465b6c74077ef53af50ec25c6cb172163d7` | No pending delta; retained branch ref `codex/effect-vitest-agents-foundation` at recorded head | Superseded: published via #1307 or its own merged PR; exact historical PR/head evidence in V-other-worktrees-and-detector-delta section 2. |
| `effect-vitest-business-drivers` | `3d79b3530aa77ccf6d3af7005a8cf9e02db5d489` | No pending delta; retained branch ref `codex/effect-vitest-business-drivers` at recorded head | Superseded: published via #1307 or its own merged PR; exact historical PR/head evidence in V-other-worktrees-and-detector-delta section 2. |
| `effect-vitest-cache-docs` | `784a9a991811b52c34f48f8511f09f56fcdd2a3a` | No pending delta; retained branch ref `codex/effect-vitest-cache-docs` at recorded head | Superseded: published via #1307 or its own merged PR; exact historical PR/head evidence in V-other-worktrees-and-detector-delta section 2. |
| `effect-vitest-canon-baseline` | `bd7a8e0301fc80ed7d1c466f9e79287b5c102724` | `~/.cache/beep/rsc/v-preserve/2026-10-09/effect-vitest-canon-baseline-committed.patch` SHA256 `bc4868da58025de766b75225643ca48fdfb319120699e9f17dd3901c58aba331` | Superseded: baseline landed in #1506; other heads are ancestors of continuation. See sweep V-vitest-canon section 3. |
| `effect-vitest-canon-continuation` | `e4c608f9c10e5e1b500a19943410404a9146f64a` | `~/.cache/beep/rsc/v-preserve/2026-10-09/effect-vitest-canon-continuation-staged.patch` SHA256 `70f994b8e2208496761db45dfae35f70340bc3db5326ba1469123152ced4a61f`<br>`~/.cache/beep/rsc/v-preserve/2026-10-09/effect-vitest-canon-continuation-committed.patch` SHA256 `59a65a7c76e1d1947331230fa1d19f351669a17f739611bc2f150e2681e6dc16` | Port: exact `c921d9e11d..e4c608f9c1` continuation delta; staged notes preserved before rewriting. See continuation. |
| `effect-vitest-canon-detector-resources` | `38890b61aaf58411947f82bc9c1b5270f1d5a9d6` | `~/.cache/beep/rsc/v-preserve/2026-10-09/effect-vitest-canon-detector-resources-unstaged.patch` SHA256 `fed0fc65ff4f454836db5c69776a46706efa0464f6cb43913519dcdf76cd18c7`<br>`~/.cache/beep/rsc/v-preserve/2026-10-09/effect-vitest-canon-detector-resources-committed.patch` SHA256 `57b0379fca4a3a910935768fa575a0d56ba3dd73ab44c51587a8b90d28a49999` | Port WIP; committed history superseded by continuation ancestry. See detector-resources. |
| `effect-vitest-canon-property-boundaries` | `346ebd8447960d91b55d6dfb6089aa1de31a2003` | `~/.cache/beep/rsc/v-preserve/2026-10-09/effect-vitest-canon-property-boundaries-committed.patch` SHA256 `22096612c08588277bb313c77080fb07a99fbb0bf3bbe41f0f541d6eee9dc072` | Superseded: baseline landed in #1506; other heads are ancestors of continuation. See sweep V-vitest-canon section 3. |
| `effect-vitest-canon-property-values` | `d64a63ec8f1b056c77848331610ab9eaa9eac010` | `~/.cache/beep/rsc/v-preserve/2026-10-09/effect-vitest-canon-property-values-committed.patch` SHA256 `13451c1aa8ce516af36075da4e6271c6d740cda179b6e78497b9217ffe4aed95` | Superseded: baseline landed in #1506; other heads are ancestors of continuation. See sweep V-vitest-canon section 3. |
| `effect-vitest-canon-resource-next` | `813d406ac9cda55ba8cffb1229d38973da481c04` | `~/.cache/beep/rsc/v-preserve/2026-10-09/effect-vitest-canon-resource-next-committed.patch` SHA256 `3ee13818a8d5e7368c0ced06ff6e571a67430f8b7753b4b6d80447d2a764a67d` | Superseded: baseline landed in #1506; other heads are ancestors of continuation. See sweep V-vitest-canon section 3. |
| `effect-vitest-capability-leaves` | `38ac5d9da9174ae0adf6dd89c946105700ed12f5` | `~/.cache/beep/rsc/v-preserve/2026-10-09/effect-vitest-capability-leaves-unstaged.patch` SHA256 `c353bdc0005ea4924376c07e80ded293977ed6fff981e40d3746417ef69c9420`<br>`~/.cache/beep/rsc/v-preserve/2026-10-09/effect-vitest-capability-leaves-untracked.tar.gz` SHA256 `c9b7cdf84a8f93239d343c84ec699ef6d6b448e6d3ae3abc3e90e14d5b50fb83` | Superseded: main has WIP scenarios plus stronger lifecycle and listener cleanup checks. See gap-19. |
| `effect-vitest-cli-artifacts` | `e129cf3b79180facd6a2c9ed978914fc11e5478b` | No pending delta; retained branch ref `codex/effect-vitest-cli-artifacts` at recorded head | Superseded: published via #1307 or its own merged PR; exact historical PR/head evidence in V-other-worktrees-and-detector-delta section 2. |
| `effect-vitest-cli-config` | `abb9ab2cea6b289dfb1e89de2b1495d1bda87216` | No pending delta; retained branch ref `codex/effect-vitest-cli-config` at recorded head | Superseded: published via #1307 or its own merged PR; exact historical PR/head evidence in V-other-worktrees-and-detector-delta section 2. |
| `effect-vitest-coverage-followup` | `b5bf6822b90cdfc8ddf36a9abb2bd8e11801495b` | `~/.cache/beep/rsc/v-preserve/2026-10-09/effect-vitest-coverage-followup-staged.patch` SHA256 `b09eed06349da6ea94d669b365ca380ffc7790e4d36e428673cfc2ae32265518` | Port two ci-lane-timings regression cases into CLI wave. See gap-19. |
| `effect-vitest-database-drivers` | `9ab680a91284e255bc389cc70980ef502f0af6d3` | No pending delta; retained branch ref `codex/effect-vitest-database-drivers` at recorded head | Superseded: published via #1307 or its own merged PR; exact historical PR/head evidence in V-other-worktrees-and-detector-delta section 2. |
| `effect-vitest-filesystem` | `0fce23fbace5ef95a1bca9459c341a17d5bbd641` | No pending delta; retained branch ref `codex/effect-vitest-filesystem` at recorded head | Superseded: published via #1307 or its own merged PR; exact historical PR/head evidence in V-other-worktrees-and-detector-delta section 2. |
| `effect-vitest-government-drivers` | `95738112455580bb379b3b87f3173c63ef488da7` | No pending delta; retained branch ref `codex/effect-vitest-government-drivers` at recorded head | Superseded: published via #1307 or its own merged PR; exact historical PR/head evidence in V-other-worktrees-and-detector-delta section 2. |
| `effect-vitest-inventory-proof` | `d9f74d230a949e37f108a9ad52c0bc16a829d98f` | `~/.cache/beep/rsc/v-preserve/2026-10-09/effect-vitest-inventory-proof-unstaged.patch` SHA256 `47d71cfacf6d0cda7401b6a9c015dbd265b2d02a7c202faf139c6d5d2acf1d4c`<br>`~/.cache/beep/rsc/v-preserve/2026-10-09/effect-vitest-inventory-proof-untracked.tar.gz` SHA256 `e1b04204b28874240f0e2dd6e1c9d4178764aa9900ea3ab9fc8b552d56489f1c` | Superseded: stale pre-#1307 evidence; exports retained, no inventory data replayed. |
| `effect-vitest-leaves-checkpoint` | `565bb88600adf02484675d941e786942f87d9d1b` | No pending delta; retained branch ref `codex/effect-vitest-leaves-checkpoint` at recorded head | Superseded: published via #1307 or its own merged PR; exact historical PR/head evidence in V-other-worktrees-and-detector-delta section 2. |
| `effect-vitest-lint-rules` | `46452d68158d07cb817e3454e892273ef93aa76d` | No pending delta; retained branch ref `codex/effect-vitest-lint-rules` at recorded head | Superseded: published via #1307 or its own merged PR; exact historical PR/head evidence in V-other-worktrees-and-detector-delta section 2. |
| `effect-vitest-mcp-kit` | `166721d72c510a04092462f15fbdb5bd8c06e736` | No pending delta; retained branch ref `codex/effect-vitest-mcp-kit` at recorded head | Superseded: published via #1307 or its own merged PR; exact historical PR/head evidence in V-other-worktrees-and-detector-delta section 2. |
| `effect-vitest-md` | `c03a3983e8839e13597791e8ca2569b4b9c0e356` | No pending delta; retained branch ref `codex/effect-vitest-md` at recorded head | Superseded: published via #1307 or its own merged PR; exact historical PR/head evidence in V-other-worktrees-and-detector-delta section 2. |
| `effect-vitest-media-drivers` | `80e01f276dbd9420cc6d19573ebd67fa4e3cf56b` | No pending delta; retained branch ref `codex/effect-vitest-media-drivers` at recorded head | Superseded: published via #1307 or its own merged PR; exact historical PR/head evidence in V-other-worktrees-and-detector-delta section 2. |
| `effect-vitest-observability` | `9b8d959e1d641dc40b4aa6e6138445790ead670b` | No pending delta; retained branch ref `codex/effect-vitest-observability` at recorded head | Superseded: published via #1307 or its own merged PR; exact historical PR/head evidence in V-other-worktrees-and-detector-delta section 2. |
| `effect-vitest-phoenix` | `441bfec4e5acf966cf893ee5ab4b40aacef96b8f` | No pending delta; retained branch ref `codex/effect-vitest-phoenix` at recorded head | Superseded: published via #1307 or its own merged PR; exact historical PR/head evidence in V-other-worktrees-and-detector-delta section 2. |
| `effect-vitest-pr1399-conflict` | `744760f8116ebaf2c165abbbeb638f96e5685422` | No pending delta; retained branch ref `fix/vitest-alias-dock-css` at recorded head | Superseded: dock.css alias on main; #1399 closed with equal-tree finding. |
| `effect-vitest-pretext` | `91a23ba8a3c697c32c3c59f30bcf3d9c4c07f043` | No pending delta; retained branch ref `codex/effect-vitest-pretext` at recorded head | Superseded: published via #1307 or its own merged PR; exact historical PR/head evidence in V-other-worktrees-and-detector-delta section 2. |
| `effect-vitest-provenance` | `769c458492713cf271732e5e10ecb37a7f1a046e` | No pending delta; retained branch ref `codex/effect-vitest-provenance` at recorded head | Superseded: published via #1307 or its own merged PR; exact historical PR/head evidence in V-other-worktrees-and-detector-delta section 2. |
| `effect-vitest-provider-drivers` | `29c8d7355d6f3c8315d7cdef5780a7a787a2781d` | No pending delta; retained branch ref `codex/effect-vitest-provider-drivers` at recorded head | Superseded: published via #1307 or its own merged PR; exact historical PR/head evidence in V-other-worktrees-and-detector-delta section 2. |
| `effect-vitest-rdf` | `d88e3766194c7441d60ca14833b49b1792c6c642` | `~/.cache/beep/rsc/v-preserve/2026-10-09/effect-vitest-rdf-unstaged.patch` SHA256 `28028d3ed537f402df11ffe07e3ba32b262a0680a3562388fa5483a8cecff0ac`<br>`~/.cache/beep/rsc/v-preserve/2026-10-09/rdf-commits.mbox` SHA256 `3f1f353b53debb6b699a9682f10957b73467593c1f0085d11e9d97cb4b05c574` | Port stronger committed failure assertions; WIP properties superseded by main. Separate PR per R105. See gap-19. |
| `effect-vitest-repo-configs` | `4fd64599c9b8cd4f3b456d4cc3b545b82ad108e8` | No pending delta; retained branch ref `codex/effect-vitest-repo-configs` at recorded head | Superseded: published via #1307 or its own merged PR; exact historical PR/head evidence in V-other-worktrees-and-detector-delta section 2. |
| `effect-vitest-repo-utils` | `6ad006114beb6e0fa00adcc71636e8b233b50806` | No pending delta; retained branch ref `codex/effect-vitest-repo-utils` at recorded head | Superseded: published via #1307 or its own merged PR; exact historical PR/head evidence in V-other-worktrees-and-detector-delta section 2. |
| `effect-vitest-runner-browser` | `93bbd7b11b1ce24170af5a6f1cf02c259d331140` | No pending delta; retained branch ref `codex/effect-vitest-runner-browser` at recorded head | Superseded: published via #1307 or its own merged PR; exact historical PR/head evidence in V-other-worktrees-and-detector-delta section 2. |
| `effect-vitest-runner-context` | `59ae5f956b998bc460d2c01b89f1d5f5c139af1a` | No pending delta; retained branch ref `codex/effect-vitest-runner-context` at recorded head | Superseded: published via #1307 or its own merged PR; exact historical PR/head evidence in V-other-worktrees-and-detector-delta section 2. |
| `effect-vitest-shared-domain` | `a97ca9c183b2cf7cdacb4a5c78bfcb5b949bbaae` | No pending delta; retained branch ref `codex/effect-vitest-shared-domain` at recorded head | Superseded: published via #1307 or its own merged PR; exact historical PR/head evidence in V-other-worktrees-and-detector-delta section 2. |
| `effect-vitest-wave-b` | `87a4334fd8f13c626f449559741b2ff5e65d4216` | No pending delta; retained branch ref `codex/effect-vitest-wave-b` at recorded head | Superseded: published via #1307 or its own merged PR; exact historical PR/head evidence in V-other-worktrees-and-detector-delta section 2. |
| `effect-vitest-wave-c` | `cbd522809aa0eba5559a621b89255e931c899319` | No pending delta; retained branch ref `codex/effect-vitest-wave-c` at recorded head | Superseded: published via #1307 or its own merged PR; exact historical PR/head evidence in V-other-worktrees-and-detector-delta section 2. |
| `effect-vitest-wave-d-codegen` | `58f9466fad3eabe0b5fcbbc9eedc8e4a35d2e3c8` | No pending delta; retained branch ref `codex/effect-vitest-wave-d-codegen` at recorded head | Superseded: published via #1307 or its own merged PR; exact historical PR/head evidence in V-other-worktrees-and-detector-delta section 2. |
| `effect-vitest-wave-d-colors` | `f7f9e9a21d3fef7794efdce94eb4485c1796ae27` | No pending delta; retained branch ref `codex/effect-vitest-wave-d-colors` at recorded head | Superseded: published via #1307 or its own merged PR; exact historical PR/head evidence in V-other-worktrees-and-detector-delta section 2. |
| `effect-vitest-wave-d-cosmos` | `d4ef8af2e6f8feae3a0008638f2c15724be8c560` | `~/.cache/beep/rsc/v-preserve/2026-10-09/cosmos-commit.mbox` SHA256 `2c5aa36e96951ca950f4df782849d1954019dcc2bee907c30d75c4674edebad7` | Superseded: post-merge timing provenance only; source tree covered by #1258. Preserved mbox, no old timings replayed. |
| `effect-vitest-wave-d-obs` | `4ab742b7f1379e443504e12437f1c10997e6e9cf` | No pending delta; retained branch ref `codex/effect-vitest-wave-d-obs` at recorded head | Superseded: published via #1307 or its own merged PR; exact historical PR/head evidence in V-other-worktrees-and-detector-delta section 2. |
| `effect-vitest-wave-d-pacer` | `e8feb7244a7c7b8343fd1d7672871dc7cfb62f19` | `~/.cache/beep/rsc/v-preserve/2026-10-09/pacer-commit.mbox` SHA256 `7b54786de933d28d35efe106fa781815ff8e833558b19bc82d44a40ad4036677` | Port logout witness at interruption teardown into separate non-CLI wave. Existing deletion test retained. See gap-19. |
| `effect-vitest-wave-d-pglite` | `6f899d5d773b8ec56292857770d1d5a5c52d4e12` | No pending delta; retained branch ref `codex/effect-vitest-wave-d-pglite` at recorded head | Superseded: published via #1307 or its own merged PR; exact historical PR/head evidence in V-other-worktrees-and-detector-delta section 2. |
| `effect-vitest-wave-d-tailscale` | `a7fe3d14a45636b72a9b13b9d4839f899204d082` | No pending delta; retained branch ref `codex/effect-vitest-wave-d-tailscale` at recorded head | Superseded: published via #1307 or its own merged PR; exact historical PR/head evidence in V-other-worktrees-and-detector-delta section 2. |
| `effect-vitest-wave-d-test-utils` | `ee143d68e052df83f1927510d7fb85dd0d2ea377` | No pending delta; retained branch ref `codex/effect-vitest-wave-d-test-utils` at recorded head | Superseded: published via #1307 or its own merged PR; exact historical PR/head evidence in V-other-worktrees-and-detector-delta section 2. |
| `effect-vitest-wink-isolation` | `4577925f9ec9ce677ab5d13711ac13bed7e14182` | No pending delta; retained branch ref `codex/effect-vitest-wink-isolation` at recorded head | Superseded: published via #1307 or its own merged PR; exact historical PR/head evidence in V-other-worktrees-and-detector-delta section 2. |

## Continuation

Applied `git diff c921d9e11d e4c608f9c1 -- . ':!standards/effect-vitest.inventory.jsonc'`
with `git apply -3`, never branch merge. The generated inventory was excluded.
Fifteen CLI tests conflicted; retained unpublished fixture/property assertion
strength and main's per-module Effect imports. Root and process barrels
introduced by the patch were converted to per-module imports. Production
`RatchetDiff.ts` changes documentation only; no ratchet algorithm changed.
The source helper `Research.test-kit.ts` adds the `parseCard` export used by
the stronger research assertions. Historical proof files remain dated evidence of their
original heads, not acceptance for the new integration.

## Detector-resources

Applied the preserved six-file unstaged patch with `git apply -3`. Five files
conflicted. Retained scoped fixtures and runner-owned platform layers, and
kept main's `effect/Function` dynamic-import expectation in the lint routing
regression. Judge-rubric retains every main rubric-family scenario and the
resource patch's scripted spawner witness (no process is spawned).

## Gap-19

- **RDF committed assertions — port:** three IRI and three URI invalid-input
  exits, four PROV-O invalid-model exits, and four RDF invalid CURIE/blank-node/
  metadata exits now compare full Causes after mapping only typed errors to
  their tags. Die and interrupt reasons remain intact. Existing human-readable
  cause-message assertions remain. ProvRdf and SemanticSchemaConformance
  rejection cases gain exact error-tag payload checks. Every main property,
  codec binding, case title and sample floor stays. Applied the committed
  test-only patch and WIP with `apply -3`, then discarded equal-strength style
  replacements, obsolete codecs and duplicate property additions.
- **RDF WIP — superseded:** main already contains schema-derived IRI/URI
  properties and `round-trips constructive supported PROV records and qualified
  relations without RDF loss` in ProvRdf. The seed uses current schema models;
  the WIP's older NonNegativeInt and duplicate seed are not replayed.
- **Coverage follow-up — port:** `renders an unratified version without claiming
  a ratified context count` and `retains a pending job status and reports
  unavailable pickup timestamps` are added. The existing current-model imports
  and existing ruleset-population tests remain. Both selected CLI runtime cohorts passed; exact final parser rows also passed on Node and Bun.
- **Box — superseded:** main's service tests cover every WIP scenario. Main also
  has explicit early-stream termination, interruption, and listener-removal
  tests absent from the WIP. The old SDK-version expectation, old schema models,
  and shorter timeouts are stale. No Box code is changed.
- **Pacer — port only cleanup witness:** main already parameterizes interruption
  deletion for successful and failed cleanup. Add a fresh `logoutCount` ref to
  that existing transport and assert one logout after its scoped session closes.
  Preserve report-deletion and interrupt assertions. Do not copy the old test
  cohort, and discard the stale `pacer-instrumented-tests` changeset (its source
  remains recoverable from the preserved commit).
- **Cosmos, inventory-proof, pr1399-conflict — superseded:** see their per-lane
  rows and the gap-19 sweep. Old timing/reconciliation records are preserved
  outside the checkout; current generated inventory replaces them.

R105 requires separate package scopes. RDF and Pacer ports are prepared in this
worktree, then exported as a follow-up patch before the CLI-only wave publishes.
No second worktree is created and no other session's checkout is edited.

## Inventory

Starting main snapshot: **1,879 total / 741 open / 1,138 exceptions** under
Effect/Vitest **4.0.2**. Fresh final-source scan: **1,853 total / 716 open / 1,137 exceptions**.
The generated snapshot is tied to source `66953b8bf1f5c2b9dc7cfac3805394683e87c8f5`
and main `2eefbb64af5f1b374d1a012b879a3b747e68507e`. Thirty-five reviewed
files remain byte-identical to R7; main's changeset-remedy assertion and the
new canonical plan property have separate terminal-zero Run 4 review.
Re-anchors from #1552 import layout and #1555 primitive pin shifts are counted
separately from resolved semantic rows. Inventory is generated, never merged.

The authored linkage record is
`goals/effect-vitest-canon/ops/inventory/reconciliation/rsc-v-vitest-canon-2026-10-09.json`.
All 15,513 historical IDs remain unchanged. Of current rows, 1,752 IDs are
unchanged relative to main and 65 re-anchor; 50 old and 24 new occurrence keys
are unmatched (net minus 26). 1,172 current rows link to historical occurrence
keys, including 269 exact historical IDs. Churn includes #1552 import layout,
#1555 pin movement and this integration's semantic/test changes; unmatched
rows are not automatically treated as fixed. Human-lens statuses are preserved.

## Proofs

The final source review covers 37 CLI files at
`a0b0df414732a07b4449f07e1cafd397cf995af0`. Separate read-only Opus 5.5
medium review returned terminal zero after seven rounds; every actionable
finding was repaired. The worker independently re-hashed all 37 files against
the final review snapshot. Inventory, goals, RDF and Pacer were outside that
code review. Runtime and parity evidence follows in the final handoff; no
hosted check or publication is claimed.

Selected CLI cohort: 35 files / 1,248 cases passed on Node (164.512 s) and Bun
(108.154 s). The final parser was subsequently re-proved independently on both
runtimes (3.522 s / 1.968 s); other cohort sources did not change. Merged-source
test-tsgo passed (21.854 s), Fallow audit passed (10.732 s), local docgen passed
(37.484 s), JSDoc ratchet passed (284.152 s), and Fallow health passed (4.070 s).

Scoped coverage did not regress either touched baseline row: RatchetDiff lines
90%, statements 90.9%, branches 100%, functions 85.71%; Research.test-kit is a
100% reexport row with zero executable statements. No untouched floor was
rewritten. This is scoped evidence, not repository-wide coverage.

Knowledge refs failed again at merged source (exit 1, 24.958 s) after #1565: packet SPEC line 374's
literal home-absolute-prefix example remains on main and is classified as a
live host reference. The orchestrator must fix the inherited row once on main.
V preserves that ownership boundary. Full repo-cli verification passed at the reviewed source head in 770.804 s
(audit 743.7 s, docgen 25.5 s). The stale property-boundaries ledger row is
closed through the canonical noteSession service: it probes source git facts
read-only and appends only the workstation ledger. No source files, index or
branch were changed. The CLI has no checkout-selector flag, so the service was
called from the integration lane to preserve the source ownership boundary.

The prepared non-CLI follow-up is preserved in
[rsc-v-noncli-followup.patch.gz](./rsc-v-noncli-followup.patch.gz), SHA256
`b0f087e9b4addbd08cebc4c8cb4750e879a6367d8f344c6a55b278f5f77a4a92`.
Six RDF tests and the Pacer logout witness are excluded from this CLI source
commit. Full package checks passed for the prepared patch: RDF 12.064 s,
Pacer 10.024 s. Selected Node/Bun checks passed for RDF (3.375 / 1.827 s) and
Pacer (3.065 / 1.734 s). These results qualify this prepared patch only; the
future separate PR must merge main and requalify its final head.

Disposition totals across 46 worktrees: **5 port / 41 superseded / 0 discard**.
The stale Pacer changeset is a separate discarded artifact, not a discarded
worktree. No sources, branches or worktrees were removed.

## Retirement

**No removal is authorized by this receipt before merge and liveness checks.**
The orchestrator owns retirement under R106 and must notify the live
build-pipeline session first. Candidates: the six canon lanes, 34 published
worktrees plus the six separately dispositioned gap-19 worktrees above,
`effect-vitest-inventory-next` (non-worktree run residue), and 22 remote branches
listed in the gap-19 sweep. The integration lane remains active. Branch deletion
requires refreshed tip equality and archive receipts; do not operate on clone
`beep-effect2`'s live build-pipeline working tree.

Recovery: revert the eventual PR, or reapply the exports at their recorded
heads. Sources and their pending state remain available unchanged.

### Remote retirement candidates (live read, 2026-10-09)

| Branch | Observed tip |
| --- | --- |
| `codex/effect-vitest-acp` | `09a8f7339788aadabce6933897d8c03ce65b2419` |
| `codex/effect-vitest-agents-foundation` | `3194e465b6c74077ef53af50ec25c6cb172163d7` |
| `codex/effect-vitest-business-drivers` | `3d79b3530aa77ccf6d3af7005a8cf9e02db5d489` |
| `codex/effect-vitest-cli-config` | `abb9ab2cea6b289dfb1e89de2b1495d1bda87216` |
| `codex/effect-vitest-database-drivers` | `9ab680a91284e255bc389cc70980ef502f0af6d3` |
| `codex/effect-vitest-government-drivers` | `95738112455580bb379b3b87f3173c63ef488da7` |
| `codex/effect-vitest-leaves-checkpoint` | `565bb88600adf02484675d941e786942f87d9d1b` |
| `codex/effect-vitest-lint-rules` | `46452d68158d07cb817e3454e892273ef93aa76d` |
| `codex/effect-vitest-mcp-kit` | `166721d72c510a04092462f15fbdb5bd8c06e736` |
| `codex/effect-vitest-md` | `c03a3983e8839e13597791e8ca2569b4b9c0e356` |
| `codex/effect-vitest-media-drivers` | `80e01f276dbd9420cc6d19573ebd67fa4e3cf56b` |
| `codex/effect-vitest-observability` | `9b8d959e1d641dc40b4aa6e6138445790ead670b` |
| `codex/effect-vitest-phoenix` | `441bfec4e5acf966cf893ee5ab4b40aacef96b8f` |
| `codex/effect-vitest-pretext` | `91a23ba8a3c697c32c3c59f30bcf3d9c4c07f043` |
| `codex/effect-vitest-provenance` | `769c458492713cf271732e5e10ecb37a7f1a046e` |
| `codex/effect-vitest-provider-drivers` | `29c8d7355d6f3c8315d7cdef5780a7a787a2781d` |
| `codex/effect-vitest-repo-configs` | `4fd64599c9b8cd4f3b456d4cc3b545b82ad108e8` |
| `codex/effect-vitest-repo-utils` | `6ad006114beb6e0fa00adcc71636e8b233b50806` |
| `codex/effect-vitest-shared-domain` | `a97ca9c183b2cf7cdacb4a5c78bfcb5b949bbaae` |
| `codex/effect-vitest-wave-d-cosmos` | `d4ef8af2e6f8feae3a0008638f2c15724be8c560` |
| `codex/effect-vitest-wave-d-pglite` | `6f899d5d773b8ec56292857770d1d5a5c52d4e12` |
| `fix/vitest-alias-dock-css` | `744760f8116ebaf2c165abbbeb638f96e5685422` |

Merged-source full repo-cli verification **passed in 757.718 s** at
`5a79cbc49a8cd76145db5ead3157f8e0dcc18242` (audit 729.9 s, docgen 26.2 s).
Yeet publication could not obtain admission for more than 45 minutes. The
wrapper starts its capped service before waiting for a slot; service existence
therefore does not prove payload admission. Only V's two unadmitted queue
services were stopped; no peer or executing payload was stopped. Cheap gates,
push, PR creation and hosted readiness did not run. No program-completion
claim is made.

### R105 review and repair preview

Separate read-only Opus review of the original prepared patch found one P2
duplication/function-size risk and no semantic defect. It is retained in
[rsc-v-noncli-source-review.md](./rsc-v-noncli-source-review.md). The repair
preview is [rsc-v-noncli-repair-preview.patch.gz](./rsc-v-noncli-repair-preview.patch.gz),
SHA256 `4ef6960fecf46fc898dc34ec347fb8a594a07220dca4fd508c7615fb162b1d10`.
It extracts the fourteen repeated blocks into one private RDF test helper,
using Cause.map to preserve every reason and annotation. Exit.mapError in the
4.0.2 reference collapses mixed causes to their first typed failure and is
unsuitable here. Two schema-derived pure properties protect mixed causes and
success payloads with 25 runs each; every existing sample floor remains.

The standalone helper success/mixed-cause runtime check passed. The preview
passes git-apply context checking against the unchanged RDF/Pacer baseline.
Its type check could not obtain admission. No repaired-preview package proof,
full runtime cohort, Fallow proof or terminal-zero re-review is claimed. The
original patch and its earlier package/runtime results remain preserved as
separate evidence. Actual RDF/Pacer package files remain unchanged in V.

Patch artifacts are stored as deterministic gzip archives so unified-diff
context blank lines do not become whitespace violations in authored files.
The two quoted patch SHA256 values identify decompressed bytes, which are
unchanged. Replay with gzip -dc into git apply; the original source exports
and their digests remain untouched.

### Run 4 final-main regeneration

Main merge `ed3c1a478e` includes D release and H1 packet evidence. The owning
`beep lint effect-vitest --write` scan after that merge again finds 1,853 rows
across 1,348 files (716 open / 1,137 exceptions), with twelve re-anchored entries
and no count change. This supersedes the prior generated projection for the
serialized integration PR. Source proof results remain attributed to their
recorded heads; main's one-line changeset-remedy assertion updates yeet.test.ts.
The 20:30Z ruling authorizes direct capped Yeet publication for this wave.

### Run 4 property and inventory final-source boundary

Publication exposed a missing schema-derived property in command wiring.
Added a generated plan print/decode property, then repaired both P3 review
findings and registered it through `it.effect.prop` (25 runs, schema-derived
input, complete context and lossless-step equivalence). Separate Opus 5.5
medium re-review returned terminal zero. All 37 source files were re-hashed;
35 match R7 and the two changed files have the new review chain. The final
owner scan at `66953b8bf1` is 1,853 / 716 / 1,137; the temporary direct-property
EV007 row is absent. The authored linkage includes all 15,513 immutable
historical IDs and the current inventory digest. New full package/parity proof
remains queued and is not inferred from the earlier passing source snapshot.

### Post-D private changeset policy

D's policy is present on merged main `2eefbb64af`. Hosted Repo Sanity job
113997596244 rejected this lane's pre-policy repo-cli patch note as a forbidden
private-workspace changeset. The lane note is removed from `.changeset` and
its exact bytes remain in `rsc-v-retired-private-changeset.md`, SHA256
`c130e6f5a0dd1d3b0b8b2c807fd0bdc4ac2bf4e5b81215d698fe6f40ff2cbe07`. No package version or release policy
is changed. Restore the archived note only when reversing the private policy.
