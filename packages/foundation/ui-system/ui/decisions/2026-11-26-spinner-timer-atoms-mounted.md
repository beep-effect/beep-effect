---
title: The spinner's timer and cleanup atoms are mounted for the hook's lifetime
date: 2026-11-26
reversal: Remove the two useAtomMount calls in useSpinner and read the atoms only on press and release.
governs:
  - src/hooks/useSpinner.ts#useSpinner
enforcedBy: []
---

The live `setTimeout`/`setInterval` handles sit in `spinnerStateAtom`, which is written on press and read on release with no subscriber in between. useSpinner mounts it and `spinnerCleanupAtom`, so the handles live exactly as long as the spinner that owns them.
Rejected: leaving the atoms unmounted. A registry with an idle TTL, which the app atom providers configure, sweeps a node with no listeners; a button held past the TTL then loses its handles, `stop` reads the default and clears nothing, and the interval keeps spinning the value until a reload.
