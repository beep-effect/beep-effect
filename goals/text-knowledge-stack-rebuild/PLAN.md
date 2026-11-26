# Text-Knowledge Stack Rebuild Plan

## Status

Status: `in-progress` (P0 Design and grill complete, PR #3420 merged as `dcf6b16a77d`;
P1 L0 identity in progress; P2 L1 text content-final in its lane;
P3 L2 annotation content-complete in its lane, PR not open)

## Shape

Design first, then rewrite the layers bottom-up along the dependency DAG and
cut every consumer over as each layer lands, then retire what the new layers
replaced. The operator's 2026-11-09 ruling (breaking changes are acceptable;
build the best core) removed the earlier repair-then-rewrite order; the risk it
guarded against, effort going to names before evidence, is carried instead by
one standing acceptance consumer: the office-action flow stays green at every
phase exit from P3 on. Each phase ships as its own PR or PR stack through
Yeet; a packet holds at most three open PRs.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Design and grill | complete (PR #3420, merged as `dcf6b16a77d`) | `/grill-with-docs` over `SPEC.md` "Resolved Questions and P0 Design Items" and the rulings of report section 7; the consumer census; the routing decision for `@beep/annotation`; the section 4 sketches as a `tsrs`-checked module that follows the Constraints idioms; the law-test ledger; the chapter, the nine rulings and the chapter-11 amendment drafted. | `decisions/` holds a confirm-or-reverse file per resolved question and the routing decision; `research/consumer-census.md` and `research/law-test-plan.md` exist with every row filled; the design module at `ops/design/` is registered in `opsScripts` and passes `bunx tsrs -p goals/tsconfig.ops.json --noEmit` (or P0 records its alternative home); the census maps the seven matter-wall access paths to owning code and test layer; the chapter and rulings exist as drafts under `standards/architecture/`; `research/consumer-census.md` follows the chapter-11 row schema with both consumer-line sums per facet; the scoped chapter-11 amendment is merged on `origin/main` before P2 opens (P2 to P7 hold until it is). |
| P1 L0 identity: declared terms, one digest | in-progress | `TermBinding`, the term-stability snapshot, one canonical JSON, preimage versioning, the registry over every namespace the repo speaks (prefix and IRI in `@beep/identity`, which stays effect-only; each external namespace's `NamespacePin` with source, license, version and digest in `@beep/rdf`); path-derived IRIs re-published from the registry; identity regimes named in the glossary. | `L0-1` and `L0-3` green by id in `packages/foundation/modeling/identity/test` and `L0-2` in `packages/foundation/modeling/jsonc/test` (the canonical JSON owner); the module-rename test proves no published IRI changes; one canonical JSON implementation and CURIE expansion over every registered namespace are covered by `L0-1` and `L0-2`; `bun run beep lint identity-registry` passes; `bun run test` in `packages/tooling/test-kit/test-runner` passes with IRIs resolved from the registry. |
| P2 L1 text: @beep/text, occurrence identity, selectors | in-progress | Opens only after the chapter-11 amendment is effective. `@beep/text` created through `create-package`; `@beep/provenance` retired with every consumer migrated in the same PR; `Selector`, `OccurrenceId`, `QuoteKey`, `Resolution`, `Reanchoring`, unit conversion; the citation mention id re-expressed over `OccurrenceId` (`citation-mention/v2`) and citation document receipts converted on read by a declared v3 to v4 transform (decision p0-chapter-11-amendment-yields-to-the-stored-format-law); the agent-memory-store node events keep their bytes and derive `OccurrenceId` from the stored anchor at read time; `TextAnchor <-> oa:` in `rdf/src/Adapters/WebAnnotation.ts`; AST source maps point at `@beep/text`; the rdf selectors and the party `TextSpan` case deleted (the nlp spans go in P3, `EvidenceSpan` in P4). | `L1-1` to `L1-6` green by id in the new text package's `test/` on the named fixtures; `rg -l "@beep/provenance" packages apps` is empty; the `TextAnchor <-> oa:` round trip is tested in `packages/foundation/modeling/rdf/test`; the census rows for the rdf selectors and the party `TextSpan` case are `deleted`; a frozen agent-memory node event fixture reads to its `OccurrenceId`; `CitationMentionMigration.test.ts` in the law-practice server tests converts a frozen v3 receipt on read to the new identifiers; the office-action standing list (SPEC Verification Matrix) stays green. |
| P3 L2 annotation: @beep/annotation, lossless handoff | content-complete in lane; PR not open | `@beep/annotation` created through `create-package` with the P0 routing decision; `Annotation<K>`, the `anchors` table, `Generation` attribution, `merge`, `restrict`, containment; candidates as annotations; the langextract handoff mints verified receipts and emits the document; `IrToLaw` and the semantica projection read it; the handoff's `Entity`, `Relation` and `Provenance` types deleted; OA/NIF adapter subpath with import attribution. | `L2-1` to `L2-6` green by id in the new annotation package's `test/`; `rg -n "GroundedExtraction" packages/law-practice/use-cases/src/IrToLaw apps/labs/semantica/src/layers` is empty; the handoff test asserts both digests, scope, pins, producer, attributes and typed candidates; `OfficeActionReview.flow.test.ts` exists over the annotation document; the census rows for the nlp Handoff and Graph spans are `deleted`; the office-action standing list stays green. |
| P4 L4 claims: core, stance, admission, signals | pending | Immutable `ClaimCore` plus `Stance`, `Challenge`, `Admission`, `Assessments<K>` with caller-supplied value schemas; status census of the eight vocabularies; the `1` and `0.9` defaults and the docket pass on an attached document with unavailable text removed (three-valued `DeterministicCheck`); nanopub adapter subpath; `EvidenceSpan`, `makeClaimEnvelope` and `ClaimVersion` retired with every consumer migrated to `makeClaimCore` plus the separate records. | `L4-1` to `L4-7` green by id in `packages/foundation/modeling/epistemics/test`; `OfficeActionReview.signals.test.ts`, `Extractor.signals.test.ts`, `DocketReview.unavailable-document-text.test.ts`, `NanopubAdapter.test.ts` and `ClaimGate.two-claims-one-occurrence.test.ts` (the absorbed attributed-span proof) green; `research/status-census.md` names each vocabulary; the census row for `EvidenceSpan` is `deleted` and frozen old-row fixtures read stored `epistemic_evidence.span` (current and legacy shapes) to the text position plus an extractor-confidence signal and stored `ClaimVersion` rows to the new records; the office-action standing list stays green. |
| P5 L3 and L6: taxonomy, alignments, interchange | pending | Legal seeds and their seed data files out of `@beep/ontology` to the law-practice asset pack through the manifested loader, consumers migrated in the same PR per the census; the FOLIO DTOs deleted; `fold -> Dataset`; `Dataset` quotient and canonical digest with the gold fixture regenerated; `Literal` cases; `rdf -> md` removed; SSSOM `MappingSet`; gUFO class-typing pilot (a record keyed by term IRI in `@beep/ontology`) on the one relator that drives a check. | `L3-1` to `L3-4` green in `packages/foundation/modeling/ontology/test`, `L6-1` to `L6-2` green in `packages/foundation/modeling/rdf/test`; `rg -l "@beep/md" packages/foundation/modeling/rdf/src packages/foundation/modeling/rdf/package.json` is empty; the `prov:Entity` projection round-trip test is green; the `NamespacePin` test in `packages/foundation/modeling/rdf/test` asserts license and digest on every external namespace; the office-action standing list stays green. |
| P6 L5 and L7: operations, agent surface, the flow | content-complete in lane; PR not open | `@beep/nlp-processing` takes `nlp/Core` and the graph node schemas, and `nlp/Operations` and `nlp/Algebra` are deleted after the `Combiner`/`Reducer` census (no consumer and no needed instance left uncovered); `Operation` with `withActivity`, Kleisli laws under a declared observation; instrumentation shard regenerated; MCP tools from the same schemas, write tools emit `proposed` only; the office-action flow completed end to end on synthetic fixtures; the matter-wall authorization work scoped by the P0 access-path map and the two-matter adversarial fixture in the law-practice server tests. | `L5-1` to `L5-3` green by id in `packages/foundation/capability/nlp-processing/test`; `OfficeActionReview.flow.test.ts` complete and green; `MatterWall.two-matter.test.ts` in the law-practice server tests green; the write-tools-emit-proposed test green; `bun run beep observability catalog --check` current. |
| P7 Cut-over and retirement | pending | Retire `@beep/nlp` and the whole `@beep/schema-org` package per `standards/architecture/11-evolution-and-deprecation.md` with consumers migrated in the same PR; glossary, chapter and rulings merged and the chapter-11 amendment (merged before P2) confirmed in force; the `THEORY.md` narrative absorbed by the chapter before the file is retired with its package; the vision document corrected. | `research/consumer-census.md` records every disposition; `rg -l '@beep/nlp["/]' packages apps standards tsconfig.json` is empty; `rg -l "@beep/schema-org" packages apps` is empty; the cli knowledge-base `Selector` text-quote case is re-checked and kept or deleted by decision file; `bun run beep lint schema-first`, `bun run beep lint identity-registry` and `bun run beep lint package-scripts` pass; no S31 inventory grew (entry counts per inventory and allowlist at or below the P0 base commit, SPEC Constraints); the chapter, rulings and glossary entries exist on `origin/main`. |
| P8 Yeet: final PR to mergeable | pending | Publish the final PR through yeet with `final-check` on the pushed head and drive it to mergeable: required checks green or attributed, review threads answered and resolved, the `closeout` record (`goals set-status text-knowledge-stack-rebuild completed-retained`) and the reflection on board. | `bun run beep yeet final-check` receipt for the pushed head; `bun run beep yeet monitor --until-ready` prints `merge-ready: yes`; zero unresolved review threads. |
| P9 Close | pending | Verify the closeout after the merge from hosted facts; name any red required check in a committed `redAttribution` decision file. | `bun run beep goals completion refresh --slug text-knowledge-stack-rebuild` prints verified; `origin/main` has `closeout.status == initiative.status`. |

Phase ids match `ops/manifest.json` `phases[]`. Each of P1 to P7 is its own
PR or PR stack; P8 names the last of them. "Green by id" means every test title
starts with its ledger row id and `rg -n "<id>" <package>/test` finds it.

## Decomposition Rule

If a phase needs more than three concurrently open PRs, or two phases must run
in parallel, bootstrap a child packet for that phase with
`bun run beep goals bootstrap --requires <independently completed capability> ...`
(for example `foundation/epistemics-vocabulary`). A child never requires a
capability this packet itself provides: the goal frontier excludes consumers of
an unfinished provider, so such a child could never start while the parent
needs it. Record the split as a checkpoint here and name the child in the
parent's phase exit criterion. P0 decided not to split up front (decision
2026-11-19-p0-rq5-one-packet-confirmed); the rule applies to later phases.

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` in the final PR (P8). Its
   YAML frontmatter must validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses. Once the final PR is open, run
   `bun run beep goals set-status text-knowledge-stack-rebuild completed-retained`: it writes
   `closeout` naming that PR with the matching `initiative.status`, and the
   commit ships in the final PR. After the merge,
   `bun run beep goals completion refresh --slug text-knowledge-stack-rebuild` must print verified;
   name any red required check in a committed decision file
   (`redAttribution`).

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Status checkpoints are `kind: checkpoint` files under `decisions/`
  (`bun run beep goals decisions add text-knowledge-stack-rebuild --kind checkpoint ...`),
  rendered into the Checkpoints block at the end of this plan.
- Record friction receipts in `research/OPPORTUNITIES.md` as they happen.
- Validate every Effect API against `.repos/effect` before writing it; the
  report's revision 1 sketches failed `tsc` on six constructs for exactly
  this reason, and revision 2 still used two constructs that do not exist
  (`Present.or(Absent)`, a bare `LiteralKit` type bound).
- Every retirement PR carries its consumer migration; `research/consumer-census.md`
  is the work list and the evidence.
- P1 ships as a three-PR stack opened one after another: PR A foundation (the P1
  decisions, the IRI schema move into `@beep/identity`, `ContentHash` and the
  minting function, the canonical-JSON copies retired), then PR B registry and
  pins (shards, snapshot, gate, the eight pinned namespaces), then PR C bindings
  and the break (fold and test-runner re-minted, the term-stability gate; the composer
  IRI surface stays, decision `2026-11-20-p1-composer-stays-registry-free`).
  Base design: `research/2026-11-19-p1-design-registry-first.md` with its
  "Rulings applied" section; the rulings are the `decisions/2026-11-19-p1-*` files.
- Design-module handoff: the phase that moves a layer out of `ops/design` into
  its package also, in the same PR, re-points or removes every remaining import
  of that design file, updates the design index and generators, and removes the
  file's `opsScripts` entry; the PR that moves the last design file removes the
  design tsconfig and its verification command and keeps the general goals ops
  check.

P3 completed the design-module handoff: L2 and the OA prototype are removed;
annotation document and containment generators live in the production package tests.
The remaining design generators cover the claim log. P3 publication waits for P2
to open against main after PR C merges, per the P2 content-final checkpoint.

P6 moved the last design file: `L5.operations.ts` left with its `opsScripts`
entry, and the design index, the design tsconfig and its verification command
went with it. The general goals ops check stays.

## Verification Commands

```sh
test "$(wc -m < goals/text-knowledge-stack-rebuild/GOAL.md)" -le 4000
jq . goals/text-knowledge-stack-rebuild/ops/manifest.json
rg -n "text-knowledge-stack-rebuild|GOAL.md|agentLaunchers|packetAnchorDocument" goals/text-knowledge-stack-rebuild
git diff --check -- goals/text-knowledge-stack-rebuild
bun run beep goals doctor
bun run beep goals decisions check --slug text-knowledge-stack-rebuild
bun run beep goals manifest --check
bunx tsrs -p goals/tsconfig.ops.json --noEmit
bun run beep lint reflection-artifacts
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug text-knowledge-stack-rebuild`; add a `kind: checkpoint` file there, never edit this block._

### P1 lands as three PRs sequenced by the CI goals driver, 2026-11-19

The CI goals driver ruled the P1 merge order on 2026-11-19, relayed by the orchestrator. PR A (L0 identity: the IRI move, ContentHash and the minting function, the canonical-JSON re-points) opens and merges only after the infra gate's PR #3422 (registry exports as leaves) merges. Main is then merged into A once, and any identity slug A adds takes the registry-leaf form #3422 introduces. A's final head gets the infra gate's bundle-diff: if A reaches no runner handler it merges at any time outside a freeze; if it does, it merges before the gate's PR 2 plan_only. A's final goes to the orchestrator, and the lane waits for that result. PR B and PR C open only after the runner cutover's step 4b and only on the driver's word, and the orchestrator is told before each opens. C's final states that the alchemy-github-runners and infra ci-runners test suites are green on C's head. Each of A, B and C cuts a beep CI binary release and a pin PR that the driver diffs.

Lane goals/text-knowledge-stack-rebuild-p1-l0-identity

Reverse: Open B and C without the driver's word; nothing in the code depends on the order beyond A before B before C

### P1 content-complete in the PR C lane; L0-1 to L0-3 green, 2026-11-20

P1 is content-complete in the lane stack and stays `in-progress` until PR C merges. PR A (foundation) is merged as #3429; PR B (registry, codec, pins) is #3439; PR C (bindings, re-publication, the term-stability gate and this doctrine) is #3449, the PR C bindings lane, stacked on B. All three L0 ledger rows are green by id: `L0-1` in `identity/test/Curie.laws.test.ts`, `L0-2` in `jsonc/test/ContentHash.laws.test.ts`, `L0-3` in `identity/test/TermStability.test.ts` and in the cli `lint-identity-registry` end-to-end tests. The module-rename test passes, `bun run beep lint identity-registry` passes against the merge base, and the test-runner IRIs resolve from the registry. One exit-criterion caveat: the composer IRI surface is not deleted in PR C, against the earlier execution note; the `$I` composers keep deriving an IRI and the registry binds published IRIs at build time (decision `2026-11-20-p1-composer-stays-registry-free`), because the CI runner handlers bundle `Id.ts`. Left for a later decision: deleting that surface with one accepted handler redeploy, `binding-dangling`, `term-local-multi-segment`, `registry-since-mismatch` and the `delete-package` guard (decision `2026-11-20-p1-term-stability-gate-live-tree-calls`). P2 opens after PR C merges and the chapter-11 amendment is effective.

Lane goals/text-knowledge-stack-rebuild-p1c-bindings

Reverse: Delete this checkpoint file and rerun goals decisions write; P1 status reads in-progress from the phase table either way

### P2 content-final and pushed; its PR holds until PR C merges, then opens against main, 2026-11-22

P2 is content-final on its branch: yeet final-check passed on 183872d5710 against the PR C head 0c1653b699f, with coverage skipped locally and proved hosted. delete-package @beep/provenance --check prints clean, and the check census is re-measured after the PR C merge. yeet open --stack-on 3449 refuses (parent-off-trunk): PR C targets the PR B branch and a native stack holds two layers. The orchestrator ruled (2026-11-22) that P2 opens no PR until PR C (#3449) merges after P5 step 4b. A base retarget with gh pr edit would route around the tool refusal. A draft against main would spend heavy runs on a diff that double-counts B and C while the heavy pool runs one at a time. Once C merges: merge origin/main into the P2 lane, re-prove cheaply, yeet open against main, and post final on hosted green. P3 design proceeds meanwhile in its own lane with no PR.

Lane goals/text-knowledge-stack-rebuild-p2-text

Reverse: Open the P2 PR earlier only on the orchestrator's word, by a superseding checkpoint.

### P2 L1 doctrine landed and the L1 design module handed off; L1-1 to L1-6 green, 2026-11-22

P2 stays `in-progress` until its PR merges. It is one PR stacked on PR C (#3449), built in its lane and not yet opened (decision `2026-11-22-p2-one-pr-stacked-on-pr-c`). Commits 0 to 12 of section 10 of `research/2026-11-20-p2-design.md` are in the lane. Exit criteria met there: `@beep/text` was created through `create-package` and `@beep/provenance` retired with every consumer in the same PR (`rg -l "@beep/provenance" packages apps` is empty); `Selector`, `OccurrenceId`, `QuoteKey`, `Resolution`, `Reanchoring` and unit conversion are exported; the six L1 ledger rows are green by id in `packages/foundation/modeling/text/test`; the citation mention id is minted over `OccurrenceId` and `CitationMentionMigration.test.ts` converts a frozen v3 receipt; `NodeEvent.occurrence.test.ts` reads a frozen node event to its `OccurrenceId`; the `TextAnchor <-> oa:` round trip is tested in `rdf/test/TextAnchorCodec.test.ts` (`P2-OA` titles); `@beep/md/Md.anchors` is the AST source map; census rows f-1 and f-5 (the `TextSpan` case) read `deleted`. Commit 12 deleted `ops/design/L1.text.ts` and its `opsScripts` row and re-pointed L2, L4, the generators and the index at `@beep/text`; both goals tsconfig checks pass. Chapter 16, the glossary and a 2026-11-22 `DECISIONS.md` entry state what P2 delivered. Left before the PR opens: commit 13 (inventories, catalogs, cache baselines, policy fingerprint, check census), one merge of the parent (PR C, then main with both preparatory PRs), a clean `delete-package @beep/provenance --allow-stale-packets --check`, and `yeet final-check`.

Lane goals/text-knowledge-stack-rebuild-p2-text

Reverse: Delete this checkpoint file and rerun goals decisions write; P2 status reads in-progress from the phase table either way

### P3 is content-complete in its lane; publication waits for P2 to open after PR C merges, 2026-11-22

P3 commits 1 through 9 implement the annotation package, OA adapter, verified lossless handoff, consumers and nlp facet retirement. Commit 10 hands off the design module and doctrine; commit 11 registers the inventories. P3 is content-complete in its lane and its PR is not open. P2 opens against main after PR C merges under checkpoint 2026-11-22-p2-content-final-and-pushed-its-pr-holds-until-pr-c-merges-then-opens-against-main. P3 publication waits for P2 and the orchestrator; no push or GitHub operation is authorized in this implementation task.

Lane goals/text-knowledge-stack-rebuild-p3-annotation

Reverse: Resume the P3 publication lane after P2 opens and the orchestrator releases the stack gate

### P4 checkpoint: L4 claims are content-complete in the lane, 2026-11-23

P4 rows 0 to 9 are committed on goals/text-knowledge-stack-rebuild-p4-claims (row 6 2ced3e0a632, row 7 960b792a314, row 8 97b2de8a43b, plus fix 35406cb973f for a row-5 entity-kit-freeze defect). Every PLAN P4 exit has a test or a record: L4-1 to L4-7 are green in packages/foundation/modeling/epistemics/test; OfficeActionReview.signals, Extractor.signals, DocketReview.unavailable-document-text, NanopubAdapter and ClaimGate.two-claims-one-occurrence exist; research/status-census.md records the eight status sites; EvidenceSpan and makeClaimEnvelope/ClaimVersion are deleted and their stored rows read through frozen private readers; the L4 design sketch and its generators left ops/design. Row 10 refreshes catalogs and coverage registrations; the PR is opened only by the owning lane.

Lane goals/text-knowledge-stack-rebuild-p4-claims

Reverse: Reopen P4 by reverting the lane commits from 2ced3e0a632 onward; the stored-format readers keep old bytes readable either way.

### P5 checkpoint: L3 and L6 are content-complete in the lane except the gold projection digest, 2026-11-23

P5 rows 0 to 13 are committed on goals/text-knowledge-stack-rebuild-p5-taxonomy (row 11 0ace3e35c3e, row 12 a2a5b1122fa, row 13 3d52b513d1e), plus 7440368117c, which adapts the epistemics nanopublication codec to the quad-set Dataset. L3-1 to L3-4 and L6-1, L6-2 are green against the real test titles in research/law-test-plan.md. The legal seeds and intake taxonomy live in the law-practice asset pack, the FOLIO DTOs are deleted, the fold builds a Dataset only, the rdf to md edge is gone, every registry namespace is pinned, LegalPositionRelator carries a gUFO typing the audit clears, and the annotation-to-DoCO/NIF mapping set passes the coherence check. The L3 and L6 design sketches left ops/design and the consumer census records each row's P5 disposition. Row 14 (the semantica gold projection pinned by its canonical dataset digest) holds: the operational C1 measure needs a C0 ledger built from the out-of-repo corpus and hosted embeddings that bill, and no ledger or provider cache exists, so no digest is written until a measure run's digest equals the rdf-canonize oracle's. Row 16 refreshes the catalogs and coverage registrations; the PR is opened only by the owning lane.

Lane goals/text-knowledge-stack-rebuild-p5-taxonomy

Reverse: Reopen P5 by reverting the lane commits from d20b0696cea onward (with 34c34d8bdba, 78e937db873 and c054eda4902 carried in through the P4 merge); the moved seed files keep their bytes and digests either way.

### P6 checkpoint: L5 and L7 are content-complete in the lane; the Practice KG operational step holds, 2026-11-24

P6 rows 0 to 15 are committed on goals/text-knowledge-stack-rebuild-p6-operations (row 13 51ef2b589c3, row 14 e51ebfb3783, row 15 5793d961c02), plus b094fe0cc12, which asserts the Pure witness by type. L5-1 to L5-3 are green against the real test titles in research/law-test-plan.md (L5-1 and L5-2 in Operation.test.ts, L5-3 in Operation.activity.laws.test.ts). @beep/nlp-processing owns Core, the graph node schemas, the one Operation arrow and attributed ActivityRecord runs; nlp Operations, Algebra and GraphOps are deleted. L7: the claim toolkit emits proposed records only behind TierGate, tool schemas are the stack types on the wire, agent-proposed ontology terms are audited before the session save, and the matter wall covers all seven access paths, proved by MatterWall.two-matter.test.ts. The office-action flow runs through proposal, assessment and attorney admission. ops/design is deleted with its manifest command and opsScripts entries, and chapter 16 carries no Pending P6 note. Holds: the operational Practice KG bundle rebuild over the corpus and the operator grants configuration for apps/practice-kg-mcp and apps/practice-gateway run in the operational environment; until then those hosts refuse the old bundle and an unconfigured host denies every walled path. No app hosts LawClaimToolkit until a host binds a caller-independent principal per dispatch. Row 17 refreshes the catalogs and coverage registrations; the PR is opened only by the parent.

Lane p6

Reverse: Reopen P6 by reverting the lane commits from f3ad9be1379 onward; the Practice KG reader refuses the version-5 bundle either way, so an operational host keeps its old bundle until the rebuild

<!-- beep:decisions:end -->
