# Round 26 reconciliation — terminal, wet and incomplete

Source `7440cb8c4302ce64b87860069a464bafbf65f576`; corpus main
`9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`. The immutable starting inventory
contains 930 records and 149 qualified cases. This full census covers 3,060
files in 25 partitions under the owned round-26 user-manager service.

The primary controller is terminal: 24 primary lanes succeeded and one failed.
All four bounded corrections completed successfully. Main advanced before the
round ended, so its execution receipt also records `sourceStable: false`.
No dry credit is awarded.

Parent reconciliation incorporates subsequent source audits at checkout
`3330f9881a50c96d3f2ec0fcad76f0f7a09027e4`, corpus/main
`52fcc8d1353db9481ef9edb6cc9619500f95568d`. Those audits repair the live
projection; they do not rewrite the older raw execution source identity.

## Completed lane reconciliation

- `r26-foundation-primitive`: exit zero, end-turn event, empty valid JSONL
  report. Both assigned primitive roots were covered; no new qualified or
  disqualified record and no seed drift was reported.

- `r26-foundation-capability`: exit zero, end-turn event, empty valid JSONL
  report, all nine assigned roots covered. The reported helper-header drift
  requires no inventory change: the canonical source-failure record already
  points at its first boolean local on line 634; the function starts at 630.
  Its four independent observations remain the recorded D1 cluster.

- `r26-foundation-schema-n-z`: exit zero, end-turn event, empty valid report.
  Its ParserOptions note identifies the first field rather than a changed
  declaration; the existing schema declaration anchor remains appropriate.
- `r26-foundation-modeling-rest`: exit zero/end-turn, one raw qualified
  candidate. `hasSrcset` belongs in the existing image-size cluster because
  missing sizes implies a present width-profile srcset. The proposed separate
  pair overlaps the existing owner and is absorbed there. The complete image
  cluster now has six locals, 64 representable / 20 reachable tuples. The coupled
  link owner expands to three locals, 8 / 6. Both designs preserve all parser,
  lazy-loading, invalid-present and exact diagnostic behavior. See
  `data/design-refresh-2026-09-09-html-full-clusters.md`.
- `r26-foundation-schema-a-m`: exit zero/end-turn, one raw qualified candidate.
  The three omitted enforcement aliases impose E4 implications over the five
  recorded independent channel observations. Native review confirms all 32
  base vectors are reachable: the sixth `test` enforcement case permits a
  nonempty input with all five observed flags false. The full eight-local
  cluster has 256 representable / 32 reachable tuples and replaces the former
  five-field census entry under its stable id as a designed Tier 1 case. The
  prior D1 row is archived with the narrower HTML rows in
  `history/inventory/2026-09-09-r26-cluster-supersessions.jsonl`. See
  `data/design-refresh-2026-09-09-invariant-enforcement.md` for the exact
  five-class acceptance matrix and encoded compatibility audit.

- `r26-foundation-ui`: exit zero/end-turn, two raw qualified and two D1/D2
  records. The stable notification owner is promoted at 192/24, including the
  four action types, three executed Option states, and disabled projection.
  Both loading-plus-executed render paths remain exact. The stable TodoItem due
  owner is promoted at 16/7, including earlier-today overlap and due presence;
  its distinct metadata owner is promoted at 128/64 with all four priorities.
  The two Todo projections share one input but are independently adjudicated
  relations, implemented atomically with one deletion of hasDueDate. Prior D1
  rows are archived. Dock activation is admitted D1 and dropzone options D2.
- `r26-drivers-a-f`: exit zero/end-turn, five raw D1/D2 records. Admit three
  Firecrawl SDK payload/presence mirrors as D2. FreshBooks entries are callable
  predicates, outside the sibling-bit net. GraphologyOptions has one varying
  Boolean plus a fixed directed tag, so no second Boolean/presence axis exists;
  it is excluded rather than admitted as a cluster. ACP's stale anchor is
  repaired to the current class declaration at 278.
- `r26-drivers-g-m`: exit zero/end-turn, three raw D1/D2 records. Graph3D
  mount probes are callable checks, not co-derived sibling values. MSAL's two
  constant SDK flags occur in separate constructors/functions, so that proposed
  sibling cluster is excluded. GraphMessage/GraphEvent anchors already point
  to current class declarations; first-field notes require no edit.
  The one allowed `r26-m365-retryable-contract-correction1` completed with
  exit zero/end-turn and supersedes the M365 D1 claim. Its full reason domain
  is eight literals plus absence: retryability is 18/9 with E4 proof. The
  explicit None/false fixture does not disprove retryable-implies-reason;
  generic codec invertibility is distinct from supported business tuples.
  Native design/compatibility review is complete. Admit
  `m365-tool-error-retryability` as a stored wire Tier 2 case at 18/9,
  preserving all nine supported wire projections, including explicit None/false.
- `r26-drivers-n-r`: exit zero/end-turn, one raw qualified and five D1/D2
  records. Admit `obs-qa-scene-provisioning` after the full owner audit at
  16/4, including existingSettings/inputCreated. The decoded result migrates
  both creation flags to independent dispositions; no actual encoded consumer
  exists. Preserve all four scene/input outcomes and the branch-local attachment
  operation. OpenClaw gateway projection is admitted D2 and per-group policy/
  mention behavior D1. The two OpenAI strict-plus-required-schema reports have
  only one varying Boolean/presence axis and are excluded. Seed anchors remain
  valid declarations; first-field positions do not establish drift.
- `r26-architecture-ecosystem-internal`: exit zero/end-turn, empty report;
  all nine assigned roots covered. Repair the stale Meta declaration anchor
  from 234 to 269 (its first Boolean is 275). Other seeds remain current.
- `r26-drivers-s-z`: exit zero/end-turn, two raw D1 records. All XAi proposed
  members are callable predicates rather than sibling Boolean values, so the
  old `xai-unexpected-request-payload-slots` D1 is archived and withdrawn; do
  not admit the expanded raw ID. The USPTO report invents names for inline
  predicate calls and likewise is outside the sibling-state net. Final source-anchor audit retains XAi SSE 384, Venice SSE 649 and XAi
  WebSocket 469 as declaration anchors. Their first-field offsets are not
  source drift; see `data/design-refresh-2026-09-09-r26-final-anchors.md`.
- `r26-agents-workspace`: exit zero/end-turn, three raw qualified and two D1
  reports. Chat turn/error atoms are admitted D1: interruption and failed
  durable refresh intentionally expose both Some payloads. Expand Anthropic's
  stable owner to holding/failures/buffered at 8/5; the sequential drain
  explains the fifth reachable state. Admit `runtime-activity-payload-kind`
  as a stored wire Tier 2 case at 8/2 after the full payload and fixture audit.
  RuntimeEvidence is admitted D1 after its explicit no-span and combined-span
  wire fixtures establish all four supported DTO presence pairs. Preserve
  the existing missing-span diagnostic for intentionally incomplete inputs.
  The one bounded fallback correction completed successfully. Admit
  `receipt-fallback-draft-occupancy` at 4/3: currentDraftOccupied is fixed
  and the sole draftToRestore Some write occurs only in its None branch.
  Its native design preserves occupancy observation and fallback ordering.

- `r26-epistemic-ontology`: exit zero/end-turn, one raw qualified and one D1
  record. Promote CandidateComparison's full resolution/review/waiting gate
  at 48/12 and ProposalCard's resolution/disabled/selected/applied cluster at
  24/10 under their stable IDs. Their coupled designs preserve selection,
  applied badges, resolved behavior, and detail indicators. ReviewDialog is
  admitted D1. The vanished ToolbarState D1 is archived and withdrawn: its
  replacement is anonymous function flag parameters, excluded from this
  campaign. The independently qualified returned busy/disabled projection
  remains. The inferOntologySession anchor already points at its first local.

- `r26-shared-documents`: exit zero/end-turn, one raw D1 claim. The one
  allowed `r26-push-failure-implication-correction1` completed with exit zero
  and an end-turn event. Native audit admits `vault-sync-push-failure-disposition`
  at 4/3 as a derived internal Tier 1 case. Its design reuses the existing
  operation status and preserves retry budget, post-increment ordering,
  database writes, and same-pass retries. The callable Box retry predicates
  are separately withdrawn by the cross-lane eligibility correction.
- `r26-law-practice-domain`: exit zero/end-turn, three raw D1 records.
  Admit the closing-date observations as D1. The single-claim report has only
  one Boolean axis; the diagnostic report names issue codes rather than
  Boolean members. Both are excluded from the cluster census.
- `r26-law-practice-runtime`: exit zero/end-turn, one raw qualified report.
  Candor's named members are callable schema guards/equivalence helpers,
  so withdraw the old D1 entry and exclude the proposed expansion. The old
  LegalPosition opposition entry is also callable policies invoked inline,
  and is archived and withdrawn.
- `r26-apps`: exit zero/end-turn, thirteen raw records. Promote the stable
  Hero playback owner with active/playing/posterHidden at 8/4. Admit the Rust
  Sidecar ipc/ipc_ready owner at 4/3 with an idiomatic payload-free enum.
  Preserve the existing Observability requested/allowed 4/3 design: the proposed
  extra capability member is only an inline field in another owner. Both
  composer gate proposals are lone Option projections across different owners,
  so exclude them while retaining the actual independent props/input D1 rows.
  The Vault proposal is a local plus an inline AsyncResult predicate and is
  subsumed by the existing Tier 2 Vault owner. SidecarLifecycle queries, spike
  classifiers, Hero skip predicates and IPC/cosmos classifiers are callable,
  not sibling values. The Rust debug expression has no named second member.
  Withdraw the old App spike D1. Admit both actual Box authentication clusters
  as D1, preserving the early CCG return and fallback-token read boundary.
- `r26-tool-docgen`: exit zero/end-turn, six raw records. Admit
  `docgen-proof-manifest-verification-reason` at 6/3, stored wire Tier 2;
  preserve its exact status/reason encoding. Admit both named Command
  compiler-options source pairs as D1 with file-before-inline precedence.
  Source-extension and documented-example reports invent names for inline
  expressions and are outside the net. The final filesystem-write audit admits
  the real exists/file.isOverwritable decision as D1, with all four write/skip
  rows supported; see `data/design-refresh-2026-09-09-r26-remaining-d1.md`.
- `r26-cli-internal-root`: exit zero/end-turn, three raw records. Admit
  `jsdoc-fence-state` at 4/3 after accounting for fence opening, closing and
  entry state. Its payload needs a tagged union. Admit opener observations D1.
  Turbo's reported members are functions, so exclude the raw expansion and
  archive/withdraw the historical qualified Turbo record and its design.
- `r26-cli-commands-a-c`: exit zero/end-turn, seven raw records. Admit
  `codex-findings-packet-commit-kind` at 4/2 after preserving the validation
  boundary before the two locals coexist. CreatePackage kind guards and family
  evidence probes are callable and excluded. Admit cleanup existence and PST
  acceptance observations D1, and external FileSystem remove options D2.
  The four CreatePackage mutation facts are independent D1 at 16/16. Their
  separately audited retiredNameReused/retiredNameCleared pair is a new 4/3
  Tier 1 qualification, `create-package-retired-name-reconciliation`, whose
  LiteralKit preserves the pre-mutation authorization stage and final no-op.
- `r26-cli-commands-d-k`: exit zero/end-turn, eight raw records. Admit the
  named docgen Command package/all/changedFiles carrier at 8/4 and goals-index
  check/write Command carrier at 4/3. NormalizePlanEntry has one Boolean and
  required dimension payloads; deriving an equality predicate invents a
  second member, so exclude it. All three rubric proposals and MatchPerson
  platform classifiers are callable; exclude them and withdraw the obsolete
  rubric D1. SeedSnapshot's independent events-directory/trace presence is D1.
- `r26-cli-commands-l-q`: exit zero/end-turn, four raw records. Admit
  AllowlistCheckSummary at 4/3 while preserving its explicit failed/empty
  defaults, and OSV ignore expiry at 4/3 with its real expiry payload. Coverage
  replacement/skip observations remain independent D1. The one bounded docgen
  coverage correction completed successfully: admit the full configuration and
  three enforcement flags at 16/10 as `package-inventory-docgen-coverage`,
  stored/persisted Tier 2, preserving all documented defaults and encodings.
- `r26-cli-commands-r-z`: exit zero/end-turn, seven raw records. The runner
  report expands its stable owner to three actual Options and four match/fresh
  bits at 128/27; preserve all legacy fields through the reviewed target codec.
  Promote stable `sync-data-target-selection` at 4/2 with the all/targetId pair;
  the dynamic id is payload and includeAuthenticated remains independent.
  Admit complete ConflictDerivation at 60/11, including the unmeasured returns,
  empty conflict paths and independent policy-failure OR. Its seven-state target
  keeps conflict and policy owners distinct while preserving fleet JSON.
  WorktreeRemovalReceipt is D1: explicit renderer fixtures support all four
  deleted/branch-presence pairs, including true/None. VersionSyncReport,
  WorktreeDoctorEntry and WorktreeReapReport raw proposals invent predicates
  over required arrays/numbers and are outside the net. Keep the actual
  WorktreeDoctor multi-flag D1 owner. Final anchors are reconciled in
  `data/design-refresh-2026-09-09-r26-final-anchors.md`.
- `r26-cli-yeet`: exit zero/end-turn, two raw records. Provenance skipped and
  failed are independent D1 observations. The portfolio staged/stagedDeletion
  pair is an anonymous function flag parameter, outside the campaign. The same
  final scope audit withdraws the canonical D1 runWorktreeRemove options
  parameter while retaining the real named WorktreeRemovalRequest owner.
- `r26-tooling-library-policy-test`: exit one, no end-turn event, empty
  report, provider output-budget failure. This partition did not complete and
  its empty output is not dry evidence. The next complete census splits this
  174-file owner into three smaller partitions while retaining full coverage.

## Cross-lane historical corrections

The strict value-carrier audit withdraws eleven previously qualified callable
records, including Turbo and ten additional tooling predicates. Their old rows
and designs are preserved under dated history paths. Three actual simultaneous
local owners (Docker tag kind, ecosystem import kind and registration deletion
notes) remain qualified at 4/3. Nineteen old D1 records are removed from the live
projection because their declarations are excluded parameters, callable
policies, obsolete callable owners or synthetic member sets.

The complete source proofs and per-id actions are in:

- `data/design-refresh-2026-09-09-qualified-withdrawals-integration.md`
- `data/design-refresh-2026-09-09-tooling-qualified-carriers.md`
- `data/design-refresh-2026-09-09-version-doctor-eligibility.md`
- `data/design-refresh-2026-09-09-r26-final-anchors.md`
- `data/design-refresh-2026-09-09-r26-remaining-d1.md`
- `data/design-refresh-2026-09-09-runners-sync-selection.md`
- `data/design-refresh-2026-09-09-worktree-conflict-removal-reap.md`

## Execution receipt table

| Lane | Exit | End turn | Raw records | Raw qualified |
| --- | --- | --- | --- | --- |
| `r26-agents-workspace` | 0 | true | 5 | 3 |
| `r26-apps` | 0 | true | 13 | 8 |
| `r26-architecture-ecosystem-internal` | 0 | true | 0 | 0 |
| `r26-cli-commands-a-c` | 0 | true | 7 | 1 |
| `r26-cli-commands-d-k` | 0 | true | 8 | 4 |
| `r26-cli-commands-l-q` | 0 | true | 4 | 2 |
| `r26-cli-commands-r-z` | 0 | true | 7 | 7 |
| `r26-cli-internal-root` | 0 | true | 3 | 2 |
| `r26-cli-yeet` | 0 | true | 2 | 1 |
| `r26-docgen-coverage-implication-correction1` | 0 | true | 1 | 1 |
| `r26-drivers-a-f` | 0 | true | 5 | 0 |
| `r26-drivers-g-m` | 0 | true | 3 | 0 |
| `r26-drivers-n-r` | 0 | true | 6 | 1 |
| `r26-drivers-s-z` | 0 | true | 2 | 0 |
| `r26-epistemic-ontology` | 0 | true | 2 | 1 |
| `r26-fallback-draft-exclusion-correction1` | 0 | true | 1 | 1 |
| `r26-foundation-capability` | 0 | true | 0 | 0 |
| `r26-foundation-modeling-rest` | 0 | true | 1 | 1 |
| `r26-foundation-primitive` | 0 | true | 0 | 0 |
| `r26-foundation-schema-a-m` | 0 | true | 1 | 1 |
| `r26-foundation-schema-n-z` | 0 | true | 0 | 0 |
| `r26-foundation-ui` | 0 | true | 4 | 2 |
| `r26-law-practice-domain` | 0 | true | 3 | 0 |
| `r26-law-practice-runtime` | 0 | true | 1 | 1 |
| `r26-m365-retryable-contract-correction1` | 0 | true | 1 | 1 |
| `r26-push-failure-implication-correction1` | 0 | true | 1 | 1 |
| `r26-shared-documents` | 0 | true | 1 | 0 |
| `r26-tool-docgen` | 0 | true | 6 | 1 |
| `r26-tooling-library-policy-test` | 1 | false | 0 | 0 |

## Frozen verdict

The canonical post-reconciliation projection is **941 records: 162 qualified
and 779 disqualified** (611 D1 / 168 D2). Qualified tiers are 126 Tier 1 and
36 Tier 2. Every qualified case has a design; no case is applied and the
replacement independent P3 review remains pending.

Relative to the immutable 930-record, 149-qualified seed:

- 24 newly qualified cases, including 8 promotions of existing D1 owners;
- 4 expanded existing qualified clusters;
- 11 withdrawn qualified callable records;
- 19 withdrawn old D1 records.

The exact id lists and hashes are in `round-verdict.json`. The frozen canonical
snapshot is `history/inventory/2026-09-09-post-r26.jsonl`. Source citation
refreshes do not change the raw lane source identities. No failed or incomplete
partition is replaced by native design-audit coverage.

**Verdict: wet and incomplete; zero dry credit.** The newer upstream main
`663904610c` was fetched after these frozen audits. Merge it forward after the
remaining design-citation reads finish, install its frozen lock, refresh the
small affected source delta and run packet verification before launching the
next complete 27-partition census. No implementation is authorized by this
reconciliation. GATE 2 still requires two complete current-source dry rounds,
the replacement exact-source zero-finding review and merged packet ratification.
