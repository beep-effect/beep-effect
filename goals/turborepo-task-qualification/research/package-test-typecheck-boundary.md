# Package test typecheck boundary

Source review at `0dca998780`, covering the 140 retained terminal sites whose
command is `beep-cli quality test-tsgo-package`. This is source interpretation,
not a new compiler execution or runtime qualification.

## Selection and semantic inputs

The worker resolves the repository root but treats the invocation's current
working directory as its package directory. It recursively discovers TypeScript
files under paths containing `/test/`, excludes `node_modules`, `dist`,
`coverage`, `tmp`, test fixtures and the infra Lambda subtree, and assigns each
file to its nearest ancestor manifest. Files owned by nested packages are not
silently assigned to the invoking package. No owned test files is an error.

The selected configuration is the first existing candidate: package
`tsconfig.test.json`, `test/tsconfig.json`, then `tsconfig.json`. Therefore file
presence, directory membership and manifest boundaries are semantic inputs,
in addition to file contents. Compiler config inheritance, imported source,
installed types and the actual root `node_modules/.bin/tsgo` executable remain
part of the downstream compiler boundary.

The worker writes a package-labelled synthetic config beneath
`node_modules/.tmp/tsgo-test-checks`. It extends the selected config, includes
the discovered absolute file paths, clears project references and exclusions,
sets rootDir to the repository, and supplies the static no-emit/non-incremental
compiler template. The compiler runs from the repository root. Normalized
extra arguments are appended after `-p <synthetic-config> --pretty false`;
these arguments require interpretation and cannot be discarded when describing
the effective compiler behavior. The template alone does not prove every
possible forwarded invocation is read-only.

## Writes, capture and verdict ownership

The synthetic config is written before the compiler starts and removed in an
ensuring finalizer. The worker then creates or replaces
`.turbo/package-test-typecheck-result.json` in the owning package. That artifact
contains package name, captured compiler output and compiler exit code.

The worker's successful completion means that it produced the artifact. It
does not independently assert that the stored compiler exit code is zero.
The root lane clears old result artifacts, invokes the selected Turbo graph
with serial concurrency and a run summary, rejects a failing Turbo process,
requires a hashed summary task for each package, decodes each result and checks
its package identity. It then fails on nonzero stored compiler exits or Effect
diagnostic lines. Thus neither a task hit nor the worker process exit code can
replace interpretation of the result artifact and the aggregate verdict.

Root discovery additionally partitions packages by whether their ordinary
check scripts already cover all discovered tests. An empty discovered set or
complete coverage returns without Turbo execution. Those no-op branches are
not successful compiler observations. Selected missing package-task scripts
fail. The root runner removes the shared temporary directory in its finalizer;
concurrent root invocations and package-label collision behavior need runtime
review before claiming supported concurrency.

## Current posture and remaining proof

The live root Turbo declaration has `cache: false`, `dependsOn: ["^transit"]`
and the result JSON as its declared output. Its explicit inputs include package
source/test/config paths, the root base config, `Quality.command.ts` and the
synthetic template. This source review grants no change to that posture.

The existing `test-tsgo-turbo-inputs.test.ts` is a hash-invalidation fixture
whose task prints a message. It covers declared input classes; it does not run
the real worker, prove compiler semantics, or validate artifact verdicts. No
new test run is claimed here.

Any future candidate needs original result/output bytes, compiler and installed
resolution identity, config-presence and ownership perturbations, diagnostic
failure interpretation, temporary/output write capture, forwarded-argument
controls, cross-root normalization and concurrency evidence. Required Quality
and hosted verdicts retain their current owners.
