# Identity lint computation worksheet

Observed 2026-09-09 UTC from the launched checkout. State: **excluded** after
the [successful-warning canary failure](./unsafe-lint-review.md).
This source inspection identifies the experiment obligations; it does not
prove purity, portability, log safety or a cache qualification.

## Current experiment boundary at `028262e8c0`

This checkpoint supersedes the initial worksheet values below. The operational
census and source references are bound by
[runtime-enforcement-boundary.json](./runtime-enforcement-boundary.json), under
`postMainCensus`, `postMainStablePilot` and `postMainCanaryPilot`.

- Actual chain: `lint` → `bun run beep:lint` →
  `biome check . > /dev/null 2>&1`. `beep:lint:verbose` retains diagnostics.
  The installed Biome launcher invokes Node, probes `ldd --version`, and runs
  the installed platform binary. Those runtime components participate in the
  observed toolchain identity.
- The current local profile is `local-linux-x64-bun1.4.2`, epoch
  `qualification-v2`. Stable 2.10.12 and canary 2.10.13-canary.1 remain separate.
- Identity has 46 expanded input paths, declares
  `BEEP_CACHE_TOOLCHAIN_DIGEST`, and has no task pass-through environment or
  declared output trees. Live `cache` remains false. Runtime selection rejects
  loose mode for governed executable caching.
- `@beep/types#lint` remains a predecessor with 28 expanded inputs, no declared
  task environment and `cache: false`. Its `beep:lint` is still verbose.
  The pilot observes that prerequisite separately; identity's quiet capture
  does not establish safety of arbitrary dependency logs.
- The isolated experiment supplies read-only source/dependency overlays,
  a private disposable temporary tree and no external network. It compares
  exit status and exact accepted task-log bytes; it grants no shared-host or
  hosted-runner portability.
- Temporary-state controls (absent directory, empty directory, sentinel file)
  and overlapping pairs produced equal results. Creation of an empty
  `/tmp/biome` directory is recorded, but is not a retained output in this
  disposable boundary. Persistent shared temporary storage is unsupported.
- The current I/O trace is source-correlated with pinned Node's event-watcher
  batching; queued submission contents were not directly decoded. It is not
  a complete semantic input proof.

The prior stable/canary local matrices at `d1d1d32378` are historical. Both
channels completed at `028262e8c0`, each with 67 observations, 40 passing checks
and ten shadows. Signed remote pairs, accepted sibling receipts and promotion
remain outstanding; the real tuple stays excluded.

The joined current trace records 8,457 distinct other-repository paths opened
without `O_DIRECTORY`, alongside 4,358 distinct other-repository directory
paths. These categories exclude installed dependencies and the identity
subtree. An open without that flag does not itself prove a regular-file read
or semantic relevance. This footprint requires targeted out-of-input
perturbations; it cannot be dismissed from the small expanded Turbo input map.
The bounded reconstruction, counts and private trace references are retained
under `postMainIoObservation.openFootprint` in the runtime boundary receipt.

Five fresh controls then tested the same isolated installed command. Replacing
`apps/labs/api-docs/src/Api.ts`, its `tsconfig.json`, or its `package.json`
independently with invalid syntax left identity lint successful with identical
stdout/stderr hashes. An invalid identity `src/index.ts` failed, establishing
a working positive control. All ten retained stream hashes were independently
checked; the admission wrapper verified dependency/toolchain parity before
and after. These three external mutations establish bounded noninterference,
not universal irrelevance or native Turbo hash equivalence. The receipt is
`postMainExternalInputControls` in the runtime boundary record.


A targeted workspace-dependency control established a semantic input beyond
the identity subtree: adding `@deprecated` to the types package's `TString`
export changed identity lint from exit zero to exit one. Pinned stable Turbo
changed both task hashes while identity's own input map stayed identical;
`src/index.ts` was the only changed input in the types map, and the declared
`@beep/types#lint` dependency edge was present. Two retained native summaries
and four stream hashes passed independent review. The admitted wrapper passed
dependency/toolchain parity before and after. This demonstrates dependency
invalidation for one semantic case, not replay or complete input closure.
Exact canary 2.10.13-canary.1 independently reproduced the same result,
including exit zero to one, unchanged identity inputs and both changed hashes.
Versioned review confirmed strict mode and the exact client version in all four
retained stable/canary summaries, plus eight stream hashes. Both admitted
wrappers completed with before/after parity. See
`postMainWorkspaceDependencyControl` and
`postMainCanaryWorkspaceDependencyControl` in the runtime boundary record.



The Git local-exclusion control found a semantic identity mismatch at
`028262e8c0`: the same invalid identity source returned exit one when visible
and zero when added to Git `info/exclude`. Stable 2.10.12 in strict mode kept
both identity and types input maps and task hashes unchanged. Independent
review verified identical source bytes, two native summaries, four stream
hashes and the exclusion overlay. The admitted wrapper passed before/after
dependency/toolchain verification. This is a direct-execution counterexample,
not a replay claim. Pilot reuse remains disabled and the tuple excluded.
The repair at `0dca998780` binds bounded Git common-directory `info/exclude`
bytes into the runtime source identity. Focused native tests and full CLI
package verification passed. Refreshed stable 2.10.12 and canary
2.10.13-canary.1 pilots each passed 40 checks over 67 observations and ten
shadow comparisons. Separate receipt reconstruction verifies the recorded
runtime identity, including sensitivity to the exclusion digest. The targeted stable and canary native comparisons also passed: changing only exclusions
changes the lint result and now changes identity's task hash, with identical
source bytes and own input maps. Independent review checked two summaries and
four streams per client; before/after dependency and toolchain checks passed. Other Git configuration, concurrent mutation
and signed remote qualification remain outside this evidence.
See `postMainGitExcludeCounterexample` and `gitExclusionRepair` in the runtime
boundary record.

## Historical initial command and profile

- Computation: `@beep/identity#lint`.
- Initial script chain: `lint` → `bun run beep:lint` → `biome check .`.
  The verified capture repair now makes `lint` run
  `biome check . > /dev/null 2>&1`; detailed `beep:lint` remains unchanged.
- Effective Turbo predecessor: `@beep/types#lint`, also `biome check .` through
  its package wrapper. The pilot must retain this dependency observation or
  document an independently reviewed decomposition; it cannot silently count
  the whole graph as the identity computation.
- Proposed initial profile: `local-linux-x64-bun1.4.1`, with exact Turbo
  `2.10.12`, Bun `1.4.1`, Node `24.20.0` and Biome `2.5.6`. OS, libc and binary
  digests are now captured in [local preflight observations](./local-preflight-observations.json);
  this is a profile observation, not qualification.
- Canary `2.10.13-canary.1` is a separate isolated experiment, not production
  authority and not a source of substitute stable evidence.

## Inputs to inspect and perturb

The initial exact Turbo dry plan contains 40 expanded input paths for the
identity node. The current repaired/disabled configuration has 41, including
the new child Turbo file. These include identity sources/tests/manifests, `.bun-version`, `.nvmrc`,
root `package.json`, root `biome.jsonc`, three lint config files and four Grit
rule files. `bun.lock` also participates in Turbo's dependency hashing and must
be perturbed independently; absence from the expanded file map does not mean
it is absent from every Turbo hash component.

Root Biome configuration enables Git VCS integration and ignore-file use. It
loads `no-empty-named-blocks.grit` and `prefer-array-flat-map.grit`; other
plugin registrations depend on overrides. Root/child config discovery,
`.gitignore` behavior, untracked/ignored inputs, Grit rules and any generated
aliases require separate negative cases. Never infer a complete read set
from a dry plan alone.

The task has strict environment mode, empty task `env`, and no task-specific
pass-through list in the resolved definition. Root global environment and
pass-through policy still apply. The experiment must vary relevant environment
families, absent values, locale/timezone, runtime/manager versions and
orchestration-only admission/session inputs independently.

## Outputs, logs and external state

The effective declaration now has `cache: false` through the inheriting child
Turbo configuration. It has no output trees, `outputLogs: full`,
`persistent: false`, `interactive: false` and `interruptible: false`.
`biome check .` has no `--write` flag. These are declarations and command
observations; filesystem tracing and before/after snapshots must still verify
the actual writes and output/log behavior.

Biome diagnostics can include source excerpts and paths, and success messages
can include durations. Any normalization needs an explicit allowlist that
preserves diagnostic meaning and never hides divergence. Synthetic secret
canaries must cover both success and warning/error output before logs are
accepted as safe. Failed commands are a negative observation, not reusable
success. Network, time, randomness and platform dependencies remain unproven
until the isolated runner controls or observes them.

## Required remaining evidence

Current local matrices cover fresh/fresh pairs, ten shadow decisions per
channel, the implemented input perturbations, output/log equivalence and
supported cross-root/concurrency checks. Remaining evidence includes three
verified signed-remote pairs, imported conformance/trust receipts and complete
semantic input coverage, including the newly classified broad open footprint. The quiet
capture repair has passed the complete bounded preflight and the identity
package audit/docgen gate. That exploratory matrix supports the script repair;
it does not supply the durable real-pilot qualification matrix. The earlier
`--max-diagnostics=0` candidate was superseded after its insufficient capture
behavior was observed. Production credentials, lab
deployment and broad-family adoption remain outside this task's scope.

Further cross-root attribution check (2026-09-09): all three disputed root
TypeScript configuration files are tracked with identical Git blob IDs in
the main checkout and the isolated pilot worktree. `git check-ignore -v
--no-index` matches none of them in either root. Missing files, staged-byte
differences, and an ordinary ignore-rule match therefore do not explain
the observed input-map difference. The later
[SCM device control](./scm-device-preflight.md) attributes it to the sandbox's
unreadable `/dev/null`; adding a working device mount restores the historical
input maps and task hashes. This does not grant portability to the repaired
task, whose comparison matrix remains outstanding.

## Current-runtime Git configuration control (2026-09-21)

After refreshing the activation for kernel `Linux 6.18.52-1-lts` and its
runtime linker, stable 2.10.12 compared identical invalid identity source with
and without a local `core.excludesFile` pointing at a synthetic exclusion file.
Both direct lint runs exited one; the native selections, task hashes and input
maps were identical. Independent review checked two retained summaries and
four streams. The admitted wrapper passed dependency/toolchain parity before
and after. See `git-config-input-review.json`. This bounded noninterference
observation does not prove every Git configuration irrelevant or refresh the
entire pilot matrix; no signed replay or qualification credit is claimed.

## Historical direct-read reconstruction (2026-09-21)

`retained-direct-read-footprint.json` reconstructs a partial descriptor map
from the hash-verified retained trace at `028262e8c0`. The corrected analysis
joins 1,038,987 unfinished/resumed syscall pairs, with no unmatched or pending
pairs. It associates positive direct reads with 8,456 repository paths outside
identity and leaves 110 positive reads unattributed. The reconstruction now
retains descriptor mappings at read entry when available, avoiding attribution
loss when another thread closes a descriptor before the read returns. The initial 30-path
count omitted split calls and is superseded; it does not justify narrowing
the semantic input investigation to configuration and ignore files.

Inherited descriptors are discarded on exec; indirect ring I/O and concurrent
descriptor races remain unresolved. Successful file-backed mmap annotations
are inventoried separately; they name system libraries and I/O-ring mappings
and do not prove mapped-byte consumption. These
observations do not establish semantic dependence, irrelevance of other paths,
or a complete current-runtime read set.

## Current-runtime annotated scalar reads (2026-09-21)

The fresh bounded trace at `0dca998780` completed with exit zero and verified
dependency/toolchain parity before and after. `lts-annotated-io-review.json`
binds its receipt and independent review. All 66,381 positive scalar reads
have direct descriptor annotations; the parser joined 1,126,406 split calls
with no pending calls and found no nonempty scalar-read buffers. It attributes
reads to 8,456 repository paths outside identity, 27 identity paths, 16,739
installed dependency paths, 20 outside-repository paths and five non-filesystem
descriptors. This resolves scalar-read attribution for this execution without
relying on reconstructed descriptor lifetimes. Semantic relevance, possible
inputs on other execution paths and indirect ring I/O remain unproven.

## Explicit input-map comparison (2026-09-21)

`annotated-input-coverage.json` joins current-runtime repository read paths to
the retained stable native plan's identity/types inputs, global file map and
activation runtime-source list. It finds 53 covered paths and 8,430 absent
from those explicit maps. The plan comes from the same-revision invalid-source
positive control; the join compares path membership only. Native dependency
hashing may cover additional paths, and reading bytes does not establish
semantic relevance. No cache defect or qualification follows from this join.
Broad reads include other packages and goal/exploration code. The next input
closure work must attribute those dependencies or establish and validate a
bounded scanner/input contract, rather than extrapolating from a few unrelated
file perturbations.

## Private scanner candidate (2026-09-21)

`scoped-scanner-review.json` records an isolated root-config overlay that
changes only `files.includes` to select identity and types for initial scanning.
All rules, plugins, overrides and VCS settings remain unchanged. The unmodified
case passes and reduces other-repository direct read paths from 8,456 to 406.
An external import control passes; adding only a deprecation comment to its
JS/declaration overlays changes the quiet lint exit to one. Three trace reviews
verify original bytes, joined calls and annotated scalar reads with no captured
buffer contents. The admitted wrapper passed parity before and after.

This candidate is not adopted. Remaining reads include workspace configuration
and utils source. Workspace dependency checks, ignore semantics, native hash
and replay evidence, full pilot matrices and signed evidence remain required.

The follow-up `scoped-scanner-semantics-review.json` validates four private
candidate controls. Baseline passes; deprecating the existing types export
fails with `lint/suspicious/noDeprecatedImports`; invalid visible source fails;
the same bytes pass when a package ignore rule excludes them. Quiet and verbose
exits agree for every case. Four independent trace/stream reviews and mutation
byte comparisons passed, and the wrapper verified parity before and after.
Each case still reads 406 other-repository paths. The candidate remains
unadopted pending coverage and native hash/replay validation.

The explicit sibling-profile follow-up (`root-profile-scanner-review.json`)
passed all four semantic controls and parity checks, but read 8,457 repository
paths outside identity. It does not reproduce the direct root-overlay scan
reduction and is not adopted. Effective includes and configuration discovery
must be attributed before selecting a package-scoped implementation. The
package-local project-root attempt separately failed plugin loading and has
no semantic acceptance (`package-scanner-rejection.json`).

The self-contained sibling-profile follow-up (`flat-profile-scanner-review.json`)
passes the four workspace/ignore controls with quiet/verbose exit parity and
verified mutation bytes. Independent review of all four traces finds 407
other-repository read paths and no unattributed positive scalar reads or
captured read buffers. Its baseline set equals the successful direct overlay's
406 paths plus the explicit profile itself. The admitted wrapper verifies
dependency and toolchain parity before and after. This provides a candidate
configuration-selection mechanism without replacing the shared root config.
It remains unadopted: external dependency controls for this explicit profile,
generation and hash coverage, native replay, full pilot matrices and signed
evidence remain pending.

`flat-profile-external-review.json` closes the explicit profile's external
deprecation control: baseline and normal import pass; adding only a deprecation
comment to installed JS/declaration overlays fails with the expected
`noDeprecatedImports` diagnostic. Quiet/verbose exits agree. Three trace reviews,
verbose stream hashes and mutation-only byte comparisons pass; the wrapper
confirms dependency and toolchain parity before and after. This validates the
tested dependency behavior without granting input-closure or replay acceptance.

The implementation seam is `Cache.pilot.ts`: `verifyNativePlan` requires the
fixture's inputs, commands and task configuration to match the live census;
`execute` uses strict environment mode. A private profile mount alone cannot
satisfy adoption. Generated profile bytes and selection must enter the reviewed
computation contract and native inputs, with portable selection across fixture
roots. Preserve root-rule changes in generation and mutation checks. The
existing root-lint-config mutation must still change effective behavior;
copying an old profile while modifying its source configuration is insufficient.

Generation review found that the flat candidate dropped root `files.includes`
negations. The successful package-ignore control does not cover this behavior.
Earlier candidate observations remain valid for their tested cases, but are
insufficient for adoption. The current private candidate preserves all root
negations in order after the narrowed positive selectors and rejects root
positive-selector shapes other than the reviewed leading `**`. An admitted
original/flat/preserved generated-source comparison is pending; see the friction
ledger. No production lint or cache configuration has changed.

`preserved-profile-scanner-review.json` now supersedes the flat profile as the
implementation candidate. The original configuration passes identical invalid
`qualification.gen.ts` bytes, the flat profile fails, and the preserved-exclusion
profile passes. All six baseline/workspace/external/syntax/ignore cases also
pass their expected outcomes. Nine trace/stream reviews and before/after parity
pass. The revised profile reads 396 other-repository paths in all seven cases
that select it. Configuration comparison confirms that root negations retain
their exact order and every other configuration field is identical. Generation
must reject unreviewed positive-selector shapes rather than silently changing
semantics. Remaining input coverage, native replay and signed acceptance remain
open; no profile is adopted and no tuple is qualified.

`preserved-profile-input-coverage.json` compares the revised candidate's 423
repository read paths (27 inside identity, 396 outside) against the retained
original-profile explicit native/runtime maps. It finds 49 covered paths and
374 absent: 147 manifests, 169 TypeScript configs, 20 ignore files, seven Turbo
configs, 27 utils sources, two Vitest support files, the proposed profile and
the fixture Git pointer. This is a membership comparison to the old plan, not
a native plan for the new candidate or proof of semantic dependence.

Implementation must retain live-census parity, bind effective profile bytes and
portable selection, and verify actual native expansion of configuration/source
inputs. Future imports and alternate configuration names cannot be covered by
freezing this observed list. The Git pointer remains a separate attribution
obligation. Profile freshness must be enforced before fresh execution as well
as replay, so changing root rules cannot leave the lint command using a stale
generated configuration.

`profile-native-inputs-review.json` records an actual pinned stable-client dry
plan for proposed input patterns. Expanded maps cover 422 of 423 observed
repository read paths, leaving the mounted Git pointer. Independent file
verification passes for 5,694 input entries, with 40 explicitly classified as
CRLF-normalized Git blobs rather than raw-byte matches. Broad metadata globs
also include 4,912 installed dependency paths; explicit node_modules exclusion
is under test. These are dry-run findings, not replay acceptance. Strict
environment configuration selects the candidate only for identity; types keeps
its original configuration. The final pilot must preserve that scope explicitly
rather than assume the selector propagates to dependencies.

The revised native plan (`profile-native-inputs-v2-review.json`) passes with an
explicit node_modules exclusion: 754 identity inputs plus 28 types inputs, all
782 independently matching raw Git blob hashes. It retains coverage of the same
422 observed repository paths and excludes every installed dependency path.
The remaining observed repository path is the fixture Git pointer. Wrapper
parity passes before and after. This provides a concrete retained input
configuration for implementation; it is still a dry plan with cache disabled,
not execution, replay, complete semantic closure or qualification.

The working-tree implementation (`profile-generation-implementation.json`) adds
`cache profile`: default freshness checking and explicit `--write` generation
for the fixed root-sibling candidate. Four focused tests pass, including root
changes and symlink refusal; the production projection structurally matches
the retained behavior-tested profile. Full package verification is running.
The command is not yet wired into pilot execution and does not activate cache
reuse or select the candidate for ordinary lint. Runtime integration, native
replay and qualification gates remain open.

Seven actual CLI fixture cases now pass: missing default check fails without
creating output; explicit write succeeds; default current check succeeds without
rewriting; a root change makes the default check fail without rewriting;
regeneration and its subsequent check succeed; unsupported selectors fail even
with `--write` and preserve prior output. Stream hashes and negative diagnostics
were independently verified. These exercise command flag/default wiring in
addition to the four helper tests. Full package verification remains pending.

Full package verification is now terminal: docgen passed, audit failed on three
cheap-gate runner assertions outside the new profile tests. Isolated and
whole-file reproductions pass, so attribution remains unresolved. The P0 is
open; narrower passes do not replace package verification. Runtime integration
is paused while this failure is investigated.

The audit failure is attributed and repaired in `afce6d6625`: root launch
loads `TURBO_CACHE`, and raw command comparisons in the cheap-gate fixture
misclassified cache-posture differences and failed to inject expected errors.
The fixture now reuses existing command normalization. All 242 tests in that
file pass under the reproducing root environment. The P0 is acknowledged
against that fix commit; full package verification is running again. Historical
pilot receipts remain evidence for their recorded revisions, not this new head.

`profile-git-routing-attribution.json` attributes the remaining fixture `.git`
read to Biome. The retained baseline shows 46 bytes read from the pointer, six
from the worktree `commondir`, and 727 from the common `info/exclude`. The latter
is already represented by the portable `.git/info/exclude` runtime-source hash.
This supports routing-metadata attribution for that run; it does not prove all
Git configuration irrelevant or establish current-head execution. The trace
suppresses buffers, so its returned bytes are not independently hashed. Preserve
portable identity and validate routing invariants during integration instead of
blindly hashing clone-specific pointer text into native task inputs.
