---
title: Docgen spawns the turbo binary itself, with no daemon and no bunx wrapper
date: 2026-11-26
reversal: Spawn `bunx turbo run docgen` and drop `--no-daemon` from the docgen turbo argv.
governs:
  - src/commands/Docgen/internal/Local.ts#turboBinaryPath
  - src/commands/Docgen/internal/Local.ts#turboArgsForSelectedPackages
  - src/commands/Docgen/internal/Local.ts#runFullDocgen
enforcedBy: []
---

Docgen spawns `node_modules/.bin/turbo` directly and always passes `--no-daemon`, so no process outlives the turbo child.
Reason: on the fleet image a resident bun wrapper and a daemon spawned inside the child both held process handles after successful runs, which kept the hosted Docgen lane's bun wrapper from exiting (a hang, or SIGABRT at teardown).
Spawning turbo from this command also lets the typed lane concurrency setting govern full and affected proofs through one local command surface.
Turbo 2.10 no longer uses the daemon for `turbo run` and dropped the `--daemon=false` value form; `--no-daemon` is still accepted.
Rejected: `bunx turbo`, which leaves a resident bun wrapper between the CLI and turbo, and the default daemon.
