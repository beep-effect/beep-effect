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
