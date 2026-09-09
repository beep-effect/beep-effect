# P0.5 Bun positional-write boundary

Status: inherited incompatibility reproduced; compatibility repair not yet applied.

The port's two platform suites each retain 21 cases. Node executes all 42;
Bun 1.4.2 fails the same cursor-write case in each suite. Root extracted that
one upstream case unchanged (case SHA256
c2b730b15e2b37dd98a4f8e70e3743bf6242adba1ceb77f0b759af700e07a5b8)
and ran it independently of the port. Node v24.20.0 passes 2/2; Bun 1.4.1 and
1.4.2 each fail 2/2. Expected overwrite after a backward seek instead appends.
This is inherited by both Bun versions, not introduced by the port or the
refreshed main runtime pin.

A separate direct node:fs.write probe isolates the overload boundary. Write
abcde at position zero, then XY at position two:

| Runtime | Undefined offset/length, explicit position | Explicit 0 / buffer.length, explicit position |
| --- | --- | --- |
| Node v24.20.0 | abXYe | abXYe |
| Bun 1.4.1 | abcdeXY | abXYe |
| Bun 1.4.2 | abcdeXY | abXYe |

The raw probe uses no Effect or Vitest, asserts no alternative contract, and
removes its uniquely owned host directory in finally. Exit zero means the probe
reported its observations; correctness is the explicit output comparison above.
The pinned NodeFileSystem implementation passes undefined offset/length in
write and writeAll (node-shared source lines 344 and 360). A candidate fix is
explicit 0 / buffer.length at those two calls, retaining optional append position.
It has not been applied, and no conformance assertion has been changed.

The existing Grok grounding session is researching primary-source support and
risks (views, partial writes, append semantics), plus the separate compiler
entrypoint classification issue. That is a research follow-up, not P0f review.
No dependency upgrade, global configuration change, skip, retry or timeout fix
has been made. Keep the failure receipts when proving any later patch.

Private receipts: p05-pinned-write-cursor-runtime.json,
p05-pinned-write-cursor-*.vitest.json, p05-raw-write-runtime.json and the matching
logs. Reproduction sources are .beep/p05-conformance-review in the filesystem
publication worktree.

## Compatibility patch and fresh runtime proof

Root prepared the package through Bun's patch command, changed exactly the two
write/writeAll calls in both TypeScript source and emitted JavaScript, and saved
the reproducible patch under patches/@effect%2Fplatform-node-shared@4.0.0-rc.112.patch.
The root patchedDependencies entry and lockfile record that patch. No dependency
version or test expectation changed. This is a Bun package-patch operation;
no git commit was made. The primary goal worktree's installed source and emitted
adapter hashes remain identical to their original values.

A fresh, separate matrix against the patch passes Node 21/21 and both platform
aliases under actual Bun 42/42. Current scratchpad Memory remains 20/21 on each
runtime, failing only the pending copy-path assertion. All captured source and
runtime-adapter hashes were stable throughout. The old unpatched matrix and raw
runtime failure receipts remain intact; the new proof is
p05-patched-prepromotion-matrix.json. This establishes the focused repair, not
package or hosted acceptance. A bounded continuation now adds public writeAll,
view and append regressions and the compatible pipeable helper overload.
