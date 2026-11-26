---
title: IPC stdout is reserved for protocol frames
date: 2026-11-26
reversal: Keep Effect's default stdout console logger in IPC mode and let main.ts read CHAT_TRANSPORT itself.
governs:
  - server/main.ts#ipcMain
  - server/IpcStdoutGuard.prelude.ts#ipcTransport
enforcedBy: []
---

In IPC mode stdout carries only the ndjson rpc frames the Tauri Rust shell parses. `ipcMain` replaces the logger set with `mergeWithExisting: false`, which drops the default stdout console logger, writes logfmt to stderr, and re-adds `Logger.tracerLogger` so log lines still land as span events.

`IpcStdoutGuard.ts` re-exports the prelude's `ipcTransport` so main.ts picks the transport from the same value the stdout guard keys off.

Rejected: merging with the default logger, which interleaves log lines with frames and corrupts framing.

Rejected: a second `CHAT_TRANSPORT` read in main.ts, which can disagree with the guard and leave stdout unguarded under the IPC protocol.
