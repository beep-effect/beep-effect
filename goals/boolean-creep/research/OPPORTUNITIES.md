# Friction ledger — boolean-creep

Receipts recorded at the moment of friction (repo law: friction is a
first-class output). Public repo: paths relative, no secrets, no session ids.

## 2026-08-17 — headless grok lane dropped an evaluated record

- **Doing:** round-1 inventory sweep, ontology-mcp lane (headless grok,
  streaming-json).
- **Evidence:** the lane's thinking stream drafted a full disqualified record
  for `ToolbarState` (`packages/ontology/ui/src/aggregates/Session/Session.document.tsx`)
  but ended its turn (`stopReason: end_turn`) without ever issuing the append
  tool call; the report file held 1 record while the stream showed 2
  decisions. Recovered by replaying the raw transcript and appending after
  orchestrator re-verification.
- **Prevention:** the lane prompt now pins append discipline — "APPEND your
  record IMMEDIATELY after deciding each suspect, BEFORE opening the next
  file; every suspect you read code for MUST produce exactly one appended
  record" (rounds 2+). Keep raw transcripts always: they are the recovery
  layer, not telemetry.

## 2026-08-17 — raw `codex exec` does not take `--effort`

- **Doing:** launching the P2 design batches on codex CLI.
- **Evidence:** all six batches failed instantly with
  `error: unexpected argument '--effort' found` (codex v0.147.0). The
  `--effort` spelling belongs to the Codex *plugin* delegation interface; the
  raw CLI takes the config override `-c model_reasoning_effort=medium`.
- **Prevention:** in scripts, pass effort as
  `codex exec -c model_reasoning_effort=<level> ...` and smoke-test one job
  before fanning out (the early transcript peek caught this within seconds).

## 2026-08-17 — block comment terminated by a glob in prose

- **Doing:** writing `ops/validate-inventory.ts`.
- **Evidence:** the JSDoc header contained `data/sweeps/round*/*.jsonl`; the
  `*/` inside the glob closed the block comment and bun failed with
  `error: Unexpected *` at the comment line.
- **Prevention:** never write `*/` inside block comments — spell globs as
  "files under data/sweeps/" or use line comments for path patterns.

## 2026-08-23 — merge commit hook assumed an installed worktree

- **Doing:** merging `origin/main` into the PR branch from a fresh isolated
  worktree before the mergeability repair loop.
- **Evidence:** the conflict-free merge paused at `commit-msg` because
  commitlint could not resolve `@commitlint/config-conventional`; installing
  the frozen lockfile allowed the unchanged merge commit to complete.
- **Prevention:** install the locked workspace dependencies before creating a
  merge commit in a fresh worktree, or make the hook report that prerequisite
  before invoking commitlint.

## 2026-08-23 — pinned Bun installation reported a different runtime

- **Doing:** regenerating `bun.lock` after removing a deleted ghost workspace.
- **Evidence:** the repo pins Bun 1.3.14, but the executable installed under
  that version reported 1.4.0; `bun install` removed 66 unrelated lock entries
  in addition to the target workspace. The unrelated churn was restored, and
  the focused lockfile passed `bun install --frozen-lockfile`.
- **Prevention:** have agent bootstrap verify the resolved Bun executable's
  reported version against `.bun-version` before any lockfile-writing command.

## 2026-08-23 — full local Yeet proof omitted hosted blocking lanes

- **Doing:** proving the repaired PR head locally before publishing it.
- **Evidence:** `bun run beep yeet verify` passed every planned lane, but the
  hosted `Property Laws` and `Coverage Regression` checks later failed; neither
  lane appeared in the local 25-lane verdict. The property failure was a
  load-sensitive mention-unmount race that passed 10 consecutive focused
  reruns locally, while coverage reported concrete uncovered units.
- **Prevention:** make the full Yeet plan include every required hosted quality
  lane, especially property tests and coverage, or report those omissions as
  explicit unproven gates before allowing publish proof reuse.

## 2026-08-23 — Yeet suggested a retired CI lane id

- **Doing:** refreshing the stale JSDoc CI inventory reported by
  `bun run beep yeet status --remote`.
- **Evidence:** Yeet prescribed `bun run beep ci lane jsdoc-inventory`, but the
  CLI rejected that id; live `CiLane.ts` shows the inventory is produced by the
  `jsdoc-ratchet` lane before its ratchet step.
- **Prevention:** derive the staleness remediation command from the registered
  CI lane descriptor, or update the gate descriptor to prescribe
  `bun run beep ci lane jsdoc-ratchet`.

## 2026-08-23 — hosted property depth exceeded the local Yeet proof

- **Doing:** monitoring the first hosted run after an exact-head local Yeet
  verification.
- **Evidence:** the hosted Property Laws lane found a Tika error round-trip
  equivalence failure after 153 tests with seed `20260708` and path `152`;
  the same commit's 25-lane local Yeet plan had passed without running that
  hosted property depth.
- **Prevention:** include the hosted property command and its configured run
  count in local Yeet verification, and print the deterministic seed and path
  in the local verdict so a counterexample can be replayed exactly.

## 2026-08-23 — shared mock crossed concurrent Effect tests

- **Doing:** adding stable coverage for the desktop Tauri IPC writer.
- **Evidence:** the instrumented package suite ran four `it.effect` cases
  concurrently; their shared hoisted `invoke` mock interleaved calls, causing
  three contradictory call-count failures despite each behavior passing alone.
- **Prevention:** mark suites that mutate a shared hoisted mock sequential, or
  give each concurrent case an isolated dependency layer instead of shared
  module-level mock state.

## 2026-08-23 — detached-head Semgrep preflight lost its Git worktree

- **Doing:** running clean-head Yeet verification from an isolated worktree.
- **Evidence:** Semgrep reported `fatal: not a git repository` while trying to
  configure `safe.directory` against the original checkout's worktree metadata;
  the scan still completed with zero findings.
- **Prevention:** create detached verification worktrees from a stable Git
  common directory, or pass Semgrep a validated repository path instead of a
  worktree metadata path that can disappear during preflight cleanup.

## 2026-08-23 — captured child watchdog started after the missing event

- **Doing:** closing PR 764 after `Lint Policy` twice consumed its full hosted
  50-minute timeout.
- **Evidence:** both failed jobs logged 25 of 26 policy steps complete;
  `lint:native-runtime` never returned, and runner cleanup killed six nested
  Bun processes. `runCaptured` bounded a pipe only after the direct child's
  `exitCode`, so a wrapper whose exit signal never arrived had no deadline.
- **Prevention:** invoke repo CLI policy children without the package-script
  wrapper, ignore stdin for noninteractive capture, and bound the full child
  lifetime with explicit process-group cleanup before the workflow timeout.

## 2026-09-03 — completed design review went stale before its user gate

- **Doing:** preparing the reviewed boolean-creep designs for GATE 2
  ratification against current `main`.
- **Evidence:** `git diff --name-only ff2184e6b3..HEAD` intersects 27 of the 46
  primary inventory files and 63 source/test paths cited by the designs. The
  Tier 2 `yeet-merge-ready-verdict` design still models three criteria and
  `checksGreen`, while live `Verdict.ts` now models eight hard criteria and
  `requiredChecksGreen`; the packet's previous zero-findings claim is no
  longer current proof.
- **Prevention:** bind design-review evidence to a source commit and run an
  automatic cited-path drift check immediately before each ratification gate;
  reopen review whenever a cited path changed instead of presenting stale
  designs as gate-ready.

## 2026-09-03 — ontology public barrel topology drift

- **Doing:** reclassifying `ontology-inference-recompute-cause` against the
  current RPC request/response surface.
- **Evidence:** the live ontology package has pre-existing `/public`
  export-boundary drift that is broader than the recompute-cause model and its
  compatibility codec.
- **Prevention:** open a separate architecture opportunity for the ontology
  barrel topology. Do not turn the boolean-creep singleton into an unrelated
  public-export rewrite; migrate only the decoded consumers and wire codec
  required by this record.

## 2026-09-03 — Grok sweep max-turn exhaustion destroys the transcript

- **Doing:** running the unseeded moving-main current-corpus sweep with the
  packet's existing bounded lane runner.
- **Evidence:** several high-density lanes appended valid inventory records,
  then exited 127 at their turn ceiling and replaced their streaming transcript
  with only `run-sweep-lane.sh: line 54: max-turns: command not found`.
- **Prevention:** treat a nonzero lane as incomplete even when its report is
  schema-valid. Resume it in a named continuation lane seeded from the partial
  report, retain the report as evidence, and require a clean exit before the
  area can contribute to a dryness round. The round driver now records every
  `wait -n` result and exits nonzero if any child failed; previously its final
  successful child could mask earlier failures. The runner should eventually
  detect this Grok failure mode and preserve the prior stream separately.

## 2026-09-03 — live lane scripts were mutable beneath Bash

- **Doing:** tightening the sweep runner's default scratch location while five
  residue lanes were still executing that same script.
- **Evidence:** after one Grok child returned, its long-lived Bash wrapper
  reported `syntax error near unexpected token '&'` even though the current
  file parses cleanly; the script had been replaced on disk while Bash still
  had later source to read. The lane transcript and partial report survived,
  but its wrapper exit was not valid completion evidence.
- **Prevention:** treat an active runner as immutable. Finish or interrupt all
  processes before patching it, or launch lanes from a content-addressed copy
  so later packet edits cannot alter the executable beneath a live shell.

## 2026-09-03 — broad residue lane exhausted the model output budget

- **Doing:** running the round-3 drivers, architecture-lab, ecosystem, and
  internal-package residue lane against exact `main` after earlier census
  admissions were seeded.
- **Evidence:** the lane accumulated 3,083,330 model tokens across 25 turns,
  entered an exact-repetition loop while enumerating remaining package
  families, and exited nonzero with `response truncated by max_tokens`; its
  report was empty, so the otherwise-complete four-lane round is inadmissible.
- **Prevention:** partition high-cardinality source families into bounded lanes
  before launch, preserve the failed transcript as evidence, and require every
  replacement partition to exit zero at the same source SHA before treating
  the parent area or round as complete.

## 2026-09-03 — concurrent Grok lanes stranded after inference-idle startup

- **Doing:** running five round-2 residue lanes concurrently against exact
  source SHA `58e063757b2440ae1a358cb410ed6a14acfcaf33`.
- **Evidence:** the domain lane completed with exit zero and no records, while
  the other four transcripts stopped after `inference idle timeout after 300s
  with no chunks` during title generation and emitted no further bytes for
  nine minutes. A serial resumed Apps retry reached five tool-using turns, then
  exited with `The model is currently at capacity due to high demand`; its
  report remained empty and is not credited.
- **Prevention:** preserve the completed lane and raw failed transcripts, stop
  the non-evidentiary holders, and replay only the missing lanes serially at
  the same source SHA. Add bounded startup-idle detection to the runner so
  a stranded lane fails explicitly and can enter the continuation path.

## 2026-09-03 — serial exact-main Grok retry also hit provider capacity

- **Doing:** restarting the required residue census serially after merging the
  latest `origin/main` into the packet branch.
- **Evidence:** the first tooling lane at source SHA
  `a1652c1923eee0c33d9015da7fbf30449fa8269f` made one tool-using model turn,
  then exited nonzero with `The model is currently at capacity due to high
  demand` before it could create its report. The lane is not credited.
- **Prevention:** make the runner's model/service tier configurable, bound
  provider retries independently of scan turns, and support small resumable
  source partitions so a transient terminal failure does not discard a full
  high-density lane attempt.

## 2026-09-03 — desktop continuation terminated a live sweep subprocess

- **Doing:** running the bounded repo-CLI command-family partition of the
  exact-main residue census in a persistent unified terminal session.
- **Evidence:** after the thread continued, the terminal handle was unknown,
  no matching Grok or lane-runner process remained, and the saved transcript
  ended mid-read without an `end` event; the zero-line report therefore cannot
  count as a dry result.
- **Prevention:** keep each partition independently restartable from its named
  Grok session and report, and teach the desktop continuation path to preserve
  unified terminal subprocesses or deliver an explicit terminal interruption
  result. Never infer a dry lane from an empty report without exit-zero proof.

## 2026-09-03 — broad exact-main lanes exhausted output and provider budgets

- **Doing:** completing the second post-admission residue sweep before the
  independent GATE 2 design review.
- **Evidence:** the drivers/architecture and foundation lanes exited nonzero
  with `response truncated by max_tokens` after 26 and 32 turns and produced
  empty reports. A fresh replacement lane then failed before analysis with
  HTTP 402, `Grok Build usage balance exhausted`. None of those lanes is
  credited toward convergence.
- **Prevention:** split foundation and drivers/architecture into smaller
  source-family partitions before launch, retain nonzero transcripts under
  distinct retry names, and preflight provider balance before starting a
  multi-lane gate. A round becomes admissible only after every replacement
  partition exits zero at the same source SHA.

## 2026-09-08 — refresh lane routing and source citations drifted

- **Doing:** restarting the current-corpus census after the Grok availability
  preflight succeeded and `origin/main` was merged forward.
- **Evidence:** the old residue scripts enumerate selected app roots and omit
  current `apps/todox/src`, while their tooling globs omit nested library,
  policy-pack, and test-kit source roots. The new round's `lane-map.json`
  assigns every included source file to exactly one of 25 partitions. The
  inventory's `worktree-removal-mode` evidence at `Worktree.service.ts:667`
  now points at residue-manifest encoding instead of the removal guard.
- **Prevention:** reconcile lane coverage against live source paths before
  launching a round, inspect generated exclusions so authored generator code
  remains in scope, and verify citation content rather than only checking
  that its file and line exist. Round 24 records exact source and main SHAs;
  source/design evidence corrections remain before GATE 2.

## 2026-09-08 — compatibility design substituted display equivalence for wire proof

- **Doing:** checking the refreshed Vault connection design before independent
  review and implementation.
- **Evidence:** its proposed decoder mapped a legitimate disconnected status
  with a missing/null reason to `probe-failed`; the inverse then emitted
  `disconnectReason: "probe-failed"` where the current codec's canonical
  encoding is `disconnectReason: null`. Matching the panel's fallback copy
  does not preserve the encoded value/default required by `DECISIONS.md`.
- **Prevention:** compare every proposed encode-after-decode result with the
  existing codec's canonical encoding, including optional-key defaults.
  Represent a legitimate absence explicitly instead of inventing payload
  information at decode time. Repair the design before passing GATE 2.

## 2026-09-08 — assumed browser-family exclusivity contradicted accepted metadata

- **Doing:** refreshing the previously reviewed Pretext engine-family design.
- **Evidence:** `packages/drivers/pretext/src/browser.ts:75-85` accepts Apple
  vendor plus a user agent containing both `Safari/` and `Edg/`. The public
  export preserves both Safari fences and the Chromium CJK fence. The prior
  E1 claim and three-case design would remove an accepted behavior. The
  bounded reproduction is in `data/design-refresh-2026-09-08-pretext-audit.md`.
- **Prevention:** test predicate overlap against the actual accepted input
  contract before claiming exclusivity; browser-family names alone do not
  establish an invariant. Reclassify unsupported qualifications instead of
  adding a normalization rule as part of a representation refactor.

## 2026-09-08 — automatic continuation interrupted scanners and design writes

- **Doing:** running the current-corpus census and bounded design refreshes.
- **Evidence:** after automatic goal continuation, the unified sweep handle
  reported `Unknown process id`; owned driver/scanner processes were absent,
  and three transcripts ended without an end event. Native design agents
  had also stopped between deleting and recreating three design documents.
  Twelve completed primary lane receipts remain valid historical evidence;
  incomplete reports receive no dry-round credit.
- **Prevention:** run long scans in an owned user-manager service with
  independently persisted receipts, preserve immutable runner snapshots, and
  replace complete design files atomically. Resume native agents from durable
  files and verify every expected design still exists before handoff.

## 2026-09-08 — one SHACL producer could not prove a shared contract invariant

- **Doing:** revalidating a three-state SHACL result design against all writers.
- **Evidence:** the bounded validator only emits three conformance/truncation
  pairs, but the public engine adapter emits all four for supported requests.
  A custom severity plus a zero result cap produces `conforms: true` and
  `truncated: true`. The four-row public-service reproduction is recorded in
  `data/design-refresh-2026-09-08-nlp-shacl.md`.
- **Prevention:** establish an invariant across every supported producer and
  the actual dependency behavior before replacing a shared schema. Reclassify
  the false positive instead of normalizing meaningful encoded data.

## 2026-09-08 — Parameter-only helper admitted as domain state

While refreshing `generated-file-drift-mode-flags`, source search found only
docs/test uses of `GeneratedFileDrift.assertExclusiveModeFlags`. Its anonymous
input is a function flag-parameter contract, excluded by SPEC and explicitly
skipped by `ops/prompts/sweep-lane-round1.md:44`. The old design then migrated
`syncGeneratedFile.write`, a different symbol with no correlated pair. The
record/design are archived and withdrawn from the live projection. Applying
the parameter exclusion before E-class judging would have prevented the scope
expansion. Dead helper cleanup remains a separate opportunity.

## 2026-09-08 — Census reports hid correlated payload and encoding axes

- **Doing:** reconciling round 25 before treating it as convergence evidence.
- **Evidence:** several raw reports counted a boolean times a multivalue
  status as four states and labeled JSON report models internal. The correction
  receipts expanded Docgen package outcome to status/timeout/error, found the
  Runpod cleanup report's persisted stop/delete outcomes, and expanded the
  transcript to six load/content axes. Native source review additionally found
  that rounded border scores can remain zero on matched measurements.
- **Prevention:** inventory the full declared state domain, all correlated
  payload presences, and actual codec consumers before assigning cardinality
  or landing tier. Inspect source-level callable-versus-value distinctions:
  the rubric correction still mistook two predicate functions for sibling
  boolean values. A repository-owned Python worker is an application protocol,
  not an external SDK contract merely because its producer uses another language.
  Preserve raw receipts and apply source-backed corrections before the next seed.

## 2026-09-08 — Public constructor defaults contradicted an aggregate-only design

- **Doing:** validating Scorecard readiness designs before census admission.
- **Evidence:** `models.ts:997-1019` documents positive task, label, and
  benchmark counts while omitting `completionReady`; its constructor default
  is false. The six-state aggregate-only proposal would reject that explicit
  documented construction while citing constructor defaults to justify an
  empty scorecard. Both coupled designs are reopened before admission.
- **Prevention:** evaluate public examples through actual constructor defaults
  and apply the same evidence standard to every retained or rejected tuple.
  A single aggregate writer cannot establish the entire exported contract.

## 2026-09-08 — A bounded design follow-up did not return a handoff

- **Doing:** correcting the two Scorecard designs before seeding round 26.
- **Evidence:** the native follow-up remained reported as running while the
  two design files stayed unchanged for over 25 minutes and status requests
  returned no update. The orchestrator intentionally interrupted that task
  and transferred only its unfinished correction, preserving its documents.
  No observation timeout was treated as proof that the task had stopped.
- **Prevention:** require a short source-finding checkpoint and a bounded
  handoff for a follow-up that controls the next census. Keep completed work
  separate so transferring a correction does not repeat the whole audit.

## 2026-09-09 — Narrow census clusters hid deterministic aliases

- **Doing:** reconciling round 26 after every round-25 case had a design.
- **Evidence:** `r26-foundation-modeling-rest.jsonl` found a missing srcset
  implication beside the recorded HTML sizes cluster. The native full-function
  audit expands image flags from four to six and link flags from two to three.
  `r26-foundation-schema-a-m.jsonl` found three enforcement aliases omitted
  from a five-independent-flag D1 record. The UI report also omitted an
  earlier-today overlap when counting completion and due-date observations.
- **Prevention:** inspect complete related locals and their upstream literal or
  presence inputs before freezing a census seed. Enumerate actual reachable
  tuples, including parser failures, defaults, and overlapping predicates;
  preserve narrower D1 evidence while superseding it under the stable owner.

## 2026-09-09 — A counterexample to equivalence did not defeat implication

- **Doing:** adjudicating the M365 retryable/reason D1 report in round 26.
- **Evidence:** the original report cited the explicit None/false wire fixture
  to reject a flag-presence equivalence. The bounded correction found that all
  supported retryable-true cases still carry throttled or transport reasons;
  the full eight-reason-plus-absence domain has nine supported tuples out of18.
  `r26-m365-retryable-contract-correction1.execution.json` records successful
  completion; its qualification still awaits native compatibility design.
- **Prevention:** test E4 implication independently of E3 equivalence, count
  actual literal alternatives, and distinguish a generic schema round-trip
  property from supported domain constructions.

## 2026-09-09 — Callable policies were repeatedly counted as Boolean state

- **Doing:** reconciling round 26 and the inherited D1 census.
- **Evidence:** the bounded callable audit withdrew twelve entries whose
  members are functions, and the LegalPosition audit found the same error in
  `candidateFor`. The thirteen original rows are preserved in
  `history/inventory/2026-09-09-r26-callable-value-withdrawals.jsonl`; source
  declarations and invocation sites are in the matching data handoffs.
- **Prevention:** establish the declared value carrier before evaluating
  relationships between predicate results. Inline calls, nested classifiers,
  and separate policy invocations do not create sibling Boolean state.

## 2026-09-09 — A supported diagnostic input was mistaken for invalid state

- **Doing:** checking RuntimeEvidence compatibility before admission.
- **Evidence:** `ProfessionalRuntime.test.ts` explicitly preserves an encoded
  evidence DTO without span keys, and the public validation flow returns the
  existing missing-span diagnostic for that input. The first proposed design
  would have replaced that supported path with decode rejection. Reopened
  review withdrew the proposal; the corrected evidence is in
  `data/design-refresh-2026-09-09-runtime-evidence.md`.
- **Prevention:** establish the boundary being modeled before counting legal
  combinations. Preserve intentionally broad diagnostic inputs, and apply
  explicit codec-fixture evidence consistently across domains.

## 2026-09-09 — Main advanced during a complete frozen census

- **Doing:** refreshing upstream before packet verification.
- **Evidence:** `git fetch origin main` advanced the base from `9b7553f618`
  to `52fcc8d135` through PR #1019 while round 26 and bounded design audits
  were reading the frozen earlier checkout. The upstream change spans 599
  files, including product source and supporting tests. No new-source dry
  round can be credited from those older receipts.
- **Prevention:** finish and retain frozen discovery evidence, merge main
  forward before new verification, refresh affected citations and designs,
  and seed the next complete census with the reconciled inventory. Keep
  execution completion separate from current-source convergence proof.

## 2026-09-09 — A provider output limit ended one census partition early

- **Doing:** checking round 26 execution receipts while the remaining
  partitions continued.
- **Evidence:** `r26-tooling-library-policy-test.execution.json` records exit
  1, no end-turn event, an empty report, and `Provider response exceeded the
  output token budget.` The controller remains active; the empty report is
  not a completed no-findings census.
- **Prevention:** preserve the failed receipt and attribute the provider
  limit before selecting a bounded recovery. Keep lane completion checks
  independent of report existence and JSON validity; carry this unfinished
  coverage into the required next-source census.

## 2026-09-09 — Upstream advanced again during the citation refresh

- **Doing:** refreshing main before validating the integrated 162-case packet.
- **Evidence:** `git fetch origin main` advanced `52fcc8d135` to
  `663904610c` through PRs #1018 and #1017. The delta changes one included
  authored source file, `packages/drivers/tika/src/Tika.config.ts`, plus
  upstream dependencies, lockfile, tests and docs. Native source audits still
  target the frozen earlier checkout; no new verification or census has run.
- **Prevention:** complete the assigned frozen reads, preserve their source
  identities, merge forward, install the merged frozen lock, and recheck only
  affected evidence before the next full census. Distinguish small source
  deltas from a need to repeat unrelated design work.

## 2026-09-09 — Staged packet edits prevented the required main merge

- **Doing:** merging `663904610c` forward after all frozen source audits
  completed.
- **Evidence:** `git merge --no-edit origin/main` stopped with
  `Your local changes to the following files would be overwritten by merge`.
  The listed files are staged boolean-creep packet artifacts; upstream changes
  do not overlap this packet. No merge commit was created.
- **Prevention:** preserve the index patch and packet file hashes, temporarily
  remove only this packet from the index, merge main, and restore the same
  staged patch. Verify both staged bytes and working-tree files afterward so
  the merge cannot absorb the unpublished packet or lose its staging state.

## 2026-09-09 — Smaller census partitions preserve failed-lane coverage

- **Doing:** launching the next full census after round 26's provider output
  failure.
- **Evidence:** round 27's `lane-map.json` assigns all 3,061 included source
  files to exactly one of 27 partitions. The previous 174-file tooling owner
  is split into 52-file observability, 84-file support/test-kit and 38-file
  policy owners. Its immutable runner keeps four concurrent jobs and bounded
  read/output instructions. The owned service is live at the merged source.
- **Prevention:** partition from the actual assigned file list, prove no gaps
  or overlap before launch, and require exit zero plus an end-turn receipt for
  each owner. Smaller scope addresses the observed output limit without
  weakening the required complete-corpus census.

## 2026-09-09 — Modeling census exhausted its turn allowance

- **Doing:** reconciling the 181-file modeling partition in round 27.
- **Evidence:** the private transcript ends with `max_turns_reached`,
  stop reason `cancelled`, and `Error: max turns reached`; its public receipt
  records exit 1 and no end-turn event. The original empty report is retained
  as an incomplete attempt. The other primary partitions continue.
- **Prevention:** continue the saved conversation once with a bounded
  allowance and explicit remaining-root accounting, preserving completed
  reads and the failed evidence. Queue that continuation behind the primary
  pool rather than exceeding its concurrency limit. Future controllers should
  distinguish turn-limit events from provider failures in sanitized receipts.

## 2026-09-09 — Carrier exclusions need to distinguish Boolean state atoms

- **Doing:** adjudicating the ontology toolbar reports and related state rows
  from round 27.
- **Evidence:** the strict-carrier wording used “Atom handles” without naming
  their value type, while `SPEC.md` and the census net explicitly include
  sibling Boolean atoms. `ontologyDirtyAtom` in `Session.atoms.ts:1531` owns a
  computed Boolean; a callback used to compute that state is different from
  a standalone callable predicate. The new toolbar input proposals separately
  cite excluded anonymous function parameters at `Session.document.tsx:74-80`.
- **Prevention:** retain Boolean-valued state atoms in the net and exclude
  callable guards or non-Boolean command/runtime handles by their actual value
  role. Clarify future census and review prompts, preserve already-running
  prompts, and account for the affected Boolean-state coverage before claiming
  round convergence. Keep the valid returned toolbar projection distinct from
  its excluded function inputs.

## 2026-09-09 — Gate service launch on controller preparation

- **Doing:** preparing the bounded normalization census correction.
- **Evidence:** a private controller-generation assertion failed before writing
  the script, but the sequential tool batch still launched its service. The
  service exited 2 before creating any queue, report, or Grok conversation.
- **Prevention:** inspect generation/parse success before dispatching a dependent
  service start. The failed unit was verified terminal, the controller was
  prepared and parsed, and that same unit was then started once successfully.
  No live census reader was duplicated or restarted.

## 2026-09-09 — Validate provisional designs against their proposed inventory rows

- **Doing:** admitting the normalization and proof-reuse designs after source
  adjudication.
- **Evidence:** the canonical design validator ignored provisional unadmitted
  ids, then reported six missing required section names after admission, such
  as `design is missing a Cardinality gap section`. The proof existed under
  broader headings; canonical headings were repaired and prior drafts archived.
- **Prevention:** validate a proposed design with its proposed inventory row
  before handoff, and use the exact required section names from the validator.
  Coverage of only the already-admitted ids does not validate a draft.

## 2026-09-09 — frozen scanner prompt disagreed with the inventory contract

While reconciling R27, the scanner called actual returned data objects unsupported
carriers because `ops/prompts/sweep-lane-round1.md` omitted `object-literal` from
its kind enum. `SPEC.md:50` and the inventory validator already accept that kind.
The same prompt described every cardinality as `2^n` and told readers to skip
seeded file/symbol pairs, obscuring actual optional/literal domains and stale D1
claims. The completed observability correction and CLI seed audit exposed these
conflicts. Future prompt text now mirrors the contract, distinguishes real inline
data objects from invented carriers, and requires seed revalidation. Frozen R27
prompts, reports, transcripts and receipts remain unchanged. Deriving prompt enum
text from the inventory schema and validating seed-handling instructions before a
round would have prevented repeated correction work.

## 2026-09-09 — request validation confused the Boolean-state evidence gate

The R27 Yeet correction confirmed the concrete remote-status expansion and six
eligibility withdrawals but ended with two unresolved D1 owners: raw runtime
request options versus a validated operation state. The exact receipt is
`data/sweeps/refresh-2026-09-09-r27-main-663904/r27-cli-yeet-contract-correction1.execution.json`;
its minimal finding is “universal D1 is unproved, and no complete co-carried
cardinality was established.” The one-correction limit is respected: that
Grok lane is stopped and its reports remain unchanged. Native source analysis
is checking the documented input contract and typed diagnostic paths. A
calibrated source example distinguishing specified request rejection from an
impossible stored state would have prevented repeated boundary ambiguity.
No second correction, dry credit or implementation is inferred from process
success alone.

## 2026-09-09 — recovery receipt used an older minimal provenance shape

Final R27 receipt validation stopped at `KeyError: seedSha256` for the successful
modeling recovery; the original recovery controller omitted that field. No
verdict or inventory snapshot had been written. A separate provenance companion
now binds the unchanged execution receipt, failed primary receipt, frozen seed,
materialized prompt and transcript, and verifies the same conversation privately.
The finalizer explicitly validates that documented format instead of rewriting
the original receipt. A shared receipt schema for primary and recovery runners
would have prevented this finalization mismatch.

## 2026-09-09 — JSON-valid raw census output was not inventory-valid

Full R27 raw-report validation found two duplicate declaration-line/member
clusters in `r27-tooling-library-support.jsonl`: three distinct compiler schema
residue records reused one raw field anchor. Their individual schemas pass,
and the earlier configuration audit already consolidated the owners at correct
canonical anchors. `raw-report-validation.json` now preserves this original
violation and its existing integration receipt. The raw report is unchanged.
Running the canonical validator before closing each scanner report would have
caught the metadata error earlier than final round reconciliation.

## 2026-09-09 — the main refresh exposed stale owners behind stale citations

Round 28 preflight failed before launching any scanner: `TerseEffect.ts` evidence
line 784 was outside the current 767-line file. The upstream extraction removed
the old per-file latches; related inspection also found synthetic input/output
owners and an excluded function-parameter pair in older designs. The source
adjudication is `data/design-refresh-2026-09-09-r28-laws-skills-impact.md`.
Checking declaration ownership and current member presence before cardinality
would have prevented these cases from surviving earlier design refreshes.
Original rows and designs are archived before removal; no failed preflight or
historical review is converted into current-source approval.

## 2026-09-09 — the frozen census map included generated output

R28's modeling review found `Html.meta.ts:2` marked `GENERATED FILE`, although
the frozen `lane-map.json` included it. The same map includes `Html.model.ts`,
the generated language registry and desktop migration bundle; generated-path
data files also require an explicit scope audit. The controller inherited a
prior exclusion list and filtered `_generated` but did not revalidate every
generated output against the current corpus. A generated metadata candidate
therefore reached a schema-valid raw report despite being outside the goal.
The frozen map, seed and reports remain unchanged. A separate source-backed
exclusion receipt will record the effective authored subset and withdraw any
affected census rows. Validating output provenance before freezing the map,
while retaining authored generators and templates containing banner strings,
would have prevented this scope error. R28 receives no dry credit from the
uncorrected file count or raw report validation.

## 2026-09-09 — a draft landing instruction contradicted the no-rebase rule

The collision-stage provisional design instructed a later Tier 2 branch to
rebase. `DECISIONS.md` requires merging main forward. Parent integration
corrected the current design to that workflow while preserving the provisional
bytes and recording the correction in `data/r28-driver-collision-integration.json`.
Checking operational instructions against binding decisions before design
handoff would have prevented the contradiction; no git operation followed it.

## 2026-09-09 — emitted payload variants replaced the declared type in cardinality

The R28 epistemic census reported graph-worker retry state as 6/5 by counting
only the two command kinds installed by its writers. The actual declaration
is `Option<WorkerCommand>` and that schema has five variants, so the full
declared control product is 12/5. Evidence is in
`data/design-refresh-2026-09-09-r28-graph-worker-retry.md`. The independent
report remains unchanged and requires its one bounded correction before
admission. Separately enumerating the declared domain and supported producer
domain before counting would have prevented this numerator error. Payload
contents remain intact; their arbitrary values are not extra finite axes.

## 2026-09-09 — repeated owner and inferred-type errors survived schema validation

R28 reconciliation found old qualifications that paired one Boolean with a
required array, a required enum, or a field nested in another owner. Other rows
described Command/Flag descriptors or callback parameters as stored Boolean
objects. The source audits are `data/design-refresh-2026-09-09-r28-cli-first-owners.md`
and `data/design-refresh-2026-09-09-r28-agent-app-owner-boundaries.md`.
Structural inventory validation cannot prove that these owners exist or satisfy
the original census net. Requiring declaration ownership and the full member
types before evidence classification would have prevented repeated withdrawals.
Actual returned data objects and Boolean state atoms remain eligible; required
payloads and callable parameter aliases do not manufacture extra state axes.

The receipt audit also initially inferred `Option<true>` from an unannotated
`O.map(..., () => true)`. Both installed compilers instead prove `Option<boolean>`,
changing the declared count from 4/3 to 6/3. The exact proof and preserved prior
audit are in `data/design-refresh-2026-09-09-r28-receipt-occupancy-type.md`.
The first private native probe encountered TS5112 when explicit files and root
configuration discovery overlapped; `--ignoreConfig` resolved that invocation.
Checking generic inference with a bounded compile-only probe, and asserting
both the accepted false case and an explicitly narrowed control, would have
prevented the inaccurate numerator without changing product code or tests.

## 2026-09-09 — simplifying call locators erased distinct census owners

The parent CLI integration shortened four source-qualified `fs.remove` call
locators to their enclosing function names. `validate-inventory.ts` then
reported `duplicate file/symbol/member cluster` for the two distinct removal
objects inside `removeDirectoryCandidate`. The source and scanner rows were
correct; this was an introduced metadata error. The follow-up
`data/r28-command-data-integration.json` archives the normalized rows and
restores the exact original enclosing-call locators. Simulating the validator's
file/symbol/member key before changing locator text would have prevented this
failure. Call locators must distinguish actual object expressions without
inventing nonexistent properties or changing the inventory schema.

### R28 correction prompt rendering altered a Boolean expression

During the R28 execution-provenance audit, reconstruction of the UI correction
prompt found that Bash replacement expanded both ampersands in the intended
`items.length===1 && indicator!==dot` fragment into `{{LANE_EXTRA}}` tokens.
The native audit identified the replacement at runner line 55. The frozen
launch input hash still matches, but the rendered prompt differs from that input.
Preserve both artifacts and bind their exact difference in the execution audit;
the completed report and source-backed correction remain separately assessable.
Literal-safe prompt substitution plus a byte-for-byte rendered-input preflight
would have prevented this defect. Do not rewrite frozen runners or receipts.

### R28 draft design placement and landing sequence

While promoting the L-Q designs, the resolved test-lane provisional put its
private result schemas in wildcard-exported Quality.schemas.ts and described
Tier 1 work as singleton PRs. The source-backed coverage design already
identified the facade expansion at Quality/index.ts49, and PLAN requires
ordered Tier 1 subsystem batches. The current design now proposes a private
internal schema role and serial edits inside Tier 1E; Tier 2 remains singleton.
An explicit export-boundary and landing-tier check before drafting would have
prevented both errors. Original drafts remain unchanged; the integration
receipt identifies the parent corrections. A leftover provisional paragraph
in the coverage promotion was separately archived and corrected.

### R28 connected finite fields were missing from retained designs

The final retained CLI audit found that the earlier TemplateContext models
split one constructor into overlapping type, app-kind and lab/ecosystem
records. Its carried literal domains and eleven Boolean projections form
one owner with 1,658,880 representable and 31 supported combinations. Other designs treated required arrays/counts as axes
or omitted real optional move fields and rejection literals. Exact owner
field inventory, all constructor/default/decoder contracts and connected
finite-domain enumeration before drafting would have prevented those repairs.
The frozen proof is data/design-refresh-2026-09-09-r28-cli-retained-qualified-gap-audit.md.
Its explicit neighboring Tmpfs permission-error/race question is under a
bounded native follow-up; no unproved independence or replacement count is
accepted from that open question.

### R28 preparation receipts were mistaken for installed transactions

After the retained CLI installation, the private inventory-chain audit rejected
its parent receipt as a duplicate predecessor hash. The preparation receipt now
has normalized before/after inventory fields but explicitly says
`mode: staged-not-installed` and `installed: false`; the audit previously used
field presence alone to identify transactions. Excluding explicit preparation
receipts restores the single installation chain without rewriting evidence.
Checking receipt state before interpreting its hashes as a completed transition
would have prevented this audit failure.

### R28 frozen audit whitespace surfaced when additions became tracked

The Tmpfs installation passed inventory and design validation, then
`git diff --check HEAD -- goals/boolean-creep` exited 2 on a final blank line in
`data/design-refresh-2026-09-09-r28-cli-l-q-seeds.md:364` and
`data/design-refresh-2026-09-09-r28-execution-coverage-audit.md:181`.
Both files still match their previously frozen hashes; this is existing packet
whitespace newly visible in the tracked diff, not a Tmpfs edit or evidence drift.
The parent completed the already-installed transaction with a separate verified
receipt and preserved the frozen bytes. Check new untracked artifacts before
freezing them so later staging does not reveal a packaging failure after mutation.
The broader HEAD-to-worktree whitespace check remains open; do not label it
green. GOAL.md's exact unstaged `git diff --check -- goals/boolean-creep`
passes, as do the inventory and design validators; these are distinct scopes.

### R28 tracking ref advanced after the source-bound audits

The finalizer's origin/main equality assertion stopped before writing any
round artifact. Reflog evidence records an external fetch at 07:34:17 UTC from
`d1b4d769fbaffddd55717f3b1ba461897dd545c5` to
`3bb59f37c02b7d677c6a5b58651fe85bb4bb5943`. HEAD, source bytes and inventory
still match all frozen audit inputs. Preserve the old source epoch and record
the newer tracking ref separately; never reset the ref to manufacture stability.
A historical round finalizer should distinguish immutable source commits from
a mutable tracking ref, and require a fresh merge/census for current-main credit.
The round remains wet and grants zero dry credit.

### Continuation interruption stopped the merge preparation and impact audits

During preparation for the main `3bb59f` refresh, the collaboration wait was
interrupted. The next live `list_agents` observation reported all three assigned
native agents as `interrupted`. HEAD and origin/main were unchanged and no
`MERGE_HEAD` existed, so there was no partially executed merge to recover.
The parent resumed the existing agents and their saved private audit files.
Write bounded executable preparations and source-bound findings incrementally
so an interruption does not leave completed reasoning without a usable handoff.
Check the live agent or process handle before resuming; an expired observation
alone would not justify launching duplicate work.

### Private-file permissions leaked into the forward-merge subprocess

The main `4f13d8` merge reached the expected index tree, then stopped before
commit at `Merge changed protected files unexpectedly`. All five protected
files had the expected content hashes; their modes were 0600/0700 instead of
the captured 0644/0755 because the helper's private-backup umask also applied
to Git. A separate guarded continuation restored only those recorded modes,
ran the normal commit with a child-specific 0022 umask, and restored the exact
original staging. The failed execution and backups remain unchanged. Set
private artifact permissions separately from Git's working-file permissions.

The continuation also stopped before mutation when a concurrent read-only
Graft query updated `graft/.cache/stats.json`. Every other graph file still
matched the backup. Preserve and hash the newer runtime statistics separately,
then pause graph queries during the brief preservation transaction. Read-only
query semantics do not imply that a tool leaves its own local cache untouched.

### Secret-scanner triage at the requested packet commit

The normal commit hook stopped at `leaks found: 44` while recording the refreshed
packet: 35 generic API-key, six FreshBooks and three Discord rule findings.
All 43 digest values reproduce from their recorded bytes: 40 source hashes, two
copies of an archived design hash and one archived inventory-row hash. The last
finding is ordinary archived design prose. The proposed exceptions require the
exact rule, artifact path and complete known line; 24 scanner controls retain
detection for changed values, appended content and other paths. No hook is
bypassed and no frozen report is rewritten. Run the staged secret scan before
the commit transaction, and prove narrow exceptions against negative controls.

Hosted PR scanning pins its configuration and ignore file to the base branch.
The verified exception change must therefore land separately before the eventual
packet ratification PR can pass that gate; adding it to the packet PR alone is
insufficient. This is a publication prerequisite, not an implementation or
independent-review result.

The same hook reformatted the new main-merge JSON receipt without changing its
parsed value. Its SHA-256 therefore changed before its first commit. Format new
receipts before binding their exact bytes in a later integration manifest.

The R29 launch review also found that the mutable R28 pointer still named the
verdict's original byte hash after its one-element array had been compacted.
The observed variant already exists in the earlier merge backups, and the
original serializer reproduces the original hash exactly. The separate
[formatting receipt](../data/r28-verdict-format-drift.json) retains both hashes;
only the mutable pointer changes. Freeze evidence after formatting, and verify
referenced byte hashes at commit preparation as well as at round finalization.

### Pre-R29 installation caught incoming source and receipt-format drift

The installation guard stopped before writing when live main advanced from
`85cc86d1f3fd99088bf6317bfc639743de539331` to
`5fc065daff16300b8435eca3f32d55564664f57c`. The normal forward merge brought in
the scheduler recovery polling fix. A bounded source audit preserved the
17-design preparation, explicitly rebound its one changed test fixture, and
refreshed the two affected scheduler designs separately. Check live main before
mutation and isolate the changed source owners so an incoming fix does not
invalidate unrelated reviewed work or encourage resetting a tracking ref.

The preparation check also found two new JSON maps whose bytes would change
under the normal Biome hook. The final stage formats those maps before hashing
and preserves all 37 non-JSON artifacts exactly. The new R29 controller applies
the same ordering to its own lane maps and execution receipts, with 12 focused
formatter tests; raw reports and frozen history retain their recorded bytes.
Format authored evidence before binding it, and test formatter failures and
semantic preservation at the writer boundary.

### Hosted scanner version did not support the locally verified configuration

The isolated scanner prerequisite lane tested the exact pinned hosted image
before publication. Gitleaks 8.24.3 still reported all 44 frozen-evidence findings
with the locally passing configuration; installed Gitleaks 8.30.1 reported none.
The common `[[allowlists]]` and `targetRules` configuration syntax requires
8.25 or newer, so the hosted scanner did not apply those exceptions. Publishing
that configuration unchanged would leave the packet gate failing. The lane is
preparing the equivalent supported per-rule form and will verify the original
findings, default detector behavior and negative controls on both runtimes.
Exercise the exact hosted tool version before declaring a local quality fix
ready for publication.

The replacement uses nine per-rule tables for the same 46 exact rule/path/line
predicates. Both 8.24.3 and 8.30.1 now clear the frozen evidence and retain all
24 control groups and 132 expected findings. Version-specific parser probes
also preserve all 208 and 222 resolved detectors, respectively, including prior
allowlists and global settings. The reviewed correction is proceeding through
fresh Yeet verification in the isolated prerequisite branch; these local
runtime checks do not claim hosted completion.

### Agent usage exhaustion left the verification process running

The scanner prerequisite agent stopped at an account usage limit while its
saved Yeet proof remained live. The parent could not attach with the former
agent's execution-session handle (`Unknown process id`), but the recorded
operating-system PID, process start time and checkout directory still matched;
the proof log then advanced from admission waiting to test-tsgo execution.
Continue from the live process and durable log instead of treating a missing
tool-session handle as a failed command or launching a duplicate proof. Save
process identity, checkout, exact input hashes and log paths before handing off
long-running commands.

### Concurrent settings commit changed the census HEAD

A separate agent restored the checked-in Graft permissions and hook timeouts
while the round-29 census was running. The commit changes only
`.claude/settings.json`; all 3,044 admitted corpus files, dependency inputs and
139 designs still match their launch hashes. The census controller checks exact
HEAD, so its final source-stability gate must remain failed for this round.
The existing lane runner also rewrites `source-sha.txt` at each dispatch; use
the immutable launch admission and saved per-lane prompts to distinguish the
actual inputs. Keep the raw reports and classify this as historical evidence
without exact-head dry-round credit. An isolated census checkout would prevent
unrelated commits from moving this evidence boundary.

### Partial clone made history verification fetch blobs individually

The isolated scanner prerequisite clone used `remote.origin.partialclonefilter`
`blob:none`. During full Yeet verification, `fallow health` ran a six-month
`git log --numstat` and repeatedly fetched missing historical blobs; the clone
had accumulated over a thousand small packs. The proof process remained live.
A separate fetch hydrates the exact pinned commit history with `--refetch
--no-filter --no-write-fetch-head --no-tags --no-auto-maintenance`; before/after
checks cover refs, index and the staged scanner configuration. It does not
restart or replace the proof. Hydrate history once before running history-based
quality gates in a partial clone, or use a complete object store for those gates.

### Existing census status hid excluded owners during round 29

Several completed round-29 footers called their seeds unchanged while also
identifying those seeds as callable predicates, cross-owner expressions or
zero-Boolean Options. The tooling-library-support footer additionally found
`codegen-kit-cli-mode` still designed against Command flag handles and anonymous
function parameters. Reading `CodegenKit.cli.ts:38-48` and
`CodegenKit.service.ts:443-462` showed that its proposed public API migration
would touch the explicitly excluded function-flag surface. The prepared
correction archives that design and withdraws the row without changing source.

Revalidate eligibility before reusing any D1, D2 or designed status. An
out-of-scope helper collection needs removal from the live projection and an
exact historical archive, not a retained disqualifier. Conversely, the docgen
footer excluded actual constructed two-Boolean options objects along with
anonymous parameter signatures. `Checker.ts:93,117-120,145,169,193,219` contains
nine real objects whose independent checks are at lines 65 and 72. Keep the
parameter exclusion and the constructed-object census boundary separate.

### Observer tuples did not define the complete planning-input contract

The final round-29 Yeet report proposed a 128/60 qualification for
`SweepGitState` based on its only runtime observer. A native design audit found
`test/yeet-sweep-plan.test.ts:814-821` deliberately constructing an unreliable
worktree probe with one occupancy flag false, plus known-held/no-path fixtures
at 279 and 285. Those supported helper inputs contradict the proposed universal
occupancy implication. The source contract still explicitly requires a
conservative dirty value for an unreliable status probe. Keep that separately
proven cluster distinct while auditing the remaining constructor domain; do not
turn an observer's reachable subset into restrictions on every supported caller.

### Generic JSON rendering bypassed nested schema encoders

The new Runpod template design shares its report generator with the earlier
cleanup design. `QualityWorkerRunpodEval.ts:311-316,1297-1299` passes the report
to generic JSON encoding, so a nested schema compatibility transform would not
run automatically. Both Tier 2 designs must explicitly project their reviewed
fields through the wrapper encoding path and prove full-output byte equality.
The template history audit also found the original explicit-id producer retained
whitespace; use the existing string domain to preserve those historical values.
Inspect the actual serializer and historical producers when designing a codec.

### Main-forward verification confused whole documents with incoming changes

The main-forward preservation check initially required merged SPEC and DECISIONS
files to equal main. This branch also carries ratified campaign amendments, so
that test reported a failure after a successful merge. Comparing the exact
incoming routing substitutions instead proved all other bytes preserved across
1,226 packet files. A second input check found that the dependency manifest also
includes `biome.jsonc`, whose Graft exclusions changed on main; package manifests
and lock bytes stayed unchanged. Inspect the manifest's actual categories and
compare merge deltas without discarding intentional branch content.

### Locator installation confused classification with its explanatory note

The pre-R30 parent installation stopped before canonical writes with
`AssertionError: ('ci-lane-run-options', 'disqualifier')`. The prepared D rows
retain their D1/D2 classes but prefix the nested explanatory note with its
historical source pin; one extracted cleanup owner has a newly verified note.
The guard incorrectly required that entire object to remain byte-identical.
Compare the class separately, verify the exact approved note transformation,
and keep all other classification fields unchanged. Preserve the failed private
preparation before retrying the corrected guard.

### Moving coverage baseline invalidated an otherwise fixed merge preview

The scanner prerequisite's full publication measured merge preview `fead5181b23b`
against source main `3657f8f97f71`, but coverage comparison used the later
`bed30c6adf3b` floors. It reported 17 regressions across five CLI files; every
measured value met the corresponding original-source floor. For example,
Quality.command.ts line coverage was 48.69 against an original floor of 40.67,
but the failed comparison demanded the new 56.3 floor. The scanner patch changes
only .gitleaks.toml. Preserve the failed proof, merge current main forward, and
rerun the full proof. Freeze the comparison baseline with the admitted source
to prevent a later ref update from changing acceptance during a long run.

### Current-source verification exposed an inherited scheduler coverage gap

After merging bed30 into the scanner prerequisite, `bun run beep yeet verify`
still failed coverage for unchanged QualityScheduler.ts: functions 97.20 below
97.46, lines 98.65 below 98.75, and statements 98.38 below 98.47. Source and
comparison baseline now share bed30; this is separate from the earlier moving
baseline failure. All other lanes passed. The verdict's security-repair hint
did not match the authoritative coverage failure. Preserve the failed coverage
and add a public admissionStatus regression test for unsafe directory permissions
in the isolated prerequisite worktree, then run package and full verification.
Keep coverage floors unchanged. Precise child-lane failure attribution and a
behavior test for this existing error boundary would have prevented the delay.

### Census proposals counted payloads and separate option bags as Boolean peers

R30 apps and observability reports proposed four qualifications whose actual
carriers each contain only one Boolean plus an Option payload or required literal
field. Examples are VaultChooseRow.disabled/status and the JSONL scan's
excludedByMaxFileBytes/file. A three-state tuple or implication does not waive
the entry net of two actual Boolean members. Two other D2 proposals grouped
separate one-flag configuration calls across a module. Parent source review
rejected all six before canonical writes and corrected an earlier private D2
recommendation for JsonlChunkParseResult, also a one-Boolean carrier. Preserve
the raw reports and the superseded private recommendation. Future prompts should
separate entry-net proof from payload/cardinality analysis and require the actual
shared value carrier before recording a candidate.

### Landing list lagged behind reconciled inventory

During R30 closeout, comparing PLAN.md's landing IDs with the 738-record
inventory found the withdrawn Codegen parameter owner still listed and eight
current qualifications absent, including three from R29. The landing list now
contains all 146 qualified IDs exactly once, with 115 Tier 1 and 31 Tier 2
placements. An inventory-derived parity check during each reconciliation would
prevent the packet's implementation order from lagging behind its canonical state.

### A later merge-preview run exposed a separate planner coverage gap

The scanner prerequisite publication passed its head proof and scheduler coverage,
but the bed30 merge preview failed Planner.ts functions 83.33 below 84.61, lines
90.07 below 90.83, and statements 90.51 below 91.24. Planner source and these
floors are identical on bed30 and d68, so this is an inherited coverage gap,
separate from the earlier moving-baseline failure. Main d68 adds direct
yeetPlanPhases ordering and empty-plan tests. The failed proof is preserved in
`~/.cache/beep/boolean-creep/scanner-pr-20260909/publish-scheduler-repair-bed30-failure-attribution/`.
Merge current main into the isolated prerequisite and rerun full proof; do not
weaken floors or follow the unrelated config-sync repair hint. Exact child-lane
attribution and checking upstream test additions prevent redundant local repairs.

### Cross-file design citations survived several source moves

The pre-R31 audit found stale Quality.command.ts references inside the Tmpfs
and OSV designs although their primary owner files had not changed. For example,
Tmpfs still referenced lines 129 and 3506–3524; the current import and command
are at 53 and 3743–3775. The relevant function bodies remain byte-identical
across the latest main update. Refresh all design-referenced changed files,
including imports and consumer commands, instead of selecting designs solely
by their inventory owner file. Original design bytes and exact replacements
are preserved in the private pre-r31-main-d68-parent-crossrefs bundle.

### Completion footers miscounted scoped seed records

R31 modeling-rest reported 23 scoped seeds while its admitted set contains 25;
schema A–M reported 12 while its set contains 13. The completed transcript
seed-query outputs contain every actual ID, and the source files match the
finalized prior round. Preserve the raw footers and derive parent disposition
counts from the frozen seed and lane membership. A count mismatch alone neither
proves an omitted review nor establishes complete semantic coverage. Comparing
explicit ID sets avoids treating prose arithmetic as authoritative evidence.

### Proof-reuse publication still waits for heavyweight admission

The scanner prerequisite passed all 35 full-proof steps on commit 12cd15340d.
`bun run beep yeet publish --push-only --reuse-verified --pr` accepted the exact
clean-commit proof, then queued as full-proof(3) behind two merged-preview jobs
using all ten scheduler tokens. The first three minutes showed roughly 66–69 GiB
available memory; no current proof failure was observed. The durable publication
log is in `~/.cache/beep/boolean-creep/scanner-pr-20260909/publish-d68-reuse/`.
A measured admission class for install-preflight plus push/PR creation could
reduce this wait when full proof is already reusable. Preserve the current
scheduler policy while measuring; this queue observation does not justify
increasing capacity or interrupting other work.

### PR creation missed a branch that Yeet had just pushed

The scanner prerequisite reused its full proof and pushed commit 12cd15340d
to GitHub, then `gh pr create` failed with "you must first push the current
branch to a remote, or use the --head flag". The remote push itself succeeded;
this is a PR-creation context failure. Its terminal result and Yeet verdict are
preserved in `~/.cache/beep/boolean-creep/scanner-pr-20260909/publish-d68-pr-create-failure/`.
Verify the exact remote branch and absence of an existing PR, then use the
explicit repository and `--head` fallback with the reviewed body. Passing the
known pushed head explicitly in the canonical operator would avoid rediscovery
ambiguity in an isolated checkout.

### One-Boolean proposals recurred despite the current census net

R31 proposed six qualifications whose complete owners contain only one Boolean:
VaultChooseRow, HookPulseV1, AgentEffectivenessPhoenixSyncResult,
AgentEffectivenessPhoenixProject, inspectSymlinkPath and ConflictDerivation. Four additional raw
D1/D2 rows have the same entry-net problem. The parent rejected these occurrences
without a D1/D2 fallback; raw reports remain unchanged. VaultChooseRow and
PhoenixSyncResult were already rejected on the same source bytes in R30. Require
an explicit list of actual Boolean members on the whole owner before evaluating
payload-presence or enum correlations. Reusing the prior rejected-owner ledger
would prevent these repeated proposals without reducing source coverage.


## 2026-09-09 — CLI family retained obsolete membership and qualification instructions

During the current CLI-family audit, `designs/family-cli-mode-flags.md` claimed
seven live records but linked six, including four absent per-instance designs.
Only Runners and Tsconfig remained qualified in the frozen inventory. Tsconfig's
own design stated that all eight raw tuples are accepted, while its row still
claimed 8/3 by counting the resolver's three outputs. The documented precedence
predicates preserve combined requests, so the raw owner is D1.

The paired census correction and complete family replacement are recorded in
`data/post-r31-main-a203-parent-integration.json`; the full Tsconfig evidence is
in `data/pre-r32-current-cli-family-tsconfig-disposition.md`. Original family and
per-instance bytes remain in `history/designs/2026-09-09-post-r31-main-a203/`.
A family membership and link check alongside per-instance design coverage would
have exposed the stale cohort when its earlier members were withdrawn. Owner
cardinality review must count supported raw requests, including deliberate
priority and diagnostics, before comparing them with resolved operation modes.


## 2026-09-09 — Scanner prerequisite conflicted with its older branch-local configuration

Merging the landed scanner prerequisite produced a content conflict in
`.gitleaks.toml`: the campaign branch retained the older targeted top-level
allowlists, while PR #1059 installed portable per-rule entries. The resolution
compared all 46 rule/path/line combinations and the unchanged configuration
prefix, then used the exact verified main blob. No evidence allowance changed.
`data/post-r31-scanner-merged-source-forward.json` preserves the resolution and
confirms all 1,447 packet files survived byte for byte. Comparing both branch
sides of configuration paths before the merge would have exposed this expected
syntax conflict even though the uncommitted packet paths did not overlap main.


## 2026-09-09 — Directory-ending Git pathspec produced an empty source-change receipt

The main-284 source-forward check expected five added source files and one Root
edit, but its count assertion failed. The quoted patterns `packages/**/src` and
`apps/**/src` did not select their descendant files in `git diff`. Using explicit
`:(glob)packages/**/src/**` and `:(glob)apps/**/src/**` returned the six known changes.
The earlier main-a203 receipt's source list was corrected with those same globs,
and source equality was rechecked. Original receipt bytes remain in the private
source-forward bundle. A known changed-file count or positive-control path must
accompany a filtered diff before an empty result can support an equality claim.


## 2026-09-09 — Live plan counts lagged the installed inventory

While preparing the source-forward receipt, `PLAN.md` still described the live
inventory as 738 records / 146 qualified, although the canonical JSONL and
`data/post-r31-settled-validation.json` showed 751 / 145. README also retained
one later sentence claiming 146 current designs. The current summaries now agree
with the canonical inventory; historical round counts remain unchanged. Checking
every explicitly current count alongside the inventory and design validators
would have caught this partial documentation update before the prior commit.


## 2026-09-09 — New Graft command had no census partition

The read-only review snapshot failed in the frozen census pre-plan with
`AssertionError: ('packages/tooling/tool/cli/src/commands/Graft/index.ts', [])`.
The inherited command-area list predates Graft. The five new files need explicit
ownership in the D–K command lane; the existing exact-one-owner assertion caught
the gap before launch. Adding a source directory requires a partition check as
well as a source audit. The pre-plan also confirmed that the changed Handlebars
template is an included census input; all 61 historical non-TypeScript inputs
remain in scope. Its initial source-forward description was corrected, with
the original receipt preserved privately.


## 2026-09-09 — Template design contradicted the current escaping contract

The source-forward CreatePackage audit found that
`designs/create-package-template-type-flags.md` instructed the migration to retain
HTML escaping, while the actual TemplateService renderer compiles with
`noEscape: true`. The replacement design preserves unescaped interpolation and
full string payloads. Comparing each output-preservation claim with the real
renderer boundary would have caught the mismatch before a future implementation.


## 2026-09-09 — Advisory Effect reference moved during bounded source audit

The CheckCensus ending check observed movement in the separate advisory Effect
`SCHEMA.md` and `Schema.ts` inputs while protected repository and installed
dependency bytes remained stable. Both advisory snapshots are retained in the
private audit evidence. Earlier sealed audits keep their original bindings;
their results must be distinguished from a current advisory-reference check.
Formal review admission needs an immutable advisory snapshot as well as the
repository and installed dependency snapshots.


## 2026-09-09 — Transient observation pair was omitted without a scope rule

The CheckCensus audit proved all four observations for the local
`hasCheckOverlay` pair but initially omitted a D1 row because the values were
transient and no scanner row existed. Neither fact is a packet exclusion;
the excluded function parameters are a different surface. The frozen evidence
supports a small D1 supplement, with no qualification or design. Apply the
scanner net before the evidence gate, and require a binding rule for exclusions.


## 2026-09-09 — Completed predecessor skipped reconciliation checks in the controller

Preparing the R32 launcher exposed an asymmetry in the frozen private v7
controller: finalization bindings and unresolved-owner checks run only under
`if previous_verdict.get('complete') is not True`. The R31 launcher separately
checked its specific R30 predecessor, so no admitted round is shown to have
bypassed reconciliation. The next controller will check the predecessor for
both complete and source-invalid outcomes, before creating outputs or invoking
models. A completed receipt with unresolved questions must be a negative fixture.


## 2026-09-09 — Private-cache subprocess lacked the local user bus environment

The first local review-controller service fixture refused before dispatch with
`service-observation-failed`. Its exact `systemctl --user show` subprocess reported
that `DBUS_SESSION_BUS_ADDRESS` and `XDG_RUNTIME_DIR` were not defined. Repository
shell commands could reach the manager, but the private-cache Python process did
not inherit those variables. The supervisor now verifies the current user's
runtime directory and bus socket ownership and supplies only those local bus
coordinates to manager commands. No model or service started in the failed
attempt. Service fixtures must run from the same private execution directory as
the controller, rather than relying on the repository shell environment.


## 2026-09-09 — Failed remote precheck did not stop its orchestration batch

During the main-forward update, the precheck reported that live main had moved,
but its tool result was not checked before the following merge command ran. The
authorized merge therefore included the previously fetched main `8d507287b7`,
rather than the newest main. That merge was clean; a fresh fetch and an explicitly
conditional precheck then brought in `0c975f970b`, whose additional changes are
documentation only. No census or review launched against the stale reference.
Dependent mutations must branch on the preceding command's exit code; awaiting
two tool calls in order does not make the first failure abort the second.


## 2026-09-09 — Save PR proof includes pre-existing scratchpad documentation debt

The requested pause/save publication passed the frozen HEAD install, all 13
cheap gates and 21 pre-push lanes before `quality:jsdoc-ratchet` failed. The
fresh inventory attributes all six regression increases to the four pre-existing
`scratchpad/yeet-effect/` prototypes; package and app source match main. Nine
later lanes were not run. The earlier committed-inventory ratchet passed because
it did not incorporate those new exports. A fresh scoped metadata check before
the full publication run would have exposed this debt without the five-minute
inventory wait. The [proof receipt](../data/pause-publication-proof.json) records
the exact tested head and counts. The user requested preservation and pause;
the prototypes remain unchanged and the draft discloses the unresolved failure.


## 2026-09-09 — Draft readiness exposed a package-subpath false positive

PR #1069's `Heavy / Lint Policy` failed at `knowledge:semantic-delta` with one
introduced `broken-tracked-path`: the menus design quoted a relative package
export key, which the checker interpreted relative to the design document.
Writing the full `@beep/editor/chat/atoms` package subpath makes the reference
unambiguous. Original design bytes are archived and the correction receipt
records both hashes. The other 491 findings were unchanged baseline findings;
they are outside this repair. Package-export keys need a distinct parser context
or explicit alias form in prose to avoid this ambiguity.

## 2026-09-09 — Greptile declined the saved evidence packet on file count

PR #1069 has 1,434 changed files. Greptile returned `500 file limit` without a
review, while the checked-in `greptile.json` already specifies 1,200. Most of the
packet is retained census and correction evidence, and the campaign remains
paused. This is a missing review, not a zero-finding result. Readiness work must
obtain an actual review or report the remaining provider limitation; it must not
claim that an unavailable reviewer approved the packet.


## 2026-09-09 — Executable-looking scratchpad saves lacked their domain module

The JSDoc repair exposed that the four saved Yeet port prototypes are incomplete:
HookKernel and InboxState import a Domain module absent from the checkout, while
WatcherKernel duplicates Processes. No indexed source imports the folder. The
readiness pass preserves every original byte as text drafts with a hash manifest,
rather than completing an unrelated port inside the campaign save PR. Saving
unfinished sketches with an explicit draft format and dependency manifest would
have prevented the mismatch between executable filenames and incomplete content.


## 2026-09-09 — Semantic delta validates committed archives, not dirty edits

The focused `knowledge semantic-delta` rerun still reported the original menu
subpath after its working-tree edit. The command compares merge-base and HEAD
archives, so that was the expected result for the unchanged committed head.
Commit the reviewed correction before using this command as acceptance evidence;
a dirty-file preview mode or an explicit HEAD-only notice would shorten this loop.

## 2026-09-10 — Post-merge hook ran before Effect dependencies were refreshed

After PR #1060 landed, merging `origin/main` into the saved draft succeeded,
but its version-sync hook failed with `Export named 'ByteSize' not found`.
The merged source requires Effect `4.0.0-rc.113`, while the installed dependency
tree still held the previous version. `bun install --frozen-lockfile` succeeded
and installed the committed upgrade. Dependency-aware hook ordering, or a clear
install-required result when the lockfile changes, would avoid this transient
failure. Rerunning `bun run beep version-sync --skip-network` after installation
passed with no drift; full integration verification follows separately.

## 2026-09-10 — Workstation restart interrupted the integration proof

The first integration publish committed its note, then its proof ended with
`All fibers interrupted without error` and exit 130. The workstation's new boot
time falls after that run started, and the original process no longer exists.
This is an environmental interruption with no completed proof, so publication
must wait for a fresh full run. The clean commit and captured log survived;
durable process ownership and a resumable proof receipt would reduce recovery
work after restarts.

## 2026-09-10 — Coverage prebuild hit a locationless compiler failure

The integration proof passed 30 of 31 pre-push lanes, then coverage's preparatory
build stopped with `@beep/box:build: error TS2589` and no source location.
The package is unchanged from `origin/main`. A fresh standalone build passed
all eight tasks and compiled all 111 Box files without source changes, matching
the known locationless compiler flake. Coverage retries moved past Box and
then reported the same locationless error in UI and XAI, both also unchanged
from main. Forced standalone builds passed;
XAI also passed with a new TypeScript build-info file. The full coverage lane
and full proof still need successful reruns; isolated builds do not replace them.

The outer Yeet packet incorrectly suggested a security-audit repair even though
the lane verdict identified coverage. Preserve the innermost failed command and
diagnostic in failure packets so recovery starts at the actual failure.

## 2026-09-10 — Local coverage runtime differed from the hosted lane

After all 135 prebuild tasks passed, nine coverage shards passed and ACP's
seeded JSON-RPC property failed in the remaining shard. Seed `20260708` exposed
an escaped extension key changing from NUL to backslash. The same failure
reproduced with native JSON parsing outside ACP and Vitest on Node 24.16,
24.19 and 24.20; Bun and Node 22.22.3 passed the same seeded case.

This matches the upstream V8 key-cache defect tracked in
[nodejs/node#63785](https://github.com/nodejs/node/issues/63785).
The imported `main` already pins hosted coverage to Node 22.22.3 in
`.github/workflows/heavy.yml`; the local shell selected Node 24.20.0.
The temporary test diagnostics were removed. Prepend the installed Node
22.22.3 `bin` directory to `PATH` for the local proof to match hosted coverage;
`mise exec` alone still let Bun resolve the shell's Node 24.20.0 here. The
protocol assertion and generated schemas remain unchanged. All 12 protocol
tests then passed with seed `20260708` on Node 22.22.3. Full proof is still
required.

Local coverage should announce and validate its Node runtime against the
hosted lane before starting its full prebuild and test fan-out. Reading that
existing pin first would have avoided rediscovering an already documented
runtime defect during this recovery.
