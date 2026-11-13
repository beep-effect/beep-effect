# Map

<!--
Stage 4. Decomposition into candidate goal packets. This is the graduation
surface: the definition-of-ready in explorations/README.md is checked against
this file. Every major component cites an existing repo capability or is
explicitly marked NET-NEW.
-->

Paths under `Citation/` mean
`packages/law-practice/server/src/internal/Citation/`; `test/` means
`packages/law-practice/server/test/`. Contracts are in
[`research/design-2026-11-12.md`](./research/design-2026-11-12.md).

## Candidate Goal Packets

| Slug | Mission | Depends on | Capabilities cited |
| --- | --- | --- | --- |
| `citation-engine-install-once` | Install the citation stage tree, tokenizer and regex evaluators once per engine and bind each request's budget, Scope and admission through one invocation service, with configuration owned once at the boundary. | none | `Citation/MetadataComposition.ts`, `Citation/TextBudget.ts`, `Citation/Admission.ts`, `Citation/Tokenizer.ts`, `Citation/ExtractorOrdering.ts`, `Citation/ExtractorSelection.ts`, `Citation/ExtractorRecipes.ts`, `CitationEngine/CitationEngine.layer.ts`, `@beep/law-practice-use-cases` `CitationTextBudget`, `test/CitationNativeSpawner.fixtures.ts`, `test/CitationCanonicalExtractionRuntime.fixtures.ts`. NET-NEW: `Citation/Invocation.ts`, `Citation/ConfigurationOwnership.ts`, a span-recorder fixture, one Biome GritQL rule. |
| `citation-regex-worker-v3` | Serve a request's regex jobs from one child process at a time in a per-invocation native lane, under a parent timer per job, keeping SIGKILL retirement and confirmed-death capacity release. | `citation-engine-install-once` slice A2 | `Citation/NativeAdmission.ts`, `Citation/NativeProcess.ts`, `Citation/NativeRpc.ts`, `Citation/ByteFrames.ts`, `Citation/RegexWorker*.ts`, `Citation/DiffWorker.ts`, `Citation/MarkupWorker.ts`, `CitationEngine.limits.ts`, `test/CitationRegexWorker.fixtures.ts`. NET-NEW: the lane service, the session service, protocol v3 messages. |

Gated, not graduated now:

| Candidate | Gate |
| --- | --- |
| Engine-lived warm worker pool | After both goals land, the one spawn per request is more than ten percent of a request on the fixture. |
| Session model for Diff, Markup and Recognizer workers | After-numbers show any of them in the top three costs. |

## Sequencing

```text
A1 fixture + baseline ─► A2 invocation binding ─► A3 hoist installs ─► A4 owned configuration
                              │
                              └─► B1 native lane ─► B2 protocol v3 session ─► B3 remove v2, re-record timings
```

| Slice | PR content | Behavior change | Count that must move |
| --- | --- | --- | --- |
| A1 | Span-recorder fixture and observed-spawner counts on the ten-call bun cohort; baseline recorded in the goal packet. Test-only. | none | none; records the baseline |
| A2 | `CitationInvocation` and `openCitationInvocation`; every budget and admission lookup read at call time; `captureCitationTextReservation` and `captureCitationOperationChildren` deleted; lint rule. Children still installed per request; regex still v2. | none on results; install-time budget guard and `EnclosingRefusal` paths removed | none; optional lookups under `Citation/` go to zero |
| A3 | Parents install children at their own install; tokenizer and regex evaluators installed at engine construction. | none on results | per-request installs 14 to 0; tokenizer builds 10 to 1; evaluator constructions to 12 |
| A4 | `CitationOwned` minted at the engine boundary; nested detaches, per-stage decodes and repeated fingerprints removed. Report snapshots kept. | none on results | detaches 2 + 8 per call to 1 |
| B1 | `CitationNativeLane`; regex v2, Diff and Markup start through it; limits cross-field check; policy v2 with a major changeset. | one child alive per request at a time | none; adds the markup interleave proof |
| B2 | Protocol v3 messages, looping worker, session, sleep-counting test clock, the eight real-process proofs. All regex call sites switch. | regex jobs share a process within a request | regex processes 291 to 10 |
| B3 | Delete protocol v2; rewrite the spawn-count assertions; re-record `vitest.shards.json` timings; add isolation evidence to the predecessor's contract. | none | none |

Why this order. A1 comes first so every later PR has a baseline taken by the
same instrument. A2 is the load-bearing slice and lands alone and
behavior-neutral: if request values cannot be read at call time without
changing results, nothing after it works. A3 then becomes a mechanical move
that the type checker and the construction-time admission check guard. A4 is
last in goal A because after A3 the copies cost engine construction, not
requests. Goal B can start once A2 merges because the lane and session bind to
the invocation's Scope; B does not need A3 or A4. B1 changes capacity
accounting with the old protocol so that a lane defect and a protocol defect
never arrive in one PR.

Goal A has at most three PRs open at once by construction (its slices are
serial). Goal B's are serial too.

## First Vertical Slice

A1, in `citation-engine-install-once`. It adds a test fixture that runs the
ten-call bun cohort of `CitationCanonicalFullSpan` under a span recorder and
the observed spawner, and prints a table of five counts (child processes
started, metadata-operation installs, configuration detaches, tokenizer
builds, regex worker constructions) plus wall time and host load. It is done
when the table is recorded in the goal packet from two runs whose counts
agree, one local and package-scoped and one on a remote worker.

Verification for every slice:

- Package-scoped locally: `bun run beep quality package-verify @beep/law-practice-server`.
- The large citation replays on a remote worker (`beep-worker` or
  `dankserver`, through the `remote-development-agents` skill), never on the
  shared workstation while its five-minute load is above the cap.
- Hosted CI is the proof of record for the full suite.

## Open Risks Inherited From The Brief

- A missed install-time capture of budget or admission changes accounting
  without a type error. Guard: the lint rule and installing the tree without
  the admission in Context (A2).
- The lane changes how native capacity is counted for Diff and Markup work.
  Guard: the markup interleave proofs under both policies (B1).
- Child stdio is single-use today; v3 needs a new transport for the regex
  worker and a fake worker that speaks it (B2).
- Startup and job timers have the same duration; the manual test clock must
  tell them apart or the kill proofs prove nothing (B2).
- About 190 test assertions encode one process per evaluation (B2, B3).
- Results are consumed while the worker is alive; the ordering "process gone,
  then result used" is given up within a request (B2).
- JavaScriptCore returns a silent no-match after 100 million steps. Not
  changed by this work; recorded so it is not attributed to it.
