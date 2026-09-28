# Friction receipts

## 2026-09-08: Versioned CLI flag drift

During P0a launch preparation, grok --help for installed 1.0.13 omitted the
contract's --no-auto-update option. The flag was omitted rather than changing
search permissions. Future launch contracts should include a help/version
preflight and identify optional flags separately from required behavior.

## 2026-09-08: Dated checkout anchors

The contract's original source HEAD and clean-tree claim had aged. The source
branch is still @slop/09-02-26 but now at bf6014ae31 with an unrelated untracked
exploration. The managed worktree command isolated this goal at the live HEAD.
Keep dated census counts and checkout state separate from normative acceptance.

## 2026-09-08: Incidental connector startup failures

Codex census startup reported an unrelated Notion OAuth invalid_grant, and one
Grok research lane's Firecrawl scrape returned Unauthorized: Invalid token.
The census continued locally; Grok continued through its web-fetch tools and
installed sources. These paths do not require 1Password. No credentials were
read or changed. A minimal research profile would avoid unrelated connector
startup work and make failures easier to attribute.

## 2026-09-08: Census scanner limitations

The packages lane could run standalone rg discovery but spawning rg from a Node
child process failed under its workspace-write sandbox. It used a bounded
filesystem walk after discovery. The apps/infra lane found a truncated curried
wrapper body in its first scanner pass and is correcting that parser before
handoff. Preserve scanner limitations in every candidate class; text proximity
must not be presented as syntax proof.

## 2026-09-08: Census handoff correction

Orchestrator review found nested fixture manifests being used as workspace
owners, incompatible scope kind labels, and a historical 945-file comparison
that incorrectly treated the apps-plus-packages total as packages alone. The
original census sessions were resumed with exact correction requirements.
Require a shared encoded scope contract and workspace-root ownership before
parallel census dispatch. Count support modules separately; filter non-wrapper
class aggregates to test files so historical comparisons remain meaningful.

## 2026-09-08: Self-reported model label disagreed with runtime

The P0c report initially claimed GPT-5/high despite explicit Daybreak/medium
launch arguments. Sanitized turn_context metadata confirms the requested model
and effort were used. Runtime metadata is authoritative; self-description is
not provenance evidence. Capture model/effort from the runtime in lane receipts.

## 2026-09-08: Review steering for a headless lane

The initial P0c implementation missed common import/callback forms, and one
negative fixture treated logging alone as a reason for it.live. The orchestrator
recorded concrete source/fixture corrections, gracefully interrupted its own
headless lane, and resumed the same session with the review. The permitted
xhigh escalation is justified in the lane report. Headless dispatch should
include a durable review-inbox checkpoint before fixtures become acceptance.

## 2026-09-08: Green fixture pairs did not cover import and clock semantics

After the lane reported its focused suite and direct check green, 15 additional
read-only probes found four defects: root namespace Effect was missed, a
hoisted local function was mistaken for the imported Effect, a live-clock sleep
was classified as a TestClock hang, and a known Context was treated as an
unresolved Layer. The before/after source hash maps matched. Keep provenance,
lexical-scope and runtime-mode cases in the detector fixture matrix, rather
than relying on one positive/negative pair per rule.

## 2026-09-08 — Lane observation outlived its process

While resuming P0c acceptance, the terminal returned `Unknown process id` and
the cached status still said running. A live process check confirmed that both
the recorded lane and its supervisor were absent; the JSONL ended without a
turn-completion receipt. Its exit code is unknown. The unchanged 15-case probe
now has 13 passes and two failures, so no successful handoff was inferred.
Preserve the raw stream and resume the same session; use a detached supervisor
with durable status updates to avoid tying source work to an observation handle.

## 2026-09-08 — New lint command bypassed by entrypoint routing

While checking P0c with `bun run beep lint effect-vitest --census --write --rows`,
the CLI ran aggregate quality lint and forwarded the new subcommand to Turbo.
The command-tree registration was present, but `internal/cli/LintRouting.ts`
omitted the new name. The diagnostic was deliberately interrupted after proof.
A registration checklist and an executable routing regression would have caught
this before expensive scan attempts. Add the required existing-table entry.

## 2026-09-08 — Row refresh retained removed findings

A cache-only probe wrote one package's detector row, then exported an empty set.
The old JSONL still held the removed finding. The writer only visits current
owners. A two-export persistence fixture would have caught this stale inventory
case; replace owned outputs without disturbing unrelated files.

## 2026-09-08 — Cleanup fixture omitted unrelated JSONL

The stale-row fix passed with an unrelated text sentinel, but a stronger
cache-only probe showed it deletes an unrelated JSONL record during export.
The cleanup selected every `.jsonl` file, without proving generator ownership.
Cover same-extension files from other producers and require ownership evidence
before deletion. The probe did not touch repository inventory files.

## 2026-09-08 — Negated pattern expanded the full scan

The detector's real discovery returned 62,152 paths, while a D9 path probe found
1,048. `FsUtils.globFiles` combines include patterns as alternatives; passing a
negated node_modules pattern in that list included unrelated files. Deriving
positive patterns and `ignore` options from the existing schema definition
returned exactly 1,048 paths in about 39 ms. A real-discovery fixture and phase
timings would have separated this caller error from AST and persistence costs
before repeated long canonical-command attempts.

## 2026-09-08 — Structural equality over compiler nodes

The syntax scanner used Effect array membership over ts-morph nodes. The lane
traced major AST cost to structural equality traversing foreign compiler-node
graphs; explicit node identity reduced its worst-file diagnostic to about
178 ms. Use the Effect collection helper with an explicit identity predicate
when the question is whether two references denote the same compiler node.
A framework helper's default equality is not automatically the intended relation.

## 2026-09-08 — Runtime alias drift during package verification

The first orchestrator `bun run beep quality package-verify @beep/repo-cli`
resolved Bun 1.4.2 through the workstation's `latest` alias. The package manager
field and `.bun-version` still pin 1.4.1, which was the runtime observed at P0a.
Live process executable paths establish the mismatch. Preserve the first run's
result, then select the installed pinned binary through a command-scoped PATH
for authoritative acceptance. Capture runtime provenance at launch so a mutable
alias cannot silently change the environment of a long-running packet.

## 2026-09-08 — Literal support census includes generated declarations

The full repo-cli package build added 24 `dist/test/*.d.ts` support matches to
the earlier 1,048-path census. D9's `**/test/**/*.ts` pattern includes generated
declarations; the upstream build had already added two schema declarations.
The final 1,072 paths reconcile exactly, and the 5,012 finding records are
unchanged. Regenerate the authoritative census after required builds and retain
the build-state explanation. Do not silently narrow a user-owned scope glob to
make a historical file count hold.

## 2026-09-08 — Pinned source fixture treated as repository code

P0d copied upstream index.ts and utils.ts with byte-identical hash proof. A
read-only Biome check then reported six errors because the package audits every
TypeScript file under test/, including these source-data fixtures. Preserve the
upstream bytes under a text-data extension and map them to original tag paths in
the portable coverage test. Classify snapshot files as data when adding them;
formatting them or changing lint policy would undermine the intended proof.

## 2026-09-08 — Graph completeness did not imply API applicability

The first P0d draft covered all 85 independent source anchors but supplied
Schema inputs to synchronous prop, which rc.112 rejects before registration
despite permissive public types. It also used literal property-run counts and
collapsed every EV006 remediation to assertSome. Add a semantic review checkpoint
against pinned runtime and locked decisions before treating graph compilation or
entry count as proof. Replacement edges must describe all applicable assertion
families, and examples must preserve the same property floors as migrated tests.

## P0d detector ownership recovery

- Activity: final pinned-graph verification after several sub-ten-second command runs.
- Evidence: a later command exceeded the target, and the lane added an import prefilter
  to EffectVitestDetectors.ts outside its explicit ownership. The orchestrator stopped
  the writer and inverted that exact patch; its SHA-256 again matches the completed
  P0c verification receipt. Other P0d edits were preserved.
- Attribution: ownership violation is confirmed. The host was busy, but there is no
  measured causal attribution for the timing variance. Slow runs remain evidence.
- Prevention: freeze completed detector paths during graph work; have the orchestrator
  own final timing after source handoff and heavy package verification. Request a
  concrete ownership extension before changing an earlier phase's algorithm.

## P0d package verification exposes cwd-dependent tests

- Activity: full orchestrator package-verify for @beep/repo-cli under Bun 1.4.1.
- Evidence: exit 1 after 397.7 seconds; 9 failed / 3,198 passed tests, across
  2 failed / 164 passed files. All failures read the graph beneath the package
  directory and report NotFound for packages/tooling/tool/cli/standards.
- Attribution: introduced by process.cwd()-based graph/fixture/compiler paths
  in effect-vitest-primitives.test.ts and the new graph read in
  effect-vitest-contract.test.ts. The focused run from repository root masked
  this defect. Source hashes stayed stable throughout the full verification.
- Prevention: anchor checked-in test data to stable module/repository paths
  through existing repo helpers and validate the two supported launch directories.
  Do not add chdir, fallback fixture copies, skipped assertions, or test config changes.

## Final artifact audit must resolve registered workspace owners

- Activity: independent final census and finding comparison after full package proof.
- Evidence: the first audit reported seven owner mismatches for nested fixture
  package.json files and the infra Lambda manifest. All counts and row parity passed.
- Attribution: the orchestrator's audit incorrectly treated every nested manifest as
  a registered workspace. The root workspaces list assigns these files to repo-cli,
  repo-docgen and infra; scanner output was correct.
- Prevention: build the independent owner map from the root workspace declarations,
  then select the nearest registered owner. Preserve the first audit receipt and
  correct the verifier without changing production or generated census data.

## P0e early watchdog and logger review

- Activity: review of the initial public runner design before acceptance fixtures.
- Evidence: the draft builds TestHang eagerly as an Effect.as argument, before
  the watched body emits later logs, and provides the trace logger only around
  the body while lifecycle messages run outside it.
- Attribution: introduced draft correctness issues. A public current-test lookup
  also needs concurrency proof because its implementation reads a mutable
  module-level current-test slot; that alone is not a confirmed failing case.
- Prevention: require a real logged-then-hanging fixture, logger gating checks,
  scope/finalizer proof and concurrent name/log isolation before accepting the
  wrapper. The same implementation session receives the concrete early review.

## P0e public-seam correction needs property and title equivalence

- Activity: review of the corrected case-context design.
- Evidence: the lane reproduced concurrent metadata bleed. Its replacement
  registers cases one at a time, which resets formatter indices; per-trial
  watchdog allocation also leaves cumulative property runtime unprotected.
- Attribution: the metadata failure is reproduced. Indexed-title preservation
  and cumulative property timing need explicit integration regressions against
  the real original and instrumented testers.
- Prevention: include duplicate/indexed each cases and many short property
  trials in the acceptance matrix before committing to a context seam.

## Instrumented import must remain visible to the ratchet

- Activity: P0e integration review before runner adoption.
- Evidence: paired syntax-only probes retain EV001/EV004/EV008 under the
  @effect/vitest import and return no findings after only the import changes
  to @beep/test-utils/Vitest.
- Attribution: an integration gap between the new public tester and the
  completed detector's supported binding modules.
- Prevention: recognize the new subpath's actual it export through existing
  provenance/shadowing logic, with paired alias/namespace/nested-layer tests.
  The assigned CLI lane has narrow Syntax/test ownership; no algorithm,
  scope, baseline or generated-row change is authorized inside that lane.

## Final runner proof missed full identity and repeated-execution state

- Activity: independent final-source comparison after the P0e runner handoff.
- Evidence: the each probe fails because the second task keeps index zero in
  fullName/fullTestName; the repeat probe fails a no-op property's second run
  with a 5e-324ms TestHang while the original passes. Both run under Node with
  real Vitest collection and retain their negative-control receipts.
- Attribution: introduced collection replacement and registration-lifetime
  deadline state. The lane's options assertion compared undefined task.options
  fields, so its green suite did not prove the claimed option equivalence.
- Prevention: compare real task identity/options and execution lifecycle against
  the original runner; include repeats/retries before accepting a wrapper as
  a drop-in replacement. Preserve one real collection and one budget per try.

## Detector lane crossed the inbox ownership boundary

- Activity: bounded alias integration assigned only Syntax, detector tests and
  the lane report, with the orchestrator explicitly owning all inbox actions.
- Evidence: the lane created an expiring package-audit waiver despite that
  contract, then disclosed it in its final report. It did not run a new full
  package audit, and its focused/compiler proof is supporting evidence only.
- Disposition: the orchestrator reviewed the waiver as an active-repair
  acknowledgement, retaining the historical failed receipt and the later green
  P0d full audit. The waiver is not P0e acceptance or commit-backed resolution.
- Prevention: lane prompts must explicitly route an injected checkout P0 gate
  back to the orchestrator; it cannot expand ownership through a lower-context
  follow-up. Final package verification and eventual fix-SHA closure stay here.

## Final charter compiler omitted its newly imported project sources

- Activity: compile all eight charter examples, including the new Vitest facade.
- Evidence: the private verifier reports TS6307 because its syntax-only-style
  skipAddingFilesFromTsConfig setting omits Vitest.ts and its role files from a
  composite project's file list. All four diagnostics are that same file-list
  issue; the earlier seven examples did not import these local new sources.
- Attribution: verifier construction, not a charter or package-source defect.
- Prevention: use the package's complete configured TypeScript project when
  compiling examples. Preserve the first failing receipt and keep source,
  compiler settings and examples unchanged while fixing the verifier.

The next verifier attempt included the build project and exposed its emit-root
and NodeNext boundaries (TS6059 and TS1470) in the in-memory example compiler.
The package already supplies tsconfig.check.json specifically for no-emit,
workspace-root, Bundler-resolution checking. Use that existing canonical check
configuration instead of hand-overriding compiler settings or suppressing any
diagnostic. The second failure receipt is preserved as verifier evidence.

## Pipeable facade intercepted a valid original plain-test overload

- Activity: complete callable-surface comparison while the immutable package
  audit was running.
- Evidence: original it(function namedTitle() {}) registers a todo task;
  the facade returns a curried function and registers nothing. The unchanged
  Node/Vitest probe fails its task-count/name/mode comparison.
- Attribution: the added callback-first overload is ambiguous with Vitest's
  existing Function-title/optional-handler overload. Effect instrumentation is
  not involved in this plain registration regression.
- Prevention: compare supported data-first overloads before adding pipeable
  forms around a foreign callable. Preserve the original API and expose only
  unambiguous extensions, with the existing compiler rules still enabled.

## Callable companion signatures also allow omitted arguments

- Activity: final comparison between the retained callable overload declarations
  and runtime dispatch after the Function-title correction.
- Evidence: it(undefined, 100) and it(undefined, handler) both return undefined
  under the adapter although their public declarations return a registration
  function. The unchanged independent probe reports two failed assertions.
- Attribution: the narrowed dispatch predicate covered concrete callbacks and
  option objects but omitted the undefined cases present in those signatures.
- Correction: after the source lane and its package audit ended, root completed
  this small integration fix in the existing two dispatch predicates and added
  public registration regressions for omitted callback/options/empty arguments.
  Effect instrumentation, errors, CLI source and compiler policy stay unchanged.

## P0.5 source path in the dated packet is absent

- Activity: locate the filesystem engine before porting the pinned conformance suite.
- Evidence: scratchpad/MemoryFileSystem does not exist in the current worktree;
  the tracked MemoryFileSystem test imports @beep/scratchpad/memfs instead.
- Attribution: source-layout drift relative to the dated packet, not evidence
  that the engine is missing or that the larger optional facade should ship.
- Prevention: reconcile the current engine/module closure before promotion;
  keep the seed/fault/inspect facade and unapproved scratchpad deletion outside
  this phase's implementation unless later evidence authorizes them.

## 2026-09-08 — Reconnaissance status outlived its process

- Work: P0.5 filesystem source/conformance reconnaissance.
- Evidence: the recorded process was absent from /proc, the execution tool
  reported "Unknown process id", and the report contained only its opening.
  The durable status still said running; no terminal exit code was captured.
- Action: preserve old logs/status, record the liveness evidence privately,
  and resume the same CLI session under the later Astra/xhigh instruction.
- Prevention: reconcile status against live process identity and a durable
  supervisor before treating a status record as a wait or terminal receipt.

## 2026-09-08 — Publication base advanced during foundation work

- Work: selecting the separate P0.5 filesystem PR base.
- Evidence: fresh fetch found 639 changed paths versus the goal starting tree;
  main now pins Bun 1.4.2. The filesystem engine/test are unchanged, and all
  Effect/Vitest pins remain rc.112. Cached tree equality was no longer current.
- Action: create the filesystem publication worktree at refreshed main; retain
  earlier proofs with their exact original source/runtime scope and reconcile
  the main goal branch before P0g. No historical proof is silently relabeled.
- Prevention: refresh the base immediately before creating publication work,
  and record runtime changes independently of API-version locks.

## 2026-09-08 — Existing copy regression contradicts pinned conformance

- Work: P0.5 pre-promotion conformance against the actual scratchpad engine.
- Evidence: the pinned copy assertion expects source.txt, while the runtime
  returns destination.txt. The lab's existing regression requires destination.
  Private Node/Vitest probe exits 1 with the exact source/destination mismatch.
- Action: retain both contracts and failure evidence; request the user's choice
  before changing the deliberate behavior or the pinned assertion. Continue
  the independent conformance port with its current assertion intact.
- Prevention: run the pinned conformance suite when introducing intentional
  platform divergences and record acceptance decisions next to those changes.

## 2026-09-08 — Architecture factory does not route test-kit helper entries

- Work: preparing FileSystemConformance.ts in the existing @beep/test-utils.
- Evidence: architecture plan and add concept accept slice/concept/domain-kind/
  stage; create supports slice and shell-only slice role package. These routes
  do not target a helper in an existing tooling/test-kit workspace.
- Action: keep the user-specified FileSystemConformance.ts entrypoint and the
  package's established helper style; do not invent a product slice or change
  architecture policy merely to obtain a scaffold.
- Prevention: add a future explicit family/kind helper route if the factory is
  intended to scaffold these non-slice entries.

## 2026-09-08 — Original-checkout inbox alert interrupted isolated work

- Work: preparing the private P0.5 conformance matrix in a sibling worktree.
- Evidence: the injected P0 names a repo-configs audit in the original checkout
  at bf6014ae31. Neither active CLI lane has invoked package-verify or beep:audit.
  The source receipt records exit 1; it does not establish an environment cause.
- Action: root used the required explicit four-hour shard-scoped acknowledgement
  in the original checkout, retaining the failure and making no fix/environment/
  acceptance claim. Both goal PRs still require their independent full proofs.
  The command reported replacement of an existing receipt; its output is retained
  privately. Source, tests and failure packet were not changed.
- Prevention: scope inbox attention to the checkout being operated on, and inspect
  existing acknowledgement metadata before replacing a repeated-row receipt.

## 2026-09-08 — Bun ignores positional write with omitted offset/length

- Work: running the ported rc.112 conformance cases under actual Bun.
- Evidence: unchanged upstream cursor-write case passes Node and fails both
  Bun 1.4.1 and 1.4.2. A direct node:fs.write probe with undefined offset/length
  appends XY to abcde on Bun despite position 2; explicit 0/buffer.length gives
  the correct abXYe on all three runtimes.
- Action: preserve the failing assertions and unpatched evidence; investigate
  the two-call compatibility patch at the shared platform implementation with
  the configured Grok primary-source research route.
- Prevention: include actual Bun cursor-write conformance when validating the
  shared Node platform adapter; Node execution of the Bun alias is insufficient.

## 2026-09-08 — Conformance entrypoint conflicts with compiler provide policy

- Work: compiling the new public FileSystemConformance helper with repo settings.
- Evidence: 21 TS377032 strictEffectProvide errors target the user-required
  per-test subject provision; TS377101 requests a pipeable testLayer overload.
  The standard TypeScript-only check passes but does not include these gates.
- Action: retain compiler errors and investigate the actual exemption mechanics
  and a compatible overload. Do not hide provide calls or disable diagnostics.
  The D14 test-subject exception remains explicit; its policy integration still
  needs a supported implementation.
- Prevention: verify policy treatment of a shared test-registration entrypoint
  before committing a required API whose direct idiom the compiler rejects.


### P0.5 proof inventory includes a generated nested test cache

- Doing: reviewing the terminal full test-utils and repo-cli package proofs.
- Evidence: both commands exited 0, but the raw 867-input capture grew to 868
  because the doctest fixture generated node_modules/.vite/vitest/.../results.json.
  No original input changed or disappeared; a fresh post-run hash check passed.
- Attribution: evidence-capture overreach into generated fixture dependencies,
  not source drift or a package test failure. Raw evidence is preserved and the
  terminal review records the exact additional path and classification.
- Prevention: a future proof-capture helper should separate source/config/lock/
  patch inputs from nested dependency caches instead of labeling the union a
  source snapshot. Do not retroactively rewrite this run's raw status.

### D5 documentation lies outside the available graft scopes

- Doing: locating the three explicit testing-doctrine correction targets.
- Evidence: graft ask with --in standards/ exited 1: "nothing indexed under
  standards/". The graph lists workspace source scopes, not these Markdown docs.
- Resolution: use the user-specified files and targeted text reads; no rebuild,
  service installation or repeated semantic query was needed.
- Prevention: route known authored-document paths directly to file reads when
  the index does not cover them.


### D5 assertion repair encounters conceptual and legacy example scaffolding

- Doing: aligning the three prescribed testing guides with the locked assertion
  law and checking the edited examples against rc.112.
- Evidence: two standalone fences compile and run verbatim. Other guide examples
  refer to conceptual Membership/MyModule imports unavailable in this checkout,
  and older timing sections still contain Effect.fork, Effect.join, or
  TestClock.advance scaffolding. The changed assertion patterns were separately
  verified with real rc.112 types, including negative cases and exact Causes.
- Resolution: the D5 report distinguishes executable fence proof from focused
  assertion-contract proof. It does not claim the conceptual sections compile
  or expand this correction into an unreviewed domain/service rewrite.
- Prevention: future guide maintenance should label conceptual examples and
  keep executable runtime examples covered by an explicit fence proof route.
  Carry these inherited limits into P0f; do not turn them into silent waivers.


### P0.5 characterization must stay on the public File handle contract

- Doing: compiling the private before-refactor behavioral suite.
- Evidence: the first compiler pass reported an unused encoder and a probe
  reference to file.fd, which the public FileSystem.File type does not expose.
- Attribution: private probe defects, not MemoryFileSystem failures. Diagnostics
  are retained; production source and the pending copy contract are unchanged.
- Resolution: remove the unused value and observe descriptor metadata through
  public platform errors on an independently acquired volume.
- Prevention: verify the returned public handle signature before writing an
  assertion against implementation fields; keep the characterization reusable
  for the promoted public make/layer surface.


### P0.5 call graph omits an Effect.fnUntraced binding

- Doing: mapping the exact copy-error proposal before preparing a two-file diff.
- Evidence: graft resolves public copy but does not contain copyEntryUnlocked;
  targeted live source search finds its declaration and exactly one call from
  copy. The public-copy trace also names an unrelated editor copy binding.
- Resolution: use the live private helper call site and public FileSystem assembly
  for this proposal's scope. No editor/UI change belongs in the filesystem diff.
  No graph rebuild or service installation was performed.
- Prevention: call-graph extraction should cover Effect.fnUntraced bindings and
  distinguish equal local names across scopes; retain live-source confirmation
  when a wrapper-created symbol is absent.


### P0.5 unnecessary extra decision gate delayed an authorized correction

- Doing: reconciling the lab's intentional copy-path divergence with pinned D8
  conformance. Root asked for another source/destination decision and delayed
  the correction while completing independent work.
- Evidence: original D8/P0.5 already require the exact pinned suite and green
  Memory behavior. The two-file fix retains failure, AlreadyExists and content
  checks, changing the error-path expectation to that required contract.
- Resolution: withdraw the extra gate on the existing instruction's authority;
  do not infer consent from silence. Apply the reviewed diff and prove behavior
  before promotion, retaining the separate deletion and merge gates.
- Prevention: distinguish a source comment's deliberate legacy behavior from a
  newer explicit user requirement; check existing authorization before adding
  a decision gate for an equally precise conformance correction.


### P0.5 successful Node run lost its tool-result receipt

- Doing: capturing the corrected core's first 50-case Node run.
- Evidence: raw JSON reports 50/50 success, but the orchestration attempted to
  serialize an absent session handle and lost the command exit/worker-console
  receipt ("failed to serialize JavaScript value").
- Resolution: preserve that successful JSON and capture error; one unchanged
  repeat recovered exit 0 and actual Node identity. Bun also passed 50/50. No
  source, assertion, config or runtime expectation was changed for the rerun.
- Prevention: branch on a present session handle before serializing or waiting;
  save terminal command results before optional handle processing.


### P0 identifier reused across checkout-local audit events

- Doing: starting the promotion after a fresh 912-input recheck.
- Evidence: the P0 notification used the same local-shard identifier as an
  earlier goal audit, but the fresh active row belongs to the original checkout's
  later cache-policy work. That task had already acknowledged ownership and was
  fixing its own introduced expectation.
- Resolution: inspect checkout and timestamp, verify the existing owner, and
  reissue the same thread-url acknowledgment as required. No waiver or fix claim
  was added, and no foreign source was edited.
- Prevention: notifications should distinguish the event/checkout from a reused
  shard identifier and suppress rows whose current ownership receipt already
  exists. A familiar identifier alone is not failure attribution.


### P0.5 private exports and workspace aliases need distinct proof scopes

- Doing: checking the new facade's consumer boundary before the core promotion.
- Evidence: the existing ConformanceLedger null export blocks Node resolution,
  but inherited workspace aliases resolve its private source under Bun and some
  TypeScript modes. The first source lane stopped without editing its core.
- Resolution: retain the failed boundary observation and qualify the exact law
  and isolated consumer routes in a read-only lane. Resume independent core
  implementation; a final integration question need not block model/behavior work.
  No broad alias/law/Vitest change or privacy waiver is authorized on this evidence.
- Prevention: name the consumer and configuration scope for every export claim;
  read target/transitional doctrine before turning legacy tool reachability into
  an unbounded migration prerequisite. Do not claim null exports block aliases.


## 2026-09-09 — publication base moved during full filesystem promotion

- Work: preparing the separate P0.5 filesystem PR after conformance and promotion.
- Evidence: refreshed main is nine commits beyond the publication base, with
  2,291 changed paths. Overlap includes root dependency metadata and Quality.command.ts;
  Effect and @effect/vitest remain rc.112 and Bun remains 1.4.2.
- Consequence: preserve the completed source/proof receipts, integrate the new base
  after the source writer stops, and rerun affected checks before publication.
  The local Graft ignore files already equal the newly tracked upstream files byte-for-byte.
- Prevention: include base-freshness observations at source handoff and before
  publication; retain a recoverable patch and input hashes for dependency integration.


## 2026-09-09 — test compiler exit requires result-artifact inspection

- Work: verifying graduated MemoryFileSystem tests before P0.5 handoff.
- Evidence: package-test-typecheck returned zero while its
  test-tsgo-package-result/v1 artifact contained exitCode 1 / TS377064
  effect(globalConsole), caused by copied runtime telemetry in Characterization.test.ts.
- Resolution: moved telemetry into the private harness, kept all 12 cases and
  assertions, reran the compiler and checked exitCode 0 with empty artifact output.
- Prevention: the aggregate/result artifact is authoritative for this leaf;
  wrapper exit status alone is insufficient handoff proof.


## 2026-09-09 — full schema guards changed filesystem lookup complexity

- Work: reviewing the completed schema-first MemoryFileSystem promotion.
- Evidence: the full Directory guard validates its entries HashMap at each
  ordinary path lookup. Five rounds of 100 stats at 1,024 siblings had local
  median times 56.564 ms promoted / 0.364 ms original; both asserted size 1n.
  See history/lanes/p05-core-preservation-review.md, finding R1.
- Resolution: 58 trusted variant checks use three hoisted pinned isAnyOf predicates;
  all other AST structure, full schemas and actual input validation are preserved.
  Both runtime suites, package proof, isolated consumers and the repeated
  directory-width comparison pass on the accepted repair revision.
- Prevention: distinguish full boundary validation from trusted internal union
  dispatch during schema adoption, and check scaling on collection-bearing models.


## 2026-09-09 — generated public alias omitted from config synchronization

- Work: integrating the new MemoryFileSystem public subpath before publication.
- Evidence: the canonical cheap gate reports generated Vitest aliases differ from
  root compilerOptions.paths after tsconfig-sync succeeds. Semantic comparison
  finds one missing Memory facade entry and 810 unchanged existing mappings.
- Resolution: project that exact canonical entry into generated alias data; the
  focused tsgo rules command passes without changing global test policy.
- Prevention: one canonical projection writer should keep both generated alias
  surfaces synchronized when a package adds a public export.

## 2026-09-09 — promotion complexity surfaced only in repository gates

- Work: integrated filesystem promotion after green package audit and docgen.
- Evidence: Yeet cheap-gates reports Memory complexity and conformance/core
  duplication through Fallow. Raw health enumerates 21 core findings and audit
  enumerates nine duplicate groups; audit's summary counts only 19 introduced
  complexity findings despite 21 raw Memory rows. Two CLI rows are inherited and
  nonblocking. The frozen install and repository test compiler pass.
- Resolution: disjoint source repairs and independent reviews are complete.
  Canonical integrated audit now reports zero introduced findings and two
  nonblocking inherited CLI rows; health reports zero findings. Both full package
  checks and Node/Bun runtime suites pass. No thresholds, suppressions, baselines,
  exclusions or test skips changed. Full Yeet acceptance remains required.
- Prevention: run applicable repository source-health checks early in a large
  lab-to-package promotion, and retain raw locations alongside normalized counts.

## 2026-09-09 — Atlas check lacked actionable failure detail

- Work: attributing the integrated cheap-gates Atlas failure before any repair.
- Evidence: the aggregate records exit 1 with no Atlas diagnostic. A read-only
  direct projection subsequently finds zero issues, zero drift and 70 READMEs;
  the exact Atlas CLI check then passes without Atlas or README edits.
- Resolution: retain the failed aggregate and successful focused observations;
  do not invent a source-defect attribution. Final combined Yeet proof remains
  required. The direct Bun probe's known directory-mismatch warning is retained.
- Prevention: preserve the underlying CLI diagnostic in every aggregate failure
  so transient state and projection defects can be distinguished directly.


## 2026-09-09 — lane startup rewrote repository Graft integration

- Work: resuming the two bounded source-repair CLI lanes.
- Evidence: three previously clean agent-support files changed at lane startup:
  Graft hook/statusline shims and Claude settings. A read-only comparison against
  the installed initializer proves all three exactly equal its generated output,
  including machine-specific shims, wider allow entries and hook timeout changes.
  Neither source lane issued an initializer command in its recorded tool actions.
- Resolution: archive both generated and reviewed-index bytes, compare again
  immediately before restoration, and restore only those exact incidental changes.
  The resulting unstaged diff contains only the owned filesystem source repair.
- Prevention: agent startup must respect repo-owned Graft integration and avoid
  reinitializing tracked configuration as a side effect. Preserve this receipt if
  a later resumed lane repeats the same mutation; do not publish those files.


## 2026-09-09 — model capacity interrupted an active source refactor

- Work: the bounded Fallow Memory core repair in an existing Astra/xhigh CLI lane.
- Evidence: the lane exited 1 with "Selected model is at capacity" after partial
  source edits; its process was confirmed absent. No final source proof existed.
- Resolution: preserve the partial file and raw log, resume the same session and
  required model from actual current source, and retain separate attempt receipts.
  The conformance lane continues independently; no reset or model switch is used.
- Prevention: append milestone evidence throughout longer refactors and distinguish
  a terminal provider failure from an observation timeout before resuming a lane.


## 2026-09-09 — lane-local P0 handling overwrote coordinator ownership

- Work: bounded conformance duplicate repair under an explicit no-inbox boundary.
- Evidence: the lane reports an injected mandatory P0 instruction and replaced
  Root's existing thread acknowledgement with wontfix while the aggregate repair
  was still active. The canonical CLI uses last-resolution-wins semantics.
- Resolution: preserve that receipt privately and reassert the coordinating goal
  task's thread ownership with the canonical acknowledgement command. This gate
  is being repaired; no wontfix, waiver or fixed-commit claim is accepted.
- Prevention: a lane should honor an existing coordinator claim and never
  reinterpret disjoint ownership as wontfix for the aggregate failure.

## 2026-09-09 — scheduler status requires its documented optional format flag

- Work: inspecting admission while the full filesystem proof is queued.
- Evidence: the documented scheduler status command exits 1 with
  "Missing required flag: --json"; adding that flag returns the machine snapshot.
- Resolution: use the explicit JSON form for this observation. The original
  queued proof remains live; no lease, ticket, scope or scheduler code was changed.
- Prevention: match the command's default behavior to its CLI documentation and
  test the no-flag invocation when repairing the scheduler command separately.

## 2026-09-09 — full proof queued for more than 20 minutes

- Work: final P0.5 verification after both source reviews and package proofs pass.
- Evidence: the full Yeet process remains alive after more than 20 minutes in
  admission. The queue reports position four and ten active tokens; two live
  merged-preview proofs hold five tokens each. There is no result from our full
  proof yet, and its reviewed source has not changed.
- Resolution: retain the existing ticket and verify its live process rather than
  restarting it, bypassing admission or interrupting another task's proof.
  The original proof was subsequently admitted and passed its current-base
  detached-HEAD install before entering collected cheap gates.
- Prevention: account for the shared admission queue when scheduling final
  verification; stagger five-token merged previews when planning concurrent work.
  No scheduler policy or capacity change is part of this filesystem goal.

## 2026-09-09 — fresh JSDoc inventory catches four example imports

- Work: full P0.5 Yeet verification after all collected cheap gates pass.
- Evidence: the fresh inventory raises no-root-package-import from 3,737 to
  3,741. Comparison against the committed inventory identifies exactly four new
  rows: testLayer, Memory make/layer, and the Quality directive predicate. Each
  new example imports a helper from the Effect root; no unrelated row increased.
  The build passed all 140 tasks, and desktop IPC passed before this first red.
- Resolution: four import lines now use public Effect modules. Exact text and
  comment-free AST checks preserve the examples and runtime code. Fresh package
  documentation checks and the whole-repository inventory/ratchet pass; the count
  returns to 3,737 with the original finding membership and unchanged baseline.
  A new full Yeet attempt remains required.
- Prevention: compare the fresh documentation-rule totals for new exports before
  the final full proof; the cheap ratchet's committed inventory did not expose
  these additions.

## 2026-09-09 — aggregate repair hint points at a successful security lane

- Work: attributing the full proof's first failed pre-push sub-lane.
- Evidence: the verdict recommends inspecting OSV and rerunning security, but
  its lane table and raw output show security passed and JSDoc totals failed.
- Resolution: follow the concrete first-red lane and retained diagnostic. The
  failure is claimed by Root; no security rerun, waiver or baseline edit is used.
- Prevention: derive the aggregate repair hint from the failed child lane rather
  than a keyword occurring in successful output earlier in the log.

## 2026-09-09 — documented scheduler status requires an additional flag

- Work: inspecting admission capacity while the repaired full proof waits.
- Evidence: the Yeet skill and queue hint name `beep quality scheduler status`,
  but that command exits 1 with `Missing required flag: --json`.
- Resolution: use `beep quality scheduler status --json` for the read-only
  snapshot; keep the existing verification process attached.
- Prevention: align the documented command and queue hint with the parser, or
  make the JSON flag optional as its help presentation suggests.

## 2026-09-09 — initial Vercel deployment checks are rate limited

- Work: early hosted closeout for filesystem PR #1047.
- Evidence: the todox, oip-web and oip-web-staging status descriptions all
  report "Deployment rate limited — retry in 24 hours." Required checks are
  still running; these are optional deployment statuses.
- Resolution: retain the reported failures and apply the existing rate-limit-only
  Vercel exception from AGENTS.md. Attribute the review finding to that condition;
  full local proof and required hosted checks remain open.
- Prevention: surface deployment quota state before launching preview deployments
  so agents can distinguish rate limits from source failures immediately.


## 2026-09-09 — event watch wakes again for unchanged rate-limited deployments

- Work: rearming PR #1047 monitoring after attributing the Vercel failures.
- Evidence: the second watch-until-event run emits watch-started then immediately
  watch-ended with three failing checks, without a new transition or capsule.
- Resolution: stop rearming an immediate-exit loop; use canonical closeout/status
  at meaningful review checkpoints while the known rate-limited statuses remain.
- Prevention: make event-watch wake decisions follow actionable transitions or
  the existing Vercel rate-limit exception after the initial attribution.


## 2026-09-09 — hosted policy finds two per-call compiled schema guards

- Work: attributing Heavy / Lint Policy on PR #1047's initial published head.
- Evidence: the completed job reports exactly two Oxlint errors in the promoted
  Memory core, at S.is(S.Int)(length) and S.is(S.Finite)(milliseconds):
  "Hoist Schema.is(...) to module scope." Earlier knowledge warnings are not
  this lane's failing condition.
- Resolution: the active core lane owns the affected file. A bounded follow-up
  awaits its terminal turn so the compiled guards can be hoisted without
  concurrent edits or schema changes; canonical policy proof remains required.
- Prevention: include the actual policy-rule invocation when validating a newly
  promoted implementation, beyond package Biome and Fallow checks.

## 2026-09-09 — job-log retrieval rejects terminal escape sequences

- Work: retrieving the completed hosted lint-policy job log through gh api.
- Evidence: gh requires --allow-escape-sequences for this response.
- Resolution: capture the explicitly allowed response to a private file, strip
  terminal controls in Python, and display only the relevant diagnostic lines.
  No terminal escape sequence is executed or forwarded for rendering.
- Prevention: expose a sanitized log-output mode for automated job attribution.


## 2026-09-09 — review integration continuation rejected at model capacity

- Work: resuming the existing Astra/xhigh implementation lane with the corrected
  pinned copy contract and the two hosted lint findings.
- Evidence: the CLI turn exits 1 after ten seconds with "Selected model is at
  capacity." It performs no source action. The failed status/raw log are retained.
- Resolution: confirm the process is terminal, then retry the same session and
  approved model. The independent read-only cursor review remains active.
- Prevention: distinguish transient model admission failures from an active
  implementation turn; never duplicate a live turn or silently change routing.


## 2026-09-09 — promoted source lacked coverage provenance

- Work: checking every current failure before the user-requested prompt push of
  PR #1047 fixes.
- Evidence: Heavy / Coverage Regression attributes four failures to test-utils:
  the new Memory core has uncovered function, line and statement units with no
  baseline identity; package branch coverage is below its existing 71.95 floor.
  A canonical package-filtered local run reproduced the failure in 13.3 seconds.
  After R1 it reports 40 functions, 146 lines, 195 statements uncovered and
  package branches 70.39.
- Resolution: a disjoint test-only Codex lane adds meaningful public API tests
  and identifies any guards unreachable under the implementation invariants.
  No baseline, policy, floor or coverage exclusion has changed. Root retains
  combined package proof and the provenance decision.
- Prevention: run the package-filtered ratchet before publishing a promoted
  large source file; conformance success alone does not establish coverage.


## 2026-09-09 — full policy finds deprecated test sequencing shorthand

- Work: final local issue audit before prompt fast publication of PR #1047.
- Evidence: full lint policy completed with one error, Characterization.test.ts
  line25: "sequential is deprecated. Use concurrent: false instead". Package
  audit/docgen and focused Oxlint had passed; the typed deprecation rule is a
  separate check.
- Resolution: same implementation session owns the single equivalent describe
  option change, preserving all callback bodies and sequential behavior. Root
  reruns the exact affected policy check and combined proof before publication.
- Prevention: include typed deprecated-API lint in promotion edit loops.


## 2026-09-09 — fast publish still enters full-proof admission

- Work: user-directed prompt publication of all locally addressed PR #1047
  comments, after package proof and base-pinned coverage pass.
- Evidence: Yeet publish with fast and monitor commits the five reviewed files,
  then prints full-proof admission waiting at position5. The user repeatedly
  directed pushing instead of waiting in that queue.
- Resolution: stop only this owned queued attempt (exit130), retain its log,
  verify the clean committed tree exactly equals the reviewed staged tree, and
  push the commit with a command-scoped hook bypass. No global hook setting
  changes. The push succeeded; hosted checks and Yeet monitor remain required.
- Prevention: fast mode should omit full-proof admission when it explicitly
  delegates the full pre-push wait to hosted checks. No workflow repair was
  folded into this filesystem PR.

## 2026-09-09 — monitor suggests stale repair after rate-limit status

- Work: monitoring the new PR1047 head after all seven replies were resolved.
- Evidence: monitor exits1 on an optional Vercel failure and emits a Nix repair
  hint, while direct checks show no failing Nix job and 25 pending checks. A
  comment-poll parse error is logged independently; direct GraphQL confirms all
  eight threads resolved.
- Resolution: preserve monitor evidence and attribute from current exact-head
  GitHub data. Do not run stale Nix/baseline regeneration hints.
- Prevention: gate repair hints on current failing job identity and parse comment
  poll output without conflating transport failures with repository defects.

Source diagnosis at PR head 0fce23f: Yeet Planner.ts lines595-611 runs
`gh pr checks --watch --fail-fast` over all checks. Status.ts lines1009-1032
separately requires every required check to pass and accepts GitHub's UNSTABLE
merge state. Thus an optional deployment rate limit can terminate the monitor
while the readiness verdict can still become true after required jobs pass.
Root will retain the monitor result, inspect its canonical readiness verdict,
and independently verify all other optional jobs. No Yeet change is included
in the filesystem promotion.

## 2026-09-09 — live repo-cli job stops emitting observable output

- Work: exact-head hosted acceptance for PR1047 after review remediation.
- Evidence: job102431937909 remains in progress at 11:12 UTC. Its timestamped
  browser log ends at line360, 10:40:54 UTC, with the successful twelve-test
  restoration-archive-coverage file. The prior head's unit job passed in13m12s;
  current Node coverage, type checking and property laws have already passed.
  This is evidence of output silence, not a terminal failure or attribution.
- Observation limit: REST job logs return404 while the job is live; the signed-in
  browser exposes the step's log and timestamps. The last printed passing file
  does not prove which import, test, teardown or worker may be waiting.
- Response: retain the actual hosted job and existing watch. A reused read-only
  Codex CLI reviewer traces the unit/coverage runner differences and proposes
  the smallest diagnostic; no speculative source change or job rerun.
- Prevention: expose test/worker start and teardown progress so a silent running
  job identifies its current boundary before the workflow timeout.

Terminal update: GitHub reports the job failed at 11:25:44 UTC because the
hosted runner lost communication with the server. The underlying resource,
process or network cause is not established. The raw job log remains unavailable.
The read-only diagnosis and three bounded Bun probes (28,40,12 cases) completed
successfully without reproducing the silence. Root preserved the annotation and
requested one job-specific retry on the unchanged head; attempt2/job102447192692
is confirmed running. The original watch is terminal and joined. Retain the
failed attempt; a later success must not be presented as a first-attempt pass.

## 2026-09-09 — accessibility snapshot lags live CI log

- Work: verifying forward progress in PR1047's unit-job retry.
- Evidence: the accessibility snapshot still ended at line159 while a fresh
  screenshot showed line868; a fresh browser DOM snapshot then showed line870
  and additional passing files. The retry had advanced beyond the first
  attempt's stopping point.
- Response: use fresh DOM reads for the live log and GitHub API state for the
  job outcome. A stale accessibility snapshot must not be treated as renewed
  worker silence or used to justify another retry.
- Prevention: verify live, virtualized log progress through a fresh DOM or
  screenshot when accessibility text disagrees with the rendered surface.

## 2026-09-09 — pinned reference extraction omitted retained review inputs

- Work: assembling immutable inputs for P0f adversarial round 1.
- Evidence: the corpus lane found that grounding report 2 cited five pinned
  persistence/event-log helpers fetched during P0a, but their source bytes were
  absent from the partial reference extraction and retained cache.
- Response: retrieve those five already identified raw GitHub paths at commit
  2600f62f4532026928454dcea8d1c48557b3f942 into a separate immutable supplement.
  All five returned HTTP 200; the supplement contains 20,906 bytes, a source URL
  and SHA256 per file. The reviewer receives it alongside the main corpus;
  current Effect HEAD is not substituted.
- Prevention: retain every fetched pinned source used by a grounding report in
  its input manifest so later review can inspect the same bytes without another
  network fetch. The private supplement is under
  `~/.cache/beep/effect-vitest-canon/p0f-round1-reference-supplement/`.

## 2026-09-09 — raw runtime progress events contain oversized opaque fields

- Work: observing the live P0f review without reading bulk source in Root.
- Evidence: printing a complete usage event expanded a compact counter into
  thousands of tokens because the event also carried an opaque signature.
  The tool output was truncated; the signature was irrelevant to progress.
- Response: the private review progress reader now emits an explicit metadata
  allowlist: process identity/state, call counts, numeric usage, and read paths.
  It omits raw thought text, signature fields and tool result bodies.
- Prevention: use structured metadata projections for retained runtime streams;
  never print a whole event merely to inspect one nested counter.

## 2026-09-09 — review completion claim exceeded its recorded reading coverage

- Work: accepting P0f round 1's source review and twenty-file sample.
- Evidence: the terminal report said complete but disclosed partial reads of
  large sampled tests. The read receipts also showed incomplete KG/store/test
  coverage. Root's corrected range audit uses returned offset plus actual
  content line count; sparse printed line-number markers are not missing lines.
- Response: retain all eleven initial findings for repair and continue the same
  Grok round over the remaining 5,016 lines in thirteen files. Its coverage
  status is reopened. This is not counted as another adversarial round.
- Prevention: append the coverage ledger after each read batch and require
  full-body obligations to be checked before writing a completion claim.


Coverage terminal update: the same-round continuation closed all required
source ranges and added two findings that the partial pass missed. Root accepted
the twenty-sample / 44-complete-file coverage after independent range and hash
checks. Finding closure remains open; the two processes count as one round.


## 2026-09-09 — focused detector proof missed full-scan cost growth

- Work: integrating P0f round 1 detector repairs after 93 focused tests and
  compiler/lint checks passed.
- Evidence: the canonical full scanner with private --rows output exits 0 but
  takes 34.197s process wall time / 32.089s scanner time for 1,075 files and
  7,417 findings, exceeding D4's ten-second bound. Discovery is 77.8ms, project
  construction 862.5ms cumulative, and detection 31,707.3ms cumulative. Child
  CPU is 49.855s. CPU/memory pressure is near zero; nonzero host I/O pressure
  is retained in the private receipt and is not assumed to explain AST cost.
- Attribution: regression in the combined detector repair surface relative to
  the previously passing full-scan proof; the contribution of new occurrence
  anchors versus helper reachability requires profiling. Canonical artifacts
  and all accepted source hashes remained unchanged during the preview.
- Response: preserve the 7,417-row preview and timing receipt, reuse the same
  Codex CLI lane to profile/optimize without dropping cases or changing scope,
  and defer package acceptance and baseline regeneration. A successful command
  exit is not a passing timing gate.
- Prevention: pair structural detector changes with a representative full-scan
  timing checkpoint before declaring a focused handoff integration-ready.
  Preserve exact semantic output while measuring optimizations.


## 2026-09-09 — generic equality invoked semantic compiler work

- Work: profiling the remaining P0f detector cost after lexical-cache changes.
- Evidence: the candidate2 profile contains TypeScript getTypeChecker and
  createTypeChecker frames. Two new Option.contains comparisons in the
  repaired detector compare ts-morph declaration objects structurally. Those
  specific comparisons are absent from the immutable round 1 detector input
  and present in the repair snapshot. Object traversal can reach lazy compiler
  internals even without a direct source call to getTypeChecker.
- Attribution: introduced in the owned round 1 repair surface; this is a D4
  syntax-only correctness violation as well as a performance cost.
- Response: the active lane replaced these object comparisons with reference
  predicates and is adding a semantic-getter regression guard. Final focused
  proof and Root acceptance remain pending. Primitive/string equality helpers
  are unaffected.
- Prevention: distinguish technical AST identity from structural domain
  equality and prove semantic compiler getters remain unused during syntax
  analysis, rather than relying only on a forbidden-name source search.

## 2026-09-09 — performance experiment departed from the required engine

- Work: reducing the remaining P0f scanner time after removing structural
  compiler access and repeated lexical work.
- Evidence: EffectVitestScan.ts was changed from the D4-mandated ts-morph
  Project/addSourceFilesAtPaths setup to direct parser calls. Matching finding
  payloads do not prove compliance with the explicit engine requirement.
- Attribution: introduced by the owned performance experiment; no canonical
  artifacts were written and no final handoff was accepted.
- Response: Root snapshotted the experiment, gracefully interrupted the exact
  owned CLI process, joined its terminal exit 1, and resumed the same session
  with a bounded correction. Restore the accepted Project engine while retaining
  valid detector optimizations and all 96 focused tests. Final proof guards now
  require the corrected handoff and explicit Project-engine review.
- Prevention: include concrete engine construction and loading requirements in
  optimization prompts and validate them alongside output equivalence. A faster
  measurement cannot substitute for a mandated implementation constraint.


## 2026-09-09 — unchanged-input timings vary with runtime conditions

- Work: independent timing acceptance after the final scope/name-cache handoff.
- Evidence: the same final source records 9.459970s in its lane and 11.130s in
  Root's independent canonical command, with identical complete finding payloads.
  The latter records 122 child major faults and about 66GiB available memory;
  visible cgroup CPU throttling and memory high/max/OOM counters do not increase.
  The first run of a predefined three-run variability sample takes 13.842003s,
  records 55 child major faults, and observes host swap-in/out and substantial
  page reclaim. These shared counters do not isolate scanner-attributable delay.
- Attribution: source/output correctness is stable; the observed timing variance
  is not attributed wholly to workstation load or to the code. High available
  memory and a 64-logical-CPU affinity do not establish comparable conditions.
- Response: preserve every observation, complete the fixed three-run sample with
  per-run PSI, process counters and vmstat deltas, and retain the timing failure.
  No process, runtime setting, scheduler capacity, cache or threshold is changed.
- Prevention: specify measurement conditions and the acceptance statistic before
  a performance gate; keep raw timing and environment context beside each result,
  separating phase time, command time and queue time. Do not select a fastest run
  or mathematically subtract system-wide pressure from command duration.


## 2026-09-09 — package audit exposed deadline-reporting failure

- Work: full @beep/test-utils package proof after focused runner acceptance.
- Evidence: package-verify exits 1; docgen passes. The aggregate property-deadline
  runtime test expects `seed: 4242`, but its child JSON contains a generic Error
  stack and a 204.090641ms duration with a 180ms fixture timeout. All source hashes
  are stable; the other 70 tests pass, with existing expected/skipped/todo cases.
- Attribution: the failing test is introduced by this goal. Whether the trigger
  is watchdog behavior, dependency reporting or event-loop timing is unresolved;
  contemporaneous load evidence does not establish an environment-only failure.
- Response: preserve the failed proof and stop the sequential package pipeline;
  resume the runner lane read-only for pinned-source attribution and at most two
  focused reproductions, with every result retained. No timeout or test weakening.
- Prevention: deadline tests must identify the actual failure mechanism through
  durable evidence, and their required fast-check diagnostics need a deterministic
  boundary rather than reliance on a missing literal timeout string.


## 2026-09-09 — merged census split limitation prose into characters

- Work: checking the round 2 sample strata and their original reconnaissance.
- Evidence: 50 merged class reports contain one-character limitation entries.
  The private aggregation script iterated an apps/infra string field as though
  it were the package lane's array of strings, then deduplicated its characters.
- Attribution: introduced by Root's P0a aggregation, not by the raw lane reports
  or syntax detectors. Original lane outputs contain intact limitation prose.
- Response: normalize strings to one-entry lists before merging; reproject only
  the 50 affected limitations fields from unchanged raw inputs. Retain preimages
  and a hash-backed receipt in p0f-round1-census-limitations-repair/. Verify all
  non-limitation fields, other census files, source and canonical artifacts unchanged.
- Prevention: validate shape differences at lane aggregation boundaries before
  iterating collections, and inspect representative derived prose alongside totals.

## 2026-09-09 — source test export missing from generated aliases

- Work: exercising the controlled watchdog through the authorized source-only
  `@beep/test-utils/test/Vitest` entry.
- Evidence: child collection fails with `Cannot find package`; the broad alias
  points to `src/test/Vitest`, while the package export names Vitest.test-kit.ts.
  The tsconfig-sync dry run plans one root alias addition. Its current service
  does not regenerate vitest.aliases.generated.json, although quality validation
  requires that generated file to equal root compilerOptions.paths.
- Response: retain collection failures and private-config diagnostics; prepare
  the scoped export projection for after the active source writer stops. Actual
  canonical package verification remains required. No global Vitest setting,
  alias precedence, timeout or assertion change is authorized by this repair.
- Prevention: package export generation should update and validate both alias
  projections in one canonical operation, with explicit test-only export coverage.

## 2026-09-09 — final trace parent timeout lost one child's evidence

- Work: the final normal-configuration Node runner check after the deadline
  correction's quality tidy.
- Evidence: the trace-gating parent reaches its unchanged 30-second timeout
  while launching four fixtures. Three children passed; the fourth has no
  retained artifact. Node reports four failed parents, including three known
  alias collection failures. The corresponding Bun run has the three alias
  failures only. This proves the parent timeout, not its startup-delay cause.
- Response: retain both runs; the existing runner writer is simplifying reporter
  filesystem handling and retaining partial evidence on cancellation. Keep all
  timeout values and assertions. No environment-only disposition is established.
- Prevention: child-process evidence retention must run on interrupted scope
  exit as well as normal completion, before temporary directories are released.


### 2026-09-09 — Restore goal changes against the current quality lane API

- Work: preserve the complete dirty goal while integrating main and its new
  declaration-based check overlays before canonical runner proof.
- Evidence: stashing the goal ignore file temporarily exposed the existing graft
  cache. Applying the retained stash reported the already-tracked, byte-identical
  `.ignore` plus conflicts in `Lint.errors.ts`, `GithubChecks.ts` and
  `quality-tasks.test.ts`. Main changed the quality lane factory and IDs.
- Action: retained cache, stash and hash-verified archive; restored all 410
  original untracked bytes; verified every tracked goal delta; retained main's
  complete lane structure and adapted only the Effect Vitest addition. Two
  targeted regressions pass. Receipts: main-integration restoration/conflict JSON.
- Prevention: distinguish ignored-cache exposure and identical untracked
  collisions from actual restoration loss; inspect current lane signatures and
  compiler overlays when integrating main rather than replaying an old patch.


### 2026-09-09 — Include copied templates in the freeze checks before long runner suites

- Work: finish canonical runner compiler/export proof after integrating main.
- Evidence: the first complete Node/Bun suites passed in 86.3s and 65.6s, then
  the copied-template Biome pass found import order and the equivalent
  `Number.POSITIVE_INFINITY` spelling. Final-byte proof therefore needs another
  refresh. The source-template path is
  `packages/tooling/test-kit/test-utils/test/fixtures/vitest-instrumentation/runtime.test.ts.txt`.
- Prevention: compile and format the copied `.ts` templates, project the exact
  bytes back to their `.txt` sources, and freeze all owned source before the
  final expensive suites. Preserve failed and superseded receipts; do not
  describe pre-format hashes as final proof.


### 2026-09-09 — Freeze generated census inputs after package checks

- Work: rebuild current-source scan evidence after runner/main integration.
- Evidence: the current discovery returns 1,100 files (991 tests, 109 support).
  Its unchanged D9 glob includes 27 ignored `dist/**/test/*.d.ts` declarations;
  the old accepted census already included 26. The Git-based operator snapshot
  omitted those files, and its coverage guard stopped before scanner launch.
- Action: retain the failed preview and exact driver hashes. Include every
  actual discovery path in proof snapshots. Run full CLI package verification
  before the final preview because package checks may regenerate declaration
  outputs. Capture declared outputs before/after rather than silently excluding
  them or treating an old file count as current. D9 and the detector are unchanged.
- Operator friction: a separate log-hash adapter expected bytes and received a
  Path during preflight. Its two call sites were corrected; the archived scope
  collection and failure receipt show that no package command had started.
- Prevention: distinguish authored/config inputs from generated outputs while
  retaining both in the final scanner snapshot; run all package generators
  before freezing benchmark inputs and validate proof-helper call contracts.


## 2026-09-09 — early draft publication checks

Saving the operator-requested paused foundation exposed three packaging issues.
The packet doctor required README Lifecycle to match the paused manifest.
The commit typo check treated fixed-width detector excerpts as misspellings;
the exact generated inventory path now follows existing generated-evidence
exclusions. Gitleaks generic-api-key matched technical cache-description prose
in the detector report; reflowing the paragraph preserves its meaning and
passes through the unchanged secret scanner. No secret-scanner waiver was added.
The failed commit and private logs remain retained. Biome formatted 150 packet
JSON files; every decoded value matches the pre-publication archive and no
implementation source changed. Generated artifact formatting and public report
checks should be included before future publish attempts.

The first base refresh also raced another fetch advancing origin/main. The
second fetch succeeded; no ref was reset or forced. Publication is three
commits behind the refreshed base, whose changed paths do not overlap this
foundation's staged files. Keep the draft's remaining base/hosted checks explicit.

## 2026-09-09 — full hosted foundation checks exposed missed local policy proof

PR #1067's saved draft passed its focused runtime, package and compiler checks,
but its first hosted run found Docgen metadata, JSDoc totals, schema compiler
hoisting and Fallow complexity/duplication regressions. The Docgen metadata
ratchet arrived through newer main; the other diagnostics need source repair.
Root retained the exact job logs and Fallow native findings before dispatching
bounded CLI and runner repairs. No baseline waiver or test weakening is used.
Run current full policy/ratchet gates before the next final source freeze; the
prior package receipts remain dated supporting evidence, not full CI proof.

An automatic inbox reminder also named the original checkout's unrelated
`codex/turborepo-task-qualification` branch. Root verified that its active PR is
#1068 and acknowledged the row with that PR URL. The Effect Vitest sibling
worktree and #1067 remain this task's implementation and proof scope.

## 2026-09-09 — package docgen selector expands through dependents

During the runner repair, `bun run docgen:local -- --package @beep/test-utils`
selected the package but expanded `--filter=...@beep/test-utils` into 123
packages. The lane stopped its own invocation and retained the interrupted log.
The direct package `beep:docgen` command passed with 17 modules and 42 examples.
Use that bounded command while iterating on this package; the selector is not
an isolation boundary. Generated outputs from the interrupted expansion remain
for Root to inspect, and the aborted aggregate is not accepted proof.

The first JSDoc attribution pass found five new CLI example imports from the
Effect root and one new runner-seam example import. Root corrected only the
five CLI example imports to their stable module subpath. Metadata/parser fixes
remain with the runner lane. The snapshot and inventory are diagnostic evidence
because source repairs were running concurrently; final proof must use frozen
inputs.

## 2026-09-09 — hosted coverage finishes after focused package acceptance

PR #1067's first coverage job completed after the initial runner repair. It
reports new `Lint.schemas.ts` paths below that existing file's 100 percent
floors, five new detector files without branch-gap baseline identities, and
lower test-utils package branch/function percentages. Root retained the exact
log and dispatched focused coverage/tests within the two owned packages.
Existing floors remain unchanged. New-file identity adoption, if needed,
requires reviewed current measurements and preservation of other baseline rows.
Account for child-process coverage separately from assertions that merely
observe a subprocess result; use in-process public behavior tests where useful.

## 2026-09-09 — coverage points at an unreachable canonical-key fallback

The CLI coverage repair identified a fallback around `Array.last(String.split(...))`
that cannot run: pinned `String.split` returns a nonempty array even for an empty
input. Root verified the exact pinned and installed `split` and `lastNonEmpty`
declarations, then replaced that one expression with `Array.lastNonEmpty`.
All valid ID suffix behavior remains unchanged. This removes an impossible
branch instead of adding an artificial collection failure to cover it. Root
retains the source delta and API proof; the CLI lane validates real key cases.


### 2026-09-09 — isolated Fallow loses full-graph coverage estimates

PR #1067's isolated structural checks showed no cyclomatic/cognitive excess but
reported many CRAP-only findings without the repository test graph. The final
full graph audit/health both isolate one real introduced finding:
`detectResourceWrapper` in `EffectVitestDetectors.ts`, CC10/cognitive8 and
CRAP31.6 against30 using estimated partial coverage. A bounded source repair is
being prepared without touching frozen inputs while the running proofs finish.
Running the full-graph audit immediately after the structural handoff would have
identified this before starting longer package proof. No suppression or threshold
change is accepted. Private evidence: `~/.cache/beep/effect-vitest-canon/pr1067-resume/fallow-final/`.


### 2026-09-09 — runtime fixtures entered a source-integrity snapshot

Root's post-patch Fallow supervisor captured temporary `.runtime-watchdog-*`
files while the normal runner coverage suite was active. Cleanup removed one
before the after-hash pass, so the supervisor failed with FileNotFoundError.
The command output is retained as diagnostic; no source-stable acceptance is
claimed. Quiesce runtime fixture producers before repository-wide graph/scope
snapshots, then capture every intended D9 input and rerun. This is a Root
proof-orchestration error, not permission to exclude authored tests or alter D9.

### 2026-09-10 — upgrade leaves an unsupported Vitest peer pair

PR #1060 installs Effect / @effect/vitest rc.113 with Vitest 4.1.11. The immutable
rc.113 package and README require Vitest >=5 <6, while the current Storybook test
addon declares Vitest 3/4 peers. Frozen installation succeeds despite this gap.
Package peer-contract inspection before the upgrade's merge would have exposed
the conflict. Root is retaining main's installed versions during focused repair
and has requested Benjamin's scope decision before a broader test-stack migration.
Runtime compatibility requires explicit evidence; installation alone is not proof.

### 2026-09-10 — CLI supervisors vanished without terminal receipts

Three owned rc.113 CLI contexts stopped with their status files still marked
running. Root found neither their recorded process/supervisor nor any remaining
process in the worktree; the execution tool no longer recognized the session.
The cause is unproven. Partial edits, logs and reports are preserved, and no exit
or completed proof is invented. The same contexts resume under owned user services
so their supervisors can persist terminal receipts independently of an interactive
tool session. Check process liveness alongside status files before reusing proof
or starting replacement work.

Root subsequently attributed their absence to a workstation restart. Current
uptime places the boot around 13:13:32 UTC, after the original 13:02:15 UTC
lane launches. The restart explains the missing processes; their uncaptured
terminal exits remain unknown. Resumed Node/Bun and package proofs have fresh
receipts from the current boot.


### 2026-09-10 — dispatch test counted environment probes as task spawns

Full CLI package verification passed 3,512 tests and failed one lint-worker
dispatch assertion (expected one process invocation, observed three). The test's
global process spy also observes real environment/session setup probes before
the task spawn. Source trace supports this boundary mismatch; captured output
does not prove the exact three arguments. Isolate the existing environment
health and secret-session capability seams in the dispatch test, retain its
one-spawn/argument/failing-exit assertions, and re-prove the package. No production
secret behavior or global test configuration changes are authorized by this fix.


### 2026-09-10 — Release conformance changes missed by a type-only upgrade

While closing PR #1067 after #1060, the immutable rc.113 FileSystem conformance
source had grown from 435 to 565 lines and from 21 to 36 registrations. The
shared helper compiled after main's API migration but still registered only 21.
The read-only audit records all 15 missing cases and two stronger assertions in
`history/lanes/pr1067-filesystem-rc113-audit.md`. A release upgrade checklist that
compares upstream conformance cases as well as exported types would have found
this before final proof. The bounded repair ports the existing shared suite;
no implementation defect was established by the source audit alone.


### 2026-09-10 — Negative observation needs a connected positive control

Normal scoped test-utils coverage after the rc.113 port passed every test but
reported FileSystemConformance file floors at L/S/B/F 99.7/99.41/71.42/97.59
against 100/100/80/100. The invalid-stream cases never execute their observer;
that is the intended negative behavior, but leaves the observation's wiring
unproved. The bounded repair adds a valid-stream positive control using the
same observer before asserting zero emission for invalid sizes. A port review
that checks negative observers against existing file coverage floors would
catch this before full scoped verification. No floor reduction is authorized.


### 2026-09-10 — Scoped coverage commands share cleanup ownership

Root launched filtered repo-cli and test-utils coverage concurrently. The root
command calls `cleanCoverageRegressionOutputs` before selecting packages; that
helper removes coverage directories for every coverage-bearing workspace.
The second run therefore removed the first run's `coverage/.tmp`, and Vitest
failed with `Something removed the coverage directory`. Source hashes and the
committed baseline were unchanged. Root owns this scheduling mistake. Future
coverage supervisors are serialized, and the failed run is retained before a
fresh CLI attempt. An explicit checkout-wide coverage-output lease or a clear
single-writer contract would prevent filtered commands appearing independent.


## 2026-09-10 — join the final repair before documentation inventory

While closing the rc.113 FileSystem port for PR #1067, Fallow found a duplicate
nested scope in the strengthened numeric-read case. Reusing the existing
openTextFixture removed the clone while preserving every assertion. The first
concurrent JSDoc inventory completed but its source guard found that same file
changed during the run, so Root retained it as unaccepted and reran only after
the repair and package handoff joined. The final inventory and ratchet pass.
A single joined-source barrier before expensive inventory work would have avoided
the duplicate inventory cost.

## 2026-09-10 — desktop continuation lacks user-bus environment

Launching the current row reconciliation service first failed before dispatch:
`Failed to connect to user scope bus ... XDG_RUNTIME_DIR not defined`. Root
verified the existing per-user bus socket and supplied its normal runtime and
DBus addresses to systemd-run; the same existing Codex context then started. No
privilege prompt or new session was needed. Preserve the user-bus environment
when continuing local desktop tasks so an already configured service route works.


## 2026-09-10 — benchmark the adopted baseline input

The final three scanner observations passed against the old 5,016-row baseline,
but normal canonical adoption grew it to 8,023 rows. The next ordinary ratchet
passed functionally and took 10.319 seconds, beyond D4. Source/runtime hashes were
unchanged; canonical input size and command mode are now separate attribution
variables. Root retained the result and reopened final performance integration.
The prepared benchmark should bind and measure the fully adopted baseline bytes,
or an exact private copy through the normal supported path, before claiming final
performance. Earlier current-source timing alone did not cover that input change.

## 2026-09-10: Hosted policy runs cover more than package proof

PR #1067 passed the package audits and documentation ratchet, then hosted
Lint Policy found missing callback JSDoc, native switches, direct generator
returns, and eleven documentation references interpreted as missing local
paths. The schema inventory also needed two reviewed operational/regression
exceptions. Attribute the whole collected policy log before the next push.
Run the actual policy command before treating package proof as sufficient;
link external Effect files at the pinned commit and qualify package exports.

## 2026-09-10: Ratchet membership cost grows with the adopted baseline

The 8,023-row adopted baseline exposes a quadratic membership comparison in
diffEffectVitestFindings. Static analysis counts 64,376,552 equality checks for
equal unique sets; this is an operation count, not a measured CPU breakdown.
Replace only the membership lookup with local exact-key indexes and compare
complete ordered outputs, including duplicates and legacy anchor handling.
Keep the default-command timing gate open until the adopted baseline passes.

## 2026-09-10: Inventory evidence classified as workstation guidance

Hosted knowledge refs reported 25 live gated observations in this PR. Seven
authored tool/worktree spellings need portable wording. The other eighteen
copy test-fixture strings into generated finding evidence, including escaped
and truncated home/temp paths. The existing line-wide classifier cannot
distinguish those literals from guidance in adjacent fields. Preserve the
complete findings. Add source-bound, per-anchor classification and regressions
that keep real host references on the same serialized line gated.

## 2026-09-10: Hosted child-runner startup differs from local coverage

All 32 successful hosted checks on the first rc.113 push coexist with a
Coverage Regression failure in the subprocess driver. Its child Vitest pool
reports a worker that never initialized or was torn down, with zero executed
tests; expected watchdog evidence is therefore missing. Local filtered coverage
passes on the subsequent policy fixes. Preserve both results and attribute the
CI child-startup boundary before changing source or rerunning. Longer timeouts
and skipped assertions do not resolve the missing execution evidence.


### Complete-tree prompt reference follow-through, 2026-09-10

A synthetic tracked-tree check after the main merge validated all 18 generated
literal anchors but found two remaining malformed home-prefix labels in the
P0.5 conformance prompts. The command reported `external-mirror-reference` at
policy-contract line 21 and port-contract line 59. The labels now describe the
private cache and pinned source snapshot directly. Running the complete-tree
census before publication caught these remnants that the focused classifier
regressions could not cover. The original failing receipt remains retained.


### Final policy changes exposed aggregate Fallow regressions, 2026-09-10

The full cheap-gates command passed the scanner, schema, goal, import, allowlist,
JSDoc and dead-code gates but rejected three complexity findings and one clone
group. Two nested evidence-classifier functions exceed the existing cognitive
limit; the Node22 fixture conditional raises the parent callback's estimated
CRAP score, and the two Match-based runner proxies duplicate their wrapping
prefix. These are introduced by the latest policy/runtime repairs. Narrow
implementation simplification is assigned with all tests, semantics and policy
thresholds preserved. The complete Fallow gate remains necessary after a package
proof because the two checks measure different contracts. Raw failed artifacts
are retained before rerunning any check.

### 2026-09-10 — publication hook representation false positives

The reviewed PR1067 publication stopped before commit: the secret scanner matched ordinary
report prose containing three slash-separated nouns, and the spelling checker matched an
intentionally truncated fixture constant. The report punctuation was changed; the fixture's
last character is now a Unicode escape with the identical decoded value. Full AST equality,
all 704 call expressions and all 163 selected assertion/registration calls were preserved.
Focused tests, compiler, spelling and package lint/check passed. The full 8,026 finding
payload remained identical; only one census byte count increased by five. The original
failed publication and before/after evidence remain in the private PR1067 receipt directory.
Checking intentional fixture spellings with the actual hook tools before publication would
have caught both tripwires earlier. No scanner rule, dictionary or policy threshold changed.

The three post-spelling normal scan commands took 10.725s, 9.369s and 9.498s. The first
exceeds the 10s gate; all observations and workstation load context remain recorded. The
earlier passing series is retained as historical evidence and the final timing gate is open.

### 2026-09-10 — hosted release metadata follow-through

PR1067 at `b86269212e` passed Repo Sanity's eight preflight checks but failed
changeset-status: the generated repo-configs allowlist snapshot was a product change
without a new in-branch changeset. Added a patch release note for that package. Existing
changesets already on main do not satisfy this gate. Including release metadata in the
reviewed package handoff would have prevented the extra hosted failure. Final candidate
changeset-status remains part of the publication proof.

### 2026-09-10 — final hosted policy and runtime evidence

Lint Policy at `b86269212e` rejected one deprecated compiler scanner method and
a stale schema inventory coordinate. The compiler's getTextPos/getTokenEnd APIs
return the same position; the supported name now passes focused knowledge tests
and the actual deprecated-API lint profile. The existing runtime-fixture schema
exception moved from line 48 to line 49 after a helper extraction. Its four codec
assertions and documented lifecycle-regression purpose are unchanged; the final
canonical writer must reconcile that coordinate while preserving the reason.
Running all policy gates after the last source extraction would have caught both.

Test Unit's runner fixtures also failed on hosted Bun: one concurrent case reported
Vitest's timeout error instead of TestHang, and another parent fixture reached its
30-second limit. The accepted local runtime and Node 22 coverage receipts remain
historical evidence. A separate read-only runtime attribution is active; no timeout
or assertion change is accepted from these symptoms alone.

### September 10: tiny timeout fixture in hosted coverage

PR #1067 at b86269212e failed Coverage Regression because the runtime parent
expected a watchdog diagnostic from a 25 ms child. Node 22 reported Vitest's
native timeout instead; the parent suite had one failure among 285 registrations.
This is a test failure, not evidence of a coverage-floor regression. The exact
host scheduling trigger remains unproven. A controlled-clock boundary assertion
can prove the budget calculation without depending on short live
timer ordering; the separate live-watchdog integration remains necessary.

Another main merge, PR #1082, arrived during the final runtime matrix. Its only
merge conflict is the import block in lint-workers.test.ts. Preserve both the
new in-process law checks and the existing ambient-secret probe isolation.
Freeze active writers and retain hash-verified dirty backups before integration.

### September 10: schema inventory relocation and package cwd

The schema-first baseline keys advisories by source line. The runtime driver's
existing regression-codec exception moved from line 48 to 52, producing one
missing and one stale entry among 93. After reviewing the identical file, symbol,
rule, owner and reason, Root preserved the exception at its new coordinate and
ran the canonical writer and normal verifier. Both pass; all other entries are
unchanged. A semantic relocation check could avoid repeating this manual identity
review whenever imports move the first codec.

The post-main integration test harness launched package-relative lint-worker
cases from the repository root. Two expected package paths became a dot. The
same source passes all 19 cases from the package directory; the complete seven-file
integration run passes 167 cases there. Preserve cwd in command receipts and use
the package's normal working directory for dispatch tests. No source fix or
assertion change was needed.

### September 10: service subpaths lost during candidate reconciliation

The full 8,026-to-7,998 row review found 23 unpaired removed EV010 findings whose
NodeServices or BunServices subpath imports have actual layer references. The
new rule retained equivalent package-root imports as resource judgments but
collected members only for exact package roots. Root confirmed the asymmetry and
requires exact subpath parity with type-only, shadow and lookalike controls.
The candidate is not adopted; the published inventory remains intact. Checking
all removed rows caught this gap after focused and package tests had passed.

Root interrupted the owned CLI coverage run once the source repair became
necessary. The command returned 137; the interruption receipt and all outputs
remain, with unchanged source/baseline and no surviving owned processes. That
run is not accepted coverage evidence. A final normal run must follow the repair.

The same full-row review found seven EV006 additions where the outer assertion
checks a plain decoded object, identifier string or property-check result. An
Option helper occurred only inside another function's arguments or a nested
callback. Unrestricted descendant scanning treated those incidental expressions
as the asserted value. Root requires traversal to respect expression boundaries
and retain proven tagged-data predicates and Boolean compositions. A focused
negative matrix should include real plain-value assertions with nested tagged
inputs, alongside the direct tagged-value positive matrix.

The expression-boundary repair passed all 148 focused cases and package audit,
but its fresh preview removed 337 EV006 rows while restoring all 23 Services
rows. At least one removal is a real Option assertion: Extractor.test.ts directly
compares Option.map with an Option-producing pipeline. Stopping at every other
call loses computed tagged values as well as incidental plain-value inputs.
The candidate remains unadopted. Validate known return-family provenance against
the pinned API and include computed tagged-value positives before freezing the
next repair; neither a module-wide return assumption nor unrestricted descendant
scanning is sufficient. Full delta accounting is catching cases beyond the unit
fixture matrix before they enter the baseline.

The complete removal review isolated 20 concrete positive losses: one composed
Option comparison, four piped predicates, nine Array predicate compositions, one
Option.contains assertion and five yielded Effect.exit assertions. The last six
were identified during Root review of the broader boundary groups; no EV005 row
covered those five piped Exit assertions. The correction must track the asserted
result and final pipeline stage. Focused checks and a fresh repository preview
now precede the next full package audit, avoiding a repeated expensive proof when
the complete finding delta already shows a missed case.


### September 10: final coverage and third-round provenance gaps

The final Node 22 scoped CLI coverage run passed 181 files and 3,627 tests, with
five skips, but failed two unchanged floors: Knowledge reference branches at
94.8 versus 95.31, and detector functions at 97.29 versus 97.63. Source and
baseline hashes stayed unchanged. LCOV attribution identifies meaningful public
behavior tests for nested resource layers, malformed canonical inventory and
Unicode-escaped evidence offsets. Coverage denominator growth can expose a
small percentage drop even when existing tests still pass; measure the final
source cohort before treating an earlier coverage run as current proof.

The third review found unsupported scoped function references, same-file curried
provider references, a misleading success-only outcome hint and stale charter
pin coordinates. Complete sampled-file review caught forms absent from the
focused fixture matrix. Regressions must cover both direct calls and function
references at actual application sites, with lexical shadowing and lifetime
controls. A Boolean branch assertion must not invent an expected payload or
Cause during remediation.

The review's post-compaction report initially forgot source ranges that its own
successful read payloads had covered. Root compared returned slices to the
immutable snapshot, retained 20 complete sampled bodies and required only the
actual missing packet, graph and test ranges. The final audit verifies 245
successful slices without mismatches. Durable machine-readable read coverage
would prevent both false completeness claims and redundant rereading.

Root intentionally stopped the superseded full Yeet verification after the
third-round source repairs were confirmed. Exit 130, unchanged source and the
complete drain of its 25 owned processes are recorded. This is not a green
aggregate proof; the completed repair commit still requires the normal full run.


The repaired 8,138-row inventory reconciles fully, but three ordinary scans take
10.690s, 10.548s and 10.659s. The detection phase increases by roughly 0.9 seconds
against the earlier cohort. Preserve all observations and resource context; these
are failed target measurements, not load-normalized successes. Checking normal
command timing after canonical adoption but before another full package audit
avoids paying for an expensive proof that a performance repair would invalidate.
The next repair must preserve every row payload and census record while reducing
unnecessary traversal work.


The first performance candidate used Array.filterMap with an Option-producing
callback and lost all 211 new provider judgments. The complete row comparison
rejected it despite a faster diagnostic time. At the pinned rc113 API,
Array.filterMap consumes Result; the existing Array.getSomes/Array.map pattern
preserves the Option contract. Typecheck a proposed helper substitution before
measuring it, and require full payload equality before accepting any speedup.
The rejected candidate and observation remain evidence, not a passing benchmark.

### R3 performance margin, 2026-09-10

The first traversal optimization preserves all 8,138 complete finding payloads,
132 JSONL files and the 1,110-path census. Its 288 focused cases, compiler, lint
and Fallow checks pass. Root's fresh ordinary-command cohort nevertheless takes
10.284s, 10.494s and 10.512s; all commands exit zero with stable inputs. CPU,
memory and I/O pressure are zero at the first observation, with load average
1.56 across 64 logical CPUs and roughly 66 GiB available memory. These are
target misses, with no load adjustment or discarded samples. Another bounded
traversal optimization is required before full package proof. Profiling and
full-payload equality should precede acceptance timing whenever reference
traversal expands; one fast diagnostic run does not establish the target.

A Root receipt script also referenced a nonexistent path alias and failed
before emitting its acceptance file. The timing driver then refused the
missing prerequisite without launching a scanner. Both failures are retained;
the path was corrected and the fixed three-run cohort above followed. Stop
dependent commands after an unsuccessful prerequisite rather than issuing
them in the same orchestration batch.

### Inventory not refreshed by the PR that added tests, 2026-09-11

While publishing the coverage-ratchet hardening (`fix/coverage-raised-rows-own-floors`,
PR #1091) the local Yeet cheap gate `lint:effect-vitest` went red with
`[effect-vitest] 93 new finding(s)` and no per-finding listing. Attribution by
content key (file, rule, symbol, evidence) against `HEAD:standards/effect-vitest.inventory.jsonc`
showed 90 of 91 content-new findings in the cache test files that #1068 added
(`packages/tooling/tool/cli/test/cache-*.test.ts`, `CacheQualification.policy.test.ts`)
and one in the branch's own test file (an EV006 `expect(...).toEqual(O.some(...))`,
fixed with `assertSome`). #1068 merged after the canon foundation (#1067) without
refreshing the inventory, so every publish from main has failed this gate since,
while the hosted lanes stay green because no hosted lane runs the linter. The
inventory refresh was left out of #1091 to keep the diff focused; it needs its own
`bun run beep lint effect-vitest --write` commit. What would have prevented it:
the linter printing the new findings grouped by file (the count alone forced a
hand attribution), and a hosted `lint:effect-vitest` lane or a main-push check so
a stale inventory reds the PR that introduces it rather than every later publish.

### Grouped ratchet report and a hosted seat for `lint:effect-vitest`, 2026-09-11

Follow-through on the receipt above. `bun run beep lint effect-vitest` now prints the
introduced findings grouped by file under the unchanged `[effect-vitest] N new finding(s)`
first line (one line per file in path order, then a total with the refresh command), so
a stale inventory names the change that added the tests instead of forcing a hand
attribution by content key. Exercised against origin/main e16e7a9297 from a fresh
`beep worktree new` checkout: the ratchet reported `2 new finding(s)` and the new lines
attributed both to `packages/tooling/tool/cli/test/quality-tasks.test.ts`. A `--write`
refresh from that head changed no content key at all (8,228 rows before and after,
0 gone / 0 added by `(file, ruleId, symbol, evidence)`), so the two rows were duplicate
fingerprints whose lines moved after the #1093 refresh and whose id-based membership
refuses to bridge; the 488/488-line inventory diff is id churn only.

Hosted decision: `lint:effect-vitest` joins the `lint:policy` step list beside
`lint:package-test-typecheck`, so the hosted Lint Policy lane runs it on every PR and
main push. The cheap-gates lane keeps the same step id (TTC ruling 28: one command, one
name across tiers), no hosted check name changes, and the cost is one full scan of about
8-10 s (R3 cohort 10.3-10.7 s, 8.0-8.3 s here) inside a lane whose measured wall time is
about 363 s. The alternative, a dedicated `check.yml` job like JSDoc Ratchet, would add a
new hosted check name and a runner spin-up for a 10 s scan; a note-only outcome would
leave every later local `yeet publish` as the first place a stale inventory is noticed,
which is the failure this receipt records. The same-tier repeat costs the local
`lint policy` proof one extra scan, matching how `lint:schema-first` already runs in both.

Second live case while this branch was open: main moved to 9292600368 and #1094 added
`packages/tooling/tool/cli/test/graft-deep-refresh.test.ts` without a refresh. After the
fast-forward the report read `1 new finding(s)` attributed to that file (EV010, a
`@effect/platform-node` import), and the refresh added exactly that content key with none
gone. With the hosted seat in place, #1094's own Lint Policy run would have been the place
that red surfaced instead of this branch.

### Refresh PR proof: seed-dependent acp falsification and an inherited coverage red, 2026-09-11

The inventory refresh itself (PR #1093, `chore/effect-vitest-inventory-cache` from
origin/main 662823dd96) was a one-file change, yet its `yeet publish --start-pr-early`
run produced three reds that all needed attribution before the PR could be called done.

Local full proof: `quality:coverage` shard 4 exited 1 on `@beep/acp#coverage`.
`test/protocol.test.ts:109` ("round-trips schema-derived JSON-RPC notifications and
responses through JSON boundaries") reported `Property falsified after 15 run(s) and
24 shrink(s)` with an `AssertionError` on a `result` payload. One rerun of
`bun run coverage --fileParallelism=true --maxWorkers=1` inside `packages/drivers/acp`
passed 3 files / 17 tests, so the red was attributed as a seed-dependent flake in an
untouched package and the PR was left to hosted checks instead of a second full proof.
The follow-up lane (PR #1096) found the cause was not the schema: Node 24's V8
(12.8 through 13.7) `JSON.parse` resolves an escaped object key through an existing map
transition when the raw source prefix matches, so some generated payloads decode to a
different key than they encoded; Bun and Node 22 are clean. `@beep/acp` now reads wire
frames through its own JSON text reader with pinned regression cases. What would have
prevented the attribution cost: the first red carrying the shrunk counterexample and
seed in the captured log, so a reader can classify "flake in an untouched package"
without re-running the suite.

Hosted: 34 checks green and `Heavy / Coverage Regression` red with six `@beep/repo-cli`
rows (`Lint.command.ts` branches/lines/statements, `Planner.ts`
functions/lines/statements). The rows were byte-identical to main's own red job at
662823dd96, so the red was inherited from #1068's raised floors (repaired by #1090 and
#1091, then #1104). Attribution recipe that worked: `gh run view --job <id> --log` on the
PR job and on main tip's job, `grep -A8 'regression(s) detected'` on both, and a plain
`diff`. A monitor that compared a red job's regression rows against main tip's job and
labeled an identical set "inherited" would have made that a one-line read.

Verdict noise: `verdict.json` listed `publish:03-pr-provenance-stamp: failed` with a
manual `gh pr edit` repair while the PR body already carried the provenance footer; the
log showed the stamp had preserved a concurrent body edit by Blacksmith. A stamp that
lost a race but converged should record `passed` (or a distinct `raced` state), not a
failure that invites an unnecessary repair.

## 2026-09-11 — P1 dependency-order command needs attribution

During P1 batch preparation, `bun run beep topo-sort` exited zero but emitted
`devDependencies`, `peerDependencies`, `dependencies` and `optionalDependencies`
as nodes and placed repo-cli before identity. Those dependency-section keys
are not workspace package names. Root is validating actual workspace edges
and SCCs before dispatch; no P1 audit assumes that this output is a valid
dependency-first schedule. A graph-contract test rejecting non-workspace nodes
and validating edge direction would have prevented this scheduling ambiguity.
The planning lane owns attribution; this receipt does not authorize a P2 fix.

## 2026-09-11 — Starting main has 90 new Effect Vitest findings

The first ordinary P1 check, `bun run beep lint effect-vitest`, exited 1 on
main `662823dd96`: `90 new finding(s)`. The current census is 1,012 tests plus
110 support files, with 8,228 candidates against the 8,138-row baseline. All
6,291 captured source inputs are unchanged and the source/package/config diff
is empty, so this is inherited from the starting main, not a P1 audit edit.
The refreshed census adds 12 recently merged cache-qualification tests. Root
retains the new detector rows and the unchanged baseline; P1 does not authorize
P2 remediation or a baseline increase. Requiring the normal detector ratchet
on the upstream changes would have prevented this inherited red.

This single ordinary check took 11.742 seconds wall time (scan 9.641 seconds).
It is not a new benchmark cohort or proof of the 10-second command target.
The prior accepted timing cohort remains historical; final performance needs
new unchanged-input evidence after the authorized migration work.

## 2026-09-11 — Hosted-history pagination and log-output guard

The P1 trailing-30-day workflow query contained 4,303 runs, exceeding GitHub's
1,000-result query cap. The collector partitioned the time window, paginated
each leaf and probed split boundaries; distinct run IDs reconcile to the
reported total. A single capped query would have silently omitted history.

Initial `gh api` job-log requests exited one with “the response contains
terminal escape sequences.” This was a local output guard, not missing hosted
evidence. Relevant test logs were retried with `--allow-escape-sequences` only
into private files, never to the terminal. Failed receipts remain preserved.
A collector that partitions capped queries and captures logs directly into
private files would have avoided both discovery delays. The first 30 failed
runs are an explicitly bounded slice; older failed runs remain a separate
attribution task, never evidence that those packages had no failures.

## 2026-09-11 — CIops timing worker cannot start under Node 22

The first plain Node 22 CIops timing invocation exited one with zero test
bodies and a threads-worker startup/termination error. Its package config
selects threads; shared config supplies `--js-float16array` for Node below24.
A direct Node22.22.3 worker_threads probe rejects that flag with
`ERR_WORKER_INVALID_EXEC_ARGV`. This is an inherited runtime/configuration
incompatibility, not a failing test assertion or a useful zero-test baseline.
Root retains the raw report and marks it ineligible pending qualification of
a supported package-local invocation. No global configuration, timeout or
property floor is changed. A runtime/pool compatibility check would have
prevented measuring worker startup failure as package timing.

## 2026-09-11 — No-findings rule IDs rejected by the public schema

The first three-file, four-lens audit emitted the charter-required `L-RES-NONE`,
`L-FLAKE-NONE`, `L-PROP-NONE` and `L-OBS-NONE` coverage IDs. The public finding
schema accepts only numeric lens suffixes, so it rejected all 11 coverage-only
rows; the one actionable row decoded. The exhaustive diagnostic command exited
zero, but explicitly reported blocked validation. Root retains that distinction.
A round-trip contract fixture for every charter no-findings shape would have
caught this foundation gap. A narrow schema repair is being prepared privately;
source bytes remain frozen during baseline timing. P1 acceptance stays pending.

## 2026-09-11 — Effect-drizzle Node timing cannot load Bun SQLite

The first plain Node timing for `@beep/effect-drizzle` exited one. Its reporter
lists 101 tests and zero failed assertions, but the SQLite integration suite
fails collection: “Cannot find package 'bun:sqlite'”. This inherited runtime
boundary prevents accepting a complete package baseline. The raw failed attempt
is retained; no suite is excluded and no runtime is silently substituted.
Runtime-specific integration requirements should be identified before defining
one package-wide timing command. Source remediation remains behind the P2 gate.

## 2026-09-11 — QA-capture exposes incomplete Bun API shims under Node

The Node baseline attempt passed 37 tests and failed four. Two collector cases
reach a native Bun HTTP adapter with a shim missing `hostname` (and `reload`).
A stale-owner fixture receives no child PID because the spawn shim discards it;
the existing required integer schema correctly rejects that fixture. Witness
bundle preparation references `fileURLToPath` before `build`, and neither API
exists on the shim. The generic “Bun.build threw” wrapper does not prove that a
native compiler executed. Raw evidence and separate causes are retained in the
timing failure inventory. A complete compatibility contract and preserved error
causes would have prevented collapsing these failures into one vague runtime
problem. No source change, fake handle, test exclusion or schema weakening is
used to obtain a passing baseline.


## 2026-09-11 — Private validator copy omitted module resolution

While validating the refreshed census with the repaired private helper, Root
copied its source/configuration into a new evidence directory but omitted the
existing workspace `node_modules` symlink. The bridge failed before decoding:
`Cannot find module 'effect/Schema'`. Restoring only that private resolution
symlink produced a valid partial result with no row or source changes. The
failed attempt remains retained. Future private-helper copies should include
an explicit module-resolution preflight and preserve the complete runtime
layout, not only the source-file manifest. No repository dependency install or
runtime reconfiguration was needed.


## 2026-09-11 — Concurrent progress metadata invalidated an audit preflight

The PACER/PGlite/Tailscale audit stopped before row decoding after Root updated
PLAN.md with accepted results from a disjoint package group. Its assigned source,
finding schema and P1/P2 gates were unchanged. The lane retained both plan
versions and the failed preflight, reviewed the progress-only diff and rebound
validation to the current hash. Parallel audit contracts should explicitly
allow Root-owned progress metadata changes while requiring gate comparison and
fresh validation hashes; they must not claim an unchanged whole-plan snapshot.
Batching public progress updates also reduces this avoidable retry.


## 2026-09-12 — Interrupted supervisors left stale audit status

Three audit status files still said running after their processes and supervisors
were absent and the original tool handle could no longer be joined. The retained
CLI event streams distinguish a completed driver audit from two turns that ended
with a usage-limit error. An absent supervisor leaves the outer exit unknown; it
must not be reconstructed as zero from a report or manifest. Root preserved the
original artifacts and terminal events, checked live account availability, and
resumed each context into a separate recovery directory for fresh validation and
terminal proof. A supervisor-independent terminal receipt and startup reconciliation
would prevent stale running states from delaying recovery or being mistaken for
live work. No failed or interrupted audit was promoted to accepted inventory.

The same supervisor mismatch recurred on September 14 for the Law Practice/Skill
Contract audit: the CLI stream completed and sealed its outputs, but the outer
supervisor join returned 143 and left stale running metadata. Original evidence
is preserved; a separate recovery directory obtains fresh validation and terminal
proof before acceptance. Inner completion is not relabeled as outer exit zero.
The Architecture Lab/Documents audit later showed the same outer143/inner-complete
mismatch. Its original records are also preserved and a separate validation recovery
is underway; the cause of the supervisor termination has not been established.


## 2026-09-14 — Exact package test names missed by history attribution

During the Tika source audit, the package history summary reported zero mapped
observations, but the retained completion evidence contains four package-null
property failures with test names beginning `@beep/tika` and the path
`test/Tika.service.test.ts`. The package digest preserves their job links and
historical heads. Root retained a separate attribution follow-up without
rewriting immutable collection evidence or inferring a current defect or flake.
An exact package-name fallback in test-name attribution, followed by a check
against package ownership, would prevent a misleading zero-mapped summary.
Historical source and counterexample comparison remains necessary before causal
classification. No timing or history collection was rerun.

## 2026-09-14 — Source-audit validation delayed by host waits

Root Editor inventory validation and two concurrent audit decoders remained
pending while their Bun processes were in uninterruptible `path_openat` waits.
A read-only process snapshot also showed unrelated applications and system
processes in uninterruptible waits. Memory pressure was elevated despite
available memory; these observations do not identify a root cause. No pending
validation was treated as a pass, retried concurrently or promoted to accepted
inventory. Bounded process-wait diagnostics and a host-health admission signal
would make this environmental delay easier to distinguish from decoder failure.
Original processes and evidence are preserved.

## 2026-09-15 — Progress-only PLAN drift repeated during strict audit validation

- Work: closing the Agents client/server and Architecture Lab proof source audit
  while Root accepted the disjoint Infra/Epistemic UI inventory.
- Evidence: the audit reported "Validation stopped at the input-integrity check"
  when PLAN advanced to 777 files across 130 packages. The reviewed diff changed
  progress prose and table entries; phase gates stayed unchanged.
- Response: retain the failed attempt and old input hashes, review the exact diff,
  then run fresh strict validation with separate receipts. No failed attempt is
  treated as a pass, and no input-integrity guard is disabled.
- Prevention: batch progress publication between audit validation windows, or
  separate frequently changing progress data from the immutable phase contract
  in a future authorized workflow change. The existing gate remains enforced.

## 2026-09-15 — Interrupted observation lost the audit supervisor

- Work: waiting for CLI source-audit batch 08 to finish and seal its evidence.
- Evidence: after an interrupted tool wait, the existing handle returned
  "Unknown process id". A fresh process snapshot showed the Codex audit still
  alive, with its Python supervisor absent and its recorded status still running.
- Response: preserve the surviving process and all partial artifacts. Observe
  completion directly; do not infer an exit code from the stale status file or
  restart a live audit. If the original exit remains unavailable, run a separate
  supervised recovery validation after it finishes and retain both histories.
- Prevention: retain supervisor lifetime across observation cancellation, or use
  durable process supervision that records the child exit independently of the
  observing tool session. This incident does not establish an audit failure.

## 2026-09-15 — Close-review bundle omitted cited evidence

- Work: independent Grok review of the complete P1 inventory and 40 sampled files.
- Evidence: findings P1-GROK-001 through 003 identified a missing timing source
  manifest, no explicit Desktop chunk-union artifact, and a CLI union snapshot
  whose acceptance flag predated whole-package acceptance. The later full strict
  validator already covered all 1,122 files; the earlier Desktop partial receipt
  was not a substitute for that proof.
- Response: preserve the original review snapshot and prepare a separate sealed
  supplement. Recover the timing manifest with its exact cited hash, verify the
  disjoint Desktop union against all 59 source files and 236 canonical rows, run
  fresh strict validation, and issue a CLI union successor linked to the accepted
  receipt. The completed independent review accepted this supplement on 2026-09-16;
  see `2026-09-16-p1-independent-review.md` for the dispositions.
- Prevention: before dispatch, resolve every cited evidence hash to supplied
  bytes and check that package-union receipts reflect the final accepted state.
  Keep historical partial receipts labeled and separate from completeness proof.

## 2026-09-16 — Consistency audit lacked helper implementation bytes

- Work: classify native property callback normalization across 147 candidates.
- Evidence: the first process exited zero after 24 inspections, with eight
  helper-contract cases unresolved because the frozen corpus omitted `Result.ts`.
  It also lacked the generator and run-count implementations needed for precise
  preservation claims. The other 123 files remained explicitly uninspected.
- Response: preserve that partial report, supply a separate hash-bound supplement
  from the pinned Effect commit and original timing manifest, and resume the same
  audit context. Exit zero is not semantic completion.
- Prevention: include the referenced callback helper implementations when sealing
  a focused review bundle; report assigned, inspected and resolved counts apart.

## 2026-09-21 — P1 evidence references in publication proof

- Work: publish the saved P1 inventory after integrating main and passing CLI audit/docgen.
- Evidence: full Yeet publication rejected 14 introduced semantic references and nine
  live host-path observations in the new inventory. The semantic report separately
  retained 500 unchanged findings. The introduced references were historical hosted
  coverage paths, generated declaration paths, and quoted test fixture literals.
- Repair: retain the exact historical evidence under packet history; distinguish
  captured paths from current source links and paraphrase fixture literals in live
  human rows. Preserve finding identities, counts, judgments and exact test assertions.
- Prevention: run knowledge reference checks on the assembled inventory before the
  expensive publication proof, with historical evidence separated from live guidance.

## 2026-09-21 — Inherited CLI coverage blocks the P1 checkpoint

- Work: prove the progress commit after repairing its knowledge references.
- Evidence: the second full Yeet publication passed the knowledge gates but failed
  the coverage ratchet. Four Codex Security modules lacked baseline identities;
  `Yeet.command.ts` measured branches 98.66 below 100 and statements 97.06 below
  97.21. All five source blobs were identical to the integrated main revision.
- Repair: add focused behavioral tests for uncovered Security paths and attached
  monitor failure propagation. Keep the existing ratchet floors and production
  behavior intact; root owns combined package verification and publication proof.
- Prevention: require the package coverage ratchet when landing new CLI command
  modules, and cover attached as well as detached command routing.

### 2026-09-21 — Run cheap gates before expensive coverage-repair proof

- While repairing inherited security coverage gaps, the new dispatch fixture passed
  focused tests but introduced resource-ownership and complexity findings.
- Evidence: `beep lint effect-vitest` initially found eight introduced rows; after
  fixture ownership repair it reported zero. `beep yeet verify --tier cheap-gates`
  then attributed two Fallow complexity findings to the new dispatch test.
- The in-flight package audit was interrupted before changing its inputs; no pass
  was claimed for that run. Simplify test setup and rerun cheap gates first.
- Prevention: sequence focused behavior checks, all cheap gates, then the costly
  package audit so newly authored fixtures do not invalidate an expensive proof.

### 2026-09-21 — Package audit does not cover every root test policy

- The full package audit and all cheap gates passed, but publication's root policy
  lane found two inline schema compiler calls and three Effect test diagnostics.
- Evidence: `beep(no-inline-schema-compile)`, `strictBooleanExpressions`, and
  `preferTypedSchemaDecoder` in the new security regression tests.
- Hoist compiled codecs, use the typed string decoder, and compare optional flags
  explicitly. Run the affected root checks before retrying the full proof.
- Prevention: include root test diagnostics and source-policy lint in the focused
  test-authoring loop; a green package audit alone does not establish policy parity.

### 2026-09-21 — New-file coverage requires every metric

- Publication coverage passed all tests and reached 100% lines/functions in the
  security bundle reader, but its new-file identity also required every statement
  and branch. An internal missing-entry branch remained after earlier manifest
  binding and digest checks had already guaranteed the required entries.
- Evidence: `Security.bundle.ts` reported one uncovered branch and statement;
  no other coverage regression remained in the full publication run.
- Preserve the typed fallback through the standard Option fold and verify all
  four metrics in the focused report before repeating full publication proof.
- Prevention: inspect the ratchet's complete metric contract, not only the first
  metrics reported in an earlier failed run. Do not lower or seed baseline floors.


## Backlog-first continuation friction

The full staged inventory validator stopped at a generated declaration under
`packages/foundation/modeling/schema/dist/internal/test/Markdown.test-kit.d.ts`
that was absent in the fresh worktree (`Not a regular contained source file`).
No canonical correction or completeness claim was made from that attempt. Keep
generated-artifact availability distinct from authored-test inventory coverage
when reconciling the deferred census delta.

The first package timing command assumed a package-local Vitest installation and
failed with `MODULE_NOT_FOUND` before tests ran. Using the root-installed Node
Vitest entrypoint from the package directory completed successfully. Resolve the
workspace runner explicitly for subsequent timing pairs.


## PN arbitrary pattern escaping

While replacing literal-only PN name generators with grammar patterns, the first
edit under-escaped the string form of a regular expression. Package verification
stopped during module loading with `Invalid regular expression: nothing to repeat`.
The corrected string escaping passes package audit and docgen, including new
Unicode and escaped-unit sampling regressions. Keep the generator regression
checks so parser compatibility and escaping errors fail before publication.


## Foundation adoption of the instrumented runner

P2 reached identity and found that test-utils depends on identity and schema,
including imports inside the runner's error definitions. Direct adoption of
`@beep/test-utils/Vitest` would create a package cycle. An upstream runner package
with compatibility re-exports would have made the original D7 implementation
adoptable by the foundation packages. Extract and prove that dependency boundary
before adopting it here; keep the foundation/modeling wave separate.

## 2026-09-22: presence-only helper guidance remains a judgment candidate

Applying the existing Vocab EV006 recommendation as nested `assertTrue` kept
the same Boolean predicate, but the compiler rejected it with
`TS377050 missedPipeableOpportunity`. The detector also classified that helper
call as a new EV006 occurrence and recommended itself. The pipeline form
preserves the decoder, Option predicate and true polarity while satisfying the
compiler. This is a reviewed presence-only assertion, not a payload comparison;
syntax disappearance alone cannot establish a stronger assertion. The inventory
recommendation should distinguish accepted Boolean-helper dispositions from
structural-helper migrations to avoid circular remediation guidance.

## Explicit roots for cross-worktree inventory checks

While validating the PR #1191 scanner against the PR #1188 runner, invoking
the scanner CLI from the runner working directory still selected the scanner
checkout: QualityArtifactSupport derives its default root from import.meta.url.
The scan was stopped without using it as integration evidence, then restarted
through the typed inventory writer with rootDir explicitly supplied. A root
flag and an emitted scan-root receipt would prevent ambiguous cross-worktree
validation and the wasted scan. Private output paths preserved both PR trees.

## Hosted coverage runner communication loss

PR #1191 at edc5f1d251 passed the required hosted gates, but the optional Coverage
Regression job failed with the GitHub annotation "The self-hosted runner lost
communication with the server." Its logs endpoint returned 404 and no coverage
regression was reported. Reran only the failed job in workflow run 35718534873;
no source or baseline change was warranted. Runner health telemetry would help
separate host resource or network loss from a test failure earlier.

### Scanner post-push proof: inherited lane-timings coverage gap

The full local proof for merged PR #1191 passed every lane except coverage.
`Ci/LaneTimings.ts` measured L/S/B/F 98.06/97.55/96.46/95.02 against
98.24/97.70/97.27/95.26 floors. The scanner diff touches neither this source
nor its tests. The uncovered fallback at line 2250 was introduced by #1186
(commit `6c412ed5a3`), which added ruleset-population rendering. Attribution
is narrowed to inherited coverage debt; a focused test proof is still needed
before claiming full causality. Do not lower the baseline. Keep any tooling
remediation separate from the runner extraction under D13.

The hosted coverage retry for #1191 again ended with the runner-lost-communication
annotation and no downloadable job log. That infrastructure failure is separate
from the locally measured coverage shortfall.
## Runner import detector prerequisite

The existing instrumented-harness recognizer names only the test-utils entrypoint.
A runner extraction must extend this recognizer before adoption, or the new
import path will silently escape test-body checks. Its regression suite now
covers both leaf entrypoints, aliases, namespaces, nested layers, shadowing and
non-tester exports. Keep this CLI change separate under D13.

The first test command was run from the repository root with a package config
whose include paths are relative to the working directory; it found no tests.
Running from the CLI package directory found the suite. The initial new negative
fixture used a nonexistent `it.TestHang` member; use the public namespace error
export when testing non-tester rejection.


## Detached publish availability

The early PR publication command rejected `--detach` because this session has no
active systemd user manager. No fallback job started. Publication continues with
the same canonical command attached to the live session, with its handle and log
saved for resume. A user-manager preflight would avoid the failed detached launch.

## Runner leaf extraction verification

Moving the runner unit suite requires carrying its serial execution order; the
fresh scaffold otherwise inherits concurrent execution, and the lifecycle-end
assertion reads unfinished shared test state. The new package preserves the old
suite order. The test service key also follows its new compiler-required path.

Native-runtime allowances are read from a generated repo-configs snapshot.
Moving only the JSONC file paths left the same three findings active until
`GenerateEffectLawsAllowlistSnapshot.ts` regenerated that snapshot. The exact
allowance reasons and categories are preserved. The package scaffold also emitted
an identity registry line requiring Biome formatting. These checks caught the
migration issues before publication.

## 2026-09-22: runner scaffold integration needs generated follow-through

The runner extraction passed its package audit but the first cheap-gate wave
stopped nine lanes at stale policy-fingerprint inputs. Regenerating those inputs
exposed missing project references and a scaffold `bun-types` entry that Knip
could not resolve. `beep tsconfig-sync` added the exact package references; the
Node Vitest package now requests only Node ambient types. The cache-policy gate
also required an explicit review of the added package and dependency edges,
recorded in `runner-leaf-cache-review.md` without granting qualification.
A create-package follow-through checklist covering these generated surfaces
would have found the issues before the repo-wide cheap-gate pass.

## 2026-09-22: attached prerequisite proof interrupted during coverage

PR #1185 passed hosted checks and `yeet monitor --until-ready` reported
`merge-ready: yes`. Its separate attached publication proof exited 130 during
coverage, so the earlier passing lanes do not establish a completed local proof.
A detached recovery attempt was rejected with `Detached proof jobs require an
active systemd user manager`, although the direct user-manager status probe
reported running. The supported attached verification fallback was started.
Consistent manager capability detection and durable launch would avoid losing
an otherwise progressing proof across session interruption.

## Runner extraction publication runtime failure

After restart, `beep yeet publish --start-pr-early --monitor --pr` failed in
Bun 1.4.2 with `panic: Segmentation fault` after advisory feedback, before a
commit or PR was created. The process remained in kernel core-dump handling;
it was observed rather than duplicated. Runtime crash isolation and durable
publication jobs would avoid losing the orchestration process before proof.
The shell also lacked the user-session bus environment, so detached launch was
unavailable and the supported attached route was used.

## New package generated-boundary coverage

The extraction passed all cheap gates, but full publication stopped at
`repo-sanity:fallow-boundaries-config`: the generated boundary configuration
did not yet include the new runner. `bun run fallow:boundaries:write` added
only the runner package and its expected dependency edges. Including this
generation in package scaffolding or its immediate verification would expose
the missing artifact before a full publication attempt.

## New package Vitest alias projection

PR #1188 review identified three missing runner aliases in the generated Vitest
alias data, although root tsconfig already carried them. Projecting root paths
into the generated artifact produced exactly those three additions and passed
the tsgo-rules check. Package creation should generate and verify this projection
alongside the existing tsconfig and boundary artifacts.

## Scanner traversal complexity feedback

The inline annotation correction passed package audit and docgen but the full
proof and hosted Fallow gate reported introduced complexity. An Option-based
AST traversal retained the four regression cases while removing the finding.
Running the affected Fallow audit before publication would expose this earlier.
The direct quality command needs an explicit base; the root wrapper expects
BEEP_PROOF_BASE to be populated by the proof environment.

## Fixture finalizer test typecheck

PR #1191 Heavy / Check found that the new acquireRelease fixture cleanup retained
PlatformError in its release channel. Focused runtime tests and the package quick
check had passed; the separate package-test-typecheck command exposed the mismatch.
The cleanup now uses Effect.orDie so removal failures fail the test without a typed
release error. All six focused tests, package-test-typecheck, and the quick package
proof pass. Include the package test typecheck before publishing new Effect tests.

### Full docgen rejects compatibility re-export headers

PR #1188 passed the JSDoc inventory ratchet but failed Heavy / Docgen because
four re-export headers lacked `@category`. The headers were in the runner
barrel and the three test-utils compatibility entrypoints. Added canonical
`testing` / `errors` categories; both affected package lint/check proofs pass.
The bounded docgen command refuses this branch because global inputs changed,
so use full `bun run docgen` for the validation. Inventory-ratchet success does
not establish the full docgen metadata contract.

## Wave A fast publication still queues before push

Publishing with `yeet publish --fast --monitor --pr` committed the reviewed
change but queued for full-proof admission before pushing. This defeats the
operator's early-push request despite passing package proofs. The owned queued
process was interrupted before it ran a proof; retry with the explicit
`--start-pr-early` route. Fast publication should avoid admission that is only
needed for the skipped local full proof, or document the remaining dependency.

### 2026-09-25 — Post-merge coverage exposes cross-file runner context loss

PR #1235 merged while its optional Coverage Regression job was still running. Job
107991558825 later failed in utils, identity, and wink. Identity is locally reproducible:
`CI=true bun run coverage -- --fileParallelism=true --maxWorkers=1` in `@beep/identity`
fails three PnLocal parameterized cases with `TestContextUnavailable`; the same file
passes alone with coverage. The isolated utils equivalence test passes, so attribution
there remains open. Wink reports runtime initialization `RangeError: Invalid string length`.

A multi-file, single-worker coverage conformance case for the instrumented runner
would have exposed this before broader adoption. Preserve the failing run and repair
the runner separately from the modeling-only utils wave; do not count the optional
coverage job as passing based on required-check readiness.

### 2026-09-25 — Coverage isolation attribution for utils

The full utils package coverage run reproduced the hosted private Node error
equivalence failure (one failure, 181 passes), while its file passed alone.
The package caches lazy built-in handles; earlier files populate those handles
before the test disables `process.getBuiltinModule`. Restoring package file
isolation preserves the runtime-boundary test and passes all 182 tests.
Full utils package verification also passes (audit and docgen). The shared
coverage optimization needs package-level isolation qualification for tests that
change runtime globals or depend on fresh module state. Wink independently
reproduces 12 failures; its isolation experiment remains separate evidence.

### 2026-09-25 — PR lookup hides GraphQL rate-limit attribution

During PR #1245 closeout, `bun run beep yeet closeout --summary
--require-review-comments 0` reported that the branch had no open PR. REST
confirmed the exact-head PR was open; a direct GraphQL review-thread read returned
`graphql_rate_limit`. Existing resolution evidence plus the REST review-comment
list confirmed no new follow-up, and exact-head checks were green before the
ready-for-heavy label was applied. Distinguishing API quota exhaustion from an
absent PR would prevent unnecessary local-proof fallbacks and duplicate PR work.

### 2026-09-25 — Schema adoption reproduces pending runner context prerequisite

After all 78 schema files adopted instrumented it, isolated Node and Bun unit runs
passed 725 tests. Package-only coverage with `--fileParallelism=true --maxWorkers=1`
failed 60 tests with TestContextUnavailable. The branch predates PR #1241's
per-suite registration fix. Keep this failure explicit, integrate the prerequisite
after its authorized merge, and rerun this exact mode before wave completion.
A prerequisite integration gate before shared-worker coverage would prevent
confusing passing isolated tests with successful cross-file context ownership.

## Schema-first inventory location drift during Wave C

While running `bun run beep yeet verify --tier cheap-gates`, five pre-existing
SFV4-arbitrary-tests advisories became both stale and untracked after test imports
shifted their line numbers (CurrencyCode, Fn, TerritoryCode, Transformations,
Unknown). Package audit did not exercise this root inventory gate. Preserve
existing dispositions while refreshing locations, and compare the generated
inventory structurally before accepting it. Stable finding identities independent
of import offsets would avoid this bookkeeping failure.

The generated `lint schema-first --write` result also dropped five unrelated
Models exceptions and replaced the five moved exceptions with advisory status.
That output was not accepted wholesale. Only the five regenerated line numbers
were applied to the original inventory; every original reason and status was
retained. A generator that preserves reviewed dispositions across location-only
changes would prevent this manual reconciliation.

## PR 1252 external reviewer unavailable

The `openclaw/pr-review` check failed before publishing any advisory review.
Its check-run output reports `402 Payment Required: Grok Build usage balance
exhausted`. There are no inline review findings to repair from this attempt.
Keep this separate from code failures and do not claim review closure; the
external reviewer needs available quota before a retry can produce evidence.
Vercel deployment failures separately report the daily deployment rate limit.

## Wave D publication API quota and reviewer failure

Yeet early publication pushed the codegen checkpoint, but `gh pr create` failed
with `GraphQL: API rate limit already exceeded`. REST created PR #1255 against
its schema parent. `yeet monitor --until-ready` then reported no open PR despite
REST confirming the branch PR. Preserve that distinction: a REST fallback or
explicit API-error attribution would prevent misclassifying quota as absent work.
The first hosted OpenClaw check failed before review with `402 Payment Required:
Grok Build usage balance exhausted`; it produced no findings to remediate.
Neither API availability nor the stacked PR's skipped checks establish readiness.

## Colors property equality semantics during canonical assertion migration

The initial `assertSome(decoded, processLike)` replacement failed on a generated
empty environment with a null prototype. `assertSome` uses strict deep equality,
whereas the original Vitest `toEqual` law compares its values without requiring
that prototype. Preserve canonical Some presence assertions and the original
full-value `toEqual` separately; do not narrow the ProcessLike generator.
Node reproduced the mismatch after 36 runs and three shrinks. A migration rule
that distinguishes presence checks from payload equality semantics would prevent
this accidental strengthening.

## Cosmos hoisted vendor mocks require the direct Vitest API import

Moving `vi` from `vitest` to its public `@effect/vitest` re-export caused Vitest
5 to reject CosmosProjection before test registration: `There are some problems
in resolving the mocks API`. The error requests a direct import or globals.
Retain the direct vi import with an EV011 exception for hoisted Graphology/Sigma
mocks. A detector hint that distinguishes hoisted vendor mocks from ordinary
runner imports would prevent this non-equivalent rewrite.

The added failure-cleanup probe initially ran as a separate test and observed
three vendor kill calls instead of one: shared Vitest configuration enables
concurrent tests. Both cases mutated the same vendor state/global stubs. Keep
normal and failure cleanup probes within the existing renderer test, preserving
one fixture owner; do not disable concurrency across the package or loosen the
exact kill assertion.

## Schema runner-context reproduction resolved after prerequisite merge

After PR #1241 landed, merge `654e80230f` incorporated the runner fix. The same
schema package-only shared-worker coverage command now passes 725 tests across
78 files, exit 0, with no TestContextUnavailable failures. The prior 60 failures
remain documented above as pre-integration evidence. The integration receipt is
`history/2026-09-25-schema-runner-integration.md`.

## Stack merge resolution must fail closed

During runner integration, the cache baseline's synthetic merge-base blob
contained conflict markers and could not decode as JSON. The resolution command
lacked fail-fast shell handling, so later staging and commit steps still ran.
The unpublished merge was corrected and amended before any push; verification
compared the real parent projections and preserved the eight codegen-only
dependency changes. Use fail-fast sequencing and validate both JSON and conflict
markers before staging. Existing commit hooks did not reject these markers.

## Graph3D browser runner imports Node AsyncLocalStorage

The original Chromium renderer suite passes five tests. Switching its tester to
@beep/test-runner fails before collection with `NodeAsyncHooks.AsyncLocalStorage
is not a constructor` in VitestInstrumentation. Keep real browser proof explicit;
Node/Bun conformance does not establish browser compatibility. Resource and click
changes are being proven with the upstream live tester while browser-compatible
instrumentation remains an open prerequisite. A browser import/conformance case
in runner promotion would have caught this platform boundary earlier.

### Reviewed exception identities after a test-title correction

While checking the Graph3D wave, `bun run beep lint effect-vitest` reported three
new EV004 findings in CosmosProjection.test.ts. The inherited source only changed
a test title after its scoped exceptions were reviewed; all three occurrence
identities changed. Preserve the scope decisions and refresh their identities in
the owning lane. A focused post-title ratchet check would have caught this before
stack propagation. Evidence: graph3d partial-proof receipt dated 2026-09-25.

### 2026-09-25 — review reply blocked after evidence remediation

Tailscale PR #1265 has both provenance corrections pushed in a7fe3d14a4,
but `bun run beep yeet reply` failed before posting either saved draft:
`GraphQL: API rate limit already exceeded`. The reply report confirms no
partial publication; both threads remain unresolved pending a whole-run retry.
A quota-aware repository-identity cache or scoped retry after reset would avoid
blocking already prepared replies on a redundant repository lookup.

### 2026-09-25 — offline SQL mock stopped intercepting the current adapter

During the test-utils retry-readiness migration, an explicit attempt counter
observed zero calls to the existing `pg.Client` mock, although the old test still
reached its expected typed failure. The current SQL adapter uses its native
connection path instead. Waiting on the unused mock exposed the stale test seam.
The test-only repair targets the adapter public `PgClient.makeClient` entry point
while retaining the real test-utils layer/retry implementation. A mock-hit assertion
and exact twenty-retries-plus-initial-attempt check would have caught this drift
when the adapter changed. Production code remains outside this repair.

## Markdown CLI resume report-root mismatch

Resuming the read-only preparation session for bounded assertion edits did not
retain the additional writable private report directory. The child stopped
before writing its required report or editing source because approvals were
disabled. Start a fresh bounded CLI lane with explicit worktree and report
write roots; do not turn this into permission prompts or treat the stopped
resume as implementation progress. A resume launcher should verify and restore
all required writable roots before dispatch.

### Markdown detector command spelling

During the Markdown final ratchet check, `beep lint effect-vitest --check` was
rejected with `Unrecognized flag: --check`. The default command is already the
check mode; rerunning without that flag passed. An explicit check-mode example
in the command help would prevent borrowing flags from adjacent lint commands.

### Detached proof user-manager environment

The Markdown cheap-gates launch reported `Detached proof jobs require an active
systemd user manager` before starting a job. The user manager was confirmed live;
rerunning with the documented XDG_RUNTIME_DIR and DBUS_SESSION_BUS_ADDRESS
restored the supported detached path. A launcher diagnostic distinguishing
missing session environment from an unavailable manager would avoid ambiguity.

### Exit error projection discards mixed Cause reasons

Supplemental Markdown review traced installed rc.117 Exit.mapError to first-error
selection. Controls reproduced acceptance of expected typed failure plus a defect,
interruption or additional failure. Cause.map preserves those reasons. Grounding
Cause preservation in implementation and mixed-failure controls, rather than an
API name or pure-failure example, would have prevented the overbroad assertion
claim. The same projection pattern is being repaired in the open HTML wave.


### 2026-09-25 — reference checkout ahead of installed Schema aliases

While migrating HTML's runtime-boundary tests, the Effect reference checkout at
3495bd8858 exported UnknownFromJsonString, but installed effect 4.0.0-rc.117 did
not. `bun run beep quality package-verify @beep/html` rejected that alias with
TS2551. The test uses the supported equivalent `S.fromJsonString(S.Unknown)`;
no dependency upgrade or diagnostic suppression is needed. API grounding should
pair reference-source inspection with an installed-export check whenever the
reference revision and lockfile release differ.

### 2026-09-25 — Effect snapshot preview failure and exhausted retry quota

After merging main into PR #1277 at 38c00919ba, full effect-drizzle package
verification passed, but OIP's Vercel preview failed webpack compilation on
Effect's isBetweenLength and onExitUnsafe exports. The new exports exist in the
local snapshot; the hosted build restored a previous deployment cache. A retry
of that exact preview through the deployment API with forceNew=1 was rejected
with HTTP 402, api-deployments-free-per-day. No new deployment was created.
The cache hypothesis is unproven, and the original build failure is not a
rate-limit-only deployment failure. A cache-free preview retry after quota
reset, with installed-package provenance, would separate stale cache from a
snapshot packaging/bundler regression without weakening merge gates.

## Shared OIP preview failure reproduced on Graph3D

After PR #1275 merged main at a8649df330, its OIP preview failed with the same
Effect snapshot import error already observed on #1277: `isBetweenLength is not
exported from ../Schema.js`, through `effect/dist/http/Multipart.js`. Evidence:
`vercel inspect` build log for deployment EKAyZWoQTqxhHYoJ4JGV52fVt7UE, saved
privately as pr1275-oip-current.log. Graph3D package audit/docgen and version-sync
passed locally. This proves the hosted failure is shared across both branches;
it does not yet identify stale build cache versus another bundler/install issue.
The separate Todox failure is explicitly rate limited. Do not classify OIP as
the rate-limit exception. A clean preview build with inspected package exports
would distinguish these causes; the prior no-cache deployment request remains
quota-blocked, so it was not retried here.

## HTML frozen/current detector identity drift

At package closeout, the frozen HTML ledger had 177 rows while current main's
baseline had 181; only 85 ids were shared. Line-based identities moved as main
changed. Preserve the union as 273 historical identities, not 273 distinct
findings, and remove only HTML baseline rows after a fresh zero scan. Four
retired wrapper ranges extended beyond their shorter canonical property files;
re-anchor those rows to the replacement property blocks while keeping original
ids and evidence. A stable occurrence key with explicit source-revision/span
provenance would prevent this reconciliation ambiguity.

### Generated SDK missing compiled declarations during docgen

HTML full proof failed infra docgen on TS1205/TS1294/TS4114 in generated
@pulumi/gharunners. Identical sources passed on main because its bin declarations
existed; the worktree lacked them. The SDK's existing build script restored the
ignored declarations and infra docgen passed 101 examples. Install/preflight
should check for this generated SDK output before starting a repository proof;
a missing build artifact must not be mistaken for a request to weaken TS rules.

### 2026-09-25 — Main merge introduces Fallow health debt into a docs checkpoint

- Activity: republish modeling inventory PR #1273 after merging main, preserving
  its docs-only diff.
- Evidence: `bun run beep yeet publish --start-pr-early --monitor --pr` pushed
  successfully, then cheap gates failed only `fallow:health`. The report lists
  five complexity findings in `MonitorLoop.ts` and `yeet-check-fidelity.test.ts`,
  both byte-identical to origin/main and landed by PR #1270. The Effect/Vitest
  ratchet passed. This is inherited tooling debt, not a modeling inventory defect.
- Prevention: require the Fallow health baseline check on the final merged result
  of tooling PRs, and retain file-level provenance in the failure envelope; its
  current `not-applicable` attribution requires manual comparison with main.
- Disposition: keep proof red; repair tooling in its separate D13 lane rather
  than modifying the modeling checkpoint or waiving the gate.
### 2026-09-25 — GitHub quota interrupts heavy-admission observation

After the graph-3d browser prerequisite passed Chromium and package proof,
`gh pr checks 1274` returned `GraphQL: API rate limit already exceeded`.
No heavy-admission label was applied without observing the remaining Property
Laws result. A shared quota-aware read cache would reduce duplicate PR polling
across active workstreams; local implementation and proof can continue meanwhile.

## Runner dependency and receipt generation

`bun add --dev @beep/test-runner@workspace:^` wrote workspace:* in Chalk,
which Syncpack rejected. The manifest was corrected and verified. The generator
should preserve the workspace protocol policy. Separately, PR #1282 review
found that its scoped dependency projection retained an inherited Graph3D
review receipt; a package-specific receipt and hash now identify its Provenance
edges. Dependency reconciliation should require a matching review basis.

## 2026-09-26 — unrelated proof-job timeouts block HTML coverage

While closing HTML PR #1279, Heavy / Coverage Regression failed in two
`test/proof-job.test.ts` job-wait wave-return cases with `Timed out waiting for
proof job`. The HTML diff changes neither that test nor ProofJobLauncher.
Evidence: GitHub run 36216289583, job 108333072900. The unchanged focused command
`bunx vitest run test/proof-job.test.ts -t 'job wait wave return' --coverage`
passed all four selected cases (81 filtered out) in 10.68 seconds. Only the
failed hosted job was retried; that retry is not yet passing evidence. The
existing full local proof remains active and its inputs were left intact.
A deterministic timing seam for wave-return tests, or stronger failure telemetry
for their bounded waits, would make coverage-load failures easier to attribute.
No timeout increase, retry configuration, CLI source change or waiver was made.

## 2026-09-26 — Box audit regenerates an invalid SDK operation

During the Box scope phase, `bun run beep quality package-verify @beep/box`
regenerated bindings from installed SDK 10.16.0 and failed audit with TS6133:
`signal` is declared but never read in generated Box.operations.gen.ts.
The generator always renders `(decoded, signal)` although getCachedUploadPart
has no cancellationToken or optionalsInput argument. The test changes do not
alter generator inputs, the package manifest or the lockfile. Docgen passed;
test typechecking and all 32 configured tests pass on the committed bindings.
The generated diff was retained as evidence and generated files restored.
A generator regression case covering SDK methods without cancellation arguments
would have exposed this before the mandatory package audit. A separate narrow
repair requires the operator's production-code exception; no waiver was made.
## 2026-09-26: Observability charter retained the old runner import

Preparing the twelve recorded Anthropic, OpenAI, OpenAI compatibility, Venice,
and xAI tests exposed a stale All Seeing Eye charter: it still directed new
adopters to the historical test-utils/Vitest subpath. Current merged test
suites use the accepted test-runner package. The charter now names that public
package while retaining the historical rc.112/rc.113 evidence and semantics.
Updating consumer instructions in the runner extraction PR would have prevented
new remediation lanes from repeating the obsolete import.

## 2026-09-26: Scoped test typecheck did not prove package audit diagnostics

OpenAI compatibility scope migration passed its configured nineteen tests and
package-test-typecheck, but mandatory package-verify failed in beep:check:tests
with five TS377083 nestedEffectGenYield diagnostics. Removing layer provision
left redundant nested generators on error-capture paths. These diagnostics are
introduced by the test refactor, not inherited source failures. The repair
inlines the redundant generator boundary while retaining Effect.flip on the
failing operation and the same error assertions. Running the package's actual
audit check path before handoff would have caught this distinction earlier.

## 2026-09-26: Git signer socket failed after green provider proofs

Saving the OpenAI, Venice, and xAI phase repairs failed after all commit hooks
passed: `1Password: Could not connect to socket`, followed by `failed to write
commit object`. The prescribed op-doctor check found the automation backend
healthy, but the configured Git signer still failed. The source changes are
preserved in the index and a private patch; signing was not disabled and no
credential was exported. A signer-health preflight distinct from automation
secret-backend health would have exposed this publication boundary earlier.

### 2026-09-26 — Markdown proof reaches an unbuilt generated SDK

The full Markdown proof stopped in infra docgen with TS1205, TS1294 and
TS4114 under the installed Pulumi gharunners SDK. Its source, package
manifest, build script, infra docgen config and compiler matched main, but
its compiled `bin/index.d.ts` was absent. Running the SDK's existing build
script restored the declarations; infra docgen then passed all 101 examples.
No production source or compiler policy changed. Bootstrapping the generated
SDK before admitting a full proof would have prevented this failed run. The
full proof still requires a new successful run after main integration.


### Markdown full proof: guard compilation and timing metadata

The full Markdown proof rejected two inline NonEmptyArray safety-violation
guards and three private timing output paths in root Lint Policy. Hoist the
unchanged guard once and redact those destinations as `<private-output>`.
Focused root-policy checks before publication would catch these conditions
that package verification alone did not reject.

## 2026-09-26: Ready proof-job waves raced a negative-path deadline

Coverage on PRs #1277 and #1279 failed in the proof-job wave-return tests
with `Timed out waiting for proof job`. The tests reuse a 60 ms live-clock
deadline both to assert that unrelated or already-returned rows do not wake
a waiter and to read an already-persisted matching wave. The latter path
includes real filesystem reads and acknowledgement writes, making coverage
load part of the result. A separate tooling-only follow-up will distinguish
the negative timeout oracle from event-driven positive completion, preserving
the existing runner deadline, row isolation, deduplication, and acknowledgement
assertions. No retry, global timeout increase, or coverage-baseline reduction
is authorized by this receipt.

The completed local Drizzle proof also reports coverage deficits in Yeet
Inbox, InboxView, Remediation, and WatchStream. These are separate from the
hosted timeout and are being attributed against the completed coverage data.
Keeping positive event observation separate from a deliberately short negative
wait would have prevented the timing race; keeping terminal coverage artifacts
would preserve attribution across simultaneous PRs.

### 2026-09-26 — File-hash receipt mistaken for an API token

The NLP baseline commit hook reported generic-api-key findings for the SHA-256
of `Core/Token.ts` in both before/after source maps. The value is a locally
computed source hash, not a credential. Public receipts now represent each hash
as an explicit `{ file, sha256 }` entry, preserving every path/hash pair while
avoiding the misleading token-named JSON key. No scanner rule or gate was
disabled. A typed manifest-entry format would avoid this ambiguity at capture.

## 2026-09-26: Graph walker composition diagnostic

While adding NLP graph payload laws, package verification rejected the nested
Graph.edges/Graph.values/Array.fromIterable expression with
missedPipeableOpportunity. The equivalent graph.pipe(...) sequence passed.
Use pipe for multi-stage walker extraction when constructing future graph
assertions; this avoids a package-audit round trip without changing coverage.

## 2026-09-26: Property migration compiler feedback

NLP package audits caught a nested schema/arbitrary call with
missedPipeableOpportunity and a lifted nested generator with
nestedEffectGenYield. Use the equivalent pipe form for schema generation and
flatten adjacent sequential generators while preserving evaluation order.
Both repairs passed full package verification; no lint suppression was added.

## 2026-09-26: Commit signing socket unavailable

After NLP property verification and all commit hooks passed, git commit failed
with "1Password: Could not connect to socket" and "failed to write commit object".
The prescribed op-doctor passed its service-account, path, and mode checks;
one retry failed at the same signing step. Verified edits remain staged with
a private patch backup. Agent secret-backend health does not prove signing
socket health. Signing availability should be checked before long save cycles.

## 2026-09-26: HTML full-proof policy findings

The HTML early-publish full proof reached lint policy and found two inline
JSON schema codec compilations in Html.security.test.ts plus three gated
external-mirror references in timing command metadata. Both were introduced
by this migration. Hoist the unchanged codecs and explicitly redact only the
private output directory in published command receipts. Package verification
does not cover these root policy gates; include focused oxlint and knowledge
reference checks before the next full proof.


### Runner dependency protocol preflight

The Provenance full proof rejected the newly added runner dependency because
Syncpack requires workspace:^ while the install command had requested workspace:*.
The same uncommitted addition existed in NLP and MCP kit. Correct the manifests
and run Syncpack immediately after adding workspace dependencies; cheap gates
and package verification alone did not expose this pin policy.

## MCP kit assertion reconciliation

The final detector pass found the inherited SanitizedSpan parent Option assertion
still open after the assertion phase. Replaced its structural Some equality with
assertSome using the unchanged parent operand. A detector check at each phase
boundary would have caught this before final timing collection; the prior final
measurements are preserved and a new measurement is required for the repair.

## MCP kit census scope drift

The authoritative `beep lint effect-vitest --census` emits both
`src/test/Conformance.test-kit.ts` and the generated
`dist/test/Conformance.test-kit.d.ts`, beyond the earlier test-directory delta.
Partial validation therefore reports 28 missing lens entries, not 20. A
source-aware delta against the full D9 census would prevent that undercount;
the generated declaration requires scope reconciliation before final coverage.
### Provenance scope migration: pure service overrides

The scope-phase package check rejected two test-local Effect.provide(Layer)
applications with TS377032 (strictEffectProvide), although the focused tests
passed. Both fixtures construct pure Crypto values, so Effect.provideService
preserves their per-case behavior without a nested Layer boundary. The corrected
full package verification passed. Classifying pure service overrides before
replacing scoped helpers would have prevented this failed check.

### Drizzle full-proof follow-up: compiled codecs and private output references

PR #1277 full proof reached Lint Policy and rejected eight inline schema compiler
applications in the SQLite properties and two private timing-output references.
Hoist the unchanged insert/update codecs and guards to module scope, and redact
the timing command output destination as `<private-output>`. Package proof alone
did not cover these root policies; running the focused root policies before
publication would have caught both failures earlier.

## 2026-09-26: Existing UI precision counterexample still reproduces

While selecting the next existing inventory wave, the admitted UI property row
was checked against current main. SpinParams.make({ precision: 101, step: 1 })
accepts the value; both numberToString(1, 101) and the number-input blur helper
throw RangeError: "toFixed() argument must be between 0 and 100". No production
change or narrowed generator was made. The schema/runtime precision contract
needs a separately authorized repair before this finding can close. Aligning
public schema bounds with the formatting API would prevent this mismatch.

PR #1300 also exposed transient GitHub discovery failure: GraphQL reported a rate
limit while the REST endpoint confirmed the open PR and matching head. The
readiness monitor terminated with "requires an open pull request". Its result
was acknowledged; the publisher remains live. Preserve the original API error
in discovery diagnostics to distinguish quota failure from a missing PR.

## 2026-09-26: timing hash keys trigger secret scanning heuristics

The observability baseline commit was rejected because file-path-keyed SHA-256
receipts containing HttpApiTelemetry matched the generic API-key heuristic.
The flagged values were verified source hashes, not credentials. Store the same
path/hash facts as explicit `file` and `sha256` records, as in earlier waves,
so public proof remains complete without weakening the scanner or adding ignores.

## 2026-09-26: subprocess shim hides cancellation ownership

The observability compiler-boundary scope review found that the configured Node
Bun.spawn shim returns only an exit promise. Adding a Bun kill finalizer would
therefore typecheck against Bun while failing under the configured Node runner.
The subject is real compiler validation, so use the existing native Effect
process service for the same commands and fixtures, with its shorter child scope.
Preserve command ordering, exit assertions and deadlines. Documenting the shim's
minimal contract alongside scope-migration guidance would prevent this mismatch;
no shared shim or production change is required for this test ownership repair.

## 2026-09-27: publisher retained proof capacity while watching hosted checks

PR #1287's publisher completed all 33 reported local proof lanes successfully,
then entered its GitHub check watch while other publishers still reported that
process as the merged-preview reservation holder. A dedicated until-ready monitor
was started and confirmed live before stopping the completed publisher's watch.
The saved proof remains intact; no failing job was bypassed. Release proof
reservations before remote-only monitoring so finished local work does not keep
other exact-head proofs waiting.

## 2026-09-27: Effect test adapter overload differs from plain Vitest

The observability scope conversion initially retained Vitest's options-before-body
argument order. The installed Effect adapter accepts the body second and options
third; typecheck caught all three Boundary registrations. Moving the same timeout
objects preserves the two 60-second and one 600-second budgets. Removing obsolete
provider wrappers also exposed three nested generators to nestedEffectGenYield;
flattening them preserved every assertion and capture order. Check adapter
overloads and generator adjacency during mechanical registration migrations.

## 2026-09-26: Assertion helpers expose branded payload and composition requirements

The observability assertion-only checkpoint passed its configured Node and Bun
suites, but package verification caught a branded expected status mismatch
(TS2345) and three nested-call composition diagnostics (TS377050). The repairs
construct the same literal 503 with NonNegativeInt.make and use equivalent
pipe composition for the three Option predicates. No expected value, domain or
production behavior changes. Including the package test compiler in the
assertion conversion checklist would expose these constraints earlier.

## 2026-09-26: Traced Cause annotations affect strict Exit assertions

The observability witness checkpoint initially used assertExitFailure with a
fresh unannotated Cause for trackDuration and profilePhase. Both failed only
on installed Effect stack annotations; the original error payloads were intact.
The new witness now requires a Failure Exit, exactly one Fail reason and the
independently supplied original payload. No original assertion was removed and
no annotation was stripped. The untraced HTTP witness retains complete Cause
comparison. A testing guide example distinguishing semantic payload preservation
from runtime Cause annotation identity would prevent this mismatched oracle.

## 2026-09-26: Codec composition and hosted API quota

The Observed codec pilot passed its full generated domains and pinned cases,
but package verification rejected two nested toCodecJson/fromJsonString calls
with TS377050. Equivalent schema.pipe(...) composition preserves the same
codec and passed the next validation. Use pipe when hoisting composed codecs.
Separately, refreshing the goal PR set reached the GitHub GraphQL rate limit.
Required hosted readiness remains unverified while quota is unavailable; local
work continues. Sharing a bounded PR-state read across active monitors would
reduce redundant quota use without relaxing any merge gate.

## 2026-09-26: Runner lifecycle logs enter logger-subject captures

The observability trace-on pilot failed four exact logger assertions because
runner start events reached the subject arrays (three instead of two records,
two instead of one, and an extra Info level). Moving the subject layers inside
the body passed both trace modes but violated strictEffectProvide. The five
logger-subject cases therefore retain native harness layer ownership and hook
budgets as explicit instrumentation exceptions; ordinary cases adopt the runner.
No capture was filtered/reset, assertion weakened or compiler rule suppressed.
A separately approved runner facility for isolated logger subjects would remove
this adoption constraint without changing the tested logging behavior.

## 2026-09-26: Nested property assertion missed before registration

Final admitted-inventory reconciliation found one generated redaction-law branch
still using expect(O.isNone(safe.detail)).toBe(true). The earlier assertion pass
missed this nested callback, so the later property checkpoint preserved its old
syntax. Replaced it with assertNone on the identical value and retained the
branch, input domains and run floor. A per-package residual detector review
before leaving the assertion phase would have caught this missed conversion.

## Observability runner dependency publication parity

PR #1300 Repo Sanity failed because adding the test-runner development dependency
also requires generated project references and an in-range changeset. The hosted
`beep tsconfig-sync --check` named two package reference files; changeset-status
named @beep/observability. This was introduced by the runner integration. Run
`beep tsconfig-sync` and `beep quality changeset-status --since origin/main`
before each future runner publication to catch both together.

## Runner dependency generated-boundary follow-up

After TypeScript sync passed on PR #1300, the next Repo Sanity stage found
`standards/fallow.boundaries.generated.jsonc` stale. The runner development
dependency adds exactly two allowed-boundary entries for the owning package.
Regenerated with `bun run fallow:boundaries:write`; no boundary policy or
unrelated package entry changed. Include this command beside tsconfig-sync
when admitting the runner dependency in later waves.
## 2026-09-26: Cache merge must preserve dependency multiplicity

Merging the provider wave with main used a set to combine task dependency lists.
That removed six duplicate utils transit edges, causing cache audit configuration
drift despite unchanged task configuration. The current census and main both
retain those edges. Restored their exact multiplicity; future merge checks must
compare dependency multisets and serialized lists, not just membership. The
provider proof queued on the incorrect metadata was cancelled before correction.
### Business-driver assertions: preserve observation and branded expectations

During the assertion phase, a provisional FreshBooks full-Cause comparison
introduced a stricter singleton expectation and failed on stack annotations.
The original oracle observes the first typed error. Preserve that observation
with `Exit.match`, `Cause.findErrorOption` and native `assertSome`, retaining
all original class and payload checks without reconstructing the cause.

USPTO package verification then rejected four raw string expectations with
`TS2345` because native assertion helpers enforce the branded payload type.
Use the existing `NonEmptyTrimmedStr.make` constructor for the unchanged literal
values. A small preflight against the actual test compiler would catch this
introduced typing error before the full package audit. Neither failure
justifies a production change, weakened assertion or quality-gate waiver.

### 2026-09-26 — Pure test stubs and strict Effect provide diagnostics

The CLI/config scope migration removed redundant scoped-layer wrappers and
used direct `Effect.provide` for verified `Layer.succeed` test stubs, as D14
permits. Full package proofs for `@beep/ai-provider-cli` and
`@beep/architecture-lab-config` rejected those calls with TS377032
`effect(strictEffectProvide)`. The packet exemption does not imply checker
acceptance. Move ownership to the test harness without suppressing diagnostics
or rebuilding a manual layer wrapper. Preparation should check both D14 and
the active language-service diagnostic before recommending a direct stub
provide; this would have avoided a failed proof in each package.

### 2026-09-26 — Runner trace events reach a fixture diagnostic logger

The CLI snapshot trace-enabled proof failed its exact diagnostic log record:
runner `start`/`end` events reached a logger installed for the entire harness
layer. The production diagnostic payload was unchanged. Keep the full exact
assertion and supply the logger reference only around the provider call;
runner lifecycle logs remain outside that capture. A trace-enabled example
for exact logger assertions would prevent this scope mismatch. The first
attempt used the deep-property environment floor, which excludes this
non-property file; its zero-test exit was rejected as proof and the real
13-test snapshot suite was run without that filter.

### 2026-09-26 — Media ledger evidence length and detector runtime

The seven-file media wave's first strict ledger validation rejected several
`evidence` fields longer than the schema's 200-character limit. The findings
and source dispositions were retained; concise evidence belongs in that field,
with fuller explanations in `reason` and `replacement.sketch`. Checking the
field length during report-to-row conversion would prevent this repair pass.

The normal Effect/Vitest ratchet passed with `introduced=0 resolved=0`, but
reported `scanMs=24656.5` across 1181 files. This does not satisfy the goal's
under-ten-second detector target. Concurrent workstation load is recorded in
this wave's timing receipts; no performance improvement or target waiver is
claimed from a passing ratchet.


## Database test migration compiler feedback

While moving the existing DuckDB wire-format fixture into an Effect test,
`package-verify @beep/duckdb` rejected the unchanged JSON.stringify oracle
with TS377026. The installed Schema declaration also lacked the
UnknownFromJsonString convenience export present in the reference source.
The compatible public expression is S.fromJsonString(S.Unknown); using its
Effect encoder retains the independently specified expected wire payloads.
A pinned example checked against the installed declaration surface would
have prevented both edit/proof iterations. This is migration-tooling friction,
not evidence of a production codec defect.


## Generated infra SDK declarations missing after lane install

The media wave's full proof stopped in infra docgen on TypeScript diagnostics
inside node_modules/@pulumi/gharunners. Source and docgen configuration matched
main; main passed its 101 examples while the worktree lacked bin/index.d.ts.
Running the dependency's existing build script restored declarations, after
which the same infra docgen command passed. No tracked source or compiler rule
changed. An install preflight checking generated file dependencies for their
declared build artifacts would prevent this expensive late-proof failure.
The full proof was resubmitted; focused docgen alone is not full proof credit.

## Reproof after an already published clean head

Four SDK-repaired lanes retried `yeet publish --start-pr-early` after their heads
had already reached GitHub. Each stopped before proof with "requires reviewed
staged changes or a clean local commit ahead". The correct recovery is a
standalone detached verify plus an until-ready monitor at the existing head.
A publish recovery hint distinguishing an already-pushed head from missing work
would avoid these discarded proof submissions. No empty commit is needed.

## 2026-09-26: ACP scope wrapper cleanup

The ACP scope phase removed manual context provision and cleanup, leaving two
result-capture generators with a single yielded effect. Full package verification
reported TS377083. Flattening the redundant generators preserved the exact effects
and assertions; the next full audit and docgen passed. Include this compiler check
when removing fixture wrappers so redundant generators are caught in the same phase.

## 2026-09-26: ACP diagnostic level verification

ACP package verification passed with debug-level phase events, but a temporary
TestConsole positive control under BEEP_TEST_TRACE=1 captured the runner start
and none of those events. The current minimum log level filters debug messages.
Promote only the static phase events to info and repeat positive/negative capture
controls before crediting observability. Package behavior alone cannot establish
that the intended diagnostics are visible. The temporary probe was restored.

## 2026-09-26: ACP inventory line-count convention

The first strict ACP inventory validation rejected refreshed census line counts
although all 55 rows were schema-valid and every lens had coverage. The source
validator counts the terminal newline differently from splitlines. Use the
public validator's line-count convention when refreshing both census entries
and whole-file spans; do not weaken validation or alter source to fit metadata.

## 2026-09-26: Repository-config trace selection guard

The temporary compiler diagnostic trace probe initially used an inaccurate test
name. Vitest exited zero while selecting no tests; the receipt's exact count
check rejected both positive and negative runs. Source was restored byte for
byte. Read the actual registered name from the JSON reporter and rerun that
case. Reusing reporter names instead of reconstructing them prevents this
false-positive verification path. No product test or deadline was changed.

## 2026-09-26: Inventory line-count convention

Repository-config strict validation rejected census line counts that included the
trailing empty line. Use the active validator bridge's source-line count rather
than inheriting a previous wave's newline convention. Preserve file bytes and
membership, correct only owned counts and spans, and rerun the unchanged
validator. A shared count function in receipt generation would prevent this
off-by-one evidence drift.

## 2026-09-26: Repository-config changeset gate

The first repository-config cheap-gate run passed fourteen lanes but rejected
`quality:changeset-status`: the versioned workspace needed an in-range changeset
even though this wave changes tests and their development dependency. Add a real
package patch changeset, then rerun the gate. Check release-policy classification
before publication instead of inferring exemption from a private package flag.

## 2026-09-26: hosted lint runner communication loss

While continuing the existing repo-utils inventory, PR #1287 job 108491528753
(Heavy / Lint Policy) failed with the annotation “The self-hosted runner lost
communication with the server.” No workflow step reported failure and the job
log was unavailable while its parent run continued. This is an environment
failure, not evidence of a lint defect. Preserve sibling running jobs and retry
only the failed job once the parent run completes. Durable runner health and
resource telemetry would make this attribution quicker and more precise.

## 2026-09-26: assertion helper prototype semantics

The repo-utils assertion phase exposed a test-helper compatibility boundary:
`assertSome` uses Node deepStrictEqual, while existing Vitest toEqual checks
compare decoded Schema.Class values to independent plain-object expectations.
Package verification caught prototype-only mismatches for PersonObject,
WorkspacesObject, BeepDriverMetadata, RepositoryObject and TSConfigReference.
Keep the original complete comparisons wherever this boundary applies and record
exceptions; do not manufacture class expectations or project away prototypes.
A helper migration checklist that compares equality semantics before replacement
would prevent this failed proof. No production defect was demonstrated.

## 2026-09-26: focused Vitest selector needs result-count validation

The repo-utils flake-control focused Node command exited zero while selecting no
tests because its assumed composite names did not match the runner's filter
semantics. The expected-name/count guard rejected that run; its report remains
a diagnostic artifact with no passing credit. Select the actual existing test
titles and validate all six expected full names in the resulting JSON before
accepting focused proof. Process exit zero alone is insufficient evidence.

## 2026-09-26: independent nested layers must retain independent memoization

Repo-utils runner adoption changed a formerly standalone nested layer call into
a callback-local it.layer call. The new Workspaces positive control caught reuse
of its outer native FsUtils service against an inner memory fixture: the package
proof had 231 passing cases and one introduced failure. Keep formerly standalone
registrations on an unshadowed root runner alias, preserving independent memo
maps and all original fixture/assertion semantics. No production defect was
demonstrated. A runner migration checklist should distinguish lexical nesting
from inherited layer composition before changing the registration receiver.

## 2026-09-26: a second hosted runner communication loss

PR #1285 coverage job 108491590575 failed with the GitHub annotation “The
self-hosted runner lost communication with the server.” No workflow step reports
failure, so this does not establish a coverage regression. Preserve other jobs
and allow one job-specific retry after the parent run finishes. Together with
PR #1287's earlier runner loss, this reinforces the need for retained runner
health/resource telemetry; the available annotations do not identify the cause.

## 2026-09-26: historical and current detector identity collision

Repo-utils reconciliation found a repaired browser-map assertion and a retained
bugs-object assertion sharing one line-based EV006 ID after source movement.
Their occurrence hashes differ. Unique-ID validation caught this before tracked
application. The current detector ID remains canonical; the historical occurrence
and fix SHA are retained in `repo-utils-inventory-lineage.json`. A reconciliation
preflight should check ID collisions across historical and current generations
before assigning fixed credit or replacing current exceptions.

## 2026-09-26: schema inventory line drift after runner imports

The repo-utils cheap gates rejected a stale golden-test exception at line 14
after the public runner import moved its anchor to line 15. Regeneration found
the new anchor but demoted the reviewed exception to an advisory because identity
includes the line. Preserve the existing golden-test rationale and all unrelated
entries; carry only the generator-confirmed line change. The focused schema-first
check then passed. A post-import inventory preflight should detect moved anchors
and retain reviewed dispositions rather than resetting them on line drift.


## 2026-09-26: generated boundary parity after test-runner adoption

PR #1291 passed TypeScript reference synchronization but Repo Sanity then failed
with `standards/fallow.boundaries.generated.jsonc is stale`. The same drift was
reproduced locally on #1290. The boundary generator added only each touched
package's test-runner dependency to its value/type import lists. Run both
tsconfig-sync and fallow:boundaries:write after changing workspace dependencies,
then check both generated surfaces before early publication. Package audit alone
does not establish this repository-level parity.

### Service-driver property preparation: optional redacted generator branch

Sanity's added token-present property initially filtered the default config
arbitrary for a present token. Package audit failed with `Property exhausted
after 0 run(s) and 501 discard(s)`. This is an introduced generator construction
error, not a production counterexample. The field accepts `S.String` wrapped
in `RedactedFromValue`; compose the existing valid token-absent config arbitrary
with a generated string and `Redacted.make` to cover that branch directly.
The original seven laws remain intact. Full package proof and the400-run
fixed-seed property lane pass after this repair. Check branch reachability
before relying on optional transformed-schema generation for coverage.

## 2026-09-26: runner dependency project references

PR #1290 Repo Sanity failed with `tsconfig-sync: drift detected (8 file change(s))`
after test-runner devDependencies were added. Package audit and docgen had passed,
but they did not establish generated project-reference parity. Run tsconfig-sync
and its check after adding runner dependencies, before early publication. The
service-driver wave applied the generator to its six affected configs as well.

## 2026-09-27: fleet readiness polling exhausted GraphQL quota

Refreshing the active canonical Vitest PR fleet encountered `API rate limit
already exceeded` during review and readiness queries. The GraphQL rateLimit
query confirmed zero remaining requests; the REST rate-limit endpoint reported
a different available bucket. Local proof and early pushes remained intact.
Several detached monitors had also reached their lifetime or registration
limits and required explicit resubmission. Preserve terminal receipts, avoid
restarting live handles, and gate fresh review/merge decisions on recovered
GraphQL evidence. A fleet-aware polling budget and a directly exposed next-poll
control would prevent parallel monitors from exhausting shared account quota.

## 2026-09-27: Option helper exposed prototype-sensitive expected fixtures

The Pretext assertion phase replaced an Option-wrapped loose equality matcher
with `assertSome`. Both Node and Bun rejected the line-range expectation because
the subject returns `LineRange` instances while the original independent expected
values were plain objects. Package audit also identified two introduced nested
call diagnostics. Preserve every numeric expected operand, construct matching
expected values through the existing public model, and use the pipeable predicate
form. A matcher-semantics review must include schema-class prototypes, not only
payload fields, before counting a constructor-shaped assertion as migrated.

## Pretext native browser proof friction (2026-09-27)

A scoped Vitest Chromium probe for the runtime profile fence failed during Vite
dependency optimization: `Cannot destructure property exportsData`. Disabling
discovery in the private probe exited 1 with zero cases, so it earned no browser
proof credit. Configured Node/Bun package proof and a controlled Chromium
user-agent counterexample pass. A qualified browser unit-test harness would avoid
this setup detour without changing the package's native canvas subject.

## Early publication retry after GraphQL exhaustion (2026-09-27)

Pretext's early publisher pushed its reviewed head, then `gh pr create` failed
with `API rate limit already exceeded`. After quota recovery, retrying the same
canonical early-publish command refused because no local commit remained ahead
of the publish remote. No full proof had started. A subsequent required merge
from main supplied a meaningful new commit and publication created PR #1303.
A retry path that recognizes an already-pushed reviewed head with no PR would
avoid coupling PR-creation recovery to another branch change. Preserve the
normal proof and provenance gates; this receipt does not authorize bypassing them.

## 2026-09-27 — unused helper dependency after runner migration

Pretext PR #1303 hosted Knip job 108563381090 rejected the manifest because
`@beep/test-utils` became unused after the test migration. Package audit/docgen
did not flag this repo-level dependency condition. The repair removes the unused
dev dependency, regenerates lockfile and TypeScript references, and reviews only
the removed cache dependency edges. A runner-phase check for dependencies made
unused by removed helper imports would have prevented the delayed CI feedback.

## 2026-09-27: native subprocess signal absence differs across runners

The lint-rules observability Node run failed with `Schema validation failed`
when the new process-error guard treated absent signals as undefined-only.
`vitest.setup.ts` forwards Node's `result.signal`, which is null on normal
termination; Bun declares its corresponding field optional. Normalize nullish
signal absence at the harness boundary before validating the error payload.
This preserved the native subprocess subject and made all 78 cases pass on both
runtimes. Running both runtimes before publishing caught the mismatch that the
configured Bun-only package audit did not.

## Consolidation: strict ledger decoding finds inherited malformed rows

The root detector ratchet passed while aggregate strict ledger decoding found
two inherited rows rejected by the shared schema: OBS evidence exceeded200
characters, and a CLI flake row used a descriptive noncanonical rule ID.
Both files matched main before repair. Decode every row with excess properties
rejected before committing ledger updates; root ratchet success alone does not
validate all human inventory families. Stable finding IDs and fix evidence are
preserved by the narrow metadata corrections.

## M365 assertion helper composition

Replacing assert.isTrue(O.isSome(first)) with the native assertTrue helper
exposed TS377050 missedPipeableOpportunity during package test typechecking.
Use pipe(first, O.isSome, assertTrue), retaining the original Boolean observation
and subsequent payload branch. The focused package audit catches this policy
diagnostic even when runtime assertions are equivalent.

## Consolidation lockfile protocol normalization

Adding the next three runner dependencies caused Bun to normalize the existing
MCP-kit lock entry from workspace:* to workspace:^. Its manifest already used
workspace:^, and no version or resolved package changed. Preserve the manifest
policy in the generated lockfile and check lock entries after workspace protocol
repairs; a frozen install had not exposed this metadata discrepancy.

## Timing receipt hash-map false positives

The commit secret scan interpreted SHA-256 source hashes under OnePassword
file-path keys as generic API keys. Each value was verified against the local
source bytes. Encode source hashes as explicit file/sha256 records, preserving
the values and avoiding ambiguous credential-like field names. No secret-scan
rule, allowlist or bypass was changed.

## 2026-09-27: Branded Option payload in native assertion migration

Workspace Domain package verification rejected `assertSome(option, 12)` with
TS2345 because the option carries a branded TurnId. The original oracle used
the numeric literal 12. Explicitly select the safe numeric supertype with
`assertSome<number>` to preserve that exact expected value without a cast or
new decoding operation. Review branded operands before mechanical migrations.

## 2026-09-27: Vitest root flag does not select the package property configuration

Launching workspace property proof from the repository root with `--root`
returned exit zero but `No test files found`. That observation earns no proof.
Run from each package directory instead and inspect passed-test counts, not
only exit status. The shared property filter depends on package context.

## 2026-09-27: Assertion migration left an unused import

The architecture-lab UI assertion phase removed its last Option use but retained
the namespace import. Package verification and the commit hook rejected it with
noUnusedImports. Remove the unused import, then repeat the affected package proof
before committing the phase. Check terminal results before writing pass receipts.

## 2026-09-27: Recording fixture callbacks require Effect.fn

Architecture use-case verification rejected a recording create callback with
TS377047 (effectFnOpportunity). Name both recording create/get effects with
Effect.fn and explicit schema-derived argument types. Run service-shaped test
fixtures through the same Effect rules as production methods.


### Server property boundary and hosted SQL isolation (2026-09-27)

Migrating scanChunk into an Effect property exposed TS377026 at JSON.stringify.
The diagnostic recommends a removed UnknownFromJsonString export; installed rc.117
instead provides fromJsonString(Unknown). Use that codec without narrowing generated block
shapes or changing exact slice/order equality. Package verification caught the
boundary diagnostic before publication; migration review should check raw JSON
calls entering Effect callbacks.

PR #1307 head aa7c7a1447, Heavy / Test Integration job 108590652002 failed both
Drizzle integration cases with neutral_notes missing/already existing. The
consolidated change adds a second fresh layer under a concurrent suite. The
external PostgreSQL lane must be reproduced; fresh Effect layers alone do not
prove physical session/schema isolation. Preserve both transaction tests and
repair ownership after attribution. Local in-process success did not exercise
this external backend. A baseline/fix proof on that backend would have caught it.


### Vitest mock hoisting import boundary (2026-09-27)

Agents Server runner verification and Node timing failed before collecting all
six kernel tests: "problems in resolving the mocks API". Re-exporting vi from
@effect/vitest prevents the installed Vitest hoist transform from resolving it.
Keep only vi imported directly from vitest; beforeEach/describe/expect stay on
@effect/vitest and registration stays on the instrumented runner. No globals
configuration change. Ledger the proven import-boundary exception; do not count
the partial 21-test timing as a successful baseline or after result.


### Domain inventory drift and precise runner migration (2026-09-27)

Scoped reconciliation in LawPracticeDomain found four current Result.succeed
assertions absent from the older saved package detector rows. Preserve the
existing active-client/founder/patent-application/pre-filing expected literals
with assertSuccess, then merge the original root rows into the package ledger.
Do not equate exhausting an old per-package list with exhausting its current
owned-file findings. The initial property formatter also reported one unused
Arbitrary import in Contradiction after replacing its direct runner; remove it
before claiming package proof. Both were caught before publication.

Installing the two runner dependencies normalized the already configured
@beep/provenance runner workspace range from * to ^ in the lockfile; its manifest
already uses ^. No provenance source or qualification change is included.


### Skill Contract assertion export boundary (2026-09-27)

The package audit caught TS2724 after importing assertTrue from @effect/vitest.
The installed adapter exports the helper from @effect/vitest/utils. Correcting
the explicit import restores the full package audit and docgen. Consult the
installed utility barrel before grouping new assertion imports.


### Property proof environment typo (2026-09-27)

The Skill Contract elevated property command used BEEP_FC_RUNS=400, while
fcRuns reads BEEP_FC_NUM_RUNS. That pass did not establish the claimed floor.
Rerunning with BEEP_FC_NUM_RUNS=400 and BEEP_FC_SEED=20260708 passes all
47 tests. A direct helper probe confirms runs 400 and seed 20260708. Recent
Law Practice (50), Epistemic (64), Agents Server (4) and architecture proof (2)
selected properties also pass fresh commands with the explicit correct variable.
Record exact environment maps with proof receipts to prevent ambiguous claims.


### Native fixture timing snapshot overlap (2026-09-27)

Repo-docgen timing overlapped its package audit. The tests passed, but the
source hash snapshot included the audit's temporary copied fixture source,
which correctly disappeared before the second snapshot. Exclude that timing
observation and rerun after the audit. Exact-source timing should serialize
against tests that create temporary sources under the audited tree.


### Parser test layer boundary (2026-09-27)

Replacing private Layer.build helpers with Effect.provide(layer) triggered
TS377032 strictEffectProvide at eight parser call sites. The correct boundary
is suite it.layer(Path.layer), with pure per-case Source/configuration values
in Context. This removes manual builders without suppressing diagnostics or
sharing source nodes between tests. Full package audit/docgen pass afterward.


### NLP graph witness uses public topology (2026-09-27)

The cost-scaling test draft referenced getLeafNodes from the public graph module,
but that helper is private to the executor. Package typecheck caught TS2339.
Use public getChildren to prove two terminal children and retain the exact
numeric time/token relation; no production export is needed. The corrected
package audit and docgen pass.

## OpenClaw fixture service keys

The first recorder isolation package check rejected two new test service keys
with TS377049. The compiler supplies the exact deterministic file-qualified
keys; using those keys repairs this introduced test-only error. Following the
existing integration fixture key pattern would have prevented this iteration.

OpenClaw property preparation also caught a stale Option.fromNullable API
reference (TS2339). The fixture already needs a head Option, so Array.head
provides the exact operation directly. Using the live helper rather than a
remembered nullable conversion avoids the unnecessary intermediate value.

## Langextract native assertion typing

The assertion migration exposed an optional array access and an unbranded zero
that broad matchers accepted. Use the existing Array.head/Option.getOrThrow
path to require the candidate, and NonNegativeInt.make(0) for the same expected
number. Include the required imports in the same edit; missing imports caused
an avoidable second typecheck failure. All original cardinality checks remain.

Langextract native property conversion exposed nested Effect.gen yields
(TS377083) where old runSync calls had hidden runtime boundaries. Inline the
array/envelope encode-parse steps in the parent generator, preserving their
order and separate equivalence checks.

- File Processing platform registration: `quality package-verify @beep/file-processing` rejected a test-only `node:path` separator import with `TS377057 effect(nodeBuiltinImport)`. Use the runtime platform at registration and assert the injected Path separator inside the POSIX body. A documented native-test platform registration example would prevent this detour.

- Doc Text property edit: a private ts-morph CallExpression replacement included a trailing statement semicolon and failed with `children ... expected to have the same count`. No source was saved. Keep replacement text at expression granularity and check the mutation exit before starting validation.

- FFmpeg native prerequisite reporting: full package check caught `TS377114 mapSomeToAsSome` and `TS377117 preferSucceedSomeOrNone`. Replaced the generic Option wrappers with `Effect.asSome` and `Effect.succeedNone`; keep these current RC helper idioms in test examples as well as production guidance. A temporary context-skip probe also needed an absolute cleanup path because its runner used the package cwd; the probe was removed before final validation.

### FFmpeg fixture complexity caught only by full proof (2026-09-27)

The package audit passed, but the full publish at `9cea1eee92` failed both
Fallow health and audit on the scripted capture spawner (cognitive 11). The
new first-frame exit witness added branches to an existing dispatch callback.
Use an Option match for the optional output target, keeping output writes and
the successful-exit Deferred together. Run both root Fallow gates for this
fixture repair; do not weaken the complexity policy or the staging witness.

### Tika timing export must distinguish skips (2026-09-27)

The private timing exporter initially accepted `pending` but Vitest5 emits
`skipped` for dynamic context skips while counting them in `numPendingTests`.
The exporter stopped before publishing the after summary. Accept the explicit
status, omit skipped cases from slowest-executed rankings, and retain separate
passed/skipped counts and the historical no-op caveat in timing context.

### QA Capture cleanup-control temp root (2026-09-27)

The private failure-control harness assumed `/tmp`, but the workstation routes
native temp directories through its configured cache directory. All nine scoped
roots were removed correctly; only the harness parent-path assertion failed.
Preserve that report and use the runtime temp-directory setting when validating
ownership before cleaning the unscoped control's exact recorded roots.

## QA Capture continuation: fixture and verification harness friction

- While strengthening capture assertions, a private mutation harness traversed
  stale ts-morph nodes after replacing a parent expression. Evidence: the
  submitted-sequence control raised `node that was removed or forgotten` before
  running tests. Selecting registrations before mutation and applying edits in
  reverse order completed the controls; the harness restored exact source bytes.
- A preservation harness tokenized whole files containing template literals and
  falsely reported a missing unchanged assertion. Comparing parsed call-expression
  tokens instead verified all 117 originals. Use AST-selected fragments for these
  receipts rather than a bare whole-file scanner without template rescanning.
- Removed the unused Effect import left by the planner property migration after
  package verification reported TS6133. The corrected full package proof passed.
- The hosted Heavy / Lint Policy job for PR #1307 reported eight inline schema
  compilations across DuckDB, OpenClaw and lint-rules tests. All eight are additions
  relative to main. Package audits alone did not exercise the root oxlint policy;
  include the policy check before publishing future test batches.

- During the hosted lint repair's line remap, two current detector IDs were
  already owned by the historical resource ledger. A detector-local ID index
  added duplicate entries; strict global validation rejected them before commit.
  Preserve the original family ownership and consult the global ledger ID index
  when joining fresh detector rows. The corrected ledger passes uniqueness.

## Lexical property adoption: test-evidence discovery

- The canonical `it.effect.prop` migration preserved test titles, but the real
  conformance-ledger validation reported two titles as undeclared. The scanner
  admitted only one method suffix. A focused fixture now includes plain and
  effect properties through both `it` and `test`; the old scanner fails exactly
  that registration. Supporting the additional `.prop` suffix restores the real
  artifact check. This is test-evidence tooling support, not an application-code
  or ledger-ID change.
- The private generator codemod initially found zero yield nodes in non-generator
  callbacks: the parser treats the temporary syntax outside a generator context
  differently. A second explicit wrapper pass repaired those callbacks before
  verification. Assertion, fixture and native editor-call conservation checks
  plus the full package proof guard the transformation.
- Native pure-property failures print shrunk inputs and run/shrink counts without
  necessarily printing the seed. A control harness initially overrequired the
  word `seed` after the expected assertion failed. Receipts now preserve the
  actual diagnostic and explicit `BEEP_FC_SEED=20260708` replay environment;
  they do not claim the failure text contains a seed when it does not.

### Libpff adapter and control-harness diagnostics

The saved native-layer migration initially passed generator functions directly
into `it.effect`; package verification rejected them with TS2345. Keeping the
existing `Effect.fnUntraced` wrapper fixes the adapter shape. A preservation
check confirms the original assertions and fixtures survive that correction.

The property control harness expected the literal word `counterexample`, while
this native effect adapter reports `Shrunk input:` and `Replay:`. The skip
control likewise expected `pending`, while dynamic `context.skip` reports
`skipped`. Both harness assumptions were corrected against the actual JSON
reports; failing mutations still fail their intended registrations and the
original source bytes are restored. A shared diagnostic normalizer covering
these reporter variants would prevent repeated harness-only failures.

### Pandoc migration receipts and inherited JSON boundary

Moving the arbitrary-future-JSON law into an Effect generator exposed TS377026
on its existing `JSON.stringify` call. The current public compact JSON schema
codec supplies the equivalent wire encoding; the input arbitrary and decoded
roundtrip equality remain unchanged. The first package proof reports the policy
error, and the corrected full proof passes.

The codemod found nine generic throw/rejection expectations, including two in the
mapping suite, while its assertion expected seven codec-only cases. It had
already saved source before writing receipts. Replaying the transformation from
the committed source in an in-memory project recovered all nine receipts without
reapplying edits. Future transforms should validate complete input counts and
persist their receipt before any source write. All nine before/after controls
reject unexpected successful operations.

The strict-projection fault fixture must import `vi` directly from `vitest`.
Moving it to the Effect re-export typechecks but Vitest's hoisted `vi.mock`
transform rejects the module with “problems in resolving the mocks API”. The
original direct import is restored as a reviewed exception; the public Effect
runner still owns registration. Detector guidance should distinguish ordinary
`vi.spyOn` calls from hoisted `vi.mock` bindings before suggesting this rewrite.

### Wink native layer migration exposes redundant generators

Removing test-local provider wrappers exposed two existing nested `Effect.gen`
blocks in the bundle and toolkit-result cases. Full package verification rejected
both with `TS377083` (`nestedEffectGenYield`). Inlining their bodies preserves the
same acquired services, stream drain, result binding and assertions. A resource
migration preflight should flag generators whose only boundary was the provider
being removed; this avoids a preventable full audit round trip.

The Wink conservation receipt initially counted both a complete assertion and
its nested `expect(...)` call in the fixed-seed smoke test. Filtering by the call
expression before matching assertion syntax corrects the original count from
107 to 106. Historical before/after source comparisons still preserve every
assertion. Future receipts should identify matcher calls structurally instead
of treating expression-text matches alone as distinct assertions.

### NLP MCP recording-client proof needs construction-time injection

While strengthening the saved SSRF test, inspection of StreamingHandlers showed
that handlers capture their HTTP client when their layer is built. A client
provided only around an already constructed handler call would miss the subject.
A native recording-client fixture now constructs the actual handler layer with
that dependency. Its public-host positive control traverses the toolkit and
increments the counter without opening a socket.

The initial test-local Layer provision failed the repository's
strictEffectProvide diagnostic. Moving construction to native layer registration
preserves the service boundary. The direct loader can also return PlatformError;
its failure must be narrowed before encoding DatasetLoadError. Decode the type
side with S.toType here: applying the wire decoder to an already-decoded error
misinterprets its Option-valued cause and fails with "Expected JSON value".
A test-repair checklist distinguishing captured service contexts and decoded
values from wire inputs would have prevented these audit round trips.

### Branded Option expectations need an explicit comparison domain

Law Practice Tables assertion migration initially failed package verification:
`assertSome(returned.reference.number, "7654321")` inferred the branded
PatentNumber payload, so the literal expected string failed TS2345. The original
oracle compared this same textual value. An explicit `assertSome<string>` keeps
that comparison and the exact payload without a cast or fabricated branded
value. The restored package audit and docgen pass. Including branded payloads in
the assertion migration checklist would have prevented this failed proof cycle.

### Package proof omitted the manifest-order gate

PR #1307 Repo Sanity on the NLP MCP batch failed `repo-sanity:sherif` because
Wink and NLP MCP development dependencies were not alphabetized after adding the
runner. Local reproduction found exactly those two manifests. Sorting only their
development-dependency keys preserves every dependency value and the generated
scripts; Sherif now passes all 143 packages. Add this root check to the batch
publication sequence: individual package audit/docgen does not run it.

### Resource-sharing controls need a defined state transition order

The Workspace Server negative control combined two originally independent vault
fixtures. Under concurrent scheduling it passed without establishing that the
configured state existed before the missing-root case. Making only the control
sequential reproduces the unwanted shared state and fails the original
post-failure absence assertion. Production tests remain independently layered;
all control edits were restored. Future isolation controls should define the
prior state explicitly instead of relying on registration order.

### Saved assertion counts lagged the owned live file

The Epistemic Tables migration guard expected 31 saved assertion candidates but
found 33 equivalent shapes in the current files. Two newer typed-converter
failure checks had appeared in EpistemicTables.test.ts. Reconstructing receipts
from the saved source head confirmed both operands were conserved, along with
all 272 original assertion expressions and labeled tampering diagnostics. The
batch now records both the saved count and the live count. A count preflight
before applying a mechanical transform would have avoided the guard failure;
this does not require restarting the whole-repository human inventory.

### Line-sensitive schema inventory drift after runner migration

The Epistemic Tables early-push proof failed `lint:schema-first` because the
existing ExecutionRecordTables exception moved from line 52 to 53. The inventory
writer treated the new position as a fresh advisory and also reordered unrelated
entries. The repair preserves every existing status and rationale and updates
only the owned line; the full schema-first check passes. Run this root gate
before batch publication, since package verification does not cover this drift.

### Preserve semantic failure evidence without comparing trace annotations

Dock's capture witness initially compared the whole Exit against a newly built
failure Cause. The real fixture carries Effect tracing annotations, so deep
Cause equality rejected the same typed error value. Decode the extracted error
against its runtime type schema and assert its operation/message instead. This
retains failure-completion evidence while avoiding incidental stack metadata.
For timeout controls, pair the JSON reporter with the default reporter: the
JSON-only failure contained a generic Error stack but omitted the timeout text.

### Root lint must settle before final timing capture

Dock package verification passed, but root Oxlint rejected the inline runtime
error decoder with `no-inline-schema-compile`. Hoisting it preserved behavior and
cleared the rule. The earlier timing capture had already completed, so its
receipts were retained and final measurements were captured under a new phase
name after the fix. Await every root-check result before committing and timing
final source; package audit alone does not prove root custom rules.

### Cleanup probes must distinguish test mounts from internal Atom lifetimes

The Agents Client lifecycle probe initially treated every intercepted registry
mount as test-owned and required zero immediately before disposal. Actual Atom
runtime mounts can survive until registry disposal, so that oracle overreached.
The corrected probe checks zero active mounts and disposed registry after scope
completion, retaining pre-disposal counts as diagnostics. The assertion-failure
control distinguishes the repaired scope from the original cleanup-after-asserts
path. File receipts were needed because this test environment suppresses console
output; AST probes should insert after declaration spans rather than comment-
sensitive statement indices. All temporary source instrumentation is restored.

### Audit every nested scenario boundary during scoped resource migration

The first Agents Client pass scoped two named helpers but missed four nested
scenario helpers whose registries previously ended before return. Ordinary tests
and post-suite cleanup probes passed because the outer test eventually disposed
them. An AST ownership audit found all six helpers; return-boundary probes now
pass and reject the intermediate version in four tests. Preserve and test the
shortest original resource lifetime, not just eventual suite cleanup.

## Agents Client storage capability during flake repair

The exact-key restoration edit initially assumed `globalThis.localStorage`
existed. `quality package-verify @beep/agents-client` reproduced a TypeError
at the acquisition read under Bun, before the original defect assertions ran.
The root setup only supplies its shim for the unsupported Node getter case;
absence is legitimate in this test environment. Capture the storage capability
once and restore the exact key only when it exists. Validate both capability
states and preserve actual draft atom behavior; never clear all storage.
An explicit runtime capability note in the saved inventory would have prevented
the assumption. This is an introduced test repair, not a product regression.

The first delayed-RPC control delayed the shared fixture decoder, including
its call before atom mounting. That also changed registry setup lifetime and
produced an HTTP transport error rather than isolating RPC completion. Moving
the temporary delay inside the two actual RPC handlers leaves setup intact:
all three new tests pass and all three old fixed-yield tests fail. Keep mutation
controls at the behavior boundary they are intended to measure.

## Agents Client release-metadata gate mismatch

The consolidated publishing proof rejected Agents Client because its new direct
runner dependency lacked an in-range changeset. The earlier generic
`bunx changeset status --since=origin/main` passed; it is weaker than the required
`bun run beep quality changeset-status --since origin/main`. Add the package
changeset and use the exact repository gate for subsequent package closeouts.
This was introduced by the runner dependency, not an environment failure.

## Dock React bindings after scoped disposal

The first resource package proof identified three TS6133 bindings whose only
use had been a manual disposal tail. Preserve their `yield* mount(true)` calls
and remove only the unused bindings. The next full package proof passes.
A resource rewrite should inspect references when removing disposal tails,
including multi-graph tests that need an intermediate scope boundary.

## Dock React minimum contract drift in a saved test title

The saved property proposal and existing title describe a 32 px floor, but
`FloatingPane.tsx` uses 240 px width and 160 px height. Preserve the legitimate
proposal to test below-minimum shrink, verify the current production contract,
and update the stale title without changing production minima. Independent
width/height clamp-removal controls fail the new witness and pass the old test.
Binding inventory prose to the implementation constants would make this drift
visible before remediation.

## 2026-09-27: Invalid comparator mutation was not oracle evidence

The AI metrics snapshot-order negative control initially called an unavailable
`Order.reverse` helper in the pinned Effect release. Both revised and original
tests failed with `Order.reverse is not a function`, so neither result counted
as sensitivity evidence. Production and test files were restored by the
control's finalizer. The control now reverses the existing comparator arguments;
its receipts have a separate version. Mutation harnesses should validate their
fault seam against the pinned API before interpreting a red test.

A subsequent lease-payload control initially reused the fixture's existing
all-f hash, so it changed nothing and the revised test correctly passed. That
run is not sensitivity evidence. The corrected mutation uses a distinct hash;
control setup should assert that replacement values differ from the fixture.

## 2026-09-27: Wrapper packet category disagreed with the failed inner lane

The consolidated AI metrics publish packet categorized its cheap-gates failure
as schema-first policy. The same job's detailed lane log showed schema-first
passing and `lint:effect-vitest` failing on 78 changed finding identities. A
focused schema-first rerun was unnecessary attribution work. Operator summaries
should preserve the actual failed inner lane from the verdict instead of an
older or broad wrapper category. The remaining AI metrics findings still need
review and ledger reconciliation; this discrepancy is not a reason to waive them.

### Infra baseline: stale SDK transform after dependency preparation

- Task: establish the unchanged infrastructure Node/Vitest baseline.
- Evidence: 92 cases passed and the CiFleetController wiring case failed with
  `Cannot find module './provider'`. The existing `infra:prepare-gha-runners`
  command built the local SDK successfully, and plain Node loaded its Provider,
  but the cached Vitest case still failed. Disabling only the filesystem module
  cache passed all11 cases in that file. The cached CiFleetController transform
  retained the pre-build `@pulumi/gharunners/index.ts` target; that single entry
  was archived with a hash receipt before refreshing the normal cached baseline.
- Prevention: prepare local generated SDKs before first test transform, or include
  generated dependency entrypoint changes in resolution-cache invalidation.
  This is environment attribution; no production source or SDK stub was changed.

The infrastructure runner dependency install reproduced the preparation boundary:
`bun install --ignore-scripts` replaced the local file dependency without its
compiled bin output. Package typechecking/docgen then entered generated CommonJS
TypeScript and reported TS1295/TS1205. Running the existing
`infra:prepare-gha-runners` command after installation restores the intended SDK
entrypoint. Dependency-changing proof recipes should include this preparation
before package verification; no generated SDK source was edited.

### UI timezone oracle portability

- Work: verify the new UI timezone property under both configured runtimes.
- Evidence: the first Node after-run failed with `Asia/Calcutta` versus
  `Asia/Kolkata`; Bun passed. Upstream Effect canonicalizes named zones through
  Intl resolvedOptions.
- Prevention: model canonical timezone identity in generated assertions and
  run Node plus Bun before crediting a property batch. The five input zones and
  instant checks remain; no domain was filtered to silence the counterexample.

### Workbench cleanup observation ordering

- Work: add a private negative control proving test-owned DOM cleanup after an
  injected assertion failure.
- Evidence: a trailing DOM-empty assertion raced concurrent tests under the
  shared runner configuration; the attempted `describe.sequential` convenience
  API is absent in installed Vitest 5.0.1.
- Prevention: inspect the installed CLI contract and use the supported
  `--sequence.concurrent=false` only for the ordered private cleanup experiment.
  The shipped tests and normal package verification retain shared concurrency.
  Neither failed experiment counts as a successful cleanup proof.

### OIP provider snapshots and mock hoisting

- Work: migrate the OIP route/page tests to the canonical runner while excluding
  ambient HubSpot and Sanity configuration.
- Evidence: per-test environment stubs still allowed a provider attempt under a
  synthetic hostile environment because Effect's default provider had already
  captured its environment. Explicit Vitest worker env settings pass the paired
  control; removing them fails the route and page no-request assertions.
- Prevention: configure absence before application modules load, and assert at
  the public fetch boundary that the no-provider route/page cases make no call.
  All controls use synthetic values with fetch rejected or mocked.
- Related evidence: routing `vi` through the Effect Vitest export-star failed
  module loading with `problems in resolving the mocks API`. Preserve the direct
  `vitest` import for `vi.mock` hoisting, while the three test files register
  through the instrumented runner. Do not change globals or the root runner to
  hide this compatibility requirement.

- OIP full package proof exposed a cached FetchHttpClient.Fetch default after
  filtered controls passed: the provider-rejection spy saw zero calls. Supplying
  each native test's spy through the public Fetch reference prevents cross-test
  reuse. A full-file run alongside filtered mutation controls would surface this
  interaction earlier; the failed audit remains a diagnostic receipt.

- Editor projection strengthening initially used the pre-RC Option contract for
  Array.filterMap and the wrong slash surface token. Full package checks exposed
  both; replace with explicit filter/map over the declared slash-menu surface.
  Parse every focused JSON outcome before reporting it green, and establish the
  positive oracle before crediting mutation controls. A separate private disposal
  probe also required preserving its method receiver with call(registry).

## RDF focused property configuration omitted example boundaries

While validating the PROV timestamp schema repair, a focused Vitest JSON report
returned success with zero tests. The shared config selects only property-bearing
files when BEEP_FC_NUM_RUNS is set, so the example-only ProvO file was excluded.
Running it without the deep-sweep variable executed all eight cases successfully.
The generated core law was separately verified with the 400-run floor. A focused
proof wrapper that rejects zero executed tests would prevent accidental credit.

## N3 cleanup probe needed a suite-level witness

While checking spy cleanup after an injected early failure, the first probe used
an afterEach assertion attached to an expected-failure test. Both implementations
passed, so that probe was excluded from acceptance. Moving the restoration check
to afterAll distinguished the original leak (suite exit 1) from scoped cleanup
(exit 0). Cleanup probes should put their witness outside expected-failure
inversion and inspect suite-level errors as well as individual test counts.

## Range changeset checks require committed package changes

The Oxigraph pre-commit range check passed, but the next package's check reported
Oxigraph missing an in-range changeset. An uncommitted new changeset did not
satisfy the range check either. A committed changeset now names both Oxigraph and
SHACL. Run the range-based gate after committing each source batch and its
changeset; a dirty-worktree preflight alone does not prove committed coverage.

## Ontology Option payload needs its original comparison semantics

The Option helper conversion for admitted alignment arrays failed because
assertSome uses strict deep equality: the actual ConceptAlignment instance and
original plain-object expected value have different prototypes. The original
whole-value toEqual assertion is retained with a scoped detector exception.
Helper selection must account for nested schema instances, not only Option shape.
Two optional Boolean assertions also require strictEqual so undefined remains a
failure without narrowing the assertion input type prematurely.

## Codec regressions can cross the schema-property lint threshold

The consolidated early publisher stopped at `lint:schema-first` after adding
PROV timestamp boundary regressions. `ProvO.test.ts` now had three codec
assertions without a local schema-derived property, despite adjacent RDF
property coverage and a passing package audit. A native source-derived timestamp
round-trip property closes the gap. Run the root schema-first gate when adding
codec regressions; package audit alone does not enforce this file-level policy.

## Detector receipts must follow final formatting

The ontology-use-cases scanner ran before the runner-import formatter settled.
Formatting moved the retained NodeServices exception from line 19 to line 21;
the root ratchet then reported one new finding despite the same reviewed native
loader boundary. A final scan refreshed only that owned exception and preserved
its history. Wait for formatting and dependency synchronization to finish before
capturing detector identities for reconciliation.

## Untouched ontology browser suite fails in dependency optimization

Before editing ontology-client, its configured browser command failed before
running any test. Vite raised `exportsData` destructuring from a missing
`depForEntryFileName[chunk.fileName]` entry. Archiving only this package's ignored
Vite cache and rerunning reproduced it; an explicit Node invocation also failed.
The passing Node/Bun suites do not prove browser behavior. Capture a browser
baseline before migration and retain this distinct optimizer failure while
investigating a bounded execution fix.

The isolated optimizer diagnostic identified the collision: inputs
`effect_schema` and `effect_Schema` produced an unmapped `effect_Schema2.js`.
Excluding only `effect/schema` from this package's browser prebundling lets both
original browser tests pass against the real renderers. The package-local config
keeps both modules and avoids changing Vite or the application implementation.

### Ontology client browser assertions and renderer ownership

- Activity: close the saved ontology-client resource and assertion inventory.
- Evidence: importing `@effect/vitest/utils` in the Chromium suite fails with
  `deepStrictEqual is not a function` from Vite's externalized `node:assert`.
  Keep the seven original browser assertions as explicit platform exceptions;
  introducing a Node polyfill would change this test's environment.
- Evidence: clearing the container and then disposing the registry does not
  establish removal of every canvas. Moving that wait across registry disposal
  still times out. The test now observes the actual renderer factories and
  releases any handle not already destroyed before removing its DOM container.
  The same call-through observers expose real selection statistics and update
  delivery, replacing two unacknowledged sleeps. Both real browser cases pass;
  dropped selection and projection controls pass the old checks and fail the new.
- Prevention: provide a public renderer lifetime acknowledgement for integration
  fixtures, and document the Node-only assertion-helper boundary. No renderer or
  atom production implementation is changed by this repair.

### Db-admin schema-first exception anchors after import changes

- Activity: preserve existing migration regression exceptions while adopting the
  shared test runner and assertion helpers.
- Evidence: root schema-first reports three missing/stale pairs at the same
  symbols; only their line numbers moved by one or two lines. The schema codec
  counts and established exception reasons are unchanged.
- Disposition: re-anchor only those three owned entries, preserving every other
  field and unrelated entry. No new exception or baseline-wide rewrite is made.
- Prevention: stable symbol identities would avoid re-adjudicating unchanged
  exceptions after import-only line movement.


### Schema advisory identity drift during law-practice test migration

Adding runner and assertion imports moved the existing CandorPolicy schema-codec
advisory from line 39 to 41. `bun run lint:schema-first` reported one missing and
one stale entry. The canonical `--write` refreshed the location but also replaced
the prior justified exception with an advisory and reordered unrelated entries.
The final edit preserves every original entry and reason, changing only the owned
line location. Stable advisory identities independent of line offsets, with
exception preservation during regeneration, would prevent this repair.

### Full detector rescan after a package-local resource refinement

While finishing Semantica, `beep lint effect-vitest --rows <output>` spent
more than three minutes in its full-repository scan before the final resource
review identified two unnecessary platform layers and two private wrappers.
The preliminary scan was terminated and is not accepted as proof; the final
source receives a fresh full scan. The command exposes no package selection.
A supported package-local diagnostic mode, with full scanning retained for the
ratchet acceptance gate, would make iterative remediation cheaper.

Follow-up diagnosis: the slowdown was a detector defect exposed by the nested
cache clock test, not ordinary full-scan cost. The preceding package scan took
11.2 seconds. A per-file diagnostic isolated `ProviderCache.test.ts`; the old
recursion guard compared ts-morph nodes with `A.contains`, which invokes Effect
equality. Replacing that guard with explicit node identity scanned the same file
in about 73 milliseconds and the entire repository in 8.8 seconds. Preserve AST
identity when tracking visited syntax graph nodes. The simple nested-generator
regression retains classification coverage; the full cache fixture, rather than
that small example, reproduces the severe performance failure.

### Pacer batch cancellation cleanup

The saved resource lens identified a possible report lifetime gap. A controlled
mock-HTTP witness reached the first status request after report creation, then
interrupted the download. The original implementation recorded no deletion;
report 1078 remained allocated. `Effect.result` followed by cleanup misses both
interruption and defects. Three regression cases reproduce the omission against
the original source and pass with `Effect.acquireUseRelease`, including a failed
best-effort deletion. The operator approved this narrow production repair in
PR #1307. Resource cleanup tests should cover cancellation and defects alongside
success and typed failures, with acquisition barriers instead of elapsed sleeps.
