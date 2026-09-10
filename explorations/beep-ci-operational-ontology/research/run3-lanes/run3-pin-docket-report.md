# Run-3 pin docket report

Docket lane B completed the intake and Ruling-14/16 consistency edits on
2026-09-09 in `ontology-run3`, starting at `85cc86d1f3`. This lane made no
commit, staged no files, and did not edit `ontology/extraction/` or
`.claude/`. Lane A's concurrent rotation and engine work retain their own
ownership and report.

Historical artifacts were read through `git show HEAD:<path>` so lane A's
moves could not change the inputs. The working-tree launch ruling and
handoff supplied current orchestration context. The intake follows run 2's
structure: prior-run chain, queues by source, engine deltas, exclusions.
It records decisions and evidence duties without ratifying terms.

## Docket totals

| Queue | Total | Disposition carried into run 3 |
| --- | ---: | --- |
| A | 13 provisional terms plus 1 namespace re-proposal | Three classes and ten properties, with emission fixture/site/contract grounding; all ratify or re-park together. The ten amendment-gated index rows are counted only in C(ii). |
| B | 6 flagged ratifications | Verbatim decisions and full flagged evidence requirements preserved for rat-047 through rat-052. Four issuance/custody duties (047, 048, 051, 052) re-park to run 4; plan/registry duties (049, 050) retain their run-3 evidence routes and missing authority requirements. |
| C(i) | 12 rows | C1 binding 1; C2/C3 contention 2; admission lifecycle 2; lease lifecycle 3; failure-signature rider 3; cache-plan rider 1. These are corpus-addressable duties, with incomplete or absent joins stated explicitly. |
| C(ii) | 10 rows | `hasStep` 2, `stepIndex` 2, pa/pb/pc governing-specification concessions 5, SeatRequest-target concession 1. All route to A after the landed CQ-020 amendment. |
| C(iii) | 46 rows | Ruling-6 parks: 22 rows in 11 remaining scope-surprise families and 24 in 8 other contract/identity/CQ-dependent groups. |
| C(iv) | 0 rows | No unclassified remainder. |
| C total | 68 unique IDs | Exact set equality with the committed unresolved index; no duplicate or missing IDs. |
| D | 2 disposition items, 3 spellings | Historical `schedulesWorkUnit` remains unratified and unchanged; object `hasScope`/`Scope` parks because run-3 emission fixtures do not exercise arm 2. |

The prior index has 387 rows: 68 unresolved, 44 mapped, 7 proposed and
268 irrelevant. Its SHA-256 prefix is `a207a106de68`, matching the brief.
The intake requires `first_run: false` and the exact prior-index path.

The approximate 13-family scope-surprise census includes both promoted
riders. Those families cover 26 unique index rows: four promoted rows plus
22 still-parked rows. One additional memory-measurement duty shares a
lifecycle row counted in C(i); its requirement remains parked and visible.
This avoids turning family memberships into duplicate observation counts.

## Ruling 14: ordinal corrections

| Artifact | Before | After |
| --- | --- | --- |
| `ontology/tests/fixtures/seed.ttl` | `ciops:stepIndex 1` on `ciops:st-1` | `ciops:stepIndex 0` |
| CQ-020 sample in `ontology/docs/competency-questions.yaml` | `idx: 1` | `idx: 0` |
| `ontology/tests/fixtures/must-fail/cq019-derived-scope-gap.ttl` | `ciops:stepIndex 1` | `ciops:stepIndex 0` |
| `ontology/tests/fixtures/must-fail/cq019-step-scope-gap.ttl` | `ciops:stepIndex 1` | `ciops:stepIndex 0` |

These are the only ordinal literals changed. No existing fixture comment
stated a conflicting base. The first step's identifier remains `st-1`;
Ruling 14 changes its ordinal, not IRI syntax. The emission-v2 golden already
has indices 0 and 1 and was not edited.

CQ-020's natural-language question, SPARQL, `required_properties`, notes and
other fields are unchanged. Its SPARQL orders by the value and contains no
one-based assertion. Both must-fail fixtures keep their original predicates
and failure oracles; their ordinal literals now use the deployed base.

## Ruling 16: CQ-019 declaration alignment

Both query copies already agree: the YAML `sparql` block and
`ontology/tests/cq-019.sparql` contain identical query text. Neither changed.

Before, CQ-019 declared only:

```text
hasAffectedOutcome, scopedByComputation, hasScope
```

After, its `required_properties` and the CQ-019 traceability row declare:

```text
hasAffectedOutcome, scopedByComputation, hasScope, hasStep,
schedulesWorkUnit, schedulesSeatRequest, hasScopeTag
```

The four added properties are read by the existing derived-WorkUnit and
step/SeatRequest arms. The traceability row retains its five declared
classes and appends the same four properties; all other matrix rows are
unchanged. These are seven `ciops:` properties; implicit `rdf:type` is the
eighth predicate counted by the coverage registry. No additional class or
property is inferred from that count.

The arm-3 `schedulesWorkUnit` carrier remains exactly as written. The
emission-v2 fixture supplies literal `hasScopeTag` only and no object-valued
`hasScope` or `Scope` individual. Pre-existing seed and adversarial arm-2
fixtures still test the query, but do not constitute new run-3 emission
support for ratifying the object-property pair.

## Verification

The packet README identifies the generated-query/seed/must-fail workflow;
its repository runner supplies the exact Oxigraph command. From the
checkout root, the executed command was:

```sh
UV_CACHE_DIR=~/.cache/beep/uv-cache uv run --offline --python 3.12 --with pyoxigraph python explorations/beep-ci-operational-ontology/research/scripts/run_cq_suite.py
```

Exit code **0**:

```text
RESULT: 0 failure(s) across 25 seed tests + 20 fixtures
```

All 25 generated Must/Should queries executed against the seed. All 20
adversarial fixture oracles passed, including both changed fixtures, each
returning one scope-violation row. CQ-019 returned zero seed violations with
its antecedent populated; CQ-020 returned one fully bound row. Binding
identity, batched-binding rejection and multi-block replacement checks
passed, as did all three S6 golden data probes.

The runner's separate S6 golden census remains limited:

```text
GOLDEN: 1/25 status-covered; 0 antecedent-populated; 0 executed
```

This is seed/fixture regression proof, not a claim that 25 CQs are executable
against the ratified S6 golden. No runner or Oxigraph-driver implementation
was added or changed.

Additional checks:

- Parsed the current and HEAD CQ YAML; exact structural equality after
  allowing only CQ-019 `required_properties` and CQ-020 sample `idx` changes.
- Proved both CQ-019/CQ-020 SPARQL files byte-identical to HEAD and equal to
  their YAML query blocks. Proved the three fixture diffs replace only the
  single ordinal literal, and the matrix differs only in the CQ-019 row.
- Parsed the prior index and checked every full observation ID in the intake:
  68 occurrences, 68 unique IDs, exact equality with the unresolved set.
- `git diff --check` passed for the lane's tracked edits. Both new Markdown
  files end in a newline and contain no trailing whitespace.
- Residue scan covered all eight listed files for absolute home paths,
  operator identity, the current hostname and its digest, numeric UID/process
  identities and UUID-shaped session IDs. It found no such residue in this
  lane's new or edited lines. One lexical match is inherited at
  `research/OPPORTUNITIES.md:7`: an explicitly synthetic numeric UID fixture
  key in an earlier regression receipt. It is test syntax, not a captured
  user ID, and was left unchanged. The scan found no other matches.
- Inspected `bun --bun run beep --help`, `bun --bun run beep lint --help`
  `bun --bun run beep quality --help` and `bun --bun run beep ci --help`,
  using the brief's Bun 1.4.2
  executable. These command inventories expose no typos check. The root
  package manifest contains no typos/spell script; no such command was
  invented or substituted with a repository-wide formatter.

The run-manifest CQ pin after these edits is:

```yaml
cq_suite:
  path: explorations/beep-ci-operational-ontology/ontology/docs/competency-questions.yaml
  sha256_12: e99e30cd8015
  cq_count: 26
```

`cq_count` includes the one Could CQ; the executable suite contains the
18 Must and 7 Should CQs. The digest was computed from the edited file bytes.

## Blockers and retained obligations

No blocker prevents this lane's authorized docket and consistency edits.
The following limit discharge or completion of the wider run:

- `run3-fleet/MANIFEST.yaml` records 1,902 structured failure-signature
  occurrences but zero cache-plan-resolution occurrences (`rider_evidence:
  absent`). The cache-plan rider is queued, not declared discharged. It
  still needs a governed resolver result joined to its Turbo execution;
  a cache flag or `cacheStatus` cannot stand in for that evidence.
- Admission/lifecycle rows retain separate causal-continuity, resource,
  heartbeat-history and decision-CQ requirements where the corpus supplies
  only part of the join. The mixed memory-measurement duty remains parked.
  No new CQ, contract, runtime writer or corpus edit was made to close them.
- Issuance/custody waits for time-to-certainty C4 under Ruling 17. The
  authoritative plan says the ledger service is not yet wired into a lane;
  Stage B's manifest census records zero ledgers.
- Lane A owns rotation completion, adapter/transcriber proof, validator
  digests and fresh Python 3.12/3.13 self-tests. The intake labels that proof
  "per lane A report" because the engine report was not yet available.
  Its current friction receipts identify concrete pin blockers: rat-032,
  rat-033, rat-037 and rat-039 lack projected S5/S6 authority and remain
  outside the completed rotation; the first two archived ordering contract
  quotes no longer occur verbatim in the emission-v2 source. These quotes
  cannot be repaired by coordinate recovery or silently paraphrased. The
  prior-run archive remains their historical evidence.
  The same receipt reports 74 pre-observe validator violations: dirty pin,
  zero observations, four retained ratification references and 68 required
  predecessor-index rows. This is lane A's reported preliminary result,
  not a fresh validator run by lane B. Those dependencies do not authorize
  this lane to change extraction status or manufacture dispositions.
- The launch paragraph records Codex Astra at `max`; current root operator
  guidance directs new token-heavy work to Astra/`xhigh`. The docket records
  both without rewriting history or launching a seat. The orchestrator must
  apply the current routing at launch.
- The S6 POLICY adoption of `corpus_tree`/`corpus_base` remains a recorded
  carry-forward. This lane does not edit the generated extraction contract.

A friction receipt was appended to `research/OPPORTUNITIES.md` for exact
row accounting and the promoted-but-absent cache-plan evidence. It records
the source, observed counts, handling and prevention without host details.
Only the receipt titled "run-3 intake needs row-level evidence accounting"
was appended by this lane; concurrent engine-lane receipts were preserved.

### Files

- Created: `explorations/beep-ci-operational-ontology/research/auditor-run3-intake.md`
- Edited: `explorations/beep-ci-operational-ontology/ontology/docs/competency-questions.yaml`
- Edited: `explorations/beep-ci-operational-ontology/ontology/docs/traceability-matrix.csv`
- Edited: `explorations/beep-ci-operational-ontology/ontology/tests/fixtures/seed.ttl`
- Edited: `explorations/beep-ci-operational-ontology/ontology/tests/fixtures/must-fail/cq019-derived-scope-gap.ttl`
- Edited: `explorations/beep-ci-operational-ontology/ontology/tests/fixtures/must-fail/cq019-step-scope-gap.ttl`
- Edited: `explorations/beep-ci-operational-ontology/research/OPPORTUNITIES.md`
- Created: `explorations/beep-ci-operational-ontology/research/run3-lanes/run3-pin-docket-report.md`
