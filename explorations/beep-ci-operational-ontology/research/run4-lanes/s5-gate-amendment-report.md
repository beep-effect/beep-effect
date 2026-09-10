# S5 gate amendment and run-2/run-3 projection report

Date: 2026-09-10. Branch: `chore/s5-gate-amendment`.
Baseline: `HEAD` and `origin/main` both resolve to
`8cb18e6029b70d45665e915d5f4ec80b2e3aa71c`.

The four S5 amendment rulings are implemented and the run-2/run-3 projection
passes all requested executable packet checks. The tree is left dirty for the
orchestrator. No staging, commit, stash, branch switch, or frozen-artifact
regeneration was performed. The pre-existing `DECISIONS.md` amendment was read
as authority and left unchanged by this lane.

## Gate and contract changes

- `research/scripts/validate_packet.py`: the original run-1 required-set
  derivation is preserved. Every accepted proposal in live or archived work
  joins the required set by proposal id, with exact SHA-256 verification against
  the ratification. The scan includes the legitimate review-fix-class-cap
  proposal; only records without a term are excluded as reviews. TAXONOMY
  ratification annotations must accept the same term; present flags must be
  non-empty strings. Candidate later-ratification lists resolve through the
  same live/archive ratification inventory. The original join-ref check is
  unchanged. S6 now preserves the eighteen baseline classes by name and kind,
  while allowing later ratified classes. The A-Box typing law is unchanged.
- `ontology/docs/s5-taxonomy-contract.md`: appended the dated Ruling-1/Ruling-3
  amendment, including digest authority, additive fields, preserved accepting
  joins, and retained flags.
- `ontology/docs/s6-abox-contract.md`: appended §7 with the named class superset
  and discharge of the §6 gate block; added the requested dated rat-039 pointer
  beside §5's historical VerificationLane wait. Earlier sittings remain intact.
- `research/OPPORTUNITIES.md`: recorded the inherited validator-docstring typo
  found by the touched-file Typos check and its spelling-only repair. Replaced
  three inherited home-relative cache examples with descriptive cache names
  after the residue scan found them; the historical failure evidence is retained.
- `research/run4-lanes/s5-gate-amendment-brief.md`: the supplied brief was already
  at the requested copy destination. Its workstation/home-path examples were
  replaced with environment-based invocation guidance for the public packet;
  the task requirements are preserved.

## Projection

TAXONOMY grows from 38 to 52 terms: 24 classes, 15 properties, nine literal-domain
members, and four individuals. All 70 ratifications across the three runs bind
to the exact proposal bytes on disk.

Run 2 adds FailureSignature, VerificationAttempt, dependsOnTransitive,
VerificationLane, and dependsOn. The fifth term is required by Ruling 1:
rat-042 accepts it even though the brief's abbreviated list names only
rat-032/033/037/039. Both existing dependsOn candidate rows (seq-39/40) describe
the direct package relation and are accepted via rat-042; neither is invented
or removed. These five run-2 decisions contain no verbatim deferral clause, so
their optional flags are omitted rather than fabricated.

Run 3 adds hasCurrentProposal, AdmissionProjectionSpecification,
hasProjectionSpecification, hasStep, ScheduleStep, stepIndex,
schedulesSeatRequest, hasScopeTag, and VerificationEpisode. New rows preserve
the proposal's kind, rigidity, identity-card reference, and empty parent set.
The six ordering properties carry the endpoints/context or scalar range stated
in their accepted definitions; stepIndex retains zero-based recorded-integer
grain. No PackageRef class, superclass edge, or dependency endpoint typing is
invented. The two dependency properties retain empty parameter lists.

Six existing TAXONOMY records gain their first ratification/flag annotation:
ScheduleProposal, SeatGrant, SeatRequest, VerificationResultArtifact,
admissionChargeTokens, and hasOriginKey. VerificationAttempt keeps rat-033;
rat-069 is additive on its existing candidate row. SeatGrant keeps rat-066
when rat-068 is processed; SeatRequest keeps rat-061 when rat-067 is processed.
Their later decisions and verbatim reuse/deferral text remain on DISPOSITIONS.

Sixteen existing candidate rows change. Five parked rows become accepted-via
(seq-12, seq-22, seq-39, seq-40, seq-41); eleven previously accepted rows retain
their original join and gain later ratifications. Seq-22 additionally records
rat-069 after its first acceptance at rat-033. No candidate, fact-class,
ledger, or archived-observation rows are added or removed.

Seven existing predicate rows become ratified and gain TAXONOMY references and
usage entries. CQ coverage is updated from those statuses: CQ-004 has 1/2
ratified predicates, CQ-019 has 4/8, and CQ-020 has 7/7. CQ-020's vocabulary is
now fully ratified, but its golden non-vacuity antecedent remains absent;
there are still zero active golden CQ legs. The CQ runner reports that state
and passes the existing golden probes. The unratified hasScope/Scope arm and
historical schedulesWorkUnit carrier retain their statuses.

The table uses paths relative to this exploration packet. Repeated ratifications
on an existing term are annotations, not replacement identity criteria.

| Ratification | File | Record and change |
| --- | --- | --- |
| rat-032 | `ontology/extraction/s5/DISPOSITIONS.yaml` | candidate seq-12 FailureSignature: parked-run-2 to accepted-via |
| rat-032 | `ontology/extraction/s5/TAXONOMY.yaml` | FailureSignature: append term |
| rat-033 | `ontology/extraction/s5/DISPOSITIONS.yaml` | candidate seq-22 VerificationAttempt: parked-run-2 to accepted-via |
| rat-033 | `ontology/extraction/s5/TAXONOMY.yaml` | VerificationAttempt: append term |
| rat-034 | `ontology/extraction/s5/DISPOSITIONS.yaml` | candidate seq-18 SeatRequest: append later ratification and verbatim reuse grain |
| rat-035 | `ontology/extraction/s5/DISPOSITIONS.yaml` | candidate seq-217 DocgenAffectedWorkUnit: append later ratification and verbatim reuse grain |
| rat-036 | `ontology/extraction/s5/DISPOSITIONS.yaml` | candidate seq-220 FallowAuditLane: append later ratification and verbatim reuse grain |
| rat-037 | `ontology/extraction/s5/DISPOSITIONS.yaml` | candidate seq-41 dependsOnTransitive: parked-run-2 to accepted-via |
| rat-037 | `ontology/extraction/s5/TAXONOMY.yaml` | dependsOnTransitive: append term |
| rat-037 | `ontology/extraction/s6/PREDICATES.yaml` | ciops:dependsOnTransitive: ratified status, term_ref and used_by |
| rat-039 | `ontology/extraction/s5/TAXONOMY.yaml` | VerificationLane: append term |
| rat-040 | `ontology/extraction/s5/DISPOSITIONS.yaml` | candidate seq-0 AdmissionPolicy: append later ratification and verbatim reuse grain |
| rat-041 | `ontology/extraction/s5/DISPOSITIONS.yaml` | candidate seq-0 AdmissionPolicy: append later ratification and verbatim reuse grain |
| rat-042 | `ontology/extraction/s5/DISPOSITIONS.yaml` | candidate seq-39 dependsOn: parked-run-2 to accepted-via |
| rat-042 | `ontology/extraction/s5/DISPOSITIONS.yaml` | candidate seq-40 dependsOn: parked-run-2 to accepted-via |
| rat-042 | `ontology/extraction/s5/TAXONOMY.yaml` | dependsOn: append term |
| rat-043 | `ontology/extraction/s5/DISPOSITIONS.yaml` | candidate seq-8 CachePosture: append later ratification and verbatim reuse grain |
| rat-044 | `ontology/extraction/s5/DISPOSITIONS.yaml` | candidate seq-0 AdmissionPolicy: append later ratification and verbatim reuse grain |
| rat-045 | `ontology/extraction/s5/DISPOSITIONS.yaml` | candidate seq-5 Agent: append later ratification and verbatim reuse grain |
| rat-046 | `ontology/extraction/s5/DISPOSITIONS.yaml` | candidate seq-0 AdmissionPolicy: append later ratification and verbatim reuse grain |
| rat-047 | `ontology/extraction/s5/DISPOSITIONS.yaml` | candidate seq-23 VerificationEvidence: append later ratification and verbatim reuse grain |
| rat-050 | `ontology/extraction/s5/DISPOSITIONS.yaml` | candidate seq-1 AdmissionPriorityClass: append later ratification and verbatim reuse grain |
| rat-052 | `ontology/extraction/s5/DISPOSITIONS.yaml` | candidate seq-23 VerificationEvidence: append later ratification and verbatim reuse grain |
| rat-053 | `ontology/extraction/s5/DISPOSITIONS.yaml` | candidate seq-28 admissionChargeTokens: append later ratification and verbatim reuse grain |
| rat-053 | `ontology/extraction/s5/TAXONOMY.yaml` | admissionChargeTokens: add ratification and flags |
| rat-054 | `ontology/extraction/s5/TAXONOMY.yaml` | hasCurrentProposal: append term |
| rat-054 | `ontology/extraction/s6/PREDICATES.yaml` | ciops:hasCurrentProposal: ratified status, term_ref and used_by |
| rat-055 | `ontology/extraction/s5/DISPOSITIONS.yaml` | candidate seq-57 hasOriginKey: append later ratification and verbatim reuse grain |
| rat-055 | `ontology/extraction/s5/TAXONOMY.yaml` | hasOriginKey: add ratification and flags |
| rat-056 | `ontology/extraction/s5/TAXONOMY.yaml` | AdmissionProjectionSpecification: append term |
| rat-057 | `ontology/extraction/s5/TAXONOMY.yaml` | hasProjectionSpecification: append term |
| rat-057 | `ontology/extraction/s6/PREDICATES.yaml` | ciops:hasProjectionSpecification: ratified status, term_ref and used_by |
| rat-058 | `ontology/extraction/s5/TAXONOMY.yaml` | hasStep: append term |
| rat-058 | `ontology/extraction/s6/PREDICATES.yaml` | ciops:hasStep: ratified status, term_ref and used_by |
| rat-059 | `ontology/extraction/s5/TAXONOMY.yaml` | ScheduleProposal: add ratification and flags |
| rat-060 | `ontology/extraction/s5/TAXONOMY.yaml` | ScheduleStep: append term |
| rat-061 | `ontology/extraction/s5/DISPOSITIONS.yaml` | candidate seq-18 SeatRequest: append later ratification and verbatim reuse grain |
| rat-061 | `ontology/extraction/s5/TAXONOMY.yaml` | SeatRequest: add ratification and flags |
| rat-062 | `ontology/extraction/s5/TAXONOMY.yaml` | stepIndex: append term |
| rat-062 | `ontology/extraction/s6/PREDICATES.yaml` | ciops:stepIndex: ratified status, term_ref and used_by |
| rat-063 | `ontology/extraction/s5/TAXONOMY.yaml` | schedulesSeatRequest: append term |
| rat-063 | `ontology/extraction/s6/PREDICATES.yaml` | ciops:schedulesSeatRequest: ratified status, term_ref and used_by |
| rat-064 | `ontology/extraction/s5/TAXONOMY.yaml` | hasScopeTag: append term |
| rat-064 | `ontology/extraction/s6/PREDICATES.yaml` | ciops:hasScopeTag: ratified status, term_ref and used_by |
| rat-065 | `ontology/extraction/s5/TAXONOMY.yaml` | VerificationEpisode: append term |
| rat-066 | `ontology/extraction/s5/DISPOSITIONS.yaml` | candidate seq-17 SeatGrant: append later ratification and verbatim reuse grain |
| rat-066 | `ontology/extraction/s5/TAXONOMY.yaml` | SeatGrant: add ratification and flags |
| rat-067 | `ontology/extraction/s5/DISPOSITIONS.yaml` | candidate seq-18 SeatRequest: append later ratification and verbatim reuse grain |
| rat-068 | `ontology/extraction/s5/DISPOSITIONS.yaml` | candidate seq-17 SeatGrant: append later ratification and verbatim reuse grain |
| rat-069 | `ontology/extraction/s5/DISPOSITIONS.yaml` | candidate seq-22 VerificationAttempt: append later ratification and verbatim reuse grain |
| rat-070 | `ontology/extraction/s5/TAXONOMY.yaml` | VerificationResultArtifact: add ratification and flags |

Rat-038 (WorkUnitSpecification), rat-048/051 (VerificationResultArtifact), and
rat-049 (VerificationPlanSpecification) already name TAXONOMY terms and have no
same-named S4 candidate row. They require no invented candidate; the existing
term records remain, with the requested run-3 rat-070 annotation on
VerificationResultArtifact. The six run-2 flagged decisions remain open under
run-3 sitting 3, Ruling 3. Nothing here discharges Queue B's identity/provenance
obligations.

## Proofs

All commands ran from the repository root. `research/scripts` below is inside
`explorations/beep-ci-operational-ontology/`; there is no repository-root
`research/scripts` directory. Python ran through the operator-provided uv cache
in offline mode with Python 3.12 and cached pyyaml, rdflib, pyshacl, and pyoxigraph.
Bun 1.4.2 was selected through the shell PATH. No host paths are persisted here.

The exact Python command prefix was
`uv run --offline --python 3.12 --with pyyaml,rdflib,pyshacl,pyoxigraph python`.
Each command below exited 0; verdict lines are copied verbatim.

1. `explorations/beep-ci-operational-ontology/research/scripts/validate_packet.py`

   ```text
   RESULT: 0 blockers, 0 warns
   ```

2. `explorations/beep-ci-operational-ontology/research/scripts/validate_packet.py --s5`

   ```text
   S5: 337 candidates / 104 ledger / 149 observations / 29 fact classes / 27 constraints
   RESULT: 0 blockers, 0 warns
   ```

3. `explorations/beep-ci-operational-ontology/research/scripts/validate_packet.py --s6`

   ```text
   SHACL: PASS: census.ttl parses (provisional graph excluded from typing)
   SHACL: PASS: companion graph encodes all 4 MANIFEST closure declarations
   SHACL: PASS: closure.ttl conforms
   SHACL: PASS: typing.ttl conforms
   SHACL: RESULT: PASS
   S6: 86 predicates / 25 CQ coverage rows / 0 active golden legs / 0 drift rows / 0 pending refs
   RESULT: 0 blockers, 0 warns
   ```

4. `explorations/beep-ci-operational-ontology/ontology/extraction/s6/scripts/apply_s6_dispositions.py --check`

   ```text
   candidate seq-247: already discharged
   fact classes: 0 deferred-s6 -> discharged; S4 fact indexes: [1031, 1032, 1033, 1034, 1035, 1036, 1037]
   policy sitting ref: DECISIONS.md §'2026-08-30 — S6 sitting 2'
   CHECK: no files changed
   ```

5. `explorations/beep-ci-operational-ontology/ontology/extraction/s6/scripts/run_shacl.py`

   ```text
   PASS: census.ttl parses (provisional graph excluded from typing)
   PASS: companion graph encodes all 4 MANIFEST closure declarations
   PASS: closure.ttl conforms
   PASS: typing.ttl conforms
   RESULT: PASS
   ```

6. `explorations/beep-ci-operational-ontology/research/scripts/run_cq_suite.py`

   ```text
   RESULT: 0 failure(s) across 25 seed tests + 20 fixtures
   ```

The S5 scripts expose no verify/check mode. Their entry points generate or
rewrite artifacts. The S6 script inventory and implementation report identify
only the disposition check and SHACL runner as non-writing checks; both ran
above. Historical ETL and builder commands were not run because they rewrite
frozen artifacts. S4 source evidence, S5 frozen join/constraint/seat artifacts,
and S6 policy/census/A-Box, graphs, shapes, and snapshot bytes remain unchanged.

The packet validator has no existing self-test pattern, so no new test module
or self-test interface was added. An ephemeral harness exercised fifteen
positive/negative cases by overriding file reads in memory: missing accepted
terms, stale live/archive digests, a same-named proposal with a different id,
unaccepted proposals, incorrect/unknown annotation refs, blank/non-string flags,
malformed/unknown later refs, composite joins, and S6 baseline name/kind changes.
The underlying packet files were never mutated by these probes.

```text
RESULT: 15 gate probes passed; input overrides were in memory only
```

The foundational auditor's existing `--self-test` also exited 0.

`bun run beep knowledge semantic-delta` exited 0:

```text
probe-policy: enabled
introduced (0)
resolved (0)
unchanged (491)
```

This result is advisory until the orchestrator commits: semantic-delta scans
HEAD, so it does not certify the dirty projection. The 491 unchanged findings
are inherited. `bun run beep knowledge refs --check` also exited 0 and identified
HEAD as its scanned revision:

```text
knowledge refs @ HEAD (8cb18e6029b70d45665e915d5f4ec80b2e3aa71c)
check: 0 live gated observation(s)
```

A separate current-file residue scan covers all nine lane-touched files for
home paths, the current account/hostname, numeric UID tokens, and raw UUIDs.
Typos and whitespace checks cover the same final files.

```text
RESIDUE: 0 findings across 9 touched files
TYPOS: exit 0 across 9 touched files
WHITESPACE: git diff --check exit 0
```

## Blockers and handoff limits

No remaining implementation or packet-proof blockers. The orchestrator still
owns named-path staging, committing, and post-commit knowledge checks. Hosted
checks and publication are outside this uncommitted lane. The accepted run-4
identity, continuity, and provenance deferrals remain open as recorded; the S6
gate block alone is discharged.

The pre-existing dirty `DECISIONS.md` contains the steward's four-ruling
authority and belongs in the orchestrator's same-PR amendment. It was not edited
by this lane and is not counted in the nine files below. No package source was
touched, so package verification is not applicable.

### Files

All paths are repository-relative. This is the complete lane-touched list:

- `explorations/beep-ci-operational-ontology/ontology/docs/s5-taxonomy-contract.md`
- `explorations/beep-ci-operational-ontology/ontology/docs/s6-abox-contract.md`
- `explorations/beep-ci-operational-ontology/ontology/extraction/s5/DISPOSITIONS.yaml`
- `explorations/beep-ci-operational-ontology/ontology/extraction/s5/TAXONOMY.yaml`
- `explorations/beep-ci-operational-ontology/ontology/extraction/s6/PREDICATES.yaml`
- `explorations/beep-ci-operational-ontology/research/OPPORTUNITIES.md`
- `explorations/beep-ci-operational-ontology/research/scripts/validate_packet.py`
- `explorations/beep-ci-operational-ontology/research/run4-lanes/s5-gate-amendment-brief.md`
- `explorations/beep-ci-operational-ontology/research/run4-lanes/s5-gate-amendment-report.md`
