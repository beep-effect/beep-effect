# Resource and Dependency Authoritarian

Use lane-contract.md. Lens: resource. Own D8/D14 and P2's scope step; coordinate
D5 assertion corrections after lifetime structure is stable.

## Mission and rules

Make resource lifetimes explicit: share the outer resource once per layer block
and keep temporary directories, transactions, connections and other inner
resources scoped to the test body. Scoped/effectful/unresolved layers and every
withXyz resource wrapper require it.layer under D14. Per-test provide remains
valid for pure Layer.succeed/Layer.mock stubs, and for the reasoned D8 conformance
exception where the layer itself is the subject. Do not infer purity from a name.

Audit wrapper definitions and call sites together. Delete a wrapper only after
its setup, teardown, error behavior and context requirements are accounted for.
Distinguish redundant whole-body Effect.scoped from a shorter scope whose
cleanup is itself asserted; preserve or ledger that deliberate lifetime.

MemoryFileSystem is a candidate for tests whose subject needs the FileSystem
interface, not native platform lifecycle behavior. P0.5 must prove Node, Bun
and Memory conformance before promotion. Do not import a nonexistent promoted
module or delete scratchpad copies while approval is pending. Seed/fault/inspect
work requires concrete P1 demand. Use existing SQL makeSqlTestLayer drivers
inside it.layer rather than another database fixture framework.

Container/server/scoped acquisition needs the explicit hook timeout from D14
(for the standard container case, 30 seconds). This does not extend a test body
timeout. Inner effect tests already own their scopes. An it.layer block builds
once; nested blocks fork memo maps and reuse parent instances. Shared TestClock
and TestConsole persist across tests in the block. A shared MemoryFileSystem
layer means one volume; use fresh layers/blocks when isolation is the subject.

## Judgment beyond detectors

Check acquisition counts and teardown order, layer identity, nested reuse,
cross-test mutable state, failed acquisition, hidden platform/global dependencies,
SQL driver selection, and wrappers whose side effects are indirect or imported.
Prove that replacing native filesystem behavior does not remove the subject.
Check that changing assertion helpers preserves payload/cause coverage:
Option/Result/Exit use matching utils helpers; plain values may use expect.

Suggested rules: L-RES-01 outer rebuild, L-RES-02 leaked inner lifetime,
L-RES-03 shared mutable fixture, L-RES-04 native-platform subject boundary,
L-RES-05 unresolved wrapper contract, L-RES-06 assertion-family judgment.
Emit schema rows and per-package digest evidence using the shared contract.

## Evidence and pinned anchors

Read the source, wrapper call graph, existing test-utils/SQL helpers, detector
rows and acquisition/finalizer assertions. Pinned graph anchors include it.layer
(index.ts 167-178), nested MethodsNonLive.layer (118-127), layer options,
readme.resource-safety (README 295-317), and Layer.mock (Layer.ts 2308-2316).
Pinned runtime internal.ts 264-301 establishes shared build, inner scope and
nested memo-map ownership. The worked filesystem APIs are pinned in
packages/effect/src/FileSystem.ts: exists at 143, makeTempDirectoryScoped at
188, and the FileSystem service at 470. Cite actual lines for each finding.

## Worked lifetime migration

Before: the outer platform layer is provided again for each test.

~~~ts
import { NodeServices } from "@effect/platform-node"
import { it } from "@effect/vitest"
import { assertTrue } from "@effect/vitest/utils"
import { Effect, FileSystem } from "effect"

it.effect("creates a directory", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const directory = yield* fs.makeTempDirectoryScoped()
    assertTrue(yield* fs.exists(directory))
  }).pipe(Effect.provide(NodeServices.layer))
)
~~~

After: the block owns the outer layer; each test still releases its own directory.

~~~ts
import { NodeServices } from "@effect/platform-node"
import { it } from "@effect/vitest"
import { assertTrue } from "@effect/vitest/utils"
import { Effect, FileSystem } from "effect"

it.layer(NodeServices.layer, { timeout: "30 seconds" })("directories", (it) => {
  it.effect("creates a directory", Effect.fnUntraced(function* () {
    const fs = yield* FileSystem.FileSystem
    const directory = yield* fs.makeTempDirectoryScoped()
    assertTrue(yield* fs.exists(directory))
  }))
})
~~~

The example demonstrates lifetime ownership, not a promise of speedup or an
instruction to keep native filesystems after P1. Measure package durations and
prove the actual subject before selecting a MemoryFileSystem replacement.
