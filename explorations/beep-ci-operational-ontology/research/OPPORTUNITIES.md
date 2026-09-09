# Research friction receipts

## 2026-09-03: admission eviction facts replace inferred deaths
- V2 now journals claimed lease evictions and CI-ops folds them as releases; the next ontology run consumes the fact instead of inferring it.

## 2026-08-27: Firecrawl CLI lacks the research subcommand

- **Work:** finding and verifying the papers for the R3 scheduling-formalisms lane through the
  repository's required research-index workflow.
- **Evidence:** `firecrawl research search-papers ...` exited 1 with `unknown command 'research'`
  and suggested the unrelated `search` command.
- **Cost:** the lane had to use primary-source web search and inspect papers individually rather
  than use semantic paper search and citation-graph expansion.
- **Prevention:** install a Firecrawl CLI version that provides the documented `research
  search-papers`, `related-papers`, `inspect-paper`, and `read-paper` commands, or make the skill
  detect the installed CLI capabilities and name the supported paper-retrieval fallback.

## 2026-08-29: auditor engine churn during the §4b normalization run

- **Work:** running the `ontology-foundational-auditor` skill over the S4 harvest in a dedicated
  worktree while the skill itself was being hardened in a parallel session.
- **Evidence:** the archived run manifest (`ontology/extraction/s4/beep-ci-ops/runs/`) records five
  mid-run engine re-locks (validator `c8229fc304bd` → `039564222bd0` → `982650ee041d` →
  `04b06d94567a` → `6aec64cde23f`; contracts `ee9e30584f63` → `fd8cb801a7b3` → `e1338e75966c`)
  and, before the final freeze, the canonical Claude skill installation was emptied by that
  restructuring session; the run finished on the Codex skills-mirror snapshot of the engine.
- **Cost:** every re-lock re-verified the whole tree (1,097 observations, 692 hypotheses, later
  235 reviews) before the next stage could start, and the repository-shipped skill (vendored by
  PR #880 at validator `c036e5316511`) no longer reproduces the pinned digests, so the judging
  engine had to be vendored post hoc as `runs/history/<run-id>.engine/`.
- **Prevention:** vendor the engine snapshot (validator, `_shared` contracts closure, prompts,
  templates) into the packet at run START and point every seat at that snapshot; treat the
  skills checkout as frozen for the run's duration (branch or tag it); have the validator print
  the digests it will demand at run start so a drift is caught before seats spend tokens.

## 2026-08-29: proposal revisions overwrote the bytes earlier review rounds bound

- **Work:** the adversary → revision → re-review loop of the same run (five rounds).
- **Evidence:** each `*.review.yaml` round binds a `target_sha256` of the proposal bytes it judged,
  but revisions rewrote `work/proposals/otp-*.yaml` in place while `work/` was untracked, so only
  the latest round's target and chain digests are reconstructible from the committed tree.
- **Cost:** earlier FAIL rounds and the `revision_log` entries that answer them are recorded
  history rather than independently re-verifiable bindings; an auditor can replay the ratified
  (latest) round only.
- **Prevention:** the skill should retain every reviewed proposal revision under a
  content-addressed path (for example `work/proposals/history/<sha256>.yaml`) and the validator
  should verify each round's `target_sha256` against it; commit `work/` at every round boundary
  so git history keeps the bytes even before the skill does.

## 2026-08-30: an unrelated format sweep rewrote digest-locked run evidence

- **Work:** starting the S5 stint on fresh main after the §4b packet merged (PR #889).
- **Evidence:** PR #865 (court-reporter vocabulary) carried a repo-wide Biome write sweep that
  reformatted `ontology/extraction/s4/beep-ci-ops/adapters/adapter-typescript.ts` (line joins,
  interface key sorting) and `adapters/golden/typescript/input.ts` without touching the
  `adapter-typescript.ts.sha256` sidecar — on main the frozen adapter failed its own engine
  check (tree sha `ee276c25…` vs sidecar `fc6dec09…`).
- **Cost:** the committed copy of the run's engine diverged from the archived manifest and the
  pin; anyone replaying the adapter got a hard verify_engine refusal until the bytes were
  restored from the retention tag lineage.
- **Prevention:** Biome `files.includes` now excludes the packet's `adapters/` and `runs/`
  trees (this change); frozen evidence must always ship with a formatter exemption in the same
  PR that freezes it, since a digest lock can only detect corruption, not stop a write sweep.

## 2026-09-02: the #902 adapter sandbox fails closed on any busy desktop session

- **Work:** auditor run-2 launch — smoke-testing the new
  `run_adapter_sandbox.sh` (PR #902) before building adapter v1.1.0 against it.
- **Evidence:** every invocation died with `bwrap: Creating new namespace failed:
  Resource temporarily unavailable` while bare `bwrap --unshare-all` succeeded.
  Bisecting the runner's five prlimit bounds isolated `--nproc=64`: RLIMIT_NPROC
  is charged against the invoking UID's host-wide task count (about 10,800 tasks
  on a loaded desktop), so wrapping bwrap in `prlimit --nproc=64` can never
  clone. The runner had only ever been exercised where the UID ran few tasks.
- **Cost:** the fail-closed design blocked the entire observe stage; roughly an
  hour of diagnosis before any run-2 adapter work could start.
- **Prevention:** apply resource limits INSIDE the sandbox's fresh user
  namespace (the fix: `resource_limits` array wrapping the adapter command,
  `exec bwrap` directly), where the per-user task count restarts at the
  sandbox's own processes; and smoke-test any fail-closed sandbox wrapper on a
  session at realistic load before shipping it, since per-UID rlimits are
  environment-dependent in a way per-process limits are not.

## 2026-09-03: yeet cannot plan archival-scale packet branches

- **Work:** publishing the auditor run-2 close (PR #957) through
  `bun run beep yeet publish --start-pr-early`.
- **Evidence:** the plan stage died with `git diff --name-only -z <base>..HEAD
  output exceeded the repo-run capture limit.` — `repoRunOutputBound.maxChars`
  is 512 KiB, and this branch's changed-path list (fleet corpus plus the
  run-1 archive relocations, roughly five thousand paths) exceeds it.
- **Cost:** the canonical publish path is unusable for exactly the class of PR
  this packet produces every run (run 1's #889 at three thousand files slid
  under the same bound); fell back to manual `gh pr create` plus
  `yeet monitor`, the #889 precedent.
- **Prevention:** stream or chunk the changed-path enumeration in the yeet
  planner instead of a single bounded capture (or raise the bound for
  `--name-only -z` specifically, whose output is inherently proportional to
  repo churn, not misbehavior).

## 2026-09-03: fleet-corpus host-path scan missed the system temp root

- **Work:** repairing PR #957 after its hosted Lint Policy lane rejected the
  pinned run-2 fleet corpus.
- **Evidence:** `bun run beep knowledge refs --check` found three live
  system-temp lock-path observations in captured verdicts even though `MANIFEST.yaml`
  recorded `host_path_scan: PASS`. The generator derived its replacement prefix
  from the session temp root under the portable home convention, while its byte
  scan rejected operator-home paths only, so system-temp strings escaped both
  controls.
- **Cost:** Lint Policy failed after the ontology run had closed, and the repair
  had to re-redact 20 raw payloads, regenerate two affected scalar projections,
  and rebuild the digest manifest rather than changing the three surfaced
  verdicts alone.
- **Prevention:** redact the explicit system temporary-directory prefix and
  make the corpus byte scan fail on both operator-home and system-temp anchors;
  keep a regression case where the process temp root differs from the system
  temp root.

## 2026-09-03: local jsdoc lane cannot see hosted-only ratchet reds

- **Work:** clearing the JSDoc Ratchet red that main inherited alongside the
  run-3 design PR (#981), fixed in PR #985.
- **Evidence:** the hosted `ci:jsdoc-ratchet` job regenerates the documentation
  inventory (~8 min) before ratcheting against
  `standards/jsdoc-totals.regression-baseline.jsonc`, while the local
  cheap-gates jsdoc lane only validates the already-committed inventory. A
  doctest in `packages/foundation/modeling/md/src/Md.safe.ts` importing the
  `@beep/schema` package root shipped green through every local gate and full
  local proof, then turned main red hosted-only (`no-root-package-import`
  3771 > 3770). Hosted inventory caching made the red flip-flop across PR
  heads, which delayed attribution.
- **Cost:** a main-wide required-check red inherited by every open PR, one
  dedicated remediation PR (#985), and a diagnosis pass that first had to rule
  out the flake classes because the local lane could not reproduce the failure.
- **Prevention:** teach the local cheap-gates jsdoc lane (or a `--regenerate`
  opt-in on the local checker) to regenerate the inventory for files touched by
  the diff, so a doctest root-import surfaces before push instead of
  hosted-only; alternatively have the hosted lane bypass its inventory cache
  when the ratchet counter moves.

## 2026-09-08: Stage A brief predates journal retention and recovery changes

- **Work:** re-deriving source citations before implementing the run-3 corpus generators.
- **Evidence:** `AttemptJournal.ts` now lives under `commands/Yeet/internal/`;
  `AdmissionJournal.ts` retains 200 admitted transitions, not 200 total rows;
  `QualityScheduler.ts` now persists reap claims and acknowledges both journal sinks.
  The brief's old line numbers and claim-race description no longer describe the
  current implementation exactly.
- **Cost:** the capture needs source-qualified loss receipts rather than copying
  the design brief's historical claims as current facts.
- **Prevention:** bind a capture brief to a source commit and distinguish nominal
  row limits from the writer's actual retention unit. Preserve historical loss
  classes with an explicit current-source assessment.

## 2026-09-08: managed Stage A lane cannot write the default uv cache

- **Work:** first offline runs of both Stage A corpus generators.
- **Evidence:** `uv run --offline --with pyyaml python <generator>` failed before
  Python started: `Could not acquire lock`, `Read-only file system` in
  `~/.cache/uv`.
- **Prevention:** provide a writable lane-local uv cache populated from the
  installed cache when launching a managed implementation lane. Keep the
  original cache unchanged and dependencies offline.

## 2026-09-08: fleet inventory includes registered worktrees outside fleetRoot

- **Work:** binding every row returned by `bun run beep worktree fleet --json`.
- **Evidence:** the command returned seven linked worktrees outside the fleet
  directory, including Codex-managed worktrees and a legacy system-temp checkout.
  The required filesystem globs for run artifacts do not reach these rows.
- **Prevention:** document the distinction between same-origin registered
  worktree discovery and filesystem-glob discovery. Keep the external rows with
  portable capture-local labels, and report absent cross-corpus joins explicitly.

## 2026-09-08: Stage A commit blocked by read-only worktree Git metadata

- **Work:** staging the first Stage A generator by explicit path for the requested
  local commit on `ontology-run3-stage-a`.
- **Evidence:** `git add -- <corpus>/etl_run3_fleet_corpus.py` exited 128:
  `Unable to create .../index.lock: Read-only file system`. The worktree's Git
  metadata is outside this managed session's writable roots.
- **Cost:** the lane can write and verify both corpus pins but cannot stage or
  commit them. HEAD-only knowledge checks cannot cover the new untracked files.
- **Prevention:** launch the implementation lane with verified write access to
  its worktree Git metadata when a local commit is a required deliverable.
  Finish the local commit from that authorized lane; do not bypass the boundary.

## 2026-09-08: preview checkout names carry process identity outside JSON members

- **Work:** final privacy review of the checkout-identity pin.
- **Evidence:** `commands/Yeet/internal/MergedPreview.ts` constructs its directory
  name from `process.pid`. Dropping JSON process members and scanning only the
  literal `pid` prefix does not remove that directory-name identifier.
- **Prevention:** alias preview process-directory names consistently across the
  snapshot, binding keys, and Git-directory linkage. Add a residue rejection and
  a fixture with two similarly prefixed identifiers to prevent alias collisions.

## 2026-09-08: pre-commit Biome reformatted pinned corpus payloads

- **Work:** committing the run-3 Stage A pins (`run3-fleet/`, `run3-checkout-identity/`).
- **Evidence:** the lefthook `biome` pre-commit hook (`biome check --write … {staged_files}`,
  `stage_fixed: true`) rewrote 37 staged JSON payloads inside the pins, so the very next
  verify-mode run of both generators failed with
  `SHA-256 or byte-count mismatch: verdicts/…/verdict.json`. The run-2 pin never hit this
  only because its payloads happened to already match Biome's output.
- **Cost:** a discarded commit, a second full capture of both corpora (new salt, new
  instants), and an amend before the PR could open.
- **Prevention:** applied — the pin directories are now excluded in `biome.jsonc`
  `files.includes` beside the existing `adapters` and `runs` exclusions. Generators that
  pin fidelity bytes should register their output directory there in the same PR that
  creates it, and a verify-mode rerun belongs between commit and push.

## 2026-09-08: nested ignored directories swallowed Stage A payloads

- **Work:** verifying the PR #1027 checkout-identity pin against the committed tree.
- **Evidence:** its manifest lists 220 payloads, but `git ls-files` contains only
  190 payloads plus the manifest. All 30 omissions use nested `.claude/` or
  `.beep/` label segments; staging the pin directory silently skipped them.
- **Cost:** working-tree verification passed while a fresh checkout lacked files
  required by the manifest. The capture must be replaced after fixing path emission.
- **Prevention:** encode checkout labels into single output path components in
  both generators, compare tracked inventories with manifests, and run ordinary
  verification from a detached worktree of the actual committed HEAD.

## 2026-09-08: detached verification hits mise directory trust before Python

- **Work:** running both corpus verifiers in the disposable committed-HEAD worktree.
- **Evidence:** the `uv` shim exited before starting Python because the new
  worktree's `mise.toml` was `not trusted`. The committed corpus had not been read.
- **Prevention:** resolve the existing offline Python environment in the trusted
  lane first, then use its interpreter for the detached-worktree verification
  while the owning `uv` process remains alive (its temporary environment is removed
  when that process exits).
  A committed-byte check needs no new tool installation or machine trust change.

## 2026-09-08: `scheduler reap` describes a dry-run it cannot run

- **Work:** draining six `pending-protocol-off` reap claims after publishing the
  protocol v2 marker (Stage B grill, Ruling 20).
- **Evidence:** `bun run beep quality scheduler reap` prints a description that
  says "dry-run by default" and a flag help text of "default: dry-run report",
  then exits 1 with `Missing required flag: --apply`. Only the mutating form runs.
- **Cost:** one failed invocation and a blind apply; the operator could not
  preview which dead leases and tickets would replay into eviction rows before
  mutating the machine-wide admission root.
- **Prevention:** give the boolean flag an explicit `false` default so the
  dry-run report is the real default, or drop the dry-run wording from both
  descriptions; a regression test invoking the command without the flag would
  have caught the drift (`reapAdmissionState({ apply: false })` already exists).

## 2026-09-08: Stage B checkout had graft wiring without its graph

- **Work:** retrieving the required generator and scheduler context before implementation.
- **Evidence:** `graft map` exited 1 with `no graph — run graft build first`.
- **Prevention:** provision the regenerable graph with a newly prepared lane, or
  check its presence in the lane handoff. Rebuilt locally before code retrieval.

## 2026-09-08: Stage B synthetic checkout labels omitted the withdrawn contender

- **Work:** matching the Stage B consumer to the PR-1 producer before the live pin.
- **Evidence:** the producer's `checkoutB` is a separate `contender-b` root and its
  expected chain is enqueued then withdrawn. The consumer brief names only the
  three checkouts with exported attempt directories.
- **Prevention:** distinguish checkout roots observed in journal rows from
  exported attempt directories in the handoff contract. The consumer preserves
  a fourth `contender-b` token without inventing an attempt directory.

## 2026-09-08: packet validation requires more than the generator's Python environment

- **Work:** running the packet validator after Stage B implementation.
- **Evidence:** the generator's PyYAML-only environment exited with
  `ModuleNotFoundError: No module named 'rdflib'` before validation started.
- **Prevention:** document the packet validator's dependency set separately from
  the standalone generators. Retried with its declared script dependencies.

## 2026-09-08: copied manifest inventory exemption was broader than one file

- **Work:** checking Stage B's whole-tree verifier before committing its first capture.
- **Evidence:** the copied inventory predicate excluded every file named
  `MANIFEST.yaml`, so an unlisted nested manifest could evade the file-set check.
- **Prevention:** exempt only the root manifest's exact path. Added a regression
  for an extra nested manifest. The Stage B generator changes and its fleet pin
  is refreshed after tests; the frozen generators remain untouched.

## 2026-09-08: a negative credential fixture tripped the commit scanner

- **Work:** committing the Stage B generator, tests, and pins.
- **Evidence:** pre-commit gitleaks rejected `test_run3b_generator.py` under
  `generic-api-key`; the match was the invented assignment in a residue-rejection
  test, not captured machine material.
- **Prevention:** construct the negative assignment at test runtime. The scanner
  remains enabled; the generator and pinned payloads do not change.

## 2026-09-09: Stage B process-identity detection drifted behind deployed writers

- **Work:** addressing the held PR #1034 redaction review in the Stage B follow-up.
- **Evidence:** the name list missed `runScope.attachedPid` in `RunScope.schemas.ts`
  and `ownerProcStart` in `AttemptJournal.ts` / `AttemptTerminationJournal.ts`.
  The merged Stage B pin retained those members; the frozen Stage A pin needs a
  separate steward ruling.
- **Prevention:** use one normalized member rule for redaction, projections, and
  residue checks, plus a regression that extracts deployed `Pid` / `ProcStart`
  schema fields and asserts that each is covered.

## 2026-09-09: review-fix lane context and remote probes required fallbacks

- **Work:** checking the follow-up lane before editing the Stage B generator.
- **Evidence:** `graft map` returned `no graph — run graft build first`; the SSH
  remote probe returned `Bad owner or permissions` for the system SSH proxy config.
- **Prevention:** provision the graph when preparing a lane and validate the SSH
  configuration separately. A scoped deterministic graph build restores source
  retrieval; the read-only GitHub API confirmed the same main commit as local
  `origin/main`, without changing SSH configuration.

## 2026-09-09: Stage B fleet-root inference missed sibling worktree placement

- **Work:** refreshing the fleet pin from the follow-up worktree after PR #1034.
- **Evidence:** `FLEET_ROOT = REPO_ROOT.parent` selected the `beep-effect8-worktrees/`
  directory, producing zero discovered checkouts and only 16 admission/live payloads.
  That temporary capture is replaced before handoff.
- **Prevention:** recognize the repository's sibling `*-worktrees/<lane>` layout
  when resolving the fleet root, test it beside the direct-clone layout, and
  inspect the refreshed checkout census before accepting a capture.

## 2026-09-09: a refresh overlapped the first Stage B corruption proof

- **Work:** proving both refreshed pins after replacing the incomplete fleet capture.
- **Evidence:** a second fleet refresh started before the first corruption-check
  process exited. Its verification crossed the atomic tree replacement and
  reported `SHA-256 or byte-count mismatch` against the previous manifest.
- **Prevention:** wait for process completion before any pin mutation. Discard
  the overlapped proof and rerun all ordinary, corruption, restoration, and
  whole-tree checks serially after the final refresh exits.

## 2026-09-09: Stage A residue checks also match the required lineage explanation

- **Work:** implementing Ruling 22's generator lineage and literal residue proof.
- **Evidence:** the mandated lineage reason names `ownerProcStart`, `ownerPid`,
  and `attachedPid`; the required recursive grep matches those benign prose values.
  Existing pin-corruption tests also mutate the protected identity pin in place.
- **Prevention:** preserve the exact decoded lineage reason with YAML Unicode
  escapes for its named fields, and test both its decoded value and the literal
  grep. JSON member scanning still decodes escaped keys before applying the rule.
  Exercise corruption on disposable copies so protected pins remain read-only.

## 2026-09-09: the normalized pid suffix also matches execution step identifiers

- **Work:** comparing the Stage A refresh census with its failure-signature rider.
- **Evidence:** the copied process-member rule normalizes `failedStepId` to
  `failedstepid` and `stepId` to `stepid`; both end in `pid`. The first refresh
  retained only 36 failure-signature occurrences because it removed execution
  join fields. Its built-in verification passed under the same predicate.
- **Prevention:** cite deployed non-process fields in the explicit allowlist,
  assert that their decoded keys and property projections survive, and compare
  rider evidence before accepting a refreshed pin. Replace this capture before
  handoff; the protected Stage B generator and pins remain outside this lane.

## 2026-09-09: Stage A's legacy UID scan was narrower than Stage B's scan

- **Work:** running the independent host/process residue scan after built-in verify.
- **Evidence:** the broad `uid-[0-9]+` scan matched 30 files and 315 JSON message
  leaves. Stage A only rewrote and rejected the `beep-admit-uid-` spelling.
- **Prevention:** copy Stage B's complete string redactor and residue scanner,
  including generic UID and process-bearing state/preview filenames, and retain
  the independent scan as an acceptance check. Discard this interim pin and
  refresh with a new salt after the regression passes.

## 2026-09-09: parallel residue fixes collided at the same pins

- **Work:** reconciling the run-3 residue follow-up with security PR #1032.
- **Evidence:** merging main produced conflicts in both amended fleet generators,
  three refreshed manifests, Stage B attempt payloads, the shared tests, and packet
  bookkeeping. #1032 repaired old captures in place while the two residue lanes
  refreshed the same pin families under stronger member and path rules.
- **Cost:** both redaction changes and test suites require an explicit union,
  followed by three fresh captures and complete integrity and provenance proof.
- **Prevention:** assign one owner per pin family per day, or add a repository-level
  residue gate that runs the built-in corpus scanners in CI before publication.
- **Environment:** SSH fetch failed with `Bad owner or permissions` for the system
  SSH proxy configuration. A command-scoped HTTPS fetch succeeded without changing
  SSH configuration or repository remotes.

## 2026-09-09: the combined residue rules rejected custody metadata and stale lineage

- **Work:** running both inherited committed repair-history regressions after the merge.
- **Evidence:** both failed with `residue scan failed: free-text process identifier`:
  the widened pattern interpreted a YAML custody `pid` count as identity text.
  After relabeling that census bucket `pid_pair`, Stage A failed with
  `generator lineage differs: generator_lineage`; the repair retained the old
  amended digest and serialized the leading lineage block twice.
- **Fix:** retain custody precedence and arithmetic with an unambiguous count label;
  validate source lineage and emit one updated lineage block during security repair.
  Both committed-history regressions now pass, including source replay and
  unchanged original security receipts. Fixture repositories live under ignored
  `.beep/corpus-test-repos/` so tests remain inside the authorized worktree.
- **Prevention:** run the full union of capture and historical repair regressions
  whenever a redaction pattern or manifest schema changes.

## 2026-09-09: reconciliation inherited an incomplete file-URI replay

- **Work:** landing the file-URI boundary fix before merging security PR #1037.
- **Evidence:** the initial Stage A manifest diff changed its generator digest and
  added a zero-payload `CSF-012` repair receipt for the URI-only change. Step 0 of
  `research/run3-lanes/reconcile-1037-brief.md` forbids pin repair or refresh. The
  diff was preserved in the lane's ignored receipt directory and the committed
  manifest restored; all three refreshes follow the merge.
- **Prevention:** keep incomplete replay output separate from the code-and-test
  handoff and require the finding-attribution check before changing a manifest.
- **Context gap:** the requested Ruling 23 is absent from the starting worktree
  (ends at 22) and fetched main at `22063e7b6d` (ends at 21). The lane requested
  the missing text and does not author a ruling.
- **Environment:** SSH fetch failed on system proxy-configuration permissions;
  a command-scoped HTTPS fetch succeeded without changing persistent settings.

## 2026-09-09: CSF-013 rules collide with refreshed custody and lineage

- **Work:** combining the #1037 scanner and tests with the refreshed generators.
- **Evidence:** the first merged suite retained all 63 tests but failed on
  `schema process metadata`: the YAML custody count label `attachedpid:`
  matched the new text rule. A security regression also supplied duplicate
  normalized members during unsalted replay, where all such keys are removed.
- **Repair:** rename only the census bucket to `attached_identity`; preserve
  the scanner and salted capture's ambiguous-identity rejection.
- **Boundary:** taking the security repair script exactly from main discards
  this branch's Stage A lineage validation/re-encoding fix. A separate proposed
  patch is prepared for the operator because the brief assigns that subtree
  to main while also requiring the lineage regression to survive.
- **Prevention:** include the refreshed manifest format in security repair
  compatibility tests and separate process metadata names from count labels.
