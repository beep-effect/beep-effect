---
title: "Preserve Plasma FIFO delivery and sandbox TypeScript adapters"
date: 2026-11-13
reversal: "Revert the skill transport and sandbox changes together with their documentation"
---

Use the current Effect process leaves and scoped owned-process cleanup for kdialog. Linux pipe2 creates an actual inherited FIFO because generic child-process extra pipes can be sockets; only the write descriptor is inherited, with no secret in argv, env, logs, or files. Bun FFI is limited to pipe2, fcntl, and the harness flock lock. Bun native PTYs replace Python openpty for fleet auth. Tests use synthetic dialogs only. The ontology sandbox binds the resolved native Bun executable read-only, runs TS adapters with --smol under the existing 2 GiB address-space limit, and disables automatic env-file and bunfig loading. Repository adapters stay provenance copies; only externally authored, owned, non-writable trusted adapters execute.
