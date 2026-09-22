# Friction and opportunities

## 2026-09-09: draft PR readiness follow-up

The operator authorized taking PR #1068 through mergeability while keeping it
in draft; the qualification packet itself remains paused and incomplete.
Merging current main produced one root tsconfig alias conflict. Both aliases
were retained, and the canonical config generator confirmed no drift.

The first Yeet repair found missing in-range changesets for identity,
repo-configs and types, two unused CI-operations schema exports, and Cache
complexity/duplication findings. The failure is tracked in PR #1068. The
remaining repair feedback was intentionally interrupted after this precise
failure (exit 130); it is not passing proof. Fix the findings and rerun the
canonical gates before publishing or claiming readiness. Do not refresh
complexity baselines to hide newly introduced functions.

The follow-up collects contract, evidence, runtime and experiment checks into
named phases and shares the bounded experiment reader. Fallow audit, dead-code
and health now pass without baseline changes; Knip and the other preliminary
code gates pass as well. The remaining changeset gate reads committed range
entries, so a newly written changeset does not satisfy it until committed.
The first CLI package pass caught an introduced prior-contract reference typo
and inline JSDoc tags; both were corrected before rerunning package proof.

The full proof on the merged branch then found JSDoc regressions that the
committed inventory check had not observed: root imports in new examples and
an absent same-name runtime type alias on the entrypoint dialect schema.
The fresh inventory took roughly five minutes before reporting them. Use
module subpaths in examples, retain the schema runtime alias at authoring
time, and treat a committed-inventory pass as supporting evidence only.
The examples and alias were corrected; no totals baseline was raised.

Hosted validation also found missing category/version metadata on cache export
barrels and four noncanonical operation categories. Package docgen compiled the
examples, but the aggregate metadata gate checks these declarations separately.
The barrel metadata and categories were corrected. The early-publish proof was
intentionally interrupted after the exact-head hosted failure (exit 130); it
must be replaced by a complete green proof.

The hosted secret gate uses the reviewed base-branch policy and scanned 21
false positives already in the branch history: 20 public SHA-256 receipt fields
and one fixed synthetic canary. The same-PR exceptions therefore cannot take
effect until reviewed on main. A separate policy-only branch retains the two
path-and-content-constrained rules. Boundary fixtures prove all four intended
exceptions and preserve six nearby detections. Keep the base-policy pinning;
do not weaken the workflow or rewrite retained receipts to evade history scans.

## 2026-09-09: paused PR publication checks

The first library-fingerprinting typecheck caught a curried Effect String
helper called with two arguments and a finite-role record assembled with a
general record constructor. The next check caught nonempty-array inference
across static/dynamic cases. The exact local helper signature, a schema decode
of the complete role record, and an explicit readonly-array result resolved
the introduced errors. Source checking and all 26 focused tests then passed.

The publication scan of the packet reported 20 generic-key detections in four
runtime-key receipts. They are the public SHA-256 fields `runtimeKeyDigest`,
`runtimeKeyValue`, and `runtimeKeyObservationSha256`, not credentials. The
allowance requires both one of those exact field forms with a 64-character
lowercase hex value and one of the four reviewed receipt paths. A redacted
report is retained privately. The already-committed branch history passed its
separate scan. Keep evidence-field exceptions constrained to both schema and
path; do not rewrite hash-bound historical receipts to satisfy a heuristic.

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

### Retain generated aliases when integrating main

- Activity: merge main's quality-lane changes after saving the local cache work
  in `5ebfc19af3`.
- Evidence: `config-sync:check` found one missing root alias after the merge.
  The canonical `beep tsconfig-sync` writer restored `@beep/repo-configs/cache`;
  the repeated check reports no drift. The quality-lane test conflict also
  needed main's config type-check lane retained beside this branch's cache gate.
- Prevention: validate generated aliases and lane membership after each main
  integration, including merges that Git resolves without a config conflict.

### Supply census services in private dependency probes

- Activity: verify the retained installed tree before a traced native probe.
- Evidence: the first wrapper stopped before running the probe with
  `Service not found: @beep/repo-utils/FsUtils/FsUtils`. The CLI materializer
  and stable pilot had passed using the full CLI environment; the private
  wrapper supplied only platform and scheduler services.
- Correction: use the existing test platform composition, including FsUtils
  and crypto, in a new wrapper revision. Preserve the failed run and credit
  it as no native probe execution.
- Prevention: type-check the standalone wrapper's complete service environment
  before entering scheduler admission.

### Prevent installed Turbo from replacing the requested client

- Activity: run the exact canary matrix with the verified installed dependency
  tree mounted read-only.
- Evidence: the canary stopped at `Sandbox turbo version check failed (exit 0)`
  before recording a matrix. The native CLI documents `--skip-infer` as the
  option that disables project-version inference. The installed tree contains
  the stable Turbo package, a condition absent from the old source fixtures.
- Correction: pass `--skip-infer` at the common native invocation boundary,
  including version checks, and retain the client-selection observation.
  Rerun both clients with the direct invocation contract; the earlier stable
  installed-tree receipt remains preliminary local evidence.
- Prevention: verify the executed version after dependency installation and
  bind the client-selection mode in each runtime receipt.

### Bind the observed installed launcher helpers

- Activity: inspect successful execve records from the installed lint probe.
- Evidence: Biome's package launcher runs Node, `/bin/sh`, `/usr/bin/ldd` and
  the installed native Biome binary. The old toolchain snapshot did not bind
  the `ldd` file; binary version strings alone did not describe this chain.
- Correction: hash the observed system shell/helper files in the runtime
  fingerprint and rerun the exact clients against the expanded identity.
  Preserve the preceding receipts under their original identities.
- Prevention: inspect successful native execve events before calling a
  launcher chain pinned. Shared-library and ambient-input evidence remains a
  separate obligation.

### Read large runtime receipts through bounded summaries

- Activity: inspect the final lines of a native pilot log.
- Evidence: `cache pilot --output` also prints the complete receipt, so the
  log's final line duplicated roughly 100 KB of structured evidence and
  overwhelmed an otherwise short status read.
- Prevention: parse selected fields from the output receipt and filter bounded
  progress lines from logs. A file-output quiet mode would avoid this duplicate
  diagnostic volume; the current receipt bytes remain preserved.

### Carry installed dependency identity into the native task hash

- Activity: warm the isolated lint cache, deprecate an installed export through
  read-only file overlays, and compare local replay with forced fresh execution.
- Evidence: both exact clients return a local hit and exit zero at the unchanged
  hash; fresh lint exits one. Selected source, task configuration and lockfile
  bytes are unchanged. The counterexample is retained in
  `installed-dependency-cache-counterexample.json`.
- Consequence: a reviewed toolchain fingerprint does not by itself partition
  Turbo's native cache key. Live identity/types reuse remains disabled.
- Next test: derive the effective installed-tree digest from the mounted view
  before invoking Turbo and declare it as a hashed task environment input.
  This scoped experiment must not be mistaken for complete runtime qualification
  or for production entrypoint enforcement.

### Use the existing test facade for the tree inspector

- Activity: run the installed-tree partition experiment's namespace observer.
- Evidence: the first helper imported `inspectCacheDependencyTree` from the
  command facade. Typechecking reported no such export, and the native helper
  stopped with `Export named 'inspectCacheDependencyTree' not found` before any
  selected lint execution. That attempt receives no comparison credit.
- Correction: the focused dependency tests already use the curated
  `@beep/repo-cli/test/Cache` export. Use that existing facade in a new helper
  revision and complete its type check before entering the runtime lane.
- Prevention: read the existing consumer import before wiring an internal
  operation into a standalone probe; do not launch after a failed type check.

### Preserve required inputs in configuration perturbations

- Activity: run the full stable/canary pilots after declaring the verified
  runtime key as a native task input.
- Evidence: both runs stop with `The native pilot summary omitted the verified
  runtime key.` The child-config control replaces its complete environment
  declaration with one test variable, removing the new required input. The
  initial dry-plan checks had accepted the declaration. These failed runs
  provide no complete-matrix credit.
- Correction: append the control variable to the existing declaration, keeping
  removal isolated to the named missing-child negative. Include the run id in
  subsequent metadata rejection messages and rerun the native matrices.
- Prevention: perturb a single reviewed property without silently deleting
  prerequisite inputs; retain separate deliberate-removal adversaries.

### Trace asynchronous runtime I/O after installation

- Activity: inspect executable mappings of the installed identity lint chain.
- Evidence: the bounded trace records eight executable system-library files,
  two executable protection changes within a prior Node anonymous reservation,
  and ten mappings of `anon_inode:[io_uring]`. The current snapshot does not
  hash those system backing files. Ring mappings alone establish no I/O
  submission or outcome, and the earlier source-only fixture lacks this
  installed launcher path.
- Next action: bind observed system targets before execution and verify them
  afterward; include actual asynchronous operations in the read/write audit.
  Keep executable mappings, generated-memory transitions and observed I/O
  outcomes distinct in the evidence.
- Prevention: establish the installed process and runtime boundary before
  treating a restricted syscall trace as complete read/write coverage.

### Recheck branch-only API consumers after a dependency migration

- Activity: merge the Effect upgrade from PR #1060 into the qualification branch.
- Evidence: the merge succeeds, but the CLI stops at `Flag.boolean is not a function`
  before it can run quality checks. Six cache properties also still use the removed
  schema-to-FastCheck bridge.
- Correction: migrate branch-only constructors and properties to the installed
  Effect APIs, preserving scoped fixtures and property run counts.
- Prevention: include a CLI bootstrap and branch-only property test pass immediately
  after a breaking dependency merge; earlier proof cannot cover the new runtime.

### Portable references also apply to captured prompts

- Activity: attribute the hosted knowledge-reference gate after the base merge.
- Evidence: the branch census finds eight live external-mirror paths in the
  exploration capture and continuation prompt; the base tree has none.
- Correction: use canonical upstream URLs in both documents and explicitly mark
  the captured request as having normalized clone locations.
- Prevention: normalize workstation clone paths when publishing research captures,
  while preserving which upstream source each clone represented.

### Exercise command dispatch as well as qualification operations

- Activity: attribute PR #1068's hosted coverage regression.
- Evidence: direct service tests left new CLI handlers uncovered; the command file
  fell below its retained baseline and two new policy files had uncovered branches.
- Correction: inject the qualification layer at command-tree construction and test
  the real parser, request codecs, report output and rejection behavior. Add the
  missing unassessed, scope-expansion and cross-root policy cases.
- Result: focused command coverage exceeds all retained floors; both policy files
  have complete statement, branch, function and line coverage.
- Prevention: keep operational authority injectable and prove adapter behavior
  alongside the domain/service contract when adding commands.

### Include explicit root tasks in the executable census

- Activity: verify the qualification branch after merging PR #1060.
- Evidence: the cache-policy gate rejects an undeclared `//` workspace. Turbo's
  package query excludes the root, while its execution plan now includes root
  lint tasks introduced by the merged configuration.
- Correction: add the already-read root manifest as the explicit root workspace,
  retaining rejection of unknown workspaces and mismatched root commands. Review
  the 277 inherited task additions through the canonical baseline command.
- Result: the policy audit reports zero blocking findings, with the qualification
  ledger unchanged and identity/types lint reuse still disabled.
- Prevention: cover the root task namespace alongside package tasks when joining
  Turbo queries, manifests and execution plans.

### Preserve static command discovery when injecting a test service

- Activity: run the CLI package audit after adding dispatch coverage.
- Evidence: command discovery rejects a layer-valued factory argument with
  `command factory arguments are not bound string literals`; the remaining
  3457 tests pass.
- Correction: declare the command tree statically and provide the qualification
  layer around its dispatcher. The testing facade provides its explicit layer
  around the same tree, preserving real parser and handler coverage.
- Prevention: include the static command-surface parity test when changing how
  command trees are constructed, even when runtime dispatch tests already pass.

### Attribute locationless compiler failures before changing source

- Activity: prove the scanner-policy prerequisite after the Effect upgrade.
- Evidence: separate aggregate coverage builds report locationless `TS2589`
  failures in unchanged UI and Box packages. Each package's isolated build exits
  zero without source edits.
- Correction: retain the failed aggregate receipts and rerun complete verification
  after each successful isolation. An isolated build alone is not full proof.
- Prevention: preserve package and compiler-phase context in aggregate diagnostics
  so a reproducible source error can be distinguished from an intermittent build.

### Match the hosted coverage runtime before investigating a property failure

- Activity: run local full coverage after the Effect upgrade.
- Evidence: the ACP JSON round-trip property fails at its pinned coverage seed
  under Node 24. Native `JSON.parse` changes an escaped NUL property key into a
  backslash. The same property passes under Node 22.22.3.
- Attribution: the hosted coverage matrix already pins Node 22.22.3 and documents
  this exact Node 24/26 defect. The local process had selected Node 24 instead.
- Correction: preserve the schema and assertion, remove temporary diagnostics,
  and run local proof with the existing hosted coverage runtime. Raising the
  property run count changes generated sizes and is not the exact reproduction.
- Prevention: inspect the live lane's runtime matrix and reproduce its seed,
  run count and worker settings before treating a local failure as a source bug.

### Measure package coverage before treating focused file coverage as sufficient

- Activity: prove the complete CLI change after the Effect migration.
- Evidence: all tests pass, but package coverage reports L/S/B/F
  80.69/80.44/70.66/75.84 against floors 81.84/81.59/72.09/76.26.
  Most uncovered additions are the experiment and pilot orchestration paths.
- Correction: exercise orchestration through controlled subprocess fixtures and
  verify rejection of inconsistent native observations. These tests are not
  qualification evidence and do not resume the paused campaign.
- Prevention: compare the whole package's coverage while adding executable
  orchestration, even when focused policy and command files meet their floors.

### Freeze source before collecting package proof

- Activity: run the CLI package audit while refining orchestration tests.
- Evidence: 3486 tests passed, but two CLI subprocess tests observed a temporary
  `Unterminated string literal` during an edit. That run is not package proof.
- Correction: finish the edit, confirm the focused tests, and rerun the full
  package audit on the settled source. Keep the failed receipt for attribution.
- Prevention: finish source edits before starting an audit that launches fresh
  CLI processes throughout its test phase.

### Serialize package audits and repository-wide source scans

- Activity: run full verification alongside the CLI package audit.
- Evidence: Knip observed an audit-owned `src/lint-worker-fixture-*/index.ts`
  while its test was active. The fixture disappeared when its scoped test ended.
- Correction: finish package verification before starting repository-wide scans;
  retain the failed run and do not change the unused-code baseline. The settled
  CLI audit and docgen both passed after source and base integration were frozen.
- Prevention: treat tests that create temporary source fixtures as checkout
  writers when scheduling overlapping verification commands.
- Follow-up: a custom coverage report directory under `.beep` also exposed its
  generated browser scripts to ESLint, producing six unused-disable warnings.
  Preserve custom HTML reports outside the checkout; the canonical coverage
  directory has dedicated exclusions, while arbitrary report paths may not.

### Refresh ignored goal projections after integrating packet changes

- Activity: merge main's paused goal packet and run the preliminary gates.
- Evidence: `goals:index-check` reported a stale ignored `goals/INDEX.md`.
- Correction: run `bun run beep goals index --write`, then its `--check` mode.
  Both use the existing manifests; no lifecycle status or tracked index changes.
- Prevention: regenerate local packet projections after integrating goal changes.

### Review task inputs after merging quality-policy changes

- Activity: merge main PR #1083 and run the complete Yeet verification command.
- Evidence: `quality:cache-policy` stopped on `//#lint:policy-fingerprint`;
  main added `standards/lint-policy.sweeps.jsonc` to its declared inputs.
- Correction: compare the executable census against the retained baseline,
  record the single inherited input addition, and use the canonical reviewed
  baseline writer. Keep qualification scope, states and cache flags unchanged.
- Prevention: inspect task-configuration deltas when merging policy changes
  before starting the full proof.

### Distinguish aggregate coverage from new-file identity gates

- Activity: verify the integration after adding complete orchestration tests.
- Evidence: aggregate CLI coverage rose above all retained percentage floors,
  but the ratchet still rejected eight new files with uncovered units and no
  recorded file identity. Every other local verification lane passed.
- Correction: review the initial measured per-file floors and use the scoped
  CLI coverage writer, preserving other packages and documenting the remaining
  census, service and dependency-path test debt.
- Prevention: inspect both package totals and per-file identity witnesses before
  treating an aggregate improvement as sufficient ratchet evidence.

### Verify scanner configuration with the pinned CI binary

- Activity: publish the integrated draft after the bounded evidence policy landed.
- Evidence: hosted Secret Scanning reported the same 21 historical false positives
  while local scanning passed. The hosted image was Gitleaks 8.24.3; the local
  package was 8.30.1. Global `[[allowlists]]` and `targetRules` require 8.25.0.
- Correction: pin the verified 8.30.1 container digest in CI. The exact image
  scans the 36-commit PR history with zero findings and retains all six fixture
  negative controls. Keep the base-branch config and ignore-file enforcement.
- Prevention: run policy fixtures with the actual hosted scanner image; a local
  binary pass does not establish configuration compatibility in CI.

### Compare generated JSON with its schema equivalence

- Activity: run hosted Property Laws after migrating the entrypoint property.
- Evidence: the 400-run CI floor generated negative zero; JSON encoded it as
  zero, and strict object equality rejected the valid round trip. The local
  20-run sample had not exposed this case.
- Correction: use the JSON schema's equivalence without restricting generated
  values, and add a deterministic direct and nested negative-zero regression.
  Validate the repaired attachment property with 1,000 generated cases.
- Prevention: choose equality semantics that match the serialization contract
  and retain explicit regressions for edge cases found by larger CI samples.

### Review inherited task expansion before repeating full verification

- Activity: integrate main PR #1082 while closing the draft PR.
- Evidence: cache policy reports 141 new executable lint tasks and two changed
  root command digests. Package checking initially resolves the pre-merge
  `repo-utils` declarations and cannot find `packageSyntax`.
- Correction: rebuild the changed dependency, confirm package lint and check,
  and review the inherited census delta before using the baseline writer.
- Prevention: inspect executable-task and dependency-output changes after a
  merge before starting another full proof. An interrupted prior-head run is
  retained as partial evidence, never treated as a pass for the new merge.

## 2026-09-11: resumption state and command discovery

- Resuming after the merged save PR required replacing stale worktree and
  dependency-receipt references before native experiments. Retain explicit
  source revision and refresh commands in future checkpoint handoffs.
- `goals set-status ... active` updates lifecycle but preserves the old pause
  status note. Updated that note explicitly with operator resumption and the
  remaining gates. A transition warning for contradictory notes would help.
- `cache audit --output ...` was rejected because audit supports `--json`.
  The corrected command redirected JSON to a private evidence file and passed.
  Consistent report-output flags across Cache commands would prevent this
  invocation error.

## 2026-09-11: receipt linkage compatibility

The pilot calculated its runtime digest with the requested Turbo client
linkage but omitted that snapshot from the receipt. This prevented independent
reconstruction when the client differed from the reviewed installation. The
receipt now retains the existing linkage schema; older receipts decode with
explicit absence. Tests cover a dynamic client replacing a reviewed static
client and both new and historical wire formats.

The first compatibility test used `Record.omit`, which is absent from the
pinned Effect API. The focused test failed with `omit is not a function`.
Checked the local Effect reference and replaced it with `Struct.omit`; all
14 process-boundary tests then passed. Consult the pinned helper module before
using a remembered API.

The aggregate `quality test-tsgo` wrapper suppressed the child command error
for an unsupported `--strict` argument. Replaying the same Turbo task with
error logs exposed the invocation mistake. The canonical command then found
three introduced `preferTypedSchemaDecoder` diagnostics in the new tests;
replaced `decodeUnknownEffect` with `decodeEffect` for schema-typed encoded
inputs. Preserve the child diagnostic when the wrapper fails.

## 2026-09-11: verification invalidates installed-tree previews

Both native pilot launches rejected the previous activation preview as stale
after package verification. Comparing the old and refreshed previews isolated
the change to installed dependencies. Comparing the materialized trees without
dereferencing workspace links found one changed file under
`node_modules/.vite/vitest/*/results.json`. The dependency fingerprint includes
that generated test cache, so verification conservatively invalidates a pilot
preview even when native binaries and computation configuration are unchanged.
Refreshed both the activation preview and verified dependency materialization
before relaunching; retained the rejected-run logs. A reviewed separation of
installed executable content from generated cache metadata could prevent these
false misses, but requires its own completeness evidence.

### Runtime guard compiler feedback (2026-09-11)

- Work: share the existing Turbo command classifier with Cache-owned runtime validation.
- Evidence: package verification and `beep quality test-tsgo` rejected the initial
  export with `TS377101` (missing pipeable signature). The audit opened inbox
  `local-shard-a38410bd316e`.
- Repair: preserve command recognition and expose its two-argument form through
  `dual`, including the pipeable overload. Commit `1ffb0878f6` contains the repair;
  the inbox row is acknowledged against that commit.
- Prevention: copy the adjacent `turboEnvExtendsAmbient` overload pattern when
  exposing an existing two-argument environment helper.

### Native selection mode collisions (2026-09-11)

- Work: prepare the runtime task selector against the pinned native Turbo client.
- Evidence: the isolated selection probe found duplicate `--cache` and `--dry-run`
  arguments rejected, while `--graph --dry=json` exited zero with graph output.
- Prevention: preserve the task argument separator, normalize execution options,
  and require a decoded native plan rather than interpreting success as an empty
  selection. Cases and evidence hashes are in `runtime-enforcement-boundary.json`.

### Runtime selector map and provider corrections (2026-09-11)

- Work: implement native task selection using existing workspace discovery.
- Evidence: focused tests passed, but test typechecking reported `TS2339` because
  workspace names are map keys, not fields on `WorkspacePackage`. It also reported
  the nested pipeable opportunity. The private native harness initially lacked
  the filesystem service required to construct `FsUtilsLive`.
- Repair: derive names from map entries with `pipe`; provide Node services to the
  harness layer construction. The corrected collector observes identity plus its
  types dependency and types-only selection without requiring a toolchain profile.
- Prevention: retain the discovery map key and satisfy layer dependencies before
  testing a collector against the actual native client.

### Wrapper recognition and environment hygiene (2026-09-11)

- Work: prepare a Cache-owned child under the existing secret-session wrapper.
- Evidence: synthetic inputs to the current environment helpers showed the original
  Turbo command disables ambient extension and drops an unrelated reference; the
  proposed rewritten command is unrecognized and would restore that reference.
- Prevention: resolve hygiene using the original step, then rewrite executable
  arguments. Preserve the resulting environment and extension policy explicitly.
  No secret operation was performed; the probe used a fabricated reference.

### Runtime command integration feedback (2026-09-11)

- Work: add the Cache-owned execution command and final-spawn tests.
- Evidence: typechecking reported `readonly unknown[]` for variadic CLI arguments;
  Vitest rejected imports under the explicitly private `./internal/*` boundary.
  The dispatch test also detected a changed command-list prefix.
- Repair: decode arguments through `S.Array(S.String)`, expose module namespaces
  through the existing source-only Cache test kit, and append the new command to
  the command list. Thirty-two focused tests now pass, including calculated-key
  injection, native-client drift rejection, and exit-code preservation.
- Prevention: follow the actual CLI argument type and package export boundary
  before building command handlers and process-level tests.

- Follow-up: the hash-file spy inferred the curried overload and rejected a raw
  `Effect` mock return during typechecking. Preserve the dual call contract in
  mocks with `dual(2, ...)`; runtime assertions had passed before this typing fix.

- The mock correction initially omitted its `dual` import; both the focused test
  and test typecheck caught it. The import is fixed and all six runtime tests
  pass on the corrected file. Wait for stable focused/type results before starting
  another full audit to avoid proving an intermediate test revision.

### Runner rewrite test isolation (2026-09-11)

- Work: wire the Cache child into ordinary Quality and direct CI execution.
- Evidence: the CI partition fixture shimmed `bunx` only. Rewriting execution to
  `bun` escaped the process double and ran real local lint tasks. The focused test
  command was intentionally terminated (exit 143); this is not a passed test run.
- Repair: the fixture now intercepts both executables, and execution assertions
  expect the Cache child while retaining task selection and failure checks.
- Prevention: when changing the spawned executable, update executable-level test
  doubles before broad tests. A default process fixture should reject unexpected
  executables rather than falling through to the workstation toolchain.

### Bun startup environment reload (2026-09-11)

- Work: place Cache execution inside the resolved secret-session environment.
- Evidence: Bun supports `--no-env-file`; a real fixture showed the routed child
  executes with that flag, while omitting it reloads the fixture runtime-key value
  and is rejected before task execution.
- Prevention: invoke the checkout CLI directly with `--no-env-file`. A repository
  script would introduce another Bun process with its own environment-file loading.

### Execution ownership moved beyond the census glob (2026-09-11)

- Work: review discovery coverage after routing execution through Cache.
- Evidence: the refreshed census has 107 entrypoint sources and omits four checked
  Cache execution modules. Its source glob still covers only CI, Quality and Yeet.
- Prevention: update execution-source discovery whenever a new module becomes an
  execution authority, and require a regression check for the new source path.
  File presence alone is not completed semantic review.

### Full routing verification repairs (2026-09-11)

- Work: verify the integrated runtime routing across the whole CLI package.
- Evidence: the audit passed 3,756 tests and failed two lint-worker assertions for
  the old Turbo command shape. Docgen rejected the `QualityTaskStep` example import
  from the Quality public facade. Both failures opened P0 inbox rows.
- Repair: assert the Cache execution prefix while preserving task selectors and
  environment expectations; import the step model from the existing source-only
  Quality test kit in the example. Docgen now passes all 1,666 examples.
- Focused-run attribution: root-CWD execution of lint-worker tests exposed existing
  package-CWD expectations. Run this file from the same package directory as the
  full audit rather than rewriting unrelated expectations.
- Prevention: include all execution-shape assertion files in the targeted routing
  suite, and use an actually exported path in documentation examples.

### Toolchain digest naming in public summaries (2026-09-11)

- Work: commit the verified runtime enforcement increment and P0 repairs.
- Evidence: the secret-scanning hook classified four `runtimeKeyDigest` fields in
  the public preflight summary as generic API keys. They are reconstructed SHA-256
  toolchain digests, not credentials; private native receipts retain their schema.
- Repair: name the public summary fields `toolchainSha256`, preserving all digest
  bytes and avoiding ambiguous key terminology. No scanner rule is suppressed.

### Interrupted final-code native matrix (2026-09-12)

- Work: refresh the stable pilot against the committed runtime-routing code.
- Evidence: the original session handle disappeared; its retained log reports
  `All fibers interrupted without error` and exit 130. No pilot receipt exists.
  The cause of interruption is unestablished, so this is not a semantic failure
  or a passing matrix.
- Response: preserve the log hash and interruption receipt, then start a new
  attempt with a distinct namespace and the same independently validated inputs.
  The runner revalidates activation, dependencies and worktrees before execution.
- Prevention: retain terminal status independently of the interactive polling
  session so an interrupted observer cannot obscure a completed experiment.

### Native merged task streams vary in order (2026-09-12)

- Work: validate grouped native capture with progress-looking stdout and task
  stderr on pinned stable and canary clients.
- Evidence: fresh/replay pairs matched, but ten fresh runs per client yielded
  three merged log orders despite identical sequential producer writes.
  The private `native-stream-order.json` retains all twenty payloads and hashes.
- Disposition: the mixed-stream synthetic fixture cannot qualify under exact
  merged-log equivalence. No live tuple was enabled; do not infer that the real
  lint task has the same behavior or normalize away the observed differences.
- Prevention: require repeated fresh/fresh stream observations before accepting
  replay fidelity as evidence of deterministic captured output.

### Installed I/O trace exceeded mapping-only budget (2026-09-12)

- Work: expand the existing executable-mapping observer to installed lint I/O.
- Evidence: the trace reached exactly 8,388,608 bytes and the observer rejected
  it. The partial trace includes 15,333 directory-enumeration calls; it is not
  a complete I/O record and grants no passing evidence.
- Repair: retain the failed attempt, render directory-entry buffers in compact
  raw form and use a bounded 32 MiB trace limit for the expanded observation.
  Source/dependency isolation and the command timeout remain in force.
- Prevention: size full file-I/O observations separately from executable-only
  traces, and reject truncation before interpreting their results.

The 32 MiB retry also reached its limit. Its partial trace includes successful
directory and metadata operations across the installed dependency tree and
other repository paths; the observation cannot be narrowed to identity files
without losing actual behavior. A third attempt compresses the unchanged
syscall selection while writing, caps the compressed file at 32 MiB and limits
expanded trace reads to 256 MiB. Both partial attempts remain non-passing.


The compressed attempt completed the traced command, but its expanded trace
was 275,653,259 bytes, exceeding the 256 MiB parser budget. A bounded streaming
diagnostic reached gzip EOF and retained the expanded digest and terminal exit
records; it does not restore the missing wrapper postchecks or grant acceptance.
The trace includes broad installed-tree traversal and io_uring calls, so syscall
counts alone cannot establish the task input closure. Retain this rejected run
and use a 384 MiB expanded bound for the next admitted observation; keep the
32 MiB compressed bound and 90-second command timeout unchanged. The new bound
is based on measured complete output, not an unbounded retry.


### Loose-mode environment is outside the runtime digest (2026-09-12)

- Work: classify installed launcher environment inputs after I/O collection.
- Evidence: eight native controls on stable and canary; changing two ambient
  launcher variables changed task-observed values in loose mode without changing
  the task hash within that mode. Cache reads and writes were disabled.
- Disposition: require explicit environment-mode review and enforcement before
  promotion. The synthetic result does not establish a live enabled-tuple defect.
- Prevention: include ambient environment-mode controls beside runtime binary
  perturbations, and distinguish package-manager-generated values from inherited
  values when interpreting child environments.


- During current-head canary pilot admission, `bun run beep cache pilot` ended
  with exit 137 and `SIGKILL` before producing a receipt. The last phase was
  admission waiting; bounded kernel/user journal queries returned no cause.
  A scheduler/process termination receipt identifying signal origin would
  prevent ambiguous experiment attribution. The interrupted log is bound in
  `runtime-enforcement-boundary.json`; do not count it as a pilot verdict.


- Resume canary attempt three rejected a stale activation preview. The next
  preview observed an installed tree 1,059 bytes smaller; subsequent complete
  dependency materialization matched the original tree digest. This transient
  dependency drift has no attributed writer. Immutable dependency evidence
  should be used consistently across activation and execution; do not weaken
  the current stale-preview check. Private evidence is bound in
  `runtime-enforcement-boundary.json` under `resumedDependencyDrift`.


- A resumed stable receipt filename already contained an older source revision.
  Independent activation-digest validation rejected it while the new process
  was still live. Preserved the older receipt under a revision-specific private
  name; its original activation bytes were not found in the bounded filename
  search. Future attempts should allocate a fresh directory and refuse existing
  output names before launch. File existence alone never establishes completion.


## Preserve existing report names during census refresh

While adding the hosted workflow projection, `git diff` revealed that the new
review had replaced the existing `research/workflow-boundaries.md` report.
The historical bytes were restored and the new report moved to
`research/hosted-workflow-boundaries.md`; evidence references were updated.
Checking tracked-path existence before creating an artifact would have avoided
this collision and preserved the broader historical review automatically.


## Resumed branch quality attribution

`beep yeet verify --tier cheap-gates` failed at `9480eaf486` on
`lint:effect-vitest`, `fallow:audit` and `fallow:health`. The two Fallow lanes
identified the same three introduced complexity findings in cache selection
and tests. Refactoring cleared the audit findings, and both focused cache
suites passed 23 tests. CLI package audit and docgen then passed before merging main.
A fresh fetch found 46 commits on main beyond this branch base, including
Effect Vitest baseline changes. Integrate the current base before treating
the 110 remaining local membership findings as final migration obligations;
never refresh the baseline merely to accept them. Earlier base-freshness
inspection would have exposed this overlap before broad verification.


## Main integration: routing fixtures and test conventions

Merging main at `1969de85bf` reduced the Effect Vitest ratchet to 21 new
findings in five test files. Canonical suite layers and assertions removed
the new migration findings; one immediate-lifetime partition fixture retains
a reasoned EV003 exception. Do not replace its per-invocation release with
suite teardown.

The first five-suite run passed 344 tests and failed eight. Newly merged
assertions and fake launchers still assumed direct Turbo execution; this
branch routes those steps through Cache. Updating the launcher boundary and
command expectations preserved ledger-digest, failure-aggregation and ordered
policy assertions. All 352 tests then passed. Integration fixtures that
project the governed runtime step would have prevented these stale launcher
assumptions. Final package verification and cheap gates remain separate
proof obligations.


The source planner recipe also failed after integration because main removed
`doctestStepForTesting`. The current Ci planner always runs the full doctest
fleet; the recipe now captures its public planner across the existing option
variants. Versioned recipes must be exercised after base merges before their
old snapshots are rebound to new sources.


## Exact native client preflight

A manual canary `--version` probe reported the workspace's stable version even
though the canary file digest matched. Repeating with `--skip-infer --version`
reported the pinned `2.10.13-canary.1`. Preflight probes must use the runner's
existing native skip-infer posture; otherwise workspace inference can be
misreported as executable drift. No binary or expected pin was changed.


The post-main canary admission reported an undecodable lease and automatically
quarantined it before runtime checks passed. The diagnostic came from
`beep cache pilot`; no pilot failure is inferred from it. Atomic, validated
admission-state writes would prevent this recovery path. The lease writer and
cause have not been attributed, and other tasks' admission state was not edited.


### Repeated admission-state quarantine during input controls (2026-09-15)

The admitted external-input wrapper again reported `quarantined malformed
admission state` with reason `undecodable`. Admission continued and the five
controls plus before/after verification passed. The private wrapper log is
referenced by `postMainExternalInputControls`; no lease identity or raw runtime
path is copied here. The writer and cause remain unattributed. A schema-valid
atomic lease publication contract would prevent this class of recovery;
inspect the owning admission lane before proposing a repair.


### Native dry selection needs an explicit root (2026-09-15)

The isolated dependency control ran the pinned Turbo binary with `--skip-infer`
from the identity package. It rejected the child configuration with
`Found an unknown key extends`, because the package was treated as the root.
The command exited before producing comparison evidence. The retry specifies
`--cwd=/fixture`; preserve the original failed run as harness evidence.
Explicit root selection in every inference-disabled probe prevents this error.


### Git local exclusions escape the observed task identity (2026-09-15)

A bounded paired control changed only Git `info/exclude`, keeping an invalid
identity source identical. Lint changed from exit one to zero; stable native
identity/types task hashes and input maps remained identical. The admitted
wrapper and independent retained-byte review passed. See
`postMainGitExcludeCounterexample` in the runtime boundary receipt.
Treat local Git exclusion state as a semantic input or enforce a controlled
exclusion boundary. Existing disabled/excluded pilot policy prevents activation;
the runtime contract needs repair before qualification.


### Native Git regression needs explicit platform provenance (2026-09-15)

The new exclusion regression introduced EV010 for its `NodeServices` import.
The test uses a real Git clone and linked worktree to exercise common-directory
resolution, then checks native symlink and bounded-read behavior. A virtual
filesystem would not be visible to Git. One reviewed inventory exception names
those services and the scoped cleanup; the fleet baseline was not regenerated.
The initial test also exposed a directory-cleanup mistake (`EISDIR`), repaired
with recursive removal of the fixture-owned directory before the passing run.


### Source-only pilot worktrees cannot run the post-merge hook (2026-09-15)

Fast-forwarding both clean pilot worktrees to `0dca998780` succeeded, but their
post-merge version check reported `Cannot find module @beep/utils`. These
fixtures intentionally have no local install; the pilot supplies a verified
read-only dependency overlay. The main checkout version check passed. Keep
fixture post-merge diagnostics separate from source fast-forward success, and
run fixture tools inside their declared dependency boundary. No dependency
installation or hook bypass was introduced.

### Qualification refresh: packet doctor invocation

- Work: validate the refreshed stable/canary checkpoint.
- Evidence: `beep goals doctor turborepo-task-qualification` rejected the packet
  argument as unexpected; the command accepts flags only. Retried the canonical
  `bun run beep goals doctor` without changing its baseline.
- Prevention: retain the exact doctor invocation in the qualification handoff.

### Qualification probe: scheduler status hint

- Work: inspect admission after the targeted native probes waited ten minutes.
- Evidence: the scheduler suggested `bun run beep quality scheduler status`,
  which failed with `Missing required flag: --json`. Adding `--json` succeeded
  and reported eight active tokens against eight capacity tokens, with no dead
  leases. The experiments remained queued; no reap or bypass was warranted.
- Prevention: include the required flag in the admission wait hint, or make
  plain-text status the default.

### Compiler inventory: census workspace field

- Work: resolve compiler configuration paths from the retained census.
- Evidence: initial extraction assumed `path` and failed with `KeyError`;
  the census workspace field is `directory`. Corrected the recipe before output.
- Prevention: inspect the retained schema keys before joining a new inventory.

### Census attachment comparison shape

While attaching the completed tool reviews, a direct request/result equality
assertion failed because accepted planner artifacts add a decoded `document`.
The source and review references matched; comparing each artifact's `format`
and `reference` proved attachment identity. A documented projection for this
comparison would prevent mistaking result enrichment for evidence drift.

### Exact-client version probe must disable inference

During the synthetic refresh, hashing the retained canary binary succeeded but
its plain `--version` invocation from the installed workspace selected stable.
The same binary with `--skip-infer --version` returned the pinned canary.
Direct-client preflight should always disable inference; a workspace-inferred
version is not evidence that the retained executable bytes changed.

### Scheduler status command routing

During the synthetic refresh wait, `beep scheduler status --json` was rejected
with `Unknown subcommand "scheduler"`. The documented read-only route is
`beep quality scheduler status --json`; that command succeeded. Status probes
should use the full command path before attempting to decode JSON output.

### Admission state quarantine during Git configuration probe (2026-09-21)

The existing admitted probe wrapper reported `quarantined malformed admission
state` with reason `undecodable`. The scheduler handled the record itself; no
manual reaping or bypass was used. The probe handle remained live after the
message. A versioned state migration or a diagnostic naming the incompatible
schema field would make this attributable without inspecting raw shared state.

### Toolchain drift prevents the next pilot control (2026-09-21)

The admitted Git configuration probe exited one before execution with
`Git-config observation runtime differs from its preview.` The retained
activation remains historical evidence. A diagnostic collection now retains
the current toolchain snapshot privately for a field-level comparison. The
identity gate was preserved; no lint or native-selection result is claimed.
An explicit compact toolchain-difference diagnostic at this gate would avoid
a second collection solely to attribute the mismatch.

### Encoded and decoded snapshot comparison (2026-09-21)

The initial toolchain diagnostic compared encoded receipt JSON with a direct
JSON serialization of a decoded schema value. An Effect `Option` wrapper
made unchanged installed dependencies appear different. Comparing the values
confirmed identical archive digest, counts and links; only kernel and runtime
linker fields differ. Serialize diagnostic snapshots through the schema encoder
before comparing them to durable receipts. The drift receipt is corrected.

### Read-only Git mount rejected a synthetic file (2026-09-21)

The Git configuration control failed with `bwrap: Can't create file` and
`Read-only file system` when mounting a new synthetic exclusion file inside
the read-only Git directory. The unchanged baseline ran, but the changed case
did not start. The corrected fixture mounts the file in its existing writable
setup directory and points `core.excludesFile` there. This is a fixture error,
not evidence about lint or cache behavior. Check new bind destinations against
the parent mount mode before launching the admitted comparison.

### Split syscalls omitted by the first read reconstruction (2026-09-21)

The first descriptor reconstruction matched only complete syscall lines and
omitted unfinished/resumed pairs. That produced a misleadingly small read
footprint. Joining 1,038,987 pairs with no unmatched or pending pairs changed
the attributed other-repository count from 30 to 8,364 paths. The public report
and worksheet are corrected. Raw-trace analysis must account for every split
call before interpreting path counts; retain parser coverage counts alongside
observations. Descriptor races and indirect I/O remain separate limitations.

### Raw read formatting obscured descriptor attribution (2026-09-21)

The historical trace used raw read formatting to avoid capturing buffer
contents, which also removed descriptor path annotations. Reconstructing
shared descriptors left timing ambiguities. A bounded synthetic format control
with the pinned tracer confirmed that `-yy -s 0` retains read path annotations
while omitting synthetic buffer contents. A fresh admitted trace uses that
format for scalar reads; vectored reads and writes retain raw formatting.
Validate trace formatting with a synthetic buffer before collecting workload
evidence, and preserve the limits for indirect I/O and concurrent execution.

### Package-local Biome project rebased plugin paths (2026-09-21)

A private package-local root config extended the repository config but baseline
lint failed with `Error(s) during loading of plugins` and `Cannot read file`.
No semantic-control result is accepted from that candidate. Keep inherited
relative plugin paths in their original configuration directory, or prove
that a relocation preserves every effective rule and override before using it.
The next isolated profile resides beside the root config and selects its file
explicitly; repository configuration remains unchanged.

## 2026-09-21 — Scanner candidate omitted root exclusions

While preparing profile generation, inspection of `biome.jsonc` and the private
`scoped-scanner-biome.json` found that replacing `files.includes` with two
package selectors discarded every root negation, including `!**/*.gen.*`.
The existing ignored-source control used a package `.gitignore`, so its passing
result did not cover root-config exclusions. No candidate has been adopted.
A preserved-exclusion candidate and original/flat/preserved generated-source
comparison are now under the admitted probe. Generate from the complete root
configuration, retain exclusion order, and reject unsupported positive-selector
shapes rather than silently broadening or narrowing them. Require both config
exclusion and VCS-ignore controls before acceptance.

The admitted comparison completed: original root exclusion exit 0, earlier flat
profile exit 1, preserved exclusions exit 0 for identical invalid generated
source. Nine independent trace/stream reviews passed. The replacement candidate
retains the tested behavior and reduces the observed read set to 396 paths;
see `preserved-profile-scanner-review.json`. This is candidate evidence, not
production adoption or complete input closure.

## 2026-09-21 — Explicit metadata globs included installed dependencies

The pinned native dry plan expanded broad root metadata patterns to 4,912
node_modules paths, producing 5,666 identity inputs. Expected ignore behavior
was insufficient once explicit input patterns were supplied. A bounded revised
plan adds an explicit node_modules exclusion and must retain observed repository
coverage. Independent hash review also found 40 entries with CRLF-normalized
Git blob identities; raw-byte coverage belongs to the retained dependency tree
receipt. Verify actual native expansion and distinguish normalized task hashes
from raw dependency digests before adopting input patterns. Evidence:
`profile-native-inputs-review.json`.

## 2026-09-21 — Profile implementation compile checks caught two local mistakes

The first focused format/test pass failed because a glob in a JSDoc code
example contained the comment terminator. Replacing the example with a simple
exclusion fixed parsing. The next pass found `Flag.boolean` unavailable in the
pinned Effect CLI; source inspection confirmed `Flag.Boolean`. Both failures
were introduced by this change and repaired before the four focused tests
passed. Check the local CLI constructor spelling and avoid comment terminators
inside documentation examples before running dependent verification.

## 2026-09-21 — Package audit cheap-gate assertions differ from isolated runs

The profile package verification completed with docgen passing and audit
failing: 4,023 tests passed, three cheap-gate runner assertions failed in
`quality-tasks.test.ts`. The same three cases pass alone; all 242 tests in that
file pass separately; the three also pass with `CI=true`. These narrower passes
do not waive the full audit failure. An admitted focused comparison is queued
to test execution-context influence. Keep the P0 open until attribution and
repair are supported by evidence. See `profile-generation-implementation.json`.

The failure was reproduced with the root-loaded environment: `TURBO_CACHE` is
present when launching from the repo root and absent in the package-only
launch. Diagnostic assertions showed every missing lane matched after the
existing `policyCommandKey` normalization. The cheap-gate fixture compared raw
commands and also selected injected failures by raw command equality. Reusing
the existing normalization for both restores the intended lane/failure checks;
the three cases now pass under the reproducing root environment. Full-file and
package verification remain required. No cache-policy assertion was removed.

### Runtime profile integration: nested collection inference

While adding task-scoped profile environment checks, `beep:check` reported
`TS18046: 'node' is of type 'unknown'` in `Cache.census.ts`. The nested
`A.flatMap(A.filter(...), ...)` expression lost inference. One direct
`A.flatMap(nodes, ...)` expresses the same selection and avoids the nested
inference boundary. Keep typechecking alongside behavior tests: the focused
runtime cases passed before this compile error was detected.

### Generated profile formatting contract

The first live `biome.identity.jsonc` failed `biome check` formatting because
its deterministic generator emits compact JSON. A generator-owned JSONC
`biome-ignore format` comment preserves that byte contract without weakening
lint rules or freshness checks. Native file checking confirmed the marker is
accepted. Include generated-file formatting in future generator acceptance,
not only structural JSON equality and consumer behavior.

### Live Biome relative profile selection

The native Turbo runtime fixture verified environment isolation, but its child
only reported the selected value. The first actual identity lint run with the
relative profile path failed before linting: `Biome couldn't find an ignore
file` at the identity package directory. Identity's ordinary package audit
passed. Keep caching disabled and attribute relative versus absolute config
resolution using the real Biome consumer before accepting this profile path.
Future selection controls must execute the actual tool as well as assert the
child environment; environment delivery alone did not cover VCS resolution.

### Post-main complexity gate — 2026-09-21

The checkpoint `beep yeet repair` reported four introduced Fallow complexity
findings in runtime identity observation, native profile scope validation,
pilot environment observation, and fixture source setup. Extracted those
existing responsibilities without changing their guards. A focused Fallow
audit now reports zero introduced findings; all 33 focused cache tests and
CLI typechecking pass on Effect rc.117. Running the exact changed-file audit
earlier would have surfaced these before the full repair lane. Full proof
and hosted checks remain separate obligations.

### Location-free compiler diagnostics during RC checkpoint

The post-merge repair build reported `TS2589` without a source location in
`@beep/box`, `@beep/ui`, and `@beep/xai`; their sources are unchanged against
`origin/main`. The same repair later rebuilt box and xai successfully as
dependencies, while the repository typecheck passed 244 tasks. Preserve the
failed lane result until a fresh full proof passes. A source location and
compiler-context receipt would make this failure easier to attribute.

### Merge integration lost runtime-aware test fixtures

The main merge retained the newer Effect test harness in `quality-tasks.test.ts`
but dropped the branch's cache-runtime-aware launcher fixtures. Six tests failed
because their stand-ins still expected direct `bunx turbo` commands. Restored
runtime step projection for command comparisons and updated the launcher and
failure fixtures while retaining main's test harness. The focused file now
passes all 249 tests. Semantic conflict review must cover executable test
fixtures even when the production implementation merges cleanly.

### Checkpoint summary digest naming

The commit secret scan classified twelve `runtimeKeyDigest` summary fields as
generic API keys. They are SHA-256 toolchain identities from retained pilot
receipts, not credentials. Used the existing public-summary name
`toolchainSha256` while preserving every digest byte and all private receipt
references. No scanner rule or raw receipt was changed.

### Fresh JSDoc inventory exposed checkpoint regressions

The full publication proof regenerated the repository inventory and found five
new root-package imports in examples and five Details sections after Examples.
The cheap check against the committed inventory and package docgen had passed;
neither was a fresh repository totals comparison. Moved Details before Examples
and used stable Effect module imports. Keep the fresh inventory ratchet in the
publication gate; package docgen success does not establish that ratchet.

Bounded docgen also found five noncanonical category names on the same cache
API; replaced them with canonical categories. The Effect import check is
`bun run lint:effect-imports`; `beep lint effect-imports` enters the generic
root-lint adapter instead. Use the generated root script for this check.

### 2026-09-22: shared checkout drift invalidated checkpoint proof

While the checkpoint publication proof was live, the clone switched from the
qualification branch to main. The reflog and live process working directory
confirmed the mismatch. Stopped the affected proof; its mixed-checkout output
is not exact-head evidence. Published draft PR #1182 before waiting for proof,
then moved the feature branch into a dedicated sibling worktree and merged main.
Keep long proofs in branch-owned worktrees to prevent this interference.

The fresh worktree initially lacked commitlint dependencies; frozen installation
allowed the pending merge commit to pass its hooks. Detached verification then
refused because the systemd user manager was unavailable. No detached proof
started. Use an attached proof with a retained log for this session.

### 2026-09-22: stronger pilot assertions crossed the Fallow complexity gate

PR #1182's Fallow audit attributed one new complexity finding to the pilot
fixture's `observeExecution` function after review fixes added real profile-byte
hashing. The full CLI package audit passed, but does not replace this repository
complexity gate. Retain mounted-byte hashing and move invocation-level profile
reads outside the execution observation. Run both Fallow audit and health after
test fixture changes that introduce branching, before queuing full proof.

The generated Fallow check scripts require a populated base-ref environment.
An unwrapped local invocation expanded an empty base and failed before analysis.
For focused local diagnosis use `beep quality fallow audit --base origin/main`
and the corresponding health command with explicit base, check and output flags.

### 2026-09-22: root policy checks found inline schema compilation

The full checkpoint proof reported six `beep(no-inline-schema-compile)` findings
in the cache execute command and pilot receipt round-trip tests. Package lint and
type checks had passed without exercising this root Oxlint policy. Hoisted the
compiled argument decoder and receipt codecs to module scope, preserving their
schemas and assertions. Run root Oxlint before queuing the next full proof.

Main advanced during proof and conflicted only in the generated Effect/Vitest
inventory. Stopped the superseded proof, merged main, regenerated the inventory
with `bun run beep lint effect-vitest --write`, and pushed the merge before
waiting for fresh proof. The prior run also reported a knowledge-reference
failure. On the merged revision, its four live gates were absolute temporary-path
literals in this packet's historical trace descriptions. Reworded them as
experiment temporary-root observations, retaining their meaning and evidence
limits without prescribing a host path.

### 2026-09-22: main's lint configuration invalidated the generated pilot profile

After merging main, PR #1182's hosted lint-a lane rejected the generated profile
as stale before native lint execution. Main added allowed environment names to
the root Biome policy. Regenerated `biome.identity.jsonc` with
`bun run beep cache profile --write`; the runtime freshness guard remains intact.
Include profile regeneration in main-sync checks whenever root lint policy moves,
before publishing and queuing full proof.

### 2026-09-22: heavy checks exposed test typing and command coverage gaps

PR #1182's heavy check reported `strictBooleanExpressions` on defaulted flags in
an Effect-wrapped fixture, a nested pipeable call, and a void/undefined mock
mismatch. Explicit schema-derived flag types, pipe syntax, and void-returning
profile operation signatures preserve behavior while satisfying both compiler
and lint contracts. Package check alone omitted these test diagnostics; run
`bun run beep quality test-tsgo` before the next publication.

Hosted coverage fell below the existing cache command and CI runner file floors.
Added profile/execute dispatch tests and a caller-identity rejection test, and
reused one environment default in CI dispatch instead of evaluating it twice.
Keep coverage floors unchanged; compare measured file coverage before full proof.

## 2026-09-22 — runtime and dry-plan evidence need separate commands

While refreshing the merged profile input map, `cache execute` rejected
`--dry=json` with “Runtime selection does not accept output modes or directory
overrides.” The direct native dry-run and governed actual execution both
passed separately. A documented paired recipe would prevent treating a
configuration plan as runtime-identity proof or repeatedly probing a rejected
output mode. Receipt: `profile-closure-refresh-2026-09-22.json`.

## 2026-09-22 — retirement does not retain ignored evidence

After PR #1189 merged, `bun run beep yeet sweep --retire` removed its worktree.
The residue archive contains a manifest and retained Git ref, but its manifest
has `patchPath: null` and an empty `untrackedFiles` list. The ignored `.beep`
proof logs, temporary addition/restoration plans and reviewer-validation outputs
were not preserved. The initial cleanup report overstated their retention.

The published packet and copied recovery handoff survive. A separate capture
worktree also retains the observer, reviewer, dependency receipt and native
plans. Thirteen static preparation files were subsequently copied outside the
worktrees, checked byte-for-byte, and inventoried with SHA-256 digests and a
seven-day retention record. That backup excludes the live observation log and
any future trace; those require their own verified copy after completion.

Before retiring another evidence-producing worktree, copy required ignored
artifacts to a private durable directory and verify the inventory. A Git residue
manifest alone is insufficient. Do not reconstruct missing files and label them
as original evidence. This is a qualification evidence-retention correction;
it does not change Yeet proof ownership or qualify the pilot.
