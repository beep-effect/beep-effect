# Text-Knowledge Stack Rebuild Plan

## Status

Status: `pending` (P0 Design and grill is next)

## Shape

Design first, then the layers bottom-up along the dependency DAG, then the
census that decides folds. The order is the critics' "smallest sequence that
captures most of the value" (report section 7): the lossy boundaries (L1, L2,
L4) are repaired before any package is renamed, so the product keeps its
evidence intact even if the census declines every fold. Each phase ships as
its own PR or PR stack through Yeet; a packet holds at most three open PRs.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Design and grill | pending | Take `SPEC.md` "Open Questions" and the nine rulings of report section 7 through `/grill-with-docs`; rewrite the report's section 4 schema sketches so they compile against the installed `effect`; triage the law catalogue into named test targets per package; draft the knowledge-stack chapter. | Five decision files; a `tsrs`-checked design module; a per-package law-test plan; the chapter and the nine `DECISIONS.md` entries drafted. |
| P1 L0 identity: freeze identities | pending | `TermBinding`, the term-stability snapshot, one canonical JSON, preimage versioning, the registry over every namespace the repo speaks; identity regimes named in the glossary. | L0 law rows green; a module rename cannot change a published IRI; the test-runner's pinned IRIs resolve through the binding. |
| P2 L1 text: occurrence identity and selectors | pending | `Selector`, `OccurrenceId`, `QuoteKey`, `Resolution`, `Reanchoring` and unit conversion in `@beep/provenance`; `TextAnchor <-> oa:` in `@beep/rdf`; AST source maps point at `provenance`. | L1 law rows green on the named fixtures; `cm1:` preimage expressed as an `OccurrenceId` preimage with persisted bytes unchanged; array-order ids gone. |
| P3 L2 annotation: lossless handoff | pending | `Annotation<K>` with content hash and separate attribution, `merge`, `restrict`, containment; candidates as annotations; provenance threaded through the langextract handoff, office-action mapper, docket evidence and RDF projection; `IrToLaw` reads the handoff; OA/NIF adapter subpath. Home (`nlp/Handoff` or `@beep/annotation`) per the P0 decision. | L2 law rows green; declared loss per consumer; no consumer reads `GroundedExtraction` for anchors. |
| P4 L4 claims: core, stance, admission, signals | pending | Immutable `ClaimCore` plus `Stance`, `Challenge`, `Admission`, `Assessments<K>`; status census of the seven vocabularies; the `1` and `0.9` defaults and the passing absent-attachment check removed; nanopub adapter subpath. | L4 law rows green; regression guards for the defaults; census report in `research/`. |
| P5 L3 and L6: taxonomy, alignments, interchange | pending | Legal seeds and FOLIO DTOs out of `@beep/ontology` through the manifested loader; `fold -> Dataset`; `Dataset` quotient and canonical digest; `Literal` cases; `rdf -> md` removed; SSSOM `MappingSet`; gUFO class-typing pilot on the one relator that drives a check; `schema-org` facets inventoried. | L3 and L6 law rows green; gold fixture migrated explicitly; every external namespace carries license and digest. |
| P6 L5 and L7: operations and agent surface | pending | `Operation` with `withActivity`, Kleisli laws under a declared observation, `Combiner`/`Reducer` census; MCP tools from the same schemas, write tools emit `proposed` only; one office-action flow end to end on synthetic fixtures; the two-matter adversarial fixture. | Flow passes; attorney-facing invariant tests green; every run emits a `prov:Activity`. |
| P7 Census and folds | pending | Per-facet consumer census for `@beep/annotation`, the `@beep/nlp` fold, `@beep/schema-org`, the `@beep/ontology` split and the `@beep/provenance` name; approved folds through `create-package` and the retirement procedure; glossary, chapter and `THEORY.md` final. | Census report; each fold landed or declined with reasons; S31 inventories unchanged. |
| P8 Yeet: final PR to mergeable | pending | Publish the final PR through yeet and drive it to mergeable: required checks green, review comments answered and resolved, `proposedCloseout` and the reflection on board. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P9 Close | pending | Verify completion after merge and adopt the status in a packet-state PR. | `completion refresh` verifies; `set-status` adopted on `origin/main`. |

Phase ids match `ops/manifest.json` `phases[]`. Each of P1 to P7 is its own
PR or PR stack; P8 names the last of them.

## Decomposition Rule

If a phase needs more than three concurrently open PRs, or two phases must run
in parallel, bootstrap a child packet for that phase with
`bun run beep goals bootstrap --requires foundation/text-knowledge-stack ...`
and record the split as a checkpoint here. The P0 grill decides whether to
split up front (Open Question 5).

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses and a typed `proposedCloseout` with status `completed-retained`
   and finalPullRequest. Keep `initiative.status` operative until completion
   evidence verifies; do not close the external execution/session ledger from a proposal.

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
  this reason.

## Verification Commands

```sh
test "$(wc -m < goals/text-knowledge-stack-rebuild/GOAL.md)" -le 4000
jq . goals/text-knowledge-stack-rebuild/ops/manifest.json
rg -n "text-knowledge-stack-rebuild|GOAL.md|agentLaunchers|packetAnchorDocument" goals/text-knowledge-stack-rebuild
git diff --check -- goals/text-knowledge-stack-rebuild
bun run beep goals doctor
bun run beep goals decisions check --slug text-knowledge-stack-rebuild
bun run beep goals manifest --check
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug text-knowledge-stack-rebuild`; add a `kind: checkpoint` file there, never edit this block._

_No checkpoint files yet._

<!-- beep:decisions:end -->
