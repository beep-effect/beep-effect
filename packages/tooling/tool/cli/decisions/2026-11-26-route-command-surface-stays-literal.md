---
title: The route subcommands keep literal Command.make calls and one shared corpus flag binding
date: 2026-11-26
reversal: Generate the census and replay commands from one factory that takes the subcommand name and flags.
governs:
  - src/commands/Ci/Route.command.ts#runCorpusReport
  - src/commands/Ci/Route.command.ts#corpusFlag
enforcedBy: []
---

The knowledge doctor derives the documented command surface statically from the CLI source: it reads bound string names in `Command.make` calls and resolves a flag identifier to its `Flag` initializer. `census` and `replay` differ only in the reader method they run and how the report prints, so only the handler body (`runCorpusReport`) is shared; each `Command.make` stays literal, and both commands bind the one `corpusFlag` identifier.

Rejected: a factory that builds both commands from a name argument, which leaves the doctor nothing static to read and reports their options as unchecked.
