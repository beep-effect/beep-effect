# P0.5 conformance progress

Status: current Node/Bun/Memory conformance is green; the copy correction and
its package handoff are verified. Minimal core promotion is the next step.

The source reconnaissance completed under Astra/xhigh. The conformance lane then
created FileSystemConformance.ts and the Node/Bun platform test entries in the
separate filesystem worktree. Static comparison retained all 21 upstream cases,
46 explicit assertion sites, cursor operations, two optional flags/defaults,
full MIT notice and direct per-test subject provision. The four host-fixture
cases now use a scoped subject-local fixture with the 27 pinned bytes.

Root captured the complete unpatched and patched matrices after the writer
exited, each with stable hashes. Node passes 21/21. The shared-platform patch
fixes Bun's two cursor-write failures, giving 42/42 across both platform aliases.
Before the copy correction, Memory passed 20/21 on each runtime; its deliberate destination-path error
metadata conflicts with the source-path conformance assertion. Root has withdrawn its extra choice gate: the original D8 instruction
already authorizes correcting this divergence without weakening conformance. The existing scratchpad regression suite separately passes 17/17 on
Node and Bun. Nothing has been promoted or deleted.

The conformance integration and Quality policy lanes have both exited 0 and
have no live source writer. The helper's original positional form and equivalent
pipeable form both register the complete suite. Three new compatibility tests
cover writeAll, nonzero-offset views, and append/read-cursor behavior. Focused
Node and Bun runs each pass 45/45 with zero skips. Static comparison preserves
the full 21-case registration body and all 46 original assertions.

Root added the exact file-local D14 entrypoint directive after writer exit;
its focused compiler now exits 0. The actual quality tsgo-rules command exits 0
and verifies all 103 installed rules remain globally configured as error. The
contextual policy allows only the exact canonical line at the exact helper path;
recognition is unchanged, and other paths/rules/forms remain rejected.

Both full package commands passed in the filesystem publication worktree:

| Command | Audit | Docgen | Process | Exit |
| --- | --- | --- | --- | --- |
| `bun run beep quality package-verify @beep/test-utils` | 11.5s | 3.3s | 16.518s | 0 |
| `bun run beep quality package-verify @beep/repo-cli` | 366.7s | 16.7s | 385.322s | 0 |

The terminal status's raw `sourceHashesStable: false` is attributed, not hidden:
the inventory grew from 867 to 868 paths because the existing doctest fixture
generated a `node_modules/.vite/vitest/.../results.json` cache. No original input
changed or disappeared during either command. Root hashed all 867 original
inputs again after both commands; all remained unchanged. The immutable raw
status and logs are retained alongside `p05-package-verify-terminal-review.json`.
This proves the current two-package surface, not Memory conformance or the later
full Yeet and hosted gates.

The compiler integration resolves two earlier failures: the public helper now
has an equivalent pipeable form, and the exact file-local D14 entrypoint
exception is recognized by the Quality policy. Historical failed compiler and
unpatched runtime evidence remains retained. No global rule severity changed.

The core readiness lane completed its static law/reuse review. A continuation
then captured 12 private public-behavior cases on the unchanged engine; all pass
on Node and Bun. Root rehashed all 896 enumerated inputs after writer exit and
confirmed no changes. These are pre-refactor observations, including locale
sorting and delayed cursor failures, not conformance or promoted-source proof.
Reports are history/lanes/p05-core-promotion-readiness.md and
history/lanes/p05-core-characterization.md. The exact two-file source-path correction is now verified under the original
D8 authorization. All 21 conformance, 17 existing and 12 unchanged characterization
cases pass on actual Node and Bun (50/50 per runtime, zero skips). Root confirmed
exactly two authorized changes among 912 inputs and no current drift. The
canonical scratchpad package command passed docgen 22.4s; audit was unavailable
because the lab manifest has no beep:audit script. The corrected core is ready
for minimal promotion, which will need its own public-boundary and package proof.
No Memory promotion, scratchpad deletion, PR, commit, push or merge has occurred.

The three D5 documentation corrections required for the initial goal PR are
reviewed and verified independently in the primary goal worktree by the resumed runner
CLI session under Astra/xhigh, with 18 tests passing on each runtime and a
strict compiler check. It owned only the testing architecture guide,
testing patterns, the testing lines of the Effect-first skill, and its report.
P0.5 is still the active phase; P0f/P0g and P1/P2 remain pending.
