# Yeet Effect port drafts

These files preserve an unfinished sketch of an Effect-based Yeet inbox port.
They are design text, not an executable package or a completed implementation.
The Boolean-Creep campaign does not use them.

The original save contained only four TypeScript files. HookKernel and InboxState
referenced a missing Domain module, and WatcherKernel duplicated Processes.
No indexed source imported the folder. Completing that port is separate work;
these archives retain every original byte for that continuation.

| Saved draft | Purpose |
| --- | --- |
| [HookKernel](./drafts/HookKernel.ts.txt) | Hook dispatch and lease observations |
| [InboxState](./drafts/InboxState.ts.txt) | Transactional inbox and configuration sketches |
| [Processes](./drafts/Processes.ts.txt) | Process identity and simulation sketches |
| [WatcherKernel](./drafts/WatcherKernel.ts.txt) | Original duplicate process sketch |

The [manifest](./drafts/manifest.json) records original repository paths, the saved
commit, byte counts and SHA-256 hashes. Before promoting any draft back to source,
supply its missing domain contracts, reconcile duplicate modules, document exports
and verify behavior with the workspace's current Effect version and quality gates.
