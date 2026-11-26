---
title: Long-lived fn-atom work writes through the AtomRegistry service, never the fn node's own context
date: 2026-11-26
reversal: Write the log lines and composer state through the fn's ctx.set and the node-bound setters.
governs:
  - src/transport/IpcSpikePanel.tsx#runSpikeAtom
  - src/chat/ui/Composer.atoms.ts#composerSerializedChangeHandlerAtoms
  - src/chat/ui/Composer.atoms.ts#composerSendHandlerAtoms
  - src/chat/ui/Composer.atoms.ts#composerStopHandlerAtom
enforcedBy: []
---

A fn atom's node can be interrupted or swept while work it started is still running: a re-run or Cancel interrupts the IPC spike's node before its fiber unwinds, and the editor's draft-change, send and stop bindings keep calling their closures after the idle sweep disposes the handler atom. Reads and writes through a disposed node's context are silently dropped, so this work goes through the registry handle, which outlives the node.
Rejected: `ctx.set` and node-bound setters (the send was lost after the idle TTL, QA 2026-08-26 P0).
