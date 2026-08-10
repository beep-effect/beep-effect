# Chronocept → beep-effect mapping: searches and raw evidence

Source note: `/tmp/claude-1000/-home-elpresidank-YeeBois-projects-beep-effect15/83275b25-e475-41f9-8451-e7d3f3d78d00/scratchpad/graphnosis/paper-chronocept.md`
Repo: `/home/elpresidank/YeeBois/projects/beep-effect15` @ `d1dfc4b3c1` (main, clean)
Sibling repo checked: `/home/elpresidank/YeeBois/dev/Graphnosis`
Date: 2026-08-06

Note on output artifact: several `rg` runs in this session had the matched
substring elided by the tool-output pipeline (e.g. `decay` rendered as `n`,
`multitemporality` as `nity`). Where that happened I re-ran with an exit-code
probe instead of reading the rendered line. Both forms are recorded below.

---

## A. The bitemporal substrate — is the two-axis model really there?

```
$ rg -rn --no-heading -i "bitemporal" --glob 'packages/**/src/**' -l
packages/_internal/db-admin/src/migrations/EpistemicEdge.ts
packages/shared/domain/src/identity/Epistemic.ts
packages/epistemic/use-cases/src/EdgeAuthority/EdgeAuthority.ports.ts
packages/epistemic/use-cases/src/EdgeAuthority/EdgeAuthority.commands.ts
packages/epistemic/use-cases/src/ContradictionTriage/ContradictionTriage.ports.ts
packages/epistemic/tables/src/entities/EdgeVersion/EdgeVersion.table.ts
packages/epistemic/domain/src/entities/EdgeVersion/EdgeVersion.model.ts
packages/epistemic/server/src/EdgeAuthority/EdgeAuthority.repo.ts
... (19 files)
```

`packages/epistemic/domain/src/entities/EdgeVersion/EdgeVersion.model.ts:1-12`
(module docstring, verbatim):

> One row is one immutable assertion of one logical edge over one valid-time
> interval, recorded over one transaction-time interval. Both axes are half-open
> (`[validFrom, validTo)`, `[recordedAt, expiredAt)`) BIGINT epoch millis with an
> absent upper bound modelled as `Option.none` — there are no magic sentinel
> dates and no persisted `isLatest` flag, because "latest" is a question you ask
> the axes, not a fact you store.

Fields confirmed on the class (same file, `fields:` block):
- `validFrom` / `validTo` (valid time; `validTo` is `S.OptionFromNullOr`)
- `recordedAt` ("Inclusive transaction-time lower bound: when this row became known.")
- `expiredAt` ("Exclusive transaction-time upper bound; absent while the row is
  the current record.")
- `supersedesId` (lineage self-FK)
- `logicalKey` (`LogicalEdgeKey`, digest of the logical edge identity)

Read surface:

```
$ rg -n "readAsOf|readLatest|supersede" packages/epistemic/use-cases/src/EdgeAuthority/EdgeAuthority.ports.ts
61:  readonly readAsOf: (query: EdgeAsOfQuery) => Effect.Effect<Option.Option<EdgeVersion>, EdgeRepositoryUnavailable>;
62:  readonly readLatest: (...)
65:  readonly record: (command: RecordEdgeFact) => ...
66:  readonly supersede: (command: SupersedeEdgeFact) => ...
```

`packages/epistemic/server/src/EdgeAuthority/EdgeAuthority.repo.ts` has
`asOfWhere(logicalKey, validAt, knownAt)`.

Interval discipline, `goals/epistemic-bitemporal-edge-core/SPEC.md`:

```
39:- `packages/epistemic/tables`: ... unique/check/foreign-key/no-overlap backstops.
63:- **Logical edge identity:** source, target, relation, organization/matter scope,
     predicate qualifiers, and evidence scope together form the no-overlap partition key.
89:- [ ] Approved supersession closes the prior metadata intervals and inserts the
     replacement plus lineage in one transaction ... no overlapping authoritative version.
```

**Reading:** no-overlap-per-logical-key permits *gaps*. "Valid, then invalid,
then valid again" (lapse → reinstatement, term → renewal) is expressible as
multiple rows with disjoint valid intervals. That is exactly the shape
Chronocept's unimodal skew-normal excludes by construction.

`goals/INDEX.md:78` — `epistemic-bitemporal-edge-core` 4/4, updated 2026-07-25.

---

## B. Does beep already carry a richer temporal-axis analysis than Chronocept?

Yes, and it predates this note.

```
$ rg -rn -i "multitemporal" explorations/ goals/
explorations/epistemic-belief-view-revision/CAPTURE.md: "Legal multitemporality
  (enforceability/efficacy/applicability) is explicitly NOT collapsed into the
  two core axes"
explorations/academia-corpus-mining/research/t3-master-synthesis.md: finding 4 —
  "The two-axis bitemporal core is necessary but not complete legal or
   operational time. ... Document that `validAt` does not collapse applicability,
   efficacy, enforceability, or procedural effect, and `knownAt` does not mean
   observation, arrival, access, release, or model-trust time. Build legal
   multitemporality as a composed downstream layer."
explorations/academia-corpus-mining/research/t3-memory-bitemporal.md: routes
  `new-exploration <legal-multitemporal-validity>`
explorations/academia-corpus-mining/DECISIONS.md: "multitemporality remains ...
  follows in third position behind belief views."
```

```
$ ls explorations | rg -i "legal|temporal"
agent-memory-tiers-bitemporal-edges
bitemporal-goal-roadmap
gov-legal-data-driver-codegen
legal-ontology-landscape
legal-patent-kg-deepening
legal-position-relator-runtime
```
→ `legal-multitemporal-validity` is a *routed but unopened* packet.

**Reading:** the repo's own open temporal question is "split applicability /
efficacy / enforceability / procedural effect out of `validAt`". Chronocept
does not touch any of those — it has a single anchor (publication) and one
relative axis. It is strictly below the repo's current position.

---

## C. Modality taxonomy (MATRES eight axes) — the highest-value transfer

```
$ rg -rn -i "modality|modalit" --glob 'packages/**/src/**' -l
packages/drivers/openclaw/src/OpenclawIntent.models.ts      # unrelated (intent modality)

$ rg -rn -i "hypothetical|speculative|counterfactual" --glob 'packages/**/src/**' -l
(no output)

$ rg -rn -i '"intention"|"opinion"|"negation"|"recurrent"|"generic"' --glob 'packages/**/src/**' -l
packages/law-practice/domain/src/internal/generated/free-law-project/reporters-db.data.json   # generated corpus noise

$ rg -rn -i "ClaimModality|modalityAxis|MatresAxis" --glob 'packages/**/src/**'   -> exit 1 (EMPTY)
$ rg -rn -iw "stance|assertionType|claimType|epistemicStatus" --glob 'packages/**/src/**/*.ts'
  → only PracticeKgEpistemicStatus and ProfessionalRuntime fixtures
```

The nearest existing thing is:

`packages/law-practice/domain/src/values/PracticeKgEpistemicStatus/PracticeKgEpistemicStatus.model.ts`
```ts
export const PracticeKgEpistemicStatus = LiteralKit([
  "derived-from-official-records",
  "candidate-unreviewed",
])
// description: "Authority label distinguishing deterministic spine rows from candidate claims."
```
That is a *source-authority* label, not a speech-act/modality label. Orthogonal.

**The open question this lands on** —
`explorations/epistemic-belief-view-revision/CAPTURE.md:45-49`:

> Master align Q1 — canonical names/owners for the typed verdict families
> (shape validity, anchor fidelity, **semantic stance**, source authority/
> currentness, human disposition, action authorization, release). A view's
> selection policy consumes several of these; naming them is upstream of any
> view schema.

"Semantic stance" is an explicitly-named, explicitly-unfilled slot. MATRES is a
candidate filling for it.

**Where it must NOT land.** `goals/epistemic-contradiction-triage/SPEC.md`:
```
16:- No automatic supersession from detection ... detection output is data
23:- No semantic-graph or NLP contradiction *detection engine* in this packet
64:- Detection alone never changes authoritative validity
139:  add detection heuristics/NLP — stop and re-scope).
```
Packet is active at 2/5, P2 verification. Adding a modality pre-filter there
trips its own stop-and-re-scope guard.

Note also: triage's `ContradictionMatchBasisKind = LiteralKit(["same-source-overlap",
"independent-evidence"])` (`packages/epistemic/domain/src/values/Contradiction/Contradiction.model.ts:435`)
is a *provenance* discriminator on the pair, not a modality discriminator on
each claim.

---

## D. Graded validity / log-time / skew-normal — all absent

Exit-code probes (`rg ... >/dev/null && echo HITS || echo EMPTY`), scope
`--glob 'packages/**/src/**'`:

| pattern | result |
|---|---|
| `logBase\|log_1\.1\|log-?time\|logTime` | EMPTY (exit 1) |
| `validityCurve\|validityProfile\|gradedValidity\|validityDistribution` | EMPTY (exit 1) |
| `skewNormal\|skew_normal` | EMPTY (exit 1) |
| `atemporal\|alwaysValid\|permanentlyValid` | EMPTY (exit 1) |
| `ClaimModality\|modalityAxis\|MatresAxis` | EMPTY (exit 1) |
| `multimodal\|reinstat\|renewal` scoped to `packages/epistemic/**/src/**` | EMPTY |

```
$ rg -rn -i "staleness|decay|half-life|halfLife" --glob 'packages/**/src/**' -l
packages/tooling/tool/cli/src/commands/Goals/Doctor.ts               # packet staleness in days
packages/tooling/tool/cli/src/commands/AgentEffectiveness/internal/EvalScoring.ts
packages/tooling/tool/cli/src/commands/AgentEffectiveness/internal/EvalFixture.ts
```
`EvalScoring.ts:170` is the only "decay" in a scoring sense and it is not
temporal:
```ts
export const lawComponentScore = (violationCount: number): number => roundScore(1 / (1 + violationCount));
// "monotone reciprocal decay: 1 / (1 + violations)"
```

```
$ rg -rn -i "skewNormal|skew-normal|skewness|gaussian" --glob 'packages/**/src/**'
packages/drivers/graph-3d/src/Graph3D.projection.ts:205  const gaussian = ...   # 3D scatter, unrelated
packages/foundation/modeling/html/src/Html.meta.ts:436   fegaussianblur          # SVG filter name
```

The only graded epistemic quantity in the repo:
`packages/epistemic/domain/src/values/EvidenceSpan/EvidenceSpan.model.ts:46`
```ts
export const Confidence = UnitInterval.pipe($I.annoteSchema("Confidence", { ... }))
// used at :105  confidence: Confidence.annotateKey({ description: "Extraction confidence in the unit interval [0, 1]." })
```
It is a scalar with no time argument and no stated calibration semantics
(calibrated vs ordinal is not asserted either way).

Retrieval side — the natural consumer of a staleness score is explicitly
scoped out. `goals/hybrid-retrieval-fusion-core/SPEC.md` Non-Goals:
```
- Model mixing, relevance calibration, reranking, MMR, source-authority policy,
  or direct score-magnitude fusion.
```
Packet is 0/4 (not started), `goals/INDEX.md:24`.

---

## E. Character spans — beep is ahead of the released Chronocept JSON

Chronocept's `axes` record is eight fixed string keys, empty string for absent,
non-contiguous segments concatenated, **no offsets** (note §3.9).

beep: `packages/epistemic/domain/src/values/EvidenceSpan/EvidenceSpan.model.ts`
```ts
class EvidenceSpanStruct extends S.Class<EvidenceSpanStruct>($I`EvidenceSpanStruct`)({
  ...TextAnchorFields,      // startChar / endChar as NonNegativeInt
  confidence: Confidence,
  quote: EvidenceSpanQuote, // exact quote, bounded to 65_536 UTF-16 code units
}, ...)
```
with `TextAnchorWidthCheck` tying `endChar - startChar` to the quote length, and
`goals/citation-verified-span-substrate` (1/4, `goals/INDEX.md:16`) delivering
"canonical UTF-16 raw offsets".

The "record the unit/base on the record" half of the lesson: `BaseEntity`
carries `schemaVersion` (seen in `EdgeVersion` example block), so the pattern
exists; it just has no numeric-unit-bearing field to apply it to yet.

---

## F. Evaluation-methodology findings

```
$ rg -rn -w "spearman|Spearman|RMSE|MSE" --glob 'packages/**/src/**/*.ts' | grep -v generated
(no output)
```
No regression metrics anywhere in the repo. Scoring is deterministic and
bounded: `lawComponentScore` (above) plus arithmetic mean into `law_frac`.

`packages/tooling/library/ai-metrics/src/scorecard.ts` exports
`AiMetricsBenchmarkCaseInput`, `AiMetricsBenchmarkRunInput`,
`AiMetricsWeeklyReportInput`, `recordAiMetricsBenchmarkRun`,
`generateAiMetricsWeeklyReport` — storage and reporting, no variance/CI/seed
machinery.

`goals/coding-agent-effectiveness-evidence-loop` (active, 0/9, updated
2026-08-05, `goals/INDEX.md:17`) `SPEC.md`:
```
83:   controlled P7 treatment.
98: 2. **Weakest-link evidence-tier propagation.** Every derived metric inherits ...
105:   the metrics system itself are tagged and excluded from effectiveness
106:   baselines by default.
155:      mechanical/semantic split; self-report divergence is a reported metric;
```
and `PLAN.md`:
```
| P5 Assessment + eval corpus | pending | Bottleneck ranking; 12-task held-out
  corpus with paired repetitions. | ... corpus runnable with memory-ablation profile. |
```

So: baselines exist, held-out corpus exists, paired repetitions exist,
**ablation-by-removal exists** (`memory-ablation profile`). What does not exist:
- any rule that reported metrics must be algebraically independent;
- any seeds/CI requirement on a lift claim;
- the **shuffle/permutation control** (keep the structured input present,
  scramble its order) — `rg -rn -i "shuffle|permut" goals/ explorations/`
  returns only the `memory-ablation` hits above.

`goals/skillopt-training-pilot` is 7/7 complete (`goals/INDEX.md:129`); its
README says "measured lift is evidence; park-with-findings is a legitimate
verdict", and `rg -i "baseline|seed|confidence interval|significan"` over its
SPEC returns one line (`- Adopting/shipping the trained skill (follow-on
decision with lift data).`).

---

## G. The exponential-decay negative result has a live target in this same batch

Chronocept Table 11: Exponential RMSE 0.21–0.27 across all six scenarios vs
0.02–0.05 for Gaussian/log-normal/gamma/skew-normal. Memoryless decay from
`t = 0` is the worst family tested by a factor of 4–10.

The sibling repo being mined ships exactly that heuristic:

`/home/elpresidank/YeeBois/dev/Graphnosis/src/core/optimization/reflection.ts:262-292`
```ts
/**
 * Decay confidence of nodes not accessed recently. Exported for callers that mean it.
 *
 * Read `ReflectOptions.decay` before using this: it keys on `lastAccessedAt`, which is
 * only maintained if retrieval runs with `recordAccess`. Without that, this decays by
 * age since creation, and compounds each time it is called.
 */
export function decayConfidence(graph: KnowledgeGraph): number {
  ...
  if (daysSinceAccess > 7) {
    const decayFactor = Math.max(0.5, 1 - (daysSinceAccess - 7) * 0.01);
    const newConfidence = node.confidence * decayFactor;
    if (newConfidence < node.confidence) {
      node.confidence = Math.max(0.1, newConfidence); // Floor at 0.1
```
Off by default, and their own docstring (`reflection.ts:27-40`) says it
"compounds on every pass" and "measured **age, not disuse**".

`rg -rn -i "chronocept" /home/elpresidank/YeeBois/dev/Graphnosis` → no output.
Nothing in Graphnosis implements a Chronocept-shaped temporal object.

beep has no equivalent (see §D — `staleness|decay|half-life` is empty in the
epistemic packages). So this is an anti-adoption citation, not a repair.

---

## H. Provenance ledger — the discipline already exists, unfilled

`explorations/graphnosis-prior-art/ops/manifest.json`:
```json
{ "exploration": { "slug": "graphnosis-prior-art", "stage": "research",
  "sources": ["research/SOURCES.md"], "created": "2026-08-06" } }
```
`explorations/graphnosis-prior-art/research/SOURCES.md` is still the template.
Its rules block already mandates exactly the fields Chronocept's header carries:
```
- Never fabricate a URL/DOI/repo link.
- Licenses are load-bearing: copyleft ... CLEAN-ROOM ... permissive (MIT/Apache/BSD)
  may be ported WITH attribution; missing/unverified LICENSE ⇒ reference only.
```
Chronocept: arXiv:2505.07637v1, **no venue printed**, dataset CC-BY-4.0,
**code license absent** ⇒ reference-only under the repo's own rule. Taxonomy
provenance is Ning et al. 2018 (MATRES), not Chronocept.

`explorations/graphnosis-prior-art/BRIEF.md` and `MAP.md` are also still
templates; `CAPTURE.md` and `RESEARCH.md` carry real content.

---

## I. Near-duplicate corpus filtering (Chronocept §3.1: SBERT + TF-IDF cos > 0.7)

```
$ rg -rn -il "tfidf|tf-idf|minhash|simhash|jaccard|cosine" --glob 'packages/**/src/**'
packages/drivers/wink/src/WinkSimilarity.service.ts
packages/foundation/capability/nlp-processing/src/Tools/TextSimilarity.ts
packages/foundation/capability/nlp-processing/src/Tools/BowCosineSimilarity.ts
packages/foundation/modeling/nlp/src/Core/Similarity.ts
... (15 files)
```
Plus `goals/dedup-clone-engine` (`goals/INDEX.md:72`). Bricks present.

---

## Verdict summary

The sharp question — does Chronocept's temporal object capture anything a
valid-time/transaction-time interval model does not — resolves **no**, and the
margin is wider than the note's own "mostly no":

1. It has one axis, not two, and the one it has is *relative to a single
   publication instant* — beep's `validFrom/validTo` are absolute epoch millis.
2. Its unimodality constraint forbids the lapse/reinstate/renew shape that
   beep's no-overlap-with-gaps model handles natively.
3. beep's *own* open temporal question (split applicability / efficacy /
   enforceability / procedural effect out of `validAt`) is a refinement
   Chronocept never approaches.

What survives the crossing: the MATRES modality taxonomy (which is not
Chronocept's, and lands on a named-and-empty slot in
`epistemic-belief-view-revision`), the shuffle-vs-remove ablation pair, the
metric-independence anti-pattern, and one anti-adoption citation against
age-based confidence decay that has a live target in the sibling repo.
