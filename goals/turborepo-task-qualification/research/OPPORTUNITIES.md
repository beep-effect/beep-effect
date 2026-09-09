# Friction and opportunities

## 2026-09-09: an absent installed dependency hides a lint failure

The read-only source worktrees contain no node_modules tree. A fresh probe
compares this fixture with a read-only view of the installed dependencies.
The unmodified installed computation passes. Adding a nondeprecated external
export/import also passes; deprecating only that external export makes both
quiet and verbose lint fail, and verbose output identifies the deprecation
rule. The otherwise equivalent source fixture without installed dependencies
passes because that export is not resolved. The
[installed-dependency observation](./installed-dependency-observation.json)
records all eight runs and preserves host overlay-target and lockfile hashes.
Its installed view is not a complete integrity attestation. A pinned binary
and lockfile do not alone prove that a source fixture materializes every
dependency the selected computation reads. Bind and verify that materialization
before treating the local pilot as the normal workspace computation.

## 2026-09-09: native dependency repair and helper API correction

The [native dependency probe](./dependency-cache-invalidation.json)
reproduces stale successful replay on both pinned clients: local hit exits
zero and forced fresh execution exits one at task hash `750fbc908c142716`.
Adding the identity-only `^lint` edge changes the selected hash when the
dependency changes, and both clients execute and fail fresh as expected.
The durable repaired controls also pass: 24 observations and 12 checks.
Dependency source reads need hash participation even when the dependency's
own lint result is fresh and successful. The scoped repair keeps types lint
excluded and cache-disabled.

The first implementation check of the new control caught two API mistakes:
`LiteralKit` has `pickOptions` rather than tagged-union `isAnyOf`, and Effect
String's replacement helper is curried. Use `A.contains` with the literal
kit's selected options and the installed String helper signature. The
corrected source passes typechecking and native controls. Check the exact
helper API before extending a neighboring control pattern.

## 2026-09-09: a dependency export changes the selected lint verdict

The root configuration enables `noDeprecatedImports` as an error. Its project
scanner explains why the direct trace opens files outside identity; upstream
[rule documentation](https://biomejs.dev/linter/rules/no-deprecated-imports/javascript/)
identifies that scanner dependency. A bounded fresh probe adds an ordinary
relative import of a types-package export to an isolated identity source file.
Changing only that export's JSDoc deprecation annotation changes both quiet
and verbose lint from exit zero to exit one, with the verbose diagnostic
identifying `lint/suspicious/noDeprecatedImports`. An annotation on the
existing namespace export did not trigger that rule; it cannot establish
general dependency irrelevance. The
[fresh observation](./dependency-deprecation-observation.json) preserves both
cases. Native cache invalidation and an identity-specific fresh dependency
edge are being tested before broader replay comparisons continue.

## 2026-09-09: bounded trace exposes a wider file-open boundary

The direct identity wrapper probe's broad file/network/process trace reached
its 8 MiB limit and was rejected. A narrower file-open/network/process trace
completed three fresh cases below 4 MiB each. Each case opened 7,662 regular
repository files, of which 7,635 were outside identity, and produced the same
53-byte stderr capture. Successful opens establish presence, not semantic
influence or complete read/write coverage. The
[interpreted receipt](./alias-file-open-review.json) keeps private trace hashes
and line references. This boundary needs further classification before
qualification; no tuple promotion follows from matching outputs.

The earlier alias control failed because the inherited root tsconfig exclusion
kept a changed root configuration out of the task hash. The identity-only
[input review](./alias-input-baseline-review.md) removes that exclusion while
preserving the root lint inputs and cache-disabled state. Its native input
count increases from 43 to 46. Review effective exclusions together with
positive inputs; listing a global input does not prove that a task hashes it.

## 2026-09-09: incorrect cache-policy command dispatched aggregate lint

An operator invocation used `beep lint cache-policy`, which dispatched the
aggregate lint planner instead of the intended gate. The owned dispatcher
was interrupted and exited 130 with `All fibers interrupted without error`.
No validation credit is assigned to that run. The correct
`beep quality cache-policy` command completed with zero blocking findings and
922 unassessed cached computations. Use the canonical Quality command;
rejecting unknown lint selectors would prevent this accidental fan-out.

## 2026-09-09: tooling role creation is slice-only

While locating the canonical generator for the Cache operational roles and
repo-configs policy facade, `bun run beep architecture add role --help`
accepts only `<slice> <concept> <role>`. Its plan command also exposes slice
stages only. Applying that generator to this tooling extension would create
the wrong topology. Follow the binding tooling anchors in
`standards/ARCHITECTURE.md` and extend the existing packages directly after
this command inspection. No new package is needed. A tooling-role planning
mode would prevent repeated routing investigation; architecture tooling owns
that future improvement.

## 2026-09-09: web reader rejects upstream documentation formats

The web reader rejected the npm dist-tags URL and the official Turbo
configuration reference's `text/markdown` response. A direct HTTPS registry
read recovered exact stable/canary metadata; installed Turbo and its dry-run
definition remain the executable authority. Prefer the official markdown
route or local exact-release source for configuration details.

## 2026-09-09: format-after-fix order and census capture size

The first repo-configs package audit passed build/check and 58 tests, then
failed Biome on formatting introduced by a typed-decoder correction. This is
an introduced failure, repaired with the package-scoped formatter before
repeating package verification. Format after every final source correction,
not before it. The inbox row is tracked by this active task pending proof.

The exact full Turbo dry plan is about 28.5 MB; a naive census repeated input
paths into an 11.9 MB report. Raw dry plans remain ignored local artifacts.
Replace repeated expanded path lists with bounded content digests/counts and
keep detailed input inspection scoped to the pilot. Default command output
must be a compact summary, with full JSON explicitly requested or written.

## 2026-09-09: schema codec regression tests need derived property coverage

The schema-first check identified the new policy test file's three codec
regressions without schema-derived property coverage (`SFV4-arbitrary-tests`).
This introduced finding was repaired by testing serialization equivalence
over `S.toArbitrary(CacheQualificationKey)` with the repo's bounded `fcRuns`
policy. The inventory was not rewritten to accept the finding. Run the
schema-first check alongside focused schema tests before the package handoff.

Historical leads remain in the [exploration ledger](../../../explorations/turborepo-quality-cache/research/OPPORTUNITIES.md)
and [opportunity disposition](../../../explorations/turborepo-quality-cache/research/opportunity-disposition.md).
Refresh historical claims before treating them as current.

## Qualification writer release, 2026-09-09

- Operation: initial reviewed baseline write. The atomic baseline was written,
  but the directory mutex release returned `FileSystem.remove: Unknown`.
- Attribution: introduced; the Node portable remove operation needs recursive
  directory semantics even for the writer-owned empty mutex directory.
- Repair: use recursive removal only for the successfully acquired mutex;
  preserve pre-existing locks. Add lifecycle/concurrency tests proving release.
- Prevention: exercise the actual filesystem writer before wiring acceptance.

## Evidence schema arbitrary generation, 2026-09-09

- Operation: schema-derived ledger round-trip property.
- Evidence: fast-check rejected the receipt path regex with
  `Assertions of kind Lookahead not implemented yet`.
- Attribution: introduced; the receipt path used lookahead for traversal checks.
- Repair: constrain portable evidence path components positively, without
  lookahead. Keep dot-prefixed artifact directories; reject standalone dot
  segments, backslashes, absolute paths, control characters and drive prefixes.
- Prevention: derive the whole state model arbitrary while authoring path schemas.

## Exact native client and filesystem API, 2026-09-09

- Discovery found that the installed Turbo JS launcher honors a binary-path
  override and may install a missing platform package. Qualification discovery
  now selects an installed native binary directly and refuses a missing client.
- The Effect reference checkout describes a numeric file-read size, while the
  installed declaration/runtime returns a branded bigint. The new bounded
  reader's typecheck and direct fingerprint smoke run exposed the mismatch.
- Attribution: introduced use of the newer reference signature. Conversion of
  the bounded byte count is now explicit; EOF uses the installed bigint API.
- Prevention: compare both the installed declaration and the reference version
  before adopting a changed low-level API. Neither failure was waived.

## Isolated pilot bootstrap and capture bounds, 2026-09-09

The first isolated identity-lint observation used the existing Worktree
`addWorktree` API because `worktree new` also installs dependencies and copies
local environment files. The linked checkout's expanded input map includes
root `tsconfig.json`, `tsconfig.base.json` and `tsconfig.packages.json`, while
the main checkout's map omits them. Direct file checks show all three already
exist in both roots with identical bytes. This corrects the initial missing-file
hypothesis; no configuration files were copied. The cross-root hash difference
remains an unaccepted observation requiring attribution.

The full Turbo-plus-children file/process/network trace reached the initial
16 MiB file limit and exited 153. That observation is failed and excluded from
the comparison counts. A fixed 64 MiB trace cap is the next bounded probe;
compact raw references remain under ignored `.beep/`, with seven-day retention.
The fixture runner should distinguish incomplete preparation and capture
truncation from semantic failure before any promotion count is considered.

The CLI package audit then caught an introduced planner expectation failure:
`test/yeet.test.ts` expected the old pre-push lane list without
`repo-sanity:cache-policy`. The operational Quality route already included the
new lane. Update both direct Quality and consuming Yeet plan expectations when
adding a gate, and include both focused planner suites before the full audit.

Exact npm platform archives use the `turbo-linux-x64/` prefix, which differs
from the generic `package/` convention. Extract only the verified regular binary
member after checking npm SHA-512 integrity and matching package name/version.
The portable strace package was signature-verified with the installed Arch
Linux public keyring after dearmoring it into the disposable tool directory;
no package installation or system keyring mutation was required.

## 2026-09-09: cache-disabled runs omit the Turbo replay log

The first durable synthetic run (`bun run beep cache synthetic`) stopped with
`Required bounded fixture artifact is missing: packages/fixture/.turbo/turbo-qualify.log`.
The task completed, but exact stable Turbo does not persist that replay log
with `--cache=local:`. The runner now uses a fixed task wrapper that records
the task stream as a declared output, and inspects the separate Turbo replay
log whenever present. Successful cache-enabled runs require that replay log.
Missing evidence remains a failure; an empty fallback is never comparison proof.
A capture contract distinguishing fresh task streams from cache replay logs
would have prevented the initial assumption.

## 2026-09-09: malformed alias JSDoc reached the full package gate

The synthetic-runner package audit passed, but package docgen rejected two new
alias comments: `Missing description` and `Missing @since tag`. Both comments
put multiple tags on one line. They were introduced here, acknowledged in the
checkout P0 inbox, and corrected to described multiline tags. A focused
documentation check before the six-minute package audit would have caught
this formatting error sooner. The full package gate must pass after repair.

## 2026-09-09: disabled live posture and qualified target were conflated

The initial configuration fingerprint included both the cache flag and the
configuration source bytes. A disabled pilot therefore could not admit a
contract for its eventual enabled configuration without first enabling reuse.
The initial audit also permitted a candidate/shadow cache flag when the legacy
baseline already allowed it. Both gaps were introduced in this goal's draft.

The repaired boundary retains immutable disabled/enabled config artifacts and
the entire disabled fingerprint, validates that only the selected workspace
task's cache flag changes, and previews the target fingerprint without touching
the live checkout. Candidate/shadow ordinary reuse is now a blocking finding.
Promotion also requires per-client activation-invariance evidence. Focused
policy and projection tests cover these boundaries; native Turbo parity and
full package checks remain the required operational proof. A two-posture
contract and a candidate-with-legacy-cache test at the initial design stage
would have prevented this mismatch.

## 2026-09-09: planner projection omitted semantic environment

The initial entrypoint snapshot used a reduced step schema with only label,
command, arguments and working directory. Encoding it omitted the property
lane's explicit `BEEP_FC_NUM_RUNS` and `BEEP_FC_SEED` environment. That was an
introduced evidence gap, even though the underlying planner was correct.
The v2 recipe reuses `QualityTaskStep` and records all supplied options. Clean
local and hosted-context runs now retain the seed/run values and expose Check's
different concurrency defaults. Reusing the operational step schema initially
would have prevented this loss.

The follow-up review found another reduced projection: Quality lane records
omitted `blockedBy` and optional `orderEstimate`. The recipe now encodes the
existing `GithubCheckLaneSpec` directly. Its 78 current records have empty
dependency lists and no ordering estimates, so no runtime ordering result is
inferred. The complete model preserves these fields when a planner supplies
them. Existing operational models should be reused throughout a receipt, not
only for its innermost command.

## 2026-09-09: a small pilot probe waits behind the full admission budget

The one-token native activation comparison has waited over 28 minutes behind
two live five-token merged-preview admissions. The command is still queued;
no timeout or failed runtime verdict is claimed. A second one-token capture
probe uses a separate owned worktree and the same admission route. Independent
source review continues while both wait. Reserving capacity for short probes
or measuring queue latency separately from execution would make this friction
visible without weakening admission or stopping another owner's work.

## 2026-09-09: probe setup failed before the intended runtime comparison

After admission, the private native projection probe failed with
`Service not found: @beep/repo-utils/FsUtils/FsUtils`. Its standalone layer had
omitted `FsUtilsLive`; the Cache command's normal composition already supplies
it. The probe now uses the same service composition as the operational tests.

The quiet-lint probe then reached two introduced setup errors. Its proposed
enabled config used expanded array formatting that Biome rejected, so the
nominal baseline also failed. The full Turbo invocation combined `--cache`
with `--force`; the pinned native client rejects that combination before
execution. New proposal artifacts retain the valid disabled file's formatting,
and the probe clears only its disposable cache directory to obtain fresh runs.
The original artifacts remain retained. Failed setup observations receive no
comparison credit, even when two exit codes happen to match. A successful
baseline assertion now precedes the adversarial cases.

## 2026-09-09: dependency failure can omit the selected task from a run summary

The corrected quiet-lint probe passed its six direct comparisons and five
stable graph executions, then stopped on `Selected task missing or repeated
in runtime summary`. The invalid root configuration failed types lint before
identity lint ran. Requiring an identity record in every graph summary was an
introduced probe defect. The probe now permits omission only in that exact
negative case with an observed failed types dependency, nonzero graph exit and
no identity log, and records it as not executed. A selected-task outcome model
that includes dependency-blocked execution would have prevented this error.
The partial run is retained and gets no complete-matrix credit.

## 2026-09-09: source inventory recipes need population and service checks

The first workflow snapshot recipe matched zero files with a nested brace
glob. In installed Bun, the two separate workflow/action patterns match nine
and one files, while their combined nested pattern matches none. A nonempty
schema caught the empty population. The corrected recipe uses separate
patterns, checks its population against the file inventory, and provides the
Crypto service required by the shared byte-hash schema. Both faults were in
this diagnostic recipe, before any runtime experiment. An explicit expected
population comparison and the normal boundary layer composition would have
prevented the failed attempts.

## 2026-09-09: displayed Actions cache keys omit a partition

Source inspection of the setup action found that its displayed Bun/Turbo
cache keys omit the fleet/shared runner partition present in the actual
restore/save keys. A report-only key cannot reconstruct archive identity.
This review records the complete action source and uses the actual `with`
blocks. Sharing the same key expression between execution and reporting would
prevent this inherited observability discrepancy; deployed behavior remains
with the workflow and trust evidence owners.

## 2026-09-09: the first trace sandbox made `/dev/null` unreadable

The retained linked-worktree trace shows Git discovery finding the Git binary,
then failing to open `/dev/null` with `EACCES` before launching it. Its dry
summary has null Git revision/branch fields and three additional root
TypeScript-config inputs. The early probe bound `/` read-only without creating
a working device mount. A small controlled metadata probe reproduces errno 13;
adding `--dev /dev` restores the null-device read and a successful Git revision
lookup. The installed and explicitly pinned Turbo binaries have matching
digests despite the trace's local-binary delegation. A paired exact-client dry
run is prepared to test whether the device mount also explains the expanded
input difference. The old trace remains exploratory and cannot establish
cross-root portability. Sandbox device/SCM preconditions should be checked
before expensive traces or comparison claims.

## 2026-09-09: a narrow script repair changes sibling computation digests

After applying the verified identity lint capture repair, the policy audit
reported six cached identity computations with `configuration-drift`. The
census comparison shows one actual command change and eleven changed
complete-workspace-script digests; the other commands and their effective
settings are unchanged. This is the expected conservative invalidation scope,
not an unrelated failure to waive. A reviewed baseline replacement records
the exact prior digest and the isolated change. Presenting the changed script
alongside the affected shared digests would make this attribution immediate.

## 2026-09-09: the entrypoint attachment needs arbitrary payload preservation

The first entrypoint integration check caught two introduced missing template
delimiters before tests could load; the corrected focused suite passed. The
schema-first gate then identified schema-heavy tests without derived property
coverage. A property now supplies arbitrary JSON owner fields through the
actual immutable-file attachment boundary and verifies complete preservation.
This directly guards against the field loss that affected earlier planner
snapshots, rather than adding only a codec roundtrip assertion.

The full package audit subsequently passed, but docgen rejected the new
evidence helper's relative example import with `TS2307`. Generated examples
live outside the source directory, so that import cannot resolve there. The
helper is now exposed through the existing source-only Cache test facade and
the example uses that package alias. No runtime behavior changed. Using the
existing facade from the first draft would have prevented this introduced
documentation-gate failure.

The next package run reached lint and found the newly added test-facade export
out of order. This was another introduced repair omission: that facade had
not been included in the focused formatter invocation. The complete touched
file list now receives the format/import check before the full package rerun.
Deriving that list from all changed files, including barrels changed during
docgen repair, would prevent the additional aggregate run.

## 2026-09-09: commit hooks need explicit generated and synthetic boundaries

The requested implementation commit stopped in two pre-commit hooks. The
new `.ignore` re-admits Graft cards for search, so the spelling check scanned
the generated `adjascentGlobstarOptimize` identifier. `_typos.toml` now excludes
`graft/**`, matching its generated-source role without changing source names.
Gitleaks also reported `generic-api-key` on the fixed public synthetic canary
in `Cache.experiment.ts`. Its exception requires both that exact value and the
exact source path, and applies only to that rule. No runtime code changed.
Checking generated search surfaces and adversarial fixture literals through
the actual staged hooks would have caught these integration failures earlier.

## 2026-09-09: main changes the pilot's runtime and script boundary

The requested main merge produced 25 conflicts, including the Bun pin,
dependency resolution and workspace-script convergence. Main now generates
the `lint` task wrapper, so retaining the old direct quiet command there would
be reverted by the policy writer. The quiet command now lives in `beep:lint`;
`beep:lint:verbose` and the audit retain detailed diagnostics. The canonical
writer reports zero drift. Both this script boundary and Bun 1.4.2 invalidate
the previous pilot's source/toolchain bindings; those receipts remain historical.
A base-freshness check before long experiment waves would identify this
integration work sooner. No qualification or cache activation follows from
resolving the Git conflicts.

The focused merged-tree run passed 175 of 176 tests. Its sole failure caught
the order of the two independently added final Yeet gates in the merged test
expectation; the implementation already retained both gates. The expectation
now follows the observed planner order. Pre-commit hooks passed, but the
first merge message used unsupported type `merge`; the retry uses `chore`.

## 2026-09-09: runtime discovery must not inherit a stale shell pin

After main advanced `.bun-version` to 1.4.2, `bun --version` still reported
1.4.1 while `mise which bun` resolved the already-installed 1.4.2 runtime.
`mise exec bun@1.4.2 -- bun install --frozen-lockfile` completed successfully.
Qualification commands now use that explicit runtime. Synthetic requests
bind each Bun executable, observed version and SHA-256; runtime changes are
tested with two actual installed binaries. An ambient PATH lookup cannot
silently choose the experiment runtime. Fresh/fresh and replay comparisons
also reject differing runtime digests even when other captured bytes agree.

The existing fingerprint collector still constructed the old 1.4.1 profile,
so the first current-runtime request failed its profile check. The collector
now reads the repository pin, compares it with the observed runtime and
derives the supported profile. A negative invocation confirms that the stale
shell runtime fails without writing a fingerprint. A profile derived from the
observed runtime would have prevented the stale hardcoded identity.

The first v3 experiment expansion passed all assertions but contained only
nine shadow authorities under the primary runtime; the alternate runtime
could not supply the tenth primary-profile decision. An empty semantic
environment scenario now supplies a distinct tenth primary case. Both exact
clients reran the complete matrix. Counting qualifying comparisons by the
actual runtime digest before launch would have caught the coverage gap.

## 2026-09-09: merged-wrapper activation needs input-map attribution

The first admitted merged-wrapper probe passed all six real task executions
and both local replay checks. Selected-task captures matched between disabled
execution, producer and replay on both exact clients. Its two hash-invariance
assertions failed when the child configuration changed from cache-disabled to
enabled. The probe retained only each native summary digest, so the next
attribution pass must also retain bounded original summary bytes to identify
the changed hash inputs. No activation-invariance or qualification claim
follows from the successful log comparison alone.

The attribution rerun retained all six original summaries. For both clients,
only the child `turbo.json` input blob changed across activation; global inputs
were equal. Enabled producer and replay had equal input maps and hashes. The
selected capture and replay logs were all 53 bytes with the same digest.
The failed assertion was too broad: the child configuration is an ordinary
file input, so changing its cache flag changes the task hash. Activation
comparison must bind that approved input delta and compare semantic outputs
and captures; it must not weaken ordinary same-configuration hash comparisons.

The architecture role command also rejected `pilot` as an unsupported role.
The command targets canonical slice roles, while Cache is an existing CLI
command concept. No role file was generated. Keep any extraction within
Cache's existing ownership and check the tool-family topology before adding
its earned experiment roles.

The trace-led ignore-file probe then established an actual invalidation
failure. Identity and types both returned successful local hits after removing
a root ignore rule that revealed a tracked syntax error; fresh execution
failed at the same hash on both clients. Binding semantic reads before relying
on configuration declarations would have caught the omitted `.gitignore`.
Identity now adds root/ancestor ignore inputs, types lint reuse is disabled
and explicitly excluded, and all four repaired ignore-path controls pass.

The final audit invocation initially used the sibling commands' `--output`
flag. Audit supports `--json` instead and rejected the flag before running.
The corrected invocation captures JSON stdout separately from diagnostic
stderr and passes. Reading the audit's own command contract would avoid
assuming that the output flags are shared across the command group.

The requested commit preflight found compiler errors in the newly started
pilot executor: `Array.filterMap` expects `Result`, separate-stream capture
does not accept a timeout option, and recursive generators need explicit
return channels. The preflight repairs use the installed Effect APIs and
add capture-boundary tests. Checking the package before expanding the
executor would have caught these integration errors earlier.

The commit hook's Biome write step reformatted 18 qualification JSON files,
including receipts referenced by SHA-256. The intended hook exclusion did
not protect them. Restore the pre-hook blobs using their recorded hashes and
existing Git objects, and disable formatting only for this packet's JSON
evidence and its two governed registry files. Verify byte preservation under
the real formatter and hook before recording the follow-up commit.

The durable pilot's first native run failed before task execution: Bubblewrap
cannot apply `--remount-ro` to a directory that is not a mount point. The
overlay builder had used `--dir` for synthetic ancestors. Use a separate
tmpfs mount for each synthetic ancestor, then remount those parents read-only
while retaining the explicitly writable child mounts. A native version probe
caught this boundary error that TypeScript and capture parsing tests could not.

The first refusal harness wrapped the CLI in `bun run beep` and killed that
wrapper after 90 seconds without preserving a verdict. No request process
remained when checked. The direct, explicitly pinned CLI entrypoint returned
the intended wrong-executable-pin error. The remaining probes use that
entrypoint, put the same Bun installation first on PATH, stream diagnostics
to private logs and leave admission waits outside an arbitrary outer timeout.
The timed-out attempt is not counted as a successful negative case.

The next commit preflight caught two type errors in the authored v2 controls:
the constructor default widened its literal to `string`, and a leading
conditional spread hid the required nonempty result array from TypeScript.
Preserve the default's literal type and place the unconditional result entries
first. Run the package check after each schema/control increment so these
errors surface before the commit boundary.

Merging `main` at `bed30c6adf` conflicted in the identity scripts, the cache
gate registration and two planner tests. Main's lane constructor also gained
a required tier argument in an otherwise automatically merged cache-gate
registration. Resolve both sides' behavior, migrate the cache gate to the
command-based `quality:cache-policy` id and explicit tiers, and check the
planner tests plus TypeScript. A textual conflict check alone would miss the
constructor change outside the conflict markers.

The integrated `bun run beep quality cache-policy` reports 700 blocking
`configuration-drift` findings and a `turbo.json` source-review notice after
the incoming lint/test graph changes. The old baseline is preserved and the
gate remains enforced. A baseline review and source-binding refresh must
accompany future qualification after a main integration; a clean Git merge
and passing package tests do not establish cache-policy acceptance.

The first v2 control run changed the child task hash and executed fresh, but
the fixture's minified JSON failed Biome formatting. The intended success
and replay assertions therefore failed for a fixture reason. The retained
`pilot-controls-unformatted-child.json` records that trial, including two
fresh failures and no false successful replay. Format valid child-control
JSON through the exact pinned Biome binary inside the read-only sandbox
before testing semantic invalidation; malformed-config controls stay raw.

The formatted v2 control run passes six invalidation cases, but the generated
root alias perturbation keeps the same hash and returns a local hit. Root
lint explicitly excludes root `tsconfig*.json` files. Preserve the trial in
`pilot-controls-alias-observation.json` and require direct fresh comparison
and file-read evidence before deciding whether this input is irrelevant or
the declaration needs repair. The protocol permits documented irrelevance;
a stable hash alone does not prove it. Independent malformed/missing-config
controls disable reuse and may still run after this comparison stops reuse.

### Validate new snapshot modules before branch synchronization

- Activity: prepare the dependency snapshot slice for the requested commit and
  merge from main.
- Evidence: the CLI type check found a finite-number schema diagnostic and an
  unknown tuple-order input in `Cache.dependencies.ts`. The new module also
  needed its public exports connected before its documentation examples could
  resolve. Focused native filesystem tests and schema-first validation pass
  after correction.
- Prevention: finish the module's exports and focused type check alongside its
  first filesystem tests, before moving on to full installed-tree experiments.
