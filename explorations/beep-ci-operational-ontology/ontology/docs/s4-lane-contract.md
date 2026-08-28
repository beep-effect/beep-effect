# S4 extraction lane contract (v1, 2026-08-27)

The executable contract for S4 formal-first T-Box extraction lanes. Written to close the
15 unspecified degrees of freedom the round-1 panel (seat C) found in R5 §5 — a lane
runs THIS document, improvising nothing. Mechanism lineage: AgentO derivation process
(R5), adapted to the packet's CQ admission law.

## 1. Frozen inputs (the schema a lane may not change)

| Artifact | Role |
|----------|------|
| `ontology/docs/competency-questions.yaml` | the two-kind admission law + binding convention; 26 CQs (18 Must / 7 Should / 1 Could — Could CQs license nothing) |
| `ontology/docs/pre-glossary.csv` | current term inventory (candidates must not duplicate it silently; `supports=` notation carries semantic-support licenses) |
| `ontology/docs/literal-domains.md` | closed enumerations; never extend inline |
| `ontology/docs/orsd.md`, `scope.md` | boundary law (in/out of scope, expressivity limits) |

Freeze mechanics: at lane launch the orchestrator records each frozen input's sha256
(first 12 hex) into the lane prompt and the lane copies them into its telemetry header.
A digest mismatch at merge time invalidates the lane output. Commit the packet before
launching S4 so the freeze also has a git anchor.

## 2. Extraction units (the S4 source manifest)

One lane per unit, disjoint ownership, full lane map in every prompt:

| # | Unit slug | Sources (exact paths; no improvisation) |
|---|-----------|---------|
| 1 | `turbo-tasks` | `turbo.json` (tasks, `global.inputs`, futureFlags) |
| 2 | `affected-typenames` | `packages/tooling/tool/cli/src/commands/Yeet/internal/TurboQuery.ts` (decoded affected-reason `__typename`s, incl. fail-open members) |
| 3 | `package-topology` | `bun run beep topo-sort` (NOT `topo sort` — round-2 seat F verified the real subcommand) — the orchestrator captures stdout to `ontology/extraction/s4/inputs/topo-sort.txt` BEFORE lane launch and that FILE is the lane's citable source; it lists sorted package NAMES only. Dependency EDGES come from workspace `packages/**/package.json` manifests (dependencies/devDependencies on `@beep/*`), which the lane reads directly |
| 4 | `literalkits` | `LiteralKit(` call sites across `packages/**/src/**` (verification-relevant domains only), EXCLUDING the files owned by units 5 and 7 — ownership is disjoint; those units extract their own files' domains |
| 5 | `yeet-internals` | `packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts` (`YeetProofTier`), `packages/tooling/tool/cli/src/commands/Yeet/internal/AttemptJournal.ts`, `packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts`, `packages/tooling/tool/cli/src/internal/cli/TurboCache.ts` (cache postures) |
| 6 | `fallow-laws` | the fallow boundary configuration file(s) located by `rg -l fallow` at orchestration time and listed IN the lane prompt; `AGENTS.md` (repo root); `standards/ARCHITECTURE.md` verification-relevant laws |
| 7 | `admission-scheduler` | `packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.schemas.ts`, `packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts`, `packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts` (admission call sites), `goals/ship-velocity/research/d1-admission-scheduler.md` (the PR #870 design record) — the DEPLOYED admission policy. **Post-#870 sources: exist only at/after the corpus pin.** |

**Corpus pin (partner-review drift finding; SATISFIED by the application-pass merge):**
S4 extraction MUST run against a tree at or after merge commit `debbbb51f7` (PR #870,
2026-08-27T19:52:03Z). The final-grill round-3 ruling merged `origin/main` into the
working branch, so the pin is now satisfiable from the working tree — units 5/7 extract
their sources directly. Every lane still records the pinned `corpus_commit` (the
working-tree HEAD at launch) in its telemetry; a HEAD without `debbbb51f7` in its
ancestry is an INVALID corpus. Deployed-policy facts (unit 7) enter as
A-Box/configuration candidates; prospective DRR design stays labeled prospective
(UC-002 note).

**Ingestion caveat (verified in-repo):** `TurboQuery.ts`'s
`turboPlanTaskFromAffectedTask` (line ~221) DROPS the decoded affected-reason
`__typename`, and affected collection runs only in repair mode — so CQ-019's A-Box
cannot be fed from the Yeet plan snapshot; it must consume raw `turbo query` output (or
wait for the reason-preservation repo fix, flagged as a separate task).

Ordering: units are independent; run concurrently. A unit too large for one context is
partitioned by file, partition suffix `-p<N>`, same contract per partition.

## 3. Output: one file per lane

Path: `ontology/extraction/s4/<unit-slug>.yaml` (partitions: `<unit-slug>-p<N>.yaml`).
The lane writes EXACTLY this file, creates it within its first few actions, and appends
as it goes. No other file may be touched; no git commands. Structure, in order:

```yaml
telemetry:
  lane: s4-<unit-slug>
  runner: "codex exec"                   # or "grok -p"
  model: gpt-5.6-sol                     # explicit; passed via -m (never left to config default)
  reasoning_effort: max                  # initiative directive 2026-08-27 (grok: xhigh)
  prompt_version: s4-lane-contract-v1
  corpus_commit: <40-hex or 12-hex>      # the pinned tree (>= debbbb51f7); REQUIRED
  started: <ISO8601>
  finished: <ISO8601>
  wall_seconds: <n>
  frozen_inputs:                         # ALL FIVE frozen artifacts, no subset (round-2 seats F+G)
    - { path: ontology/docs/competency-questions.yaml, sha256_12: <hex> }
    - { path: ontology/docs/pre-glossary.csv, sha256_12: <hex> }
    - { path: ontology/docs/literal-domains.md, sha256_12: <hex> }
    - { path: ontology/docs/orsd.md, sha256_12: <hex> }
    - { path: ontology/docs/scope.md, sha256_12: <hex> }
  candidate_count: <n>
  fact_count: <n>
  issue_count: <n>

issues:            # the AgentO Issues/Assumptions ledger — REQUIRED, may be []
  - id: <unit-slug>-I01
    kind: missing-concept | missing-cq | schema-conflict | ambiguity | assumption
    claim: "<one line>"
    evidence: "<repo path>:<lines> — '<minimal verbatim quote>'"
    suggested_disposition: "<one line, advisory>"
    status: open

candidates:        # terms the corpus states that the admission law permits
  - candidate: <TermName | propertyName | IndividualName | domain member>
    kind: class | property | individual | literal-domain-member
    source_domain: <DomainName>            # REQUIRED for literal-domain-member (round-2
                                           # seat F: review-fix exists in BOTH YeetProofTier
                                           # and AdmissionWorkKind; publish in AdmissionWorkKind
                                           # AND AdmissionPriority — an unqualified member
                                           # name is ambiguous)
    definition: "<one line>"
    domain: <class>          # properties only
    range: <class | xsd:*>   # properties only
    admission_kind: decision | semantic-support   # the two-kind law (final grill)
    cq_justification: [CQ-0NN, ...]        # REQUIRED non-empty for decision candidates
    supports: [TermName, ...]              # REQUIRED non-empty for semantic-support
                                           # candidates: the decision term(s) this
                                           # defines/constrains/disambiguates (each must
                                           # be a glossary term or a decision candidate
                                           # in this same output)
    decision_relevance: "<the projection decision this serves, one line>"
    evidence:
      - "<repo path>:<lines> — '<minimal verbatim quote>'"
    already_in_glossary: true | false      # true = corroborating evidence, not a new term
    status: candidate                       # lanes NEVER write accepted/rejected

facts:             # A-Box/configuration VALUE candidates (round-2 seat F: unit 7's
                   # deployed-policy parameters are assertions, not terms — token
                   # weights, capacity defaults, class caps, aging seconds)
  - subject: <IndividualName>              # e.g. YeetWeightedAdmissionV1
    predicate: <propertyName>              # may itself be a candidate above
    value: <literal or IndividualName>
    value_type: <xsd:* | iri>
    cq_justification: [CQ-0NN, ...]        # same admission law as candidates
    evidence:
      - "<repo path>:<lines> — '<minimal verbatim quote>'"
    status: candidate
```

## 4. The admission boundary (no minting)

- The admission law is TWO-KIND (final-grill round 2; ORSD NFR-2): a `decision`
  candidate carries non-empty `cq_justification`; a `semantic-support` candidate
  carries non-empty `supports` naming the decision term(s) it serves through a
  checkable dependency. A candidate with neither is FORBIDDEN — the observation goes
  to the `issues` ledger as `missing-cq` instead. The lane never invents a CQ (or a
  support dependency) to justify a term it likes; S5 audits support justifications
  adversarially, and a support term whose named dependency dies is garbage-collected.
- Members of closed literal domains may only be PROPOSED as `literal-domain-member`
  issues/candidates; the domain itself never changes in lane output.
- `status` transitions (`candidate → accepted | rejected`) happen ONLY in human
  ratification (S5 adversarial loop / S6), recorded in the packet, followed by the
  extend → re-run-all → diff loop (R5). That is the only path by which the frozen
  T-Box changes.

## 4b. The normalization gate (FULL — the `ontology-foundational-auditor` skill)

Extraction proves a REPRESENTATION exists, never an ontological class (partner
review 2). The gate between lane merge (§5) and S5 admission is the
`ontology-foundational-auditor` skill run AS WRITTEN — its own state machine, not an
abridgment (round-3 seat I-02 killed the previous paraphrase). Canonical install:
`~/.claude/skills/ontology-foundational-auditor/` with the family contracts at
`~/.claude/skills/_shared/` (all eight `schemas/*.schema.yaml` exist there; the
`~/.agents/skills/` mirror is STALE and lacks them — **S4 LAUNCH PRECONDITION:
re-sync the mirror or pass `$SKILL`/`$SHARED` paths pointing at `~/.claude/skills/`
explicitly**, since codex lanes resolve the mirror).

The skill's artifact chain is
`SourceObservation → DenotationHypothesis → FoundationalAnalysis(+IdentityCard) →
OntologyTermProposal`, with: a pinned run manifest; SCRIPT-produced observations for
parseable source (per-run adapter + golden fixture — an LLM transcribing syntax is
not a parser); null-hypothesis discriminators; a blinded alternative seat + an
OntoClean adversary seat (independent by construction); the MECHANICAL `--gate` mode
of `scripts/validate_artifacts.py`; per-proposal STEWARD ratification (the operator);
and a total dispositions index. Working directory:
`ontology/extraction/s4/normalization/` plays the skill's `ontologies/{name}/work/`
role (`{name}` = `beep-ci-ops`).

Reconciliation with §3 lane output (the two flows compose, they do not compete):

- A lane `candidates` record is a CANDIDATE HARVEST entry — denotation-stage INPUT,
  never an ontology term. The skill ingests it the way it ingests a pre-glossary
  candidate: the record's `evidence` quotes become `ProseObservation`s, and
  parseable-source units additionally get adapter-script `SourceObservation`s.
- Warrant mapping: a lane record's `admission_kind: decision` + `cq_justification`
  becomes the proposal's decision-term warrant; `semantic-support` + `supports`
  becomes the support-term warrant (the skill's own rule: support terms cite
  DECISION TERMS, never CQs).
- `status: candidate → accepted/rejected` transitions happen ONLY through the
  skill's ratification records — S5's completion predicate (§5) joins on them.

The gate FAILS on ANY unanalyzed candidate — classes, properties, individuals, AND
literal-domain members alike (round-3 N-01: no kind is exempt; a member's analysis
may be the domain-level worksheet plus a membership check, but it must exist). Full
normalization was ruled over the bounded variant (operator override, grill Q3)
precisely because this skill amortizes the worksheet. The ruled splits are standing
mandates the analysis applies: obligation/procedure (requiresLane),
WorkUnitSpecification/WorkUnitExecution, SeatRequest-ticket/SeatGrant-lease.
FREEZE (round-3 H-14): lane/gate telemetry records the skill's `SKILL.md`,
`scripts/validate_artifacts.py`, every `prompts/*.md`, and every
`_shared/schemas/*.schema.yaml` digest alongside the five packet frozen inputs — a
normalization run under unpinned contracts is invalid. The forbidden-LLM-decisions
table binds: lanes and the auditor PROPOSE; the steward (operator) ratifies.

## 5. Merge, dedup, ordering (orchestrator duties)

- Merge key: `(kind, source_domain, candidate)` for literal-domain-members;
  `(kind, candidate)` otherwise; facts merge on `(subject, predicate)`. Identical
  records collapse; conflicting definitions/values become a `schema-conflict` ledger
  entry — never silently merged.
- Canonical ordering in the merged outputs: kind (class, property, individual,
  literal-domain-member), then source_domain, then name, ASCII order; facts by
  (subject, predicate).
- Merged outputs: `ontology/extraction/s4/CANDIDATES.yaml` and
  `ontology/extraction/s4/FACTS.yaml` (same record schemas as §3, plus a
  `source_lanes: [...]` field per record).
- Merged ledger: `ontology/extraction/s4/LEDGER.yaml`. Entry schema = exactly the §3
  `issues` record plus `source_lanes: [...]`; dedup key =
  `(kind, normalize(claim))` where `normalize` = lowercase, collapse internal
  whitespace to single spaces, strip trailing punctuation. This file IS the S4→S5
  queue: S5 must rule accept/reject on every `open` LEDGER entry AND on every
  `candidate`-status record in CANDIDATES/FACTS (dispositions recorded in the S5 loop
  log; doctrine-level ones in DECISIONS.md). Nothing may remain `open`/`candidate` at
  S5 exit — that is S5's completion predicate, and it covers candidates, facts, and
  issues alike (round-2 seat F: issues-only coverage let candidates skip disposition).

## 6. Validation & completion

A lane output is COMPLETE when: the YAML parses; telemetry is fully populated (all five
frozen-input digests + corpus_commit + model); every `decision` candidate/fact has
non-empty `cq_justification` whose ids exist in the frozen CQ suite, and every
`semantic-support` candidate has non-empty `supports` naming glossary terms or
same-output decision candidates; every literal-domain-member carries `source_domain`;
every evidence path exists in the pinned tree; all statuses are `candidate`/`open`;
and `candidate_count`/`fact_count`/`issue_count` match actual list lengths. The executable carrier is
[`../../research/scripts/validate_packet.py`](../../research/scripts/validate_packet.py)
(the committed mechanical checker — round-2 seats F+G: prose predicates are not a
validator), extended with an `--s4-lane <file>` mode before S4 launch. Digests:
`sha256sum <path> | cut -c1-12`. Sources living only on the pinned tree (units 5/7 when
the working branch predates it) are MATERIALIZED by the orchestrator into
`ontology/extraction/s4/inputs/` before launch — lanes never run git.
A lane that errors or times out is RERUN FRESH (extraction is cheap and rerunnable —
R5); partial output is discarded, never merged. Two consecutive failed reruns escalate
to the operator with the lane's stream tail.

## 7. Runner pinning

- codex lanes: `codex exec -s workspace-write --skip-git-repo-check --cd <repo> -m gpt-5.6-sol -c model_reasoning_effort=max "<prompt>"` — model EXPLICIT (round-2 seat F: an unstated model makes the telemetry header unverifiable), max per the initiative effort directive (DECISIONS 2026-08-27).
- grok lanes (if used for archaeology-flavored units): `grok -p "<prompt>" --reasoning-effort xhigh --output-format streaming-json --no-auto-update --max-turns 50`.
- The lane prompt embeds: this contract §3–§4 verbatim, the unit's source list, the
  frozen-input digests, the full lane map (disjoint ownership), and the AgentO prompt
  discipline: fixed schema, no minting, fidelity over condensation, ledger for gaps,
  report-file-first-append-as-you-go, final message = one-line pointer.
