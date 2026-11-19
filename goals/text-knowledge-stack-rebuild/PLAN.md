# Text-Knowledge Stack Rebuild Plan

## Status

Status: `in-progress` (P0 Design and grill in review; P1 is next)

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
| P0 Design and grill | in-progress | `/grill-with-docs` over `SPEC.md` "Resolved Questions and P0 Design Items" and the rulings of report section 7; the consumer census; the routing decision for `@beep/annotation`; the section 4 sketches as a `tsrs`-checked module that follows the Constraints idioms; the law-test ledger; the chapter, the nine rulings and the chapter-11 amendment drafted. | `decisions/` holds a confirm-or-reverse file per resolved question and the routing decision; `research/consumer-census.md` and `research/law-test-plan.md` exist with every row filled; the design module at `ops/design/` is registered in `opsScripts` and passes `bunx tsrs -p goals/tsconfig.ops.json --noEmit` (or P0 records its alternative home); the census maps the seven matter-wall access paths to owning code and test layer; the chapter and rulings exist as drafts under `standards/architecture/`; `research/consumer-census.md` follows the chapter-11 row schema with both consumer-line sums per facet; the scoped chapter-11 amendment is merged on `origin/main` before P2 opens (P2 to P7 hold until it is). |
| P1 L0 identity: declared terms, one digest | pending | `TermBinding`, the term-stability snapshot, one canonical JSON, preimage versioning, the registry over every namespace the repo speaks (prefix and IRI in `@beep/identity`, which stays effect-only; each external namespace's `NamespacePin` with source, license, version and digest in `@beep/rdf`); path-derived IRIs re-published from the registry; identity regimes named in the glossary. | `L0-1` and `L0-3` green by id in `packages/foundation/modeling/identity/test` and `L0-2` in `packages/foundation/modeling/jsonc/test` (the canonical JSON owner); the module-rename test proves no published IRI changes; one canonical JSON implementation and CURIE expansion over every registered namespace are covered by `L0-1` and `L0-2`; `bun run beep lint identity-registry` passes; `bun run test` in `packages/tooling/test-kit/test-runner` passes with IRIs resolved from the registry. |
| P2 L1 text: @beep/text, occurrence identity, selectors | pending | Opens only after the chapter-11 amendment is effective. `@beep/text` created through `create-package`; `@beep/provenance` retired with every consumer migrated in the same PR; `Selector`, `OccurrenceId`, `QuoteKey`, `Resolution`, `Reanchoring`, unit conversion; the citation mention id re-expressed over `OccurrenceId` (`citation-mention/v2`) and citation document receipts converted on read by a declared v3 to v4 transform (decision p0-chapter-11-amendment-yields-to-the-stored-format-law); the agent-memory-store node events keep their bytes and derive `OccurrenceId` from the stored anchor at read time; `TextAnchor <-> oa:` in `rdf/src/Adapters/WebAnnotation.ts`; AST source maps point at `@beep/text`; the rdf selectors and the party `TextSpan` case deleted (the nlp spans go in P3, `EvidenceSpan` in P4). | `L1-1` to `L1-6` green by id in the new text package's `test/` on the named fixtures; `rg -l "@beep/provenance" packages apps` is empty; the `TextAnchor <-> oa:` round trip is tested in `packages/foundation/modeling/rdf/test`; the census rows for the rdf selectors and the party `TextSpan` case are `deleted`; a frozen agent-memory node event fixture reads to its `OccurrenceId`; `CitationMentionMigration.test.ts` in the law-practice server tests converts a frozen v3 receipt on read to the new identifiers; the office-action standing list (SPEC Verification Matrix) stays green. |
| P3 L2 annotation: @beep/annotation, lossless handoff | pending | `@beep/annotation` created through `create-package` with the P0 routing decision; `Annotation<K>`, the `anchors` table, `Generation` attribution, `merge`, `restrict`, containment; candidates as annotations; the langextract handoff mints verified receipts and emits the document; `IrToLaw` and the semantica projection read it; the handoff's `Entity`, `Relation` and `Provenance` types deleted; OA/NIF adapter subpath with import attribution. | `L2-1` to `L2-6` green by id in the new annotation package's `test/`; `rg -n "GroundedExtraction" packages/law-practice/use-cases/src/IrToLaw apps/labs/semantica/src/layers` is empty; the handoff test asserts both digests, scope, pins, producer, attributes and typed candidates; `OfficeActionReview.flow.test.ts` exists over the annotation document; the census rows for the nlp Handoff and Graph spans are `deleted`; the office-action standing list stays green. |
| P4 L4 claims: core, stance, admission, signals | pending | Immutable `ClaimCore` plus `Stance`, `Challenge`, `Admission`, `Assessments<K>` with caller-supplied value schemas; status census of the eight vocabularies; the `1` and `0.9` defaults and the docket pass on an attached document with unavailable text removed (three-valued `DeterministicCheck`); nanopub adapter subpath; `EvidenceSpan`, `makeClaimEnvelope` and `ClaimVersion` retired with every consumer migrated to `makeClaimCore` plus the separate records. | `L4-1` to `L4-7` green by id in `packages/foundation/modeling/epistemics/test`; `OfficeActionReview.signals.test.ts`, `Extractor.signals.test.ts`, `DocketReview.unavailable-document-text.test.ts`, `NanopubAdapter.test.ts` and `ClaimGate.two-claims-one-occurrence.test.ts` (the absorbed attributed-span proof) green; `research/status-census.md` names each vocabulary; the census row for `EvidenceSpan` is `deleted` and frozen old-row fixtures read stored `epistemic_evidence.span` (current and legacy shapes) to the text position plus an extractor-confidence signal and stored `ClaimVersion` rows to the new records; the office-action standing list stays green. |
| P5 L3 and L6: taxonomy, alignments, interchange | pending | Legal seeds and their seed data files out of `@beep/ontology` to the law-practice asset pack through the manifested loader, consumers migrated in the same PR per the census; the FOLIO DTOs deleted; `fold -> Dataset`; `Dataset` quotient and canonical digest with the gold fixture regenerated; `Literal` cases; `rdf -> md` removed; SSSOM `MappingSet`; gUFO class-typing pilot (a record keyed by term IRI in `@beep/ontology`) on the one relator that drives a check. | `L3-1` to `L3-4` green in `packages/foundation/modeling/ontology/test`, `L6-1` to `L6-2` green in `packages/foundation/modeling/rdf/test`; `rg -l "@beep/md" packages/foundation/modeling/rdf/src packages/foundation/modeling/rdf/package.json` is empty; the `prov:Entity` projection round-trip test is green; the `NamespacePin` test in `packages/foundation/modeling/rdf/test` asserts license and digest on every external namespace; the office-action standing list stays green. |
| P6 L5 and L7: operations, agent surface, the flow | pending | `@beep/nlp-processing` absorbs `nlp/Operations` and `nlp/Algebra` after the `Combiner`/`Reducer` census; `Operation` with `withActivity`, Kleisli laws under a declared observation; instrumentation shard regenerated; MCP tools from the same schemas, write tools emit `proposed` only; the office-action flow completed end to end on synthetic fixtures; the matter-wall authorization work scoped by the P0 access-path map and the two-matter adversarial fixture in the law-practice server tests. | `L5-1` to `L5-3` green by id in `packages/foundation/capability/nlp-processing/test`; `OfficeActionReview.flow.test.ts` complete and green; `MatterWall.two-matter.test.ts` in the law-practice server tests green; the write-tools-emit-proposed test green; `bun run beep observability catalog --check` current. |
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
- Design-module handoff: the phase that moves a layer out of `ops/design` into
  its package also, in the same PR, re-points or removes every remaining import
  of that design file, updates the design index and generators, and removes the
  file's `opsScripts` entry; the PR that moves the last design file removes the
  design tsconfig and its verification command and keeps the general goals ops
  check.

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
bunx tsrs -p goals/text-knowledge-stack-rebuild/ops/design/tsconfig.json --noEmit
bun run beep lint reflection-artifacts
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug text-knowledge-stack-rebuild`; add a `kind: checkpoint` file there, never edit this block._

_No checkpoint files yet._

<!-- beep:decisions:end -->
