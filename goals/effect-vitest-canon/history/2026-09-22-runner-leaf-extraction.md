# Instrumented runner extraction

The backlog-first identity remediation exposed a dependency cycle: test-utils
already depends on identity and schema, including through the runner errors.
The prerequisite branch `codex/effect-vitest-runner-leaf` extracts the existing
implementation into `@beep/test-runner`, scaffolded through `beep create-package`
as a tooling/test-kit package. The identity behavioral changes remain in the
separate `codex/effect-vitest-p1-reconcile` worktree.

The runtime and instrumentation modules move without behavioral edits. Public
runner errors preserve their historical schema identities, fields, defaults,
messages and constructors. Their metadata is pinned locally because importing
identity into this bootstrap package would recreate the cycle. The only schema
helper replacement is the equivalent Effect constructor default for Option.none.
Test-utils re-exports the same implementation and errors, including the named
source-only controlled-clock seam. Both packages deny published test subpaths.

The original runner unit suite moves to the leaf. Its package-local Probe service
key changes to the compiler-required new path; the original serial execution
order is preserved. The compatibility suite asserts reference equality for the
runner, both error constructors and the controlled-clock factory. The subprocess
suite remains at test-utils and exercises the compatibility imports.

Local verification: the leaf passes full package audit and docgen and its Node
unit run. Test-utils passes full configured package audit and docgen. Repo-configs
passes quick lint/check after regeneration of the allowlist snapshot. Existing
native-runtime allowances move with their identical runtime implementation; no
allowance category or reason is broadened. The scaffold-generated identity
registration needed formatting; its full package audit and docgen now pass.

Remaining before publication: integrate the merged detector prerequisite, finish
review of timing evidence, then run full Yeet publication and hosted closeout.
Schema/export and dependency checks are recorded below. No merge is authorized.


## Detector and import boundary checks

PR1185 supplies the new import-path recognition in a separate tooling/tool change.
Running that candidate scanner against this extraction emits nine findings for
the moved unit suite. Each matches the frozen original rule, evidence, class,
severity and confidence exactly; only file/line-derived identity moves. The
unmodified scanner emitted no rows for the new package, confirming why detector
support must precede adoption. The scoped baseline migration subsequently moved
only these nine rows, retaining all other 8,451 rows. With the candidate detector,
the ratchet reports zero introduced and zero resolved findings.

The workspace dependency graph remains acyclic with a proposed identity-to-runner
edge, including development dependencies. That closure contains identity, types,
test-runner and fc-runs. The leaf's only runtime dependencies are Effect and
Effect Vitest. Manifest checks confirm the internal wildcard and published test
subpaths are blocked, and the root published entrypoint targets dist/index.js.

### Generated integration follow-through

The package proofs passed before the final generated-reference repairs. The
cheap-gate pass then found policy-fingerprint drift, missing project references,
an unresolved scaffold Bun type entry, and the cache-policy delta. Canonical
generators updated the fingerprint and TypeScript references; the test config
now uses Node ambient types. The reviewed cache baseline records thirteen new
runner tasks and eleven changed existing tasks, with no removed computations
or qualification-state changes. See the scoped cache review in `research/`.
The final cheap-gate rerun passed all fifteen lanes. Follow-up quick package
proofs for test-runner and test-utils passed lint and type checks after the
configuration repairs. These results do not establish full Yeet or hosted
proof for the extraction. The updated detector candidate separately preserves
all nine moved findings; the old detector alone cannot prove that boundary.

### Historical metadata regression coverage

The compatibility suite now compares both public errors and their four annotated
fields against the original identity composer. This verifies the pinned metadata
against the old source of truth while keeping identity outside the runner's
dependency graph. Both focused compatibility tests and the full test-utils package audit/docgen
rerun pass.

## Main integration after detector merge

Merged main through PR #1185 and restored the saved extraction after a workstation
restart. Both appended opportunity logs are retained. The canonical cache baseline
writer preserves main's reviewed ciops build output change and records thirteen
new runner tasks, eleven changed existing tasks, no removals, and unchanged global
configuration. Frozen installation passed. The post-merge test-runner package
proof passed audit (10.1 seconds) and docgen (2.3 seconds). Further repository and
compatibility-package proof remains in progress.

## Atomic CI placement exception

Benjamin explicitly authorized a narrow D13 exception for the CI partition table
and focused tests in PR #1188. A separate prerequisite cannot pass the existing
fail-closed contract: missing package placements and placements for absent
packages are both rejected. The extracted runner therefore lands with its table
entries. It stays beside test-utils in lint-b and unit-a, preserving placement
of the moved workload. Historical p95 bin weights are retained as historical
evidence, not new measurements of the extra package startup overhead.

The focused CI partition suite passed all 70 tests. Full repo-cli package
verification passed audit (754.6 seconds) and docgen (25.1 seconds). Sherif and
changeset-status passed after manifest key ordering was corrected. Hosted
property failures on the prior head also identify the missing runner placement;
repository and hosted proof of the corrected head remain required.

Main was integrated again at 6c412ed5a3. Two existing CI test findings retained
their open dispositions; only their occurrence hashes changed to reflect the
135-to-136 task-count assertions. The detector reports zero introduced and zero
resolved findings. The three runner aliases were projected from root tsconfig
into the generated Vitest alias data; the tsgo-rules check passes.
