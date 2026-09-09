# Friction and opportunities

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
