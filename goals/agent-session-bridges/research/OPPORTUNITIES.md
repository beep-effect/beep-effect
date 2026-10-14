# Opportunities

## 2026-10-09 — Fresh Codex thread cannot resume before first rollout

- Work: first real router + native Codex/Grok autonomous tool proof.
- Evidence: both native endpoints enrolled; seed acceptance became ambiguous
  28 ms after claim, before any messaging grant usage. A separate owned
  `thread/start` → `thread/resume` diagnostic made zero model calls and returned
  RPC `-32600`, “no rollout found for thread id”, with both ephemeral and
  persistent starts on Codex CLI 0.162.0.
- Prevention: native fixtures must distinguish fresh thread state from a
  persisted rollout. Generic upstream resume documentation does not establish
  first-turn behavior in the installed runtime. Preserve safe operation/code
  diagnostics in the durable receipt instead of discarding the failure class.
- Disposition: keep the failed proof and its ambiguous receipt. Use the verified
  initial thread policy for the first owned turn; explicitly pin its turn
  arguments. Resume/readback applies only after a rollout exists. A fresh proof
  uses new owned state and a new nonce, never blind retry of the ambiguous seed.

## 2026-10-09 — Host grant authority must be stated to the managed agent

- Work: frozen native Codex/Grok autonomous tool proof after sandbox repair.
- Evidence: both providers enrolled with matching pins. Codex acknowledged the
  controller seed, completed its turn, and explicitly declined the requested send
  because it appeared only in peer content. No outbound grant was used. The host
  wrapper instructed acknowledgment but did not explicitly authorize grant-bound
  communication tasks. Both owned idle runtime groups were stopped; cleanup and
  unchanged source/executable checks passed. The run remains failed.
- Prevention: distinguish task content from the host's authorization to perform
  bounded communication. A server-enforced grant does not by itself tell a model
  that using its messaging tools is authorized by the launching host.
- Disposition: the wrapper now expressly authorizes scoped acknowledgment, send
  and reply within persisted grants. Peer content cannot expand recipients,
  conversation, quota or permissions; launch, other tools, file work, policy,
  merge and spending remain outside that authority. The final CLI audit was
  interrupted before changing the wrapper so its earlier snapshot cannot be
  reported as proof of this change. A fresh model proof uses fresh private state.

## 2026-10-09 — Claude safe mode excludes the required MCP bridge

The first managed Claude busy/idle run enrolled both endpoints, but its primer
finished without an acknowledgment. It stopped after 103.4 seconds with
`busy-opportunity-missed`, unchanged source/executable hashes and successful owned
cleanup. The installed CLI's `--safe-mode` help explicitly lists MCP servers among
disabled customizations. A separate zero-model diagnostic must establish whether
that disables the explicitly supplied bridge and qualify the isolated alternative
before another inference run.

`--bare` is not an acceptable shortcut: the installed help says it skips OAuth
and requires an API-key/helper route. Preserve the existing subscription, owned
HOME/workspace, strict MCP configuration, scoped tools and noninteractive policy.
The full CLI audit was interrupted before a possible provider-source repair; run
the final full audit after live qualification has settled to avoid certifying a
superseded launch configuration.

The zero-model comparison confirmed the cause on Claude Code 2.1.295: safe mode
reported zero MCP servers, while restricted mode connected the six-tool fixture.
The comparison remained stable with explicit instruction exclusions and auto
memory disabled. The native driver is being corrected without changing the
subscription, grant or tool authority. Prevention: qualify startup controls
against the installed CLI before using a model call to test message behavior.

## 2026-10-09 — Protocol fixture crosses the property-test heuristic

The final collected cheap-gates run passed 15 lanes and failed only the
schema-first inventory check. Its new Claude settings decoder increased the
standalone synthetic child fixture to four codec assertions, triggering
`SFV4-arbitrary-tests`. This executable is a deterministic regression peer used
to inspect exact launch flags and emit prescribed protocol events; randomized
input generation inside it would change that role. Retain one narrowly reasoned
inventory exception and its removal condition. No production source or live
receipt is changed by that inventory judgment. Prevention: distinguish executable
protocol fixtures from schema property suites in the checker.

## 2026-10-09 — Hosted fresh documentation scan exceeds package proof

On PR #1571 at `5b0207b8c7`, Heavy Docgen rejected 27 provider-internal exports
using the unrecognized category `internals`. JSDoc Ratchet's freshly generated
inventory also reported 26 added missing examples, two schema-annotation findings
and two section-order findings. Earlier package audit/docgen and the committed
inventory ratchet passed, so those receipts did not establish fresh repository
metadata compliance. Read both completed job logs immediately and repair the
introduced documentation against the canonical JSDoc categories and example
grammar; do not grow the baseline or exclude the internal files. Prevention:
run fresh documentation inventory and bounded repository metadata checks when
adding private cross-file exports, as well as the package's own docgen.

## 2026-10-09: repository hooks can expand a T3 enrollment turn

Task: prime two owned T3 repository conversations with a no-tool READY brief.
The inherited `full:00-cheap-gates` P0 stop hook continued after that reply.
Claude repeated the bounded reply while refusing tools; Codex inspected the
checkout inbox and its memory and used `yeet inbox ack --wontfix` despite the
brief's no-tool restriction. Both turns eventually completed. The acknowledgment
recorded that the existing implementation lane still owns the failure; it did
not establish remediation or green proof. No tracked change is attributed to
these peers: T3 checkpoint diffs include concurrent edits by the implementing
agents and cannot establish who wrote them.

Prevention: reconcile owned inbox obligations before a bounded host experiment,
carry explicit coordinator/worker ownership and hook handling in real briefs,
and inspect the complete executed turn rather than accepting its first READY
message. Full-access agents and prompt boundaries are not OS isolation. Retain
this failed no-tool enrollment case separately from the later scoped route proof.

## 2026-10-09: package creation leaves an identity formatting failure

Task: create the T3 driver through the canonical package generator, then run
`beep quality package-verify @beep/identity`. Build, type checks, 115 tests and
docgen passed, but Biome rejected the newly extended package-name list in
`packages/foundation/modeling/identity/src/packages.ts`. Formatting that generated
edit resolves the introduced failure. The package writer should format its
identity registration output before returning success.

## 2026-10-09: process arguments exposed an owned T3 credential

Task: inspect package-verifier progress. A process command-line match included
the internal MCP bearer passed to the owned T3 Claude process. The verifier
reported the mistake and stopped argument inspection. The host archived only
that owned conversation through the supported lifecycle API, verified its exact
detach effect succeeded with `revokeMcpCredential: true`, then unarchived it.
The installed source routes that terminal detach through thread credential
revocation. The old bearer was not separately probed; retain that evidence limit.

Prevention: emit only PID and command name for progress checks. Never inspect
agent command arguments, which can contain credentials. Keep diagnostic values
out of public receipts and use supported, scoped revocation before resuming proof.

## 2026-10-09: incoming native delivery needs its own scope check

Final review traced a valid sender grant through enqueue and claim into the T3
adapter. The sender's conversation scope did not establish the receiver's scope.
The receiver's later ACK would reject a foreign conversation, but its native
model could already have seen the task. The adapter now checks the direct target,
repository, receiver conversation and explicit symmetric peer allowlist before
any T3 read or send. Two actual grant-to-claim regressions cover a foreign
conversation and an unallowed sender, both with zero native sends. Preserve the
earlier allowed-traffic proof separately from the hardened source rerun.

Prevention: review incoming task authorization at the external submission
boundary, independently of outbound grant validation and acknowledgment.

## 2026-10-09: missing generated SDK output blocked full docgen

The required full docgen run failed in `@beep/infra` while checking unchanged
`@pulumi/gharunners` source against strict compiler options. Ten relevant files
and the SDK/compiler lock records matched main; the installed SDK's declared
`bin` output was absent. The existing `bun run infra:prepare-gha-runners`
preparation command completed successfully. The subsequent full repository
docgen run completed with exit 0, including aggregation. Ensure the
tracked postinstall prerequisite has run after a script-skipping installation.

## 2026-10-09: run structural gates before live qualification

The final cheap-gate collection found two introduced Fallow complexity findings
in `AgentMessage.attached.service.ts`: `submit` and `verifyAttachedT3`. Focused
behavioral tests and the bidirectional live proof had already passed, so a later
cohesion refactor requires its own review and source binding. The new package
also needed canonical policy-fingerprint regeneration and a scoped cache-policy
review. Run those structural gates before the live experiment to avoid repeating
qualification or confusing a historical source receipt with the final source.
The in-progress full CLI audit was cancelled when its source was superseded;
that cancelled run is not a successful package proof.

## 2026-10-09: interruption separates ACK from final native settlement

The final refactored-source exercise persisted four ACKs and both coordinator
reports before the host interruption. Its forward dispatches settled; two reverse
dispatches remained active. Restoring the same T3 app/profile reconciled the
Codex run as completed and the Claude run as cancelled. Canonical mailbox
recovery retained the reverse ambiguity fences without replaying either task.
The external proof credentials were revoked and independently returned HTTP401.
Preserve the earlier complete hardened proof separately; an ACK or written report
does not establish successful native completion after a host interruption.

The full CLI package audit also lost its terminal receipt during interruption.
The replacement audit buffers output across approximately 298 serial isolated
test files; process metadata showed worker turnover and progress. A quiet log
is neither a pass nor evidence of a hang. A per-step progress marker and explicit
audit deadline would make this verification easier to observe and recover.

## 2026-10-09: integration secret scan matched a documentation header

The main integration's staged secret scan reported `private-key` in
`scratchpad/effected/github/GitHubApp.ts:120`. Inspection found only a PEM header
quoted in JSDoc describing PKCS conversion, with no credential or key body.
The existing exact-fingerprint ignore mechanism records that one documentation
match; the full staged scan still runs. Prefer descriptive header names in prose
where a literal sentinel can trigger a multi-line secret detector during merges.

## 2026-10-09 — advancing main replaces the inherited publication blocker

- Work: resolve PR #1571 conflicts and verify merged main before publication.
- Evidence: main `6513e85d2c` integrated through `5868dc8218`; its inventory
  resolves the previous golden-test membership blocker. The subsequent collected
  cheap gate instead reports Accounts schema admission rows from #1583 and a
  PracticeKg projection-test inventory mismatch from #1593. These source files
  match main; existing owners retain their repairs.
- Prevention: finish schema/test inventory admission with each source change and
  retain inherited-red attribution independently from conflict resolution.
- Decision: publish the conflict resolution after recording the canonical gate
  refusal and completing the owned checks, using the standing inherited-fence
  fallback if necessary. Keep hosted readiness and merge claims separate. No
  baseline relaxation or duplicate source repair belongs in this lane.

## 2026-10-09 — final hosted policy and Node coverage expose omitted inner-loop checks

- Work: triage the exact `77fd55b858` hosted run for PR #1571.
- Evidence: root ESLint rejects two bare package names in the T3 barrel's JSDoc;
  the Node coverage run's real SQLite writer-lock fixture observes an ambiguous
  submission rather than delivered state. Package audit/docgen alone did not
  establish either hosted outcome. The prior Node `bun:` import failure and
  container-pull scanner failures are cleared on this head.
- Prevention: include the root zero-warning TSDoc command for a new barrel and
  prove fixture process startup/release on the same Node runtime used by coverage.
  Diagnose the ambiguous result before changing retry policy or assertions.
- Action: repair owned failures in one corrective wave, preserve inherited
  source attribution, and keep hosted readiness unclaimed until the fresh head.

## 2026-10-09 — test body changes invalidate broad-context admission

- Work: publish the final packet wave after the runtime portability repair.
- Evidence: the collected cheap gates detected a new EV002 statement fingerprint
  in `AgentMessage.runtime.test.ts` at its broad `Effect.provide(context)` call.
  The edited lock body changed the previously admitted statement fingerprint.
- Prevention: include the Effect-Vitest detector in the focused test repair
  loop; package lint/check and runtime execution do not replace this gate.
- Action: inject only the test's required services and preserve the existing
  lock contention assertions. Do not transfer or weaken the inventory exception.

## 2026-10-09 — package typecheck producer exit is not compiler success

- Work: verify the runtime lock fixture's declared store error channel.
- Evidence: `package-test-typecheck` writes a result artifact and exits zero even
  when its captured compiler exit is nonzero. The prior report misread producer
  success as compiler success; the stored result carried TS2375/377003 for
  `PlatformError` escaping the fixture's `complete` wrapper.
- Prevention: read the stored result's exit code or invoke TSGo directly with
  the package test project and preserve its actual exit. An artifact-write
  command's success is not proof that the compiler passed.
- Action: correct the fixture error boundary, run direct TSGo, and supersede
  the earlier compiler-pass claim explicitly in the qualification receipt.

## 2026-10-09 — expanded queue fixture crosses complexity gate

- Work: publish the P1 exact-run postcheck repair with two regression scenarios.
- Evidence: the collected Fallow audit and health checks report one new
  complexity finding after the fixture's additional nested scenario branches.
- Prevention: run the complexity checks when expanding a multi-scenario fixture;
  focused runtime success and package source checks do not cover this policy.
- Action: simplify scenario selection, retain both new assertions and verify
  the actual Fallow gates without altering thresholds or inventory.

## 2026-10-09 — hosted inventory failure hides its original cause

- Work: attribute JSDoc Ratchet on the integrated messaging head.
- Evidence: job `114119379881` emits only "Failed to generate JSDoc documentation
  inventory." A direct invocation of the production writer succeeds locally in
  292 seconds across 148 packages, with private outputs. An older main-only job
  has the same generic failure; neither fact proves the current hosted cause.
- Prevention: preserve a sanitized nested cause in the hosted artifact before
  mapping it to the generic CLI error. Source equality alone cannot attribute
  an input-dependent generator failure.
- Action: keep the hosted cause unknown, retain local and hosted evidence
  separately, and do not weaken the ratchet or claim a local generation pass
  satisfies the hosted gate.

## 2026-10-13: inspect the test compiler result, not the producer exit

- Work: add actual command-path regressions while closing PR #1571 coverage gaps.
- Evidence: `package-test-typecheck` exited zero after writing its result, but
  `.turbo/package-test-typecheck-result.json` carried `exitCode: 1`. The new
  command tests had decoder callback and widened literal type errors. The
  earlier producer-exit success claim was withdrawn before committing.
- Prevention: make package verification propagate the compiler failure, or
  require the saved compiler exit in every verification receipt. Quick source
  lint/check and passing runtime tests do not establish test type correctness.
- Action: repair the test source and read the saved compiler result. Preserve
  all baselines and the live session ambiguity holds.

## 2026-10-13: command regressions trigger the schema-property advisory

- Work: publish the current-main conflict resolution and reviewed command tests.
- Evidence: 15 of 16 cheap gates passed. `SFV4-arbitrary-tests` flagged
  `AgentMessage.command.test.ts` and `AgentMessage.runtime.test.ts` because they
  decode real command/process receipts without schema-derived property tests.
- Prevention: include the full schema-first detector in command-test handoff;
  compiler, Effect-Vitest and runtime proof cover different contracts.
- Action: independently review whether the repository's documented
  regression-only exception applies. Preserve the actual process/command
  assertions and schema-property suites; do not add a token round-trip solely
  to satisfy the detector or disable its rule.

## 2026-10-13: CI trace output exposed a command-test capture assumption

- Work: verify the new command regressions on PR #1571 after shared repairs.
- Evidence: hosted `repo-cli-2` failed both attach-T3 tests with `Expected a
  valid JSON string`; `CI=1` reproduced the same two failures locally. The
  lifecycle trace messages were included in the full test console history.
- Prevention: run command-output tests with CI tracing enabled and capture the
  command's own output at its injected Console boundary. Run root-config
  Oxlint as well as package checks to catch inline schema construction.
- Action: decode the observed command argument as `EndpointBinding`, retaining
  malformed-output failure, and hoist four reusable test schemas. The focused
  command/runtime suite passes all 13 tests with CI and tracing enabled.
  No provider calls, baseline changes, or ambiguity-hold mutations occurred.

## 2026-10-13: schema inventory exceptions depend on source line positions

- Work: publish the CI trace repair after hoisting reusable test schemas.
- Evidence: 15 publication gates passed; schema-first reported the two existing
  regression-only exceptions as stale after their first codec lines moved from
  35/75 to 38/77. The inventory writer refreshed locations but replaced the
  previously reviewed exception status and rationale with advisory defaults.
- Prevention: retain an exception's reviewed disposition across a line-only
  source move, or require an explicit reconciliation in the writer output.
- Action: retain the generated current locations and restore the unchanged
  reviewed status and reasons. The final inventory diff changes only two line
  numbers; no new exemption or relaxed numeric baseline is introduced.

## 2026-10-13: first hosted coverage proof exposes missing file identities

- Work: close PR #1571 after the inherited JSDoc source repair landed.
- Evidence: the current-head coverage job completed successfully through test
  execution, then rejected uncovered units in five provider session modules and
  eight AgentMessage modules because they have no baseline file identity.
  Strict compilation, both CLI shards, build and docgen passed on that head.
- Prevention: include V8 coverage for new modules in their package handoff and
  review the file identities before publication. Passing runtime tests alone
  does not establish coverage admission.
- Action: add deterministic tests for missing failure and lifecycle paths and
  independently review coverage admission policy. Preserve existing coverage
  floors, live delivery holds and provider isolation throughout the repair.

## 2026-10-13: admission status buries the live capacity summary

- Work: check local capacity before measuring the final coverage wave.
- Evidence: `beep quality scheduler status` reported no admitted tokens and
  usable capacity, followed by more than two thousand historical quarantine
  entries. The diagnostic output exceeded the bounded tool response.
- Prevention: show historical quarantine counts by default and reserve the
  complete path inventory for an explicit detail option.
- Action: retain the capacity result and leave historical scheduler state
  untouched. No other session or proof was stopped.

## 2026-10-13: a newer main export changes the JSDoc gate again

- Work: wait for the shared corpus lint repair before integrating main.
- Evidence: PR #1627 changed only a test file, but its JSDoc job reported
  `missingExportExamples: 10 > 9 (+1)` on current main. Independent attribution
  identified two public provider-status constants added by #1614 without
  examples. The aggregate increase alone did not identify the offending export.
- Prevention: include exact fresh inventory rows in a ratchet failure and
  validate public exports before their owning PR lands.
- Action: route both constants to the existing Goals projection owner, retain
  source-bound attribution and preserve the JSDoc baseline. This lane does not
  duplicate that owner's source edits or waive the inherited failure.

## 2026-10-13: new identity admission requires narrowing whole-package output

- Work: admit reviewed measurements for 13 new files while holding old floors.
- Evidence: the scoped writer replaced two complete package rows, producing
  a 3,208-line diff. Narrowing it to the reviewed identities produced 156
  insertions with every previous metric and policy field unchanged; the
  comparator passed both packages against that narrowed document.
- Prevention: provide a typed writer mode that admits selected new identities
  and rejects replacement of existing rows. Preserve fresh provenance rather
  than retaining the legacy timestamp and commit fields.
- Action: retain raw generated output and direct summaries, verify all new
  values independently, and structurally assert preservation before publication.
  No existing floor is lowered by this wave.

## 2026-10-13: the publication gate catches branching in a test matrix

- Work: run cheap gates after the coverage test wave and numerical review.
- Evidence: 14 gates passed; Fallow audit and health rejected two introduced
  complexity findings in the provider session suite. The invalid-profile case
  setup used repeated conditional patches, and nested readback loops increased
  complexity in the surrounding suite callback.
- Prevention: express scenario setup as explicit transformations and flatten
  readback cases before the test handoff; include Fallow in the initial review.
- Action: retain every case and assertion, simplify the scenario structure,
  rerun tests and V8 coverage, and recheck the actual Fallow gates. Do not add
  suppressions or change complexity or coverage baselines.

## 2026-10-13: fresh CI exposes an inherited index contract and hidden example

- Work: publish the reviewed integration and inspect completed red jobs while
  sibling hosted jobs continue.
- Evidence: #1571 at `4800b6a21b` passes publication gates, but hosted CLI shard
  one rejects case 9 in `goals-manifest-capabilities.test.ts`. The test still
  expects the whole index to ignore capability fields after #1625 deliberately
  added a capability graph. Source and test are unchanged from main. JSDoc
  inventory succeeds, then its totals gate reports `unsafeExampleFindings: 1 > 0`
  without identifying the symbol in the job log.
- Prevention: test legacy portfolio parity separately from the graph's
  intended differences, and print source-bound inventory findings beside totals
  regressions. A replayed green check does not prove the current source contract.
- Action: route the index test repair to its existing owner, locate the exact
  unsafe example before editing, and retain the complete merge gate. No
  baseline relaxation, source rollback or duplicate lane repair is warranted.
- Attribution: #1631's SAST correction in the `GitHubApp` example replaces a
  PEM placeholder with `declare const appPrivateKeyPem: string`. The canonical
  example classifier rejects the declaration. The file matches main exactly;
  route a compilable configuration-input example to the Effected owner while
  preserving both the SAST repair and the zero-unsafe-example baseline.
- Follow-through: #1634 lands the corrected index contract after this wave's
  main integration. Its suite edit changes the existing open EV014 occurrence
  anchor: current and baseline counts remain two, with one introduced and one
  resolved fingerprint. Route a reviewed canonical anchor refresh to the owner;
  preserve the finding's open status and the corrected test behavior.

## 2026-10-14: shared coverage exposes existing Goals adoption gaps

- Work: wait for the consolidated main repair before another integration wave.
- Evidence: #1640's hosted coverage job accepts the two new file identities,
  then rejects existing `Goals/Adopt.ts` floors: branches 78.57 versus 82.5,
  lines 93.33 versus 95.38, and statements 93.91 versus 95.74. The tests
  complete successfully; the numerical comparison is the failing boundary.
- Prevention: run the complete package measurement and comparator before
  declaring the shared coverage repair final. New identity admission alone
  cannot prove preservation of old floors across recently landed source changes.
- Action: route the exact completed-job diagnostics to the shared owner for
  focused test coverage. Preserve all baseline floors and avoid duplicate repairs
  in dependent lanes.

## 2026-10-14: a newly landed doctor adds a documentation blocker

- Work: inspect the shared repair's completed policy job before integration.
- Evidence: #1640 at `4c185d83ca` passes its other completed checks, while
  policy lint rejects `KnowledgeDoctor.service.ts:1352` with
  `jsdoc/informative-docs`. The tag description repeats its name. The source
  belongs to the newly landed knowledge-doctor feature.
- Prevention: run the same documentation lint on owning source exports before
  landing a feature, alongside the inventory and example compilation checks.
- Action: route the exact diagnostic to the existing owner for an informative
  description. Preserve runtime code, coverage measurements and all baselines;
  a rerun cannot repair the source text.

## 2026-10-14: moving main expands the consolidated coverage repair

- Work: inspect the completed shared coverage comparator before integration.
- Evidence: #1640 at `4c185d83ca` completes its tests and accepts the restored
  Adopt coverage and four new identities. It then rejects existing floors for
  the NLP MCP package, Knowledge command surfaces, and the IANA timezone target.
  The shared lane already has another main integration and documentation
  correction publishing while these numerical failures become visible.
- Prevention: prioritize the consolidated unblocker before further feature
  merges, and verify existing coverage floors in the owning feature's full
  package measurement. Successful tests alone do not prove those floors.
- Action: route the completed comparator diagnostics to the shared owner and
  coordinator for source attribution and focused tests. Preserve every floor;
  dependent lanes must not duplicate repairs or lower the failing rows.

## 2026-10-14: runner-loss retries delay the numerical coverage verdict

- Work: qualify the integrated router and bridge head in hosted CI.
- Evidence: #1571 at `f36e6eb538` loses both heavy runners before a verdict.
  The lint retry loses its runner again. The completed coverage retry then
  rejects inherited NLP, Knowledge, Skills, timezone and drawing floors and
  six missing package rows. The failing source paths match bound main; the
  lane's baseline diff contains only its thirteen additive identities.
- Prevention: preserve per-attempt runner and terminal-verification receipts
  separately, and complete the consolidated main coverage repair before
  dependent lanes spend another full measurement.
- Action: route numerical evidence to #1666 and the existing drawing owner.
  Keep all floors and provider holds intact; integrate landed main repairs
  together and request fresh hosted proof. Runner recovery alone cannot
  clear a completed comparator failure.
# 2026-10-14: main inventory moved during publication preparation

Yeet rejected publication of reviewed integration `e7bb5ba6a2` before pushing.
New main commits changed `standards/effect-vitest.inventory.jsonc` after the
integration snapshot. The stale-base guard correctly caught the overlap.
Merging main `b096cbd99b` required no conflict resolution; canonical config and
cache checks remained green, and a fresh actual test compiler receipt recorded
exit zero. Letting the declared consolidated repair finish before optional
inventory changes would avoid repeated integration and review work.


## 2026-10-14: bootstrap the manifest before querying a conflicted merge

Resolving workspace-registry conflicts temporarily left root `package.json`
unparseable. The Graft launcher failed with `Failed to parse JSON file` before
it could inspect the identity registry. Resolve the manifest union first, then
query source and run canonical projection writers. This preserves both workspace
entries and keeps the conflict inspection available without bypassing the tools.

### 2026-10-14: inherited Knip-retirement receipt digest

During the second current-main conflict integration, `beep cache audit` returned
`Qualification evidence digest mismatch`. The FreshBooks outside review and its
Knip-retirement basis both exactly match landed main, but the recorded digest
starts `f963ef8f` while the actual basis starts `aa3b4096`. Preserve the carried
review and qualification ledger; route a source-bound correction to the main
owner. A final receipt hash check before publication would have prevented this.

### 2026-10-14: distinguish the installed review route from a score-shaped comment

While resuming PR1571's 5/5 cycle, the latest 3/5 was a human-account
`greptile_style_summary`, while Yeet accepts only Greptile-authored summaries for
its Greptile advisory. The operator selected the existing PR reviewer. Preserve
that reviewer provenance and request a fresh assessment after the source fixes;
do not label a local or human-account score as a Greptile bot verdict.

### 2026-10-14: source checks omit strict fixture diagnostics

The first reviewer fix wave passed CLI source checks and runtime fixtures, but
hosted Heavy Check reported two `missedPipeableOpportunity` fixture diagnostics
and one `preferTypedSchemaDecoder` diagnostic. The same log carried the main-owned
Skills test context error, now corrected by landed #1745. Keep attribution
separate and run the package-owned strict test task for changed fixtures; a source
check alone does not validate those fixtures. Logs: PR #1571, job 116038351034.

### 2026-10-14: full lint policy finished after the external merge

PR #1571 merged while two hosted checks were still running. Lint Policy job
116049622872 later failed its global diagnostic-directive guard and Oxlint. The
owned store constructor disabled `missingPipeableSignature`, and seven fixture
codec expressions were built inline. Hoist those codecs and express the factory
through the canonical Effect function wrapper without disabling diagnostics.
Twenty-one other schema-hoist findings already have a main repair in #1748;
verify that repair and keep this follow-up scoped to the remaining owned files.
Package source checks do not substitute for the global directive and Oxlint
gates. The job's broken-target census is context, not the failing criterion.
