# P0.5 conformance suite port lane

Use gpt-6-astra with explicit xhigh reasoning. This is the user-requested Codex
CLI implementation lane under D10. No native agents or additional CLI agents.

Working tree: ~/YeeBois/projects/beep-effect2-worktrees/effect-vitest-filesystem,
branch codex/effect-vitest-filesystem, base 663904610c. Fresh main pins Bun 1.4.2;
PATH is set accordingly. Node is v24.20.0. Effect, both platforms and Vitest
adapter remain rc.112; Vitest is 4.1.11. Frozen installation passed. Root moved
@effect/vitest from devDependencies to dependencies at the SAME catalog pin and
regenerated the lock. Do not change manifests, locks or root barrel yourself.

Create the report first and append as you work:
~/YeeBois/projects/beep-effect2-worktrees/effect-vitest-canon/goals/effect-vitest-canon/history/lanes/p05-conformance-port.md
Final message only that absolute report path. You are not alone: the read-only
recon lane writes its own report in the primary goal worktree; root owns packet,
manifest, lock, private proof scripts, package verification and git/publication.
Preserve every other file and do not revert another lane's changes.

## Ownership

Write ONLY:
- packages/tooling/test-kit/test-utils/src/FileSystemConformance.ts
- packages/tooling/test-kit/test-utils/test/FileSystemConformance.node.test.ts
- packages/tooling/test-kit/test-utils/test/FileSystemConformance.bun.test.ts
- the report above.

If a fixture or additional role file is necessary, propose its exact path and
reason in the report before writing it; prefer a portable subject-local fixture
without a new public option. Do not edit scratchpad, promote MemoryFileSystem,
write a Memory test yet, touch P0e's instrumented runner, or adopt this suite in
other packages. No git, agents, inbox acknowledgements/waivers, scanner writes,
configuration/global timeout/property floor/coverage changes, deleted tests,
source assertion weakening, package audits, broad check or web. Root runs full
package-verify after all writers exit. You may run focused tests for your files
and focused compiler/Biome checks; record exact commands and failures.

## Binding references and scope

Read the primary goal SPEC.md D1-D14, PLAN.md P0.5, resource-authoritarian.md,
and the shared lane contract in its ops/prompts. These specify requested scope;
P1/P2 adoption has NOT been authorized. Read the live worktree AGENTS.md,
effect-first-development and schema-first-development skills and
.patterns/jsdoc-documentation.md before source work. Search live test-utils
source and src/index.ts for reuse; don't invent a parallel shared helper.

Root ran beep architecture / plan / create / add concept help before this new
surface. The operation factory accepts slice/concept/domain-kind/stage, not an
existing tooling/test-kit package. No fictitious product slice is justified.
Use the user-requested flat FileSystemConformance.ts entrypoint, consistent with
the existing package helper entries. Record this unsupported scaffold route;
do not hand-create a slice or mutate architecture policy.

Pinned source, never HEAD:
~/ .cache path without the intervening space:
~/.cache/beep/effect-vitest-canon/effect-rc112/packages/effect/test/FileSystem.test-utils.ts
435 lines; SHA256 8725010039e5ef2cee8b9b4fbcdb076f4099e8a44fe393a8e032c5fd89808abe.
Snapshot commit 2600f62f4532026928454dcea8d1c48557b3f942.
Its MIT license is at the snapshot root. Preserve full MIT notice and attribution
in the port. Do not substitute the SQL attribution or merely link a license.

Port ALL cases, assertions, flags and default semantics. Keep testLayer<E>(layer,
options = {}) with exactly the two optional flags accessOnDirectory and
tempFileScopedRemovesDirectory, each default true, and no additional public
options. Model the option data schema-first while preserving that structural
input contract, including {}, omitted flags, and false. No casts/suppressions.
Use $TestUtilsId and docgen-clean JSDoc on exports. Prefer canonical Effect helper
imports. Do not introduce wrapper-definition hiding or private Vitest APIs.

Replace plain it + local runPromise with it.effect, supplying the SUBJECT layer
per test with Effect.provide(layer). Record the explicit D14 exception reason:
the filesystem layer's lifecycle and isolation are under test. Do not wrap the
whole suite in shared it.layer; that would share a fresh memory volume across
cases. Preserve purposeful inner scopes that release resources BEFORE NotFound
assertions. Add outer test-scope cleanup for unscoped temp resources only after
preserving assertions that those resources survive the shorter inner scope.
No remaining host temp leaks, no cleanup catch-all that hides failures.

The initial readFile case currently uses a host __dirname fixture. Supply its
exact known content through the FileSystem SUBJECT in a per-test scoped temp
fixture, then keep its read/decode/trim/value assertion. This is fixture setup,
not public seed API promotion. Avoid host reads, fixed shared paths, exposing
host filesystem fallback, adding options, or dropping the readFile case. Explain
the adaptation and any subtle assertion implications in the report.

Root independently reproduced a real inherited copy-path conflict under Node:
upstream copy(overwrite:false) failure expects source; scratchpad deliberately
returns destination and tests that. A user decision is pending. KEEP the pinned
source-path assertion intact. No error mapping, success/no-op workaround, test
skip or Memory flags to hide it. You do not own resolving this conflict.

## Runtime fixtures and evidence

Node test imports @beep/test-utils/FileSystemConformance and NodeFileSystem.layer.
Bun test uses BunFileSystem.layer and runs under actual Bun. If Node cannot load
the Bun implementation, use a public runtime-appropriate conditional import /
registration with an explicit documented platform skip, not a new global config.
Do not mark that runtime-specific case as proof it executed on Node. Both tests
use public @beep package aliases, not relative imports into src. Root will run
Node + Bun and later the scratchpad Memory adapter before any promotion.

Prove every pinned case was retained in a comparison table in the report (name,
source range, new range, flags, assertion categories, purpose of scopes). Include
exact diff/ownership summary, all focused command exits, lint/compiler concerns,
fixture adaptation, MIT evidence and unresolved questions. Do not claim full
conformance or package acceptance from your focused tests. Do not wait on the
user's copy-path decision to finish this independent port.
