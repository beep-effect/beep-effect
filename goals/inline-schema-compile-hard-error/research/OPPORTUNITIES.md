# Opportunities

## 2026-09-03 — Generated HTML output had inherited drift

- **Work:** Update the sole generated `beep(no-inline-schema-compile)` finding
  in `@beep/html`, generator first.
- **Evidence:** The first `bun run generate` after the one-line compiler-template
  change also changed 202 lines in `src/Html.model.ts`. Attribution showed
  commit `09ad07d1fc` updated `scripts/generate.ts` without updating that
  generated output, so `main` was already non-idempotent before this packet.
- **Prevention:** Require each generated-source owner to run its package
  `generate:check` in the PR that changes a generator template, and include the
  generated outputs in the same commit.

## 2026-09-03 — Whole-corpus ts-morph analysis was not memory-bounded

- **Work:** Classify safe and manual hoists across the 566-file opening census.
- **Evidence:** A single ts-morph project reached roughly 10.9 GiB RSS and was
  still CPU-bound after 48 seconds while three full-proof scheduler leases were
  active; the analysis process was stopped without writing source.
- **Prevention:** Corpus codemods should load bounded file chunks, release each
  project between chunks, and expose an analysis-only mode before writes.

## 2026-09-03 — Ordering audit recomputed declaration indexes quadratically

- **Work:** Repair compiler constants inserted before locally declared schema
  dependencies after the mechanical migration.
- **Evidence:** The corpus ordering audit remained CPU-bound after 11 minutes
  because it rebuilt the file-wide declaration map for each compiler constant.
  The pass was interrupted after its per-file saves; an independent Biome check
  reduced the residual from 37 to 21 ordering diagnostics.
- **Prevention:** Build each source file's runtime-declaration index once per
  syntax-tree revision, and constrain the repair scan to compiler constants
  whose referenced local declaration occurs later in the module.

## 2026-09-03 — Scratchpad conflict test cannot initialize on main

- **Work:** Run the focused scratchpad tests after moving the ticket and HTTP
  response codecs to module scope.
- **Evidence:** `vitest run test/Service/ConflictRepository.test.ts` fails before
  collecting tests with `Schema property 'annotate' would be lost by the owned
  rebuild`. A disposable worktree at the exact starting `HEAD` reproduced the
  same failure and stack in `Domain/Schema/KnowledgeModel.ts`.
- **Prevention:** Keep scratchpad schemas that attach custom statics on the
  supported `withCodecStatics` ordering, and add the conflict suite to the
  owning verification lane so initialization drift is caught when introduced.

## 2026-09-03 — Shared assertion adapter invalidated incremental dependents

- **Work:** Verify the new shared compiled assertion through the selective
  codec-static registry and its downstream packages.
- **Evidence:** `@beep/acp` and `@beep/agents-domain` initially armed P0 local
  audit shards after the registry used the generic helper directly. A
  monomorphic `CodecSchema` adapter restored the registry boundary; forced
  project-reference rebuilds then showed the remaining agents-domain and
  agents-client diagnostics were stale incremental state. All three canonical
  package verifiers subsequently passed their audit and docgen lanes, and Yeet
  reconciled the rows to zero unacknowledged work.
- **Prevention:** Test generic helpers through the exact monomorphic registry
  slot that consumes them, and force project-reference invalidation when a
  shared declaration signature changes before attributing downstream type
  diagnostics to source.

## 2026-09-03 — Scheduler dry-run guidance contradicts its command parser

- **Work:** Inspect scheduler liveness after the admitted package matrix waited
  ten minutes behind live proof work.
- **Evidence:** The scheduler escalation recommended `bun run beep quality
  scheduler reap`; that command describes `--apply` as optional and says the
  default is a dry-run report, but exits with `Missing required flag: --apply`.
  The separate status command reported no dead leases, so no mutating reap was
  attempted.
- **Prevention:** Make `scheduler reap` execute the documented dry-run path
  without `--apply`, reserving `--apply` solely for confirmed mutation.

## 2026-09-03 — Box verifier reused stale project-reference state

- **Work:** Run the scheduler-admitted package-owner verification matrix after
  the corpus-wide compiler hoist.
- **Evidence:** `@beep/box` generated successfully and then failed its first
  audit with only `TS2589: Type instantiation is excessively deep and possibly
  infinite`. An exact forced project-reference build passed, followed by a
  green canonical package verifier (`audit` and `docgen`); Yeet then reported
  the Box P0 row acknowledged with zero unacknowledged inbox work.
- **Prevention:** When a shared schema declaration changes across a large
  project-reference graph, invalidate the affected package build before its
  first verification rather than diagnosing an unlocated incremental
  instantiation failure as a source regression.

## 2026-09-03 — Documents domain also reused stale declarations

- **Work:** Resume the package-owner matrix after clearing the Box checkpoint.
- **Evidence:** The first `@beep/documents-domain` audit reported `unknown`
  inference cascades in an untouched taxonomy seed and projection plus a typed
  decoder diagnostic. Its only packet change was an unrelated module-scoped
  path-segment decoder. A forced exact project-reference build passed, followed
  by a green canonical package verifier (`audit` and `docgen`) and a Yeet inbox
  with zero unacknowledged rows.
- **Prevention:** Make package verification invalidate dependent declaration
  state when a shared schema utility changes; repeated per-package forced
  rebuilds turn a single graph invalidation into many fail-fast queue cycles.

## 2026-09-03 — Package-owner roots are not confined to packages

- **Work:** Add an exact project-reference refresh before each canonical owner
  verification after repeated stale declaration failures.
- **Evidence:** The first hardened matrix passed through owner 46, then stopped
  before `@beep/infra` because manifest discovery only searched
  `packages/**/package.json`; that package is owned by `infra/package.json`.
- **Prevention:** Derive owner locations from all tracked workspace manifests
  and validate that every census owner resolves before admitting the matrix.

## 2026-09-03 — Build-mode refresh is not authoritative for every owner

- **Work:** Pre-refresh project-reference state inside the admitted owner
  matrix before each canonical package verifier.
- **Evidence:** The refresh stopped at `@beep/lejeune-bolt-workbench` with
  `TS6307` for tracked JSON fixtures and a generated Vitest-alias file because
  `tsc -b` applies composite-project file-list constraints that the package's
  canonical `tsc -p` build does not. The canonical package verifier had not run.
- **Prevention:** Treat forced build-mode refresh as best-effort cache
  invalidation and always use `package-verify` as the owner proof authority;
  retain refresh diagnostics only when the canonical verifier also fails.

## 2026-09-03 — Ambient environment hashing made lane proofs nondeterministic

- **Work:** Verify the compiler hoists in `@beep/repo-cli` through its complete
  owner test suite.
- **Evidence:** One of 2,806 tests failed because a second identical
  property-floor lane ran instead of reusing its proof. The isolated test
  failed on the packet tree, passed at the exact starting HEAD, and passed
  again when only the hoisted `S.decodeUnknownOption(LaneProofMode)` call was
  temporarily restored. A module-scoped `S.is(LaneProofMode)` guard retained
  compile-once validation and made the isolated test pass, but the full suite
  still exposed the underlying identity bug: proof hashing sampled mutable
  process environment even for lanes with `useLocalEnv: false`. Hashing only
  the environment actually supplied to the lane made both the focused suite
  and the full canonical package verifier pass.
- **Prevention:** Compute cache identities from executor-visible inputs rather
  than mutable ambient state, and keep reuse tests in the complete owner gate
  so package-wide worker interference remains observable.

## 2026-09-03 — Shared Vite temp cache invalidated control-worktree proof

- **Work:** Reproduce the lane-proof failure at the exact starting HEAD in the
  disposable control worktree.
- **Evidence:** Running Vitest from the control worktree root fanned out across
  workspace configs, while its shared `node_modules` symlink wrote Vite temp
  module paths anchored in the active checkout; startup failed before tests.
  Running from the exact package directory matched the canonical owner context
  and produced a valid passing control result.
- **Prevention:** Give disposable control worktrees an isolated Vite cache, or
  run package-scoped Vitest from the package directory when dependencies are
  shared by symlink.

## 2026-09-03 — Merge commits over large main deltas can stall staged hooks

- **Work:** Merge the latest `origin/main` into the feature branch before final
  exact-head verification.
- **Evidence:** The semantic merge resolved 16 conflicts and staged 5,677
  incoming paths. Its pre-commit hook completed the JSDoc inventory, then both
  the Biome and ESLint processes remained live but showed unchanged CPU and I/O
  counters across repeated observations after more than eight minutes. The
  commit attempt was interrupted without changing the resolved index.
- **Prevention:** Teach staged-file hooks to evaluate a merge commit's
  first-parent feature delta, or cap and shard path fan-outs when the second
  parent already carries the incoming files' own gate history.

## 2026-09-03 — Census emitted unrelated custom-rule diagnostics

- **Work:** Regenerate the repository-wide residual census after merging the
  latest main.
- **Evidence:** The original census invoked the full root Oxlint configuration.
  Its post-merge run remained active for more than twenty minutes, disappeared
  without updating the artifact, and a bounded probe showed that the command
  also emitted diagnostics for three unrelated warning-level custom rules. A
  quiet canonical-config probe scanned all 4,936 governed files in under four
  seconds and exposed 26 newly merged inline compiler calls.
- **Prevention:** Have single-rule census tools suppress unrelated warning
  output while retaining the repository's canonical config and ignore scope.

## 2026-09-03 — Pipeable-signature matching needed named result shapes

- **Work:** Resume the exact owner matrix after merging the latest main.
- **Evidence:** `@beep/agents-client` failed through its `@beep/effect-drizzle`
  dependency because tsgo 0.39 reported four `missingPipeableSignature`
  diagnostics on newly merged `dual` functions even though each already had
  corresponding data-first and data-last overloads. Explicit `dual` type
  arguments did not help; naming the shared intersection and callable result
  types made the existing overload pairs compiler-verifiable without changing
  runtime behavior or call forms.
- **Prevention:** When pipeable overloads return complex generic intersections
  or callable shapes, express the shared result through one named internal type
  so the diagnostic can compare identical type origins.

## 2026-09-03 — Module-scope hoists can still precede their schema values

- **Work:** Verify the `@beep/scratchpad` owner in the exact-tree package
  matrix.
- **Evidence:** Scratchpad docgen failed on five tracked modules because
  compiler constants inserted at module scope referenced schema or class values
  declared later in the same module. Relocating each constant immediately after
  its dependency made canonical scratchpad docgen pass without runtime changes.
- **Prevention:** Make codemod safety analysis require declaration-order
  dominance in addition to module scope, and classify unresolved or later
  schema dependencies as manual rather than emitting an eager compiler const.

## 2026-09-03 — Frozen dependency state can misreport diagnostic inventory drift

- **Work:** Run the canonical Yeet repair after merging the latest mainline
  diagnostic policy.
- **Evidence:** `beep quality tsgo-rules` reported eight configured rules as
  unexpected while the lockfile required `@effect/tsgo` 0.39.1 and the
  installed package was still 0.35.0. A frozen install upgraded the package,
  after which the same gate verified all 103 installed rules.
- **Prevention:** Refresh dependencies from the frozen lockfile after merging a
  dependency-version change and before comparing installed tool inventories to
  checked-in configuration.

## 2026-09-03 — Schema-first reconciliation erased exception decisions

- **Work:** Run the schema-first gate after the repository-wide compiler-hoist
  migration.
- **Evidence:** The live and tracked inventory totals both remained 88, but 12
  entries appeared missing and 16 appeared stale because line-based advisory
  locations moved with the hoists. The canonical `--write` reconciliation then
  downgraded the 12 surviving justified exceptions to generic advisories and
  replaced their documented reasons.
- **Prevention:** Give schema-first inventory findings a location-independent
  identity, using the path, rule, and symbol as the durable key while retaining
  line numbers only as evidence metadata, and preserve status/reason fields
  when a live finding matches an existing entry independent of location.

## 2026-09-03 — Hoisted test codecs triggered an HTML-sink SAST heuristic

- **Work:** Run the isolated Yeet verification after hoisting schema compilers
  in the lexical model tests.
- **Evidence:** The SAST lane classified both hoisted SafeUrl codec functions as
  unknown HTML sinks solely because their nested call contained a literal
  script-tag regression fixture; the same fixture passed before the compiler
  references were named.
- **Prevention:** Keep malicious URL fixtures runtime-identical while spelling
  HTML delimiters with string escapes, so generic sink heuristics do not
  obscure the boundary-sanitization assertion being tested.

## 2026-09-03 — Full lint-policy failure was hidden by bounded output

- **Work:** Diagnose the isolated Yeet verification after every visible policy
  subcheck appeared to finish cleanly.
- **Evidence:** The 29,730-observation knowledge-reference report exhausted the
  512 KiB parent capture before the lint-policy failure footer, and the generic
  packet misclassified the aggregate failure as a security audit. An isolated
  tail-preserving policy run identified `lint:native-runtime` and its two
  warnings in the new schema assertion adapter.
- **Prevention:** Emit failed subprocess labels and exit codes before rendering
  bounded successful output, and carry the nested failed-step category into
  Yeet packets instead of inferring a generic category from the parent lane.

## 2026-09-03 — Managed sandbox blocked the tsgo child process

- **Work:** Verify the newly merged `@beep/repo-cli` compiler-hoist family with
  its canonical package verifier.
- **Evidence:** The managed lane reached `tsgo -p tsconfig.check.json` and then
  failed to spawn the configured Node runtime with `EPERM`. In the unrestricted
  checkout, the exact package verifier passed with audit and docgen green after
  the merged inline compilers were hoisted. The P0 inbox row was acknowledged
  with fix SHA `ff8164457af9825cb48e37400698727c143675ab`.
- **Prevention:** Start canonical package and Yeet proof sessions with a
  verified Full-access permission profile, and preserve that profile across
  Desktop task continuation.

## 2026-09-03 — Test-TSGo temp configs collided across checkout runners

- **Work:** Publish the current compiler-hoist implementation through the
  canonical Yeet full proof.
- **Evidence:** Two overlapping Bun/Turbo trees in the same checkout shared
  `node_modules/.tmp/tsgo-test-checks`. One runner's recursive cleanup removed
  the other runner's synthetic `@beep/uspto-mcp` and `@beep/ontology-domain`
  configs, producing TS5058 missing-path failures with no compiler diagnostic.
  After the overlap ended, an isolated rerun checked the same 1,000 files
  across 138 packages and passed without diagnostics.
- **Prevention:** Give each test-TSGo run a run-scoped temp directory, or
  serialize the command per checkout before creating and recursively removing
  synthetic configs.

## 2026-09-03 — Managed scheduler status misclassified host PIDs as dead

- **Work:** Inspect a canonical Yeet verify that remained first in the
  admission queue behind two active host proofs.
- **Evidence:** `beep quality scheduler status --json` inside the managed PID
  namespace reported both host leases and the queued ticket as dead with zero
  active tokens. The same command in the unrestricted host lane reported the
  two leases and ticket as live with advancing heartbeats; the host reaper
  correctly removed nothing. During the same wait, the admission loop also
  reported one unrelated dead queue ticket as reaped on every poll without
  removing it.
- **Prevention:** Make scheduler liveness checks namespace-aware, or route
  status and reap through the same host execution boundary as admitted proof
  processes before declaring their PIDs dead. Remove dead ticket files
  atomically, or suppress repeat notices once another waiter owns cleanup.

## 2026-09-03 — Ignored goals index drifted across the base merge

- **Work:** Reverify `@beep/repo-cli` after merging the latest `origin/main`.
- **Evidence:** The package audit passed build and check but one
  `goals-bootstrap-plan.test.ts` assertion compared a freshly generated
  176-packet index with a stale ignored local projection containing 175
  packets. `bun run beep goals index --write` restored the focused test to
  24/24 before the complete package audit passed.
- **Prevention:** Refresh the branch-specific ignored goals projection when a
  base merge changes packet manifests, or make the deterministic fixture test
  independent of pre-existing ignored projection state.

## 2026-09-03 — Merged-preview resource failures lost their inner-lane identity

- **Work:** Publish the zero-census implementation through the canonical Yeet
  full proof.
- **Evidence:** The exact head passed the complete pre-push lint-policy,
  test-TSGo, coverage, test, and docgen proof, then its merged-preview parity
  copy exhausted an 8 GiB Node heap in the deprecated-API ESLint pass. Sixty-one
  doctests subsequently reached the identical ten-second timeout, while the
  aggregate 512 KiB capture omitted the useful doctest and coverage tails and
  the generated packet incorrectly suggested a changeset repair even though
  the changeset lane had passed. The full lint-policy rerun passed in isolation,
  and the newly merged mainline sharding fix directly divides the OOMing pass.
  During two other admitted full proofs, an affected doctest rerun reduced the
  timeout set to ten; representative 38-example and one-example files from
  that set both passed when run individually.
- **Prevention:** Preserve a bounded tail and exit category for every inner
  parity lane, propagate those categories into the P0 packet, and admit heavy
  merged-preview work with enough memory or independently sharded lint passes.
  Route direct heavy-lane replays through the same admission scheduler so
  overlapping repository proofs cannot starve their worker deadlines.

## 2026-09-08 — Dependency fan-out obscured the affected package result

- **Work:** Verify the post-main `@beep/semantica` compiler hoist through its
  canonical package gate.
- **Evidence:** The first verifier stopped in the unchanged `@beep/xai`
  dependency with a locationless `TS2589` before reaching Semantica's own
  audit. An immediate exact XAI build passed, and the canonical Semantica
  verifier then passed its audit and docgen lanes. The environment-only P0 row
  was acknowledged only after both results were captured.
- **Prevention:** Preserve the failing dependency and phase as structured
  package-verifier output, and automatically retry a locationless dependency
  diagnostic after one exact dependency build before attributing it to the
  affected owner.

## 2026-09-08 — A newly published advisory invalidated the full proof late

- **Work:** Complete the exact-head Yeet verification after every source,
  policy, documentation, build, package, test, and coverage lane had passed.
- **Evidence:** The 34-minute collect-all run finished with only
  `pre-push:security` red because OSV began reporting
  `GHSA-vwc7-r8mq-g2x9` for transitive `adm-zip` 0.6.0. The branch lockfile is
  byte-identical to current main, npm still reports 0.6.0 as latest, and the
  advisory provides no fixed release. The P0 row was acknowledged as
  environment-only after that attribution.
- **Prevention:** Refresh vulnerability data in a short admitted preflight
  immediately before expensive full proof, and surface newly published,
  no-fixed-release advisories early enough to perform the repository's
  time-bounded exception review before the collect-all run.

## 2026-09-08 — Long-running commands lacked progress diagnostics and proof reuse

- **Work:** Run the canonical repair and publication proof for the
  repository-wide compiler-hoist campaign.
- **Evidence:** `quality test-tsgo` announced 1,019 files across 139 packages
  and then emitted no progress diagnostic for 493 seconds. Confirming that it
  was still running required an external process check. JSDoc inventory was
  similarly silent for 264 seconds in the earlier run and 362 seconds in a
  later publication proof, while deprecated-API lint buffered its 28 shard
  identities until its 182-second completion. That publication preview first
  passed the same 1,019-file `quality test-tsgo` command in its cheap gates in
  435 seconds, then reran it under a different pre-push lane id for 642 seconds
  despite the unchanged preview. A later
  `quality package-verify @beep/repo-cli` emitted no phase or progress output
  during its 366-second audit, then printed only its final audit and Docgen
  summary. The immutable merge preview also reran repo-cli's same 162-file,
  3,153-test surface in the unit and property lanes for 352 and 402 seconds,
  respectively, despite equivalent proof earlier in that same preview.
  Coverage then ran its distinct instrumented proof for 416 seconds.
- **Prevention:** Give repo-cli and other shared scripts and commands a bounded
  progress contract: structured phase, current-unit, completed, remaining,
  elapsed, and last-completed events plus concise interactive heartbeats. Key
  successful proofs by command, environment, dependency graph, and workspace
  digests; reuse exact matches across nested aggregates, and report the key
  dimension that requires a rerun when reuse is unsafe.

## 2026-09-08 — Desktop continuation changed the effective permission profile

- **Work:** Finish the local merged-preview proof and packet closeout after
  PR #1022 merged.
- **Evidence:** A continuation reported `managed` / `workspace-write` with
  `.git` read-only despite the previously unrestricted session. The repository
  stop rule blocked three automatic continuations until the operator restored
  Full access. The existing verifier remained live and later passed.
- **Prevention:** Preserve the effective permission profile across background
  continuation and model changes. Show any mismatch before tools resume, and
  pause automatic goal retries while user action is required.

## 2026-09-08 — Merged follow-up fixes left predecessor review threads open

- **Work:** Audit comments before closing the compiler-hoist packet.
- **Evidence:** All three PR #1022 threads were resolved, but the two original
  PR #1019 threads remained open after their fixes merged in #1022. The
  cross-PR sweep found them; Yeet posted the fix references and resolved both.
- **Prevention:** Track every implementation PR in packet closeout and inspect
  its discussions, including merged predecessors, before claiming that all
  review comments have been addressed.

## 2026-09-08 — GraphQL quota stopped publication after a successful push

- **Work:** Publish the documentation closeout with Yeet's early PR path.
- **Evidence:** Commit and push succeeded, but `gh pr create` failed with
  `GraphQL: API rate limit already exceeded`. Yeet restored the unrelated
  staged-only residue and exited before local proof or hosted monitoring. A
  direct REST request could still list the branch's pull requests.
- **Prevention:** Treat a pushed branch as a durable publication checkpoint.
  Report the failing API bucket and reset time, and offer a REST PR-creation
  fallback while retaining the required local proof and review gates.

## 2026-09-08 — Package-matrix resume ignored committed changes

- **Work:** Audit the package receipts during PR #1028 closeout review.
- **Evidence:** The historical report names commit `45b422a58e`, but its digest
  is the empty-input SHA-256. The runner hashed only dirty differences and
  ignored committed tree identity, so a clean checkout after a merge could
  resume stale results. That receipt is no longer treated as final-tree proof.
- **Prevention:** Include the committed tree, verifier bytes, owner inventory,
  and uncommitted inputs in the receipt identity; pin the recorded head for
  the run and refuse to relabel results if it changes. Test resume behavior
  across two clean commits, then rerun the full owner matrix.
